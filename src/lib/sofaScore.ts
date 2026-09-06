import type { Patient, ExamRow } from "@/data/patients";

// ---------------------------------------------------------------------------
// SOFA — Sequential Organ Failure Assessment
// Motor de cálculo determinístico. Dado ausente NUNCA é tratado como normal:
// o componente retorna score = null (exibido como "Não informado").
// ---------------------------------------------------------------------------

export type SofaComponentKey = "resp" | "coag" | "liver" | "cardio" | "cns" | "renal";

export const SOFA_COMPONENTS: {
  key: SofaComponentKey;
  label: string;
  short: string;
  icon: string;
  color: string;
}[] = [
  { key: "resp", label: "Respiração", short: "Resp", icon: "🫁", color: "#3b82f6" },
  { key: "coag", label: "Coagulação", short: "Coag", icon: "🩸", color: "#7f1d1d" },
  { key: "liver", label: "Fígado", short: "Fígado", icon: "🧫", color: "#166534" },
  { key: "cardio", label: "Cardiovascular", short: "Cardio", icon: "❤️", color: "#ef4444" },
  { key: "cns", label: "Sistema nervoso central", short: "SNC", icon: "🧠", color: "#8b5cf6" },
  { key: "renal", label: "Renal", short: "Renal", icon: "💧", color: "#eab308" },
];

/** Origem rastreável de cada valor. Nunca preencher sem origem identificável. */
export type SofaSource = "manual" | "prontuario" | "monitor" | "laboratorio";

export const SOURCE_LABEL: Record<SofaSource, string> = {
  manual: "Entrada manual",
  prontuario: "Fonte: prontuário",
  monitor: "Monitor",
  laboratorio: "Laboratório",
};

export type Vasopressor = "none" | "dobutamina" | "dopamina" | "noradrenalina" | "adrenalina";

export const VASOPRESSOR_LABEL: Record<Vasopressor, string> = {
  none: "Nenhum",
  dobutamina: "Dobutamina",
  dopamina: "Dopamina",
  noradrenalina: "Noradrenalina",
  adrenalina: "Adrenalina",
};

export type SofaFieldKey =
  | "pao2"
  | "fio2"
  | "platelets"
  | "bilirubin"
  | "map"
  | "vasoDose"
  | "gcsTotal"
  | "creatinine"
  | "urineOutput";

export interface SofaInputs {
  pao2: number | null; // mmHg
  fio2: number | null; // %
  respSupport: boolean;
  platelets: number | null; // ×10³/µL
  bilirubin: number | null; // mg/dL
  map: number | null; // mmHg
  vasopressor: Vasopressor;
  vasoDose: number | null; // µg/kg/min
  gcsMode: "band" | "components";
  gcsTotal: number | null; // 3–15
  gcsE: number | null;
  gcsV: number | null;
  gcsM: number | null;
  creatinine: number | null; // mg/dL
  urineOutput: number | null; // mL/24h
  /** Rastreabilidade por campo. */
  sources?: Partial<Record<SofaFieldKey, SofaSource>>;
  /** Timestamp da informação por campo (ISO). */
  timestamps?: Partial<Record<SofaFieldKey, string>>;
}

export function emptySofaInputs(): SofaInputs {
  return {
    pao2: null,
    fio2: null,
    respSupport: false,
    platelets: null,
    bilirubin: null,
    map: null,
    vasopressor: "none",
    vasoDose: null,
    gcsMode: "band",
    gcsTotal: null,
    gcsE: null,
    gcsV: null,
    gcsM: null,
    creatinine: null,
    urineOutput: null,
    sources: {},
    timestamps: {},
  };
}

export interface SofaComponentResult {
  /** null = não calculável (dado não informado / inválido) */
  score: number | null;
  /** Texto curto do dado usado, ex.: "PaO₂/FiO₂: 185". */
  detail: string;
  /** Motivo quando score === null. */
  reason?: string;
}

// --- componentes ------------------------------------------------------------

export function pfRatio(pao2: number | null, fio2: number | null): number | null {
  if (pao2 == null || fio2 == null) return null;
  if (pao2 <= 0 || fio2 <= 0) return null;
  const frac = fio2 > 1 ? fio2 / 100 : fio2;
  if (frac <= 0) return null;
  return pao2 / frac;
}

