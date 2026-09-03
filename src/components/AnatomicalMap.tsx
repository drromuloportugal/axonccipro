import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { EquipmentBoard } from "@/components/EquipmentBoard";
import bodyAnterior from "@/assets/body-anterior.jpg.asset.json";
import bodyPosterior from "@/assets/body-posterior.jpg.asset.json";
import { Plus, Trash2 } from "lucide-react";
import { NeedleIcon, BandaidsIcon, VirusIcon } from "@phosphor-icons/react";

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
// Body figure — real anatomical illustration on the green stretcher pad.
// The bitmap is placed so that crown ≈ y10 and feet ≈ y490 inside the
// 200x510 viewBox, keeping every landmark in lib/anatomical.ts valid.
// ============================================================================

function BodyImage({ view }: { view: AnatView }) {
  const href = view === "anterior" ? bodyAnterior.url : bodyPosterior.url;
  return (
    <image
      href={href}
      x={13}
      y={-10.3}
      width={174}
      height={521}
      preserveAspectRatio="none"
      style={{ pointerEvents: "none" }}
    />
  );
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
  lpp, onEditLesion, alertDeviceIds,
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
  /** Dispositivos com tempo de permanência excedido — marcador pisca. */
  alertDeviceIds?: Set<string>;
}) {
  const infForView = (infections ?? []).filter((i) => SITE_META[i.site]?.view === view);
  const lppForView = (lpp ?? []).filter((l) => l.view === view);
  return (
 <div className="flex flex-col items-center">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> {label}
 </div>
 <svg viewBox="0 0 200 510" className="block h-[440px] w-full max-w-[220px]"> <BodyImage view={view} />

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
          const alert = !!alertDeviceIds?.has(d.id);
          return ms.map((m, i) => (
 <g key={`${d.id}-${i}`} opacity={dim ? 0.18 : 1} className={alert ? "svg-alert-blink" : undefined}>
              {alert && (
 <circle cx={m.x} cy={m.y} r={13} fill="none" stroke="rgb(220 38 38)" strokeWidth={2} strokeDasharray="3 2" /> )}
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
          const severe = !isResolved && ["3", "4", "NC", "LTP"].includes(String(l.stage));
          return (
 <g key={`lpp-${l.id}`} style={{ cursor: onEditLesion ? "pointer" : "default" }}
               className={severe ? "svg-alert-blink" : undefined}
               onClick={(e) => { e.stopPropagation(); onEditLesion?.(l); }}>
              {severe && (
 <circle cx={x} cy={y} r={13} fill="none" stroke="rgb(220 38 38)" strokeWidth={2} strokeDasharray="3 2" /> )}
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
  const [compare, setCompare] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [editingLPP, setEditingLPP] = useState<LPPLesion | null>(null);
  const [creatingLPP, setCreatingLPP] = useState<
    | { view: "anterior" | "posterior" | "lateral_d" | "lateral_e"; site: string; siteLabel: string }
    | null
  >(null);

  // View filters — allow toggling infection halos / device markers / LPP badges.
  const [showInfections, setShowInfections] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [showLPP, setShowLPP] = useState(true);

  // Cores/contadores derivam do tempo atual: renderizar só após hidratar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToId = (id: string) => {
    const container = scrollContainerRef.current;
    const el = document.getElementById(id);
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = container.scrollTop + (elRect.top - containerRect.top) - 16;
    container.scrollTo({ top, behavior: "smooth" });
  };

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
  const expiredIds = useMemo(() => new Set(expired.map((d) => d.id)), [expired]);
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

  if (!mounted) {
    return <div className="min-h-[420px] rounded-lg border border-border bg-surface" aria-hidden />;
  }

  return (
 <div className="grid gap-4 lg:grid-cols-[1fr_340px]"> {/* Left: dual-view SVG body */}
 <div className="anat-map-panel rounded-lg p-3">
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> Vista anterior · posterior
 </div>
 <div className="flex items-center gap-1.5"> {infections.length > 0 && (
 <button
                onClick={() => setHeatmap((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${heatmap ? "border-clinical-critical/40 bg-clinical-critical/10 text-clinical-critical" : "border-border text-muted-foreground hover:text-foreground"}`}
                title="Mostrar apenas focos ativos e dispositivos relacionados"
              > Heatmap infeccioso{heatmap ? " ativo" : ""}</button> )}
            {previousDevices && (
 <button
                onClick={() => setCompare((v) => !v)}
                className={`rounded-md border border-border px-2 py-0.5 text-[10px] ${compare ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                title="Comparar com semana anterior"
              >Semana anterior</button> )}
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
            > {f.label}{f.on ? " ativo" : ""}
 </button> ))}
 </div>


 <div className="grid items-start gap-2 lg:grid-cols-[minmax(150px,1fr)_auto_auto_minmax(150px,1fr)]">
 <EquipmentBoard patient={patient} devices={devices} side="left" />
  <BodyPanel
            label="Anterior" view="anterior"
            active={visibleDevices} removed={compare ? diff?.removed ?? [] : []}
            addedIds={addedIds} onSelect={() => {}}
            infections={visibleInfections} focusedDeviceIds={focusedDeviceIds}
            heatmap={heatmap} onSelectFocus={() => {}}
            lpp={visibleLPP} onEditLesion={onLPPChange ? setEditingLPP : undefined}
            alertDeviceIds={expiredIds}
          />
  <BodyPanel
            label="Posterior" view="posterior"
            active={visibleDevices} removed={compare ? diff?.removed ?? [] : []}
            addedIds={addedIds} onSelect={() => {}}
            infections={visibleInfections} focusedDeviceIds={focusedDeviceIds}
            heatmap={heatmap} onSelectFocus={() => {}}
            lpp={visibleLPP} onEditLesion={onLPPChange ? setEditingLPP : undefined}
            alertDeviceIds={expiredIds}
          />
 <EquipmentBoard patient={patient} devices={devices} side="right" />
 </div> {/* Invasões ativas e tempo de permanência */}
 <div className="anat-map-box mt-3 p-2">
  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
 <NeedleIcon size={13} weight="duotone" /> Invasões ativas · {active.length}
 </div> {active.length === 0 ? (
 <div className="text-[11px] text-muted-foreground">Nenhuma invasão ativa registrada.</div> ) : (
 <ul className="space-y-0.5 text-[11px]"> {active
               .map((d) => ({ d, def: deviceTypeByCode(d.typeCode), tc: deviceTimeColor(d) }))
               .sort((a, b) => b.tc.days - a.tc.days)
               .map(({ d, def, tc }) => (
  <li key={d.id} className={`flex items-center gap-2 ${expiredIds.has(d.id) ? "alert-outline px-1.5 py-0.5" : ""}`} title={expiredIds.has(d.id) ? "Tempo de permanência excedido" : undefined}>
  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tc.color }} />
  <span className="flex-1 truncate text-left text-foreground"> {def?.label ?? d.typeCode}{d.site ? ` · ${d.site}` : ""}
  </span>
 <span className="shrink-0 font-mono text-muted-foreground" suppressHydrationWarning> {Math.floor(tc.days)}d {Math.round(tc.hours % 24)}h
 </span>
 </li> ))}
 </ul> )}
  </div> {/* LPP e classificações */}
  <div className="anat-map-box mt-2 p-2">
   <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
  <BandaidsIcon size={13} weight="duotone" /> Lesões por pressão · {lppSummary.totalActive}
  </div> {lppSummary.active.length === 0 ? (
  <div className="text-[11px] text-muted-foreground">Nenhuma lesão por pressão ativa registrada.</div> ) : (
  <ul className="space-y-0.5 text-[11px]"> {lppSummary.active
             .slice()
             .sort((a, b) => String(b.stage).localeCompare(String(a.stage)))
             .map((l) => {
               const meta = STAGE_META[l.stage];
               const site = LPP_SITE_BY_KEY[l.site];
               const severe = ["3", "4", "NC", "LTP"].includes(String(l.stage));
               return (
  <li key={l.id} className={`flex items-center gap-2 ${severe ? "alert-outline px-1.5 py-0.5" : ""}`} title={severe ? "Lesão de maior gravidade" : undefined}>
  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: meta.color }} />
  <button
                     onClick={() => onLPPChange && setEditingLPP(l)}
                     className="flex-1 truncate text-left text-foreground hover:underline"
                   > {site?.label ?? l.site}{l.count > 1 ? ` ×${l.count}` : ""}
  </button>
  <span className="shrink-0 font-semibold" style={{ color: meta.color }}>{meta.label}</span>
  </li> );
             })}
  </ul> )}
  </div>

  {/* Infecções ativas — detalhamento abaixo de invasões e LPP */}
  <div className="anat-map-box mt-2 p-2">
   <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
  <VirusIcon size={13} weight="duotone" /> Infecções ativas · {infections.filter((i) => !i.resolvedAt).length}
  </div> {infections.filter((i) => !i.resolvedAt).length === 0 ? (
  <div className="text-[11px] text-muted-foreground">Nenhuma infecção ativa registrada.</div> ) : (
  <ul className="space-y-0.5 text-[11px]"> {infections
             .filter((i) => !i.resolvedAt)
             .map((f) => {
               const meta = SITE_META[f.site];
               const status = STATUS_COLOR[f.status];
               const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
               return (
   <li key={f.id} className={`flex items-center gap-2 ${f.unstable ? "alert-outline px-1.5 py-0.5" : ""}`} title={f.unstable ? "Infecção instável" : undefined}>
  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: status.hex }} />
  <span className="flex-1 truncate text-left text-foreground"> {meta?.label ?? f.site}{f.unstable ? " · instável" : ""}
  </span>
  <span className={`shrink-0 font-mono ${status.className}`}>{status.label}
  </span>
  <span className="shrink-0 font-mono text-muted-foreground">{fmt(f.startedAt)}
  </span>
  </li> );
             })}
  </ul> )}
  </div>


 </div> {/* Right: painel de rolagem lateral com detalhes permanentes */}
  <div className="space-y-2.5">
    {/* Indicadores: uma única faixa cobrindo Dispositivos · Infecção · LPP */}
    <div className="anat-map-box p-2">
      <div className="grid grid-cols-3 divide-x divide-border">
        <IndicatorBlock title="Dispositivos">
          <IndicatorPair label="Ativos" value={active.length} />
          <IndicatorPair label="Vencidos" value={expired.length} tone={expired.length ? "danger" : "default"} />
          <IndicatorPair label="S/ revisão" value={unreviewed.length} tone={unreviewed.length ? "warn" : "default"} />
        </IndicatorBlock>
        <IndicatorBlock title="Infecção"> {summary ? (
          <>
            <IndicatorPair label="Focos" value={summary.active} tone={summary.active ? "danger" : "default"} />
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
    </div>

    {/* Painel de rolagem lateral: detalhes de invasões, LPP e infecções */}
    <div className="anat-map-box max-h-[min(75vh,760px)] overflow-y-auto p-2">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Detalhes clínicos
      </div>
      <div className="space-y-2.5">
        {/* Invasões ativas — detalhes completos */}
        {active.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <NeedleIcon size={13} weight="duotone" /> Invasões ativas
            </div>
            {active
              .map((d) => ({ d, tc: deviceTimeColor(d) }))
              .sort((a, b) => b.tc.days - a.tc.days)
              .map(({ d }) => (
                <DetailPanel key={d.id} device={d} patient={patient} />
              ))}
          </div>
        )}

        {/* Lesões por pressão — detalhes */}
        {lppSummary.active.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <BandaidsIcon size={13} weight="duotone" /> Lesões por pressão
            </div>
            {lppSummary.active
              .slice()
              .sort((a, b) => String(b.stage).localeCompare(String(a.stage)))
              .map((l) => (
                <LPPCard key={l.id} lesion={l} />
              ))}
          </div>
        )}

        {/* Infecções ativas — detalhes completos */}
        {infections.filter((i) => !i.resolvedAt).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <VirusIcon size={13} weight="duotone" /> Infecções ativas
            </div>
            {infections
              .filter((i) => !i.resolvedAt)
              .map((f) => (
                <FocusPanel
                  key={f.id}
                  focus={f}
                  cultures={cultures}
                  meds={patient?.medications ?? []}
                  devices={active}
                />
              ))}
          </div>
        )}

        {/* Sugestões IRAS — sempre expandidas */}
        {deviceHints.length > 0 && (
          <div className="anat-map-box border-clinical-attention/30 bg-clinical-attention/5">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-clinical-attention">
              Avaliar IRAS · {deviceHints.length}
            </div>
            <ul className="space-y-1 px-2 pb-2 text-[11px]">
              {deviceHints.map((h, i) => {
                const def = deviceTypeByCode(h.device.typeCode);
                return (
                  <li key={i}>
                    <span className="font-semibold">{def?.label ?? h.device.typeCode}</span> {h.device.site ? ` · ${h.device.site}` : ""}
                    <span className="ml-1 text-muted-foreground" suppressHydrationWarning>— {h.reasons.join(" · ")}</span>
                  </li>
                );
              })}
              <li className="text-[10px] italic text-muted-foreground">Apoio à decisão clínica.</li>
            </ul>
          </div>
        )}

        {/* Linha do tempo infecciosa — sempre expandida */}
        {timeline.length > 0 && (
          <div className="anat-map-box">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Linha do tempo infecciosa · {timeline.length}
            </div>
            <div className="px-2 pb-2">
              <TimelinePanel events={timeline} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {active.length === 0 && lppSummary.active.length === 0 && infections.filter((i) => !i.resolvedAt).length === 0 && (
          <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
            Nenhuma invasão, lesão ou infecção ativa registrada.
          </div>
        )}
      </div>
    </div>
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
 <div className={`anat-map-box px-2 py-1.5 text-center ${cls}`}>
 <div className="text-lg font-semibold leading-none">{value}</div>
 <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
 </div> );
}

