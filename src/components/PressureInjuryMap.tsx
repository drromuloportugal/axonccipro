import { useMemo, useState } from "react";
import type { LPPLesion, LPPStage, LPPView } from "@/data/patients";
import {
  LPP_SITES, LPP_SITE_BY_KEY, nearestSite, sitesByView,
  STAGE_META, summarizeLPP,
} from "@/lib/lpp";
import { PressureInjuryForm } from "@/components/PressureInjuryForm";
import { Trash2, Plus } from "lucide-react";

interface Props {
  lesions: LPPLesion[];
  onChange: (next: LPPLesion[]) => void;
}

// ----------------------------------------------------------------------------
// Body silhouettes (200×510 viewBox). Anterior/posterior reuse paths from the
// device map; lateral views are simplified profiles.
// ----------------------------------------------------------------------------

const HALF_PATH =
 "M100,12 C 116,12 124,22 124,40 C 124,54 120,62 116,66 L 113,72 L 112,84 " +
 "C 124,86 138,90 150,100 C 156,108 158,118 156,128 L 142,128 " +
 "C 144,150 142,178 138,200 C 134,220 130,232 128,244 " +
 "C 136,250 142,260 144,278 L 108,294 L 100,294 Z";
const ARM_PATH =
 "M152,108 C 160,128 164,150 166,180 C 168,210 170,238 172,262 " +
 "C 174,278 172,288 168,292 C 162,294 158,288 156,278 " +
 "C 154,260 152,238 150,212 C 148,188 146,160 144,134 Z";
const LEG_PATH =
 "M108,296 L142,296 C 142,330 138,360 134,390 " +
 "C 132,420 128,450 124,478 C 124,486 120,492 114,490 " +
 "L 108,488 L 108,460 C 108,420 110,380 110,340 Z";

function BodyAnterior() {
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface-2))";
  return (
 <g>
 <g fill={fill} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round">
 <path d={HALF_PATH} /><path d={HALF_PATH} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ARM_PATH} /><path d={ARM_PATH} transform="matrix(-1 0 0 1 200 0)" />
 <path d={LEG_PATH} /><path d={LEG_PATH} transform="matrix(-1 0 0 1 200 0)" />
 </g>
 <g stroke={stroke} strokeWidth={0.8} fill="none" opacity={0.55} strokeLinecap="round">
 <path d="M88,90 Q100,98 112,90" />
 <line x1="100" y1="100" x2="100" y2="160" strokeDasharray="2 3" />
 <circle cx="100" cy="222" r="1.4" fill={stroke} />
 </g>
 <g fill={stroke} opacity={0.6}>
 <circle cx="92" cy="38" r="1.3" /><circle cx="108" cy="38" r="1.3" />
 <path d="M94,60 Q100,63 106,60" stroke={stroke} strokeWidth={0.8} fill="none" />
 </g>
 </g>
  );
}
function BodyPosterior() {
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface-2))";
  return (
 <g>
 <g fill={fill} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round">
 <path d={HALF_PATH} /><path d={HALF_PATH} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ARM_PATH} /><path d={ARM_PATH} transform="matrix(-1 0 0 1 200 0)" />
 <path d={LEG_PATH} /><path d={LEG_PATH} transform="matrix(-1 0 0 1 200 0)" />
 </g>
 <g stroke={stroke} strokeWidth={0.8} fill="none" opacity={0.6} strokeLinecap="round">
 <line x1="100" y1="86" x2="100" y2="292" strokeDasharray="3 3" />
 <path d="M78,118 Q86,138 90,150" /><path d="M122,118 Q114,138 110,150" />
 <path d="M80,256 Q100,266 120,256" />
 <path d="M82,308 Q100,316 118,308" />
 </g>
 </g>
  );
}

