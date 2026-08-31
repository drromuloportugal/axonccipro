// ============================================================================
// Banco de diluições e motor de cálculo de bomba de infusão — UTIFlow
// Os padrões abaixo foram cadastrados a partir de material institucional
// fornecido pelo usuário. NÃO são recomendação universal.
// ============================================================================

export const DILUTION_SOURCE_NOTE =
 "Protocolo cadastrado pelo usuário a partir de material institucional.";

export const DILUTION_DISCLAIMER =
 "Os padrões de diluição são configuráveis. Confirme o protocolo institucional, a apresentação comercial e a prescrição antes da administração.";

export type MassUnit = "mg" | "mcg" | "g" | "U";

export type DoseUnit =
  | "mcg/kg/min" | "mcg/kg/h" | "mcg/min" | "mcg/h"
  | "mg/kg/h" | "mg/h" | "mg/min"
  | "U/h" | "U/min"
  | "mL/h";

export type Diluent = "SF 0,9%" | "SG 5%" | "SF 0,9% ou SG 5%" | "Sem diluente" | "Outro";

export interface DrugPresentation {
  /** quantidade de princípio ativo na ampola/frasco */
  amount: number;
  /** unidade da quantidade */
  unit: MassUnit;
  /** volume da ampola/frasco em mL */
  volumeMl: number;
  label: string;
}

export interface DilutionPreset {
  id: string;
  label: string;
  /** volume de medicamento (mL) aspirado; null = definir manualmente */
  drugVolumeMl: number;
  diluentMl: number;
  diluent: Diluent;
  note?: string;
  custom?: boolean;
  active?: boolean;
}

export interface DrugDef {
  code: string;
  name: string;
  group: "vaso" | "sedo";
  presentation: DrugPresentation;
  /** unidade base para dose (massa) */
  baseUnit: "mcg" | "U";
  allowedDoseUnits: DoseUnit[];
  dilutions: DilutionPreset[];
}

const MASS_TO_MCG: Record<MassUnit, number> = { g: 1_000_000, mg: 1000, mcg: 1, U: 1 };

/** converte quantidade em unidade de massa para a unidade base (mcg ou U) */
export function toBase(amount: number, unit: MassUnit): number {
  return amount * MASS_TO_MCG[unit];
}

// ---------------------------------------------------------------------------
// Banco inicial
// ---------------------------------------------------------------------------

const DOSE_VASO: DoseUnit[] = ["mcg/kg/min", "mcg/min", "mcg/kg/h", "mg/h", "mg/min", "mL/h"];
const DOSE_SEDO: DoseUnit[] = ["mcg/kg/h", "mcg/kg/min", "mg/kg/h", "mg/h", "mcg/h", "mL/h"];

