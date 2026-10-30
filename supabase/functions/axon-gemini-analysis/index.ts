import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type Message = { role: "system" | "user" | "assistant"; content: string };
type AnalysisRequest = { text?: string; messages?: Message[] };
type PubMedSummary = { pmid: string; title: string; journal: string; pubDate: string };

// Apenas termos institucionais fixos vão ao PubMed. Informações do paciente
// nunca são inseridas na consulta bibliográfica.
const EVIDENCE_TOPICS = [
  { test: /sepse|sépt|septic|choque sépt|antimicrobian|cultura|infecç/i, label: "Infecção, sepse e antimicrobianos", term: "sepsis OR septic shock OR antimicrobial stewardship" },
  { test: /delir|sedação|sedacao|rass|analgesi|padis/i, label: "Sedação, analgesia e delirium", term: "critical care sedation delirium analgesia" },
  { test: /ventila|desmame|extuba|fio2|peep|respirat/i, label: "Ventilação mecânica e desmame", term: "mechanical ventilation weaning intensive care" },
  { test: /neuro|glasgow|pic|ppc|hemorrag|avc|vasoespasmo|convuls/i, label: "Neurointensivismo", term: "neurocritical care intracranial pressure stroke" },
  { test: /renal|creatinin|diurese|diali|clearance/i, label: "Função renal no paciente crítico", term: "acute kidney injury critical care renal replacement" },
  { test: /hemodin|pam|pressão arterial|vasopressor|noradrenalina/i, label: "Hemodinâmica e vasopressores", term: "critical care hemodynamic vasopressor shock" },
  { test: /nutri|dieta|enteral|gastrostomia|jejunostomia/i, label: "Nutrição enteral", term: "critical care enteral nutrition" },
] as const;

const cache = new Map<string, { expiresAt: number; references: PubMedSummary[] }>();

function findTopic(value: string) {
  return EVIDENCE_TOPICS.find((topic) => topic.test.test(value));
}

function lastUserText(messages: Message[], text?: string) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? text ?? "";
}

async function pubMedReferences(topic?: (typeof EVIDENCE_TOPICS)[number]): Promise<PubMedSummary[]> {
  if (!topic) return [];
  const cached = cache.get(topic.term);
  if (cached && cached.expiresAt > Date.now()) return cached.references;

  try {
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", "5");
    searchUrl.searchParams.set("sort", "date");
    searchUrl.searchParams.set("datetype", "pdat");
    searchUrl.searchParams.set("mindate", "2020");
    searchUrl.searchParams.set("maxdate", String(new Date().getUTCFullYear()));
    searchUrl.searchParams.set("tool", "axonccipro");
    searchUrl.searchParams.set("term", `(${topic.term}) AND (guideline OR consensus OR systematic review OR randomized controlled trial)`);

    const search = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
    const ids = ((await search.json()) as { esearchresult?: { idlist?: string[] } }).esearchresult?.idlist ?? [];
    if (!search.ok || !ids.length) return [];

    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("retmode", "json");
    summaryUrl.searchParams.set("id", ids.join(","));
    summaryUrl.searchParams.set("tool", "axonccipro");
    const summary = await fetch(summaryUrl, { signal: AbortSignal.timeout(8_000) });
    if (!summary.ok) return [];
    const data = (await summary.json()) as { result?: Record<string, { title?: string; fulljournalname?: string; pubdate?: string }> };
    const references = ids.map((pmid) => ({
      pmid,
      title: data.result?.[pmid]?.title ?? "Título não disponível",
      journal: data.result?.[pmid]?.fulljournalname ?? "PubMed",
      pubDate: data.result?.[pmid]?.pubdate ?? "data não disponível",
    }));
    cache.set(topic.term, { references, expiresAt: Date.now() + 15 * 60_000 });
    return references;
  } catch (error) {
    console.warn("PubMed lookup unavailable", error);
    return [];
  }
}

function bibliographicAnswer(topic: (typeof EVIDENCE_TOPICS)[number] | undefined, references: PubMedSummary[]) {
  const title = topic ? topic.label : "Tema clínico não classificado automaticamente";
  const lines = [
    "## EVIDÊNCIA BIBLIOGRÁFICA",
    `**Tema identificado:** ${title}.`,
    "Esta é uma busca gratuita no PubMed, sem uso de modelo de IA externo e sem enviar dados do paciente à base bibliográfica.",
  ];
  if (references.length) {
    lines.push("", "### REFERÊNCIAS RECENTES");
    for (const reference of references) {
      lines.push(`- ${reference.title} — ${reference.journal}, ${reference.pubDate}. https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`);
    }
    lines.push("", "**Uso clínico:** leia a fonte original e correlacione com o quadro do paciente e com os protocolos institucionais.");
  } else {
    lines.push("", "Não foi possível obter referências agora. Os cálculos e alertas internos do Axon permanecem disponíveis.");
  }
  return lines.join("\n");
}

function protocolAnswer(allText: string) {
  if (/\"angles\"/.test(allText)) {
    return JSON.stringify({ angles: [
      { kind: "case", label: "Impacto no caso", question: "Qual o impacto desta informação no estado atual e nas tendências documentadas?" },
      { kind: "case", label: "Riscos a revisar", question: "Quais riscos clínicos devem ser correlacionados com os dados já registrados?" },
      { kind: "case", label: "Metas do turno", question: "Quais metas e reavaliações podem ser confirmadas pela equipe no próximo turno?" },
    ] });
  }
  if (/\"items\"/.test(allText) && /fasthug/i.test(allText)) {
    return JSON.stringify({ items: [] });
  }
  if (/\"summary\"/.test(allText) && /antimicrob|renal/i.test(allText)) {
    return JSON.stringify({ summary: "A busca bibliográfica gratuita não substitui a validação farmacêutica do ajuste de dose.", items: [] });
  }
  return "";
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });

    let payload: AnalysisRequest;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }

    const messages = (payload.messages ?? [])
      .map((message) => ({ role: message.role, content: message.content?.trim() }))
      .filter((message): message is Message => Boolean(message.content));
    const text = payload.text?.trim();
    const totalLength = messages.reduce((total, message) => total + message.content.length, 0);
    if ((!text && !messages.length) || (text?.length ?? 0) > 12_000 || totalLength > 60_000 || messages.length > 24) {
      return Response.json({ error: "Solicitação de análise inválida ou muito grande." }, { status: 400 });
    }

    const allText = messages.map((message) => message.content).join("\n");
    const protocol = protocolAnswer(allText);
    const topic = findTopic(lastUserText(messages, text));
    const analysis = protocol || bibliographicAnswer(topic, await pubMedReferences(topic));
    return Response.json({ analysis, model: "pubmed-eutilities" });
  }),
};