// Simplified lateral profile: facing-right (lateral_d) or facing-left (lateral_e).
function BodyLateral({ facing }: { facing: "right" | "left" }) {
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface-2))";
  // Path facing-right (head looks to viewer's right). Mirrored for left.
  const PROFILE =
 "M100,12 " +
 "C 118,14 126,28 124,46 " +
 "C 122,58 116,66 112,72 " +
 "L 116,80 C 122,82 124,86 124,96 " +
 "C 122,104 116,108 110,112 " +
 "L 108,128 C 116,140 122,156 124,180 " +
 "C 126,210 124,238 120,266 " +
 "C 118,278 116,288 116,296 " +
 "L 124,300 C 126,330 124,360 120,392 " +
 "C 118,420 114,450 110,478 " +
 "C 110,486 108,492 104,490 " +
 "L 96,488 L 96,460 " +
 "C 96,422 92,382 90,348 " +
 "L 84,294 " +
 "C 80,270 76,240 78,200 " +
 "C 82,160 88,128 92,108 " +
 "L 88,90 C 84,82 84,76 88,72 " +
 "L 92,66 C 86,60 84,50 84,38 " +
 "C 84,22 90,14 100,12 Z";
  const transform = facing === "left" ? "matrix(-1 0 0 1 200 0)" : undefined;
  return (
 <g transform={transform}>
 <path d={PROFILE} fill={fill} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
 <g fill={stroke} opacity={0.6}>
 <circle cx="112" cy="40" r="1.3" />
 <path d="M114,52 Q117,56 114,60" stroke={stroke} strokeWidth={0.8} fill="none" />
 </g>
 </g>
  );
}

// ----------------------------------------------------------------------------

const VIEWS: { key: LPPView; label: string }[] = [
  { key: "anterior",  label: "Anterior" },
  { key: "posterior", label: "Posterior" },
  { key: "lateral_d", label: "Lateral D" },
  { key: "lateral_e", label: "Lateral E" },
];

