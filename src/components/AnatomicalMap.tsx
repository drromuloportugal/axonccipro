import { useMemo, useState, type ReactNode } from "react";
import type {
  InvasiveDevice, Patient, InfectionFocus, Culture, LPPLesion, LPPStage,
} from "@/data/patients";
import { deviceTypeByCode, deviceInfectionRisk } from "@/data/devices";
import {
  type AnatView, deviceMarkers, deviceTimeColor, deviceAlerts,
} from "@/lib/anatomical";
import {
  SITE_META, STATUS_COLOR, summarizeInfections,
  suggestDeviceRelatedInfection, focusAntibiotics, culturesForFocus,
} from "@/lib/infection";
import { STAGE_META, LPP_SITE_BY_KEY, summarizeLPP } from "@/lib/lpp";
import { PressureInjuryForm } from "@/components/PressureInjuryForm";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  devices: InvasiveDevice[];
  /** Devices from the previous reference (e.g. 7 days ago) for comparison mode. */
  previousDevices?: InvasiveDevice[];
  /** Optional patient context — enables infection layer, timeline, alerts. */
  patient?: Patient;
  /** Pressure injuries rendered on the body silhouette (mostly posterior). */
  lpp?: LPPLesion[];
  onLPPChange?: (next: LPPLesion[]) => void;
}


// ============================================================================
// Body silhouette — anatomically detailed Vesalius-style figure.
// viewBox 200x510, central axis x=100, crown y≈10, feet y≈490.
// All landmark coordinates remain compatible with POS in lib/anatomical.ts.
// ============================================================================

// --- Anterior half-body (right side of patient, viewer's left of figure) ---
const ANT_HALF =
  // crown
 "M100,10 " +
 "C 118,10 128,20 130,40 " +          // skull dome
 "C 130,52 128,60 124,66 " +          // temple to cheek
 "C 122,72 118,76 115,78 " +          // jaw line
 "L 113,84 " +                        // chin to neck
 "C 113,90 110,94 110,98 " +          // neck taper
  // trapezius slope to acromion
 "C 124,100 138,104 150,112 " +
  // deltoid cap
 "C 158,118 162,128 158,138 " +
  // axilla — separates arm from torso
 "L 144,134 " +
  // pectoral lower border / serratus
 "C 146,154 144,176 140,196 " +
  // flank / obliques to waist
 "C 136,216 132,232 130,248 " +
  // iliac crest flare
 "C 138,256 144,266 146,282 " +
  // inguinal crease to pubis
 "L 108,298 " +
 "L 100,298 " +
 "Z";

const ANT_ARM =
 "M152,116 " +
 "C 162,134 168,158 170,186 " +       // biceps to elbow
 "C 172,210 174,234 176,258 " +       // forearm extensor mass
 "C 178,274 176,286 172,292 " +       // wrist
 "C 168,298 162,298 158,294 " +       // thenar
 "C 154,288 152,278 150,266 " +       // hypothenar/palm
 "C 148,244 146,218 144,192 " +       // inner forearm
 "C 142,168 142,144 142,128 " +
 "Z";

const ANT_LEG =
 "M104,300 " +
 "L146,300 " +
 "C 146,326 144,354 140,384 " +       // outer thigh (vastus lat.)
 "C 138,402 136,418 134,432 " +       // knee approach
 "C 130,452 126,470 122,482 " +       // calf to ankle
 "C 122,490 118,494 112,492 " +       // foot top
 "L 106,490 " +
 "L 104,468 " +                       // inner ankle
 "C 104,440 106,412 108,386 " +       // inner calf
 "C 110,360 108,330 104,300 " +       // adductors back to groin
 "Z";

// --- Posterior half-body (slightly different silhouette for back muscles) ---
const POST_HALF =
 "M100,10 " +
 "C 118,10 128,20 130,40 " +
 "C 130,52 128,60 124,66 " +
 "L 122,78 " +                        // occipital base
 "C 122,86 116,92 112,96 " +          // nape of neck
 "C 124,100 138,104 150,112 " +
 "C 158,118 162,128 158,138 " +
 "L 144,134 " +
 "C 148,156 148,180 144,202 " +       // latissimus
 "C 140,222 134,238 130,252 " +
 "C 138,260 144,270 148,288 " +       // glute fold
 "L 108,300 " +
 "L 100,300 " +
 "Z";

