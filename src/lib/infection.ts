// Infection focus logic + anatomical anchors + decision-support helpers.
// All client-side. No diagnoses are emitted — only signals and reminders.

import type {
  Patient, InfectionFocus, InfectionSite, InfectionStatus,
  Culture, Medication, InvasiveDevice,
} from "@/data/patients";
import type { AnatView } from "@/lib/anatomical";

// ----------------------------------------------------------------------------
// Status colors (verde/amarelo/laranja/vermelho)
// ----------------------------------------------------------------------------

export const STATUS_COLOR: Record<InfectionStatus, { hex: string; label: string; className: string }> = {
  resolvido: { hex: "hsl(142 70% 45%)", label: "Resolvido", className: "text-clinical-stable" },
  suspeito: { hex: "hsl(45 95% 55%)", label: "Suspeito", className: "text-clinical-attention" },
  provavel: { hex: "hsl(25 90% 55%)", label: "Provável", className: "text-clinical-device" },
  confirmado: { hex: "hsl(0 80% 55%)", label: "Confirmado", className: "text-clinical-critical" },
};

// ----------------------------------------------------------------------------
// Site metadata — anchored to anatomical coordinates (200×510 viewBox)
// ----------------------------------------------------------------------------

export type AnatomicalSystem =
  | "respiratorio" | "snc" | "vascular" | "urinario" | "abdome" | "pele" | "osseo";

export interface SiteMeta {
  label: string;
  short: string;
  system: AnatomicalSystem;
  icon: string;          // emoji used in chips/timeline
  view: AnatView;
  anchor: { x: number; y: number };
  radius: number;        // halo radius (px in viewBox)
}

export const SITE_META: Record<InfectionSite, SiteMeta> = {
  // Respiratório — pulmão direito/esquerdo (centralizado no tórax)
  PAC: { label: "Pneumonia comunitária", short: "PAC", system: "respiratorio", icon: "", view: "anterior", anchor: { x: 100, y: 150 }, radius: 26 },
  PAV: { label: "PAV", short: "PAV", system: "respiratorio", icon: "", view: "anterior", anchor: { x: 100, y: 150 }, radius: 28 },
  EMPIEMA: { label: "Empiema pleural", short: "Empiema", system: "respiratorio", icon: "", view: "anterior", anchor: { x: 130, y: 165 }, radius: 18 },
  ABSC_PULM: { label: "Abscesso pulmonar", short: "Abs pulm", system: "respiratorio", icon: "", view: "anterior", anchor: { x: 85, y: 170 }, radius: 14 },

  // SNC
  MENINGITE: { label: "Meningite", short: "Mening.", system: "snc", icon: "", view: "anterior", anchor: { x: 100, y: 34 }, radius: 22 },
  VENTRICULITE: { label: "Ventriculite", short: "Ventric.", system: "snc", icon: "", view: "anterior", anchor: { x: 100, y: 30 }, radius: 18 },
  INF_DVE: { label: "Infecção por DVE", short: "Inf DVE", system: "snc", icon: "", view: "anterior", anchor: { x: 90, y: 35 }, radius: 18 },
  ABSC_CEREBRAL: { label: "Abscesso cerebral", short: "Abs SNC", system: "snc", icon: "", view: "anterior", anchor: { x: 110, y: 35 }, radius: 14 },

  // Corrente sanguínea
  BACTEREMIA: { label: "Bacteremia", short: "Bactrem.", system: "vascular", icon: "", view: "anterior", anchor: { x: 100, y: 200 }, radius: 30 },
  SEPSE: { label: "Sepse", short: "Sepse", system: "vascular", icon: "", view: "anterior", anchor: { x: 100, y: 200 }, radius: 34 },
  IRC: { label: "Infecção relacionada a cateter", short: "IRC", system: "vascular", icon: "", view: "anterior", anchor: { x: 72, y: 108 }, radius: 16 },

  // Urinário
  ITU: { label: "ITU", short: "ITU", system: "urinario", icon: "", view: "anterior", anchor: { x: 100, y: 272 }, radius: 18 },
  PIELONEFRITE: { label: "Pielonefrite", short: "Pielo", system: "urinario", icon: "", view: "posterior", anchor: { x: 85, y: 250 }, radius: 16 },
  INF_SVD: { label: "Infecção por SVD", short: "Inf SVD", system: "urinario", icon: "", view: "anterior", anchor: { x: 100, y: 305 }, radius: 16 },

  // Abdome
  PERITONITE: { label: "Peritonite", short: "Peritonite", system: "abdome", icon: "", view: "anterior", anchor: { x: 100, y: 235 }, radius: 28 },
  COLECISTITE: { label: "Colecistite", short: "Colec.", system: "abdome", icon: "", view: "anterior", anchor: { x: 130, y: 215 }, radius: 14 },
  DIVERTICULITE: { label: "Diverticulite", short: "Divertic.", system: "abdome", icon: "", view: "anterior", anchor: { x: 75, y: 260 }, radius: 14 },
  ABSC_ABD: { label: "Abscesso abdominal", short: "Abs abd", system: "abdome", icon: "", view: "anterior", anchor: { x: 110, y: 250 }, radius: 16 },
  FISTULA_INF: { label: "Fístula infectada", short: "Fístula", system: "abdome", icon: "", view: "anterior", anchor: { x: 125, y: 240 }, radius: 12 },

  // Pele e partes moles
  CELULITE: { label: "Celulite", short: "Celulite", system: "pele", icon: "", view: "anterior", anchor: { x: 35, y: 250 }, radius: 14 },
  FASCEITE: { label: "Fasceíte necrotizante", short: "Fasceíte", system: "pele", icon: "", view: "anterior", anchor: { x: 165, y: 250 }, radius: 14 },
  LPP_INF: { label: "LPP infectada", short: "LPP", system: "pele", icon: "", view: "posterior", anchor: { x: 100, y: 305 }, radius: 14 },

  // Ossos e articulações
  OSTEOMIELITE: { label: "Osteomielite", short: "Osteomi.", system: "osseo", icon: "", view: "anterior", anchor: { x: 115, y: 420 }, radius: 12 },
  ARTRITE_SEPTICA: { label: "Artrite séptica", short: "Artrite", system: "osseo", icon: "", view: "anterior", anchor: { x: 85, y: 390 }, radius: 12 },
};

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