export const DRUG_BANK: DrugDef[] = [
  {
    code: "NORA", name: "Noradrenalina - diluição padrão", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 4, unit: "mg", volumeMl: 4, label: "4 mg / 4 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "padrao", label: "20 mL + 80 mL de SF 0,9% ou SG 5%", drugVolumeMl: 20, diluentMl: 80, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "NORA_LIGHT", name: "Noradrenalina “Light”", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 4, unit: "mg", volumeMl: 4, label: "4 mg / 4 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "light", label: "4 mL + 96 mL de SF 0,9% ou SG 5%", drugVolumeMl: 4, diluentMl: 96, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "VASO", name: "Vasopressina - diluição padrão", group: "vaso", baseUnit: "U",
    presentation: { amount: 20, unit: "U", volumeMl: 1, label: "20 U / 1 mL" },
    allowedDoseUnits: ["U/h", "U/min", "mL/h"],
    dilutions: [
      { id: "a", label: "1 mL + 99 mL de SF 0,9% ou SG 5%", drugVolumeMl: 1, diluentMl: 99, diluent: "SF 0,9% ou SG 5%" },
      { id: "b", label: "2 mL + 98 mL de SF 0,9% ou SG 5%", drugVolumeMl: 2, diluentMl: 98, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "DOBU_PURA", name: "Dobutamina “pura”", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 250, unit: "mg", volumeMl: 20, label: "250 mg / 20 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "pura", label: "60 a 100 mL, sem diluente", drugVolumeMl: 100, diluentMl: 0, diluent: "Sem diluente", note: "Faixa original: 60 a 100 mL, sem diluente." },
    ],
  },
  {
    code: "DOBU", name: "Dobutamina - diluição padrão", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 250, unit: "mg", volumeMl: 20, label: "250 mg / 20 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "padrao", label: "20 mL + 230 mL de SF 0,9% ou SG 5%", drugVolumeMl: 20, diluentMl: 230, diluent: "SF 0,9% ou SG 5%" },
      { id: "padrao2", label: "40 mL + 210 mL de SF 0,9% ou SG 5%", drugVolumeMl: 40, diluentMl: 210, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "DOPA", name: "Dopamina - diluição padrão", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 10, label: "50 mg / 10 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "padrao", label: "50 mL + 200 mL de SF 0,9% ou SG 5%", drugVolumeMl: 50, diluentMl: 200, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "NPS", name: "Nitroprussiato de sódio", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 2, label: "50 mg / 2 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "padrao", label: "2 mL + 248 mL de SG 5%", drugVolumeMl: 2, diluentMl: 248, diluent: "SG 5%", note: "Fotossensível — proteger da luz." },
    ],
  },
  {
    code: "NTG", name: "Nitroglicerina", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 10, label: "50 mg / 10 mL" },
    allowedDoseUnits: DOSE_VASO,
    dilutions: [
      { id: "a", label: "5 mL + 245 mL de SG 5%", drugVolumeMl: 5, diluentMl: 245, diluent: "SG 5%" },
      { id: "b", label: "10 mL + 240 mL de SG 5%", drugVolumeMl: 10, diluentMl: 240, diluent: "SG 5%" },
    ],
  },
  {
    code: "CLON", name: "Clonidina", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 150, unit: "mcg", volumeMl: 1, label: "150 mcg / 1 mL" },
    allowedDoseUnits: ["mcg/h", "mcg/kg/h", "mcg/min", "mL/h"],
    dilutions: [
      { id: "padrao", label: "15 mL + 235 mL de SG 5%", drugVolumeMl: 15, diluentMl: 235, diluent: "SG 5%" },
    ],
  },
  {
    code: "AMIO", name: "Amiodarona", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 150, unit: "mg", volumeMl: 3, label: "150 mg / 3 mL (50 mg/mL)" },
    allowedDoseUnits: ["mg/h", "mg/min", "mcg/kg/min", "mL/h"],
    dilutions: [
      { id: "a", label: "18 mL (900 mg) + 232 mL de SG 5%", drugVolumeMl: 18, diluentMl: 232, diluent: "SG 5%" },
      { id: "b", label: "24 mL (1.200 mg) + 226 mL de SG 5%", drugVolumeMl: 24, diluentMl: 226, diluent: "SG 5%" },
    ],
  },
  {
    code: "FURO", name: "Furosemida", group: "vaso", baseUnit: "mcg",
    presentation: { amount: 20, unit: "mg", volumeMl: 2, label: "20 mg / 2 mL" },
    allowedDoseUnits: ["mg/h", "mg/kg/h", "mL/h"],
    dilutions: [
      { id: "padrao", label: "20 mL + 80 mL de SF 0,9%", drugVolumeMl: 20, diluentMl: 80, diluent: "SF 0,9%" },
    ],
  },

  // ---------------- Analgésicos, sedativos e BNM ----------------
  {
    code: "MIDA_PURO", name: "Midazolam “puro”", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 10, label: "50 mg / 10 mL (5 mg/mL)" },
    allowedDoseUnits: DOSE_SEDO,
    dilutions: [
      { id: "puro", label: "60 a 100 mL, sem diluente", drugVolumeMl: 100, diluentMl: 0, diluent: "Sem diluente", note: "Faixa original: 60 a 100 mL, sem diluente." },
    ],
  },
  {
    code: "MIDA", name: "Midazolam - diluição padrão", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 10, label: "50 mg / 10 mL (5 mg/mL)" },
    allowedDoseUnits: DOSE_SEDO,
    dilutions: [
      { id: "padrao", label: "30 mL + 120 mL de SF 0,9% ou SG 5%", drugVolumeMl: 30, diluentMl: 120, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "FENT_PURO", name: "Fentanil “puro”", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 0.05, unit: "mg", volumeMl: 1, label: "50 mcg / mL" },
    allowedDoseUnits: ["mcg/kg/h", "mcg/h", "mcg/kg/min", "mL/h"],
    dilutions: [
      { id: "puro", label: "60 a 100 mL, sem diluente", drugVolumeMl: 100, diluentMl: 0, diluent: "Sem diluente", note: "Faixa original: 60 a 100 mL, sem diluente." },
    ],
  },
  {
    code: "FENT", name: "Fentanil - diluição padrão", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 0.05, unit: "mg", volumeMl: 1, label: "50 mcg / mL" },
    allowedDoseUnits: ["mcg/kg/h", "mcg/h", "mcg/kg/min", "mL/h"],
    dilutions: [
      { id: "padrao", label: "20 mL + 80 mL de SF 0,9% ou SG 5%", drugVolumeMl: 20, diluentMl: 80, diluent: "SF 0,9% ou SG 5%" },
    ],
  },
  {
    code: "PROP", name: "Propofol 1% ou 2%", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 10, unit: "mg", volumeMl: 1, label: "1% = 10 mg/mL (2% = 20 mg/mL)" },
    allowedDoseUnits: ["mcg/kg/min", "mg/kg/h", "mg/h", "mL/h"],
    dilutions: [
      { id: "puro", label: "100 mL, sem diluente", drugVolumeMl: 100, diluentMl: 0, diluent: "Sem diluente" },
    ],
  },
  {
    code: "DEXME", name: "Dexmedetomidina - diluição padrão", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 200, unit: "mcg", volumeMl: 2, label: "200 mcg / 2 mL (100 mcg/mL)" },
    allowedDoseUnits: ["mcg/kg/h", "mcg/h", "mL/h"],
    dilutions: [
      { id: "a", label: "2 mL + 48 mL de SF 0,9%", drugVolumeMl: 2, diluentMl: 48, diluent: "SF 0,9%" },
      { id: "b", label: "4 mL + 96 mL de SF 0,9%", drugVolumeMl: 4, diluentMl: 96, diluent: "SF 0,9%" },
    ],
  },
  {
    code: "CETA", name: "Cetamina - diluição padrão", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 50, unit: "mg", volumeMl: 1, label: "50 mg / mL" },
    allowedDoseUnits: ["mcg/kg/min", "mg/kg/h", "mg/h", "mL/h"],
    dilutions: [
      { id: "padrao", label: "20 mL + 80 mL de SG 5%", drugVolumeMl: 20, diluentMl: 80, diluent: "SG 5%" },
    ],
  },
  {
    code: "ROCU", name: "Rocurônio - diluição padrão", group: "sedo", baseUnit: "mcg",
    presentation: { amount: 10, unit: "mg", volumeMl: 1, label: "50 mg / 5 mL (10 mg/mL)" },
    allowedDoseUnits: ["mcg/kg/min", "mg/kg/h", "mg/h", "mL/h"],
    dilutions: [
      { id: "padrao", label: "20 mL + 80 mL de SG 5%", drugVolumeMl: 20, diluentMl: 80, diluent: "SG 5%" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Motor de cálculo
// ---------------------------------------------------------------------------

export interface SolutionInput {
  /** concentração da apresentação: quantidade por volume da ampola */
  ampAmount?: number;
  ampUnit: MassUnit;
  ampVolumeMl?: number;
  drugVolumeMl?: number;
  diluentMl?: number;
}

export interface SolutionResult {
  finalVolumeMl?: number;
  /** quantidade total na solução, em unidade base (mcg ou U) */
  totalBase?: number;
  /** concentração em unidade base por mL */
  concBasePerMl?: number;
  missing: string[];
}

export function computeSolution(input: SolutionInput): SolutionResult {
  const missing: string[] = [];
  const { ampAmount, ampUnit, ampVolumeMl, drugVolumeMl, diluentMl } = input;
  if (ampAmount == null || !Number.isFinite(ampAmount) || ampAmount <= 0)
    missing.push("Concentração da apresentação (quantidade da ampola)");
  if (ampVolumeMl == null || !Number.isFinite(ampVolumeMl) || ampVolumeMl <= 0)
    missing.push("Volume da ampola");
  if (drugVolumeMl == null || !Number.isFinite(drugVolumeMl) || drugVolumeMl <= 0)
    missing.push("Volume do medicamento");
  if (diluentMl == null || !Number.isFinite(diluentMl) || diluentMl < 0)
    missing.push("Volume do diluente");

  if (missing.length) return { missing };

  const finalVolumeMl = drugVolumeMl! + diluentMl!;
  const perMlBase = toBase(ampAmount!, ampUnit) / ampVolumeMl!;
  const totalBase = perMlBase * drugVolumeMl!;
  const concBasePerMl = finalVolumeMl > 0 ? totalBase / finalVolumeMl : undefined;
  return { finalVolumeMl, totalBase, concBasePerMl, missing: [] };
}

/** quantidade de unidades-base entregues por hora para uma dose prescrita */
function doseToBasePerHour(dose: number, unit: DoseUnit, weightKg?: number): number | null {
  switch (unit) {
    case "mcg/kg/min": return weightKg ? dose * weightKg * 60 : null;
    case "mcg/kg/h": return weightKg ? dose * weightKg : null;
    case "mcg/min": return dose * 60;
    case "mcg/h": return dose;
    case "mg/kg/h": return weightKg ? dose * weightKg * 1000 : null;
    case "mg/h": return dose * 1000;
    case "mg/min": return dose * 1000 * 60;
    case "U/h": return dose;
    case "U/min": return dose * 60;
    case "mL/h": return null;
    default: return null;
  }
}

function basePerHourToDose(basePerHour: number, unit: DoseUnit, weightKg?: number): number | null {
  switch (unit) {
    case "mcg/kg/min": return weightKg ? basePerHour / (weightKg * 60) : null;
    case "mcg/kg/h": return weightKg ? basePerHour / weightKg : null;
    case "mcg/min": return basePerHour / 60;
    case "mcg/h": return basePerHour;
    case "mg/kg/h": return weightKg ? basePerHour / (weightKg * 1000) : null;
    case "mg/h": return basePerHour / 1000;
    case "mg/min": return basePerHour / 60000;
    case "U/h": return basePerHour;
    case "U/min": return basePerHour / 60;
    default: return null;
  }
}

export function unitNeedsWeight(unit: DoseUnit) {
  return unit.includes("/kg/");
}

export interface RateResult { rateMlPerHour?: number; missing: string[] }

export function computeRate(opts: {
  dose?: number;
  unit: DoseUnit;
  weightKg?: number;
  concBasePerMl?: number;
}): RateResult {
  const missing: string[] = [];
  if (opts.dose == null || !Number.isFinite(opts.dose) || opts.dose <= 0) missing.push("Dose prescrita");
  if (unitNeedsWeight(opts.unit) && (!opts.weightKg || opts.weightKg <= 0)) missing.push("Peso do paciente");
  if (opts.unit !== "mL/h" && (!opts.concBasePerMl || opts.concBasePerMl <= 0))
    missing.push("Concentração da solução");
  if (missing.length) return { missing };

  if (opts.unit === "mL/h") return { rateMlPerHour: opts.dose!, missing: [] };
  const basePerHour = doseToBasePerHour(opts.dose!, opts.unit, opts.weightKg);
  if (basePerHour == null) return { missing: ["Conversão de unidade indisponível"] };
  return { rateMlPerHour: basePerHour / opts.concBasePerMl!, missing: [] };
}

export interface ReverseResult { dose?: number; missing: string[] }

export function computeDoseFromRate(opts: {
  rateMlPerHour?: number;
  unit: DoseUnit;
  weightKg?: number;
  concBasePerMl?: number;
}): ReverseResult {
  const missing: string[] = [];
  if (opts.rateMlPerHour == null || !Number.isFinite(opts.rateMlPerHour) || opts.rateMlPerHour <= 0)
    missing.push("Velocidade da bomba (mL/h)");
  if (unitNeedsWeight(opts.unit) && (!opts.weightKg || opts.weightKg <= 0)) missing.push("Peso do paciente");
  if (opts.unit !== "mL/h" && (!opts.concBasePerMl || opts.concBasePerMl <= 0))
    missing.push("Concentração da solução");
  if (missing.length) return { missing };
  if (opts.unit === "mL/h") return { dose: opts.rateMlPerHour, missing: [] };
  const basePerHour = opts.rateMlPerHour! * opts.concBasePerMl!;
  const dose = basePerHourToDose(basePerHour, opts.unit, opts.weightKg);
  if (dose == null) return { missing: ["Conversão de unidade indisponível"] };
  return { dose, missing: [] };
}

/** formata concentração em unidade legível */
export function formatConcentration(concBasePerMl: number, baseUnit: "mcg" | "U") {
  if (baseUnit === "U") return { value: concBasePerMl, unit: "U/mL" };
  if (concBasePerMl >= 1000) return { value: concBasePerMl / 1000, unit: "mg/mL" };
  return { value: concBasePerMl, unit: "mcg/mL" };
}

export function fmtNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const v = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(digits);
  return v.replace(".", ",");
}

// ---------------------------------------------------------------------------
// Persistência (localStorage)
// ---------------------------------------------------------------------------

export interface DrugOverride {
  presentation?: DrugPresentation;
  customDilutions?: DilutionPreset[];
  disabled?: string[];
}

export interface PrepRecord {
  id: string;
  at: string;
  user?: string;
  drugCode: string;
  drugName: string;
  dilutionLabel: string;
  custom: boolean;
  diluent: string;
  drugVolumeMl: number;
  diluentMl: number;
  finalVolumeMl: number;
  concLabel: string;
  doseLabel?: string;
  rateLabel?: string;
}

export interface AuditEntry {
  at: string;
  user?: string;
  drugCode: string;
  field: string;
  before: string;
  after: string;
}

const K = {
  overrides: "utiflow.dilution.overrides",
  history: "utiflow.dilution.history",
  audit: "utiflow.dilution.audit",
  favs: "utiflow.dilution.favorites",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export const dilutionStore = {
  loadOverrides: () => load<Record<string, DrugOverride>>(K.overrides, {}),
  saveOverrides: (v: Record<string, DrugOverride>) => save(K.overrides, v),
  loadHistory: () => load<PrepRecord[]>(K.history, []),
  saveHistory: (v: PrepRecord[]) => save(K.history, v),
  loadAudit: () => load<AuditEntry[]>(K.audit, []),
  saveAudit: (v: AuditEntry[]) => save(K.audit, v),
  loadFavorites: () => load<string[]>(K.favs, ["NORA", "FENT", "MIDA", "PROP", "DEXME"]),
  saveFavorites: (v: string[]) => save(K.favs, v),
};

export function mergedDrug(def: DrugDef, ov?: DrugOverride): DrugDef {
  if (!ov) return def;
  const disabled = new Set(ov.disabled ?? []);
  return {
    ...def,
    presentation: ov.presentation ?? def.presentation,
    dilutions: [...def.dilutions, ...(ov.customDilutions ?? [])].filter((d) => !disabled.has(d.id)),
  };
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Faixas de dose de referência (mínima · usual · máxima)
// Valores orientativos — confirmar protocolo institucional.
// ---------------------------------------------------------------------------

export interface DoseRange { min: number; usual: number; max: number }

const R = (min: number, usual: number, max: number): DoseRange => ({ min, usual, max });

export const DOSE_RANGES: Record<string, Partial<Record<DoseUnit, DoseRange>>> = {
  NORA:       { "mcg/kg/min": R(0.01, 0.1, 3), "mcg/min": R(1, 8, 100) },
  NORA_LIGHT: { "mcg/kg/min": R(0.01, 0.05, 1), "mcg/min": R(1, 4, 60) },
  VASO:       { "U/min": R(0.01, 0.03, 0.06), "U/h": R(0.6, 1.8, 3.6) },
  DOBU_PURA:  { "mcg/kg/min": R(2, 5, 20) },
  DOBU:       { "mcg/kg/min": R(2, 5, 20) },
  DOPA:       { "mcg/kg/min": R(2, 5, 20) },
  NPS:        { "mcg/kg/min": R(0.3, 1, 10) },
  NTG:        { "mcg/kg/min": R(0.1, 1, 5), "mcg/min": R(5, 40, 200) },
  CLON:       { "mcg/h": R(10, 40, 120), "mcg/kg/h": R(0.1, 0.5, 2) },
  AMIO:       { "mg/h": R(15, 45, 60), "mg/min": R(0.25, 0.75, 1) },
  FURO:       { "mg/h": R(2, 10, 40), "mg/kg/h": R(0.05, 0.15, 0.5) },
  MIDA_PURO:  { "mg/kg/h": R(0.02, 0.1, 0.3), "mcg/kg/min": R(0.3, 1.5, 5) },
  MIDA:       { "mg/kg/h": R(0.02, 0.1, 0.3), "mcg/kg/min": R(0.3, 1.5, 5) },
  FENT_PURO:  { "mcg/kg/h": R(0.5, 2, 10), "mcg/h": R(25, 100, 500) },
  FENT:       { "mcg/kg/h": R(0.5, 2, 10), "mcg/h": R(25, 100, 500) },
  PROP:       { "mcg/kg/min": R(5, 25, 80), "mg/kg/h": R(0.3, 1.5, 4.8) },
  DEXME:      { "mcg/kg/h": R(0.2, 0.7, 1.4) },
  CETA:       { "mg/kg/h": R(0.1, 0.5, 2), "mcg/kg/min": R(1.7, 8, 33) },
  ROCU:       { "mcg/kg/min": R(4, 8, 16), "mg/kg/h": R(0.24, 0.5, 1) },
};

export function getDoseRange(code: string, unit: DoseUnit): DoseRange | undefined {
  return DOSE_RANGES[code]?.[unit];
}