function BodyAnterior() {
  const stroke = "hsl(var(--border))";
  const detail = "hsl(var(--border))";
  return (
 <g>
 <defs>
 <radialGradient id="skinAnt" cx="50%" cy="35%" r="75%">
 <stop offset="0%"stopColor="hsl(var(--surface-2))" stopOpacity="1" />
 <stop offset="65%" stopColor="hsl(var(--surface-2))" stopOpacity="0.9" />
 <stop offset="100%" stopColor="hsl(var(--surface-3, var(--surface-2)))" stopOpacity="0.7" />
 </radialGradient>
 <linearGradient id="muscleShadeAnt" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0%" stopColor="black" stopOpacity="0.08" />
 <stop offset="50%" stopColor="black" stopOpacity="0" />
 <stop offset="100%" stopColor="black" stopOpacity="0.08" />
 </linearGradient>
 </defs> {/* Body silhouette */}
 <g fill="url(#skinAnt)" stroke={stroke} strokeWidth={1.3} strokeLinejoin="round">
 <path d={ANT_HALF} />
 <path d={ANT_HALF} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ANT_ARM} />
 <path d={ANT_ARM} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ANT_LEG} />
 <path d={ANT_LEG} transform="matrix(-1 0 0 1 200 0)" />
 </g> {/* Lateral shading for volumetric depth */}
 <g fill="url(#muscleShadeAnt)" pointerEvents="none">
 <path d={ANT_HALF} />
 <path d={ANT_HALF} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ANT_LEG} />
 <path d={ANT_LEG} transform="matrix(-1 0 0 1 200 0)" />
 </g> {/* Anatomical detail — muscle groups, joints, surface landmarks */}
 <g stroke={detail} strokeWidth={0.7} fill="none" opacity={0.55} strokeLinecap="round"> {/* sternocleidomastoid (V at neck) */}
 <path d="M92,80 Q96,92 100,100" />
 <path d="M108,80 Q104,92 100,100" /> {/* clavicles */}
 <path d="M82,102 Q100,112 118,102" /> {/* deltoid contours */}
 <path d="M68,116 Q64,130 72,142" />
 <path d="M132,116 Q136,130 128,142" />
 <path d="M70,124 Q76,134 82,140" />
 <path d="M130,124 Q124,134 118,140" /> {/* pectoralis major — both sides */}
 <path d="M82,114 Q100,138 118,114" />
 <path d="M88,124 Q100,144 112,124" /> {/* sternum + xiphoid */}
 <line x1="100" y1="112" x2="100" y2="166" strokeDasharray="2 2.5" /> {/* costal margin / ribs */}
 <path d="M80,168 Q100,184 120,168" />
 <path d="M84,156 Q100,168 116,156" opacity={0.4} /> {/* serratus anterior hints */}
 <path d="M78,158 L82,164" /><path d="M78,166 L82,172" /><path d="M78,174 L82,180" />
 <path d="M122,158 L118,164" /><path d="M122,166 L118,172" /><path d="M122,174 L118,180" /> {/* linea alba + rectus abdominis */}
 <line x1="100" y1="172" x2="100" y2="240" strokeDasharray="1.5 2.2" />
 <path d="M92,184 Q100,188 108,184" />
 <path d="M92,200 Q100,204 108,200" />
 <path d="M92,216 Q100,220 108,216" /> {/* navel */}
 <circle cx="100" cy="226" r="1.6" fill={detail} /> {/* iliac crests + inguinal ligaments */}
 <path d="M78,266 Q100,278 122,266" />
 <path d="M84,282 Q100,294 116,282" /> {/* anterior superior iliac spine */}
 <circle cx="84" cy="270" r="0.9" fill={detail} />
 <circle cx="116" cy="270" r="0.9" fill={detail} /> {/* quadriceps (vastus medialis/lateralis groove) */}
 <path d="M82,326 Q86,360 84,396" />
 <path d="M118,326 Q114,360 116,396" />
 <path d="M94,326 Q96,360 96,396" opacity={0.45} />
 <path d="M106,326 Q104,360 104,396" opacity={0.45} /> {/* patella */}
 <ellipse cx="86" cy="404" rx="7" ry="5" />
 <ellipse cx="114" cy="404" rx="7" ry="5" /> {/* tibialis anterior crest */}
 <line x1="84" y1="416" x2="88" y2="476" strokeDasharray="1.5 2.5" />
 <line x1="116" y1="416" x2="112" y2="476" strokeDasharray="1.5 2.5" /> {/* malleoli + foot arch */}
 <circle cx="88" cy="480" r="1.2" fill={detail} />
 <circle cx="112" cy="480" r="1.2" fill={detail} />
 <path d="M80,488 Q90,496 100,490" />
 <path d="M120,488 Q110,496 100,490" /> {/* biceps / triceps groove on upper arm */}
 <path d="M156,128 Q162,150 164,180" opacity={0.45} />
 <path d="M44,128 Q38,150 36,180" opacity={0.45} /> {/* antecubital fossa */}
 <path d="M158,188 Q166,196 170,210" opacity={0.4} />
 <path d="M42,188 Q34,196 30,210" opacity={0.4} /> {/* wrist crease */}
 <path d="M166,278 Q170,282 172,286" />
 <path d="M34,278 Q30,282 28,286" />
 </g> {/* Facial features — eyes, nose, mouth, ears */}
 <g fill={detail} opacity={0.7}>
 <ellipse cx="91" cy="38" rx="2" ry="1.3" />
 <ellipse cx="109" cy="38" rx="2" ry="1.3" />
 <circle cx="91" cy="38" r="0.7" fill={detail} />
 <circle cx="109" cy="38" r="0.7" fill={detail} /> {/* brows */}
 <path d="M87,33 Q91,31 95,33" stroke={detail} strokeWidth={0.8} fill="none" />
 <path d="M105,33 Q109,31 113,33" stroke={detail} strokeWidth={0.8} fill="none" /> {/* nose */}
 <path d="M100,42 Q98,52 100,58 Q102,52 100,42" stroke={detail} strokeWidth={0.7} fill="none" />
 <path d="M97,58 Q100,60 103,58" stroke={detail} strokeWidth={0.7} fill="none" /> {/* mouth */}
 <path d="M93,66 Q100,70 107,66" stroke={detail} strokeWidth={0.9} fill="none" />
 <path d="M95,68 Q100,66 105,68" stroke={detail} strokeWidth={0.5} fill="none" opacity={0.5} /> {/* ears */}
 <path d="M77,40 Q74,46 76,54" stroke={detail} strokeWidth={0.8} fill="none" />
 <path d="M123,40 Q126,46 124,54" stroke={detail} strokeWidth={0.8} fill="none" /> {/* hairline */}
 <path d="M82,22 Q100,16 118,22" stroke={detail} strokeWidth={0.9} fill="none" opacity={0.55} />
 </g>
 </g> );
}

