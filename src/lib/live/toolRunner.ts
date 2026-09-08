// Execução determinística das ferramentas do NETO Live sobre um paciente.
// Função pura: recebe o paciente e devolve dados + resumo falável + auditoria.

import type { Patient } from "@/data/patients";
import { runClinicalEngine, type EngineIntent, type EngineResult } from "@/lib/clinicalEngine";
import { CONFIRMATION_REQUIRED, type LiveToolName } from "./tools";

export interface LiveToolAudit {
  scope: string;
  scores: { key: string; value: string }[];
  rules: string[];
  guidelines: string[];
  recommendations: string[];
}

export interface LiveToolOutcome {
  /** Texto curto e falável, devolvido ao modelo. */
  summary: string;
  data: unknown;
  requiresConfirmation?: boolean;
  audit?: LiveToolAudit;
}

const NA = "não informado";
const show = (v: unknown, unit = "") =>
  v === null || v === undefined || v === "" ? NA : `${String(v)}${unit}`;

const INTENT_BY_TOOL: Partial<Record<LiveToolName, EngineIntent>> = {
  run_fast_hug_maidens: "fasthug",
  get_applicable_guidelines: "guidelines",
  get_missing_critical_data: "pending",
  review_antimicrobials: "infection",
  analyze_ventilation: "ventilation",
  analyze_hemodynamics: "hemodynamics",
  analyze_renal: "renal",
  analyze_neurocritical: "neuro",
  get_12h_plan: "plan",
  calculate_score: "scores",
};

const VALID_SCOPES: EngineIntent[] = [
  "full",
  "fasthug",
  "scores",
  "guidelines",
  "plan",
  "pending",
  "medications",
  "ventilation",
  "hemodynamics",
  "renal",
  "neuro",
  "infection",
  "devices",
  "timeline",
  "risk",
];

const auditOf = (result: EngineResult): LiveToolAudit => ({
  scope: result.intent,
  scores: result.scores.map((s) => ({ key: s.key, value: String(s.value ?? NA) })),
  rules: result.findings.map((f) => f.code),
  guidelines: result.guidelines.map((g) => `${g.society} ${g.document} ${g.version}`),
  recommendations: result.findings.flatMap((f) => f.recommendations.map((r) => r.text)),
});

const engineNarrative = (result: EngineResult): string => {
  const top = result.findings.slice(0, 4);
  const lines = [
    `Prioridade: ${top[0] ? `${top[0].priority} — ${top[0].title}` : "nenhuma prioridade crítica detectada com os dados disponíveis"}.`,
    `Resumo: ${result.summary}`,
    `Problemas: ${result.problems.join("; ")}`,
    ...top.map(
      (f) =>
        `${f.priority.toUpperCase()} · ${f.title}. POR QUE: ${f.why.join("; ") || NA}. ` +
        f.recommendations
          .map(
            (r) =>
              `APOIO: ${r.text} (monitorizar: ${r.monitoring}${r.evidence ? `; fonte: ${r.evidence.society} ${r.evidence.document} ${r.evidence.year}` : ""})`,
          )
          .join(" | "),
    ),
    `Escores: ${
      result.scores
        .map((s) => (s.available ? `${s.label} ${s.value}` : `${s.label} ${NA}`))
        .join("; ") || NA
    }`,
    `Dados faltantes: ${result.missing.map((m) => m.label).join("; ") || "nenhum crítico"}`,
    result.conflicts.length
      ? `Conflitos entre diretrizes: ${result.conflicts.map((c) => c.topic).join("; ")}`
      : "Sem conflitos entre diretrizes.",
    result.inconclusive.length
      ? `Não é possível concluir: ${result.inconclusive.join("; ")}`
      : "Nada inconclusivo.",
  ];
  return lines.join("\n");
};

