// Clinical knowledge base + helpers (labs, drugs, procedures, classification, trend, estado atual)
import type { Patient, ExamRow, Medication, MedicationClass, ConductSystem, FluidEntry, DrainEntry, DerivationEntry, AnnotationColor } from "@/data/patients";

// ============================================================================
// LABS — catalog with reference ranges
// ============================================================================

export type LabBucket = "very_low" | "low" | "normal" | "high" | "very_high";

export interface LabDef {
  code: string;
  label: string;
  unit: string;
  // For ref: [veryLow, low, high, veryHigh]. Sex-specific optional.
  ref: { low: number; high: number; veryLow?: number; veryHigh?: number };
  refF?: { low: number; high: number; veryLow?: number; veryHigh?: number };
  // For trend: is a rising value good ("good") or bad ("bad")?
  risingIs: "good" | "bad" | "neutral";
}

export const LABS: LabDef[] = [
  { code: "Hb", label: "Hemoglobina", unit: "g/dL", ref: { low: 13, high: 17, veryLow: 8, veryHigh: 19 }, refF: { low: 12, high: 16, veryLow: 8, veryHigh: 18 }, risingIs: "good" },
  { code: "Ht", label: "Hematócrito", unit: "%", ref: { low: 40, high: 52, veryLow: 25, veryHigh: 58 }, refF: { low: 36, high: 47, veryLow: 25, veryHigh: 55 }, risingIs: "good" },
  { code: "Leuco", label: "Leucócitos", unit: "/mm³", ref: { low: 4000, high: 11000, veryLow: 2000, veryHigh: 20000 }, risingIs: "bad" },
  { code: "Plaq", label: "Plaquetas", unit: "/mm³", ref: { low: 150000, high: 450000, veryLow: 50000, veryHigh: 800000 }, risingIs: "good" },
  { code: "PCR", label: "PCR", unit: "mg/dL", ref: { low: 0, high: 0.5, veryHigh: 10 }, risingIs: "bad" },
  { code: "Lactato", label: "Lactato", unit: "mmol/L", ref: { low: 0.5, high: 2, veryHigh: 4 }, risingIs: "bad" },
  { code: "Creat", label: "Creatinina", unit: "mg/dL", ref: { low: 0.6, high: 1.3, veryHigh: 3 }, risingIs: "bad" },
  { code: "Ureia", label: "Ureia", unit: "mg/dL", ref: { low: 15, high: 45, veryHigh: 100 }, risingIs: "bad" },
  { code: "Na", label: "Sódio", unit: "mEq/L", ref: { low: 135, high: 145, veryLow: 125, veryHigh: 155 }, risingIs: "neutral" },
  { code: "K", label: "Potássio", unit: "mEq/L", ref: { low: 3.5, high: 5.0, veryLow: 2.8, veryHigh: 6.0 }, risingIs: "neutral" },
  { code: "Cl", label: "Cloro", unit: "mEq/L", ref: { low: 98, high: 108 }, risingIs: "neutral" },
  { code: "Ca", label: "Cálcio iônico", unit: "mmol/L", ref: { low: 1.1, high: 1.35 }, risingIs: "neutral" },
  { code: "Mg", label: "Magnésio", unit: "mg/dL", ref: { low: 1.6, high: 2.6 }, risingIs: "neutral" },
  { code: "Glic", label: "Glicemia", unit: "mg/dL", ref: { low: 70, high: 180, veryLow: 50, veryHigh: 250 }, risingIs: "neutral" },
  { code: "pH", label: "pH arterial", unit: "", ref: { low: 7.35, high: 7.45, veryLow: 7.2, veryHigh: 7.55 }, risingIs: "neutral" },
  { code: "PaO2", label: "PaO₂", unit: "mmHg", ref: { low: 80, high: 100, veryLow: 60 }, risingIs: "good" },
  { code: "PaCO2", label: "PaCO₂", unit: "mmHg", ref: { low: 35, high: 45, veryHigh: 60 }, risingIs: "neutral" },
  { code: "HCO3", label: "Bicarbonato", unit: "mEq/L", ref: { low: 22, high: 26 }, risingIs: "neutral" },
  { code: "SatO2", label: "SatO₂", unit: "%", ref: { low: 92, high: 100, veryLow: 85 }, risingIs: "good" },
  { code: "BE", label: "BE (Base Excess)", unit: "mEq/L", ref: { low: -2, high: 2, veryLow: -6, veryHigh: 6 }, risingIs: "neutral" },
  { code: "PF", label: "Relação P/F (PaO₂/FiO₂)", unit: "", ref: { low: 300, high: 500, veryLow: 100 }, risingIs: "good" },

  { code: "INR", label: "INR", unit: "", ref: { low: 0.9, high: 1.2, veryHigh: 3 }, risingIs: "bad" },
  { code: "Trop", label: "Troponina", unit: "ng/mL", ref: { low: 0, high: 0.04, veryHigh: 1 }, risingIs: "bad" },
  { code: "BNP", label: "BNP", unit: "pg/mL", ref: { low: 0, high: 100, veryHigh: 400 }, risingIs: "bad" },
  { code: "Bilir", label: "Bilirrubina total", unit: "mg/dL", ref: { low: 0.2, high: 1.2, veryHigh: 5 }, risingIs: "bad" },
  { code: "PIC", label: "PIC", unit: "mmHg", ref: { low: 5, high: 15, veryHigh: 20 }, risingIs: "bad" },
];

export const labByCode = (code: string) => LABS.find((l) => l.code === code);
export const labByLabel = (label: string) =>
  LABS.find((l) => l.code === label || l.label.toLowerCase() === label.toLowerCase());

// Parse "12,1" / "18.000" / "1,5" → number. Brazilian style.
export function parseClinicalNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s/g, "");
  if (s.includes(",")) {
    // comma is decimal; dots are thousands
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // dots as thousands separator (e.g. "18.000")
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}


export function classifyLab(code: string, value: number, sex: "M" | "F" = "M"): LabBucket {
  const def = labByCode(code);
  if (!def) return "normal";
  const ref = sex === "F" && def.refF ? def.refF : def.ref;
  if (ref.veryLow !== undefined && value < ref.veryLow) return "very_low";
  if (value < ref.low) return "low";
  if (ref.veryHigh !== undefined && value > ref.veryHigh) return "very_high";
  if (value > ref.high) return "high";
  return "normal";
}

export function bucketBadge(b: LabBucket) {
  switch (b) {
    case "very_low": return { icon: "🔴", className: "text-clinical-critical", label: "Muito baixo" };
    case "low":      return { icon: "🟡", className: "text-clinical-attention", label: "Baixo" };
    case "normal":   return { icon: "🟢", className: "text-clinical-stable",    label: "Normal" };
    case "high":     return { icon: "🟠", className: "text-clinical-device",    label: "Elevado" };
    case "very_high":return { icon: "🔴", className: "text-clinical-critical", label: "Muito elevado" };
  }
}

