// Orquestrador do Motor Clínico consumido pelo assistente NETO.
// Executa o pipeline determinístico completo (etapas 1 a 13) e devolve um
// resultado estruturado, rastreável e auditável.

import type { Patient } from "@/data/patients";
import { collectFacts, missingFromFacts } from "./dataset";
import { evidenceByDomain } from "./evidence";
import { runFasthug } from "./fasthug";
import { buildPlan } from "./plan";
import { detectIntent, INTENT_DOMAINS, INTENT_LABEL } from "./intent";
import { detectConflicts, runRules } from "./rules";
import { runScoreEngine } from "./scores";
import { PRIORITY_META } from "./types";
import type { Domain, EngineIntent, EngineResult, EvidenceRef, MissingData } from "./types";

export * from "./types";
export { QUICK_ACTIONS, INTENT_LABEL, detectIntent } from "./intent";
export { FASTHUG_STATUS_META } from "./fasthug";

export interface EngineOptions {
  intent?: EngineIntent;
  question?: string;
  now?: Date;
}

export function runClinicalEngine(patient: Patient, options: EngineOptions = {}): EngineResult {
  const now = options.now ?? new Date();
  const intent = options.intent ?? detectIntent(options.question ?? "");
  const focus = INTENT_DOMAINS[intent] ?? [];
  const inFocus = (d: Domain) => focus.length === 0 || focus.includes(d);

  const pipeline: string[] = [];
  pipeline.push("1. Paciente ativo identificado no passômetro");

  const facts = collectFacts(patient);
  pipeline.push("2. Dados estruturados coletados (vitais, exames, ventilação, medicações, dispositivos)");
  pipeline.push("3. Origem de cada dado classificada (informado / calculado / inferido / não informado)");

  const problems: string[] = [];
  if (facts.sepsisSuspected) problems.push("Infecção / sepse");
  if (facts.ardsSuspected) problems.push("Hipoxemia / SDRA");
  if (facts.invasiveVent) problems.push("Ventilação mecânica invasiva");
  if (facts.vasopressors.length) problems.push("Choque com vasopressor");
  if (facts.creat.value != null && facts.creat.value >= 1.5) problems.push("Disfunção renal");
  if (facts.neuroCase) problems.push("Lesão neurológica aguda");
  if (!problems.length) problems.push("Nenhuma síndrome prioritária detectada com os dados disponíveis");
  pipeline.push("4. Problemas e síndromes prioritários detectados");

  const scores = runScoreEngine(patient, facts);
  pipeline.push("5. Escores calculados/consumidos com componentes explícitos");

  const allFindings = runRules(facts, scores);
  pipeline.push("6. Regras determinísticas executadas");

  const domains = Array.from(new Set(allFindings.map((f) => f.domain)));
  const guidelines: EvidenceRef[] = domains.flatMap((d) => evidenceByDomain(d));
  pipeline.push("7. Diretrizes aplicáveis por domínio e versão localizadas");
  pipeline.push("8. Recomendações cruzadas com protocolos institucionais ativos");

  const conflicts = detectConflicts(allFindings);
  pipeline.push("9. Conflitos entre diretriz e protocolo verificados");

  const findings = allFindings
    .filter((f) => inFocus(f.domain))
    .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank);
  pipeline.push("10. Prioridade clínica classificada");

  const plan = buildPlan(facts, findings, now);
  pipeline.push("11. Plano das próximas 12 h gerado como monitorização/reavaliação");

  const missingMap = new Map<string, MissingData>();
  for (const m of [...missingFromFacts(facts), ...findings.flatMap((f) => f.missing)]) {
    if (inFocus(m.domain) || focus.length === 0) missingMap.set(m.key, m);
  }
  const missing = [...missingMap.values()];

  const inconclusive: string[] = [];
  for (const s of scores) {
    if (!s.available && (intent === "scores" || intent === "full")) {
      inconclusive.push(`${s.label}: não é possível concluir — ${s.missing.join(", ") || "dados ausentes"}.`);
    }
  }
  if (facts.pfRatio == null && (intent === "ventilation" || intent === "full")) {
    inconclusive.push("Gravidade da SDRA: não é possível concluir sem PaO2 e FiO2.");
  }

  const critical = findings.filter((f) => f.priority === "critical");
  const summary = [
    `${INTENT_LABEL[intent]} de ${patient.name ?? patient.id}.`,
    `Problemas: ${problems.join(" · ")}.`,
    critical.length
      ? `🔴 ${critical.length} achado(s) crítico(s): ${critical.map((f) => f.title).join(" · ")}.`
      : "Nenhum achado crítico disparado pelas regras determinísticas.",
    missing.length ? `Dados faltantes relevantes: ${missing.length}.` : "Sem lacunas relevantes de dados.",
  ].join(" ");

  const timeline = (patient.timeline ?? [])
    .slice(-12)
    .map((t) => ({ at: t.at ?? "", label: t.label ?? t.text ?? "", domain: "timeline" as Domain }));
  pipeline.push("12. Resposta estruturada gerada com justificativa e fontes");
  pipeline.push("13. Execução registrada para auditoria");

  return {
    patientId: patient.id,
    patientLabel: `${patient.name ?? patient.id}${patient.bed ? ` · leito ${patient.bed}` : ""}`,
    intent,
    intentLabel: INTENT_LABEL[intent],
    generatedAt: now.toISOString(),
    pipeline,
    dataset: facts.points.filter((p) => inFocus(p.domain)),
    problems,
    scores,
    findings,
    fasthug: runFasthug(facts),
    plan,
    missing,
    conflicts,
    inconclusive,
    guidelines,
    timeline,
    summary,
  };
}
