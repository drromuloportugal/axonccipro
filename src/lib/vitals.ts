// Classificação de parâmetros vitais com causas e condutas iniciais.
// Cores: verde = normal, amarelo = atenção, vermelho = crítico.

export type VitalLevel = "normal" | "attention" | "critical";

export interface VitalAssessment {
  key: string;
  label: string;
  icon: string;
  value: number | null;
  unit: string;
  level: VitalLevel;
  reference: string;
  causes: string[];
  actions: string[];
}

const LEVEL_COLOR: Record<VitalLevel, string> = {
  normal: "text-clinical-stable",
  attention: "text-clinical-attention",
  critical: "text-clinical-critical",
};
const LEVEL_BG: Record<VitalLevel, string> = {
  normal: "border-clinical-stable/30 bg-clinical-stable/5",
  attention: "border-clinical-attention/40 bg-clinical-attention/10",
  critical: "border-clinical-critical/40 bg-clinical-critical/10",
};
const LEVEL_DOT: Record<VitalLevel, string> = {
  normal: "bg-clinical-stable",
  attention: "bg-clinical-attention",
  critical: "bg-clinical-critical",
};
const LEVEL_LABEL: Record<VitalLevel, string> = {
  normal: "Normal",
  attention: "Atenção",
  critical: "Crítico",
};

export function levelColor(l: VitalLevel) { return LEVEL_COLOR[l]; }
export function levelBg(l: VitalLevel) { return LEVEL_BG[l]; }
export function levelDot(l: VitalLevel) { return LEVEL_DOT[l]; }
export function levelLabel(l: VitalLevel) { return LEVEL_LABEL[l]; }

function band(v: number | null, normal: [number, number], critOut: [number, number]): VitalLevel {
  if (v == null || Number.isNaN(v)) return "normal";
  if (v < critOut[0] || v > critOut[1]) return "critical";
  if (v < normal[0] || v > normal[1]) return "attention";
  return "normal";
}

export interface VitalInput {
  fcMax?: number;
  fr?: number;
  pam?: number;
  tempMax?: number;
  spo2?: number;
  glicemia?: number;
  diureseHoraria?: number; // mL/kg/h
  balancoHidrico?: number; // mL (24h)
  weightKg?: number;
}