export type TrendDirection = "improving" | "worsening" | "flat";

export function computeTrend(code: string, history: number[]): TrendDirection {
  if (history.length < 2) return "flat";
  const [latest, prev] = history; // newest first
  if (latest === prev) return "flat";
  const def = labByCode(code);
  const rising = latest > prev;
  if (!def || def.risingIs === "neutral") return "flat";
  if (def.risingIs === "good") return rising ? "improving" : "worsening";
  return rising ? "worsening" : "improving";
}

export function trendBadge(t: TrendDirection) {
  switch (t) {
    case "improving": return { icon: "📉", className: "text-clinical-stable",    label: "Melhorando" };
    case "worsening": return { icon: "📈", className: "text-clinical-critical", label: "Piorando" };
    case "flat":      return { icon: "➖", className: "text-clinical-neutral",   label: "Estável" };
  }
}

// Resolve exam display info (bucket + trend) from an ExamRow, using valueNum/history if available
export function examInsight(e: ExamRow, sex: "M" | "F" = "M") {
  const code = e.code ?? labByLabel(e.label)?.code ?? e.label;
  const value = e.valueNum ?? parseClinicalNumber(e.value);
  const history = (e.history ?? []).map((h) => h.value);
  const series = value !== null && (!history.length || history[0] !== value) ? [value, ...history] : history;
  const bucket = value !== null ? classifyLab(code, value, sex) : null;
  const trend = computeTrend(code, series);
  return { code, value, bucket, trend };
}

// ============================================================================
// DRUGS — UTI catalog with institutional dilutions + infusion calculator
// ============================================================================

export type DoseUnit = "mcg/kg/min" | "mcg/min" | "mg/kg/h" | "mg/h" | "UI/h";

export interface DrugProtocol {
  name: string;
  ampMg: number;     // mg per ampoule
  diluentMl: number; // total mL after dilution
  // resulting concentration mg/mL = ampMg / diluentMl
}

export interface DrugDef {
  name: string;
  category: "vasoativa" | "sedativo" | "analgesico" | "atb" | "anticoag" | "cardio" | "outros";
  doseUnit: DoseUnit;
  usual: number;
  min: number;
  max: number;
  bic: boolean;
  protocols: Record<"Geral" | "Neuro" | "Cardio", DrugProtocol>;
  notes?: string;
}

const ratio = (mg: number, ml: number) => ({ ampMg: mg, diluentMl: ml });

export const DRUGS: DrugDef[] = [
  {
    name: "Noradrenalina", category: "vasoativa", doseUnit: "mcg/kg/min",
    usual: 0.1, min: 0.02, max: 2, bic: true,
    protocols: {
      Geral:  { name: "Padrão (8mg/100mL)", ...ratio(8, 100) },
      Neuro:  { name: "Padrão (8mg/100mL)", ...ratio(8, 100) },
      Cardio: { name: "Concentrada (16mg/100mL)", ...ratio(16, 100) },
    },
  },
  {
    name: "Adrenalina", category: "vasoativa", doseUnit: "mcg/kg/min",
    usual: 0.05, min: 0.01, max: 1, bic: true,
    protocols: {
      Geral:  { name: "Padrão (5mg/100mL)", ...ratio(5, 100) },
      Neuro:  { name: "Padrão (5mg/100mL)", ...ratio(5, 100) },
      Cardio: { name: "Concentrada (10mg/100mL)", ...ratio(10, 100) },
    },
  },
  {
    name: "Vasopressina", category: "vasoativa", doseUnit: "UI/h",
    usual: 2.4, min: 0.6, max: 4.8, bic: true,
    protocols: {
      Geral:  { name: "20 UI/100 mL", ...ratio(20, 100) },
      Neuro:  { name: "20 UI/100 mL", ...ratio(20, 100) },
      Cardio: { name: "20 UI/100 mL", ...ratio(20, 100) },
    },
  },
  {
    name: "Dobutamina", category: "vasoativa", doseUnit: "mcg/kg/min",
    usual: 5, min: 2, max: 20, bic: true,
    protocols: {
      Geral:  { name: "250mg/250mL", ...ratio(250, 250) },
      Neuro:  { name: "250mg/250mL", ...ratio(250, 250) },
      Cardio: { name: "500mg/250mL", ...ratio(500, 250) },
    },
  },
  {
    name: "Nitroprussiato", category: "vasoativa", doseUnit: "mcg/kg/min",
    usual: 1, min: 0.25, max: 8, bic: true,
    protocols: {
      Geral:  { name: "50mg/250mL", ...ratio(50, 250) },
      Neuro:  { name: "50mg/250mL", ...ratio(50, 250) },
      Cardio: { name: "50mg/250mL", ...ratio(50, 250) },
    },
    notes: "Fotoprotegida. Risco de cianeto > 48h.",
  },
  {
    name: "Fentanil", category: "analgesico", doseUnit: "mcg/kg/min",
    usual: 0.03, min: 0.01, max: 0.1, bic: true,
    protocols: {
      Geral:  { name: "2500mcg/50mL (50mcg/mL)", ...ratio(2.5, 50) },
      Neuro:  { name: "2500mcg/50mL (50mcg/mL)", ...ratio(2.5, 50) },
      Cardio: { name: "2500mcg/50mL (50mcg/mL)", ...ratio(2.5, 50) },
    },
  },
  {
    name: "Midazolam", category: "sedativo", doseUnit: "mg/kg/h",
    usual: 0.05, min: 0.02, max: 0.2, bic: true,
    protocols: {
      Geral:  { name: "100mg/100mL", ...ratio(100, 100) },
      Neuro:  { name: "100mg/100mL", ...ratio(100, 100) },
      Cardio: { name: "100mg/100mL", ...ratio(100, 100) },
    },
  },
  {
    name: "Propofol", category: "sedativo", doseUnit: "mg/kg/h",
    usual: 2, min: 0.5, max: 4, bic: true,
    protocols: {
      Geral:  { name: "1% (10mg/mL)", ...ratio(1000, 100) },
      Neuro:  { name: "2% (20mg/mL)", ...ratio(2000, 100) },
      Cardio: { name: "1% (10mg/mL)", ...ratio(1000, 100) },
    },
    notes: "Risco de PRIS em uso prolongado.",
  },
  {
    name: "Dexmedetomidina", category: "sedativo", doseUnit: "mcg/kg/min",
    usual: 0.01, min: 0.003, max: 0.025, bic: true,
    protocols: {
      Geral:  { name: "200mcg/50mL", ...ratio(0.2, 50) },
      Neuro:  { name: "200mcg/50mL", ...ratio(0.2, 50) },
      Cardio: { name: "200mcg/50mL", ...ratio(0.2, 50) },
    },
  },
  {
    name: "Cisatracúrio", category: "sedativo", doseUnit: "mcg/kg/min",
    usual: 3, min: 1, max: 10, bic: true,
    protocols: {
      Geral:  { name: "20mg/100mL", ...ratio(20, 100) },
      Neuro:  { name: "20mg/100mL", ...ratio(20, 100) },
      Cardio: { name: "20mg/100mL", ...ratio(20, 100) },
    },
  },
  {
    name: "Insulina regular", category: "outros", doseUnit: "UI/h",
    usual: 2, min: 0.5, max: 20, bic: true,
    protocols: {
      Geral:  { name: "100 UI/100 mL SF", ...ratio(100, 100) },
      Neuro:  { name: "100 UI/100 mL SF", ...ratio(100, 100) },
      Cardio: { name: "100 UI/100 mL SF", ...ratio(100, 100) },
    },
  },
  {
    name: "Heparina", category: "anticoag", doseUnit: "UI/h",
    usual: 1000, min: 200, max: 2500, bic: true,
    protocols: {
      Geral:  { name: "25.000 UI/250 mL", ...ratio(25000, 250) },
      Neuro:  { name: "25.000 UI/250 mL", ...ratio(25000, 250) },
      Cardio: { name: "25.000 UI/250 mL", ...ratio(25000, 250) },
    },
  },
  {
    name: "Amiodarona", category: "cardio", doseUnit: "mg/h",
    usual: 60, min: 30, max: 90, bic: true,
    protocols: {
      Geral:  { name: "900mg/500mL SG5%", ...ratio(900, 500) },
      Neuro:  { name: "900mg/500mL SG5%", ...ratio(900, 500) },
      Cardio: { name: "900mg/500mL SG5%", ...ratio(900, 500) },
    },
  },
];

