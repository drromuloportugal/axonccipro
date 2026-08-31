// Catalog of invasive devices used in ICU.
// Drives the structured "Dispositivos invasivos" sub-form, anatomical markers,
// risk-by-time badges and the infection-risk score.

import type { InvasiveDevice, Patient } from "./patients";

export type DeviceCategory =
  | "venous_peripheral"
  | "venous_central"
  | "arterial"
  | "airway"
  | "ventilation"
  | "enteral"
  | "urinary"
  | "neuro"
  | "advanced"
  | "ostomy"
  | "drain";

export type RiskWeight = 1 | 2 | 3 | 4; // 1 baixo · 2 moderado · 3 alto · 4 muito alto

export interface DeviceTypeDef {
  code: string;
  label: string;
  icon: string;
  category: DeviceCategory;
  sites: string[];               // anatomical sites
  needsSide?: boolean;
  needsLumens?: boolean;         // CVCs
  needsSize?: boolean;           // tube number, French
  sizeLabel?: string;            // "Nº tubo", "Fr", "Vias"
  recommendedMaxDays: number;    // for risk-by-time badge
  notesLabel?: string;           // contextual extra note label
  /** Intrinsic infection-risk weight (independent of dwell time). */
  riskWeight: RiskWeight;
  /** Convenience: indicação clínica sugerida. */
  defaultIndication?: string;
}

export const DEVICE_CATEGORIES: { code: DeviceCategory; label: string; icon: string }[] = [
  { code: "venous_peripheral", label: "Acesso venoso periférico", icon: "" },
  { code: "venous_central", label: "Acesso venoso central", icon: "" },
  { code: "arterial", label: "Cateter arterial", icon: "" },
  { code: "airway", label: "Via aérea", icon: "" },
  { code: "ventilation", label: "Ventilação / oxigenoterapia", icon: "" },
  { code: "enteral", label: "Nutrição", icon: "" },
  { code: "urinary", label: "Sistema urinário", icon: "" },
  { code: "neuro", label: "Neurocrítico", icon: "" },
  { code: "advanced", label: "Terapias avançadas", icon: "" },
  { code: "ostomy", label: "Estomia", icon: "" },
  { code: "drain", label: "Dreno", icon: "" },
];