function BodyPosterior() {
  const stroke = "hsl(var(--border))";
  const detail = "hsl(var(--border))";
  return (
 <g>
 <defs>
 <radialGradient id="skinPost" cx="50%" cy="35%" r="75%">
 <stop offset="0%"stopColor="hsl(var(--surface-2))" stopOpacity="1" />
 <stop offset="65%" stopColor="hsl(var(--surface-2))" stopOpacity="0.9" />
 <stop offset="100%" stopColor="hsl(var(--surface-3, var(--surface-2)))" stopOpacity="0.7" />
 </radialGradient>
 </defs>

 <g fill="url(#skinPost)" stroke={stroke} strokeWidth={1.3} strokeLinejoin="round">
 <path d={POST_HALF} />
 <path d={POST_HALF} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ANT_ARM} />
 <path d={ANT_ARM} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ANT_LEG} />
 <path d={ANT_LEG} transform="matrix(-1 0 0 1 200 0)" />
 </g>

 <g stroke={detail} strokeWidth={0.7} fill="none" opacity={0.6} strokeLinecap="round"> {/* occipital protuberance + hairline */}
 <path d="M86,44 Q100,50 114,44" />
 <path d="M82,30 Q100,24 118,30" opacity={0.5} /> {/* trapezius — kite shape */}
 <path d="M86,98 Q100,116 114,98" />
 <path d="M76,116 Q100,140 124,116" /> {/* spine — vertebral column with vertebrae hints */}
 <line x1="100" y1="100" x2="100" y2="296" strokeDasharray="3 2.5" /> {[120, 140, 160, 180, 200, 220, 240, 260, 280].map((y) => (
 <circle key={y} cx="100" cy={y} r="0.9" fill={detail} /> ))}
        {/* scapulae (winged) */}
 <path d="M74,118 Q82,138 90,158 L94,156 Q86,134 78,116 Z" fill={detail} fillOpacity={0.06} />
 <path d="M126,118 Q118,138 110,158 L106,156 Q114,134 122,116 Z" fill={detail} fillOpacity={0.06} />
 <path d="M76,118 Q86,142 92,158" />
 <path d="M124,118 Q114,142 108,158" /> {/* infraspinatus border */}
 <path d="M82,150 Q92,158 96,162" opacity={0.45} />
 <path d="M118,150 Q108,158 104,162" opacity={0.45} /> {/* latissimus dorsi V */}
 <path d="M82,180 Q92,210 100,236" />
 <path d="M118,180 Q108,210 100,236" /> {/* lower back — erector spinae columns */}
 <path d="M94,200 Q94,236 96,260" opacity={0.5} />
 <path d="M106,200 Q106,236 104,260" opacity={0.5} /> {/* iliac crests with PSIS dimples */}
 <path d="M78,262 Q100,272 122,262" />
 <circle cx="92" cy="272" r="1" fill={detail} />
 <circle cx="108" cy="272" r="1" fill={detail} /> {/* sacrum triangle */}
 <path d="M94,278 L106,278 L100,298 Z" opacity={0.5} /> {/* gluteal cleft + folds */}
 <line x1="100" y1="298" x2="100" y2="338" strokeDasharray="2 2" />
 <path d="M82,332 Q100,344 118,332" /> {/* hamstrings */}
 <path d="M84,352 Q88,376 86,396" />
 <path d="M116,352 Q112,376 114,396" />
 <path d="M96,352 Q98,378 98,396" opacity={0.45} />
 <path d="M104,352 Q102,378 102,396" opacity={0.45} /> {/* popliteal fossa */}
 <path d="M76,400 Q86,406 94,400" />
 <path d="M124,400 Q114,406 106,400" /> {/* gastrocnemius (calf bellies) */}
 <path d="M82,424 Q76,446 82,466" />
 <path d="M118,424 Q124,446 118,466" />
 <path d="M92,424 Q92,446 94,466" opacity={0.45} />
 <path d="M108,424 Q108,446 106,466" opacity={0.45} /> {/* achilles tendon */}
 <line x1="88" y1="472" x2="90" y2="486" />
 <line x1="112" y1="472" x2="110" y2="486" /> {/* heels */}
 <ellipse cx="88" cy="488" rx="6" ry="3" />
 <ellipse cx="112" cy="488" rx="6" ry="3" /> {/* deltoids posterior view */}
 <path d="M66,118 Q60,132 68,144" opacity={0.5} />
 <path d="M134,118 Q140,132 132,144" opacity={0.5} /> {/* triceps groove */}
 <path d="M156,134 Q160,156 162,184" opacity={0.45} />
 <path d="M44,134 Q40,156 38,184" opacity={0.45} />
 </g>
 </g> );
}


// ============================================================================
// Marker shapes
// ============================================================================

function Marker({ x, y, shape, color, onClick, highlight }: {
  x: number; y: number; shape: string; color: string;
  onClick: () => void; highlight?: "added" | "removed";
}) {
  const ring = highlight === "added" ? "hsl(142 70% 45%)" : highlight === "removed" ? "hsl(0 80% 55%)" : null;
  const common = {
    fill: color, stroke: "white", strokeWidth: 1.5,
    style: { cursor: "pointer" as const, filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.45))" },
    onClick,
  };
  return (
 <g> {ring && <circle cx={x} cy={y} r={13} fill="none" stroke={ring} strokeWidth={1.8} strokeDasharray="2 2" />}
      {shape === "circle"&& <circle cx={x} cy={y} r={8} {...common} />}
      {shape === "ring"&& <circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={3} style={common.style} onClick={onClick} />}
      {shape === "square"&& <rect x={x - 7} y={y - 7} width={14} height={14} {...common} />}
      {shape === "diamond"&& <rect x={x - 7} y={y - 7} width={14} height={14} transform={`rotate(45 ${x} ${y})`} {...common} />}
      {shape === "triangle" && (
 <polygon points={`${x},${y - 9} ${x - 8},${y + 6} ${x + 8},${y + 6}`} {...common} /> )}
 </g> );
}

// ============================================================================
// Single-view body panel (anterior or posterior)
// ============================================================================

