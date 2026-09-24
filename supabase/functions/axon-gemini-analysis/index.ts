import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type AnalysisRequest = {
  text?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

const MODEL = "gemini-2.5-pro";

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

    const apiKey = Deno.env.get("gemini");
    if (!apiKey) {
      console.error("Missing Gemini secret");
      return Response.json({ error: "Serviço de análise indisponível." }, { status: 503 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  messages?.find((message) => message.role === "system")?.content ??
                  SYSTEM_INSTRUCTION,
              },
            ],
          },
          contents:
            messages
              ?.filter((message) => message.role !== "system")
              .map((message) => ({
                role: message.role === "assistant" ? "model" : "user",
                parts: [{ text: message.content }],
              })) ?? [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini request failed", response.status);
      return Response.json({ error: "Falha ao consultar o Gemini." }, { status: 502 });
    }

    const data = await response.json();
    const analysis =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    if (!analysis) {
      return Response.json({ error: "O Gemini não retornou uma análise." }, { status: 502 });
    }

    return Response.json({ analysis, model: MODEL });
  }),
};
