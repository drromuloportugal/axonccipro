import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type AnalysisRequest = {
  text?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

// O gateway Cloud expõe uma API compatível com OpenAI. A chave fica somente
// nos Edge Function Secrets do Supabase, nunca no cliente ou no Vercel.
const CLOUD_API_URL = "https://gtw.cloud2.dgsis.com.br/v1/chat/completions";
const MODEL = "gemini-3.8-flash";

const SYSTEM_INSTRUCTION =
  "Você é um assistente de apoio clínico. Analise apenas o texto fornecido, explicite incertezas e sugira pontos para revisão pela equipe de saúde. Não faça diagnósticos definitivos, não prescreva e não substitua avaliação profissional. Em situação de urgência, oriente avaliação imediata por profissional habilitado.";

/**
 * Alguns gateways compatíveis com OpenAI devolvem objetos JSON consecutivos
 * (ou linhas `data:`) mesmo sem streaming. `response.json()` falha nesse
 * caso e transformava uma falha do provedor em erro 500 da Edge Function.
 */
function parseProviderPayloads(raw: string): unknown[] {
  try {
    return [JSON.parse(raw)];
  } catch {
    // Continua abaixo: a resposta pode conter objetos JSON concatenados.
  }

  const payloads: unknown[] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          payloads.push(JSON.parse(raw.slice(start, index + 1)));
        } catch {
          // Ignora somente o bloco inválido e procura o próximo.
        }
        start = -1;
      }
    }
  }
  return payloads;
}

function extractAnalysis(payloads: unknown[]): string {
  return payloads
    .map((payload: any) => payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.delta?.content ?? "")
    .map((content: unknown) =>
      Array.isArray(content)
        ? content.map((part: { text?: string }) => part.text ?? "").join("")
        : String(content ?? ""),
    )
    .filter(Boolean)
    .join("")
    .trim();
}

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

    let response: Response;
    try {
      response = await fetch(CLOUD_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: completionMessages,
          temperature: 0.2,
          max_tokens: 1500,
          stream: false,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      console.error("Cloud API connection failed", error);
      return Response.json({ error: "O serviço de análise não respondeu a tempo." }, { status: 503 });
    }

    if (!response.ok) {
      const providerError = (await response.text()).slice(0, 500);
      console.error("Cloud API request failed", response.status, providerError);
      return Response.json({ error: "Falha ao consultar o serviço de análise." }, { status: 502 });
    }

    const providerBody = await response.text();
    const analysis = extractAnalysis(parseProviderPayloads(providerBody));

    if (!analysis) {
      console.error("Cloud API returned no readable content", providerBody.slice(0, 500));
      return Response.json({ error: "O serviço de análise não retornou conteúdo." }, { status: 502 });
    }

    return Response.json({ analysis, model: MODEL });
  }),
};