export function runNetoLiveTool(
  patient: Patient,
  name: LiveToolName,
  args: Record<string, unknown> = {},
  now: Date = new Date(),
): LiveToolOutcome {
  const label = `${patient.bed} · ${patient.name}`;

  switch (name) {
    case "get_patient_summary": {
      const diagnoses = (patient.diagnoses ?? []).map((d) => d.label).filter(Boolean);
      const data = {
        bed: patient.bed,
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        weight: patient.weight,
        daysICU: patient.daysICU,
        severity: patient.severity,
        diagnoses,
        allergies: patient.allergies ?? [],
      };
      return {
        summary: `${label}, ${show(patient.age)} anos, ${show(patient.sex)}, ${show(patient.daysICU)} dias de UTI, gravidade ${show(patient.severity)}. Diagnósticos: ${diagnoses.join("; ") || NA}. Alergias: ${(patient.allergies ?? []).join("; ") || NA}.`,
        data,
      };
    }

    case "get_current_vitals": {
      const s = patient.state;
      const data = s;
      return {
        summary: [
          `Vitais de ${label}:`,
          `PAM ${show(s?.pam, " mmHg")}`,
          `FC ${show(s?.fcMax, " bpm")}`,
          `FR ${show(s?.fr)}`,
          `SpO2 ${show(s?.spo2, "%")}`,
          `Temp ${show(s?.tempMax ?? s?.temp, " °C")}`,
          `Glasgow ${show(patient.wfns?.gcs ?? s?.glasgow)}`,
          `RASS ${show(s?.rass)}`,
          `Vasopressor ${show(s?.dva)}`,
          `Ventilação ${show(s?.vent)} FiO2 ${show(s?.fio2, "%")}`,
          `Diurese ${show(s?.diurese, " mL")}`,
          `Balanço ${show(s?.balancoHidrico, " mL")}`,
        ].join(", "),
        data,
      };
    }

    case "get_recent_labs": {
      const labs = (patient.exams ?? []).map((e) => ({
        label: e.label,
        value: e.value,
        unit: e.unit ?? null,
        takenAt: e.takenAt ?? null,
        critical: Boolean(e.critical),
      }));
      const critical = labs.filter((l) => l.critical);
      return {
        summary: labs.length
          ? `Exames de ${label}: ${labs
              .slice(0, 18)
              .map((l) => `${l.label} ${l.value}${l.unit ? ` ${l.unit}` : ""}`)
              .join("; ")}.${critical.length ? ` Críticos: ${critical.map((l) => l.label).join("; ")}.` : ""}`
          : `Nenhum exame informado para ${label}.`,
        data: labs,
      };
    }

    case "get_medications": {
      const meds = (patient.medications ?? [])
        .filter((m) => m.active !== false && !m.end)
        .map((m) => ({
          name: m.name,
          dose: m.dose,
          route: m.route,
          freq: m.freq,
          class: m.class ?? null,
          start: m.start,
        }));
      return {
        summary: meds.length
          ? `Medicações ativas de ${label}: ${meds.map((m) => `${m.name} ${m.dose} ${m.route} ${m.freq}`).join("; ")}.`
          : `Nenhuma medicação ativa informada para ${label}.`,
        data: meds,
      };
    }

    case "get_devices": {
      const devices = (patient.devices ?? []).map((d) => {
        const days = d.insertedAt
          ? Math.floor((now.getTime() - new Date(d.insertedAt).getTime()) / 86_400_000)
          : null;
        return {
          typeCode: d.typeCode,
          category: d.category,
          site: d.site ?? null,
          insertedAt: d.insertedAt,
          days,
          indication: d.indication ?? null,
        };
      });
      return {
        summary: devices.length
          ? `Dispositivos de ${label}: ${devices
              .map((d) => `${d.typeCode}${d.site ? ` (${d.site})` : ""} há ${d.days ?? "?"} dias`)
              .join("; ")}.`
          : `Nenhum dispositivo invasivo informado para ${label}.`,
        data: devices,
      };
    }

    case "get_patient_timeline": {
      const events = [...(patient.diagnoses ?? []), ...(patient.procedures ?? [])]
        .filter((e) => e && e.label)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return {
        summary: events.length
          ? `Linha do tempo de ${label}: ${events.map((e) => `${e.date} ${e.label}`).join("; ")}.`
          : `Linha do tempo não informada para ${label}.`,
        data: events,
      };
    }

    case "calculate_score": {
      const wanted = String(args["scoreName"] ?? "").toLowerCase();
      const result = runClinicalEngine(patient, { intent: "scores", now });
      const match =
        result.scores.find((s) => s.key.toLowerCase() === wanted) ??
        result.scores.find(
          (s) => s.label.toLowerCase().includes(wanted) || s.key.toLowerCase().includes(wanted),
        );
      if (!match) {
        return {
          summary: `Escore "${args["scoreName"] ?? ""}" não disponível no motor. Disponíveis: ${result.scores.map((s) => s.label).join("; ")}.`,
          data: { available: result.scores.map((s) => s.label) },
          audit: auditOf(result),
        };
      }
      return {
        summary: match.available
          ? `${match.label}: ${match.value}. ${match.interpretation}. Componentes: ${match.components.map((c) => `${c.label} ${c.value}`).join("; ")}. Fonte do dado: ${match.source}.`
          : `${match.label}: ${NA}. Falta: ${match.missing.join("; ")}.`,
        data: match,
        audit: auditOf(result),
      };
    }

    case "run_clinical_engine": {
      const raw = String(args["scope"] ?? "full") as EngineIntent;
      const intent = VALID_SCOPES.includes(raw) ? raw : "full";
      const result = runClinicalEngine(patient, { intent, now });
      return { summary: engineNarrative(result), data: result, audit: auditOf(result) };
    }

    case "run_fast_hug_maidens": {
      const result = runClinicalEngine(patient, { intent: "fasthug", now });
      return {
        summary: `FASTHUG-MAIDENS de ${label}: ${result.fasthug
          .map((i) => `${i.letter} ${i.title}: ${i.status} — ${i.assessment}`)
          .join(" | ")}`,
        data: result.fasthug,
        audit: auditOf(result),
      };
    }

    case "get_applicable_guidelines": {
      const result = runClinicalEngine(patient, { intent: "guidelines", now });
      return {
        summary: result.guidelines.length
          ? `Diretrizes aplicáveis: ${result.guidelines
              .map((g) => `${g.society} ${g.document} ${g.version} (${g.year}) — ${g.topic}`)
              .join("; ")}.`
          : "Nenhuma diretriz aplicável com os dados disponíveis.",
        data: result.guidelines,
        audit: auditOf(result),
      };
    }

    case "get_12h_plan": {
      const shift = String(args["shift"] ?? "").toLowerCase();
      const result = runClinicalEngine(patient, { intent: "plan", now });
      const wanted = shift.includes("not")
        ? "19:00→07:00"
        : shift.includes("diur") || shift.includes("dia")
          ? "07:00→19:00"
          : (result.plan[0]?.window ?? null);
      const tasks = wanted ? result.plan.filter((t) => t.window === wanted) : result.plan;
      return {
        summary: tasks.length
          ? `Plano ${wanted ?? ""} de ${label}: ${tasks.map((t) => `${t.time} ${t.text}`).join("; ")}.`
          : `Sem tarefas geradas para a janela ${wanted ?? ""}.`,
        data: { window: wanted, tasks },
        audit: auditOf(result),
      };
    }

    case "get_missing_critical_data": {
      const result = runClinicalEngine(patient, { intent: "pending", now });
      return {
        summary: result.missing.length
          ? `Dados não informados em ${label}: ${result.missing.map((m) => `${m.label} (impacto: ${m.impact})`).join("; ")}.`
          : `Nenhum dado crítico faltando em ${label}.`,
        data: result.missing,
        audit: auditOf(result),
      };
    }

    case "review_antimicrobials":
    case "analyze_ventilation":
    case "analyze_hemodynamics":
    case "analyze_renal":
    case "analyze_neurocritical": {
      const intent = INTENT_BY_TOOL[name] ?? "full";
      const result = runClinicalEngine(patient, { intent, now });
      return { summary: engineNarrative(result), data: result, audit: auditOf(result) };
    }

    case "create_reassessment_task": {
      const task = String(args["task"] ?? "").trim();
      const dueAt = String(args["dueAt"] ?? "").trim();
      if (!task) {
        return { summary: "Descreva a reavaliação antes de criar a tarefa.", data: null };
      }
      if (args["confirmed"] !== true) {
        return {
          summary: `Confirmação necessária: criar a reavaliação "${task}"${dueAt ? ` às ${dueAt}` : ""} para ${label}? Peça a confirmação do médico antes de gravar.`,
          data: { task, dueAt, pending: true },
          requiresConfirmation: true,
        };
      }
      return {
        summary: `Reavaliação registrada para ${label}: ${task}${dueAt ? ` às ${dueAt}` : ""}. Apenas monitorização — nenhuma prescrição foi feita.`,
        data: { task, dueAt, confirmed: true },
      };
    }

    default:
      return { summary: `Ferramenta desconhecida: ${String(name)}.`, data: null };
  }
}

export const toolRequiresConfirmation = (name: LiveToolName) =>
  CONFIRMATION_REQUIRED.includes(name);