export function calculateRespiratorySOFA(
  pao2: number | null,
  fio2: number | null,
  respSupport: boolean,
): SofaComponentResult {
  const ratio = pfRatio(pao2, fio2);
  if (ratio == null) {
    return {
      score: null,
      detail: "PaO₂/FiO₂: não informado",
      reason: "PaO₂ e FiO₂ são necessários.",
    };
  }
  const detail = `PaO₂/FiO₂: ${Math.round(ratio)}`;
  let score: number;
  if (ratio < 100 && respSupport) score = 4;
  else if (ratio < 200 && respSupport) score = 3;
  else if (ratio < 300) score = 2;
  else if (ratio < 400) score = 1;
  else score = 0;
  return { score, detail };
}

export function calculateCoagulationSOFA(platelets: number | null): SofaComponentResult {
  if (platelets == null) {
    return { score: null, detail: "Plaquetas: não informado", reason: "Plaquetas necessárias." };
  }
  // aceita valor absoluto (ex.: 85000) ou ×10³/µL (ex.: 85)
  const k = platelets > 2000 ? platelets / 1000 : platelets;
  const detail = `Plaquetas: ${k} ×10³/µL`;
  let score: number;
  if (k < 20) score = 4;
  else if (k < 50) score = 3;
  else if (k < 100) score = 2;
  else if (k < 150) score = 1;
  else score = 0;
  return { score, detail };
}

export function calculateLiverSOFA(bilirubin: number | null): SofaComponentResult {
  if (bilirubin == null) {
    return {
      score: null,
      detail: "Bilirrubina total: não informada",
      reason: "Bilirrubina total necessária.",
    };
  }
  const detail = `Bilirrubina: ${bilirubin} mg/dL`;
  let score: number;
  if (bilirubin >= 12) score = 4;
  else if (bilirubin >= 6) score = 3;
  else if (bilirubin >= 2) score = 2;
  else if (bilirubin >= 1.2) score = 1;
  else score = 0;
  return { score, detail };
}

export function calculateCardiovascularSOFA(
  map: number | null,
  vasopressor: Vasopressor,
  dose: number | null,
): SofaComponentResult {
  let vasoScore: number | null = null;
  if (vasopressor !== "none") {
    if (vasopressor === "dobutamina") {
      vasoScore = 2; // qualquer dose
    } else if (dose == null) {
      return {
        score: null,
        detail: `${VASOPRESSOR_LABEL[vasopressor]}: dose não informada`,
        reason: "Informe a dose para calcular o componente cardiovascular.",
      };
    } else if (vasopressor === "dopamina") {
      vasoScore = dose > 15 ? 4 : dose > 5 ? 3 : 2;
    } else {
      // noradrenalina / adrenalina
      vasoScore = dose > 0.1 ? 4 : 3;
    }
  }

  const mapScore = map == null ? null : map < 70 ? 1 : 0;

  if (vasoScore == null && mapScore == null) {
    return {
      score: null,
      detail: "PAM: não informada",
      reason: "Informe a PAM ou o vasopressor em uso.",
    };
  }

  const parts: string[] = [];
  parts.push(map == null ? "PAM: não informada" : `PAM: ${map} mmHg`);
  if (vasopressor !== "none") {
    parts.push(`${VASOPRESSOR_LABEL[vasopressor]}${dose != null ? ` ${dose} µg/kg/min` : ""}`);
  } else {
    parts.push("Sem vasopressor");
  }

  // maior critério aplicável (evita conflito entre PAM e vasopressor)
  const score = Math.max(vasoScore ?? 0, mapScore ?? 0);
  return { score, detail: parts.join(" · ") };
}

export function gcsFromComponents(
  e: number | null,
  v: number | null,
  m: number | null,
): number | null {
  if (e == null || v == null || m == null) return null;
  return e + v + m;
}

export function calculateNeurologicalSOFA(gcs: number | null): SofaComponentResult {
  if (gcs == null) {
    return { score: null, detail: "Glasgow: não informada", reason: "Glasgow necessária." };
  }
  if (gcs < 3 || gcs > 15) {
    return { score: null, detail: `Glasgow: ${gcs}`, reason: "Glasgow deve estar entre 3 e 15." };
  }
  const detail = `Glasgow: ${gcs}`;
  let score: number;
  if (gcs < 6) score = 4;
  else if (gcs < 10) score = 3;
  else if (gcs < 13) score = 2;
  else if (gcs < 15) score = 1;
  else score = 0;
  return { score, detail };
}

