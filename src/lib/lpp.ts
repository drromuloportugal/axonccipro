// Pressure injury (LPP) catalog and helpers.
// Coordinate system: 200×510 SVG viewBox (same as AnatomicalMap).
// Anatomical convention: anterior view → viewer's LEFT = patient's RIGHT.

import type { LPPLesion, LPPStage, LPPView, LPPSide } from "@/data/patients";

export interface LPPSiteDef {
  key: string;
  label: string;
  region: "Cabeça" | "Tronco" | "MMSS" | "Pelve" | "MMII";
  view: LPPView;
  side?: LPPSide;
  x: number;
  y: number;
}

export const LPP_SITES: LPPSiteDef[] = [
  // Cabeça
  { key: "occipital", label: "Occipital", region: "Cabeça", view: "posterior", side: "central", x: 100, y: 30 },
  { key: "orelha_d", label: "Orelha direita", region: "Cabeça", view: "lateral_d", side: "D", x: 110, y: 42 },
  { key: "orelha_e", label: "Orelha esquerda", region: "Cabeça", view: "lateral_e", side: "E", x: 90, y: 42 },

  // Tronco
  { key: "escapula_d", label: "Escápula direita", region: "Tronco", view: "posterior", side: "D", x: 78, y: 130 },
  { key: "escapula_e", label: "Escápula esquerda",region: "Tronco", view: "posterior", side: "E", x: 122, y: 130 },
  { key: "sacro", label: "Sacro", region: "Tronco", view: "posterior", side: "central", x: 100, y: 280 },
  { key: "coccix", label: "Cóccix", region: "Tronco", view: "posterior", side: "central", x: 100, y: 298 },
  { key: "torax_ant", label: "Tórax (anterior)", region: "Tronco", view: "anterior", side: "central", x: 100, y: 150 },
  { key: "costela_d", label: "Costelas D", region: "Tronco", view: "anterior", side: "D", x: 82, y: 175 },
  { key: "costela_e", label: "Costelas E", region: "Tronco", view: "anterior", side: "E", x: 118, y: 175 },

  // MMSS
  { key: "cotovelo_d", label: "Cotovelo direito", region: "MMSS", view: "posterior", side: "D", x: 36, y: 198 },
  { key: "cotovelo_e", label: "Cotovelo esquerdo", region: "MMSS", view: "posterior", side: "E", x: 164, y: 198 },

  // Pelve
  { key: "isquio_d", label: "Ísquio direito", region: "Pelve", view: "posterior", side: "D", x: 84, y: 312 },
  { key: "isquio_e", label: "Ísquio esquerdo", region: "Pelve", view: "posterior", side: "E", x: 116, y: 312 },
  { key: "trocanter_d", label: "Trocânter direito", region: "Pelve", view: "lateral_d", side: "D", x: 110, y: 300 },
  { key: "trocanter_e", label: "Trocânter esquerdo",region: "Pelve", view: "lateral_e", side: "E", x: 90, y: 300 },

  // MMII
  { key: "joelho_d", label: "Joelho direito", region: "MMII", view: "anterior", side: "D", x: 82, y: 388 },
  { key: "joelho_e", label: "Joelho esquerdo", region: "MMII", view: "anterior", side: "E", x: 118, y: 388 },
  { key: "maleolo_d", label: "Maléolo direito", region: "MMII", view: "lateral_d", side: "D", x: 108, y: 472 },
  { key: "maleolo_e", label: "Maléolo esquerdo", region: "MMII", view: "lateral_e", side: "E", x: 92, y: 472 },
  { key: "calcaneo_d", label: "Calcâneo direito", region: "MMII", view: "posterior", side: "D", x: 84, y: 488 },
  { key: "calcaneo_e", label: "Calcâneo esquerdo", region: "MMII", view: "posterior", side: "E", x: 116, y: 488 },
  { key: "dorso_pe_d", label: "Dorso pé direito", region: "MMII", view: "anterior", side: "D", x: 84, y: 488 },
  { key: "dorso_pe_e", label: "Dorso pé esquerdo", region: "MMII", view: "anterior", side: "E", x: 116, y: 488 },
];

export const LPP_SITE_BY_KEY = Object.fromEntries(LPP_SITES.map((s) => [s.key, s]));

export function sitesByView(view: LPPView): LPPSiteDef[] {
  return LPP_SITES.filter((s) => s.view === view);
}

/** Closest catalog site within `radius` to (x,y) on a given view. */
export function nearestSite(view: LPPView, x: number, y: number, radius = 22): LPPSiteDef | null {
  let best: LPPSiteDef | null = null;
  let bestD = radius * radius;
  for (const s of sitesByView(view)) {
    const dx = s.x - x, dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = s; }
  }
  return best;
}

// ============================================================================
// Stage colors
// ============================================================================

export const STAGE_META: Record<LPPStage, { label: string; short: string; color: string; className: string }> = {
 "1": { label: "Estágio 1 — Eritema não branqueável", short: "E1", color: "hsl(142 65% 42%)", className: "text-clinical-stable" },
 "2": { label: "Estágio 2 — Perda parcial de espessura", short: "E2", color: "hsl(45 95% 55%)", className: "text-clinical-attention" },
 "3": { label: "Estágio 3 — Perda total de espessura", short: "E3", color: "hsl(25 90% 55%)", className: "text-clinical-device" },
 "4": { label: "Estágio 4 — Perda total de tecido", short: "E4", color: "hsl(0 80% 55%)", className: "text-clinical-critical" },
 "NC": { label: "Não classificável", short: "NC", color: "hsl(0 0% 55%)", className: "text-muted-foreground" },
 "LTP":{ label: "Lesão tissular profunda", short: "LTP",color: "hsl(280 60% 60%)", className: "text-clinical-neuro" },
};

export function summarizeLPP(lesions: LPPLesion[] | undefined) {
  const list = lesions ?? [];
  const active = list.filter((l) => !l.resolvedAt);
  const resolved = list.filter((l) => l.resolvedAt);
  const byStage: Record<LPPStage, number> = { "1": 0, "2": 0, "3": 0, "4": 0, NC: 0, LTP: 0 };
  for (const l of active) byStage[l.stage] += l.count;
  const totalActive = active.reduce((a, b) => a + b.count, 0);
  return { active, resolved, byStage, totalActive };
}