function BodyPanel({
  label, view, active, removed, addedIds, onSelect,
  infections, focusedDeviceIds, heatmap, onSelectFocus,
  lpp, onEditLesion,
}: {
  label: string;
  view: AnatView;
  active: InvasiveDevice[];
  removed: InvasiveDevice[];
  addedIds: Set<string>;
  onSelect: (d: InvasiveDevice) => void;
  infections?: InfectionFocus[];
  focusedDeviceIds?: Set<string>;
  heatmap?: boolean;
  onSelectFocus?: (f: InfectionFocus) => void;
  lpp?: LPPLesion[];
  onEditLesion?: (l: LPPLesion) => void;
}) {
  const infForView = (infections ?? []).filter((i) => SITE_META[i.site]?.view === view);
  const lppForView = (lpp ?? []).filter((l) => l.view === view);
  return (
 <div className="flex flex-col items-center">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> {label}
 </div>
 <svg viewBox="0 0 200 510" className="block h-[440px] w-full max-w-[220px]"> {view === "anterior" ? <BodyAnterior /> : <BodyPosterior />}

        {/* Infection halos — concentric rings with intensity scaled per status:
            suspeito (yellow, leve), provavel (laranja, médio), confirmado (vermelho, forte).
            Multiple foci at the same anchor are offset radially so they remain visible. */}
        {(() => {
          // count foci per anchor (label) to compute offsets
          const byKey = new Map<string, number>();
          return infForView.map((f) => {
            const meta = SITE_META[f.site];
            const c = STATUS_COLOR[f.status];
            const isActive = f.status !== "resolvido";
            const blink = !!f.unstable && isActive;
            const intensity =
              f.status === "confirmado" ? 3 :
              f.status === "provavel"? 2 :
              f.status === "suspeito"? 1 : 0;
            const key = `${meta.anchor.x}-${meta.anchor.y}`;
            const k = byKey.get(key) ?? 0;
            byKey.set(key, k + 1);
            const dx = k > 0 ? Math.cos((k * 2.4)) * 8 : 0;
            const dy = k > 0 ? Math.sin((k * 2.4)) * 8 : 0;
            const cx = meta.anchor.x + dx;
            const cy = meta.anchor.y + dy;
            const baseR = meta.radius + intensity * 3;
            const fillOpacity = isActive ? 0.08 + intensity * 0.07 : 0.05;
            const strokeOpacity = isActive ? 0.45 + intensity * 0.15 : 0.25;
            const strokeWidth = 1 + intensity * 0.6;
            return (
 <g key={`inf-${f.id}`} style={{ cursor: onSelectFocus ? "pointer" : "default" }}
                 onClick={() => onSelectFocus?.(f)}> {/* outer glow ring — only for provavel/confirmado */}
                {intensity >= 2 && isActive && (
 <circle cx={cx} cy={cy} r={baseR + 6}
                          fill={c.hex} fillOpacity={0.05}
                          stroke={c.hex} strokeOpacity={0.35}
                          strokeWidth={0.8} strokeDasharray="1 3" /> )}
 <circle cx={cx} cy={cy} r={baseR}
                        fill={c.hex} fillOpacity={fillOpacity}
                        stroke={c.hex} strokeOpacity={strokeOpacity}
                        strokeWidth={strokeWidth} strokeDasharray={intensity >= 3 ? "3 2" : "2 3"}> {blink && (
 <animate attributeName="fill-opacity"
                             values={`${fillOpacity};${Math.min(0.55, fillOpacity + 0.25)};${fillOpacity}`}
                             dur={intensity >= 3 ? "1.1s" : "1.6s"} repeatCount="indefinite" /> )}
 </circle>
 <circle cx={cx} cy={cy} r={Math.max(4, baseR * 0.4)}
                        fill={intensity >= 3 ? c.hex : "none"}
                        fillOpacity={intensity >= 3 ? 0.35 : 0}
                        stroke={c.hex} strokeOpacity={isActive ? 0.9 : 0.45}
                        strokeWidth={1.4 + intensity * 0.4}
                        strokeDasharray={intensity >= 2 ? undefined : "1.5 1.5"} /> {/* status badge dot for confirmado */}
                {intensity >= 3 && isActive && (
 <circle cx={cx} cy={cy} r={2.5} fill="white" stroke={c.hex} strokeWidth={1.2} /> )}
 </g> );
          });
        })()}

        {removed.map((d) => {
          const ms = deviceMarkers(d, view);
          const color = "hsl(0 80% 55%)";
          return ms.map((m, i) => (
 <g key={`rm-${d.id}-${i}`} opacity={0.45}>
 <Marker {...m} color={color} onClick={() => onSelect(d)} highlight="removed" />
 </g> ));
        })}

        {active.flatMap((d) => {
          const ms = deviceMarkers(d, view);
          const tc = deviceTimeColor(d);
          const dim = heatmap && focusedDeviceIds && !focusedDeviceIds.has(d.id);
          return ms.map((m, i) => (
 <g key={`${d.id}-${i}`} opacity={dim ? 0.18 : 1}>
 <Marker
                {...m}
                color={tc.color}
                onClick={() => onSelect(d)}
                highlight={addedIds.has(d.id) ? "added" : undefined}
              />
 </g> ));
        })}

        {/* Pressure injuries — hexagonal "wound" badge, visually distinct from device markers */}
        {lppForView.map((l) => {
          const meta = STAGE_META[l.stage];
          const def = LPP_SITE_BY_KEY[l.site];
          const x = l.x ?? def?.x ?? 100;
          const y = l.y ?? def?.y ?? 100;
          const isResolved = !!l.resolvedAt;
          const r = 9;
          const pts = [0, 60, 120, 180, 240, 300]
            .map((a) => {
              const rad = (a * Math.PI) / 180;
              return `${(x + r * Math.cos(rad)).toFixed(2)},${(y + r * Math.sin(rad)).toFixed(2)}`;
            })
            .join(" ");
          return (
 <g key={`lpp-${l.id}`} style={{ cursor: onEditLesion ? "pointer" : "default" }}
               onClick={(e) => { e.stopPropagation(); onEditLesion?.(l); }}>
 <polygon points={pts} fill="white" opacity={0.95}
                       style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))" }} />
 <polygon points={pts}
                       fill={meta.color} fillOpacity={isResolved ? 0.25 : 0.85}
                       stroke={meta.color} strokeWidth={1.6} strokeLinejoin="round" />
 <circle cx={x} cy={y} r={2} fill="white" opacity={isResolved ? 0.6 : 1} /> {l.count > 1 && (
 <text x={x + r + 1} y={y - r + 3} textAnchor="start" fontSize="9"
                      fontWeight="700" fill={meta.color} stroke="white" strokeWidth={2}
                      paintOrder="stroke" style={{ pointerEvents: "none" }}> ×{l.count}
 </text> )}
 </g> );
        })}
 </svg>
 </div> );
}


// ============================================================================
// Main component
// ============================================================================