export const drugByName = (n: string) => DRUGS.find((d) => d.name.toLowerCase() === n.toLowerCase());

export interface InfusionResult {
  concentrationMgPerMl: number;
  mlPerHour: number;
  totalPerMin: number;     // mcg/min ou mg/min
  totalLabel: string;
  doseLabel: string;
  protocolLabel: string;
  warning?: string;
}

export function computeInfusion(opts: {
  drug: DrugDef;
  protocol: "Geral" | "Neuro" | "Cardio";
  dose: number;            // in drug.doseUnit
  weightKg: number;
}): InfusionResult {
  const { drug, protocol, dose, weightKg } = opts;
  const proto = drug.protocols[protocol];
  const conc = proto.ampMg / proto.diluentMl; // mg/mL

  // Convert dose → mg/h
  let mgPerHour = 0;
  let totalPerMin = 0;
  let totalLabel = "";
  switch (drug.doseUnit) {
    case "mcg/kg/min":
      totalPerMin = dose * weightKg;       // mcg/min
      mgPerHour = (totalPerMin * 60) / 1000;
      totalLabel = `${totalPerMin.toFixed(1)} mcg/min`;
      break;
    case "mcg/min":
      totalPerMin = dose;
      mgPerHour = (dose * 60) / 1000;
      totalLabel = `${dose.toFixed(1)} mcg/min`;
      break;
    case "mg/kg/h":
      mgPerHour = dose * weightKg;
      totalPerMin = mgPerHour / 60;
      totalLabel = `${mgPerHour.toFixed(2)} mg/h`;
      break;
    case "mg/h":
      mgPerHour = dose;
      totalPerMin = dose / 60;
      totalLabel = `${dose.toFixed(1)} mg/h`;
      break;
    case "UI/h":
      // For UI-based drugs, concentration is "UI/mL". proto.ampMg holds UI here.
      mgPerHour = dose; // treat as UI/h
      totalPerMin = dose / 60;
      totalLabel = `${dose.toFixed(1)} UI/h`;
      break;
  }
  const mlPerHour = drug.doseUnit === "UI/h" ? dose / conc : mgPerHour / conc;

  let warning: string | undefined;
  if (dose > drug.max) warning = `Acima da dose máxima usual (${drug.max} ${drug.doseUnit}).`;
  if (dose < drug.min) warning = `Abaixo da dose mínima usual (${drug.min} ${drug.doseUnit}).`;

  return {
    concentrationMgPerMl: conc,
    mlPerHour,
    totalPerMin,
    totalLabel,
    doseLabel: `${dose} ${drug.doseUnit}`,
    protocolLabel: proto.name,
    warning,
  };
}

// ============================================================================
// PROCEDURES — catalog
// ============================================================================

export interface ProcedureDef {
  code: string;
  label: string;
  kind: "resp" | "neuro" | "stable" | "device" | "critical" | "nutri";
  icon: string;
}

export const PROCEDURES: ProcedureDef[] = [
  { code: "IOT",        label: "Intubação orotraqueal", kind: "resp",    icon: "🫁" },
  { code: "EXT",        label: "Extubação",             kind: "resp",    icon: "🫁" },
  { code: "VNI",        label: "Ventilação não invasiva", kind: "resp",  icon: "🫁" },
  { code: "TQT",        label: "Traqueostomia",         kind: "resp",    icon: "🫁" },
  { code: "CVC",        label: "Cateter venoso central",kind: "stable",  icon: "💉" },
  { code: "PAMI",       label: "PAM invasiva",          kind: "stable",  icon: "❤️" },
  { code: "SVD",        label: "Sonda vesical",         kind: "device",  icon: "💧" },
  { code: "SNE",        label: "Sonda nasoenteral",     kind: "nutri",   icon: "🍽" },
  { code: "CRRT",       label: "Hemodiálise contínua",  kind: "neuro",   icon: "🩸" },
  { code: "HD",         label: "Hemodiálise intermitente", kind: "neuro",icon: "🩸" },
  { code: "PIC",        label: "Monitor de PIC",        kind: "neuro",   icon: "🧠" },
  { code: "DVE",        label: "Derivação ventricular externa", kind: "neuro", icon: "🧠" },
  { code: "BRONCO",     label: "Broncoscopia",          kind: "resp",    icon: "🫁" },
  { code: "CVPP",       label: "Cardioversão",          kind: "critical",icon: "⚡" },
  { code: "TORACO",     label: "Toracocentese",         kind: "resp",    icon: "🫁" },
  { code: "PCR",        label: "PCR revertida",         kind: "critical",icon: "⚡" },
];

