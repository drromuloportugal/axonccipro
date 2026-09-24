import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type AnalysisRequest = {
  text?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

// O gateway Cloud expõe uma API compatível com OpenAI. A chave fica somente
// nos Edge Function Secrets do Supabase, nunca no cliente ou no Vercel.
const CLOUD_API_URL = "https://gtw.cloud2.dgsis.com.br/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const SYSTEM_INSTRUCTION =
  "Você é um assistente de apoio clínico. Analise apenas o texto fornecido, explicite incertezas e sugira pontos para revisão pela equipe de saúde. Não faça diagnósticos definitivos, não prescreva e não substitua avaliação profissional. Em situação de urgência, oriente avaliação imediata por profissional habilitado.";

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    let payload: AnalysisRequest;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }

    const messages = payload.messages
      ?.map((message) => ({
        role: message.role,
        content: message.content?.trim(),
      }))
      .filter((message) => Boolean(message.content));
    const text = payload.text?.trim();

    if ((!text && !messages?.length) || (text?.length ?? 0) > 12_000) {
      return Response.json(
        { error: "Envie texto ou mensagens válidas para análise." },
        { status: 400 },
      );
    }

    const totalLength = (messages ?? []).reduce(
      (total, message) => total + (message.content?.length ?? 0),
      0,
    );
    if (totalLength > 60_000 || (messages?.length ?? 0) > 24) {
      return Response.json({ error: "Solicitação de análise muito grande." }, { status: 400 });
    }

    const apiKey = Deno.env.get("cloud_api_key");
    if (!apiKey) {
      console.error("Missing Cloud API secret");
      return Response.json({ error: "Serviço de análise indisponível." }, { status: 503 });
    }

    const completionMessages = messages?.length
      ? messages.map((message) => ({ role: message.role, content: message.content }))
      : [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: text! },
        ];

    const response = await fetch(CLOUD_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: completionMessages,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error("Cloud API request failed", response.status);
      return Response.json({ error: "Falha ao consultar o serviço de análise." }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const analysis = Array.isArray(content)
      ? content.map((part: { text?: string }) => part.text ?? "").join("")
      : String(content ?? "");

    if (!analysis) {
      return Response.json({ error: "O serviço de análise não retornou conteúdo." }, { status: 502 });
    }

    return Response.json({ analysis, model: MODEL });
  }),
};