export function AnatomicalMap({ devices, previousDevices, patient, lpp, onLPPChange }: Props) {
  const [selected, setSelected] = useState<InvasiveDevice | null>(null);
  const [compare, setCompare] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<InfectionFocus | null>(null);
  const [editingLPP, setEditingLPP] = useState<LPPLesion | null>(null);
  const [creatingLPP, setCreatingLPP] = useState<
    | { view: "anterior" | "posterior" | "lateral_d" | "lateral_e"; site: string; siteLabel: string }
    | null
  >(null);

  // View filters — allow toggling infection halos / device markers / LPP badges.
  const [showInfections, setShowInfections] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [showLPP, setShowLPP] = useState(true);

  const lppList = lpp ?? [];
  const lppSummary = useMemo(() => summarizeLPP(lppList), [lppList]);

  const upsertLesion = (l: LPPLesion) => {
    if (!onLPPChange) return;
    const exists = lppList.some((x) => x.id === l.id);
    onLPPChange(exists ? lppList.map((x) => (x.id === l.id ? l : x)) : [...lppList, l]);
    setEditingLPP(null);
    setCreatingLPP(null);
  };
  const removeLesion = (id: string) => onLPPChange?.(lppList.filter((x) => x.id !== id));


  const active = devices.filter((d) => !d.removedAt);
  const expired = active.filter((d) => {
    const def = deviceTypeByCode(d.typeCode);
    const max = d.recommendedMaxDays ?? def?.recommendedMaxDays ?? 7;
    return deviceTimeColor(d).days >= max;
  });
  const unreviewed = active.filter((d) => !d.insertedBy);

  const infections = patient?.infections ?? [];
  const cultures = patient?.cultures ?? [];
  const timeline = patient?.infectionTimeline ?? [];
  const summary = useMemo(() => (patient ? summarizeInfections(patient) : null), [patient]);
  const deviceHints = useMemo(() => (patient ? suggestDeviceRelatedInfection(patient) : []), [patient]);

  // Devices linked to ACTIVE infection foci (used for heatmap dimming).
  const focusedDeviceIds = useMemo(() => {
    const s = new Set<string>();
    infections.filter((i) => i.status !== "resolvido")
      .forEach((i) => (i.relatedDeviceIds ?? []).forEach((id) => s.add(id)));
    return s;
  }, [infections]);

  // In heatmap mode, only show active/suspect foci.
  const visibleInfections = showInfections
    ? (heatmap ? infections.filter((i) => i.status !== "resolvido") : infections)
    : [];
  const visibleDevices = showDevices ? active : [];
  const visibleLPP = showLPP ? lppList : [];

  // Compare with previous snapshot
  const diff = useMemo(() => {
    if (!compare || !previousDevices) return null;
    const prevIds = new Set(previousDevices.map((d) => d.id));
    const currIds = new Set(active.map((d) => d.id));
    return {
      added: active.filter((d) => !prevIds.has(d.id)),
      removed: previousDevices.filter((d) => !currIds.has(d.id) || devices.find((x) => x.id === d.id)?.removedAt),
    };
  }, [compare, previousDevices, active, devices]);

  const addedIds = new Set(diff?.added.map((d) => d.id) ?? []);

  return (
 <div className="grid gap-4 lg:grid-cols-[1fr_340px]"> {/* Left: dual-view SVG body */}
 <div className="rounded-lg border border-border bg-surface p-3">
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> Vista anterior · posterior
 </div>
 <div className="flex items-center gap-1.5"> {infections.length > 0 && (
 <button
                onClick={() => setHeatmap((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${heatmap ? "border-clinical-critical/40 bg-clinical-critical/10 text-clinical-critical" : "border-border text-muted-foreground hover:text-foreground"}`}
                title="Mostrar apenas focos ativos e dispositivos relacionados"
              > Heatmap infeccioso{heatmap ? " ✓" : ""}</button> )}
            {previousDevices && (
 <button
                onClick={() => setCompare((v) => !v)}
                className={`rounded-md border border-border px-2 py-0.5 text-[10px] ${compare ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                title="Comparar com semana anterior"
              >⇄ Semana ant.</button> )}
            {onLPPChange && (
 <button
                onClick={() => setCreatingLPP({ view: "posterior", site: "livre", siteLabel: "Livre" })}
                className="flex items-center gap-1 rounded-md border border-clinical-attention/40 bg-clinical-attention/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-attention hover:bg-clinical-attention/15"
                title="Registrar lesão por pressão"
              ><Plus className="h-3 w-3" /> Nova LPP</button> )}
 </div>
 </div> {/* Filtros de camadas — permitem esconder infecções, invasões e/ou LPP */}
 <div className="mb-2 flex flex-wrap items-center gap-1.5">
 <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Camadas:</span> {([
            { key: "inf", label: " Infecções", on: showInfections, toggle: () => setShowInfections((v) => !v),
              activeCls: "border-clinical-critical/50 bg-clinical-critical/15 text-clinical-critical" },
            { key: "dev", label: " Invasões", on: showDevices, toggle: () => setShowDevices((v) => !v),
              activeCls: "border-clinical-resp/50 bg-clinical-resp/15 text-clinical-resp" },
            { key: "lpp", label: " LPP", on: showLPP, toggle: () => setShowLPP((v) => !v),
              activeCls: "border-clinical-attention/50 bg-clinical-attention/15 text-clinical-attention" },
          ] as const).map((f) => (
 <button key={f.key} onClick={f.toggle}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                f.on ? f.activeCls : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            > {f.label}{f.on ? " ✓" : ""}
 </button> ))}
 </div>


 <div className="grid grid-cols-2 gap-2">
 <BodyPanel
            label="Anterior" view="anterior"
            active={visibleDevices} removed={compare ? diff?.removed ?? [] : []}
            addedIds={addedIds} onSelect={setSelected}
            infections={visibleInfections} focusedDeviceIds={focusedDeviceIds}
            heatmap={heatmap} onSelectFocus={setSelectedFocus}
            lpp={visibleLPP} onEditLesion={onLPPChange ? setEditingLPP : undefined}
          />
 <BodyPanel
            label="Posterior" view="posterior"
            active={visibleDevices} removed={compare ? diff?.removed ?? [] : []}
            addedIds={addedIds} onSelect={setSelected}
            infections={visibleInfections} focusedDeviceIds={focusedDeviceIds}
            heatmap={heatmap} onSelectFocus={setSelectedFocus}
            lpp={visibleLPP} onEditLesion={onLPPChange ? setEditingLPP : undefined}
          />
 </div> {/* Compact legend — collapsible to reduce noise */}
 <details className="mt-3 text-[10px] text-muted-foreground">
 <summary className="cursor-pointer select-none font-semibold uppercase tracking-wider hover:text-foreground"> Legenda
 </summary>
 <div className="mt-2 space-y-1.5">
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
 <span className="font-semibold uppercase tracking-wider">Tempo:</span>
 <Legend color="hsl(142 70% 45%)" label="0–3 d" />
 <Legend color="hsl(45 95% 55%)"label="4–7 d" />
 <Legend color="hsl(25 90% 55%)"label="8–10 d" />
 <Legend color="hsl(0 80% 55%)"label=">10 d" />
 <Legend color="hsl(280 60% 60%)" label="Sem revisão" />
 </div>
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
 <span className="font-semibold uppercase tracking-wider">Forma:</span>
 <span>● CVC/PICC</span><span>▲ PAI/PVP</span><span>■ Dreno</span>
 <span>◆ DVE/DLE/ECMO</span><span>○ TQT/Estomia</span>
 <span>⬢ LPP</span><span>◌ Foco infeccioso</span>
 </div> {infections.length > 0 && (
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
 <span className="font-semibold uppercase tracking-wider">Foco:</span>
 <Legend color={STATUS_COLOR.suspeito.hex}   label="Suspeito" />
 <Legend color={STATUS_COLOR.provavel.hex}   label="Provável" />
 <Legend color={STATUS_COLOR.confirmado.hex} label="Confirmado" />
 <Legend color={STATUS_COLOR.resolvido.hex}  label="Resolvido" />
 <span>· pulsando = instável</span>
 </div> )}
            {(lppList.length > 0 || onLPPChange) && (
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
 <span className="font-semibold uppercase tracking-wider">LPP:</span> {(["1", "2", "3", "4", "NC", "LTP"] as LPPStage[]).map((s) => (
 <Legend key={s} color={STAGE_META[s].color} label={STAGE_META[s].short} /> ))}
 </div> )}
 </div>
 </details>
 </div> {/* Right: enxuto — indicadores unificados, detalhe e seções recolhíveis */}
 <div className="space-y-2.5"> {/* Indicadores: uma única faixa cobrindo Dispositivos · Infecção · LPP */}
 <div className="rounded-md border border-border bg-surface p-2">
 <div className="grid grid-cols-3 divide-x divide-border">
 <IndicatorBlock title="Dispositivos">
 <IndicatorPair label="Ativos"value={active.length} />
 <IndicatorPair label="Vencidos" value={expired.length} tone={expired.length ? "danger" : "default"} />
 <IndicatorPair label="S/ revisão" value={unreviewed.length} tone={unreviewed.length ? "warn" : "default"} />
 </IndicatorBlock>
 <IndicatorBlock title="Infecção"> {summary ? (
 <>
 <IndicatorPair label="Focos"value={summary.active} tone={summary.active ? "danger" : "default"} />
 <IndicatorPair label="Cult. pend." value={summary.pendingCultures} tone={summary.pendingCultures ? "warn" : "default"} />
 <IndicatorPair label="ATB ativo" value={summary.activeAntibiotics} tone={summary.activeAntibiotics ? "warn" : "default"} />
 </> ) : (
 <div className="px-2 text-[11px] text-muted-foreground">—</div> )}
 </IndicatorBlock>
 <IndicatorBlock title="LPP">
 <IndicatorPair label="Ativas" value={lppSummary.totalActive} tone={lppSummary.totalActive ? "warn" : "default"} />
 <IndicatorPair label="E3+E4" value={lppSummary.byStage["3"] + lppSummary.byStage["4"]} tone={(lppSummary.byStage["3"] + lppSummary.byStage["4"]) ? "danger" : "default"} />
 <IndicatorPair label="Resolv." value={lppSummary.resolved.length} tone="ok" />
 </IndicatorBlock>
 </div>
 </div> {/* Painel de detalhe contextual */}
        {selectedFocus
          ? <FocusPanel focus={selectedFocus} cultures={cultures}
                        meds={patient?.medications ?? []}
                        devices={active}
                        onClose={() => setSelectedFocus(null)} /> : selected
            ? <DetailPanel device={selected} patient={patient} onClose={() => setSelected(null)} /> : <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"> Toque em um marcador para ver detalhes.
 </div>}

        {compare && diff && (
 <div className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px]">
 <span className="text-clinical-stable">+{diff.added.length} adicionados</span>
 <span className="mx-2 text-muted-foreground">·</span>
 <span className="text-clinical-critical">−{diff.removed.length} removidos</span>
 <span className="ml-2 text-[10px] text-muted-foreground">vs. semana anterior</span>
 </div> )}

        {/* Alertas — visíveis se existirem, sem container quando vazio */}
 <AlertsList devices={active} /> {/* Sugestões IRAS — collapsible */}
        {deviceHints.length > 0 && (
 <details className="rounded-md border border-clinical-attention/30 bg-clinical-attention/5">
 <summary className="cursor-pointer select-none px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-clinical-attention"> Avaliar IRAS · {deviceHints.length}
 </summary>
 <ul className="space-y-1 px-2 pb-2 text-[11px]"> {deviceHints.map((h, i) => {
                const def = deviceTypeByCode(h.device.typeCode);
                return (
 <li key={i}>
 <span className="font-semibold">{def?.code ?? h.device.typeCode}</span> {h.device.site ? ` · ${h.device.site}` : ""}
 <span className="ml-1 text-muted-foreground">— {h.reasons.join(" · ")}</span>
 </li> );
              })}
 <li className="text-[10px] italic text-muted-foreground">Apoio à decisão clínica.</li>
 </ul>
 </details> )}

        {/* LPP — lista detalhada agora dentro de collapsible para enxugar */}
        {(lppList.length > 0 || onLPPChange) && (
 <details className="rounded-md border border-border bg-surface" open={lppList.length > 0 && lppList.length <= 3}>
 <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5">
 <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Lesões por pressão
 </span>
 <span className="text-[10px] text-muted-foreground">
 <b className="text-foreground">{lppSummary.totalActive}</b> ativ. · {lppSummary.resolved.length} resolv.
 </span>
 </summary>
 <div className="px-2 pb-2"> {lppList.length === 0 ? (
 <div className="text-[11px] text-muted-foreground">Nenhuma lesão registrada.</div> ) : (
 <ul className="space-y-1"> {lppList.map((l) => {
                    const meta = STAGE_META[l.stage];
                    const def = LPP_SITE_BY_KEY[l.site];
                    return (
 <li key={l.id} className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2 py-1 text-[11px]">
 <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: meta.color, opacity: l.resolvedAt ? 0.3 : 1 }} />
 <div className="min-w-0 flex-1">
 <div className={`truncate ${l.resolvedAt ? "text-muted-foreground line-through" : "text-foreground"}`}> {l.siteLabel ?? def?.label ?? l.site} · <span className={meta.className}>{meta.short}</span> {l.count > 1 && <span> ×{l.count}</span>}
 </div>
 <div className="text-[9px] text-muted-foreground"> {new Date(l.identifiedAt).toLocaleDateString("pt-BR")} · {l.professional}
 </div>
 </div> {onLPPChange && (
 <>
 <button onClick={() => setEditingLPP(l)} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-surface-3"> Editar
 </button>
 <button onClick={() => removeLesion(l.id)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3 w-3" />
 </button>
 </> )}
 </li> );
                  })}
 </ul> )}
 </div>
 </details> )}

        {/* Linha do tempo — collapsible (fechada por padrão) */}
        {timeline.length > 0 && (
 <details className="rounded-md border border-border bg-surface">
 <summary className="cursor-pointer select-none px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Linha do tempo infecciosa · {timeline.length}
 </summary>
 <div className="px-2 pb-2">
 <TimelinePanel events={timeline} />
 </div>
 </details> )}
 </div> {onLPPChange && (
 <PressureInjuryForm
          open={!!creatingLPP || !!editingLPP}
          editing={editingLPP}
          seed={creatingLPP}
          onClose={() => { setEditingLPP(null); setCreatingLPP(null); }}
          onSave={upsertLesion}
          onDelete={(id) => removeLesion(id)}
        /> )}
 </div> );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
 <div className="flex items-center gap-1.5">
 <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
 <span>{label}</span>
 </div> );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "warn" | "danger" }) {
  const cls =
    tone === "danger" ? "text-clinical-critical border-clinical-critical/30 bg-clinical-critical/5"
    : tone === "warn" ? "text-clinical-attention border-clinical-attention/30 bg-clinical-attention/5"
    : "text-foreground";
  return (
 <div className={`rounded-md border border-border bg-surface px-2 py-1.5 text-center ${cls}`}>
 <div className="text-lg font-semibold leading-none">{value}</div>
 <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
 </div> );
}

