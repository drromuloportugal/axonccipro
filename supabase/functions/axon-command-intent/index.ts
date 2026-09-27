import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type IntentRequest = {
  transcript: string;
  activeTab: string;
  catalog: { devices: Array<{ code: string; label: string; sites: string[] }>; medications: string[]; fields: Array<{ key: string; label: string; aliases: readonly string[] }> };
};

const CLOUD_API_URL = "https://gtw.cloud2.dgsis.com.br/v1/chat/completions";
const MODEL = "gemini-3.8-flash";
const tabs = new Set(["proc", "med", "sup", "hist", "plan"]);

function fail(error: string, status: number) { return Response.json({ error }, { status }); }
function parseJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
  const start = fenced.indexOf("{"); const end = fenced.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try { return JSON.parse(fenced.slice(start, end + 1)); } catch { return undefined; }
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") return fail("Use POST.", 405);
    let body: IntentRequest;
    try { body = await req.json(); } catch { return fail("JSON inválido.", 400); }
    const transcript = String(body.transcript ?? "").trim();
    if (!transcript || transcript.length > 2000 || !tabs.has(body.activeTab)) return fail("Comando inválido.", 400);
    const apiKey = Deno.env.get("cloud_api_key");
    if (!apiKey) return fail("Serviço de interpretação indisponível.", 503);

    const schema = `{"target":"proc|med|sup|hist|plan","normalizedTranscript":"string","confidence":"high|review|low","missing":["string"],"explanation":"string"}`;
    const instruction = `Você normaliza comandos de voz de UTI em português brasileiro. Não prescreva, não invente valores e não altere o prontuário. Use SOMENTE itens do catálogo recebido. IOT significa intubação orotraqueal e deve ser normalizado para "adicionar tubo orotraqueal"; TOT é o código interno do dispositivo, não a palavra que o usuário disse. Se "IT" estiver na aba proc, trate como hipótese de IOT e use confidence review. Retorne exclusivamente JSON válido no formato ${schema}.`;
    let response: Response;
    try {
      response = await fetch(CLOUD_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 450, stream: false, messages: [
          { role: "system", content: instruction },
          { role: "user", content: JSON.stringify({ transcript, activeTab: body.activeTab, catalog: body.catalog }) },
        ] }), signal: AbortSignal.timeout(20_000),
      });
    } catch { return fail("O serviço de interpretação não respondeu.", 503); }
    if (!response.ok) return fail("Falha ao interpretar o comando.", 502);
    const payload: any = await response.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    const result = parseJson(Array.isArray(content) ? content.map((part: any) => part?.text ?? "").join("") : String(content ?? ""));
    if (!result || !tabs.has(result.target) || typeof result.normalizedTranscript !== "string") return fail("A interpretação não retornou um formato válido.", 502);
    return Response.json({
      target: result.target,
      normalizedTranscript: result.normalizedTranscript.slice(0, 2000),
      confidence: ["high", "review", "low"].includes(result.confidence) ? result.confidence : "review",
      missing: Array.isArray(result.missing) ? result.missing.map(String).slice(0, 8) : [],
      explanation: String(result.explanation ?? "").slice(0, 500),
      model: MODEL,
    });
  }),
};
