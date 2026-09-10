// AXON AI CLINICAL KNOWLEDGE PACK — construção do pacote clínico estruturado
// para leitura por modelos de IA (NETO / ChatGPT).
//
// Funções puras e client-safe. Nenhum dado é inventado: valores ausentes são
// marcados como MISSING e interpretações são marcadas como INFERRED.

import type { Patient, ExamRow, VitalReading } from "@/data/patients";

export const PACK_VERSION = "2.0";
export const CLINICAL_ENGINE_VERSION = "1.4";
export const AXON_PRO_VERSION = "2026.09";

export type PackScope = "complete" | "smart";

export type Confidence =
  | "DOCUMENTED"
  | "CALCULATED"
  | "DERIVED"
  | "INFERRED"
  | "MISSING"
  | "CONFLICTING";

export type TrendDirection =
  | "crescente"
  | "decrescente"
  | "estavel"
  | "oscilante"
  | "alteracao_abrupta"
  | "indeterminado";

export type DeltaStatus = "NOVO" | "PIOROU" | "MELHOROU" | "ESTAVEL" | "RESOLVIDO" | "DESCONHECIDO";

export interface PackOptions {
  scope: PackScope;
  anonymize: boolean;
  hospital?: string;
  unit?: string;
  /** Registro do pacote anterior, para gerar o DELTA PACK e o versionamento. */
  previous?: PreviousPackRecord | null;
}

export interface PreviousPackRecord {
  packetId: string;
  version: string;
  createdAt: string;
  /** Contagens por paciente, usadas para calcular o delta incremental. */
  counts: Record<
    string,
    { labs: number; events: number; meds: number; pending: number; scores: number }
  >;
}

// ───────────────────────────── utilidades ─────────────────────────────

const HOUR = 3600_000;

function iso(d: Date) {
  return d.toISOString();
}

