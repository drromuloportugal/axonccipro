// Anatomical map: position lookup + dwell-time color rules.
// Coordinate system: 200×500 SVG viewBox, head at top, feet at bottom.
// Anterior view: viewer's RIGHT = patient's LEFT.

import type { InvasiveDevice } from "@/data/patients";

export type AnatView = "anterior" | "posterior";

// ============================================================================
// DWELL-TIME COLOR (per user spec, ABSOLUTE days, independent of recommendedMax)
// Verde 0-3 · Amarelo 4-7 · Laranja 8-10 · Vermelho >10 · Roxo sem revisão
// ============================================================================

export type TimeColorLevel = "green" | "yellow" | "orange" | "red" | "purple";

export interface TimeColor {
  level: TimeColorLevel;
  /** Hex/HSL for SVG fill/stroke (not Tailwind class). */
  color: string;
  /** Tailwind text class for chips. */
  className: string;
  label: string;
  days: number;
  hours: number;
}

const COLOR_HEX: Record<TimeColorLevel, string> = {
  green: "hsl(142 70% 45%)",
  yellow: "hsl(45 95% 55%)",
  orange: "hsl(25 90% 55%)",
  red: "hsl(0 80% 55%)",
  purple: "hsl(280 60% 60%)",
};

const COLOR_CLASS: Record<TimeColorLevel, string> = {
  green: "text-clinical-stable",
  yellow: "text-clinical-attention",
  orange: "text-clinical-device",
  red: "text-clinical-critical",
  purple: "text-clinical-neuro",
};

const COLOR_LABEL: Record<TimeColorLevel, string> = {
  green: "0–3 dias",
  yellow: "4–7 dias",
  orange: "8–10 dias",
  red: ">10 dias",
  purple: "Sem revisão",
};

export function deviceTimeColor(d: InvasiveDevice): TimeColor {
  const inserted = new Date(d.insertedAt).getTime();
  if (!Number.isFinite(inserted)) {
    return {
      level: "purple", color: COLOR_HEX.purple, className: COLOR_CLASS.purple,
      label: COLOR_LABEL.purple, days: 0, hours: 0,
    };
  }
  const ref = d.removedAt ? new Date(d.removedAt).getTime() : Date.now();
  const hours = Math.max(0, (ref - inserted) / 3600000);
  const days = hours / 24;
  let level: TimeColorLevel;
  if (days <= 3) level = "green";
  else if (days <= 7) level = "yellow";
  else if (days <= 10) level = "orange";
  else level = "red";
  return {
    level, color: COLOR_HEX[level], className: COLOR_CLASS[level],
    label: COLOR_LABEL[level], days, hours,
  };
}

// ============================================================================
// ANATOMICAL POSITIONS — by typeCode + (optional) site/side
// Returns marker positions for the active view. Some devices render on both;
// most are anterior-only. Position keys map site strings literally.
// ============================================================================

export interface Marker {
  /** Primary point of the device (px in viewBox 200×500). */
  x: number;
  y: number;
  /** Shape used by AnatomicalMap. */
  shape: "circle" | "triangle" | "square" | "diamond" | "ring";
  /** Optional connecting line: [from→to]. Useful for TOT, SVD, SNE, drenos. */
  line?: { x1: number; y1: number; x2: number; y2: number };
}

// Common landmarks
// Anterior view convention: viewer's LEFT = patient's RIGHT (D).
// So D (direita do paciente) must sit at LOWER x; E at HIGHER x.
const POS = {
  jugularD: { x: 87, y: 61 },
  jugularE: { x: 113, y: 61 },
  subclavD: { x: 76, y: 87 },
  subclavE: { x: 124, y: 87 },
  femoralD: { x: 85, y: 289 },
  femoralE: { x: 115, y: 289 },
  radialD: { x: 34, y: 233 },
  radialE: { x: 166, y: 233 },
  braquialD:{ x: 44, y: 177 },
  braquialE:{ x: 156, y: 177 },
  pediosaD: { x: 85, y: 457 },
  pediosaE: { x: 115, y: 457 },
  basilicaD:{ x: 40, y: 197 },
  basilicaE:{ x: 160, y: 197 },
  frontalD: { x: 91, y: 21 },
  frontalE: { x: 109, y: 21 },
  topHead: { x: 100, y: 13 },
  noseD: { x: 97, y: 41 },
  noseE: { x: 103, y: 41 },
  mouth: { x: 100, y: 47 },
  trachea: { x: 100, y: 121 },
  cervical: { x: 100, y: 77 },
  hemitoraxD:{x: 58, y: 147 },
  hemitoraxE:{x: 142, y: 147 },
  pelvis: { x: 100, y: 251 },
  belowPelvis:{x:100, y: 294 },
  stomach: { x: 104, y: 181 },
  abdLeftPt:{ x: 122, y: 217 }, // patient left abdomen = viewer right
  abdLowerPt:{x: 108, y: 247 },
  lombar: { x: 100, y: 257 }, // posterior
  vbile: { x: 127, y: 197 },
  handD: { x: 24, y: 263 },
  handE: { x: 176, y: 263 },
  forearmD: { x: 32, y: 217 },
  forearmE: { x: 168, y: 217 },
  cubitalD: { x: 42, y: 187 },
  cubitalE: { x: 158, y: 187 },
  jugExtD: { x: 91, y: 67 },
  jugExtE: { x: 109, y: 67 },
};