export const DEVICE_TYPES: DeviceTypeDef[] = [
  // ── Acessos vasculares periféricos ───────────────────────────────────────
  {
    code: "PVP", label: "Cateter venoso periférico", icon: "", category: "venous_peripheral",
    sites: [
 "Dorso da mão D", "Dorso da mão E",
 "Antebraço D", "Antebraço E",
 "Fossa cubital D", "Fossa cubital E",
 "Braquial D", "Braquial E",
 "Jugular externa D", "Jugular externa E",
 "Dorso do pé D", "Dorso do pé E",
    ],
    needsSize: true, sizeLabel: "Gauge (Nº)", recommendedMaxDays: 4,
    notesLabel: "Aspecto / fixação", riskWeight: 1,
  },
  {
    code: "MIDLINE", label: "Midline", icon: "", category: "venous_peripheral",
    sites: ["Braquial D", "Braquial E", "Basílica D", "Basílica E", "Cefálica D", "Cefálica E"],
    needsSize: true, sizeLabel: "Calibre (Fr)", recommendedMaxDays: 14,
    notesLabel: "Curativo / refluxo", riskWeight: 2,
  },

  // ── Acessos vasculares centrais ──────────────────────────────────────────
  {
    code: "PICC", label: "PICC", icon: "", category: "venous_central",
    sites: ["Braquial D", "Braquial E", "Basílica D", "Basílica E", "Cefálica D", "Cefálica E"],
    needsLumens: true, recommendedMaxDays: 30, riskWeight: 2,
  },
  {
    code: "CVC_JUG", label: "CVC jugular", icon: "", category: "venous_central",
    sites: ["Jugular interna D", "Jugular interna E"],
    needsLumens: true, recommendedMaxDays: 7, notesLabel: "Curativo", riskWeight: 3,
  },
  {
    code: "CVC_SUB", label: "CVC subclávia", icon: "", category: "venous_central",
    sites: ["Subclávia D", "Subclávia E"],
    needsLumens: true, recommendedMaxDays: 7, notesLabel: "Curativo", riskWeight: 3,
  },
  {
    code: "CVC_FEM", label: "CVC femoral", icon: "", category: "venous_central",
    sites: ["Femoral D", "Femoral E"],
    needsLumens: true, recommendedMaxDays: 5, notesLabel: "Curativo", riskWeight: 4,
  },
  {
    code: "HD_CAT", label: "Cateter de hemodiálise", icon: "", category: "venous_central",
    sites: ["Jugular interna D", "Jugular interna E", "Subclávia D", "Subclávia E", "Femoral D", "Femoral E"],
    needsLumens: true, recommendedMaxDays: 21, notesLabel: "Fluxo / heparinização", riskWeight: 4,
  },
  {
    code: "SWAN", label: "Cateter de artéria pulmonar (Swan-Ganz)", icon: "", category: "venous_central",
    sites: ["Jugular interna D", "Jugular interna E", "Subclávia D", "Subclávia E", "Femoral D", "Femoral E"],
    needsLumens: true, recommendedMaxDays: 4, notesLabel: "Posição / introdutor", riskWeight: 4,
  },
  {
    code: "PORT", label: "Port-a-cath", icon: "", category: "venous_central",
    sites: ["Subclavicular D", "Subclavicular E"],
    needsLumens: true, recommendedMaxDays: 365, notesLabel: "Agulha / pele", riskWeight: 2,
  },

  // ── Cateteres arteriais ──────────────────────────────────────────────────
  {
    code: "PAI_RAD", label: "PAM invasiva — radial", icon: "", category: "arterial",
    sites: ["Radial D", "Radial E"], recommendedMaxDays: 7, riskWeight: 2,
  },
  {
    code: "PAI_FEM", label: "PAM invasiva — femoral", icon: "", category: "arterial",
    sites: ["Femoral D", "Femoral E"], recommendedMaxDays: 5, riskWeight: 3,
  },
  {
    code: "PAI_BRA", label: "PAM invasiva — braquial", icon: "", category: "arterial",
    sites: ["Braquial D", "Braquial E"], recommendedMaxDays: 5, riskWeight: 3,
  },
  {
    code: "PAI_PED", label: "PAM invasiva — pediosa", icon: "", category: "arterial",
    sites: ["Pediosa D", "Pediosa E"], recommendedMaxDays: 5, riskWeight: 2,
  },

  // ── Via aérea ───────────────────────────────────────────────────────────
  {
    code: "TOT", label: "Tubo orotraqueal", icon: "", category: "airway",
    sites: ["Oral"], needsSize: true, sizeLabel: "Nº tubo", recommendedMaxDays: 7,
    notesLabel: "Fixação (cm)", riskWeight: 4,
  },
  {
    code: "TNT", label: "Tubo nasotraqueal", icon: "", category: "airway",
    sites: ["Nasal D", "Nasal E"], needsSize: true, sizeLabel: "Nº tubo", recommendedMaxDays: 7,
    notesLabel: "Fixação (cm)", riskWeight: 4,
  },
  {
    code: "TQT", label: "Traqueostomia", icon: "", category: "airway",
    sites: ["Cirúrgica", "Percutânea"], needsSize: true, sizeLabel: "Nº cânula",
    recommendedMaxDays: 30, notesLabel: "Cuff / aspiração", riskWeight: 3,
  },

  // ── Ventilação / oxigenoterapia ─────────────────────────────────────────
  {
    code: "O2_NAS", label: "Cateter nasal de O₂", icon: "", category: "ventilation",
    sites: ["Nasal"], needsSize: true, sizeLabel: "Fluxo (L/min)",
    recommendedMaxDays: 30, notesLabel: "FiO₂ estimada", riskWeight: 1,
  },
  {
    code: "VENTURI", label: "Máscara de Venturi", icon: "", category: "ventilation",
    sites: ["Face"], needsSize: true, sizeLabel: "FiO₂ (%)",
    recommendedMaxDays: 7, notesLabel: "Fluxo (L/min)", riskWeight: 1,
  },
  {
    code: "MNRR", label: "Máscara não reinalante (reservatório)", icon: "", category: "ventilation",
    sites: ["Face"], needsSize: true, sizeLabel: "Fluxo (L/min)",
    recommendedMaxDays: 3, notesLabel: "SpO₂ alvo", riskWeight: 1,
  },
  {
    code: "CPAP", label: "CPAP (VNI)", icon: "", category: "ventilation",
    sites: ["Face", "Total facial", "Helmet"], needsSize: true, sizeLabel: "PEEP / FiO₂",
    recommendedMaxDays: 5, notesLabel: "Conforto / vazamentos", riskWeight: 2,
  },
  {
    code: "BIPAP", label: "BIPAP (VNI)", icon: "", category: "ventilation",
    sites: ["Face", "Total facial", "Helmet"], needsSize: true, sizeLabel: "IPAP/EPAP",
    recommendedMaxDays: 5, notesLabel: "Sincronia", riskWeight: 2,
  },
  {
    code: "VMI", label: "Ventilação mecânica invasiva", icon: "", category: "ventilation",
    sites: ["TOT", "TQT"], needsSize: true, sizeLabel: "Modo / PEEP / FiO₂",
    recommendedMaxDays: 7, notesLabel: "Parâmetros atuais", riskWeight: 4,
  },

  // ── Nutrição ────────────────────────────────────────────────────────────
  { code: "SNG", label: "Sonda nasogástrica", icon: "", category: "enteral",
    sites: ["Nasal D", "Nasal E"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 30, riskWeight: 2 },
  { code: "SNE", label: "Sonda nasoenteral", icon: "", category: "enteral",
    sites: ["Nasal D", "Nasal E"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 30, riskWeight: 2 },
  { code: "SOE", label: "Sonda oroenteral", icon: "", category: "enteral",
    sites: ["Oral"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 30, riskWeight: 2 },
  { code: "GTT", label: "Gastrostomia", icon: "", category: "enteral",
    sites: ["Abdome"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 180, notesLabel: "Pele periestoma", riskWeight: 2 },
  { code: "JTT", label: "Jejunostomia", icon: "", category: "enteral",
    sites: ["Abdome"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 180, notesLabel: "Pele periestoma", riskWeight: 2 },

  // ── Sistema urinário ────────────────────────────────────────────────────
  { code: "SVD", label: "Sonda vesical de demora", icon: "", category: "urinary",
    sites: ["Uretral", "Suprapúbica"], needsSize: true, sizeLabel: "Vias (2/3)",
    recommendedMaxDays: 14, riskWeight: 3 },
  { code: "SVA", label: "Sonda vesical de alívio", icon: "", category: "urinary",
    sites: ["Uretral"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 1, notesLabel: "Volume drenado", riskWeight: 1 },
  { code: "NEFRO", label: "Nefrostomia", icon: "", category: "urinary",
    sites: ["Flanco D", "Flanco E"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 90, notesLabel: "Débito / aspecto", riskWeight: 3 },
  { code: "CISTO", label: "Cistostomia", icon: "", category: "urinary",
    sites: ["Suprapúbica"], needsSize: true, sizeLabel: "Calibre (Fr)",
    recommendedMaxDays: 30, notesLabel: "Pele periestoma", riskWeight: 2 },

  // ── Drenos ──────────────────────────────────────────────────────────────
  { code: "DRT", label: "Dreno torácico", icon: "", category: "drain",
    sites: ["Hemitórax D", "Hemitórax E"], needsSide: true,
    recommendedMaxDays: 7, notesLabel: "Selo / aspiração / débito", riskWeight: 3 },
  { code: "PVAC", label: "Portovac", icon: "", category: "drain",
    sites: ["Cervical", "Abdome", "Tórax", "Outro"],
    recommendedMaxDays: 7, notesLabel: "Débito (mL/24h)", riskWeight: 2 },
  { code: "HVAC", label: "Hemovac", icon: "", category: "drain",
    sites: ["Cervical", "Abdome", "Tórax", "Outro"],
    recommendedMaxDays: 7, notesLabel: "Débito (mL/24h)", riskWeight: 2 },
  { code: "BLAKE", label: "Blake", icon: "", category: "drain",
    sites: ["Abdome", "Tórax", "Outro"],
    recommendedMaxDays: 7, notesLabel: "Débito (mL/24h)", riskWeight: 2 },
  { code: "JP", label: "Jackson-Pratt", icon: "", category: "drain",
    sites: ["Abdome", "Tórax", "Outro"],
    recommendedMaxDays: 7, notesLabel: "Débito (mL/24h)", riskWeight: 2 },
  { code: "PENROSE", label: "Penrose", icon: "", category: "drain",
    sites: ["Abdome", "Tórax", "Outro"],
    recommendedMaxDays: 5, notesLabel: "Aspecto", riskWeight: 2 },
  { code: "KEHR", label: "Kehr", icon: "", category: "drain",
    sites: ["Vias biliares"],
    recommendedMaxDays: 21, notesLabel: "Débito (mL/24h)", riskWeight: 2 },
  { code: "MEDIA", label: "Dreno mediastinal", icon: "", category: "drain",
    sites: ["Mediastino"],
    recommendedMaxDays: 5, notesLabel: "Débito (mL/24h)", riskWeight: 3 },
  { code: "PERIC", label: "Dreno pericárdico", icon: "", category: "drain",
    sites: ["Pericárdio"],
    recommendedMaxDays: 5, notesLabel: "Débito (mL/24h)", riskWeight: 3 },

  // ── Neurocrítico ────────────────────────────────────────────────────────
  { code: "DVE", label: "Derivação ventricular externa", icon: "", category: "neuro",
    sites: ["Frontal D", "Frontal E"], needsSide: true,
    recommendedMaxDays: 7, notesLabel: "Altura (cm H₂O)", riskWeight: 4 },
  { code: "DLE", label: "Derivação lombar externa", icon: "", category: "neuro",
    sites: ["Lombar"],
    recommendedMaxDays: 7, notesLabel: "Débito liquórico / altura", riskWeight: 4 },
  { code: "PICmon", label: "Monitor de PIC", icon: "", category: "neuro",
    sites: ["Parenquimatoso", "Intraventricular"],
    recommendedMaxDays: 7, notesLabel: "PIC atual", riskWeight: 3 },

  { code: "PBTO2", label: "Sensor PbtO₂", icon: "", category: "neuro",
    sites: ["Frontal D", "Frontal E"], needsSide: true,
    recommendedMaxDays: 7, notesLabel: "Valor (mmHg)", riskWeight: 3 },

  // ── Terapias avançadas ──────────────────────────────────────────────────
  { code: "ECMO_VV", label: "ECMO veno-venosa", icon: "", category: "advanced",
    sites: ["Jugular interna D + Femoral", "Femoral D + Femoral E"],
    needsLumens: false, recommendedMaxDays: 14, notesLabel: "Fluxo (L/min) / RPM", riskWeight: 4 },
  { code: "ECMO_VA", label: "ECMO veno-arterial", icon: "", category: "advanced",
    sites: ["Femoral D", "Femoral E", "Central (cirúrgico)"],
    recommendedMaxDays: 10, notesLabel: "Fluxo / Sweep", riskWeight: 4 },
  { code: "IABP", label: "Balão intra-aórtico", icon: "", category: "advanced",
    sites: ["Femoral D", "Femoral E"], needsSide: true,
    recommendedMaxDays: 5, notesLabel: "Razão (1:1, 1:2)", riskWeight: 3 },
  { code: "MPT", label: "Marca-passo temporário", icon: "", category: "advanced",
    sites: ["Jugular interna D", "Jugular interna E", "Subclávia D", "Subclávia E", "Femoral D", "Femoral E", "Epicárdico"],
    recommendedMaxDays: 7, notesLabel: "Limiar / FC", riskWeight: 3 },
  { code: "MP_TV", label: "Marca-passo transvenoso", icon: "", category: "advanced",
    sites: ["Jugular interna D", "Jugular interna E", "Subclávia D", "Subclávia E", "Femoral D", "Femoral E"],
    needsSide: true, recommendedMaxDays: 7, notesLabel: "Modo / limiar / FC", riskWeight: 3 },
  { code: "MP_TC", label: "Marca-passo transcutâneo", icon: "", category: "advanced",
    sites: ["Tórax anterior/posterior"],
    recommendedMaxDays: 1, notesLabel: "mA / captura / FC", riskWeight: 2 },
  { code: "MP_DEF", label: "Marca-passo definitivo", icon: "", category: "advanced",
    sites: ["Peitoral D (subcutâneo)", "Peitoral E (subcutâneo)", "Epicárdico"],
    needsSide: true, recommendedMaxDays: 3650, notesLabel: "Modo / bateria / FC", riskWeight: 1 },

  // ── Ostomias ────────────────────────────────────────────────────────────
  { code: "COL", label: "Colostomia", icon: "", category: "ostomy",
    sites: ["Abdome"], recommendedMaxDays: 365, notesLabel: "Aspecto / débito", riskWeight: 1 },
  { code: "ILE", label: "Ileostomia", icon: "", category: "ostomy",
    sites: ["Abdome"], recommendedMaxDays: 365, notesLabel: "Aspecto / débito", riskWeight: 1 },
  { code: "URO", label: "Urostomia", icon: "", category: "ostomy",
    sites: ["Abdome"], recommendedMaxDays: 365, notesLabel: "Aspecto / débito", riskWeight: 2 },
];

export const deviceTypeByCode = (c: string) => DEVICE_TYPES.find((d) => d.code === c);
export const deviceTypesByCategory = (cat: DeviceCategory) => DEVICE_TYPES.filter((d) => d.category === cat);

export const categoryLabel = (c: DeviceCategory) => DEVICE_CATEGORIES.find((x) => x.code === c)?.label ?? c;
export const categoryIcon = (c: DeviceCategory) => DEVICE_CATEGORIES.find((x) => x.code === c)?.icon ?? "•";

// ============================================================================
// Infection-risk score (4 níveis: baixo / moderado / alto / muito alto)
// ============================================================================

export type InfectionRiskLevel = "low" | "moderate" | "high" | "very_high";

export interface InfectionRisk {
  level: InfectionRiskLevel;
  score: number;          // 0–10
  label: string;
  emoji: string;          //    
  color: string;          // hsl
  reasons: string[];      // human-readable
}

const LEVEL_META: Record<InfectionRiskLevel, { label: string; emoji: string; color: string }> = {
  low: { label: "Baixo", emoji: "", color: "hsl(142 70% 45%)" },
  moderate: { label: "Moderado", emoji: "", color: "hsl(45 95% 55%)" },
  high: { label: "Alto", emoji: "", color: "hsl(25 90% 55%)" },
  very_high: { label: "Muito alto", emoji: "", color: "hsl(0 80% 55%)" },
};

/**
 * Combines:
 *  - intrinsic device weight (1–4)
 *  - dwell time vs recommended max
 *  - patient context: imunossupressão, ATB em uso, infecção ativa, cultura positiva.
 */
export function deviceInfectionRisk(
  device: InvasiveDevice,
  patient?: Patient | null,
): InfectionRisk {
  const def = deviceTypeByCode(device.typeCode);
  const base = def?.riskWeight ?? 2;
  const max = device.recommendedMaxDays ?? def?.recommendedMaxDays ?? 7;
  const inserted = new Date(device.insertedAt).getTime();
  const ref = device.removedAt ? new Date(device.removedAt).getTime() : Date.now();
  const days = Number.isFinite(inserted) ? Math.max(0, (ref - inserted) / 86400000) : 0;

  const reasons: string[] = [];
  let score = base * 1.5; // 1.5 – 6
  reasons.push(`${def?.label ?? device.typeCode}: risco intrínseco ${base}/4`);

  if (days >= max) { score += 2; reasons.push(`Permanência ${Math.floor(days)}d ≥ limite (${max}d)`); }
  else if (days >= max * 0.8) { score += 1; reasons.push(`Próximo do limite (${Math.floor(days)}/${max}d)`); }
  else if (days >= max * 0.5) { score += 0.5; }

  // Femoral sites carry extra risk
  if (device.site?.toLowerCase().includes("femoral")) {
    score += 0.5;
    reasons.push("Sítio femoral");
  }

  // Patient context
  if (patient) {
    const meds = patient.medications ?? [];
    const atbActive = meds.filter((m) => m.isAntibiotic && m.active !== false);
    if (atbActive.length > 0) {
      score += 0.5;
      reasons.push(`Antibioticoterapia em curso (${atbActive.length})`);
    }

    const immune = (patient.diagnoses ?? []).some((d) => /imunossupr|quimio|transplante|corticoid|HIV|neutropen/i.test(d.label),
    );
    if (immune) { score += 1; reasons.push("Imunossupressão"); }

    const activeInf = (patient.infections ?? []).some((i) => i.status !== "resolvido");
    if (activeInf) { score += 1; reasons.push("Infecção ativa registrada"); }

    const positiveCulture = (patient.cultures ?? []).some(
      (c) => c.organism && c.resistanceProfile && c.resistanceProfile !== "pendente",
    );
    if (positiveCulture) { score += 1; reasons.push("Cultura positiva"); }

    if ((patient.state?.temp ?? 0) >= 37.8) {
      score += 0.5;
      reasons.push(`Temperatura ${patient.state.temp.toFixed(1)}°C`);
    }
  }

  // Clamp 0–10
  score = Math.max(0, Math.min(10, score));
  let level: InfectionRiskLevel;
  if (score <= 3) level = "low";
  else if (score <= 5.5) level = "moderate";
  else if (score <= 7.5) level = "high";
  else level = "very_high";

  return { level, score: Math.round(score * 10) / 10, reasons, ...LEVEL_META[level] };
}

// ============================================================================
// SEMÁFORO DE PERMANÊNCIA (alerta de REAVALIAÇÃO, não de retirada obrigatória)
//  0..greenMax dias ·  greenMax+1..yellowMax ·  ≥ yellowMax+1
// ============================================================================

export interface DeviceSemaphore {
  greenMax: number;
  yellowMax: number;
}

export const DEVICE_SEMAPHORE: Record<string, DeviceSemaphore> = {
  CVC_SUB: { greenMax: 7, yellowMax: 14 },
  CVC_JUG: { greenMax: 5, yellowMax: 10 },
  CVC_FEM: { greenMax: 2, yellowMax: 5 },
  PAI_RAD: { greenMax: 5, yellowMax: 10 },
  PAI_PED: { greenMax: 5, yellowMax: 10 },
  PAI_BRA: { greenMax: 3, yellowMax: 7 },
  PAI_FEM: { greenMax: 2, yellowMax: 5 },
  SVD: { greenMax: 2, yellowMax: 5 },
  SNE: { greenMax: 14, yellowMax: 28 },
  SOE: { greenMax: 14, yellowMax: 28 },
  DVE: { greenMax: 5, yellowMax: 10 },
  DLE: { greenMax: 3, yellowMax: 7 },
};

export const deviceSemaphore = (code: string): DeviceSemaphore | undefined => DEVICE_SEMAPHORE[code];