export function calculateRenalSOFA(
  creatinine: number | null,
  urineOutput: number | null,
): SofaComponentResult {
  if (creatinine == null && urineOutput == null) {
    return {
      score: null,
      detail: "Creatinina / diurese: não informadas",
      reason: "Informe creatinina e/ou débito urinário.",
    };
  }
  let creatScore: number | null = null;
  if (creatinine != null) {
    creatScore =
      creatinine >= 5 ? 4 : creatinine >= 3.5 ? 3 : creatinine >= 2 ? 2 : creatinine >= 1.2 ? 1 : 0;
  }
  let urineScore: number | null = null;
  if (urineOutput != null) {
    urineScore = urineOutput < 200 ? 4 : urineOutput < 500 ? 3 : 0;
  }
  const parts: string[] = [];
  parts.push(creatinine == null ? "Creatinina: não informada" : `Creatinina: ${creatinine} mg/dL`);
  parts.push(urineOutput == null ? "Diurese: não informada" : `Diurese: ${urineOutput} mL/24h`);
  const score = Math.max(creatScore ?? 0, urineScore ?? 0);
  return { score, detail: parts.join(" · ") };
}

export interface SofaResult {
  components: Record<SofaComponentKey, SofaComponentResult>;
  scores: Record<SofaComponentKey, number | null>;
  total: number | null;
  /** Componentes sem dado suficiente. */
  missing: SofaComponentKey[];
  /** true quando algum componente não é calculável. */
  partial: boolean;
}

export function calculateTotalSOFA(inputs: SofaInputs): SofaResult {
  const gcs =
    inputs.gcsMode === "components"
      ? gcsFromComponents(inputs.gcsE, inputs.gcsV, inputs.gcsM)
      : inputs.gcsTotal;

  const components: Record<SofaComponentKey, SofaComponentResult> = {
    resp: calculateRespiratorySOFA(inputs.pao2, inputs.fio2, inputs.respSupport),
    coag: calculateCoagulationSOFA(inputs.platelets),
    liver: calculateLiverSOFA(inputs.bilirubin),
    cardio: calculateCardiovascularSOFA(inputs.map, inputs.vasopressor, inputs.vasoDose),
    cns: calculateNeurologicalSOFA(gcs),
    renal: calculateRenalSOFA(inputs.creatinine, inputs.urineOutput),
  };

  const scores = {} as Record<SofaComponentKey, number | null>;
  const missing: SofaComponentKey[] = [];
  let total: number | null = null;
  for (const { key } of SOFA_COMPONENTS) {
    const s = components[key].score;
    scores[key] = s;
    if (s == null) missing.push(key);
    else total = (total ?? 0) + s;
  }
  return { components, scores, total, missing, partial: missing.length > 0 };
}

// --- validação --------------------------------------------------------------

export interface SofaValidationIssue {
  field: SofaFieldKey | "vasopressor";
  message: string;
}

export function validateSofaInputs(inputs: SofaInputs): SofaValidationIssue[] {
  const out: SofaValidationIssue[] = [];
  if (inputs.pao2 != null && inputs.pao2 <= 0)
    out.push({ field: "pao2", message: "Valor inválido. PaO₂ deve ser maior que zero." });
  if (inputs.fio2 != null && (inputs.fio2 < 21 || inputs.fio2 > 100))
    out.push({ field: "fio2", message: "Valor inválido. FiO₂ deve estar entre 21% e 100%." });
  if (inputs.platelets != null && inputs.platelets < 0)
    out.push({ field: "platelets", message: "Valor inválido." });
  if (inputs.bilirubin != null && inputs.bilirubin < 0)
    out.push({ field: "bilirubin", message: "Valor inválido." });
  if (inputs.map != null && (inputs.map <= 0 || inputs.map > 200))
    out.push({ field: "map", message: "Valor inválido. PAM deve estar entre 1 e 200 mmHg." });
  if (inputs.creatinine != null && inputs.creatinine < 0)
    out.push({ field: "creatinine", message: "Valor inválido." });
  if (inputs.urineOutput != null && inputs.urineOutput < 0)
    out.push({ field: "urineOutput", message: "Valor inválido." });
  const gcs =
    inputs.gcsMode === "components"
      ? gcsFromComponents(inputs.gcsE, inputs.gcsV, inputs.gcsM)
      : inputs.gcsTotal;
  if (gcs != null && (gcs < 3 || gcs > 15))
    out.push({ field: "gcsTotal", message: "Glasgow deve estar entre 3 e 15." });
  if (
    inputs.vasopressor !== "none" &&
    inputs.vasopressor !== "dobutamina" &&
    inputs.vasoDose == null
  )
    out.push({
      field: "vasoDose",
      message: "Informe a dose para calcular o componente cardiovascular.",
    });
  if (inputs.vasoDose != null && inputs.vasoDose < 0)
    out.push({ field: "vasoDose", message: "Valor inválido." });
  return out;
}