function DetailPanel({ device, patient, onClose }: { device: InvasiveDevice; patient?: Patient | null; onClose?: () => void }) {
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
 <div className="anat-map-box p-3 text-[12px]">
  <div className="mb-2 flex items-start justify-between gap-2">
  <div className="flex items-center gap-2">
  <span className="inline-block h-3 w-3 rounded-full" style={{ background: tc.color }} />
  <div>
  <div className="font-semibold text-foreground">{def?.label ?? device.typeCode}</div>
  </div>
  </div>
   {onClose && <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground" aria-label="Fechar">Fechar</button>}
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
  <li key={i} className={a.level === "danger" ? "text-clinical-critical" : a.level === "warn" ? "text-clinical-attention" : "text-clinical-neuro"}> {a.text}
 </li> ))}
 </ul> )}
 </div> );
}

function LPPCard({ lesion }: { lesion: LPPLesion }) {
  const meta = STAGE_META[lesion.stage];
  const def = LPP_SITE_BY_KEY[lesion.site];
  const severe = ["3", "4", "NC", "LTP"].includes(String(lesion.stage));
  return (
 <div className={`anat-map-box p-2.5 text-[11px] ${severe ? "alert-outline" : ""}`} title={severe ? "Lesão de maior gravidade" : undefined}>
  <div className="mb-1.5 flex items-start justify-between gap-2">
  <div className="flex items-center gap-2">
  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: meta.color }} />
  <div>
  <div className="font-semibold text-foreground">{def?.label ?? lesion.site}</div>
  <div className={`text-[10px] uppercase tracking-wider ${meta.className}`}>{meta.label}</div>
  </div>
  </div>
  {lesion.count > 1 && <span className="shrink-0 rounded-sm bg-surface-2 px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">×{lesion.count}</span>}
  </div>
  <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
  <dt className="text-muted-foreground">Identificada em</dt>
  <dd className="font-mono">{new Date(lesion.identifiedAt).toLocaleDateString("pt-BR")}</dd>
  <dt className="text-muted-foreground">Profissional</dt>
  <dd className="font-mono">{lesion.professional}</dd>
  {lesion.resolvedAt && (
  <>
  <dt className="text-muted-foreground">Resolvida em</dt>
  <dd className="font-mono">{new Date(lesion.resolvedAt).toLocaleDateString("pt-BR")}</dd>
  </>)}
  </dl>
  {lesion.notes && (
  <div className="mt-1.5 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">{lesion.notes}</div>
  )}
 </div> );
}