// Generic central-line helper (jugular / subclavian / femoral)
function centralAt(d: InvasiveDevice, side: "D" | "E" | undefined): Marker {
  const s = d.site ?? "";
  if (s.startsWith("Jugular interna"))  return { ...(side === "E" ? POS.jugularE : POS.jugularD), shape: "circle" };
  if (s.startsWith("Subclávia") || s.startsWith("Subclavicular"))
                                         return { ...(side === "E" ? POS.subclavE : POS.subclavD), shape: "circle" };
  if (s.startsWith("Femoral"))           return { ...(side === "E" ? POS.femoralE : POS.femoralD), shape: "circle" };
  return { ...POS.subclavD, shape: "circle" };
}

export function deviceMarkers(d: InvasiveDevice, view: AnatView): Marker[] {
  const t = d.typeCode;
  const side = d.side ?? (d.site?.endsWith(" D") ? "D" : d.site?.endsWith(" E") ? "E" : undefined);

  // POSTERIOR view handles only neuro lumbar + posterior drains
  if (view === "posterior") {
    if (t === "DLE") return [{ ...POS.lombar, shape: "diamond" }];
    if (t === "NEFRO") {
      const at = side === "E" ? { x: 72, y: 225 } : { x: 128, y: 225 };
      return [{ ...at, shape: "ring" }];
    }
    return [];
  }

  // ANTERIOR view
  switch (t) {
    // ── Central venous ────────────────────────────────────────────────
    case "CVC_JUG":
    case "CVC_SUB":
    case "CVC_FEM":
    case "HD_CAT":
    case "SWAN":
    case "PORT":
    case "MPT":
      return [centralAt(d, side)];

    case "PICC":
    case "MIDLINE": {
      if (d.site?.startsWith("Basílica"))  return [{ ...(side === "E" ? POS.basilicaE : POS.basilicaD), shape: "circle" }];
      if (d.site?.startsWith("Cefálica"))  return [{ ...(side === "E" ? POS.forearmE  : POS.forearmD), shape: "circle" }];
      return [{ ...(side === "E" ? POS.braquialE : POS.braquialD), shape: "circle" }];
    }

    // ── Arterial ──────────────────────────────────────────────────────
    case "PAI_RAD": return [{ ...(side === "E" ? POS.radialE   : POS.radialD), shape: "triangle" }];
    case "PAI_FEM": return [{ ...(side === "E" ? POS.femoralE  : POS.femoralD), shape: "triangle" }];
    case "PAI_BRA": return [{ ...(side === "E" ? POS.braquialE : POS.braquialD), shape: "triangle" }];
    case "PAI_PED": return [{ ...(side === "E" ? POS.pediosaE  : POS.pediosaD), shape: "triangle" }];

    // ── Peripheral venous ─────────────────────────────────────────────
    case "PVP": {
      if (d.site?.startsWith("Dorso da mão"))   return [{ ...(side === "E" ? POS.handE     : POS.handD), shape: "triangle" }];
      if (d.site?.startsWith("Antebraço"))      return [{ ...(side === "E" ? POS.forearmE  : POS.forearmD), shape: "triangle" }];
      if (d.site?.startsWith("Fossa cubital"))  return [{ ...(side === "E" ? POS.cubitalE  : POS.cubitalD), shape: "triangle" }];
      if (d.site?.startsWith("Braquial"))       return [{ ...(side === "E" ? POS.braquialE : POS.braquialD), shape: "triangle" }];
      if (d.site?.startsWith("Jugular externa"))return [{ ...(side === "E" ? POS.jugExtE   : POS.jugExtD), shape: "triangle" }];
      if (d.site?.startsWith("Dorso do pé"))    return [{ ...(side === "E" ? POS.pediosaE  : POS.pediosaD), shape: "triangle" }];
      return [{ ...POS.forearmD, shape: "triangle" }];
    }

    // ── Airway / Ventilation ──────────────────────────────────────────
    case "TOT":
    case "VMI":
      return [{ ...POS.mouth, shape: "circle", line: { x1: POS.mouth.x, y1: POS.mouth.y, x2: POS.trachea.x, y2: POS.trachea.y } }];
    case "TNT": {
      const nose = side === "E" ? POS.noseE : POS.noseD;
      return [{ ...nose, shape: "circle", line: { x1: nose.x, y1: nose.y, x2: POS.trachea.x, y2: POS.trachea.y } }];
    }
    case "TQT": return [{ ...POS.cervical, shape: "ring" }];
    case "O2_NAS": {
      const nose = side === "E" ? POS.noseE : POS.noseD;
      return [{ ...nose, shape: "diamond" }];
    }
    case "VENTURI":
    case "MNRR":
    case "CPAP":
    case "BIPAP":
      return [{ ...POS.mouth, shape: "ring" }];

    // ── Urinary ───────────────────────────────────────────────────────
    case "SVD":
    case "SVA":
    case "CISTO":
      return [{ ...POS.pelvis, shape: "circle", line: { x1: POS.pelvis.x, y1: POS.pelvis.y, x2: POS.belowPelvis.x, y2: POS.belowPelvis.y } }];

    // ── Enteral ───────────────────────────────────────────────────────
    case "SNG":
    case "SNE": {
      const nose = side === "E" ? POS.noseE : POS.noseD;
      return [{ ...nose, shape: "circle", line: { x1: nose.x, y1: nose.y, x2: POS.stomach.x, y2: POS.stomach.y } }];
    }
    case "GTT": return [{ x: POS.abdLeftPt.x, y: 155, shape: "ring" }];
    case "JTT": return [{ ...POS.abdLowerPt, shape: "ring" }];

    // ── Neuro ─────────────────────────────────────────────────────────
    case "DVE":
    case "PBTO2":
      return [{ ...(side === "E" ? POS.frontalE : POS.frontalD), shape: "diamond" }];
    case "PICmon": return [{ ...POS.topHead, shape: "diamond" }];

    // ── Ostomies ──────────────────────────────────────────────────────
    case "COL":
    case "ILE":
    case "URO":
      return [{ ...POS.abdLeftPt, shape: "ring" }];

    // ── Drains ────────────────────────────────────────────────────────
    case "DRT": {
      const at = side === "E" ? POS.hemitoraxE : POS.hemitoraxD;
      const out = { x: side === "E" ? 175 : 25, y: at.y + 30 };
      return [{ ...at, shape: "square", line: { x1: at.x, y1: at.y, x2: out.x, y2: out.y } }];
    }
    case "MEDIA": return [{ ...POS.trachea, shape: "square" }];
    case "PERIC": return [{ x: 96, y: 157, shape: "square" }];
    case "KEHR": return [{ ...POS.vbile, shape: "square" }];
    case "PVAC":
    case "HVAC":
    case "BLAKE":
    case "PENROSE":
    case "JP": return [{ ...POS.abdLowerPt, shape: "square" }];

    // ── Advanced therapies ────────────────────────────────────────────
    case "ECMO_VV":
    case "ECMO_VA": {
      const at = side === "E" ? POS.femoralE : POS.femoralD;
      return [{ ...at, shape: "diamond" }];
    }
    case "IABP": return [{ ...(side === "E" ? POS.femoralE : POS.femoralD), shape: "diamond" }];

    default: return [];
  }
}

// ============================================================================
// ALERTS — protocol thresholds (defaults to recommendedMaxDays)
// ============================================================================

export interface DeviceAlert {
  icon: string;
  text: string;
  level: "warn" | "danger" | "review";
}

export function deviceAlerts(d: InvasiveDevice, max: number): DeviceAlert[] {
  const { days } = deviceTimeColor(d);
  const alerts: DeviceAlert[] = [];
  if (days >= max) {
    alerts.push({ icon: "", text: "Considerar troca", level: "danger" });
    alerts.push({ icon: "", text: "Avaliar necessidade de permanência", level: "warn" });
  } else if (days >= max * 0.8) {
    alerts.push({ icon: "", text: "Próximo do limite — programar troca", level: "warn" });
  }
  if (!d.insertedBy) {
    alerts.push({ icon: "", text: "Revisão pendente — sem profissional registrado", level: "review" });
  }
  return alerts;
}