export const procedureByCode = (c: string) => PROCEDURES.find((p) => p.code === c);

// ============================================================================
// ESTADO ATUAL — generated from inputs + active meds
// ============================================================================

export interface EstadoLine {
  icon: string;
  sys: string;
  text: string;
  kind: "neuro" | "resp" | "stable" | "critical" | "attention" | "nutri" | "neutral";
  flag?: boolean;
}

export function generateEstadoAtual(p: Patient): EstadoLine[] {
  const s = p.state;
  const activeMeds = p.medications.filter((m) => m.active !== false);
  const atbs = activeMeds.filter((m) => /cef|mero|pip|vanco|cipro|levo|ampi|metro|linezo|polimi|tigec|ertap|amik|genta|sulb/i.test(m.name));
  const vasoActive = activeMeds.filter((m) => /nora|adrena|vaso|dobut|nitro/i.test(m.name));

  const lines: EstadoLine[] = [];
  lines.push({
    icon: "🧠",
    sys: "Neuro",
    text: `Glasgow ${s.glasgow} · RASS ${s.rass > 0 ? `+${s.rass}` : s.rass}`,
    kind: "neuro",
    flag: s.glasgow < 8,
  });
  lines.push({
    icon: "❤️",
    sys: "Hemo",
    text: vasoActive.length
      ? `PAM ${s.pam} · ${vasoActive.map((v) => `${v.name.split(" ")[0]} ${v.dose}`).join(" + ")}`
      : `PAM ${s.pam} · sem DVA`,
    kind: vasoActive.length ? "critical" : "stable",
    flag: s.pam < 65 || vasoActive.length > 0,
  });
  lines.push({
    icon: "🫁",
    sys: "Resp",
    text: `${s.vent}${s.fio2 > 21 ? ` · FiO₂ ${s.fio2}%` : ""}`,
    kind: "resp",
    flag: s.fio2 > 50,
  });
  lines.push({
    icon: "💧",
    sys: "Renal",
    text: s.diurese < 0.5 ? `Oligúria (${s.diurese.toFixed(1)} ml/kg/h)` : `Diurese ${s.diurese.toFixed(1)} ml/kg/h`,
    kind: s.diurese < 0.5 ? "attention" : "stable",
    flag: s.diurese < 0.5,
  });
  lines.push({
    icon: "🦠",
    sys: "Infec",
    text: s.infection
      ? `${s.infection}${atbs.length ? ` · ${atbs.map((a) => a.name).join(", ")}` : ""} · T ${s.temp}°`
      : atbs.length
      ? `ATB: ${atbs.map((a) => a.name).join(", ")} · T ${s.temp}°`
      : `Sem infecção ativa · T ${s.temp}°`,
    kind: s.infection ? "critical" : atbs.length ? "attention" : "stable",
    flag: !!s.infection || s.temp >= 38,
  });
  lines.push({
    icon: "🍽",
    sys: "Nutri",
    text: s.dieta,
    kind: "nutri",
  });

  return lines;
}

export function isMedActive(m: Medication): boolean {
  return m.active !== false;
}

// ============================================================================
// PATIENT METRICS — age & BMI
// ============================================================================

export function computeAge(birthISO?: string): number | null {
  if (!birthISO) return null;
  const b = new Date(birthISO);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--;
  return years;
}

export interface BMIInfo {
  value: number;
  label: string;
  className: string;
}

export function computeBMI(weightKg?: number, heightCm?: number): BMIInfo | null {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  const v = weightKg / (h * h);
  if (!Number.isFinite(v)) return null;
  let label = "Eutrófico";
  let className = "text-clinical-stable";
  if (v < 18.5) { label = "Baixo peso"; className = "text-clinical-attention"; }
  else if (v < 25) { label = "Eutrófico"; className = "text-clinical-stable"; }
  else if (v < 30) { label = "Sobrepeso"; className = "text-clinical-attention"; }
  else if (v < 35) { label = "Obesidade I"; className = "text-clinical-device"; }
  else if (v < 40) { label = "Obesidade II"; className = "text-clinical-device"; }
  else { label = "Obesidade III"; className = "text-clinical-critical"; }
  return { value: Math.round(v * 10) / 10, label, className };
}

/**
 * Clearance de creatinina por Cockcroft-Gault (mL/min).
 * Usa a creatinina mais recente (`exams` code "Creat"), idade (birthDate ou age),
 * peso e sexo. Null quando faltar dado.
 */
export function computeCrCl(p: Patient): { value: number; creat: number; ageYears: number; weightKg: number } | null {
  const row = (p.exams ?? []).find((e) => (e.code ?? e.label) === "Creat");
  if (!row) return null;
  const creat = row.valueNum ?? parseFloat(String(row.value).replace(",", "."));
  if (!Number.isFinite(creat) || creat <= 0) return null;
  const ageYears = computeAge(p.birthDate) ?? p.age;
  const weightKg = p.weight;
  if (!ageYears || !weightKg) return null;
  let v = ((140 - ageYears) * weightKg) / (72 * creat);
  if (p.sex === "F") v *= 0.85;
  if (!Number.isFinite(v) || v <= 0) return null;
  return { value: Math.round(v), creat, ageYears, weightKg };
}

/**
 * Parse an admission date entered as "dd/mm/yyyy", "yyyy-mm-dd" or ISO,
 * and return whole days elapsed since then (>=0). Null when unparseable.
 */
export function daysSinceAdmission(input?: string): number | null {
  if (!input) return null;
  const s = input.trim();
  let d: Date | null = null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, dd, mm, yy] = br;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    d = new Date(year, Number(mm) - 1, Number(dd));
  } else {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000);
}

// ============================================================================
// ANTIBIOTIC TRACKING
// ============================================================================

export const ATB_DEFAULT_DAYS: Record<string, number> = {
  meropenem: 14, "pip-tazo": 7, piperacilina: 7, tazocin: 7,
  vancomicina: 10, vanco: 10, linezolida: 10,
  ceftriaxona: 7, cefazolina: 7, cefepime: 10, cefoxitina: 7,
  ciprofloxacino: 7, levofloxacino: 7, metronidazol: 7,
  ampicilina: 10, sulbactam: 7, ertapenem: 7, polimixina: 14,
  tigeciclina: 10, amicacina: 7, gentamicina: 7, clindamicina: 7,
};

export function detectAntibiotic(name: string): boolean {
  return /cef|mero|pip|vanco|cipro|levo|ampi|metro|linezo|polimi|tigec|ertap|amik|genta|clinda|sulb|claritro|azitro/i.test(name);
}

export function antibioticDefaultDays(name: string): number {
  const key = name.toLowerCase();
  for (const k in ATB_DEFAULT_DAYS) {
    if (key.includes(k)) return ATB_DEFAULT_DAYS[k];
  }
  return 7;
}