function DetailPanel({ device, patient, onClose }: { device: InvasiveDevice; patient?: Patient | null; onClose: () => void }) {
  const def = deviceTypeByCode(device.typeCode);
  const tc = deviceTimeColor(device);
  const max = device.recommendedMaxDays ?? def?.recommendedMaxDays ?? 7;
  const inserted = new Date(device.insertedAt);
  const alerts = deviceAlerts(device, max);
  const risk = deviceInfectionRisk(device, patient);
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const nextChange = device.nextChangeAt
    ? new Date(device.nextChangeAt)
    : new Date(inserted.getTime() + max * 86400000);
  const lastReview = device.lastReviewedAt ? new Date(device.lastReviewedAt) : null;

  return (
 <div className="rounded-md border border-border bg-surface p-3 text-[12px]">
 <div className="mb-2 flex items-start justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="inline-block h-3 w-3 rounded-full" style={{ background: tc.color }} />
 <div>
 <div className="font-semibold text-foreground">{def?.label ?? device.typeCode}</div>
 <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{def?.code ?? device.typeCode}</div>
 </div>
 </div>
 <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">✕</button>
 </div>

 <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
 <Field k="Sítio anatômico" v={device.site} />
 <Field k="Lado"v={device.side === "D" ? "Direito" : device.side === "E" ? "Esquerdo" : "—"} />
 <Field k="Inserido em"v={fmt(inserted)} />
 <Field k="Permanência"v={`${Math.floor(tc.days)} dia(s) · ${Math.round(tc.hours)} h`} />
 <Field k="Limite protocolo" v={`${max} dias`} />
 <Field k="Próxima troca"v={fmt(nextChange)} />
 <Field k="Profissional"v={device.insertedBy ?? "— (revisão pendente)"} />
 <Field k="Última avaliação" v={lastReview ? fmt(lastReview) : "—"} />
 <Field k="Indicação clínica" v={device.indication} />
 <Field k="Técnica"v={device.technique} /> {typeof device.attempts === "number" && <Field k="Tentativas" v={`${device.attempts}`} />}
        {device.lumens && <Field k="Lúmens" v={`${device.lumens}`} />}
        {device.size && <Field k={def?.sizeLabel ?? "Calibre"} v={device.size} />}
 </dl>

 <div
        className="mt-2 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11px]"
        style={{ borderColor: risk.color, background: `${risk.color}10` }}
      >
 <span className="text-[14px] leading-none">{risk.emoji}</span>
 <div className="flex-1">
 <div className="font-semibold" style={{ color: risk.color }}> Risco infeccioso: {risk.label} · {risk.score}/10
 </div> {risk.reasons.length > 0 && (
 <div className="mt-0.5 text-[10px] text-muted-foreground"> {risk.reasons.join(" · ")}
 </div> )}
 </div>
 </div> {device.notes && (
 <div className="mt-2 rounded-sm bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground"> {device.notes}
 </div> )}
      {alerts.length > 0 && (
 <ul className="mt-2 space-y-0.5 text-[11px]"> {alerts.map((a, i) => (
 <li key={i} className={a.level === "danger" ? "text-clinical-critical" : a.level === "warn" ? "text-clinical-attention" : "text-clinical-neuro"}> {a.icon} {a.text}
 </li> ))}
 </ul> )}
 </div> );
}

