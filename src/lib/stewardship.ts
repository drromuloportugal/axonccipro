// MOTOR INTELIGENTE DE STEWARDSHIP ANTIMICROBIANO
// Sistema de APOIO À DECISÃO CLÍNICA — não substitui a decisão médica.
// Cada alerta expõe: dado observado, motivo, tendência, implicação,
// recomendação para avaliação médica e fonte/protocolo.

import type { Patient, Medication, Culture } from "@/data/patients";
import { findAntimicrobial, classPathOf, type AwareClass } from "@/data/antimicrobials";
import { detectAntibiotic } from "@/lib/clinical";

export type StewardSeverity = "info" | "attention" | "critical";

export interface StewardAlert {
  id: string;
  code:
    | "EMPIRICO_PROLONGADO" | "DESCALONAMENTO" | "ESCALONAMENTO" | "CULTURA_POSITIVA"
    | "INADEQUACAO" | "RENAL" | "TERAPIA_PROLONGADA" | "AWARE_WATCH" | "AWARE_RESERVE"
    | "DUPLICIDADE";
  title: string;
  severity: StewardSeverity;
  /** dado observado */
  data: string;
  /** motivo do alerta */
  reason: string;
  /** tendência */
  trend: string;
  /** possível implicação */
  implication: string;
  /** recomendação para avaliação médica */
  recommendation: string;
  /** fonte / protocolo */
  source: string;
}

const DISCLAIMER =
  "Sistema de apoio à decisão clínica. Não substitui a avaliação e a decisão do médico assistente.";