export type AtbAlert = "ok" | "ending_48h" | "ending_24h" | "last_dose" | "overdue";

export interface AtbProgress {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  currentDay: number;
  percent: number;
  hoursLeft: number;
  alert: AtbAlert;
  dosesGiven?: number;
  plannedDoses?: number;
}

export function antibioticProgress(med: Medication): AtbProgress | null {
  if (!med.startISO) return null;
  const start = new Date(med.startISO);
  if (Number.isNaN(start.getTime())) return null;
  let end: Date;
  if (med.plannedEndISO) {
    end = new Date(med.plannedEndISO);
  } else {
    const days = antibioticDefaultDays(med.name);
    end = new Date(start.getTime() + days * 86400000);
  }
  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.round(totalMs / 86400000));
  const now = Date.now();
  const elapsedMs = now - start.getTime();
  const currentDay = Math.min(totalDays, Math.max(1, Math.ceil(elapsedMs / 86400000)));
  const percent = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const hoursLeft = (end.getTime() - now) / 3600000;

  let alert: AtbAlert = "ok";
  if (hoursLeft < 0) alert = "overdue";
  else if (hoursLeft <= 6) alert = "last_dose";
  else if (hoursLeft <= 24) alert = "ending_24h";
  else if (hoursLeft <= 48) alert = "ending_48h";

  return {
    startDate: start, endDate: end, totalDays, currentDay, percent, hoursLeft, alert,
    dosesGiven: med.dosesGiven, plannedDoses: med.plannedDoses,
  };
}

export function atbAlertBadge(a: AtbAlert): { icon: string; label: string; className: string } | null {
  switch (a) {
    case "ending_48h": return { icon: "🟡", label: "Termina em 48h", className: "text-clinical-attention" };
    case "ending_24h": return { icon: "🟠", label: "Termina em 24h", className: "text-clinical-device" };
    case "last_dose":  return { icon: "🔴", label: "Última dose", className: "text-clinical-critical" };
    case "overdue":    return { icon: "🔴", label: "Curso encerrado", className: "text-clinical-critical" };
    case "ok": return null;
  }
}

// ============================================================================
// INVASIVE DEVICE RISK
// ============================================================================

import type { InvasiveDevice } from "@/data/patients";
import { deviceTypeByCode, deviceSemaphore } from "@/data/devices";

export type DeviceRiskLevel = "green" | "yellow" | "orange" | "red";

export interface DeviceRisk {
  days: number;
  hours: number;
  max: number;
  percent: number;
  level: DeviceRiskLevel;
  icon: string;
  label: string;
  className: string;
  /** Texto do semáforo específico do dispositivo, quando houver. */
  semaphoreHint?: string;
}

export function deviceRisk(d: InvasiveDevice): DeviceRisk {
  const def = deviceTypeByCode(d.typeCode);
  const sem = deviceSemaphore(d.typeCode);
  const inserted = new Date(d.lastCannulaChangeAt ?? d.insertedAt).getTime();
  const ref = d.removedAt ? new Date(d.removedAt).getTime() : Date.now();
  const hours = Math.max(0, (ref - inserted) / 3600000);
  const days = hours / 24;

  const icons: Record<DeviceRiskLevel, string> = { green: "🟢", yellow: "🟡", orange: "🟠", red: "🔴" };
  const classes: Record<DeviceRiskLevel, string> = {
    green: "text-clinical-stable",
    yellow: "text-clinical-attention",
    orange: "text-clinical-device",
    red: "text-clinical-critical",
  };

  // Semáforo específico por dispositivo (faixas em dias completos)
  if (sem) {
    const full = Math.floor(days);
    const redAt = sem.yellowMax + 1;
    const level: DeviceRiskLevel =
      full <= sem.greenMax ? "green" : full <= sem.yellowMax ? "yellow" : "red";
    const labels: Record<DeviceRiskLevel, string> = {
      green: `Dentro do prazo (0–${sem.greenMax}d)`,
      yellow: `Reavaliar (${sem.greenMax + 1}–${sem.yellowMax}d)`,
      orange: "Reavaliar",
      red: `Reavaliação prioritária (≥${redAt}d)`,
    };
    return {
      days, hours,
      max: sem.yellowMax,
      percent: Math.min(999, (days / redAt) * 100),
      level, icon: icons[level], label: labels[level], className: classes[level],
      semaphoreHint: `🟢 0–${sem.greenMax}d · 🟡 ${sem.greenMax + 1}–${sem.yellowMax}d · 🔴 ≥${redAt}d (alerta de reavaliação, não de retirada obrigatória)`,
    };
  }

  const max = d.recommendedMaxDays ?? def?.recommendedMaxDays ?? 7;
  const percent = (days / max) * 100;
  let level: DeviceRiskLevel = "green";
  if (percent >= 100) level = "red";
  else if (percent >= 80) level = "orange";
  else if (percent >= 50) level = "yellow";
  const labels: Record<DeviceRiskLevel, string> = {
    green: "Recente",
    yellow: "Atenção (>50%)",
    orange: "Avaliar troca (>80%)",
    red: "Trocar / reavaliar",
  };
  return {
    days, hours, max, percent: Math.min(999, percent),
    level, icon: icons[level], label: labels[level], className: classes[level],
  };
}


export function formatDeviceDays(d: InvasiveDevice): string {
  const r = deviceRisk(d);
  if (r.hours < 24) return `há ${Math.max(1, Math.round(r.hours))}h`;
  const days = Math.floor(r.days);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}


// ============================================================================
// PUMP INFUSION — bag remaining, dilution library, AI therapy suggestions
// ============================================================================

import type { PumpCategory, PumpInfusion, SolventType } from "@/data/patients";

export const SOLVENTS: SolventType[] = ["SF 0,9%", "SG 5%", "Água destilada", "Outra"];

export function pumpCategoryOf(med: Medication): PumpCategory {
  if (med.category) return med.category;
  if (med.isAntibiotic ?? detectAntibiotic(med.name)) return "antimicrobiano";
  const d = drugByName(med.name);
  if (d) {
    if (d.category === "vasoativa") return "vasoativa";
    if (d.category === "sedativo") return "sedativo";
    if (d.category === "analgesico") return "analgesico";
    if (d.category === "atb") return "antimicrobiano";
  }
  if (/insulin/i.test(med.name)) return "insulina";
  if (/sf|sg|ringer|soro|hidrat/i.test(med.name)) return "hidratacao";
  return "outro";
}