// --- gravidade --------------------------------------------------------------

export const SEVERITY_LABEL: Record<number, string> = {
  0: "Normal",
  1: "Alteração leve",
  2: "Alteração moderada",
  3: "Alteração grave",
  4: "Alteração muito grave",
};

export function severityClass(score: number | null): string {
  if (score == null) return "border-border bg-surface-2 text-muted-foreground";
  switch (score) {
    case 0:
      return "border-clinical-stable/40 bg-clinical-stable/10 text-clinical-stable";
    case 1:
      return "border-clinical-stable/40 bg-clinical-stable/5 text-foreground";
    case 2:
      return "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention";
    case 3:
      return "border-clinical-critical/30 bg-clinical-critical/10 text-clinical-critical";
    default:
      return "border-clinical-critical/50 bg-clinical-critical/15 text-clinical-critical";
  }
}

// --- histórico / rounds -----------------------------------------------------

export type SofaRound = "07:00" | "19:00" | null;

export interface SofaAssessment {
  id: string;
  /** ISO da avaliação */
  at: string;
  /** usuário responsável */
  by?: string;
  round: SofaRound;
  inputs: SofaInputs;
  scores: Record<SofaComponentKey, number | null>;
  total: number | null;
  partial: boolean;
}

/** Classifica a avaliação como round de 07:00 ou 19:00 (janela de ±90 min). */
export function detectRound(at: string | Date): SofaRound {
  const d = at instanceof Date ? at : new Date(at);
  if (isNaN(d.getTime())) return null;
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (Math.abs(minutes - 7 * 60) <= 90) return "07:00";
  if (Math.abs(minutes - 19 * 60) <= 90) return "19:00";
  return null;
}