export interface InfectionSummary {
  active: number;
  resolved: number;
  pendingCultures: number;
  activeAntibiotics: number;
  relatedDevices: number;
}

export function summarizeInfections(p: Patient): InfectionSummary {
  const infs = p.infections ?? [];
  const cults = p.cultures ?? [];
  const active = infs.filter((i) => i.status !== "resolvido");
  const resolved = infs.filter((i) => i.status === "resolvido");
  const relatedIds = new Set(active.flatMap((i) => i.relatedDeviceIds ?? []));
  const antibioticsActive = (p.medications ?? []).filter(
    (m) => m.isAntibiotic && m.active !== false,
  );
  return {
    active: active.length,
    resolved: resolved.length,
    pendingCultures: cults.filter((c) => c.resistanceProfile === "pendente" || !c.organism).length,
    activeAntibiotics: antibioticsActive.length,
    relatedDevices: relatedIds.size,
  };
}

// ----------------------------------------------------------------------------
// Antimicrobial progress per focus (uses Medication.startISO / plannedEndISO)
// ----------------------------------------------------------------------------

export interface AtbProgress {
  name: string;
  dayCurrent: number;
  dayTotal: number;
  percent: number;
}

export function focusAntibiotics(focus: InfectionFocus, meds: Medication[]): AtbProgress[] {
  const names = new Set((focus.antimicrobials ?? []).map((s) => s.toLowerCase()));
  return meds
    .filter((m) => m.isAntibiotic && names.has(m.name.toLowerCase()))
    .map((m) => {
      const start = m.startISO ? new Date(m.startISO).getTime() : Date.now();
      const end = m.plannedEndISO ? new Date(m.plannedEndISO).getTime() : start + 7 * 86400000;
      const totalMs = Math.max(end - start, 86400000);
      const elapsed = Math.max(0, Math.min(totalMs, Date.now() - start));
      const dayTotal = Math.max(1, Math.round(totalMs / 86400000));
      const dayCurrent = Math.min(dayTotal, Math.max(1, Math.ceil(elapsed / 86400000)));
      return {
        name: m.name,
        dayCurrent, dayTotal,
        percent: Math.round((elapsed / totalMs) * 100),
      };
    });
}

// ----------------------------------------------------------------------------
// Device-related infection signal (decision support — never a diagnosis)
// ----------------------------------------------------------------------------

export interface DeviceInfectionHint {
  device: InvasiveDevice;
  reasons: string[];
}

function num(v?: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function suggestDeviceRelatedInfection(p: Patient): DeviceInfectionHint[] {
  const devices = (p.devices ?? []).filter((d) => !d.removedAt);
  if (!devices.length) return [];

  const tempHigh = (p.state?.temp ?? 0) >= 37.8;
  const leuco = num(p.exams.find((e) => e.label.toLowerCase().startsWith("leuco"))?.value);
  const pcr = num(p.exams.find((e) => e.label.toUpperCase() === "PCR")?.value);
  const pct = num(p.exams.find((e) => e.label.toUpperCase().startsWith("PCT"))?.value);
  const leucocitosis = leuco !== null && leuco >= 12000;
  const highPcr = pcr !== null && pcr >= 10;
  const highPct = pct !== null && pct >= 0.5;
  const positiveCulture = (p.cultures ?? []).some(
    (c) => c.organism && c.resistanceProfile !== "pendente",
  );

  const out: DeviceInfectionHint[] = [];
  for (const d of devices) {
    const reasons: string[] = [];
    const ageDays = (Date.now() - new Date(d.insertedAt).getTime()) / 86400000;
    if (ageDays >= 7) reasons.push(`${Math.floor(ageDays)} dias de permanência`);
    if (tempHigh) reasons.push(`Tax: ${p.state.temp.toFixed(1)}°C`);
    if (leucocitosis) reasons.push(`Leuco: ${leuco?.toLocaleString("pt-BR")}`);
    if (highPcr) reasons.push(`PCR: ${pcr}`);
    if (highPct) reasons.push(`PCT: ${pct}`);
    if (positiveCulture && (d.category === "venous_central" || d.typeCode === "PICC")) {
      reasons.push("Hemocultura positiva ativa");
    }
    if (positiveCulture && d.typeCode === "SVD") {
      reasons.push("Cultura positiva — checar urocultura");
    }
    if (reasons.length >= 2) out.push({ device: d, reasons });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Culture display helpers
// ----------------------------------------------------------------------------

export function culturesForFocus(focus: InfectionFocus, all: Culture[]): Culture[] {
  const ids = new Set(focus.cultureIds ?? []);
  return all.filter((c) => ids.has(c.id) || c.linkedFocusId === focus.id);
}