export const PUMP_CATEGORY_META: Record<PumpCategory, { icon: string; label: string; className: string; dotClass: string }> = {
  vasoativa:      { icon: "🔴", label: "Vasoativa",     className: "text-clinical-critical", dotClass: "bg-clinical-critical" },
  sedativo:       { icon: "🟣", label: "Sedativo",      className: "text-clinical-neuro",    dotClass: "bg-clinical-neuro" },
  analgesico:     { icon: "🟣", label: "Analgésico",    className: "text-clinical-neuro",    dotClass: "bg-clinical-neuro" },
  antimicrobiano: { icon: "🟢", label: "Antimicrobiano",className: "text-clinical-stable",   dotClass: "bg-clinical-stable" },
  insulina:       { icon: "🟡", label: "Insulina",      className: "text-clinical-attention",dotClass: "bg-clinical-attention" },
  hidratacao:     { icon: "⚪", label: "Hidratação",    className: "text-clinical-neutral",  dotClass: "bg-clinical-neutral" },
  outro:          { icon: "⚪", label: "Outro",         className: "text-clinical-neutral",  dotClass: "bg-clinical-neutral" },
};

// Dilution library view over DRUGS
export const DILUTION_LIBRARY = DRUGS.reduce<Record<string, Record<"Geral" | "Neuro" | "Cardio", { amountMg: number; volumeMl: number; solvent: SolventType; label: string }>>>((acc, d) => {
  acc[d.name] = {
    Geral:  { amountMg: d.protocols.Geral.ampMg,  volumeMl: d.protocols.Geral.diluentMl,  solvent: "SF 0,9%", label: d.protocols.Geral.name },
    Neuro:  { amountMg: d.protocols.Neuro.ampMg,  volumeMl: d.protocols.Neuro.diluentMl,  solvent: "SF 0,9%", label: d.protocols.Neuro.name },
    Cardio: { amountMg: d.protocols.Cardio.ampMg, volumeMl: d.protocols.Cardio.diluentMl, solvent: "SG 5%",   label: d.protocols.Cardio.name },
  };
  return acc;
}, {});

export function computeConcentrationMcgPerMl(drugAmountMg: number, finalVolumeMl: number): number {
  if (!drugAmountMg || !finalVolumeMl) return 0;
  return (drugAmountMg * 1000) / finalVolumeMl;
}

export type BagAlert = "ok" | "low_2h" | "low_1h" | "low_30min" | "empty";

export interface BagRemaining {
  remainingMl: number;
  remainingMin: number;
  endsAt: Date | null;
  percent: number;
  alert: BagAlert;
}

export function computeBagRemaining(pump: PumpInfusion, nowMs: number = Date.now()): BagRemaining | null {
  const start = pump.bagStartedAt ? new Date(pump.bagStartedAt).getTime() : null;
  const rate = pump.rateMlPerHour;
  const bag = pump.bagVolumeMl ?? pump.finalVolumeMl;
  if (!start || !rate || !bag) return null;
  const elapsedHours = Math.max(0, (nowMs - start) / 3600000);
  const consumed = elapsedHours * rate;
  const remainingMl = Math.max(0, bag - consumed);
  const remainingMin = rate > 0 ? (remainingMl / rate) * 60 : 0;
  const endsAt = remainingMl > 0 ? new Date(nowMs + remainingMin * 60000) : null;
  let alert: BagAlert = "ok";
  if (remainingMl <= 0) alert = "empty";
  else if (remainingMin <= 30) alert = "low_30min";
  else if (remainingMin <= 60) alert = "low_1h";
  else if (remainingMin <= 120) alert = "low_2h";
  return { remainingMl, remainingMin, endsAt, percent: Math.min(100, (consumed / bag) * 100), alert };
}

export function bagAlertBadge(a: BagAlert): { icon: string; label: string; className: string; borderClass: string } {
  switch (a) {
    case "low_2h":   return { icon: "🟡", label: "Restam 2 horas",  className: "text-clinical-attention", borderClass: "border-clinical-attention/60" };
    case "low_1h":   return { icon: "🟠", label: "Resta 1 hora",    className: "text-clinical-device",    borderClass: "border-clinical-device/60" };
    case "low_30min":return { icon: "🔴", label: "Restam 30 min",   className: "text-clinical-critical",  borderClass: "border-clinical-critical/70" };
    case "empty":    return { icon: "⛔", label: "Bolsa finalizada",className: "text-clinical-critical",  borderClass: "border-clinical-critical" };
    case "ok":       return { icon: "🟢", label: "OK",              className: "text-clinical-stable",    borderClass: "border-border" };
  }
}

// ============================================================================
// AI THERAPY SUGGESTIONS — rule-based (no LLM)
// ============================================================================

export interface TherapySuggestion {
  icon: string;
  title: string;
  rationale: string;
  severity: "info" | "attention" | "critical";
}

export function aiTherapySuggestions(p: Patient): TherapySuggestion[] {
  const out: TherapySuggestion[] = [];
  const s = p.state;
  const active = p.medications.filter((m) => m.active !== false);
  const vaso = active.filter((m) => pumpCategoryOf(m) === "vasoativa");
  const hasNora = vaso.some((m) => /nora/i.test(m.name));

  if (s.pam < 65 && vaso.length) {
    out.push({ icon: "↑", severity: "critical",
      title: "Considerar AUMENTO de noradrenalina",
      rationale: `PAM ${s.pam} mmHg abaixo da meta (≥65). Avaliar resposta volêmica e titular vasopressor.` });
  }
  if (s.pam < 65 && !vaso.length) {
    out.push({ icon: "+", severity: "critical",
      title: "Iniciar suporte vasopressor",
      rationale: `PAM ${s.pam} mmHg sem DVA. Considerar noradrenalina após ressuscitação volêmica.` });
  }
  if (s.pam > 95 && hasNora) {
    out.push({ icon: "↓", severity: "attention",
      title: "Considerar REDUÇÃO da noradrenalina",
      rationale: `PAM ${s.pam} mmHg acima do alvo — iniciar desmame de vasopressor.` });
  }
  if (s.diurese < 0.5) {
    out.push({ icon: "💧", severity: "attention",
      title: "Avaliar volume / diurético",
      rationale: `Diurese ${s.diurese.toFixed(1)} ml/kg/h. Investigar hipovolemia, congestão ou LRA.` });
  }
  const lactato = p.exams.find((e) => /lactato/i.test(e.label));
  if (lactato && hasNora) {
    const ins = examInsight(lactato, p.sex);
    if (ins.trend === "improving") {
      out.push({ icon: "↓", severity: "info",
        title: "Considerar desmame de noradrenalina",
        rationale: `Lactato em queda (${lactato.value}) + PAM ${s.pam} sustentada.` });
    }
    if (ins.trend === "worsening") {
      out.push({ icon: "!", severity: "critical",
        title: "Reavaliar perfusão tecidual",
        rationale: `Lactato em elevação (${lactato.value}) apesar de vasopressor. Avaliar débito cardíaco / foco.` });
    }
  }
  if (s.fio2 > 60) {
    out.push({ icon: "🫁", severity: "attention",
      title: "Otimizar ventilação",
      rationale: `FiO₂ ${s.fio2}% elevada. Reavaliar PEEP, recrutamento e prono.` });
  }
  if (s.temp >= 38.5) {
    out.push({ icon: "🌡", severity: "attention",
      title: "Investigar foco de infecção",
      rationale: `Tax ${s.temp}°C — coletar culturas e reavaliar cobertura antimicrobiana.` });
  }
  for (const m of active) {
    const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
    if (!isAtb) continue;
    const prog = antibioticProgress(m);
    if (prog && (prog.alert === "ending_24h" || prog.alert === "last_dose")) {
      out.push({ icon: "💊", severity: "attention",
        title: `${m.name}: revisar conduta antes do término`,
        rationale: `Curso ${prog.currentDay}/${prog.totalDays} dias. Decidir suspensão, descalonamento ou prorrogação.` });
    }
  }
  if (!out.length) {
    out.push({ icon: "✓", severity: "info",
      title: "Sem ajustes sugeridos no momento",
      rationale: "Parâmetros dentro dos alvos clínicos esperados." });
  }
  return out;
}