function ts(v?: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").replace(/[^\d.\-+eE]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function examNum(e: ExamRow): number | null {
  return e.valueNum ?? num(e.value);
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function packetId(now: Date) {
  return `AXON-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function nextVersion(prev?: PreviousPackRecord | null) {
  const base = `V${PACK_VERSION}.`;
  const n = prev?.version?.startsWith(base) ? Number(prev.version.slice(base.length)) : 0;
  return `${base}${pad(Number.isFinite(n) ? n + 1 : 1, 3)}`;
}

/** Classifica a tendência de uma série numérica ordenada no tempo. */
export function classifyTrend(values: number[]): TrendDirection {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return "indeterminado";
  const first = v[0];
  const last = v[v.length - 1];
  const span = Math.max(Math.abs(first), 1e-6);
  const rel = (last - first) / span;
  let ups = 0;
  let downs = 0;
  let maxJump = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    if (d > 0) ups++;
    else if (d < 0) downs++;
    const jump = Math.abs(d) / Math.max(Math.abs(v[i - 1]), 1e-6);
    if (jump > maxJump) maxJump = jump;
  }
  if (maxJump >= 0.5) return "alteracao_abrupta";
  if (ups > 0 && downs > 0 && Math.abs(rel) < 0.1) return "oscilante";
  if (rel >= 0.1) return "crescente";
  if (rel <= -0.1) return "decrescente";
  return "estavel";
}

function seriesFromExam(e: ExamRow): { at: string | null; value: number }[] {
  const out: { at: string | null; value: number }[] = [];
  for (const h of e.history ?? []) {
    const n = num(h.value);
    if (n !== null) out.push({ at: h.takenAt ?? null, value: n });
  }
  const current = examNum(e);
  if (current !== null && !(e.history ?? []).some((h) => h.takenAt === e.takenAt)) {
    out.push({ at: e.takenAt ?? null, value: current });
  }
  return out.sort((a, b) => (ts(a.at ?? undefined) ?? 0) - (ts(b.at ?? undefined) ?? 0));
}

function readingSeries(readings?: VitalReading[]) {
  return (readings ?? [])
    .filter((r) => typeof r.value === "number")
    .map((r) => ({ at: r.at ?? null, value: r.value as number, min: r.min ?? null }))
    .sort((a, b) => (ts(a.at ?? undefined) ?? 0) - (ts(b.at ?? undefined) ?? 0));
}

// ───────────────────────────── índice semântico ─────────────────────────────

export const SEMANTIC_INDEX: Record<string, string[]> = {
  RESPIRACAO: [
    "ventilação mecânica",
    "ventilação não invasiva",
    "oxigenoterapia",
    "hipoxemia",
    "PaO2/FiO2",
    "PEEP",
    "FiO2",
    "gasometria",
    "pneumonia",
    "SDRA",
    "extubação",
    "traqueostomia",
  ],
  HEMODINAMICA: [
    "hipotensão",
    "PAM",
    "PAS",
    "PAD",
    "noradrenalina",
    "vasopressina",
    "dobutamina",
    "vasopressor",
    "inotrópico",
    "lactato",
    "choque",
    "balanço hídrico",
  ],
  NEUROLOGICO: [
    "Glasgow",
    "pupilas",
    "NIHSS",
    "sedação",
    "RASS",
    "convulsão",
    "status epiléptico",
    "neuroimagem",
    "HSA",
    "AVC",
    "TCE",
    "PIC",
    "DVE",
    "EEG",
    "Hunt-Hess",
    "WFNS",
    "Fisher",
    "ICH Score",
  ],
  RENAL: [
    "creatinina",
    "ureia",
    "diurese",
    "oligúria",
    "AKI",
    "lesão renal aguda",
    "diálise",
    "terapia renal substitutiva",
    "clearance",
    "depuração de creatinina",
  ],
  INFECCAO: [
    "febre",
    "leucócitos",
    "PCR",
    "procalcitonina",
    "cultura",
    "hemocultura",
    "antimicrobiano",
    "antibiótico",
    "foco infeccioso",
    "sepse",
    "choque séptico",
    "VAP",
    "ITU",
  ],
  HEMATOLOGIA: ["hemoglobina", "hematócrito", "plaquetas", "INR", "transfusão", "sangramento"],
  METABOLICO: ["glicemia", "sódio", "potássio", "magnésio", "cálcio", "pH", "bicarbonato", "BE"],
  NUTRICAO: [
    "dieta",
    "resíduo gástrico",
    "SNE",
    "jejum",
    "nutrição enteral",
    "nutrição parenteral",
  ],
  DISPOSITIVOS: ["CVC", "PAI", "SVD", "TOT", "DVE", "dreno", "cateter", "traqueostomia"],
  ESCORES: ["SOFA", "SAPS 3", "APACHE II", "qSOFA", "NEWS2", "Glasgow", "NIHSS", "VASOGRADE"],
};

const LAB_DOMAIN: Record<string, string> = {
  lactato: "HEMODINAMICA",
  creatinina: "RENAL",
  ureia: "RENAL",
  hemoglobina: "HEMATOLOGIA",
  plaquetas: "HEMATOLOGIA",
  leucocitos: "INFECCAO",
  leucócitos: "INFECCAO",
  pcr: "INFECCAO",
  procalcitonina: "INFECCAO",
  sodio: "METABOLICO",
  sódio: "METABOLICO",
  potassio: "METABOLICO",
  potássio: "METABOLICO",
  glicemia: "METABOLICO",
  ph: "RESPIRACAO",
  pao2: "RESPIRACAO",
  paco2: "RESPIRACAO",
  bilirrubina: "METABOLICO",
};

function labDomain(label: string): string {
  const l = label.toLowerCase();
  for (const key of Object.keys(LAB_DOMAIN)) if (l.includes(key)) return LAB_DOMAIN[key];
  return "GERAL";
}

/** Variáveis em que o aumento representa piora clínica. */
const WORSE_WHEN_UP = [
  "lactato",
  "creatinina",
  "ureia",
  "pcr",
  "procalcitonina",
  "bilirrubina",
  "potassio",
  "leucocit",
  "inr",
];
const WORSE_WHEN_DOWN = ["hemoglobina", "plaquetas", "pao2", "diurese", "pao2/fio2"];

function deltaStatusFor(label: string, from: number, to: number): DeltaStatus {
  if (from === to) return "ESTAVEL";
  const l = label.toLowerCase();
  const up = to > from;
  if (WORSE_WHEN_UP.some((k) => l.includes(k))) return up ? "PIOROU" : "MELHOROU";
  if (WORSE_WHEN_DOWN.some((k) => l.includes(k))) return up ? "MELHOROU" : "PIOROU";
  return "DESCONHECIDO";
}

// ───────────────────────────── suportes ─────────────────────────────

const VASO_NAMES = [
  "noradrenalina",
  "norepinefrina",
  "adrenalina",
  "epinefrina",
  "vasopressina",
  "dopamina",
  "terlipressina",
];
const INOTROPE_NAMES = ["dobutamina", "milrinona", "levosimendana"];

function ventilationMode(p: Patient): { mode: string; confidence: Confidence } {
  const v = (p.state?.vent ?? "").toLowerCase();
  if (!v.trim()) return { mode: "não informado", confidence: "MISSING" };
  if (/vmi|vm invasiva|pcv|vcv|psv|tot|traqueo/.test(v))
    return { mode: "ventilação mecânica invasiva", confidence: "DERIVED" };
  if (/vni|bipap|cpap/.test(v)) return { mode: "ventilação não invasiva", confidence: "DERIVED" };
  if (/cateter|máscara|mascara|o2|venturi|cnaf/.test(v))
    return { mode: "oxigenoterapia", confidence: "DERIVED" };
  if (/espontân|espontan|ar ambiente/.test(v))
    return { mode: "respiração espontânea", confidence: "DERIVED" };
  return { mode: v, confidence: "DOCUMENTED" };
}

// ───────────────────────────── construção ─────────────────────────────

interface SourceEntry {
  SOURCE_ID: string;
  PATIENT_ID: string;
  RECORD_TYPE: string;
  DATE_TIME: string | null;
  ORIGINAL_SECTION: string;
}

export function buildKnowledgePack(patients: Patient[], options: PackOptions) {
  const now = new Date();
  const nowMs = now.getTime();
  const scope = options.scope;
  const anonymize = options.anonymize;

  const active = patients.filter((p) => !p.archived);
  const alias = new Map<string, string>();
  active.forEach((p, i) => alias.set(p.id, `A${pad(i + 1)}`));
  const pid = (p: Patient) => (anonymize ? (alias.get(p.id) ?? `A${pad(1)}`) : p.id);

  const sourceMap: SourceEntry[] = [];
  let sourceSeq = 0;
  const src = (p: Patient, type: string, at: string | null | undefined, section: string) => {
    sourceSeq += 1;
    const id = `SRC-${pad(sourceSeq, 5)}`;
    sourceMap.push({
      SOURCE_ID: id,
      PATIENT_ID: pid(p),
      RECORD_TYPE: type,
      DATE_TIME: at ?? null,
      ORIGINAL_SECTION: section,
    });
    return id;
  };

  const patientsOut: unknown[] = [];
  const events: unknown[] = [];
  const labs: unknown[] = [];
  const imaging: unknown[] = [];
  const microbiology: unknown[] = [];
  const infectionFoci: unknown[] = [];
  const medications: unknown[] = [];
  const devices: unknown[] = [];
  const scores: unknown[] = [];
  const vitals: unknown[] = [];
  const fluidBalance: unknown[] = [];
  const problems: unknown[] = [];
  const pendingTasks: unknown[] = [];
  const clinicalTrends: unknown[] = [];
  const criticalChanges: unknown[] = [];
  const clinicalIndex: unknown[] = [];
  const temporalIndex: Record<string, unknown> = {};
  const relationMatrix: unknown[] = [];
  const supportIndex = {
    VENTILACAO: {
      invasiva: [] as string[],
      nao_invasiva: [] as string[],
      oxigenoterapia: [] as string[],
      espontanea: [] as string[],
      nao_informado: [] as string[],
    },
    HEMODINAMICA: {
      vasopressor: [] as unknown[],
      inotropico: [] as unknown[],
      sem_suporte: [] as string[],
    },
    RENAL: {
      dialise: [] as string[],
      oliguria: [] as string[],
      funcao_em_piora: [] as string[],
      sem_alteracao_registrada: [] as string[],
    },
  };
  const quality = {
    pacientes_analisados: active.length,
    registros_analisados: 0,
    conflitos: [] as string[],
    dados_incompletos: [] as string[],
    duplicidades: [] as string[],
    validacoes: [] as string[],
  };
  const deltaCounts: PreviousPackRecord["counts"] = {};

  let dataStart: number | null = null;
  let dataEnd: number | null = null;
  const touch = (at?: string | null) => {
    const t = ts(at ?? undefined);
    if (t === null) return;
    if (dataStart === null || t < dataStart) dataStart = t;
    if (dataEnd === null || t > dataEnd) dataEnd = t;
  };

  const windows = { LAST_6H: 6, LAST_12H: 12, LAST_24H: 24, LAST_48H: 48, LAST_7D: 168 };
  const keepInSmart = (at?: string | null) => {
    if (scope === "complete") return true;
    const t = ts(at ?? undefined);
    if (t === null) return true; // sem data: preserva (nunca inventar)
    return nowMs - t <= 48 * HOUR;
  };

  for (const p of active) {
    const P = pid(p);
    const st = p.state ?? ({} as Patient["state"]);
    const bedId = p.bed ?? "não informado";
    const patientEventIds: string[] = [];
    const patientProblemIds: string[] = [];
    const patientPendingIds: string[] = [];
    const patientLabIds: string[] = [];
    const patientScoreIds: string[] = [];
    const activeProblems: string[] = [];

    touch(p.admissionICU);
    touch(p.admissionHosp);

    // ── perfil
    const primary =
      (p.diagnoses ?? []).find((d) => d.category === "current")?.label ??
      (p.diagnoses ?? [])[0]?.label ??
      null;
    const secondary = (p.diagnoses ?? [])
      .filter((d) => d.label !== primary)
      .map((d) => ({
        label: d.label,
        category: d.category ?? "não classificado",
        date: d.date ?? null,
      }));

    // ── eventos
    const pushEvent = (
      at: string | undefined,
      type: string,
      description: string,
      importance: "alta" | "media" | "baixa",
      section: string,
    ) => {
      if (!keepInSmart(at)) return;
      touch(at);
      const id = `EV-${P}-${pad(patientEventIds.length + 1, 4)}`;
      patientEventIds.push(id);
      events.push({
        EVENT_ID: id,
        PATIENT_ID: P,
        DATE_TIME: at ?? null,
        EVENT_TYPE: type,
        DESCRIPTION: description,
        CLINICAL_IMPORTANCE: importance,
        SOURCE: src(p, "event", at, section),
        CONFIDENCE: at ? "DOCUMENTED" : "MISSING",
      });
    };

    pushEvent(
      p.admissionICU,
      "admissao",
      `Admissão na UTI — leito ${bedId}`,
      "alta",
      "identificação",
    );
    for (const e of p.procedures ?? []) {
      const l = (e.label ?? "").toLowerCase();
      const type = /intuba/.test(l)
        ? "intubacao"
        : /extuba/.test(l)
          ? "extubacao"
          : /cirurg/.test(l)
            ? "cirurgia"
            : /parada|rcp/.test(l)
              ? "parada_cardiorrespiratoria"
              : /transfus/.test(l)
                ? "transfusao"
                : /dialis|hemodiálise|hemodialise/.test(l)
                  ? "terapia_renal"
                  : "procedimento";
      pushEvent(
        e.date,
        type,
        [e.label, e.detail].filter(Boolean).join(" — "),
        "alta",
        "procedimentos",
      );
    }
    for (const i of p.intubations ?? [])
      pushEvent(i.createdAt, "intubacao", `IOT modo ${i.mode} — ${i.status}`, "alta", "intubação");
    for (const h of p.hemotransfusions ?? [])
      pushEvent(
        h.date,
        "transfusao",
        `${h.component}${h.volume ? ` · ${h.volume}` : ""}`,
        "media",
        "hemotransfusões",
      );
    for (const ev of p.infectionTimeline ?? [])
      pushEvent(ev.at, "infeccao", `[${ev.kind}] ${ev.label}`, "alta", "linha do tempo infecciosa");
    for (const d of p.devices ?? []) {
      pushEvent(
        d.insertedAt,
        "procedimento",
        `Inserção de ${d.typeCode}${d.site ? ` (${d.site})` : ""}`,
        "media",
        "dispositivos",
      );
      if (d.removedAt)
        pushEvent(
          d.removedAt,
          "procedimento",
          `Retirada de ${d.typeCode}`,
          "baixa",
          "dispositivos",
        );
    }
    for (const m of p.medications ?? []) {
      const isVaso = VASO_NAMES.some((v) => (m.name ?? "").toLowerCase().includes(v));
      if (m.start)
        pushEvent(
          m.start,
          isVaso ? "inicio_vasopressor" : "mudanca_terapeutica",
          `Início de ${m.name}${m.dose ? ` ${m.dose}` : ""}`,
          isVaso ? "alta" : "media",
          "medicações",
        );
      if (m.end)
        pushEvent(m.end, "mudanca_terapeutica", `Suspensão de ${m.name}`, "media", "medicações");
      for (const c of m.changes ?? [])
        pushEvent(
          c.date,
          "mudanca_terapeutica",
          `${m.name}: ${c.kind} — ${c.note}`,
          "media",
          "medicações",
        );
    }
    for (const img of p.imaging ?? [])
      pushEvent(
        img.performedAt,
        "exame_imagem",
        `${img.modality} de ${img.region}${img.conclusion ? ` — ${img.conclusion}` : ""}`,
        img.conclusion === "critico" ? "alta" : "media",
        "imagem",
      );

    // ── laboratório + tendências
    for (const e of p.exams ?? []) {
      const serie = seriesFromExam(e);
      serie.forEach((s) => touch(s.at));
      const visible =
        scope === "complete" ? serie : serie.filter((s) => keepInSmart(s.at)).slice(-6);
      const labId = `LAB-${P}-${pad(patientLabIds.length + 1, 4)}`;
      patientLabIds.push(labId);
      const domain = labDomain(e.label);
      labs.push({
        LAB_ID: labId,
        PATIENT_ID: P,
        LABEL: e.label,
        CODE: e.code ?? null,
        DOMAIN: domain,
        UNIT: e.unit ?? null,
        CURRENT_VALUE: e.value ?? null,
        CURRENT_VALUE_NUM: examNum(e),
        TAKEN_AT: e.takenAt ?? null,
        CRITICAL_FLAG: !!e.critical,
        SERIES: visible.length ? visible : "MISSING",
        SOURCE: src(p, "lab", e.takenAt, "exames laboratoriais"),
        CONFIDENCE: examNum(e) === null ? "MISSING" : "DOCUMENTED",
      });
      quality.registros_analisados += Math.max(1, serie.length);
      if (examNum(e) === null)
        quality.dados_incompletos.push(`${P} · ${e.label} sem valor numérico`);
      if (serie.length >= 2) {
        const values = serie.map((s) => s.value);
        clinicalTrends.push({
          PATIENT_ID: P,
          VARIABLE: e.label,
          DOMAIN: domain,
          UNIT: e.unit ?? null,
          VALUES: serie,
          TREND: classifyTrend(values),
          CONFIDENCE: "CALCULATED",
          SOURCE: `LAB:${labId}`,
        });
      }
    }

    // ── imagem
    for (const img of p.imaging ?? []) {
      if (!keepInSmart(img.performedAt)) continue;
      imaging.push({
        IMAGING_ID: img.id,
        PATIENT_ID: P,
        MODALITY: img.modality,
        REGION: img.region,
        PERFORMED_AT: img.performedAt ?? null,
        STATUS: img.status ?? "não informado",
        CONCLUSION: img.conclusion ?? "não informado",
        EXPECTED_OUTCOME: img.outcome ?? "não informado",
        SUMMARY: img.summary ?? "MISSING",
        REPORTED_BY: anonymize ? null : (img.reportedBy ?? null),
        IMAGES_COUNT: (img.images ?? []).length,
        IMAGES: (img.images ?? []).map((f) => ({
          IMAGE_ID: f.id,
          CAPTION: f.caption ?? "não informado",
          CAPTURED_AT: img.performedAt ?? null,
        })),
        SOURCE: src(p, "imaging", img.performedAt, "exames de imagem"),
        CONFIDENCE: img.summary ? "DOCUMENTED" : "MISSING",
      });
      quality.registros_analisados += 1;
      if (img.status === "solicitado") {
        const id = `PEND-${P}-${pad(patientPendingIds.length + 1, 3)}`;
        patientPendingIds.push(id);
        pendingTasks.push({
          PENDING_ID: id,
          PATIENT_ID: P,
          CATEGORY: "imagem",
          DESCRIPTION: `${img.modality} de ${img.region} solicitado e ainda sem laudo`,
          CREATED_AT: img.performedAt ?? null,
          DUE_TIME: "não informado",
          STATUS: "aberta",
          SOURCE: `IMAGING:${img.id}`,
        });
      }
    }

    // ── microbiologia (culturas + antibiograma)
    for (const c of p.cultures ?? []) {
      if (!keepInSmart(c.collectedAt)) continue;
      const positive = c.result === "positiva" || !!c.organism;
      microbiology.push({
        CULTURE_ID: c.id,
        PATIENT_ID: P,
        SAMPLE: c.source,
        SAMPLE_CODE: c.sourceCode ?? "não informado",
        COLLECTION_SITE: c.collectionSite ?? "não informado",
        METHOD: c.method ?? "não informado",
        SAMPLE_COUNT: c.sampleCount ?? "não informado",
        COLLECTED_AT: c.collectedAt ?? null,
        RESULT: c.result ?? "não informado",
        ORGANISM: c.organism ?? (c.result === "negativa" ? "sem crescimento" : "não informado"),
        BACTERIAL_COUNT: c.bacterialCount ?? "não informado",
        ASPECT: c.aspect ?? "não informado",
        RESISTANCE_PROFILE: c.resistanceProfile ?? "não informado",
        SENSITIVITIES: c.sensitivities ?? [],
        RESISTANCES: c.resistances ?? [],
        ANTIBIOGRAM: (c.antibiogram ?? []).map((a) => ({
          DRUG: a.drug,
          RESULT: a.result,
          MIC: a.mic ?? "não informado",
        })),
        NOTES: c.notes ?? "não informado",
        LINKED_FOCUS_ID: c.linkedFocusId ?? null,
        LINKED_DEVICE_ID: c.linkedDeviceId ?? null,
        SOURCE: src(p, "microbiologia", c.collectedAt, "culturas / microbiologia"),
        CONFIDENCE: c.result ? "DOCUMENTED" : "MISSING",
      });
      quality.registros_analisados += 1;
      if (!c.result) quality.dados_incompletos.push(`${P} · cultura de ${c.source} sem resultado`);
      pushEvent(
        c.collectedAt,
        "cultura_coletada",
        `Coleta de cultura — ${c.source}`,
        "media",
        "microbiologia",
      );
      if (positive)
        pushEvent(
          c.collectedAt,
          "cultura_positiva",
          `Cultura positiva (${c.source})${c.organism ? ` — ${c.organism}` : ""}${
            c.resistanceProfile && c.resistanceProfile !== "sensivel"
              ? ` · perfil ${c.resistanceProfile}`
              : ""
          }`,
          "alta",
          "microbiologia",
        );
    }

    // ── focos infecciosos vinculados à microbiologia
    for (const f of p.infections ?? []) {
      infectionFoci.push({
        FOCUS_ID: f.id,
        PATIENT_ID: P,
        SITE: f.site ?? "não informado",
        STATUS: f.status ?? "não informado",
        UNSTABLE: !!f.unstable,
        STARTED_AT: f.startedAt ?? null,
        RESOLVED_AT: f.resolvedAt ?? null,
        RELATED_DEVICE_IDS: f.relatedDeviceIds ?? [],
        CULTURE_IDS: f.cultureIds ?? [],
        ANTIMICROBIALS: f.antimicrobials ?? [],
        NOTES: f.notes ?? "não informado",
        SOURCE: src(p, "foco_infeccioso", f.startedAt, "focos infecciosos"),
        CONFIDENCE: f.site ? "DOCUMENTED" : "MISSING",
      });
      quality.registros_analisados += 1;
    }

    // ── medicações
    const activeMeds = (p.medications ?? []).filter((m) => m.active !== false);
    for (const m of p.medications ?? []) {
      if (scope === "smart" && m.active === false) continue;
      medications.push({
        PATIENT_ID: P,
        NAME: m.name,
        STATUS: m.active === false ? "suspensa" : "ativa",
        DOSE: m.dose ?? "MISSING",
        ROUTE: m.route ?? "MISSING",
        FREQUENCY: m.freq ?? "MISSING",
        START: m.start ?? null,
        END: m.end ?? null,
        CLASS: m.class ?? m.category ?? "não classificada",
        IS_ANTIMICROBIAL: !!m.isAntibiotic,
        PUMP: m.pump
          ? {
              MODE: m.pump.mode,
              SOLVENT: m.pump.solvent,
              RATE_ML_H: m.pump.rateMlPerHour ?? m.mlPerHour ?? null,
              TARGET_DOSE: m.pump.targetDoseValue ?? null,
              TARGET_UNIT: m.pump.targetDoseUnit ?? null,
            }
          : null,
        CHANGES: (m.changes ?? []).map((c) => ({ KIND: c.kind, NOTE: c.note, AT: c.date })),
        SOURCE: src(p, "medication", m.start, "medicações"),
        CONFIDENCE: "DOCUMENTED",
      });
      quality.registros_analisados += 1;
    }
    const dupMeds = new Map<string, number>();
    for (const m of activeMeds) {
      const k = (m.name ?? "").trim().toLowerCase();
      dupMeds.set(k, (dupMeds.get(k) ?? 0) + 1);
    }
    for (const [k, n] of dupMeds)
      if (n > 1) quality.duplicidades.push(`${P} · ${k} aparece ${n}× como ativa`);

    // ── dispositivos
    for (const d of p.devices ?? []) {
      devices.push({
        DEVICE_ID: d.id,
        PATIENT_ID: P,
        CATEGORY: d.category,
        TYPE: d.typeCode,
        SITE: d.site ?? "MISSING",
        SIZE: d.size ?? "MISSING",
        INSERTED_AT: d.insertedAt ?? null,
        REMOVED_AT: d.removedAt ?? null,
        IN_USE: !d.removedAt,
        DAYS_IN_USE:
          d.insertedAt && !d.removedAt
            ? Math.floor((nowMs - (ts(d.insertedAt) ?? nowMs)) / (24 * HOUR))
            : null,
        INDICATION: d.indication ?? "MISSING",
        LAST_REVIEWED_AT: d.lastReviewedAt ?? null,
        NEXT_CHANGE_AT: d.nextChangeAt ?? null,
        SOURCE: src(p, "device", d.insertedAt, "dispositivos invasivos"),
        CONFIDENCE: "DOCUMENTED",
      });
      quality.registros_analisados += 1;
      if (!d.removedAt && !d.indication) {
        const id = `PEND-${P}-${pad(patientPendingIds.length + 1, 3)}`;
        patientPendingIds.push(id);
        pendingTasks.push({
          PENDING_ID: id,
          PATIENT_ID: P,
          CATEGORY: "documentacao",
          DESCRIPTION: `Indicação do dispositivo ${d.typeCode} não registrada`,
          CREATED_AT: d.insertedAt ?? null,
          DUE_TIME: "não informado",
          STATUS: "aberta",
          SOURCE: `DEVICE:${d.id}`,
        });
      }
    }

    // ── escores
    const pushScore = (
      name: string,
      value: number | string | null,
      at: string | null | undefined,
      detail: unknown,
      confidence: Confidence,
    ) => {
      if (value === null || value === undefined) return;
      const id = `SCORE-${P}-${pad(patientScoreIds.length + 1, 3)}`;
      patientScoreIds.push(id);
      touch(at ?? undefined);
      scores.push({
        SCORE_ID: id,
        PATIENT_ID: P,
        SCORE: name,
        VALUE: value,
        MEASURED_AT: at ?? null,
        COMPONENTS: detail ?? null,
        SOURCE: src(p, "score", at ?? undefined, "escores"),
        CONFIDENCE: confidence,
      });
      quality.registros_analisados += 1;
    };

    const sofaSorted = (p.sofaAssessments ?? [])
      .slice()
      .sort((a, b) => (ts(b.at) ?? 0) - (ts(a.at) ?? 0));
    for (const a of scope === "complete" ? sofaSorted : sofaSorted.slice(0, 4))
      pushScore(
        "SOFA",
        a.total,
        a.at,
        { round: a.round, components: a.scores, partial: a.partial },
        a.partial ? "DERIVED" : "CALCULATED",
      );
    if (sofaSorted.length >= 2) {
      const latest = sofaSorted[0];
      const prev = sofaSorted[1];
      if (latest.total !== null && prev.total !== null) {
        clinicalTrends.push({
          PATIENT_ID: P,
          VARIABLE: "SOFA",
          DOMAIN: "ESCORES",
          VALUES: sofaSorted
            .slice()
            .reverse()
            .map((a) => ({ at: a.at, value: a.total })),
          TREND: classifyTrend(
            sofaSorted
              .slice()
              .reverse()
              .map((a) => a.total ?? NaN),
          ),
          DELTA: latest.total - prev.total,
          CONFIDENCE: "CALCULATED",
        });
      }
    }

    const wfns = p.wfns as { grade?: number; gcs?: number; at?: string } | undefined;
    const nihss = p.nihss as { total?: number; at?: string } | undefined;
    const hh = p.huntHess as { grade?: number; at?: string } | undefined;
    const fisher = p.fisher as { grade?: number; at?: string } | undefined;
    const ich = p.ichScore as { score?: number; at?: string } | undefined;
    const vasograde = p.vasograde as { color?: string; at?: string } | undefined;
    const saps3 = p.saps3 as { history?: { total?: number; at?: string }[] } | undefined;
    pushScore(
      "Glasgow",
      wfns?.gcs ?? st.glasgow ?? null,
      wfns?.at,
      { origem: wfns?.gcs != null ? "WFNS" : "estado atual" },
      "DOCUMENTED",
    );
    pushScore("WFNS", wfns?.grade ?? null, wfns?.at, null, "CALCULATED");
    pushScore("NIHSS", nihss?.total ?? null, nihss?.at, null, "CALCULATED");
    pushScore("Hunt-Hess", hh?.grade ?? null, hh?.at, null, "CALCULATED");
    pushScore("Fisher modificada", fisher?.grade ?? null, fisher?.at, null, "CALCULATED");
    pushScore("ICH Score", ich?.score ?? null, ich?.at, null, "CALCULATED");
    pushScore("VASOGRADE", vasograde?.color ?? null, vasograde?.at, null, "CALCULATED");
    const saps3Last = (saps3?.history ?? [])[0];
    pushScore("SAPS 3", saps3Last?.total ?? null, saps3Last?.at, null, "CALCULATED");
    pushScore("RASS", typeof st.rass === "number" ? st.rass : null, null, null, "DOCUMENTED");

    // ── sinais vitais
    const vs = st.vitalSeries ?? {};
    const vitalDefs: { key: string; label: string; unit: string; readings?: VitalReading[] }[] = [
      { key: "temp", label: "Temperatura", unit: "°C", readings: vs.temp },
      { key: "spo2", label: "SpO2", unit: "%", readings: vs.spo2 },
      { key: "fc", label: "Frequência cardíaca", unit: "bpm", readings: vs.fc },
      { key: "pam", label: "PAM", unit: "mmHg", readings: vs.pam },
      { key: "pas", label: "PAS", unit: "mmHg", readings: vs.pas },
      { key: "pad", label: "PAD", unit: "mmHg", readings: vs.pad },
      { key: "fr", label: "Frequência respiratória", unit: "ipm", readings: vs.fr },
      { key: "glicemia", label: "Glicemia", unit: "mg/dL", readings: vs.glicemia },
      { key: "bh", label: "Balanço hídrico", unit: "mL", readings: vs.bh },
    ];
    for (const c of st.customSeries ?? [])
      vitalDefs.push({ key: c.id, label: c.label, unit: c.unit ?? "", readings: c.readings });
    for (const def of vitalDefs) {
      const serie = readingSeries(def.readings);
      if (!serie.length) continue;
      serie.forEach((s) => touch(s.at));
      const visible =
        scope === "complete" ? serie : serie.filter((s) => keepInSmart(s.at)).slice(-8);
      vitals.push({
        PATIENT_ID: P,
        VARIABLE: def.label,
        UNIT: def.unit || null,
        SERIES: visible,
        LAST: serie[serie.length - 1],
        SOURCE: src(p, "vital", serie[serie.length - 1].at, "sinais vitais seriados"),
        CONFIDENCE: "DOCUMENTED",
      });
      quality.registros_analisados += serie.length;
      if (serie.length >= 2)
        clinicalTrends.push({
          PATIENT_ID: P,
          VARIABLE: def.label,
          DOMAIN: def.key === "pam" || def.key === "pas" ? "HEMODINAMICA" : "GERAL",
          UNIT: def.unit || null,
          VALUES: serie,
          TREND: classifyTrend(serie.map((s) => s.value)),
          CONFIDENCE: "CALCULATED",
        });
    }

    // ── balanço
    const intake = (st.fluidBalance?.intake ?? []).reduce((a, x) => a + (x.volumeMl ?? 0), 0);
    const output = (st.fluidBalance?.output ?? []).reduce((a, x) => a + (x.volumeMl ?? 0), 0);
    const drains = (st.fluidBalance?.drains ?? []).reduce((a, x) => a + (x.volumeMl ?? 0), 0);
    const bhSeries = readingSeries(vs.bh);
    fluidBalance.push({
      PATIENT_ID: P,
      INTAKE_ML: intake || (st.fluidBalance?.intake ? 0 : "MISSING"),
      OUTPUT_ML: output || (st.fluidBalance?.output ? 0 : "MISSING"),
      DRAINS_ML: drains,
      BALANCE_ML: st.fluidBalance ? intake - output : "MISSING",
      BALANCE_REGISTERED_ML: st.balancoHidrico ?? "MISSING",
      DIURESIS_24H_ML: st.diurese24 ?? st.diurese ?? "MISSING",
      DIURESIS_HOURLY_ML: st.diureseHoraria ?? "MISSING",
      WEIGHT_KG: p.weight ?? "MISSING",
      SERIES: bhSeries.length ? bhSeries : "MISSING",
      TREND: bhSeries.length >= 2 ? classifyTrend(bhSeries.map((s) => s.value)) : "indeterminado",
      CONFIDENCE: st.fluidBalance ? "CALCULATED" : "MISSING",
      SOURCE: src(p, "fluid_balance", null, "balanço hídrico"),
    });

    // ── problemas ativos
    const pushProblem = (
      label: string,
      firstDetected: string | null,
      lastUpdated: string | null,
      evidence: string[],
      status: string,
      therapy: string[],
      pending: string[],
    ) => {
      const id = `PROB-${P}-${pad(patientProblemIds.length + 1, 3)}`;
      patientProblemIds.push(id);
      if (status === "ativo" || status === "em melhora") activeProblems.push(label);
      problems.push({
        PROBLEM_ID: id,
        PATIENT_ID: P,
        PROBLEM: label,
        FIRST_DETECTED: firstDetected,
        LAST_UPDATED: lastUpdated,
        EVIDENCE: evidence.length ? evidence : ["MISSING"],
        CURRENT_STATUS: status,
        ASSOCIATED_THERAPY: therapy.length ? therapy : ["MISSING"],
        PENDING_ACTIONS: pending.length ? pending : [],
        CONFIDENCE: evidence.length ? "DERIVED" : "MISSING",
      });
    };

    for (const d of p.diagnoses ?? []) {
      if (d.category === "previous" || d.category === "inactive") continue;
      pushProblem(
        d.label,
        d.date ?? null,
        d.date ?? null,
        [d.detail ?? `Diagnóstico registrado no passômetro (${d.category ?? "atual"})`],
        d.category === "complication" ? "ativo" : "ativo",
        [],
        [],
      );
    }
    for (const f of p.infections ?? []) {
      pushProblem(
        `Foco infeccioso: ${f.site}`,
        f.startedAt ?? null,
        f.resolvedAt ?? f.startedAt ?? null,
        [`Status registrado: ${f.status}${f.unstable ? " · instável" : ""}`],
        f.resolvedAt ? "resolvido" : "ativo",
        f.antimicrobials ?? [],
        [],
      );
    }
    const vasoActive = activeMeds.filter((m) =>
      VASO_NAMES.some((v) => (m.name ?? "").toLowerCase().includes(v)),
    );
    const inoActive = activeMeds.filter((m) =>
      INOTROPE_NAMES.some((v) => (m.name ?? "").toLowerCase().includes(v)),
    );
    if (vasoActive.length || (st.dva && st.dva !== "não"))
      pushProblem(
        "Instabilidade hemodinâmica com necessidade de vasopressor",
        vasoActive[0]?.start ?? null,
        null,
        [
          vasoActive.length
            ? `Vasopressores ativos: ${vasoActive.map((m) => m.name).join(", ")}`
            : `DVA registrada: ${st.dva}`,
          st.pam != null ? `PAM ${st.pam} mmHg` : "PAM não informada",
        ],
        "ativo",
        vasoActive.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}`),
        ["Reavaliar necessidade de vasopressor e alvo de PAM"],
      );

    const creat = (p.exams ?? []).find((e) => /creatinina/i.test(e.label));
    const creatSeries = creat ? seriesFromExam(creat) : [];
    const creatTrend =
      creatSeries.length >= 2 ? classifyTrend(creatSeries.map((s) => s.value)) : "indeterminado";
    const oliguria =
      typeof st.diureseHoraria === "number" && p.weight
        ? st.diureseHoraria / p.weight < 0.5
        : typeof st.diurese24 === "number" && p.weight
          ? st.diurese24 / p.weight / 24 < 0.5
          : null;
    if (creatTrend === "crescente" || oliguria === true)
      pushProblem(
        "Alteração de função renal",
        creatSeries[0]?.at ?? null,
        creatSeries[creatSeries.length - 1]?.at ?? null,
        [
          creat
            ? `Creatinina: ${creatSeries.map((s) => s.value).join(" → ")} (${creatTrend})`
            : "Creatinina não registrada",
          oliguria === true
            ? "Diurese abaixo de 0,5 mL/kg/h pelos registros disponíveis"
            : "Diurese sem critério de oligúria registrado",
        ],
        "ativo",
        [],
        ["Reavaliar função renal e balanço hídrico"],
      );

    const vent = ventilationMode(p);
    if (vent.mode === "ventilação mecânica invasiva")
      pushProblem(
        "Insuficiência respiratória em ventilação mecânica invasiva",
        null,
        null,
        [
          `Modo ventilatório registrado: ${st.vent}`,
          st.fio2 != null ? `FiO2 ${st.fio2}` : "FiO2 não informada",
        ],
        "ativo",
        [st.vent ?? "MISSING"],
        ["Avaliar critérios de desmame quando aplicável"],
      );

    // ── pendências adicionais
    for (const g of p.goals ?? [])
      if (!g.met) {
        const id = `PEND-${P}-${pad(patientPendingIds.length + 1, 3)}`;
        patientPendingIds.push(id);
        pendingTasks.push({
          PENDING_ID: id,
          PATIENT_ID: P,
          CATEGORY: "reavaliacao",
          DESCRIPTION: g.text,
          CREATED_AT: null,
          DUE_TIME: "não informado",
          STATUS: "aberta",
          SOURCE: "metas clínicas",
        });
      }
    for (const c of p.conducts ?? [])
      for (const sub of c.subItems ?? [])
        if (/pendente|aguard|solicitar|avaliar|reavaliar|programar/i.test(sub.text ?? "")) {
          const id = `PEND-${P}-${pad(patientPendingIds.length + 1, 3)}`;
          patientPendingIds.push(id);
          pendingTasks.push({
            PENDING_ID: id,
            PATIENT_ID: P,
            CATEGORY: "ajuste_terapeutico",
            DESCRIPTION: sub.text,
            CREATED_AT: sub.date ?? null,
            DUE_TIME: "não informado",
            STATUS: "aberta",
            SOURCE: `condutas · ${c.system ?? "geral"}`,
          });
        }
    for (const c of p.cultures ?? [])
      if (c.result === "andamento") {
        const id = `PEND-${P}-${pad(patientPendingIds.length + 1, 3)}`;
        patientPendingIds.push(id);
        pendingTasks.push({
          PENDING_ID: id,
          PATIENT_ID: P,
          CATEGORY: "laboratorio",
          DESCRIPTION: `Cultura de ${c.source} em andamento`,
          CREATED_AT: c.collectedAt ?? null,
          DUE_TIME: "não informado",
          STATUS: "aberta",
          SOURCE: "culturas",
        });
      }

    // ── delta clínico (últimas 12h e 24h)
    const deltaFor = (hours: number) => {
      const cutoff = nowMs - hours * HOUR;
      const items: unknown[] = [];
      const consider = (
        label: string,
        serie: { at: string | null; value: number }[],
        unit?: string | null,
      ) => {
        const dated = serie.filter((s) => ts(s.at ?? undefined) !== null);
        if (dated.length < 2) return;
        const before = dated.filter((s) => (ts(s.at!) ?? 0) <= cutoff);
        const after = dated.filter((s) => (ts(s.at!) ?? 0) > cutoff);
        if (!after.length) return;
        const from = (before[before.length - 1] ?? dated[0]).value;
        const to = after[after.length - 1].value;
        items.push({
          VARIABLE: label,
          UNIT: unit ?? null,
          FROM: from,
          TO: to,
          DIRECTION: to > from ? "↑" : to < from ? "↓" : "=",
          STATUS: deltaStatusFor(label, from, to),
          CONFIDENCE: "CALCULATED",
        });
      };
      for (const e of p.exams ?? []) consider(e.label, seriesFromExam(e), e.unit);
      for (const def of vitalDefs) {
        const s = readingSeries(def.readings);
        consider(
          def.label,
          s.map((x) => ({ at: x.at, value: x.value })),
          def.unit,
        );
      }
      const sofaAsc = sofaSorted
        .slice()
        .reverse()
        .filter((a) => a.total !== null);
      consider(
        "SOFA",
        sofaAsc.map((a) => ({ at: a.at, value: a.total as number })),
        null,
      );
      const newEvents = events.filter(
        (ev) =>
          (ev as { PATIENT_ID: string }).PATIENT_ID === P &&
          (ts((ev as { DATE_TIME: string | null }).DATE_TIME ?? undefined) ?? 0) > cutoff,
      );
      return {
        WINDOW_HOURS: hours,
        CHANGES: items,
        NEW_EVENTS: newEvents,
        NOTE:
          items.length || newEvents.length
            ? "Comparação baseada exclusivamente nos registros datados disponíveis."
            : "Sem registros datados suficientes nesta janela — mudança DESCONHECIDA.",
      };
    };
    const delta12 = deltaFor(12);
    const delta24 = deltaFor(24);
    const worsened = (delta12.CHANGES as { STATUS: DeltaStatus }[]).filter(
      (c) => c.STATUS === "PIOROU",
    );
    if (worsened.length)
      criticalChanges.push({
        PATIENT_ID: P,
        BED: bedId,
        WINDOW: "12h",
        WORSENED: worsened,
        CONFIDENCE: "CALCULATED",
      });

    // ── índice temporal
    const eventsOf = events.filter((e) => (e as { PATIENT_ID: string }).PATIENT_ID === P) as {
      EVENT_ID: string;
      DATE_TIME: string | null;
    }[];
    const dated = eventsOf.filter((e) => ts(e.DATE_TIME ?? undefined) !== null);
    const sortedEv = dated
      .slice()
      .sort((a, b) => (ts(a.DATE_TIME!) ?? 0) - (ts(b.DATE_TIME!) ?? 0));
    const winIndex: Record<string, string[]> = {};
    for (const [k, h] of Object.entries(windows))
      winIndex[k] = sortedEv
        .filter((e) => nowMs - (ts(e.DATE_TIME!) ?? 0) <= h * HOUR)
        .map((e) => e.EVENT_ID);
    temporalIndex[P] = {
      FIRST_RECORD: sortedEv[0]?.DATE_TIME ?? "MISSING",
      LAST_RECORD: sortedEv[sortedEv.length - 1]?.DATE_TIME ?? "MISSING",
      ...winIndex,
      ENTIRE_ADMISSION: sortedEv.map((e) => e.EVENT_ID),
      UNDATED_RECORDS: eventsOf.length - dated.length,
    };

    // ── suportes
    if (vent.mode === "ventilação mecânica invasiva") supportIndex.VENTILACAO.invasiva.push(P);
    else if (vent.mode === "ventilação não invasiva") supportIndex.VENTILACAO.nao_invasiva.push(P);
    else if (vent.mode === "oxigenoterapia") supportIndex.VENTILACAO.oxigenoterapia.push(P);
    else if (vent.mode === "respiração espontânea") supportIndex.VENTILACAO.espontanea.push(P);
    else supportIndex.VENTILACAO.nao_informado.push(P);

    if (vasoActive.length || (st.dva && st.dva !== "não"))
      supportIndex.HEMODINAMICA.vasopressor.push({
        PATIENT_ID: P,
        DRUGS: vasoActive.map((m) => ({
          NAME: m.name,
          DOSE: m.dose ?? "MISSING",
          RATE_ML_H: m.pump?.rateMlPerHour ?? m.mlPerHour ?? null,
        })),
        DVA_FIELD: st.dva ?? "MISSING",
      });
    else supportIndex.HEMODINAMICA.sem_suporte.push(P);
    if (inoActive.length)
      supportIndex.HEMODINAMICA.inotropico.push({
        PATIENT_ID: P,
        DRUGS: inoActive.map((m) => m.name),
      });

    const dialysis =
      (p.devices ?? []).some(
        (d) => /dial|crrt|hemod/i.test(`${d.typeCode} ${d.category}`) && !d.removedAt,
      ) || /dial|crrt/i.test(st.notes ?? "");
    if (dialysis) supportIndex.RENAL.dialise.push(P);
    if (oliguria === true) supportIndex.RENAL.oliguria.push(P);
    if (creatTrend === "crescente") supportIndex.RENAL.funcao_em_piora.push(P);
    if (!dialysis && oliguria !== true && creatTrend !== "crescente")
      supportIndex.RENAL.sem_alteracao_registrada.push(P);

    // ── matriz de relação (associação temporal, nunca causalidade)
    for (const prob of activeProblems.slice(0, 6)) {
      relationMatrix.push({
        PATIENT_ID: P,
        PROBLEM: prob,
        RELATED_EVENTS: sortedEv.slice(-4).map((e) => e.EVENT_ID),
        RELATED_LABS: patientLabIds.slice(0, 8),
        THERAPY: activeMeds.slice(0, 8).map((m) => m.name),
        RELATION_TYPE: "associacao_temporal",
        NOTE: "Associação temporal entre registros; causalidade não afirmada.",
      });
    }

    // ── resumo dinâmico (o paciente em uma página)
    const lastSofa = sofaSorted.find((a) => a.total !== null);
    const summary = {
      MOTIVO_INTERNACAO: p.origin
        ? `${p.origin.type}${p.origin.name ? ` · ${p.origin.name}` : ""}`
        : "MISSING",
      DIAGNOSTICO_PRINCIPAL: primary ?? "MISSING",
      PRINCIPAIS_COMPLICACOES: (p.diagnoses ?? [])
        .filter((d) => d.category === "complication")
        .map((d) => d.label),
      ESTADO_ATUAL: {
        GLASGOW: wfns?.gcs ?? st.glasgow ?? "MISSING",
        RASS: st.rass ?? "MISSING",
        PAM: st.pam ?? "MISSING",
        VENTILACAO: vent.mode,
        FIO2: st.fio2 ?? "MISSING",
        TEMPERATURA: st.temp ?? "MISSING",
        DIURESE_24H: st.diurese24 ?? st.diurese ?? "MISSING",
        GLICEMIA: st.glicemia ?? "MISSING",
        DIETA: st.dieta ?? "MISSING",
      },
      PRINCIPAIS_SUPORTES: [
        vent.mode !== "não informado" ? vent.mode : null,
        vasoActive.length ? `vasopressor: ${vasoActive.map((m) => m.name).join(", ")}` : null,
        dialysis ? "terapia renal substitutiva" : null,
      ].filter(Boolean),
      PROBLEMAS_ATIVOS: activeProblems,
      ALTERACOES_RECENTES: delta12.CHANGES,
      PENDENCIAS: patientPendingIds,
      CONFIDENCE: "DERIVED",
    };

    patientsOut.push({
      PATIENT_ID: P,
      REAL_ID: anonymize ? null : p.id,
      NAME: anonymize ? null : p.name,
      BED: bedId,
      UNIT: options.unit ?? "UTI",
      AGE: p.age ?? "MISSING",
      SEX: p.sex ?? "MISSING",
      WEIGHT_KG: p.weight ?? "MISSING",
      HEIGHT_CM: p.height ?? "MISSING",
      ADMISSION_DATE: p.admissionHosp ?? "MISSING",
      ICU_ADMISSION_DATE: p.admissionICU ?? "MISSING",
      DAYS_HOSP: p.daysHosp ?? "MISSING",
      DAYS_ICU: p.daysICU ?? "MISSING",
      SEVERITY_REGISTERED: p.severity ?? "MISSING",
      DISCHARGED: !!p.discharged,
      ORIGIN: p.origin ?? "MISSING",
      TEAM: p.team ?? "MISSING",
      ATTENDING: anonymize ? null : (p.attending ?? "MISSING"),
      PRIMARY_DIAGNOSIS: primary ?? "MISSING",
      SECONDARY_DIAGNOSES: secondary,
      RELEVANT_HISTORY: {
        SOCIAL: p.social ?? "MISSING",
        PAST_MEDICATIONS: (p.pastMedications ?? []).map((m) => m.name),
        ADVANCE_DIRECTIVE: p.advanceDirective ?? "MISSING",
      },
      ALLERGIES: (p.allergies ?? []).length ? p.allergies : ["nenhuma registrada"],
      CURRENT_STATUS: summary.ESTADO_ATUAL,
      ACTIVE_PROBLEMS: activeProblems,
      ONE_PAGE_SUMMARY: summary,
      DELTA_12H: delta12,
      DELTA_24H: delta24,
      LAST_SOFA: lastSofa ? { VALUE: lastSofa.total, AT: lastSofa.at } : "MISSING",
      CLINICAL_HISTORY: p.clinicalHistory?.trim() || "MISSING",
      REFERENCES: [] as unknown[],
    });

    // ── índice clínico global
    const priority =
      worsened.length >= 3 || p.severity === "critical"
        ? "alta"
        : worsened.length >= 1 || p.severity === "attention"
          ? "media"
          : "baixa";
    clinicalIndex.push({
      PATIENT_ID: P,
      BED: bedId,
      UNIT: options.unit ?? "UTI",
      PRIMARY_DIAGNOSIS: primary ?? "MISSING",
      ACTIVE_PROBLEMS: activeProblems,
      MECHANICAL_VENTILATION: vent.mode === "ventilação mecânica invasiva",
      VASOPRESSOR: vasoActive.length > 0 || (!!st.dva && st.dva !== "não"),
      RENAL_REPLACEMENT: dialysis,
      SOFA: lastSofa ? lastSofa.total : "MISSING",
      SOFA_AT: lastSofa?.at ?? null,
      LAST_RELEVANT_EVENT: sortedEv[sortedEv.length - 1]?.DATE_TIME ?? "MISSING",
      LAST_UPDATE: sortedEv[sortedEv.length - 1]?.DATE_TIME ?? "MISSING",
      REVIEW_PRIORITY: priority,
      PRIORITY_CRITERIA: {
        piora_12h: worsened.length,
        gravidade_registrada: p.severity ?? "MISSING",
      },
    });

    deltaCounts[P] = {
      labs: patientLabIds.length,
      events: patientEventIds.length,
      meds: (p.medications ?? []).length,
      pending: patientPendingIds.length,
      scores: patientScoreIds.length,
    };

    // validações de consistência
    const admIcu = ts(p.admissionICU);
    const admHosp = ts(p.admissionHosp);
    if (admIcu && admHosp && admIcu < admHosp)
      quality.conflitos.push(`${P} · admissão na UTI anterior à admissão hospitalar`);
    if (!p.admissionICU) quality.dados_incompletos.push(`${P} · sem data de admissão na UTI`);
    if (wfns?.gcs != null && st.glasgow != null && wfns.gcs !== st.glasgow)
      quality.conflitos.push(
        `${P} · Glasgow divergente entre WFNS (${wfns.gcs}) e estado atual (${st.glasgow})`,
      );
  }

  // ── índices cruzados
  const numericOf = (key: string) =>
    (clinicalIndex as { PATIENT_ID: string; SOFA: number | string }[])
      .filter((c) => typeof c.SOFA === "number")
      .map((c) => ({ PATIENT_ID: c.PATIENT_ID, VALUE: c.SOFA as number, VARIABLE: key }))
      .sort((a, b) => b.VALUE - a.VALUE);

  const crossPatientIndex = {
    BY_SOFA: numericOf("SOFA"),
    ON_MECHANICAL_VENTILATION: supportIndex.VENTILACAO.invasiva,
    ON_VASOPRESSOR: (supportIndex.HEMODINAMICA.vasopressor as { PATIENT_ID: string }[]).map(
      (v) => v.PATIENT_ID,
    ),
    ON_RENAL_REPLACEMENT: supportIndex.RENAL.dialise,
    BY_LAB: (() => {
      const map: Record<string, { PATIENT_ID: string; VALUE: number; AT: string | null }[]> = {};
      for (const l of labs as {
        PATIENT_ID: string;
        LABEL: string;
        CURRENT_VALUE_NUM: number | null;
        TAKEN_AT: string | null;
      }[]) {
        if (l.CURRENT_VALUE_NUM === null) continue;
        const key = l.LABEL.toUpperCase();
        (map[key] ??= []).push({
          PATIENT_ID: l.PATIENT_ID,
          VALUE: l.CURRENT_VALUE_NUM,
          AT: l.TAKEN_AT,
        });
      }
      for (const k of Object.keys(map)) map[k].sort((a, b) => b.VALUE - a.VALUE);
      return map;
    })(),
    BY_FLUID_BALANCE: (fluidBalance as { PATIENT_ID: string; BALANCE_ML: number | string }[])
      .filter((f) => typeof f.BALANCE_ML === "number")
      .map((f) => ({ PATIENT_ID: f.PATIENT_ID, VALUE: f.BALANCE_ML as number }))
      .sort((a, b) => b.VALUE - a.VALUE),
    BY_REVIEW_PRIORITY: (clinicalIndex as { PATIENT_ID: string; REVIEW_PRIORITY: string }[])
      .slice()
      .sort((a, b) => {
        const rank = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
        return (rank[a.REVIEW_PRIORITY] ?? 3) - (rank[b.REVIEW_PRIORITY] ?? 3);
      }),
    DETERIORATION_12H: (criticalChanges as { PATIENT_ID: string; WORSENED: unknown[] }[])
      .slice()
      .sort((a, b) => b.WORSENED.length - a.WORSENED.length),
  };

  // ── snapshot e round
  const hour = now.getHours() + now.getMinutes() / 60;
  const nearRound =
    Math.abs(hour - 7) <= 1.5 ? "07:00" : Math.abs(hour - 19) <= 1.5 ? "19:00" : null;
  const snapshot = {
    SNAPSHOT_ID: `SNAP-${packetId(now)}`,
    AT: iso(now),
    NEAR_ROUND: nearRound ?? "fora da janela de round",
    PATIENTS: (
      clinicalIndex as { PATIENT_ID: string; SOFA: unknown; REVIEW_PRIORITY: string }[]
    ).map((c) => ({
      PATIENT_ID: c.PATIENT_ID,
      SOFA: c.SOFA,
      REVIEW_PRIORITY: c.REVIEW_PRIORITY,
    })),
  };
  const roundSummary = {
    ROUND: nearRound ?? "não aplicável",
    REFERENCE_WINDOW: "12h",
    EVENTOS_DESDE_O_ROUND_ANTERIOR: (events as { DATE_TIME: string | null }[]).filter(
      (e) => (ts(e.DATE_TIME ?? undefined) ?? 0) > nowMs - 12 * HOUR,
    ).length,
    NOVOS_PROBLEMAS: "ver PROBLEMS com FIRST_DETECTED nas últimas 12h",
    PACIENTES_COM_PIORA: crossPatientIndex.DETERIORATION_12H.map((d) => d.PATIENT_ID),
    PENDENCIAS_ABERTAS: pendingTasks.length,
    PONTOS_PARA_REVISAO: crossPatientIndex.BY_REVIEW_PRIORITY.filter(
      (c) => c.REVIEW_PRIORITY === "alta",
    ).map((c) => c.PATIENT_ID),
  };

  // ── delta pack incremental
  const prev = options.previous ?? null;
  const deltaPack = prev
    ? (() => {
        let novosExames = 0;
        let novosEventos = 0;
        let medsAlteradas = 0;
        let novasPendencias = 0;
        let scoresAtualizados = 0;
        for (const [k, c] of Object.entries(deltaCounts)) {
          const p0 = prev.counts?.[k];
          if (!p0) {
            novosExames += c.labs;
            novosEventos += c.events;
            novasPendencias += c.pending;
            scoresAtualizados += c.scores;
            medsAlteradas += c.meds;
            continue;
          }
          novosExames += Math.max(0, c.labs - p0.labs);
          novosEventos += Math.max(0, c.events - p0.events);
          medsAlteradas += Math.abs(c.meds - p0.meds);
          novasPendencias += Math.max(0, c.pending - p0.pending);
          scoresAtualizados += Math.max(0, c.scores - p0.scores);
        }
        return {
          PREVIOUS_PACKET_ID: prev.packetId,
          PREVIOUS_VERSION: prev.version,
          PREVIOUS_CREATED_AT: prev.createdAt,
          NOVOS_EXAMES: novosExames,
          NOVOS_EVENTOS: novosEventos,
          MEDICACOES_ALTERADAS: medsAlteradas,
          NOVAS_PENDENCIAS: novasPendencias,
          SCORES_ATUALIZADOS: scoresAtualizados,
          NOTE: "Delta calculado por contagem de registros entre pacotes; não substitui o pacote completo.",
        };
      })()
    : { NOTE: "Primeiro pacote gerado nesta sessão — sem base de comparação." };

  quality.validacoes = [
    "VALIDAR PACIENTES: ok",
    "VALIDAR DATAS: registros sem data foram marcados como MISSING",
    `VALIDAR DUPLICIDADES: ${quality.duplicidades.length} ocorrência(s)`,
    `VALIDAR CONFLITOS: ${quality.conflitos.length} ocorrência(s)`,
    "VALIDAR UNIDADES: unidades preservadas conforme registro original",
    "VALIDAR SCORES: escores sem preenchimento não foram incluídos",
    "VALIDAR LINHA TEMPORAL: eventos ordenados por data/hora quando disponível",
    `VALIDAR IDENTIFICAÇÃO: ${anonymize ? "pacote anonimizado" : "identificação institucional preservada"}`,
    `VALIDAR PRIVACIDADE: ${anonymize ? "nome, responsável e telefones removidos" : "exportação identificada — uso interno"}`,
  ];

  const pack = {
    package: {
      PACKET_ID: packetId(now),
      TITLE: "AXON AI CLINICAL KNOWLEDGE PACK",
      VERSION: nextVersion(prev),
      PACK_SPEC: PACK_VERSION,
      SCOPE: scope === "complete" ? "PACOTE CLÍNICO COMPLETO" : "PACOTE CLÍNICO INTELIGENTE",
      CREATED_AT: iso(now),
      UPDATED_AT: iso(now),
      TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/Sao_Paulo",
      NUMBER_OF_PATIENTS: active.length,
      DATA_START: dataStart ? iso(new Date(dataStart)) : "MISSING",
      DATA_END: dataEnd ? iso(new Date(dataEnd)) : "MISSING",
      LAST_SYNCHRONIZATION: iso(now),
      AXON_PRO_VERSION,
      CLINICAL_ENGINE_VERSION,
      ANONYMIZED: anonymize,
    },
    hospital: {
      NAME: options.hospital ?? "não informado",
      CONFIDENCE: options.hospital ? "DOCUMENTED" : "MISSING",
    },
    units: [{ UNIT: options.unit ?? "UTI", PATIENTS: active.length }],
    patients: patientsOut,
    events,
    labs,
    imaging,
    microbiology,
    infection_foci: infectionFoci,
    medications,
    devices,
    scores,
    vitals,
    fluid_balance: fluidBalance,
    problems,
    pending_tasks: pendingTasks,
    clinical_trends: clinicalTrends,
    critical_changes: criticalChanges,
    clinical_index: clinicalIndex,
    support_index: supportIndex,
    cross_patient_index: crossPatientIndex,
    temporal_index: temporalIndex,
    semantic_index: SEMANTIC_INDEX,
    relation_matrix: relationMatrix,
    clinical_snapshot: snapshot,
    round_summary: roundSummary,
    delta_pack: deltaPack,
    source_map: sourceMap,
    data_quality_report: quality,
    ai_instructions: AI_INSTRUCTIONS,
  };

  return {
    pack,
    record: {
      packetId: pack.package.PACKET_ID,
      version: pack.package.VERSION,
      createdAt: pack.package.CREATED_AT,
      counts: deltaCounts,
    } satisfies PreviousPackRecord,
  };
}