function Field({ k, v }: { k: string; v?: string | null }) {
  return (
 <>
 <dt className="text-muted-foreground">{k}</dt>
 <dd className="font-mono text-foreground">{v ?? "—"}</dd>
 </> );
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
  onClose?: () => void;
}) {
  const meta = SITE_META[focus.site];
  const status = STATUS_COLOR[focus.status];
  const focusCultures = culturesForFocus(focus, cultures);
  const atbs = focusAntibiotics(focus, meds);
  const related = devices.filter((d) => (focus.relatedDeviceIds ?? []).includes(d.id));
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
 <div className="anat-map-box p-3 text-[12px]">
  <div className="mb-2 flex items-start justify-between gap-2">
  <div className="flex items-center gap-2">
  <div>
  <div className="font-semibold text-foreground">{meta.label}</div>
  <div className={`text-[10px] uppercase tracking-wider ${status.className}`}> ● {status.label}{focus.unstable ? " · instável" : ""}
  </div>
  </div>
  </div>
   {onClose && <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground" aria-label="Fechar">Fechar</button>}
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
              return <li key={d.id}>● {def?.label ?? d.typeCode}{d.site ? ` · ${d.site}` : ""}</li>;
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
  atb_inicio: "", atb_fim: "", pcr: "",
  controle_foco: "", instabilidade: "", outro: "•",
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

