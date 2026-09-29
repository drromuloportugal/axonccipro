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

type PubMedSummary = { pmid: string; title: string; journal: string; pubDate: string };

// A consulta usa apenas um tema clínico extraído localmente do pedido — nunca
// envia prontuário, identificadores ou valores do paciente a serviços externos.
const EVIDENCE_TOPICS = [
  { test: /sepse|sépt|septic|choque sépt|antimicrobian|cultura|infecç/i, term: "sepsis OR septic shock OR antimicrobial stewardship" },
  { test: /delir|sedação|sedacao|rass|analgesi|padis/i, term: "critical care sedation delirium analgesia" },
  { test: /ventila|desmame|extuba|fio2|peep|respirat/i, term: "mechanical ventilation weaning intensive care" },
  { test: /neuro|glasgow|pic|ppc|hemorrag|avc|vasoespasmo|convuls/i, term: "neurocritical care intracranial pressure stroke" },
  { test: /renal|creatinin|diurese|diali|clearance/i, term: "acute kidney injury critical care renal replacement" },
  { test: /hemodin|pam|pressão arterial|vasopressor|noradrenalina/i, term: "critical care hemodynamic vasopressor shock" },
  { test: /nutri|dieta|enteral|gastrostomia|jejunostomia/i, term: "critical care enteral nutrition" },
] as const;

const evidenceCache = new Map<string, { expiresAt: number; references: PubMedSummary[] }>();

function evidenceTopic(text: string) {
  return EVIDENCE_TOPICS.find((topic) => topic.test.test(text))?.term;
}

async function currentPubMedReferences(text: string): Promise<PubMedSummary[]> {
  const topic = evidenceTopic(text);
  if (!topic) return [];
  const cached = evidenceCache.get(topic);
  if (cached && cached.expiresAt > Date.now()) return cached.references;

  try {
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", "3");
    searchUrl.searchParams.set("sort", "date");
    searchUrl.searchParams.set("datetype", "pdat");
    searchUrl.searchParams.set("mindate", "2020");
    searchUrl.searchParams.set("maxdate", String(new Date().getUTCFullYear()));
    searchUrl.searchParams.set("term", `(${topic}) AND (guideline OR consensus OR systematic review OR randomized controlled trial)`);
    const search = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
    const ids = ((await search.json()) as { esearchresult?: { idlist?: string[] } }).esearchresult?.idlist ?? [];
    if (!search.ok || !ids.length) return [];

    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("retmode", "json");
    summaryUrl.searchParams.set("id", ids.join(","));
    const summary = await fetch(summaryUrl, { signal: AbortSignal.timeout(8_000) });
    if (!summary.ok) return [];
    const data = (await summary.json()) as { result?: Record<string, { title?: string; fulljournalname?: string; pubdate?: string }> };
    const references = ids.map((pmid) => ({
      pmid,
      title: data.result?.[pmid]?.title ?? "Título não disponível",
      journal: data.result?.[pmid]?.fulljournalname ?? "PubMed",
      pubDate: data.result?.[pmid]?.pubdate ?? "data não disponível",
    }));
    evidenceCache.set(topic, { references, expiresAt: Date.now() + 15 * 60_000 });
    return references;
  } catch (error) {
    console.warn("Current PubMed lookup unavailable", error);
    return [];
  }
}

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

    const lastUserText = [...completionMessages].reverse().find((message) => message.role === "user")?.content ?? "";
    const currentReferences = await currentPubMedReferences(lastUserText);
    if (currentReferences.length) {
      completionMessages.unshift({
        role: "system",
        content: `REFERÊNCIAS BIBLIOGRÁFICAS RECENTES (consulta PubMed em tempo real, ${new Date().toISOString().slice(0, 10)}):\n${currentReferences.map((reference) => `- ${reference.title} — ${reference.journal}, ${reference.pubDate}. https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`).join("\n")}\n\nUse-as apenas como apoio bibliográfico. Elas são títulos/metadata, não substituem a leitura do texto completo. Cite somente uma referência que seja pertinente à conclusão e mantenha o link PubMed fornecido; não invente DOI, ano, título ou URL. Se a busca não cobriu exatamente a pergunta, declare essa limitação e priorize diretrizes da sociedade científica aplicável.`,
      });
    }

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