// ───────────────────────────── contexto para IA ─────────────────────────────

export const AI_INSTRUCTIONS = {
  SYSTEM_CONTEXT: [
    "Você está analisando um pacote clínico produzido pelo AXON PRO.",
    "Este pacote contém informações clínicas estruturadas, históricas e temporais sobre pacientes hospitalizados.",
    "Sua função é ajudar o usuário a localizar, organizar, resumir, comparar e interpretar as informações disponíveis.",
  ].join(" "),
  RULES: [
    "Não inventar dados.",
    "Não criar valores ausentes.",
    "Não confundir pacientes.",
    "Não confundir datas.",
    "Priorizar dados recentes.",
    "Preservar o histórico.",
    "Diferenciar fato de inferência.",
    "Informar a origem dos dados quando possível.",
    "Identificar conflitos.",
    "Informar limitações.",
    "Não transformar sugestão em prescrição.",
    "Não modificar o prontuário.",
    "Não atribuir uma conduta a um profissional sem registro.",
  ],
  CONFIDENCE_LEVELS: {
    DOCUMENTED: "Está explicitamente registrado.",
    CALCULATED: "Foi matematicamente calculado a partir de dados registrados.",
    DERIVED: "Foi estruturado a partir de vários registros.",
    INFERRED: "É uma interpretação e deve ser apresentada como tal.",
    MISSING: "Não existe informação suficiente.",
    CONFLICTING: "Existem registros conflitantes.",
  },
  RESPONSE_PROTOCOL: [
    "1. Identificar paciente(s).",
    "2. Identificar período.",
    "3. Identificar domínio clínico.",
    "4. Recuperar dados relevantes usando clinical_index, temporal_index e semantic_index.",
    "5. Comparar temporalmente quando necessário (DELTA_12H, DELTA_24H, clinical_trends).",
    "6. Verificar origem e consistência via source_map e data_quality_report.",
    "7. Responder.",
    "8. Informar limitações quando existentes.",
  ],
  RESPONSE_FORMAT: [
    "RESUMO",
    "DADOS OBJETIVOS",
    "O QUE MUDOU",
    "INTERPRETAÇÃO (identificada como análise da IA)",
    "PENDÊNCIAS",
    "PONTOS PARA REVISÃO",
    "FONTE/DATA DOS DADOS",
  ],
  PATIENT_CONTEXT_LOCK: {
    DESCRIPTION:
      "Ao responder sobre um paciente, todos os dados utilizados devem pertencer ao mesmo PATIENT_ID.",
    CHECKS: ["VERIFY PATIENT_ID", "VERIFY SOURCE", "VERIFY DATE", "VERIFY DATA TYPE"],
    AMBIGUITY_RULE:
      "Se a referência ao paciente for ambígua (ex.: 'e ele?'), perguntar qual paciente antes de responder.",
  },
  SPECIAL_QUERIES: {
    "Quem está piorando?": "cross_patient_index.DETERIORATION_12H + critical_changes",
    "Quem está mais grave?": "cross_patient_index.BY_SOFA + clinical_index.REVIEW_PRIORITY",
    "Quem precisa ser revisto primeiro?": "cross_patient_index.BY_REVIEW_PRIORITY",
    "O que mudou desde o último round?": "round_summary + delta_pack",
    "Quem está usando vasopressor?": "support_index.HEMODINAMICA.vasopressor",
    "Quem está em ventilação mecânica?": "support_index.VENTILACAO.invasiva",
    "Quem está com balanço positivo?": "cross_patient_index.BY_FLUID_BALANCE",
    "Qual paciente teve maior aumento de SOFA?": "clinical_trends (VARIABLE = SOFA, campo DELTA)",
    "Quem apresentou alteração neurológica?":
      "semantic_index.NEUROLOGICO + events tipo alteracao_neurologica",
  },
  DATA_VS_RECOMMENDATION: {
    DADOS_DO_AXON_PRO: "Informações registradas no passômetro.",
    ANALISE_DA_IA: "Interpretação dos dados pelo modelo.",
    RECOMENDACAO:
      "Quando solicitada, deve ser claramente identificada como análise da IA e nunca como conduta registrada.",
  },
  REFERENCES_POLICY: {
    AXON_REFERENCES:
      "Somente diretrizes efetivamente registradas no pacote podem ser citadas como utilizadas pelo AXON PRO.",
    EXTERNAL_REFERENCES: "Consultas externas da IA devem ser identificadas separadamente.",
  },
  GOLDEN_RULE:
    "A IA deve saber não apenas O QUE aconteceu, mas QUANDO aconteceu, COM QUEM aconteceu, DE ONDE veio a informação e O QUE mudou desde então.",
};

// ───────────────────────────── exportação ─────────────────────────────

export function knowledgePackFileName(pack: { package: { PACKET_ID: string; VERSION: string } }) {
  return `clinical_package_${pack.package.PACKET_ID}_${pack.package.VERSION}.json`;
}

export function downloadKnowledgePack(pack: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LAST_PACK_KEY = "axon:knowledge-pack:last";

export function readLastPackRecord(): PreviousPackRecord | null {
  try {
    const raw = localStorage.getItem(LAST_PACK_KEY);
    return raw ? (JSON.parse(raw) as PreviousPackRecord) : null;
  } catch {
    return null;
  }
}

export function writeLastPackRecord(record: PreviousPackRecord) {
  try {
    localStorage.setItem(LAST_PACK_KEY, JSON.stringify(record));
  } catch {
    /* armazenamento indisponível — segue sem versionamento persistido */
  }
}