function Field({ k, v }: { k: string; v?: string | null }) {
  return (
 <>
 <dt className="text-muted-foreground">{k}</dt>
 <dd className="font-mono text-foreground">{v ?? "—"}</dd>
 </> );
}

function AlertsList({ devices }: { devices: InvasiveDevice[] }) {
  const rows = devices.flatMap((d) => {
    const def = deviceTypeByCode(d.typeCode);
    const max = d.recommendedMaxDays ?? def?.recommendedMaxDays ?? 7;
    return deviceAlerts(d, max).map((a) => ({ d, a, def }));
  });
  if (!rows.length) {
    return <div className="rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] text-clinical-stable">✓ Sem alertas de dispositivos.</div>;
  }
  return (
 <div className="rounded-md border border-border bg-surface p-2">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alertas</div>
 <ul className="space-y-0.5 text-[11px]"> {rows.map((r, i) => (
 <li key={i} className={r.a.level === "danger" ? "text-clinical-critical" : r.a.level === "warn" ? "text-clinical-attention" : "text-clinical-neuro"}> {r.a.icon} {r.def?.code ?? r.d.typeCode}{r.d.site ? ` · ${r.d.site}` : ""} — {r.a.text}
 </li> ))}
 </ul>
 </div> );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: "default" | "ok" | "warn" | "danger" }) {
  const cls =
    tone === "danger" ? "text-clinical-critical"
    : tone === "warn" ? "text-clinical-attention"
    : tone === "ok"? "text-clinical-stable"
    : "text-foreground";
  return (
 <div className="rounded-sm bg-surface-2 px-1 py-1">
 <div className={`text-sm font-semibold leading-none ${cls}`}>{value}</div>
 <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
 </div> );
}

function IndicatorBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
 <div className="px-2 first:pl-0 last:pr-0">
 <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
 <div className="space-y-0.5">{children}</div>
 </div> );
}

function IndicatorPair({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" | "danger" }) {
  const cls =
    tone === "danger" ? "text-clinical-critical"
    : tone === "warn" ? "text-clinical-attention"
    : tone === "ok"? "text-clinical-stable"
    : "text-foreground";
  return (
 <div className="flex items-baseline justify-between gap-2 text-[11px]">
 <span className="text-muted-foreground">{label}</span>
 <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>
 </div> );
}

function FocusPanel({
  focus, cultures, meds, devices, onClose,
}: {
  focus: InfectionFocus;
  cultures: Culture[];
  meds: import("@/data/patients").Medication[];
  devices: InvasiveDevice[];
  onClose: () => void;
}) {
  const meta = SITE_META[focus.site];
  const status = STATUS_COLOR[focus.status];
  const focusCultures = culturesForFocus(focus, cultures);
  const atbs = focusAntibiotics(focus, meds);
  const related = devices.filter((d) => (focus.relatedDeviceIds ?? []).includes(d.id));
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
 <div className="rounded-md border border-border bg-surface p-3 text-[12px]">
 <div className="mb-2 flex items-start justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="text-lg" aria-hidden>{meta.icon}</span>
 <div>
 <div className="font-semibold text-foreground">{meta.label}</div>
 <div className={`text-[10px] uppercase tracking-wider ${status.className}`}> ● {status.label}{focus.unstable ? " · instável" : ""}
 </div>
 </div>
 </div>
 <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">✕</button>
 </div>

 <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
 <dt className="text-muted-foreground">Início</dt>
 <dd className="font-mono">{fmt(focus.startedAt)}</dd> {focus.resolvedAt && (<>
 <dt className="text-muted-foreground">Resolvido em</dt>
 <dd className="font-mono">{fmt(focus.resolvedAt)}</dd>
 </>)}
 </dl> {focus.notes && (
 <div className="mt-2 rounded-sm bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground">{focus.notes}</div> )}

      {related.length > 0 && (
 <div className="mt-2">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dispositivos relacionados</div>
 <ul className="mt-1 space-y-0.5 text-[11px]"> {related.map((d) => {
              const def = deviceTypeByCode(d.typeCode);
              return <li key={d.id}>● {def?.code ?? d.typeCode}{d.site ? ` · ${d.site}` : ""}</li>;
            })}
 </ul>
 </div> )}

      {focusCultures.length > 0 && (
 <div className="mt-2">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Culturas</div>
 <ul className="mt-1 space-y-1 text-[11px]"> {focusCultures.map((c) => (
 <li key={c.id} className="rounded-sm border border-border bg-surface-2 px-2 py-1">
 <div className="flex items-center justify-between">
 <span className="font-semibold">{c.source}</span>
 <span className="text-[10px] text-muted-foreground">{fmt(c.collectedAt)}</span>
 </div>
 <div className="text-muted-foreground"> {c.organism ?? "Aguardando crescimento"}
                  {c.resistanceProfile && c.resistanceProfile !== "pendente" && (
 <span className="ml-1 rounded-sm bg-clinical-critical/10 px-1 text-clinical-critical">{c.resistanceProfile.toUpperCase()}</span> )}
                  {c.resistanceProfile === "pendente" && (
 <span className="ml-1 rounded-sm bg-clinical-attention/10 px-1 text-clinical-attention">pendente</span> )}
 </div> {c.sensitivities?.length ? <div className="text-[10px] text-clinical-stable">S: {c.sensitivities.join(", ")}</div> : null}
                {c.resistances?.length   ? <div className="text-[10px] text-clinical-critical">R: {c.resistances.join(", ")}</div> : null}
 </li> ))}
 </ul>
 </div> )}

      {atbs.length > 0 && (
 <div className="mt-2">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Antimicrobianos ativos</div>
 <ul className="mt-1 space-y-1 text-[11px]"> {atbs.map((a, i) => (
 <li key={i}>
 <div className="flex items-center justify-between">
 <span className="font-semibold">{a.name}</span>
 <span className="font-mono text-[10px]">Dia {a.dayCurrent}/{a.dayTotal} · {a.percent}%</span>
 </div>
 <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
 <div className="h-full bg-clinical-attention" style={{ width: `${Math.min(100, a.percent)}%` }} />
 </div>
 </li> ))}
 </ul>
 </div> )}
 </div> );
}

const TIMELINE_ICON: Record<string, string> = {
  febre: "", cultura_coletada: "", cultura_positiva: "",
  atb_inicio: "", atb_fim: "✓", pcr: "",
  controle_foco: "✅", instabilidade: "⚡", outro: "•",
};

function TimelinePanel({ events }: { events: import("@/data/patients").InfectionTimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
 <div className="rounded-md border border-border bg-surface p-2">
 <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Linha do tempo infecciosa
 </div>
 <ol className="relative ml-1 space-y-1.5 border-l border-border pl-3"> {sorted.map((e, i) => (
 <li key={i} className="relative">
 <span className="absolute -left-[14px] mt-1 h-1.5 w-1.5 rounded-full bg-current text-clinical-attention" />
 <div className="flex items-baseline gap-2 text-[11px]">
 <span className="font-mono text-[10px] text-muted-foreground">{fmt(e.at)}</span>
 <span>{TIMELINE_ICON[e.kind] ?? "•"} {e.label}</span>
 </div>
 </li> ))}
 </ol>
 </div> );
}