export function buildAssessment(
  inputs: SofaInputs,
  result: SofaResult,
  by?: string,
  at: string = new Date().toISOString(),
): SofaAssessment {
  return {
    id: `sofa-${Date.parse(at) || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    by,
    round: detectRound(at),
    inputs: JSON.parse(JSON.stringify(inputs)) as SofaInputs,
    scores: { ...result.scores },
    total: result.total,
    partial: result.partial,
  };
}

/** Mais recente primeiro. */
export function sortAssessments(list: SofaAssessment[]): SofaAssessment[] {
  return [...list].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export interface SofaComparison {
  current: SofaAssessment | null;
  previous: SofaAssessment | null;
  delta: number | null;
  min: SofaAssessment | null;
  max: SofaAssessment | null;
}

export function compareAssessments(list: SofaAssessment[]): SofaComparison {
  const sorted = sortAssessments(list);
  const current = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const delta =
    current?.total != null && previous?.total != null ? current.total - previous.total : null;
  let min: SofaAssessment | null = null;
  let max: SofaAssessment | null = null;
  for (const a of sorted) {
    if (a.total == null) continue;
    if (!min || a.total < (min.total ?? Infinity)) min = a;
    if (!max || a.total > (max.total ?? -Infinity)) max = a;
  }
  return { current, previous, delta, min, max };
}

export function deltaText(delta: number | null): string {
  if (delta == null) return "Δ SOFA não calculável — avaliação incompleta.";
  if (delta === 0) return "Sem variação em relação à avaliação anterior.";
  const n = Math.abs(delta);
  return delta < 0
    ? `Redução de ${n} ${n === 1 ? "ponto" : "pontos"} em relação à avaliação anterior.`
    : `Elevação de ${n} ${n === 1 ? "ponto" : "pontos"} em relação à avaliação anterior.`;
}

// --- pré-preenchimento a partir do passômetro -------------------------------

function toNum(raw?: string | number | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(
    s
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", "."),
  );
  return isNaN(n) ? null : n;
}

function findExam(p: Patient, ...labels: string[]): ExamRow | undefined {
  return (p.exams ?? []).find((e) =>
    labels.some((l) => (e.label ?? "").toLowerCase().includes(l.toLowerCase())),
  );
}

function examValue(p: Patient, ...labels: string[]): { value: number | null; at?: string } {
  const e = findExam(p, ...labels);
  if (!e) return { value: null };
  const v = e.valueNum ?? toNum(e.value);
  return { value: v, at: e.takenAt };
}

function parseVaso(dva: string | null | undefined): {
  vasopressor: Vasopressor;
  dose: number | null;
} {
  const d = (dva ?? "").toLowerCase();
  if (!d.trim()) return { vasopressor: "none", dose: null };
  const dose = toNum((d.match(/(\d+[.,]?\d*)\s*mcg\/kg\/min/) ?? [])[1]);
  if (/nora|noradren/.test(d)) return { vasopressor: "noradrenalina", dose };
  if (/adren|epinef/.test(d)) return { vasopressor: "adrenalina", dose };
  if (/dobuta/.test(d)) return { vasopressor: "dobutamina", dose };
  if (/dopa/.test(d)) return { vasopressor: "dopamina", dose };
  return { vasopressor: "none", dose: null };
}

/**
 * Monta os inputs a partir dos dados já registrados no passômetro.
 * Só preenche valores com origem identificável e guarda a fonte + timestamp.
 */
export function prefillFromPatient(p: Patient): SofaInputs {
  const inputs = emptySofaInputs();
  const sources: NonNullable<SofaInputs["sources"]> = {};
  const timestamps: NonNullable<SofaInputs["timestamps"]> = {};

  const pao2 = examValue(p, "pao2", "po2");
  if (pao2.value != null) {
    inputs.pao2 = pao2.value;
    sources.pao2 = "laboratorio";
    if (pao2.at) timestamps.pao2 = pao2.at;
  }
  const plaq = examValue(p, "plaq");
  if (plaq.value != null) {
    inputs.platelets = plaq.value > 2000 ? plaq.value / 1000 : plaq.value;
    sources.platelets = "laboratorio";
    if (plaq.at) timestamps.platelets = plaq.at;
  }
  const bili = examValue(p, "bilirrubina total", "bilirr");
  if (bili.value != null) {
    inputs.bilirubin = bili.value;
    sources.bilirubin = "laboratorio";
    if (bili.at) timestamps.bilirubin = bili.at;
  }
  const creat = examValue(p, "creatinina", "creat");
  if (creat.value != null) {
    inputs.creatinine = creat.value;
    sources.creatinine = "laboratorio";
    if (creat.at) timestamps.creatinine = creat.at;
  }

  const s = p.state;
  if (s) {
    if (typeof s.fio2 === "number" && s.fio2 > 0) {
      inputs.fio2 = s.fio2 > 1 ? s.fio2 : s.fio2 * 100;
      sources.fio2 = "prontuario";
    }
    inputs.respSupport = /vm|psv|pcv|vcv|iot|tot|traq|cnaf|vni|bipap|cpap/i.test(s.vent ?? "");
    if (typeof s.pam === "number" && s.pam > 0) {
      inputs.map = s.pam;
      sources.map = "monitor";
    }
    const vaso = parseVaso(s.dva);
    inputs.vasopressor = vaso.vasopressor;
    inputs.vasoDose = vaso.dose;
    if (vaso.vasopressor !== "none") sources.vasoDose = "prontuario";
    if (typeof s.glasgow === "number" && s.glasgow >= 3 && s.glasgow <= 15) {
      inputs.gcsTotal = s.glasgow;
      sources.gcsTotal = "prontuario";
    }
    const diurese = typeof s.diurese24 === "number" ? s.diurese24 : s.diurese;
    if (typeof diurese === "number" && diurese > 0) {
      inputs.urineOutput = diurese;
      sources.urineOutput = "prontuario";
    }
  }

  inputs.sources = sources;
  inputs.timestamps = timestamps;
  return inputs;
}

export const SOFA_REFERENCES: { text: string; note?: string }[] = [
  {
    text: "Vincent JL, Moreno R, Takala J, et al. The SOFA (Sepsis-related Organ Failure Assessment) score to describe organ dysfunction/failure. Intensive Care Med. 1996;22(7):707-710.",
    note: "Publicação original do escore e dos pontos de corte de cada sistema.",
  },
  {
    text: "Vincent JL, de Mendonça A, Cantraine F, et al. Use of the SOFA score to assess the incidence of organ dysfunction/failure in intensive care units. Crit Care Med. 1998;26(11):1793-1800.",
    note: "Validação multicêntrica e uso sequencial (avaliações repetidas).",
  },
  {
    text: "Singer M, Deutschman CS, Seymour CW, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801-810.",
    note: "Contextualiza o SOFA nas definições atuais — o escore não é, por si só, diagnóstico.",
  },
  {
    text: "Lambden S, Laterre PF, Levy MM, Francois B. The SOFA score — development, utility and challenges of accurate assessment in clinical trials. Crit Care. 2019;23(1):374.",
    note: "Revisão crítica sobre limitações, dados ausentes e reprodutibilidade.",
  },
];

export const SOFA_DISCLAIMER =
  "Ferramenta de apoio à decisão clínica. O resultado deve ser interpretado em conjunto com o quadro clínico, exame físico, dados laboratoriais e demais informações do paciente.";