export function PressureInjuryMap({ lesions, onChange }: Props) {
  const [view, setView] = useState<LPPView>("posterior");
  const [editing, setEditing] = useState<LPPLesion | null>(null);
  const [creatingAt, setCreatingAt] = useState<
    | { view: LPPView; site: string; siteLabel: string; x?: number; y?: number }
    | null
  >(null);

  const summary = useMemo(() => summarizeLPP(lesions), [lesions]);
  const lesionsForView = lesions.filter((l) => l.view === view);
  const catalogForView = sitesByView(view);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const { x, y } = pt.matrixTransform(ctm.inverse());
    const snap = nearestSite(view, x, y);
    setCreatingAt(snap
      ? { view, site: snap.key, siteLabel: snap.label }
      : { view, site: "livre", siteLabel: "Livre", x: Math.round(x), y: Math.round(y) });
  };

  const upsert = (lesion: LPPLesion) => {
    const exists = lesions.some((l) => l.id === lesion.id);
    onChange(exists ? lesions.map((l) => (l.id === lesion.id ? lesion : l)) : [...lesions, lesion]);
    setEditing(null);
    setCreatingAt(null);
  };
  const remove = (id: string) => onChange(lesions.filter((l) => l.id !== id));

  return (
 <div className="space-y-3">
      {/* Header */}
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex gap-1">
          {VIEWS.map((v) => (
 <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                view === v.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >{v.label}</button>
          ))}
 </div>
 <div className="text-[11px] text-muted-foreground">
 <b className="text-foreground">{summary.totalActive}</b> ativas ·{" "}
 <span>{summary.resolved.length} resolvidas</span>
 </div>
 </div>

 <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        {/* SVG body */}
 <div className="rounded-lg border border-border bg-surface p-3">
 <div className="mb-2 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Clique no corpo para registrar uma lesão
 </div>
 <svg
            viewBox="0 0 200 510"
            className="mx-auto block h-[460px] w-full max-w-[280px] cursor-crosshair"
            onClick={handleSvgClick}
          >
            {view === "anterior" && <BodyAnterior />}
            {view === "posterior" && <BodyPosterior />}
            {view === "lateral_d" && <BodyLateral facing="right" />}
            {view === "lateral_e" && <BodyLateral facing="left" />}

            {/* Catalog site hints (subtle) */}
            {catalogForView.map((s) => (
 <circle key={s.key} cx={s.x} cy={s.y} r={2.5}
                      fill="hsl(var(--muted-foreground))" opacity={0.25}
                      style={{ pointerEvents: "none" }} />
            ))}

            {/* Existing lesions */}
            {lesionsForView.map((l) => {
              const meta = STAGE_META[l.stage];
              const def = LPP_SITE_BY_KEY[l.site];
              const x = l.x ?? def?.x ?? 100;
              const y = l.y ?? def?.y ?? 100;
              const isResolved = !!l.resolvedAt;
              return (
 <g key={l.id} style={{ cursor: "pointer" }}
                   onClick={(e) => { e.stopPropagation(); setEditing(l); }}>
 <circle cx={x} cy={y} r={8}
                          fill={meta.color} fillOpacity={isResolved ? 0.2 : 0.85}
                          stroke="white" strokeWidth={1.2} />
                  {l.count > 1 && (
 <text x={x} y={y + 3} textAnchor="middle" fontSize="9"
                          fontWeight="700" fill="white" style={{ pointerEvents: "none" }}>
                      {l.count}
 </text>
                  )}
 </g>
              );
            })}
 </svg>

          {/* Legend */}
 <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {(Object.keys(STAGE_META) as LPPStage[]).map((s) => (
 <div key={s} className="flex items-center gap-1">
 <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STAGE_META[s].color }} />
 <span>{STAGE_META[s].short} — {STAGE_META[s].label.split("—")[0].trim()}</span>
 </div>
            ))}
 </div>
 </div>

        {/* Right: list + counters */}
 <div className="space-y-3">
 <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
            {(["1", "2", "3", "4", "NC", "LTP"] as LPPStage[]).map((s) => (
 <div key={s} className="rounded border border-border bg-surface px-1.5 py-1">
 <div className="font-bold" style={{ color: STAGE_META[s].color }}>{summary.byStage[s]}</div>
 <div className="text-[9px] text-muted-foreground">{STAGE_META[s].short}</div>
 </div>
            ))}
 </div>

 <div>
 <div className="mb-1.5 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lesões registradas
 </div>
 <button
                onClick={() => setCreatingAt({ view, site: "livre", siteLabel: "Livre" })}
                className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-3"
              ><Plus className="h-3 w-3" /> Nova</button>
 </div>
 <ul className="space-y-1">
              {lesions.length === 0 && (
 <li className="text-[11px] text-muted-foreground">Nenhuma lesão registrada.</li>
              )}
              {lesions.map((l) => {
                const meta = STAGE_META[l.stage];
                const def = LPP_SITE_BY_KEY[l.site];
                return (
 <li key={l.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px]">
 <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: meta.color, opacity: l.resolvedAt ? 0.3 : 1 }} />
 <div className="flex-1 min-w-0">
 <div className={`truncate font-medium ${l.resolvedAt ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {l.siteLabel ?? def?.label ?? l.site} · <span className={meta.className}>{meta.short}</span>
                        {l.count > 1 && <span> ×{l.count}</span>}
 </div>
 <div className="text-[9px] text-muted-foreground">
                        {new Date(l.identifiedAt).toLocaleDateString("pt-BR")} · {l.professional}
                        {l.evolutions?.length ? ` · ${l.evolutions.length} evol.` : ""}
 </div>
 </div>
 <button onClick={() => setEditing(l)} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-surface-3">
                      Editar
 </button>
 <button onClick={() => remove(l.id)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3 w-3" />
 </button>
 </li>
                );
              })}
 </ul>
 </div>
 </div>
 </div>

 <PressureInjuryForm
        open={!!creatingAt || !!editing}
        editing={editing}
        seed={creatingAt}
        onClose={() => { setEditing(null); setCreatingAt(null); }}
        onSave={upsert}
      />
 </div>
  );
}

// avoid unused warnings
void LPP_SITES;