// ============================================================================
// Fever / hyperthermia
// ============================================================================

export type FeverLevel = "normal" | "febricula" | "febril" | "hipertermia";

export function feverStatus(tempC: number | undefined | null): {
  level: FeverLevel; label: string; icon: string; className: string; pulse: boolean;
} {
  const t = typeof tempC === "number" ? tempC : NaN;
  if (!Number.isFinite(t) || t < 37.3) {
    return { level: "normal", label: "Afebril", icon: "🌡", className: "text-clinical-stable", pulse: false };
  }
  if (t < 37.8) {
    return { level: "febricula", label: "Febrícula", icon: "🌡", className: "text-clinical-attention", pulse: false };
  }
  if (t < 39.0) {
    return { level: "febril", label: "Febril", icon: "🌡", className: "text-clinical-device", pulse: false };
  }
  return { level: "hipertermia", label: "Hipertermia", icon: "🔥", className: "text-clinical-critical", pulse: true };
}

// ============================================================================
// MEDICATION CLASSIFICATION — column 4 grouping
// ============================================================================

export const MEDICATION_CLASS_META: Record<MedicationClass, { label: string; short: string; icon: string; className: string; bgClass: string; borderClass: string }> = {
  antibiotic: { label: "Antibióticos",   short: "ATB",         icon: "💊", className: "text-clinical-attention", bgClass: "bg-clinical-attention/10", borderClass: "border-clinical-attention/40" },
  pump:       { label: "Bomba",          short: "Bomba",       icon: "🩸", className: "text-clinical-critical",  bgClass: "bg-clinical-critical/10",  borderClass: "border-clinical-critical/40" },
  hydration:  { label: "Hidratação",     short: "Hidrat.",     icon: "💧", className: "text-clinical-resp",      bgClass: "bg-clinical-resp/10",      borderClass: "border-clinical-resp/40" },
  iv:         { label: "Venoso",         short: "EV",          icon: "💉", className: "text-clinical-resp",      bgClass: "bg-clinical-resp/10",      borderClass: "border-clinical-resp/40" },
  im:         { label: "Intramuscular",  short: "IM",          icon: "💪", className: "text-clinical-device",    bgClass: "bg-clinical-device/10",    borderClass: "border-clinical-device/40" },
  sc:         { label: "Subcutâneo",     short: "SC",          icon: "🩹", className: "text-clinical-stable",    bgClass: "bg-clinical-stable/10",    borderClass: "border-clinical-stable/40" },
  oral:       { label: "Oral/Enteral",   short: "VO/Ent.",     icon: "🍽", className: "text-clinical-nutri",     bgClass: "bg-clinical-nutri/10",     borderClass: "border-clinical-nutri/40" },
  inhaled:    { label: "Inalatório",     short: "Inal.",       icon: "🫁", className: "text-clinical-resp",      bgClass: "bg-clinical-resp/10",      borderClass: "border-clinical-resp/40" },
  topical:    { label: "Tópico",         short: "Tóp.",        icon: "🧴", className: "text-clinical-neutral",   bgClass: "bg-clinical-neutral/10",   borderClass: "border-clinical-neutral/40" },
};

export const MEDICATION_CLASS_ORDER: MedicationClass[] = [
  "antibiotic", "pump", "hydration", "iv", "im", "sc", "oral", "inhaled", "topical",
];

/** Resolve a medication class from explicit field or from route/isAntibiotic/pump heuristics. */
export function medClassOf(m: Medication): MedicationClass {
  if (m.class) return m.class;
  if (m.isAntibiotic ?? detectAntibiotic(m.name)) return "antibiotic";
  if (m.pump || m.mlPerHour !== undefined || /BIC/i.test(m.freq ?? "")) return "pump";
  if (/soro|ringer|salina|solu[çc][ãa]o balanceada|plasmalyte/i.test(m.name)) return "hydration";
  const r = (m.route ?? "").toLowerCase();
  if (/inal|neb/.test(r)) return "inhaled";
  if (/top|derm/.test(r)) return "topical";
  if (/sc|subc/.test(r)) return "sc";
  if (/im|intram/.test(r)) return "im";
  if (/vo|oral|sne|snd|enter|gt|gtn/.test(r)) return "oral";
  if (/ev|iv|intraven/.test(r)) return "iv";
  return "iv";
}

// ============================================================================
// BRISTOL STOOL SCALE
// ============================================================================

export const BRISTOL: { value: 1 | 2 | 3 | 4 | 5 | 6 | 7; label: string; hint: string; color: string; className: string }[] = [
  { value: 1, label: "Tipo 1", hint: "Bolinhas duras separadas — constipação grave",  color: "#6b4a2b", className: "text-clinical-critical" },
  { value: 2, label: "Tipo 2", hint: "Salsicha grumosa — constipação",                 color: "#8b5a2b", className: "text-clinical-device" },
  { value: 3, label: "Tipo 3", hint: "Salsicha com rachaduras — normal (firme)",       color: "#a67b3e", className: "text-clinical-attention" },
  { value: 4, label: "Tipo 4", hint: "Salsicha lisa — ideal",                          color: "#8f6a3c", className: "text-clinical-stable" },
  { value: 5, label: "Tipo 5", hint: "Pedaços macios com bordas nítidas",              color: "#a88551", className: "text-clinical-attention" },
  { value: 6, label: "Tipo 6", hint: "Fragmentos moles / pastoso — diarreia leve",     color: "#b28e5d", className: "text-clinical-device" },
  { value: 7, label: "Tipo 7", hint: "Líquido sem sólidos — diarreia grave",           color: "#c8a074", className: "text-clinical-critical" },
];