export function assessVitals(v: VitalInput): VitalAssessment[] {
  const out: VitalAssessment[] = [];

  // FC max
  {
    const val = v.fcMax ?? null;
    const level = band(val, [60, 100], [40, 140]);
    out.push({
      key: "fc", label: "FC máx", icon: "", value: val, unit: "bpm", level,
      reference: "60–100 bpm",
      causes: ["Dor, agitação, ansiedade", "Hipovolemia, sepse, febre", "Hipoxemia, BAV, IAM"],
      actions: ["ECG 12 derivações", "Avaliar volemia e perfusão", "Reavaliar sedação/analgesia"],
    });
  }
  // FR
  {
    const val = v.fr ?? null;
    const level = band(val, [12, 20], [8, 30]);
    out.push({
      key: "fr", label: "FR", icon: "", value: val, unit: "ipm", level,
      reference: "12–20 ipm",
      causes: ["Acidose metabólica, sepse", "Dor, ansiedade, hipoxemia", "Sedação excessiva, fadiga muscular"],
      actions: ["Gasometria arterial", "SpO₂ contínua", "Reavaliar parâmetros de VM"],
    });
  }
  // PAM
  {
    const val = v.pam ?? null;
    const level = band(val, [65, 100], [55, 120]);
    out.push({
      key: "pam", label: "PAM", icon: "", value: val, unit: "mmHg", level,
      reference: "65–100 mmHg",
      causes: ["Choque (séptico/cardiogênico/hipovolêmico)", "DVA inadequada, sedação profunda", "Crise hipertensiva, dor"],
      actions: ["Reposição volêmica guiada", "Titular DVA (alvo PAM ≥65)", "Avaliar lactato e perfusão"],
    });
  }
  // Temp max
  {
    const val = v.tempMax ?? null;
    let level: VitalLevel = "normal";
    if (val != null) {
      if (val >= 39 || val < 35) level = "critical";
      else if (val >= 37.8 || val < 36) level = "attention";
    }
    out.push({
      key: "temp", label: "Temp máx", icon: "", value: val, unit: "°C", level,
      reference: "36,0–37,7 °C",
      causes: ["Infecção / sepse", "Reação medicamentosa, transfusional", "Hipotermia: exposição, choque"],
      actions: ["Coletar culturas antes de ATB", "Antitérmico se desconforto", "Reaquecimento ativo se hipotermia"],
    });
  }
  // SpO2
  {
    const val = v.spo2 ?? null;
    let level: VitalLevel = "normal";
    if (val != null) {
      if (val < 90) level = "critical";
      else if (val < 95) level = "attention";
    }
    out.push({
      key: "spo2", label: "SpO₂", icon: "", value: val, unit: "%", level,
      reference: "≥ 95%",
      causes: ["Atelectasia, broncoespasmo, PNM", "TEP, edema pulmonar", "Extubação acidental, deslocamento TOT"],
      actions: ["Aumentar FiO₂ / PEEP", "Aspiração de vias aéreas", "Radiografia / gasometria"],
    });
  }
  // Glicemia
  {
    const val = v.glicemia ?? null;
    let level: VitalLevel = "normal";
    if (val != null) {
      if (val < 60 || val > 250) level = "critical";
      else if (val < 70 || val > 180) level = "attention";
    }
    out.push({
      key: "glic", label: "Glicemia", icon: "", value: val, unit: "mg/dL", level,
      reference: "70–180 mg/dL",
      causes: ["Sepse, corticoide, NPT", "Insulina excessiva, jejum prolongado", "DM descompensado"],
      actions: ["HGT seriado 4/4h", "Ajustar bomba de insulina", "Glicose 50% se hipoglicemia"],
    });
  }
  // Diurese horária mL/kg/h
  {
    const val = v.diureseHoraria ?? null;
    let level: VitalLevel = "normal";
    if (val != null) {
      if (val < 0.3) level = "critical";
      else if (val < 0.5) level = "attention";
    }
    out.push({
      key: "diur", label: "Diurese", icon: "", value: val, unit: "mL/kg/h", level,
      reference: "≥ 0,5 mL/kg/h",
      causes: ["Hipovolemia, choque", "LRA, obstrução de SVD", "Síndrome hepatorrenal"],
      actions: ["Checar permeabilidade SVD", "Prova volêmica orientada", "Avaliar função renal / USG"],
    });
  }
  // Balanço hídrico (24h)
  {
    const val = v.balancoHidrico ?? null;
    let level: VitalLevel = "normal";
    if (val != null) {
      if (val > 2000 || val < -1500) level = "critical";
      else if (val > 1000 || val < -500) level = "attention";
    }
    out.push({
      key: "bh", label: "Balanço hídrico", icon: "", value: val, unit: "mL/24h", level,
      reference: "−500 a +1000 mL",
      causes: ["Ressuscitação volêmica, IRA oligúrica", "Diurético excessivo, perdas insensíveis", "Sangramento, drenagens"],
      actions: ["Reavaliar oferta hídrica", "Diurético se hipervolemia sintomática", "Reposição se hipovolemia"],
    });
  }

  return out;
}

export function formatVitalValue(a: VitalAssessment): string {
  if (a.value == null || Number.isNaN(a.value)) return "—";
  if (a.key === "diur") return a.value.toFixed(2);
  if (a.key === "temp") return a.value.toFixed(1);
  if (a.key === "bh") return (a.value > 0 ? "+" : "") + Math.round(a.value).toString();
  return Math.round(a.value).toString();
}
