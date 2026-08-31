import type { Medication, PumpStatus } from "@/data/patients";
import { DRUG_BANK } from "@/data/dilutions";

// Common ICU pump drugs (used in selector)
const BASE_PUMP_DRUGS = [
  "Noradrenalina",
  "Vasopressina",
  "Adrenalina",
  "Dobutamina",
  "Dopamina",
  "Nitroglicerina",
  "Nitroprussiato",
  "Propofol",
  "Midazolam",
  "Dexmedetomidina",
  "Fentanil",
  "Morfina",
  "Cetamina",
  "Insulina",
  "Heparina",
  "Nutrição Parenteral",
  "Bicarbonato",
  "Cloreto de potássio",
  "Hidrocortisona",
];

/** Base list + todos os fármacos cadastrados no banco de diluições. */
export const COMMON_PUMP_DRUGS: string[] = Array.from(
  new Set([...BASE_PUMP_DRUGS, ...DRUG_BANK.map((d) => d.name)]),
);

// ============================================================================
// PUMP STATUS META
// ============================================================================
export const PUMP_STATUS_META: Record<
  PumpStatus,
  { icon: string; label: string; className: string; dotClass: string; borderClass: string }
> = {
  running:      { icon: "", label: "Em funcionamento", className: "text-clinical-stable",    dotClass: "bg-clinical-stable",    borderClass: "border-clinical-stable/50" },
  ending_soon:  { icon: "", label: "Próx. de terminar", className: "text-clinical-attention", dotClass: "bg-clinical-attention", borderClass: "border-clinical-attention/60" },
  needs_change: { icon: "", label: "Necessita troca",   className: "text-clinical-device",    dotClass: "bg-clinical-device",    borderClass: "border-clinical-device/60" },
  stopped:      { icon: "", label: "Interrompida",      className: "text-clinical-critical",  dotClass: "bg-clinical-critical",  borderClass: "border-clinical-critical/70" },
  occluded:     { icon: "", label: "Oclusão detectada", className: "text-foreground",         dotClass: "bg-foreground",         borderClass: "border-foreground/60" },
  titrating:    { icon: "", label: "Em titulação",      className: "text-clinical-resp",      dotClass: "bg-clinical-resp",      borderClass: "border-clinical-resp/60" },
};

export const PUMP_STATUSES: PumpStatus[] = [
  "running", "titrating", "ending_soon", "needs_change", "stopped", "occluded",
];

// ============================================================================
// Y-SITE COMPATIBILITY — simplified clinical reference matrix
// (compatible | doubtful | incompatible)
// ============================================================================

export type CompatLevel = "compatible" | "doubtful" | "incompatible";

// Normalize drug names to a canonical key
function canonical(name: string): string {
  const n = name.toLowerCase();
  if (/nora|norepinef/.test(n)) return "nora";
  if (/vasopres/.test(n)) return "vaso";
  if (/adrenal|epinef/.test(n) && !/^nor/.test(n)) return "adre";
  if (/dobut/.test(n)) return "dobu";
  if (/dopa/.test(n)) return "dopa";
  if (/nitroprus/.test(n)) return "nitropr";
  if (/nitroglic/.test(n)) return "nitrog";
  if (/propofol/.test(n)) return "propo";
  if (/midazol/.test(n)) return "mida";
  if (/fentan/.test(n)) return "fenta";
  if (/morfin/.test(n)) return "morf";
  if (/dexmedet/.test(n)) return "dexm";
  if (/cetamin|ketamin/.test(n)) return "ceta";
  if (/insulin/.test(n)) return "insu";
  if (/heparin/.test(n)) return "hepa";
  if (/nutri|npt|tpn/.test(n)) return "npt";
  if (/bicarb/.test(n)) return "bicarb";
  if (/cloreto.*pot|kcl/.test(n)) return "kcl";
  if (/furose/.test(n)) return "furo";
  if (/amiodaron/.test(n)) return "amio";
  if (/pantoprazol|omeprazol/.test(n)) return "ppi";
  if (/ceftriax/.test(n)) return "ceftria";
  if (/piperaci|tazo/.test(n)) return "ptz";
  if (/vanco/.test(n)) return "vanco";
  if (/merop/.test(n)) return "mero";
  return n.replace(/\s+/g, "");
}

// Incompatibility / caution pairs (symmetric)
const INCOMPATIBLE: Array<[string, string]> = [
  ["bicarb", "nora"], ["bicarb", "adre"], ["bicarb", "dobu"], ["bicarb", "vanco"],
  ["bicarb", "mida"], ["bicarb", "insu"], ["bicarb", "amio"],
  ["furo", "mida"], ["furo", "dobu"], ["furo", "amio"], ["furo", "vanco"],
  ["ppi", "nora"], ["ppi", "dobu"], ["ppi", "mida"],
  ["amio", "hepa"], ["amio", "ptz"],
  ["npt", "ceftria"], ["npt", "ppi"], ["npt", "amio"], ["npt", "furo"], ["npt", "fenta"],
  ["ceftria", "vanco"],
  ["propo", "hepa"],
];

const DOUBTFUL: Array<[string, string]> = [
  ["nora", "bicarb"], ["nora", "furo"],
  ["insu", "dobu"], ["insu", "amio"],
  ["hepa", "vanco"], ["hepa", "dobu"],
  ["propo", "mida"],
  ["mero", "vanco"],
];

function pairMatch(a: string, b: string, list: Array<[string, string]>): boolean {
  return list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function compatibilityOf(a: string, b: string): CompatLevel {
  const ka = canonical(a);
  const kb = canonical(b);
  if (ka === kb) return "compatible";
  if (pairMatch(ka, kb, INCOMPATIBLE)) return "incompatible";
  if (pairMatch(ka, kb, DOUBTFUL)) return "doubtful";
  return "compatible";
}

export const COMPAT_META: Record<
  CompatLevel,
  { icon: string; label: string; className: string }
> = {
  compatible:   { icon: "✓", label: "Compatível",   className: "text-clinical-stable" },
  doubtful:     { icon: "?", label: "Duvidosa",      className: "text-clinical-attention" },
  incompatible: { icon: "✕", label: "Incompatível",  className: "text-clinical-critical" },
};

// Scan a list of meds sharing the SAME access (and same lumen) for issues.
export interface CompatIssue {
  a: string;
  b: string;
  level: CompatLevel;
}

export function scanCompatibility(meds: Medication[]): CompatIssue[] {
  const issues: CompatIssue[] = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const lvl = compatibilityOf(meds[i].name, meds[j].name);
      if (lvl !== "compatible") {
        issues.push({ a: meds[i].name, b: meds[j].name, level: lvl });
      }
    }
  }
  return issues;
}

// Group active pumps by accessDeviceId (+ lumen)
export function groupPumpsByAccess(meds: Medication[]): Map<string, Medication[]> {
  const map = new Map<string, Medication[]>();
  for (const m of meds) {
    if (!m.pump) continue;
    const key = m.pump.accessDeviceId
      ? `${m.pump.accessDeviceId}::L${m.pump.accessLumen ?? "?"}`
      : "__unassigned__";
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}