export function bristolMeta(n?: number | null) {
  if (!n) return null;
  return BRISTOL.find((b) => b.value === n) ?? null;
}

// ============================================================================
// FLUID BALANCE
// ============================================================================

export interface FluidBalanceSummary {
  totalIntake: number;
  totalOutput: number;
  totalDrains: number;
  totalDerivations: number;
  balance: number;   // intake − (output + drains + derivations)
}

const sumVol = (arr?: { volumeMl: number; unit?: string }[]) =>
  (arr ?? []).reduce((acc, e) => acc + (e.unit === "L" ? e.volumeMl * 1000 : e.volumeMl), 0);

export function computeFluidBalance(fb?: { intake?: FluidEntry[]; output?: FluidEntry[]; drains?: DrainEntry[]; derivations?: DerivationEntry[] }): FluidBalanceSummary {
  const totalIntake = sumVol(fb?.intake);
  const totalOutput = sumVol(fb?.output);
  const totalDrains = (fb?.drains ?? []).reduce((a, d) => a + (d.volumeMl || 0), 0);
  const totalDerivations = (fb?.derivations ?? []).reduce((a, d) => a + (d.volumeMl || 0), 0);
  return {
    totalIntake, totalOutput, totalDrains, totalDerivations,
    balance: totalIntake - totalOutput - totalDrains - totalDerivations,
  };
}

// ============================================================================
// CONDUCT SYSTEMS (used to color-code plan items in column 7)
// ============================================================================

export const CONDUCT_SYSTEM_META: Record<ConductSystem, { label: string; short: string; icon: string; className: string; bgClass: string; borderClass: string }> = {
  dieta:  { label: "Dieta",             short: "Dieta",  icon: "🍽", className: "text-clinical-nutri",     bgClass: "bg-clinical-nutri/10",     borderClass: "border-clinical-nutri/50" },
  fono:   { label: "Fonoterapia",       short: "Fono",   icon: "🗣", className: "text-clinical-neuro",     bgClass: "bg-clinical-neuro/10",     borderClass: "border-clinical-neuro/50" },
  gi:     { label: "Digestivo",         short: "Digest", icon: "🥄", className: "text-clinical-nutri",     bgClass: "bg-clinical-nutri/10",     borderClass: "border-clinical-nutri/50" },
  neuro:  { label: "Sistema nervoso central", short: "SNC", icon: "🧠", className: "text-clinical-neuro",  bgClass: "bg-clinical-neuro/10",     borderClass: "border-clinical-neuro/50" },
  cardio: { label: "Cardiovascular",    short: "Cardio", icon: "❤️", className: "text-clinical-critical",  bgClass: "bg-clinical-critical/10",  borderClass: "border-clinical-critical/50" },
  resp:   { label: "Respiratório",      short: "Resp",   icon: "🫁", className: "text-clinical-resp",      bgClass: "bg-clinical-resp/10",      borderClass: "border-clinical-resp/50" },
  renal:  { label: "Renal/Metabólico",  short: "Renal",  icon: "💧", className: "text-clinical-attention", bgClass: "bg-clinical-attention/10", borderClass: "border-clinical-attention/50" },
  infec:  { label: "Sepse/Infecção",    short: "Infec",  icon: "🦠", className: "text-clinical-device",    bgClass: "bg-clinical-device/10",    borderClass: "border-clinical-device/50" },
  hemato: { label: "Hematológico",      short: "Hemato", icon: "🩸", className: "text-clinical-critical",  bgClass: "bg-clinical-critical/10",  borderClass: "border-clinical-critical/50" },
  skin:   { label: "Pele/Fâneros/Mucosa", short: "Pele", icon: "🩹", className: "text-clinical-attention", bgClass: "bg-clinical-attention/10", borderClass: "border-clinical-attention/50" },
  other:  { label: "Outros",            short: "Outros", icon: "•",  className: "text-clinical-neutral",   bgClass: "bg-clinical-neutral/10",   borderClass: "border-clinical-neutral/40" },
};

export const CONDUCT_SYSTEM_ORDER: ConductSystem[] = [
  "dieta", "fono", "gi", "neuro", "cardio", "resp", "renal", "infec", "hemato", "skin", "other",
];

// ============================================================================
// ANNOTATION COLORS — cores para texto das anotações (item 7 — Plano)
// ============================================================================

export const ANNOTATION_COLOR_META: Record<AnnotationColor, { label: string; textClass: string; swatch: string }> = {
  default: { label: "Padrão", textClass: "",                       swatch: "#94a3b8" },
  green:   { label: "Verde",  textClass: "text-emerald-600 dark:text-emerald-400",  swatch: "#10b981" },
  yellow:  { label: "Amarelo",textClass: "text-yellow-600 dark:text-yellow-400",    swatch: "#eab308" },
  orange:  { label: "Laranja",textClass: "text-orange-600 dark:text-orange-400",    swatch: "#f97316" },
  red:     { label: "Vermelho",textClass:"text-red-800 dark:text-red-500",          swatch: "#991b1b" },
  teal:    { label: "Turquesa",textClass:"text-teal-500 dark:text-teal-300",        swatch: "#14b8a6" },
  purple:  { label: "Roxo",   textClass: "text-purple-600 dark:text-purple-400",    swatch: "#a855f7" },
};

export const ANNOTATION_COLOR_ORDER: AnnotationColor[] = [
  "default", "green", "yellow", "orange", "red", "teal", "purple",
];

/** Formata YYYY-MM-DD (input type=date) evitando o shift de fuso horário. */
export function formatDateBR(input?: string): string {
  if (!input) return "";
  // Se veio como YYYY-MM-DD puro, monta como data local.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;
  return dt.toLocaleDateString("pt-BR");
}

/** Rótulos de doação de órgãos */
export const organDonationLabel: Record<NonNullable<Patient["organDonation"]>, string> = {
  yes: "Doador",
  no: "Não doador",
  family: "A decidir com a família",
  unknown: "Não informado",
};

/** Rótulo curto de diretriz antecipada (ex.: "Entubar: não") */
export function directiveLabel(value: "allow" | "refuse" | "unknown" | undefined, topic: string): string {
  if (value === "allow") return `${topic}: sim`;
  if (value === "refuse") return `${topic}: não`;
  return `${topic}: n/i`;
}