export const STEWARDSHIP_DISCLAIMER = DISCLAIMER;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function labValue(p: Patient, code: string): { v: number; prev?: number } | null {
  const row = (p.exams ?? []).find((e) => (e.code ?? e.label) === code);
  if (!row) return null;
  const v = row.valueNum ?? parseFloat(String(row.value).replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return { v, prev: row.history?.[0]?.value };
}

function trendText(cur?: number, prev?: number, unit = "") {
  if (cur === undefined) return "Sem série temporal disponível.";
  if (prev === undefined) return `Valor atual ${cur}${unit} — sem valor prévio para comparação.`;
  const delta = cur - prev;
  const dir = delta > 0 ? "em elevação" : delta < 0 ? "em queda" : "estável";
  return `${prev}${unit} → ${cur}${unit} (${dir}).`;
}

export function antibioticsOf(p: Patient): Medication[] {
  return (p.medications ?? []).filter(
    (m) => (m.isAntibiotic ?? detectAntibiotic(m.name)) && m.active !== false,
  );
}

function positiveCultures(p: Patient): Culture[] {
  return (p.cultures ?? []).filter((c) => c.result !== "negativa" && !!c.organism);
}

/** Motor principal — devolve todos os alertas aplicáveis ao paciente. */
export function runStewardship(p: Patient): StewardAlert[] {
  const out: StewardAlert[] = [];
  const abx = antibioticsOf(p);
  if (abx.length === 0) return out;

  const cultures = p.cultures ?? [];
  const positives = positiveCultures(p);
  const creat = labValue(p, "Creat");
  const pcr = labValue(p, "PCR");
  const leuco = labValue(p, "Leuco");
  const lactato = labValue(p, "Lactato");

  const push = (a: Omit<StewardAlert, "id" | "source"> & { source?: string }) =>
    out.push({ id: `${a.code}-${out.length}`, source: a.source ?? "Protocolo institucional de stewardship / IDSA-SBI", ...a } as StewardAlert);

  for (const m of abx) {
    const days = daysSince(m.startISO) ?? null;
    const cat = findAntimicrobial(m.name);
    const path = classPathOf(cat?.name ?? m.name);

    // 1. Antibiótico empírico prolongado
    if (days !== null && days >= 3) {
      const hasMicro = cultures.length > 0;
      push({
        code: "EMPIRICO_PROLONGADO",
        title: `Terapia empírica prolongada — ${m.name}`,
        severity: days >= 5 ? "critical" : "attention",
        data: `${m.name} iniciado há ${days} dia(s)${hasMicro ? ` · ${cultures.length} cultura(s) registrada(s)` : " · sem culturas registradas"}.`,
        reason: "Esquema empírico mantido além de 48–72 h, janela em que já costumam existir dados microbiológicos e evolutivos.",
        trend: pcr ? `PCR: ${trendText(pcr.v, pcr.prev, " mg/dL")}` : "Sem PCR seriada disponível.",
        implication: "Manutenção desnecessária de amplo espectro aumenta pressão seletiva, toxicidade e custo.",
        recommendation: "Reavaliar diagnóstico, culturas e necessidade de manutenção/ajuste do esquema (time-out de 72 h).",
        source: "Antimicrobial Stewardship — IDSA/SHEA; ANVISA Diretriz Nacional",
      });
    }

    // 7. Terapia prolongada (duração acima do esperado)
    const expected = cat?.days;
    if (days !== null && expected && days > expected) {
      push({
        code: "TERAPIA_PROLONGADA",
        title: `Duração acima do previsto — ${m.name}`,
        severity: "attention",
        data: `${days} dia(s) de uso · duração de referência ${expected} dia(s)${path ? ` (${path.klass})` : ""}.`,
        reason: "Duração ultrapassa o período habitual para a indicação cadastrada.",
        trend: pcr ? `PCR: ${trendText(pcr.v, pcr.prev, " mg/dL")}` : "Sem marcador inflamatório seriado.",
        implication: "Cursos prolongados associam-se a disbiose, C. difficile e emergência de resistência.",
        recommendation: "Reavaliar critério de suspensão / definir data de término formal.",
        source: "Duração baseada em bulas e diretrizes de sociedade (IDSA/ATS/SCCM)",
      });
    }

    // 8/9. AWaRe
    if (cat?.aware === "Watch" || cat?.aware === "Reserve") {
      const isReserve = cat.aware === "Reserve";
      push({
        code: isReserve ? "AWARE_RESERVE" : "AWARE_WATCH",
        title: `AWaRe ${cat.aware.toUpperCase()} — ${m.name}`,
        severity: isReserve ? "critical" : "info",
        data: `${m.name}${path ? ` · ${path.klass}` : ""} · classificação OMS AWaRe: ${cat.aware}.`,
        reason: isReserve
          ? "Antimicrobiano de último recurso; uso deve ser justificado e registrado para stewardship."
          : "Antimicrobiano com maior potencial de resistência — monitorização recomendada.",
        trend: days !== null ? `Em uso há ${days} dia(s).` : "Início não registrado.",
        implication: isReserve
          ? "Uso indiscriminado compromete opções terapêuticas futuras da unidade."
          : "Aumento de consumo WATCH eleva pressão seletiva na unidade.",
        recommendation: isReserve
          ? "Documentar justificativa, cultura direcionadora e data de reavaliação com a CCIH."
          : "Reavaliar possibilidade de terapia de menor espectro assim que houver dados microbiológicos.",
        source: "OMS — AWaRe Classification of Antibiotics 2023",
      });
    }

    // 6. Alerta renal
    if (creat && creat.v >= 1.5 && (cat?.renal ?? true)) {
      push({
        code: "RENAL",
        title: `Revisão de dose renal — ${m.name}`,
        severity: creat.v >= 3 ? "critical" : "attention",
        data: `Creatinina ${creat.v} mg/dL · ${m.name} ${m.dose || "(dose não registrada)"} ${m.freq || ""}.`,
        reason: "Antimicrobiano com eliminação predominantemente renal em paciente com função renal alterada.",
        trend: `Creatinina: ${trendText(creat.v, creat.prev, " mg/dL")}`,
        implication: "Risco de acúmulo, toxicidade (nefro/neuro/oto) ou, em hiperfiltração, subdose.",
        recommendation: "Recalcular clearance e revisar dose/intervalo; considerar monitorização sérica quando aplicável.",
        source: "Sanford Guide / Micromedex — ajuste renal",
      });
    }
  }

  // 4/5. Culturas positivas e inadequação microbiológica
  for (const c of positives) {
    const abg = c.antibiogram ?? [];
    const resistentes = new Set(
      [...(c.resistances ?? []), ...abg.filter((a) => a.result === "R").map((a) => a.drug)].map(norm),
    );
    const sensiveis = [
      ...(c.sensitivities ?? []),
      ...abg.filter((a) => a.result === "S").map((a) => a.drug),
    ];

    push({
      code: "CULTURA_POSITIVA",
      title: `Cultura positiva — ${c.organism}`,
      severity: "attention",
      data: `${c.source}${c.collectedAt ? ` (${c.collectedAt})` : ""} · ${c.organism}${c.resistanceProfile ? ` · perfil ${c.resistanceProfile}` : ""} · em uso: ${abx.map((m) => m.name).join(", ") || "—"}.`,
      reason: "Correlação automática entre antimicrobiano em uso × microrganismo isolado × antibiograma.",
      trend: sensiveis.length ? `Sensível a: ${sensiveis.join(", ")}.` : "Antibiograma não informado ou pendente.",
      implication: "Terapia direcionada reduz espectro desnecessário e melhora desfecho.",
      recommendation: "Confrontar esquema atual com o antibiograma e definir terapia direcionada.",
      source: "Antibiograma do laboratório de microbiologia · BrCAST/EUCAST",
    });

    for (const m of abx) {
      if (resistentes.has(norm(m.name)) || [...resistentes].some((r) => norm(m.name).includes(r) || r.includes(norm(m.name).split(" ")[0]))) {
        push({
          code: "INADEQUACAO",
          title: `Inadequação microbiológica — ${m.name}`,
          severity: "critical",
          data: `${c.organism} (${c.source}) resistente a ${m.name}, que permanece prescrito.`,
          reason: "Antimicrobiano em uso consta como resistente no antibiograma do isolado.",
          trend: lactato ? `Lactato: ${trendText(lactato.v, lactato.prev, " mmol/L")}` : "Sem lactato seriado.",
          implication: "Terapia inefetiva com risco de falha clínica e progressão da infecção.",
          recommendation: "Revisar imediatamente o esquema conforme antibiograma / discutir com infectologia.",
          source: "Antibiograma · BrCAST/EUCAST",
        });
      }
    }

    // 2. Descalonamento
    if (sensiveis.length > 0 && abx.some((m) => (findAntimicrobial(m.name)?.aware ?? "Watch") !== "Access")) {
      push({
        code: "DESCALONAMENTO",
        title: "Possibilidade de descalonamento",
        severity: "info",
        data: `Isolado ${c.organism} sensível a ${sensiveis.join(", ")} · esquema atual: ${abx.map((m) => m.name).join(", ")}.`,
        reason: "Existe opção de menor espectro sensível no antibiograma.",
        trend: pcr ? `PCR: ${trendText(pcr.v, pcr.prev, " mg/dL")}` : leuco ? `Leucócitos: ${trendText(leuco.v, leuco.prev)}` : "Sem marcadores seriados.",
        implication: "Descalonamento reduz pressão seletiva, toxicidade e custo, mantendo eficácia.",
        recommendation: "Avaliar troca para o agente de menor espectro sensível, se estabilidade clínica.",
        source: "IDSA/SHEA Stewardship Guidelines",
      });
    }
  }

  // 3. Escalonamento — deterioração / falha terapêutica
  const deterioration: string[] = [];
  if (pcr && pcr.prev !== undefined && pcr.v > pcr.prev) deterioration.push(`PCR ${pcr.prev} → ${pcr.v} mg/dL`);
  if (lactato && lactato.v >= 2) deterioration.push(`lactato ${lactato.v} mmol/L`);
  if (leuco && (leuco.v > 20000 || leuco.v < 4000)) deterioration.push(`leucócitos ${leuco.v}/mm³`);
  const anyResistant = positives.some((c) => ["MDR", "XDR", "PDR"].includes(c.resistanceProfile ?? ""));
  if (deterioration.length >= 1 && abx.some((m) => (daysSince(m.startISO) ?? 0) >= 2)) {
    push({
      code: "ESCALONAMENTO",
      title: "Possível falha terapêutica — considerar escalonamento",
      severity: anyResistant ? "critical" : "attention",
      data: `${deterioration.join(" · ")} sob ${abx.map((m) => m.name).join(", ")}${anyResistant ? " · isolado multirresistente" : ""}.`,
      reason: "Marcadores de resposta desfavorável após ≥48 h de terapia.",
      trend: pcr ? `PCR: ${trendText(pcr.v, pcr.prev, " mg/dL")}` : "Tendência inflamatória parcialmente disponível.",
      implication: "Falha por espectro insuficiente, resistência emergente ou foco não controlado.",
      recommendation: "Reavaliar foco (controle cirúrgico/dispositivo), repetir culturas e considerar ampliação de espectro.",
      source: "Surviving Sepsis Campaign 2021",
    });
  }

  // 10. Duplicidade de cobertura
  const withSpec = abx
    .map((m) => ({ m, cat: findAntimicrobial(m.name) }))
    .filter((x) => x.cat?.spectrum?.length);
  for (let i = 0; i < withSpec.length; i++) {
    for (let j = i + 1; j < withSpec.length; j++) {
      const a = withSpec[i], b = withSpec[j];
      const overlap = (a.cat!.spectrum ?? []).filter((s) => (b.cat!.spectrum ?? []).includes(s));
      const ka = classPathOf(a.cat!.name), kb = classPathOf(b.cat!.name);
      const sameClass = ka && kb && ka.klass === kb.klass;
      const redundant = overlap.includes("anaerobio") || overlap.includes("mrsa") || sameClass || overlap.length >= 3;
      if (redundant) {
        push({
          code: "DUPLICIDADE",
          title: `Duplicidade de cobertura — ${a.m.name} + ${b.m.name}`,
          severity: "attention",
          data: `${a.m.name} (${ka?.klass ?? "—"}) + ${b.m.name} (${kb?.klass ?? "—"}) · sobreposição: ${overlap.join(", ") || "mesma classe"}.`,
          reason: sameClass ? "Dois agentes da mesma classe farmacológica em uso simultâneo." : "Espectros sobrepostos sem benefício sinérgico evidente.",
          trend: "Combinação mantida na prescrição ativa.",
          implication: "Aumento de toxicidade, custo e pressão seletiva sem ganho terapêutico.",
          recommendation: "Avaliar suspensão de um dos agentes, salvo indicação de sinergismo documentada.",
          source: "IDSA/SHEA — redundant antimicrobial coverage",
        });
      }
    }
  }

  return out;
}

export function severityMeta(s: StewardSeverity) {
  if (s === "critical") return { icon: "🔴", className: "border-clinical-critical/50 bg-clinical-critical/10 text-clinical-critical" };
  if (s === "attention") return { icon: "🟡", className: "border-clinical-attention/50 bg-clinical-attention/10 text-clinical-attention" };
  return { icon: "🔵", className: "border-primary/40 bg-primary/10 text-primary" };
}

export type { AwareClass };
