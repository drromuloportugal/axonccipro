import { useEffect, useMemo, useState } from "react";
import type { Patient, Severity, TimelineKind, InvasiveDevice, Medication } from "@/data/patients";
import { ChevronDown, ChevronRight, Activity, CircleDot, Pencil, Printer, Gauge, Sparkles, Download, Trash2, LogOut, Archive, FileText, History } from "lucide-react";
import { generateFamilyReport } from "@/lib/familyReport";
import { exportPatient } from "@/lib/patientIO";
import {
  examInsight, bucketBadge, trendArrow,
  computeAge, computeBMI, computeCrCl, daysSinceAdmission,
  antibioticProgress, atbAlertBadge, detectAntibiotic,
  deviceRisk,
  aiTherapySuggestions,
  medClassOf, MEDICATION_CLASS_META, MEDICATION_CLASS_ORDER,
  bristolMeta, computeFluidBalance, CONDUCT_SYSTEM_META, ANNOTATION_COLOR_META, formatDateBR,
  organDonationLabel, directiveLabel,
} from "@/lib/clinical";
import { currentVitalsSummary } from "@/components/SmartMonitoring";


import { summarizeLPP, STAGE_META } from "@/lib/lpp";
import {
  cultureResultBadge, detectCultureAlerts,
} from "@/lib/cultures";
import {
  DEVICE_CATEGORIES, categoryLabel, categoryIcon, deviceTypeByCode,
  type DeviceCategory,
} from "@/data/devices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PumpMonitor, PumpDashboard } from "@/components/PumpMonitor";
import { AnatomicalMap } from "@/components/AnatomicalMap";
import { ClinicalTrendChart } from "@/components/ClinicalTrendChart";
import { SofaPanel } from "@/components/SofaPanel";

import { IntubationJourney } from "@/components/IntubationJourney";
import { DischargeCheckModal, dischargeStatus } from "@/components/DischargeCheck";
import { Saps3Modal, Saps3Button } from "@/components/Saps3Panel";
import { FisherModal, FisherButton } from "@/components/FisherPanel";
import { HuntHessModal, HuntHessButton } from "@/components/HuntHessPanel";
import { WfnsModal, WfnsButton } from "@/components/WfnsPanel";
import { IchScoreModal, IchScoreButton } from "@/components/IchScorePanel";
import { NihssModal, NihssButton } from "@/components/NihssPanel";
import { MedicationAnalysisModal } from "@/components/MedicationAnalysis";
import { AntibioticHistory } from "@/components/AntibioticHistory";
import { BloodGasPanel } from "@/components/BloodGasPanel";
import { MacroStatusBar } from "@/components/MacroStatus";

import { Pill } from "lucide-react";


const VITAL_LEVEL_TXT: Record<string, string> = {
  normal: "text-clinical-stable",
  leve: "text-yellow-600",
  mod: "text-orange-600",
  grave: "text-clinical-critical",
  na: "text-muted-foreground",
};

const kindClass: Record<string, string> = {
  resp: "text-clinical-resp",
  stable: "text-clinical-stable",
  attention: "text-clinical-attention",
  device: "text-clinical-device",
  critical: "text-clinical-critical",
  neuro: "text-clinical-neuro",
  nutri: "text-clinical-nutri",
  neutral: "text-clinical-neutral",
};

const sevDot: Record<Severity, string> = {
  stable: "bg-clinical-stable",
  attention: "bg-clinical-attention",
  critical: "bg-clinical-critical",
};

const sevLabel: Record<Severity, string> = {
  stable: "Estável",
  attention: "Atenção",
  critical: "Crítico",
};

function Chip({ kind, children }: { kind: TimelineKind | "neutral"; children: React.ReactNode }) {
  return <span className={`chip ${kindClass[kind]}`}>{children}</span>;
}

const TITLE_GREENS = [
  "title-green-1", "title-green-2", "title-green-3", "title-green-4",
  "title-green-5", "title-green-6", "title-green-7",
] as const;

function ColTitle({ children, tone = 0 }: { children: React.ReactNode; tone?: number }) {
  return (
 <div className={`title-box ${TITLE_GREENS[tone % TITLE_GREENS.length]} mb-2`}> <span className="leading-tight">{children}</span>
 </div> );
}

function deviceSide(d: InvasiveDevice): string {
  const raw = (d as { side?: string }).side ?? "";
  const src = `${raw} ${d.site ?? ""}`.toUpperCase();
  if (/\b(D|DIR|DIREIT[AO])\b/.test(src)) return "D";
  if (/\b(E|ESQ|ESQUERD[AO])\b/.test(src)) return "E";
  return "";
}

/** Nome curto: sigla + lado (D/E) + lumens (nL) */
function deviceShort(d: InvasiveDevice): string {
  const def = deviceTypeByCode(d.typeCode);
  const code = def?.code ?? d.typeCode;
  const side = deviceSide(d);
  const lumens = d.lumens ? ` ${d.lumens}L` : "";
  return `${code}${side ? ` ${side}` : ""}${lumens}`;
}

const DEVICE_BAR: Record<string, string> = {
  green: "bg-clinical-stable",
  yellow: "bg-clinical-attention",
  orange: "bg-clinical-device",
  red: "bg-clinical-critical",
};

/** Caixa compacta do dispositivo com barra inferior de progresso dias/máximo */
function DeviceCompact({ d, mounted }: { d: InvasiveDevice; mounted: boolean }) {
  const r = deviceRisk(d);
  const days = Math.floor(r.days);
  const def = deviceTypeByCode(d.typeCode);
  const tip = `${def?.label ?? d.typeCode} · ${days}d · ${r.label}${r.semaphoreHint ? `\n${r.semaphoreHint}` : ""}`;
  return (
 <div className={`ios-inset px-1.5 pb-1 pt-1 ${mounted && r.days > r.max ? "alert-outline" : ""}`} title={tip}>
 <div className="flex items-baseline justify-between gap-1">
 <span className="min-w-0 flex-1 truncate f-var text-[11px] leading-snug">{deviceShort(d)}</span> {mounted && (
 <span className={`shrink-0 f-var text-[10px] ${r.className}`}>{days}/{r.max}d</span> )}

 </div>
 <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-surface-3"> {mounted && (
 <div
            className={`h-full rounded-full transition-all ${DEVICE_BAR[r.level]}`}
            style={{ width: `${Math.min(100, Math.max(4, r.percent))}%` }}
          /> )}
 </div>
 </div> );
}

export function PatientRow({
  patient,
  onEdit,
  onPrint,
  onUpdate,
  onDelete,
  onArchive,
  defaultOpen = false,
}: {
  patient: Patient;
  onEdit?: (p: Patient, tab?: string) => void;
  onPrint?: (p: Patient) => void;
  onUpdate?: (p: Patient) => void;
  onDelete?: (p: Patient) => void;
  onArchive?: (p: Patient) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pumpOpen, setPumpOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [medAnalysisOpen, setMedAnalysisOpen] = useState(false);
  const [atbHistOpen, setAtbHistOpen] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const setLppOpen = (v: boolean) => setMapOpen(v);
  const [intubOpen, setIntubOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [saps3Open, setSaps3Open] = useState(false);
  const [fisherOpen, setFisherOpen] = useState(false);
  const [huntHessOpen, setHuntHessOpen] = useState(false);
  const [wfnsOpen, setWfnsOpen] = useState(false);
  const [ichOpen, setIchOpen] = useState(false);
  const [nihssOpen, setNihssOpen] = useState(false);
  const dcStatus = useMemo(() => dischargeStatus(patient), [patient]);
  const dcBtnClass =
    dcStatus.status === "ready" ? "bg-clinical-stable/20 text-clinical-stable hover:bg-clinical-stable/30"
    : dcStatus.status === "blocked" ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
    : dcStatus.status === "progress" ? "bg-clinical-attention/15 text-clinical-attention hover:bg-clinical-attention/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  const dcBtnLabel =
    dcStatus.status === "ready" ? "Apto p/ alta"
    : dcStatus.status === "blocked" ? "Alta bloqueada"
    : dcStatus.status === "progress" ? `Alta ${dcStatus.pct}%`
    : "Checar Alta";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lppSummary = useMemo(() => summarizeLPP(patient.lpp), [patient.lpp]);

  const suggestions = useMemo(() => aiTherapySuggestions(patient), [patient]);
  const conductsDone = patient.conducts.filter((c) => c.done).length;
  const conductsPct = patient.conducts.length
    ? Math.round((conductsDone / patient.conducts.length) * 100)
    : 0;

  const activeMeds = patient.medications.filter((m) => m.active !== false);
  const activeDevices = (patient.devices ?? []).filter((d) => !d.removedAt);
  const removedDevices = (patient.devices ?? []).filter((d) => d.removedAt);

  const computedAge = computeAge(patient.birthDate) ?? patient.age;
  const bmi = computeBMI(patient.weight, patient.height);
  const dHosp = daysSinceAdmission(patient.admissionHosp) ?? patient.daysHosp;
  const dICU = daysSinceAdmission(patient.admissionICU) ?? patient.daysICU;

  const toggleConduct = (idx: number) => {
    if (!onUpdate) return;
    const conducts = patient.conducts.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    onUpdate({ ...patient, conducts });
  };

  const toggleSubItem = (idx: number, subIdx: number) => {
    if (!onUpdate) return;
    const conducts = patient.conducts.map((c, i) =>
      i === idx
        ? { ...c, subItems: (c.subItems ?? []).map((s, si) => (si === subIdx ? { ...s, done: !s.done } : s)) }
        : c,
    );
    onUpdate({ ...patient, conducts });
  };

  // Group devices by category for expanded view
  const devicesByCat = useMemo(() => {
    const map = new Map<DeviceCategory, InvasiveDevice[]>();
    for (const d of activeDevices) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return map;
  }, [activeDevices]);

  // Group medications by class for column 4
  const medsByClass = useMemo(() => {
    const map = new Map<string, Medication[]>();
    for (const m of activeMeds) {
      const cls = medClassOf(m);
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(m);
    }
    return map;
  }, [activeMeds]);

  // Fluid balance summary
  const fluidBalance = useMemo(() => computeFluidBalance(patient.state.fluidBalance), [patient.state.fluidBalance]);
  const crcl = useMemo(() => computeCrCl(patient), [patient]);
  const bhRate = useMemo(() => {
    const w = patient.weight;
    if (!w || !Number.isFinite(w) || w <= 0) return null;
    return fluidBalance.balance / w / 24; // mL/kg/h (janela de 24 h)
  }, [fluidBalance.balance, patient.weight]);
  const vitals = currentVitalsSummary(patient);
  const vitalRows = [
    { label: "Temp", v: vitals.temp },
    { label: "SpO₂", v: vitals.spo2 },
    { label: "FC", v: vitals.fc },
    { label: "FR", v: vitals.fr },
    { label: "PAS", v: vitals.pas },
    { label: "PAD", v: vitals.pad },
    { label: "PAM", v: vitals.bp },
  ];


  // Image lightbox
  const [zoomImg, setZoomImg] = useState<string | null>(null);


  const editBtn = (tab: string, title = "Editar este bloco") => onEdit ? (
 <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(patient, tab); }}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        title={title}
      >
 <Pencil className="h-3 w-3" />
 </button> ) : null;

  // On collapsed rows, any column click expands the row. Once expanded, a
  // column click opens the editor for that block.
  const colClick = (tab: string) => (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label, [role='button']")) return;
    e.stopPropagation();
    if (!open) {
      setOpen(true);
      return;
    }
    if (onEdit) onEdit(patient, tab);
  };




  // Compact header used inside every column for consistent spacing.
  const ColHead = ({
    label,
    tab,
    title,
    right,
    tone = 0,
  }: {
    label: string;
    tab: string;
    title: string;
    right?: React.ReactNode;
    tone?: number;
  }) => (
 <div className="mb-1.5 flex items-center justify-between gap-1.5">
 <span className={`title-box ${TITLE_GREENS[tone % TITLE_GREENS.length]} min-w-0 !text-[11px] leading-tight`}> {label}
 </span>
 <span className="flex shrink-0 items-center gap-0.5"> {right}
        {editBtn(tab, title)}
 </span>
 </div> );

  return (
 <div className="border-b border-border last:border-b-0"> {/* Collapsed row — 7 columns, separated by vertical dividers */}
      {!open && (
 <div
        className="grid w-full grid-cols-[1.5fr_1.25fr_1.25fr_1.4fr_1.25fr_1.35fr_1.3fr] items-start gap-2.5 px-4 py-3.5 text-left font-semibold [&>div]:min-w-0 [&>div]:overflow-hidden [&>div]:ios-card [&>div]:px-3.5 [&>div]:py-3 [&>div]:cursor-pointer [&>div:hover]:ios-card-hover"
      > {/* 1 - Identificação */}
 <div onClick={colClick("id")} className="col-ink flex min-w-0 flex-col px-3 first:pl-0 last:pr-0">

 <div className="mb-1.5 flex items-center justify-between gap-1.5">
 <span className="title-box title-green-1 min-w-0 !text-[11px] leading-tight"> 🪪 Identificação
 </span>
 <span className="flex shrink-0 items-center gap-0.5"> {onPrint && (
 <button type="button" onClick={(e) => { e.stopPropagation(); onPrint(patient); }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Imprimir paciente">
 <Printer className="h-3 w-3" />
 </button> )}
 <button type="button" onClick={(e) => { e.stopPropagation(); exportPatient(patient); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Exportar paciente (JSON)">
 <Download className="h-3 w-3" />
 </button> {onDelete && (
 <button type="button" onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Remover ${patient.name} (${patient.bed}) do sistema? Esta ação não pode ser desfeita.`)) onDelete(patient);
                }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-clinical-critical/15 hover:text-clinical-critical" title="Excluir paciente">
 <Trash2 className="h-3 w-3" />
 </button> )}
              {onArchive && (
 <button type="button" onClick={(e) => { e.stopPropagation(); onArchive(patient); }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Arquivar paciente (histórico)">
 <Archive className="h-3 w-3" />
 </button> )}
              {editBtn("id", "Editar identificação")}
 </span>
 </div>

 <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDischargeOpen(true); }}
            className={`mb-1.5 inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${dcBtnClass}`}
            title="Checar critérios de alta da UTI"
          >
 <LogOut className="h-3 w-3" /> {dcBtnLabel}
 </button>


  <div className="flex min-w-0 items-center gap-2 border-b-2 border-clinical-critical/70 pb-1.5">
  <span className={`h-2 w-2 shrink-0 rounded-full ${sevDot[patient.severity]}`} title={sevLabel[patient.severity]} />
  <span className="truncate text-lg font-extrabold leading-tight text-foreground">{patient.name}</span>
  </div>

 <div className="mt-1.5">
 <MacroStatusBar patient={patient} compact />
 </div>


 <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-muted-foreground">
 <span className="font-mono font-medium text-clinical-neutral">{patient.bed}</span>
 <span className="text-border">·</span>
 <span>{computedAge}a {patient.sex}</span>
 <span className="text-border">·</span>
 <span>{patient.weight}kg{patient.height ? `/${patient.height}cm` : ""}</span>
 </div>

 <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] leading-snug text-muted-foreground">
 <span title="Dias de internação hospitalar">Hosp <span className="font-mono font-semibold text-foreground">D{dHosp}</span></span>
 <span className="text-border">·</span>
 <span title="Dias de internação na UTI">UTI <span className="font-mono font-semibold text-foreground">D{dICU}</span></span>
 </div> {patient.origin && (
 <div className="mt-1 truncate text-[10px] leading-snug text-muted-foreground">
 <span className="font-semibold">Origem:</span>{" "}
              {[patient.origin.name ?? patient.origin.type, patient.origin.city, patient.origin.state]
                .filter(Boolean).join(" · ")}
 </div> )}

          {/* Gestão — scores */}
          <div className="mt-2 border-t border-border/60 pt-1.5" onClick={(e) => e.stopPropagation()}>
            <div className={`title-box title-green-1 mb-1 inline-flex !text-[10px]`}>⚙️ Gestão</div>
            <div className="flex flex-wrap items-start gap-1">
              <Saps3Button patient={patient} onClick={() => setSaps3Open(true)} compact />
              <FisherButton patient={patient} onClick={() => setFisherOpen(true)} compact />
              <HuntHessButton patient={patient} onClick={() => setHuntHessOpen(true)} compact />
              <WfnsButton patient={patient} onClick={() => setWfnsOpen(true)} compact />
              <IchScoreButton patient={patient} onClick={() => setIchOpen(true)} compact />
              <NihssButton patient={patient} onClick={() => setNihssOpen(true)} compact />
            </div>
          </div>

          {/* Procedimentos & eventos — movidos para o rodapé da coluna 01 */}

          {patient.procedures.length > 0 && (
 <div className="mt-2 border-t border-border/60 pt-1.5">
 <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"> Procedimentos & eventos
 </div>
 <div className="flex flex-wrap gap-1"> {patient.procedures.slice(-3).map((p, i) => (
 <Chip key={i} kind={p.kind}>{p.label}</Chip> ))}
                {patient.procedures.length > 3 && (
 <span className="text-[10px] text-muted-foreground">+{patient.procedures.length - 3}</span> )}
 </div>
 </div> )}
 </div> {/* 2 - História */}
 <div onClick={colClick("hist")} className="flex min-w-0 flex-col">

 <ColHead label="📋 História" tab="hist" title="Editar história" tone={1} />
 <div className="flex flex-wrap gap-1"> {patient.diagnoses.slice(-3).map((d, i) => (
 <Chip key={i} kind={d.kind}>{d.label}</Chip> ))}
            {patient.diagnoses.length === 0 && (
 <span className="text-[11px] italic text-muted-foreground/60">Sem diagnósticos</span> )}
 </div>
 </div> {/* 3 - Invasões / Dispositivos */}
 <div onClick={colClick("proc")} className="flex min-w-0 flex-col gap-1.5">

 <ColHead
            label="🧷 Invasões"
            tab="proc"
            title="Editar dispositivos invasivos"
            tone={2}
            right={
 <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIntubOpen(true); }}
                className="rounded p-0.5 text-clinical-critical hover:bg-clinical-critical/15"
                title="Jornada de intubação"
              >
                
 </button> }
          />
 <div className="space-y-0.5"> {activeDevices.slice(0, 4).map((d) => (
 <DeviceCompact key={d.id} d={d} mounted={mounted} /> ))}
            {activeDevices.length > 4 && (
 <div className="text-[10px] text-muted-foreground">+{activeDevices.length - 4} dispositivo(s)</div> )}
            {activeDevices.length === 0 && (
 <span className="text-[11px] italic text-muted-foreground/60">Sem dispositivos</span> )}
 </div>
 </div> {/* 4 - Medicações com dashboard de bombas */}
 <div onClick={colClick("med")} className="flex min-w-0 flex-col gap-1.5">
 <ColHead
            label="💊 Medicações"
            tab="med"
            title="Editar medicações"
            tone={3}
            right={
 <div className="flex items-center gap-1">
 <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMedAnalysisOpen(true); }}
                  className="rounded p-0.5 text-primary hover:bg-primary/15"
                  title="Análise Medicamentosa"
                >
 <Pill className="h-3 w-3" />
 </button>
 <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAiOpen(true); }}
                  className="rounded p-0.5 text-clinical-attention hover:bg-clinical-attention/15"
                  title="Ajustar terapia (IA)"
                >
 <Sparkles className="h-3 w-3" />
 </button>
 </div> }
          />

 <div onClick={(e) => e.stopPropagation()}>
 <PumpDashboard patient={patient} onOpen={() => setPumpOpen(true)} />
 </div>

 <div className="space-y-1.5"> {MEDICATION_CLASS_ORDER.map((cls) => {
              const list = medsByClass.get(cls);
              if (!list || !list.length) return null;
              const meta = MEDICATION_CLASS_META[cls];
              return (
 <div key={cls} className={`rounded border ${meta.borderClass} ${meta.bgClass} px-1.5 py-1`}>
 <div className={`mb-0.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider ${meta.className}`}>
 <span>{meta.short}</span>
 <span className="font-mono">{list.length}</span>
 </div> {list.slice(0, 3).map((m, i) => {
                    const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
                    const prog = isAtb ? antibioticProgress(m) : null;
                    return (
 <div key={i} className="text-[10.5px] leading-snug">
 <div className="flex items-center gap-1">
 <CircleDot className={`h-1.5 w-1.5 shrink-0 ${kindClass[m.kind]}`} />
 <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{m.name}</span>
 <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground"> {m.mlPerHour !== undefined ? `${m.mlPerHour.toFixed(1)} mL/h` : m.dose}
 </span>
 </div> {mounted && prog && (
 <div className="ml-2.5 text-[8.5px] font-mono text-muted-foreground"> D{prog.currentDay}/{prog.totalDays}
 </div> )}
 </div> );
                  })}
                  {list.length > 3 && (
 <div className="text-[9px] text-muted-foreground">+{list.length - 3}</div> )}
 </div> );
            })}
            {activeMeds.length === 0 && (
 <span className="text-[11px] italic text-muted-foreground/60">Sem medicações ativas</span> )}
 </div>
 </div> {/* 5 - Culturas → Lab → Gasometria → Imagem */}
 <div onClick={colClick("exam")} className="flex min-w-0 flex-col gap-1">

 <ColHead label="🦠 Culturas · Imagem" tab="exam" title="Editar exames" tone={4} /> {/* 1) Culturas */}
          {(patient.cultures?.length ?? 0) > 0 && (
 <div className="space-y-0.5"> {patient.cultures!.slice(-2).reverse().map((c) => {
                const r = cultureResultBadge(c);
                return (
 <div key={c.id} className={`flex items-center gap-1 rounded-md text-[10.5px] leading-snug ${r.label === "Positiva" ? "alert-outline-static px-1 py-0.5" : ""}`} title={c.organism ?? c.source}>
 <span className="min-w-0 flex-1 truncate">
 <span className="font-semibold text-foreground"> {c.source}</span> {c.organism ? <span className="text-muted-foreground"> · {c.organism}</span> : null}
 </span>
 </div> );
              })}
 </div> )}


          {/* 4) Imagem */}
          {(patient.imaging?.length ?? 0) > 0 && (
 <div className="mt-1 space-y-0.5"> {patient.imaging!.slice(0, 2).map((im) => (
 <div key={im.id} className={`flex items-center gap-1 rounded text-[10.5px] leading-snug ${im.outcome === "mau" ? "alert-outline px-1" : ""}`} title={im.outcome === "mau" ? "Mau resultado esperado" : undefined}>
 <span className="shrink-0"> {im.conclusion === "critico" ? "" : im.conclusion === "alterado" ? "" : im.conclusion === "normal" ? "" : ""}
 </span>
 <span className="min-w-0 flex-1 truncate" title={im.summary}>
 <span className="font-semibold text-foreground">{im.modality}</span>
 <span className="text-muted-foreground"> {im.region}</span>
 </span> {im.images && im.images.length > 0 && (
 <span className="shrink-0 rounded bg-clinical-resp/15 px-1 text-[8.5px] font-bold text-clinical-resp"> {im.images.length}
 </span> )}
 </div> ))}
 </div> )}
 </div> {/* 6 - Estado atual (Sinais vitais) · Bristol · Balanço hídrico · Notas */}
 <div onClick={colClick("sup")} className="flex min-w-0 flex-col gap-1">
 <ColHead label="📈 Estado atual" tab="sup" title="Editar estado atual" tone={5} /> {/* Estado atual — sinais vitais (linhas) */}
 <div className="ios-inset px-1.5 py-1">
 <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground"> Sinais vitais</div>
 <div> {vitalRows.map((r) => (
 <div key={r.label} className="grid grid-cols-[34px_1fr_auto] items-baseline gap-x-1 py-[1px] text-[10px]">
 <span className="f-fixed font-semibold text-muted-foreground">{r.label}</span>
 <span className={`truncate text-right font-mono font-bold tabular-nums ${VITAL_LEVEL_TXT[r.v.level]}`}> {r.v.text.split("·")[0].trim()}
 </span>
 <span className="w-2 text-right">{r.v.level === "grave" && <span className="alert-dot" title="Alteração grave" />}</span>
 </div> ))}
              {crcl && (
 <div className="mt-0.5 grid grid-cols-[34px_1fr_auto] items-baseline gap-x-1 border-t border-border/50 pt-0.5 text-[10px]">
 <span className="f-fixed font-semibold text-muted-foreground">ClCr</span>
 <span className="text-right font-mono font-bold tabular-nums text-foreground" title={`Cockcroft-Gault · Cr ${crcl.creat} mg/dL`}> {crcl.value}
 </span>
 <span className="w-2" />
 </div> )}
 </div>
 </div> {/* Laboratoriais + Gasometria (compacto) */}
          {(() => {
            const isGaso = (code?: string, label?: string) => /pH|PaO2|PaCO2|HCO3|SatO2|Lact|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(code ?? label ?? "");
            const lab = patient.exams.filter((e) => !isGaso(e.code, e.label)).slice(0, 3);
            const gaso = patient.exams.filter((e) => isGaso(e.code, e.label)).slice(0, 3);
            const rows = (list: typeof patient.exams) => list.map((e, i) => {
              const ins = examInsight(e, patient.sex);
              const b = ins.bucket ? bucketBadge(ins.bucket) : null;
              const abn = !!ins.bucket && ins.bucket !== "normal";
              return (
 <div key={i} className={`flex items-baseline justify-between gap-1 rounded text-[10px] ${abn ? "alert-outline px-1" : ""}`} title={abn ? `Resultado alterado · ${b?.label}` : undefined}>
 <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.label}</span>
 <span className={`shrink-0 font-mono font-bold ${b?.className ?? "text-foreground"}`}>{e.value}</span>
 </div> );
            });
            return (
 <> {lab.length > 0 && (
 <div className="ios-inset px-1.5 py-1">
 <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground">Laboratoriais</div>
 <div className="space-y-0.5">{rows(lab)}</div>
 </div> )}
                {gaso.length > 0 && (
 <div className="ios-inset px-1.5 py-1">
 <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-clinical-resp">Gasometria</div>
 <div className="space-y-0.5">{rows(gaso)}</div>
 </div> )}
 </> );
          })()} {/* Escala de Bristol — linhas temporais */}
          {(patient.state.stools?.length ?? 0) > 0 && (
 <div className="ios-inset px-1.5 py-1">
 <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground"> Bristol</div>
 <div className="space-y-0.5"> {patient.state.stools!.map((st) => {
                  const m = bristolMeta(st.bristol);
                  return (
 <div key={st.id} className="flex items-baseline justify-between gap-1 text-[10px]">
 <span className={`font-semibold ${m?.className ?? "text-foreground"}`}>{m ? `Tipo ${m.value}` : "—"}</span>
 <span className="font-mono text-muted-foreground">{st.volume ?? "—"}</span>
 <span className="text-[8.5px] text-muted-foreground">{st.at ? new Date(st.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
 </div> );
                })}
 </div>
 </div> )}
          {/* Balanço hídrico — linhas */}
          {patient.state.fluidBalance && (fluidBalance.totalIntake || fluidBalance.totalOutput || fluidBalance.totalDrains) ? (
 <div className="ios-inset px-1.5 py-1">
 <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground"> Balanço hídrico</div>
 <div className="space-y-0.5 text-[10px] font-mono font-semibold">
 <div className="flex items-baseline justify-between gap-1">
 <span className="text-clinical-resp">Entradas</span>
 <span className="text-foreground">+{fluidBalance.totalIntake} mL</span>
 </div>
 <div className="flex items-baseline justify-between gap-1">
 <span className="text-clinical-attention">Saídas</span>
 <span className="text-foreground">−{fluidBalance.totalOutput} mL</span>
 </div>
 <div className="flex items-baseline justify-between gap-1">
 <span className="text-clinical-device">Drenos</span>
 <span className="text-foreground">−{fluidBalance.totalDrains} mL</span>
 </div>
 <div className={`flex items-baseline justify-between gap-1 border-t border-border pt-0.5 font-bold ${
                  fluidBalance.balance > 500 ? "text-clinical-attention"
                  : fluidBalance.balance < -500 ? "text-clinical-critical"
                  : "text-clinical-stable"
                }`}>
 <span>BH</span>
 <span> {bhRate != null
                      ? `${bhRate >= 0 ? "+" : ""}${bhRate.toFixed(2)} mL/kg/h`
                      : `${fluidBalance.balance >= 0 ? "+" : ""}${fluidBalance.balance} mL`}
 </span>
 </div>
 </div>
 </div> ) : null}
          {patient.state.notes && (
 <div className="mt-1 text-[10px] italic text-muted-foreground line-clamp-3"> {patient.state.notes}
 </div> )}
 </div> {/* 7 - Plano · Tarefas */}
 <div onClick={colClick("plan")} className="flex min-w-0 flex-col">
 <ColHead
            label="✅ Plano · Condutas"
            tab="plan"
            title="Editar plano e tarefas"
            right={<span className="font-mono text-[10px] text-foreground">{conductsPct}%</span>}
          />
 <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
 <span>{conductsDone}/{patient.conducts.length} tarefas</span>
 </div>
 <div className="bar-track">
 <div className="h-full bg-clinical-stable transition-all" style={{ width: `${conductsPct}%` }} />
 </div>


 <ul className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}> {patient.conducts.slice(0, 4).map((c, i) => {
              const meta = c.system ? CONDUCT_SYSTEM_META[c.system] : CONDUCT_SYSTEM_META.other;
              const firstAnn = c.subItems?.find((s) => s.text?.trim());
              const annColor = firstAnn?.color ? ANNOTATION_COLOR_META[firstAnn.color] : null;
              return (
 <li key={i} className={`flex items-start gap-1.5 rounded border px-1.5 py-0.5 text-[11px] leading-snug ${meta.borderClass} ${meta.bgClass}`}>
 <input
                    type="checkbox"
                    checked={c.done}
                    onChange={() => toggleConduct(i)}
                    disabled={!onUpdate}
                    className="mt-[3px] h-2.5 w-2.5 shrink-0 cursor-pointer accent-clinical-stable"
                  />
 <span className="min-w-0 flex-1">
  <span className={`mr-1 text-[9px] font-bold uppercase tracking-wider ${meta.className}`}>{meta.short}</span> {firstAnn ? (
 <span className={`truncate ${annColor?.textClass ?? "text-foreground"}`}>{firstAnn.text}</span> ) : (
 <span className="italic text-muted-foreground">Sem anotações</span> )}
                    {c.subItems && c.subItems.length > 1 && (
 <span className="ml-1 text-[9px] text-muted-foreground">· +{c.subItems.length - 1}</span> )}
 </span>
 </li> );
            })}
            {patient.conducts.length > 4 && (
 <li className="text-[10px] text-muted-foreground">+{patient.conducts.length - 4} sistema(s)</li> )}
 </ul>


 <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="mt-auto flex items-center gap-1 pt-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            title={open ? "Recolher linha" : "Expandir linha"}
          > {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? "Recolher" : "Expandir"}
 </button>

 </div>
 </div> )}


      {/* Expanded */}
      {open && (
 <div className="border-t border-border bg-surface-2/40">
 <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-surface/60 px-5 py-2">
 <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-[11px] font-semibold text-foreground hover:text-primary"
          >
 <ChevronDown className="h-3.5 w-3.5" />
 <span className={`h-2 w-2 rounded-full ${sevDot[patient.severity]}`} />
 <span className="text-base font-extrabold">{patient.name}</span>
 <span className="font-mono text-muted-foreground">· {patient.bed}</span>
 <span className="text-muted-foreground">· {sevLabel[patient.severity]}</span>
 </button>
 <div className="min-w-0 flex-1">
 <MacroStatusBar patient={patient} compact />
 </div>
 <div className="flex items-center gap-1"> {onPrint && (
 <button type="button" onClick={() => onPrint(patient)}
                className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Imprimir">
 <Printer className="h-3.5 w-3.5" />
 </button> )}
 <button type="button" onClick={() => exportPatient(patient)}
              className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Exportar JSON">
 <Download className="h-3.5 w-3.5" />
 </button> {onEdit && (
 <button type="button" onClick={() => onEdit(patient)}
                className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Editar">
 <Pencil className="h-3.5 w-3.5" />
 </button> )}
            {onDelete && (
 <button type="button" onClick={() => {
                if (window.confirm(`Remover ${patient.name} (${patient.bed}) do sistema? Esta ação não pode ser desfeita.`)) onDelete(patient);
              }}
                className="rounded p-1 text-muted-foreground hover:bg-clinical-critical/15 hover:text-clinical-critical" title="Excluir paciente">
 <Trash2 className="h-3.5 w-3.5" />
 </button> )}
            {onArchive && (
 <button type="button" onClick={() => onArchive(patient)}
                className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground" title="Arquivar paciente (histórico)">
 <Archive className="h-3.5 w-3.5" />
 </button> )}
 <button
              type="button"
              onClick={() => setDischargeOpen(true)}
              className={`ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${dcBtnClass}`}
              title="Checar critérios de alta da UTI"
            >
 <LogOut className="h-3.5 w-3.5" /> {dcBtnLabel}
 </button>
 <button type="button" onClick={() => setOpen(false)}
              className="ml-1 ios-inset px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"> Recolher
 </button>
 </div>
 </div>
 <div className="grid grid-cols-[1.4fr_1.3fr_1.3fr_1.3fr_1.3fr_1.4fr_1.3fr] items-start gap-2.5 px-4 py-4 text-[12px] font-semibold [&>div]:min-w-0 [&>div]:overflow-hidden [&>div]:ios-card [&>div]:px-3.5 [&>div]:py-3"> {/* 1 */}
 <div onClick={colClick("id")} className="col-ink">
 <ColTitle tone={0}>🪪 Identificação</ColTitle>
 <dl className="space-y-1 text-muted-foreground">
 <Row k="Médico" v={patient.attending} />
 <Row k="Idade" v={`${computedAge} anos`} />
 <Row k="Adm Hosp" v={`${patient.admissionHosp} · D${dHosp}`} />
 <Row k="Adm UTI" v={`${patient.admissionICU} · D${dICU}`} />
 <Row k="Alergias" v={patient.allergies.join(", ")} /> {(patient.legalRepresentative?.name || patient.legalRepresentative?.phone) && (
 <Row k="Repr. legal" v={`${patient.legalRepresentative.name ?? "—"}${patient.legalRepresentative.relation ? ` (${patient.legalRepresentative.relation})` : ""}${patient.legalRepresentative.phone ? ` · ${patient.legalRepresentative.phone}` : ""}`} /> )}
              {(patient.legalRepresentative2?.name || patient.legalRepresentative2?.phone) && (
 <Row k="Repr. legal 2" v={`${patient.legalRepresentative2.name ?? "—"}${patient.legalRepresentative2.relation ? ` (${patient.legalRepresentative2.relation})` : ""}${patient.legalRepresentative2.phone ? ` · ${patient.legalRepresentative2.phone}` : ""}`} /> )}
              {patient.advanceDirective && (patient.advanceDirective.intubation !== "unknown" || patient.advanceDirective.resuscitation !== "unknown") && (
 <Row k="Diretivas" v={`${directiveLabel(patient.advanceDirective.intubation, "Entubar")} · ${directiveLabel(patient.advanceDirective.resuscitation, "RCP")}`} /> )}
              {patient.organDonation && patient.organDonation !== "unknown" && (
 <Row k="Doação órgãos" v={organDonationLabel[patient.organDonation]} /> )}
 </dl> {patient.origin && (
 <div className="mt-2 ios-inset px-2 py-1.5 text-[11px]">
 <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Origem</div>
 <div className="text-foreground">{patient.origin.name ?? patient.origin.type}</div>
 <div className="text-muted-foreground"> {patient.origin.type}
                  {patient.origin.unit ? ` · ${patient.origin.unit}` : ""}
                  {patient.origin.city ? ` · ${patient.origin.city}` : ""}
                  {patient.origin.state ? `/${patient.origin.state}` : ""}
 </div>
 </div> )}
 <div className="mt-3">
 <span className={`chip ${kindClass[patient.severity === "critical" ? "critical" : patient.severity === "attention" ? "attention" : "stable"]}`}> {sevLabel[patient.severity]}
 </span>
          </div> {/* Gestão — scores */}
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <ColTitle tone={5}>⚙️ Gestão</ColTitle>
            <div className="flex flex-wrap items-start gap-1.5">
              <Saps3Button patient={patient} onClick={() => setSaps3Open(true)} />
              <FisherButton patient={patient} onClick={() => setFisherOpen(true)} />
              <HuntHessButton patient={patient} onClick={() => setHuntHessOpen(true)} />
              <WfnsButton patient={patient} onClick={() => setWfnsOpen(true)} />
              <IchScoreButton patient={patient} onClick={() => setIchOpen(true)} />
              <NihssButton patient={patient} onClick={() => setNihssOpen(true)} />
            </div>
          </div>

          {/* Procedimentos & eventos — ao final da coluna 01 */}

            {patient.procedures.length > 0 && (
 <div className="mt-4">
 <ColTitle tone={0}>🗓️ Procedimentos & eventos</ColTitle>
 <ol className="relative ml-2 space-y-2 border-l border-border pl-3"> {patient.procedures.map((p, i) => (
 <li key={i} className="relative">
 <span className={`absolute -left-[14px] mt-1.5 h-1.5 w-1.5 rounded-full bg-current ${kindClass[p.kind]}`} />
 <div className="text-[11px] text-muted-foreground">{p.date}</div>
 <div className={`text-[12px] ${kindClass[p.kind]}`}>{p.label}</div> {p.detail && <div className="text-[11px] text-muted-foreground">{p.detail}</div>}
 </li> ))}
 </ol>
 </div> )}
 </div> {/* 2 */}
 <div onClick={colClick("hist")}>
 <ColTitle tone={1}>📋 História clínica</ColTitle>
 <div className="space-y-3"> {([
                 { cat: "current", label: "Diagnósticos atuais", box: "pastel-current", text: "text-ink", head: "pastel-current-head" },
                 { cat: "inactive", label: "Diagnósticos inativos", box: "pastel-inactive", text: "text-ink", head: "pastel-inactive-head" },
                 { cat: "previous", label: "Diagnósticos pregressos", box: "pastel-previous", text: "text-ink", head: "pastel-previous-head" },
                 { cat: "complication", label: "Complicações", box: "pastel-complication", text: "text-ink", head: "pastel-complication-head" },
               ] as const).map((g) => {
                 const list = patient.diagnoses.filter((d) => (d.category ?? "current") === g.cat);
                 if (!list.length) return null;
                 return (
 <div key={g.cat}>
 <div className={`mb-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink ${g.head}`}> {g.label} · {list.length}
 </div>
 <ol className="relative ml-2 space-y-1.5 border-l border-border pl-3"> {list.map((d, i) => (
 <li key={i} className="relative">
 <span className={`absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full bg-current ${kindClass[d.kind]}`} />
 <div className={`rounded-md border px-2 py-1 text-ink ${g.box}`}>
 <div className="text-[11px] text-ink">{d.date}</div>
 <div className="text-[12px] font-semibold text-ink">{d.label}</div> {d.detail && <div className="text-[10.5px] text-ink">{d.detail}</div>}
 </div>
 </li> ))}
 </ol>
 </div> );
               })}
               {patient.diagnoses.length === 0 && (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Sem diagnósticos registrados.</div> )}
 </div>
 <div className="mt-3 space-y-1 text-[11px] text-muted-foreground"> {patient.social.tabagismo && <div>Tabagismo: {patient.social.tabagismo}</div>}
              {patient.social.ocupacao && <div>Ocupação: {patient.social.ocupacao}</div>}
              {patient.social.dependencia && <div>Funcional: {patient.social.dependencia}</div>}
 </div>
 </div> {/* 3 - Dispositivos Invasivos */}
 <div onClick={colClick("proc")}>
 <div>
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <ColTitle tone={2}>🧷 Dispositivos invasivos</ColTitle>

 <div className="flex flex-wrap items-center gap-1.5"> {(patient.infections?.filter((i) => i.status !== "resolvido").length ?? 0) > 0 && (
 <button
                      onClick={() => setMapOpen(true)}
                      className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-critical hover:bg-clinical-critical/15"
                      title="Mapa de infecção"
                    > {patient.infections!.filter((i) => i.status !== "resolvido").length} focos
 </button> )}
                  {activeDevices.length > 0 && (
 <button
                      onClick={() => setMapOpen(true)}
                      className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-clinical-resp hover:bg-primary/10"
                    > Visualizar dispositivos
 </button> )}
 <button
                    onClick={() => setLppOpen(true)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${lppSummary.totalActive > 0 ? "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention hover:bg-clinical-attention/15" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"}`}
                    title="Lesões por pressão"
                  > {lppSummary.totalActive > 0 ? `${lppSummary.totalActive} LPP` : "+ LPP"}
 </button>
 <button
                    onClick={(e) => { e.stopPropagation(); setIntubOpen(true); }}
                    className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-critical hover:bg-clinical-critical/20"
                    title="Iniciar/continuar jornada de intubação orotraqueal"
                  > Intubação
 </button>

 </div>
 </div> {activeDevices.length === 0 && (
 <div className="text-[11px] text-muted-foreground">Sem dispositivos ativos.</div> )}
              {DEVICE_CATEGORIES.map((cat) => {
                const list = devicesByCat.get(cat.code);
                if (!list || !list.length) return null;
                return (
 <div key={cat.code} className="mb-2">
  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> {cat.label}
 </div>
 <ul className="space-y-1"> {list.map((d) => {
                        const r = deviceRisk(d);
                        return (
 <li key={d.id} className={`ios-inset px-2 pb-1.5 pt-1.5 text-[11px] ${mounted && r.days > r.max ? "alert-outline" : ""}`} title={mounted ? (r.semaphoreHint ?? r.label) : undefined}>
 <div className="flex items-baseline justify-between gap-2">
 <span className="f-var">{deviceShort(d)}</span> {mounted && (
  <span className={`f-var text-[10px] ${r.className}`}> {Math.floor(r.days)}/{r.max}d
 </span> )}
 </div>

 <div className="mt-1 h-[4px] w-full overflow-hidden rounded-full bg-surface-3"> {mounted && (
 <div
                                  className={`h-full rounded-full ${DEVICE_BAR[r.level]}`}
                                  style={{ width: `${Math.min(100, Math.max(4, r.percent))}%` }}
                                /> )}
 </div>
 </li> );
                      })}
 </ul>
 </div> );
              })}

              {removedDevices.length > 0 && (
 <details className="mt-1 ios-inset p-1.5" onClick={(e) => e.stopPropagation()}>
 <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Histórico de invasões ({removedDevices.length})
 </summary>
 <ul className="mt-1 space-y-1"> {removedDevices.map((d) => {
                      const def = deviceTypeByCode(d.typeCode);
                      const days = Math.max(
                        0,
                        Math.floor((new Date(d.removedAt!).getTime() - new Date(d.insertedAt).getTime()) / 86400000),
                      );
                      return (
 <li key={d.id} className="ios-inset px-1.5 py-1 text-[10px] text-muted-foreground">
  <span className="f-var">{deviceShort(d)}</span> {" · "}
                          {formatDateBR(d.insertedAt)} → {formatDateBR(d.removedAt!)} ({days}d)
 </li> );
                    })}
 </ul>
 </details> )}
 </div>
 </div> {/* 4 — Medicações agrupadas por classe */}
 <div onClick={colClick("med")}>
 <div className="mb-2 flex items-center justify-between gap-2">
 <ColTitle tone={3}>💊 Medicações</ColTitle>
  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                  type="button"
                  onClick={() => setMedAnalysisOpen(true)}
                  className="rounded-md border border-primary/40 bg-primary/10 p-1.5 text-primary hover:bg-primary/20"
                  title="Análise Medicamentosa (IA)"
                  aria-label="Análise Medicamentosa (IA)"
                >
                <Pill className="h-4 w-4" />
              </button>
              <button
                  type="button"
                  onClick={() => setAtbHistOpen(true)}
                  className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 p-1.5 text-clinical-attention hover:bg-clinical-attention/20"
                  title="Histórico de antimicrobianos administrados"
                  aria-label="Histórico de antimicrobianos administrados"
                >
                <History className="h-4 w-4" />
              </button>
            </div>
 </div>
 <div className="mb-2" onClick={(e) => e.stopPropagation()}>
 <PumpDashboard patient={patient} onOpen={() => setPumpOpen(true)} />
 </div> {(() => {
              // include all meds (active + suspended), grouped by class
              const allByClass = new Map<string, Medication[]>();
              for (const m of patient.medications) {
                const cls = medClassOf(m);
                if (!allByClass.has(cls)) allByClass.set(cls, []);
                allByClass.get(cls)!.push(m);
              }
              return MEDICATION_CLASS_ORDER.map((cls) => {
                const list = allByClass.get(cls);
                if (!list || !list.length) return null;
                const meta = MEDICATION_CLASS_META[cls];
                return (
 <div key={cls} className={`mb-2 rounded-md border ${meta.borderClass} ${meta.bgClass} p-2`}>
 <div className={`mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${meta.className}`}>
  <span>{meta.label}</span>
 <span className="font-mono">{list.length}</span>
 </div>
 <ul className="space-y-1.5"> {list.map((m, i) => {
                        const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
                        const prog = isAtb ? antibioticProgress(m) : null;
                        const alert = prog ? atbAlertBadge(prog.alert) : null;
                        return (
 <li key={i} className="ios-inset px-2 py-1.5 text-[12px]">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <span>{isAtb ? "" : ""}</span>
 <span className="font-semibold text-foreground">{m.name}</span>
 </div>
  <span className={`chip text-[9px] ${m.active === false ? "text-clinical-neutral" : "text-clinical-stable"}`} title={m.active === false ? "Suspenso" : "Ativo"}>
    <span className="mr-0.5">{m.active === false ? "○" : "●"}</span>
    {m.active === false ? "Suspenso" : "Ativo"}
  </span>
 </div>
 <div className="ml-5 font-mono text-[11px] text-muted-foreground"> {m.dose} · {m.route} · {m.freq}
 </div> {m.mlPerHour !== undefined && (
 <div className="ml-5 font-mono text-[11px] text-clinical-resp"> BIC {m.mlPerHour.toFixed(1)} mL/h
 </div> )}
 <div className="ml-5 text-[10px] text-muted-foreground"> {m.start}{m.end ? ` → ${m.end}` : ""}
 </div> {mounted && prog && (
 <div className="ml-5 mt-1.5 rounded border border-border/70 bg-surface-2/40 p-1.5">
 <div className="flex items-center justify-between text-[10px]">
 <span className="font-semibold text-foreground">Dia {prog.currentDay} de {prog.totalDays}</span>
 <span className="font-mono text-muted-foreground">{prog.percent.toFixed(0)}%</span>
 </div>
 <div className="my-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
 <div className={`h-full ${prog.alert === "ok" ? "bg-clinical-stable" : "bg-clinical-attention"}`}
                                       style={{ width: `${prog.percent}%` }} />
 </div> {alert && (
  <div className={`mt-1 text-[10px] font-semibold ${alert.className}`}>{alert.label}</div> )}
 </div> )}
 </li> );
                      })}
 </ul>
 </div> );
              });
            })()}
            {patient.medications.length === 0 && (
 <div className="text-[11px] italic text-muted-foreground">Sem medicações registradas.</div> )}
 </div> {/* 5 — Culturas → Lab → Gasometria → Imagem */}
 <div onClick={colClick("exam")}> {/* 1) Culturas */}
 <ColTitle tone={4}>🦠 Culturas · Imagem</ColTitle>
 <div className="mb-3">
 <div className="mb-1 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Culturas microbiológicas</div> {onEdit && (
  <button onClick={(e) => { e.stopPropagation(); onEdit(patient, "cult"); }}
                    className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3" title="Adicionar cultura">+</button> )}
 </div> {(patient.cultures?.length ?? 0) === 0 ? (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Nenhuma cultura registrada.</div> ) : (
 <ul className="space-y-1"> {patient.cultures!.slice().reverse().map((c) => {
                    const r = cultureResultBadge(c);
                    const alerts = detectCultureAlerts(c);
                    return (
 <li key={c.id} className={`ios-inset px-2 py-1.5 text-[11px] ${r.label === "Positiva" ? "alert-outline-static" : ""}`}>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5 font-semibold text-foreground">
  <span className="truncate">{c.source}</span>
 </div>
 <span className={`shrink-0 font-mono text-[9px] ${r.className}`}>{r.label}</span>
 </div>
 <div className="mt-0.5 text-[10px] text-muted-foreground"> {new Date(c.collectedAt).toLocaleDateString("pt-BR")}
                          {c.collectionSite ? ` · ${c.collectionSite}` : ""}
 </div> {c.organism && <div className="mt-0.5 text-[10.5px] italic text-foreground">{c.organism}</div>}
                        {c.resistanceProfile && c.resistanceProfile !== "pendente" && (
 <div className="text-[10px] text-muted-foreground">Perfil: {c.resistanceProfile}</div> )}
                        {alerts.length > 0 && (
 <div className="mt-1 flex flex-wrap gap-1"> {alerts.map((a) => (
 <span key={a.code} className={`rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${
                                a.severity === "critical" ? "bg-clinical-critical/15 text-clinical-critical" : "bg-clinical-attention/15 text-clinical-attention"
                              }`}> {a.label}</span> ))}
 </div> )}
                        {c.antibiogram && c.antibiogram.length > 0 && (
 <details className="mt-1">
 <summary className="cursor-pointer text-[10px] font-semibold text-foreground hover:underline">Antibiograma ({c.antibiogram.length})</summary>
 <ul className="mt-1 space-y-0.5 text-[10px]"> {c.antibiogram.map((ab, i) => (
 <li key={i} className="flex items-center justify-between">
 <span className="text-muted-foreground">{ab.drug}</span>
 <span className={`font-mono font-semibold ${
                                    ab.result === "S" ? "text-clinical-stable" : ab.result === "I" ? "text-clinical-attention" : "text-clinical-critical"
                                  }`}>{ab.result}{ab.mic ? ` · ${ab.mic}` : ""}</span>
 </li> ))}
 </ul>
 </details> )}
 </li> );
                  })}
 </ul> )}
 </div>

            {/* 4) Imagem — com miniaturas */}
 <div>
 <div className="mb-1 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Exames de imagem</div> {onEdit && (
  <button onClick={(e) => { e.stopPropagation(); onEdit(patient, "exam"); }}
                    className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3" title="Adicionar imagem">+</button> )}
 </div> {(patient.imaging?.length ?? 0) === 0 ? (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Nenhum exame de imagem registrado.</div> ) : (
 <ul className="space-y-1"> {patient.imaging!.slice().reverse().map((im) => {
                    const icon = im.conclusion === "critico" ? "" : im.conclusion === "alterado" ? "" : im.conclusion === "normal" ? "" : "";
                    const bad = im.outcome === "mau";
                    return (
 <li key={im.id} className={`ios-inset px-2 py-1.5 text-[11px] ${bad ? "alert-outline" : ""}`} title={bad ? "Mau resultado esperado" : undefined}>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5 font-semibold text-foreground">
 <span>{icon}</span><span>{im.modality} · {im.region}</span>
                            {im.outcome && (
 <span className={`rounded px-1 py-px text-[8.5px] font-bold uppercase tracking-wider ${bad ? "bg-clinical-critical/15 text-clinical-critical" : "bg-clinical-stable/15 text-clinical-stable"}`}> {bad ? "Mau resultado" : "Bom resultado"}
 </span> )}
 </div>
 <span className="font-mono text-[10px] text-muted-foreground"> {formatDateBR(im.performedAt)}
                            {im.status && <span className="ml-1 rounded border border-border px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-foreground">{im.status === "concluido" ? " Concluído" : " Solicitado"}</span>}
 </span>

 </div> {im.summary && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{im.summary}</div>}
                        {im.reportedBy && <div className="mt-0.5 text-[9px] text-muted-foreground">— {im.reportedBy}</div>}
                        {im.images && im.images.length > 0 && (
 <div className="mt-1.5 flex flex-wrap gap-1"> {im.images.map((img) => (
 <button
                                key={img.id}
                                onClick={(e) => { e.stopPropagation(); setZoomImg(img.dataUrl); }}
                                className="group relative h-14 w-14 overflow-hidden rounded border border-border bg-surface-2 transition-transform hover:scale-105"
                                title={img.caption ?? "Ampliar"}
                              >
 <img src={img.dataUrl} alt={img.caption ?? "Imagem do exame"} className="h-full w-full object-cover" />
 </button> ))}
 </div> )}
 </li> );
                  })}
 </ul> )}
 </div>

            {/* 5) Eletroencefalograma — parecer */}
 <div className="mt-2">
 <div className="mb-1 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Eletroencefalograma</div> {onEdit && (
  <button onClick={(e) => { e.stopPropagation(); onEdit(patient, "exam"); }}
                    className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3" title="Adicionar EEG">+</button> )}
 </div> {(patient.eeg?.length ?? 0) === 0 ? (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Nenhum EEG registrado.</div> ) : (
 <ul className="space-y-1"> {patient.eeg!.slice().reverse().map((eeg) => (
 <li key={eeg.id} className="ios-inset px-2 py-1.5 text-[11px]">
 <div className="flex items-center justify-between gap-2">
 <span className="font-semibold text-foreground">EEG</span>
 <span className="font-mono text-[10px] text-muted-foreground">{formatDateBR(eeg.performedAt)}</span>
 </div>
 <div className="mt-0.5 text-[10.5px] text-muted-foreground">{eeg.report}</div>
                        {eeg.reportedBy && <div className="mt-0.5 text-[9px] text-muted-foreground">— {eeg.reportedBy}</div>}
 </li> ))}
 </ul> )}
 </div>

            {/* 6) Hemotransfusão */}
 <div className="mt-2">
 <div className="mb-1 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Hemotransfusão</div> {onEdit && (
  <button onClick={(e) => { e.stopPropagation(); onEdit(patient, "exam"); }}
                    className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3" title="Adicionar hemotransfusão">+</button> )}
 </div> {(patient.hemotransfusions?.length ?? 0) === 0 ? (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Nenhuma hemotransfusão registrada.</div> ) : (
 <ul className="space-y-1"> {patient.hemotransfusions!.slice().reverse().map((h) => (
 <li key={h.id} className="ios-inset px-2 py-1.5 text-[11px]">
 <div className="flex items-center justify-between gap-2">
 <span className="font-semibold text-foreground">{h.component}</span>
 <span className="font-mono text-[10px] text-muted-foreground">{formatDateBR(h.date)}</span>
 </div> {h.volume && <div className="mt-0.5 font-mono text-[10px] text-foreground">{h.volume}</div>}
                        {h.note && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{h.note}</div>}
 </li> ))}
 </ul> )}
 </div>
 </div> {/* 6 */}
 <div onClick={colClick("sup")}>
 <ColTitle tone={5}>📈 Estado atual</ColTitle> {/* Sinais vitais (linhas) */}
 <div className="mt-2">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Sinais vitais
 </div>
 <div className="ios-inset px-2 py-2"> {vitalRows.map((r) => {
                  const val = r.v.text.split("·")[0].trim();
                  const crit = r.v.level === "grave";
                  return (
 <div key={r.label} className="grid grid-cols-[46px_1fr_auto] items-baseline gap-x-2 py-[3px] text-[11px]">
 <span className="f-fixed font-bold uppercase tracking-wider text-muted-foreground">{r.label}</span>
 <span className={`font-mono font-bold tabular-nums ${VITAL_LEVEL_TXT[r.v.level]}`}>{val}</span>
 <span className="flex items-center justify-end gap-1 text-right">
                        {crit && <span className="alert-dot" title="Alteração grave" aria-label="Alteração grave" />}
 </span>
 </div> );
                })}
                {crcl && (
 <div className="mt-1 grid grid-cols-[46px_1fr_auto] items-baseline gap-x-2 border-t border-border/50 pt-1 text-[11px]">
 <span className="f-fixed font-bold uppercase tracking-wider text-muted-foreground">ClCr</span>
 <span className="font-mono font-bold tabular-nums text-foreground" title={`Cockcroft-Gault · Cr ${crcl.creat} mg/dL · ${crcl.ageYears}a · ${crcl.weightKg}kg`}>{crcl.value}</span>
 <span className="text-right text-[10px] text-muted-foreground">mL/min</span>
 </div> )}
 </div>
 </div> {/* Laboratoriais + Gasometria (movidos da coluna 5) */}
            {(() => {
              const isGaso = (code?: string, label?: string) => /pH|PaO2|PaCO2|HCO3|SatO2|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(code ?? label ?? "");
              const lab = patient.exams.filter((e) => !isGaso(e.code, e.label));
              const gaso = patient.exams.filter((e) => isGaso(e.code, e.label));
              const renderTable = (rows: typeof patient.exams) => (
 <table className="w-full text-[12px]">
 <tbody>
                    {rows.map((e, i) => {
                      const ins = examInsight(e, patient.sex);
                      const b = ins.bucket ? bucketBadge(ins.bucket) : null;
                      const t = trendArrow(ins.movement, ins.trend);
                      const abn = !!ins.bucket && ins.bucket !== "normal";
                      return (
 <tr key={i} className="border-b border-border/50 last:border-0">
 <td className={`py-1 text-muted-foreground ${abn ? "alert-outline" : ""}`} title={abn ? `Resultado alterado · ${b?.label}` : undefined}>{e.label}</td>
 <td className={`py-1 font-mono ${abn ? "alert-outline " : ""}${b?.className ?? "text-foreground"}`}>{e.value} {e.unit}</td>
  <td className={`py-1 text-right text-[12px] leading-none ${t.className}`} title={t.label} aria-label={t.label}>{t.arrow}</td>
 </tr> );
                    })}
 </tbody>
 </table> );
              return (
 <>
 <div className="mt-4">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Exames laboratoriais
 </div> {lab.length ? renderTable(lab) : (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Sem laboratoriais.</div> )}
 </div>
 <div className="mt-4">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-clinical-resp"> Gasometria arterial
 </div> {gaso.length ? renderTable(gaso) : (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">Sem gasometria.</div> )}
 <BloodGasPanel patient={patient} />
 </div>
 </> );
            })()}
 {/* Bristol — linhas temporais */}
 <div className="mt-4">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Escala de Bristol
 </div> {(patient.state.stools?.length ?? 0) > 0 ? (
 <div className="space-y-0.5 ios-inset px-2 py-1.5 text-[11px]"> {patient.state.stools!.map((st) => {
                    const m = bristolMeta(st.bristol);
                    return (
 <div key={st.id} className="flex items-baseline justify-between gap-2">
 <span className={`font-semibold ${m?.className ?? "text-foreground"}`}>{m ? `Tipo ${m.value}` : "—"}</span>
 <span className="font-mono font-bold text-muted-foreground">{st.volume ?? "—"}</span>
 <span className="text-[9.5px] text-muted-foreground">{st.at ? new Date(st.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
 </div> );
                  })}
 </div> ) : (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground"> Sem evacuação registrada.
 </div> )}
 </div> {/* Balanço hídrico — linhas */}
 <div className="mt-4">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"> Balanço hídrico
 </div> {(!patient.state.fluidBalance || (!patient.state.fluidBalance.intake?.length && !patient.state.fluidBalance.output?.length && !patient.state.fluidBalance.drains?.length)) ? (
 <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground"> Sem registros de entradas / saídas / drenos.
 </div> ) : (
 <div className="space-y-1">
 <div className="space-y-0.5 ios-inset px-2 py-1.5 text-[11px] font-mono font-semibold">
 <div className="flex items-baseline justify-between gap-2">
 <span className="font-sans font-bold uppercase tracking-wider text-clinical-resp">Entradas</span>
 <span className="text-foreground">+{fluidBalance.totalIntake} mL</span>
 </div>
 <div className="flex items-baseline justify-between gap-2">
 <span className="font-sans font-bold uppercase tracking-wider text-clinical-attention">Saídas</span>
 <span className="text-foreground">−{fluidBalance.totalOutput} mL</span>
 </div>
 <div className="flex items-baseline justify-between gap-2">
 <span className="font-sans font-bold uppercase tracking-wider text-clinical-device">Drenos</span>
 <span className="text-foreground">−{fluidBalance.totalDrains} mL</span>
 </div>
 <div className={`flex items-baseline justify-between gap-2 border-t border-border pt-1 text-[12px] font-bold ${
                      fluidBalance.balance > 500 ? "text-clinical-attention"
                      : fluidBalance.balance < -500 ? "text-clinical-critical"
                      : "text-clinical-stable"
                    }`}>
 <span className="font-sans uppercase tracking-wider">BH</span>
 <span> {bhRate != null
                          ? `${bhRate >= 0 ? "+" : ""}${bhRate.toFixed(2)} mL/kg/h`
                          : "—"}
 <span className="ml-1 text-[10px] font-normal text-muted-foreground"> ({fluidBalance.balance >= 0 ? "+" : ""}{fluidBalance.balance} mL/24h)
 </span>
 </span>
 </div>
 </div> {(patient.state.fluidBalance?.drains?.length ?? 0) > 0 && (
 <ul className="mt-1 space-y-0.5 text-[10.5px]"> {patient.state.fluidBalance!.drains!.map((d) => (
 <li key={d.id} className="flex items-center justify-between ios-inset px-2 py-0.5">
 <span className="truncate">
 <span className="font-semibold text-foreground">{d.name}</span> {d.site ? <span className="text-muted-foreground"> · {d.site}</span> : null}
 </span>
 <span className="shrink-0 font-mono text-clinical-device">{d.volumeMl} mL</span>
 </li> ))}
 </ul> )}
 </div> )}
 </div>
 </div> {/* 7 - Plano · Metas por sistema orgânico */}
 <div onClick={colClick("plan")}>
 <ColTitle tone={6}>✅ Condutas</ColTitle>
 <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
 <span>{conductsDone}/{patient.conducts.length} concluídas</span>
 <span className="font-mono text-foreground">{conductsPct}%</span>
 </div>
 <div className="bar-track mb-2">
 <div className="h-full bg-clinical-stable transition-all" style={{ width: `${conductsPct}%` }} />
 </div>
 <ul className="space-y-1.5" onClick={(e) => e.stopPropagation()}> {[...patient.conducts]
                .map((c, i) => ({ c, i }))
                .sort((a, b) => {
                  const order = ["dieta", "fono", "gi", "neuro", "cardio", "resp", "renal", "infec", "hemato", "skin", "other"];
                  return order.indexOf(a.c.system ?? "other") - order.indexOf(b.c.system ?? "other");
                })
                .map(({ c, i }) => {
                const meta = c.system ? CONDUCT_SYSTEM_META[c.system] : CONDUCT_SYSTEM_META.other;
                return (
 <li key={i} className={`rounded-md border px-2 py-2 text-[12px] ${meta.borderClass} ${meta.bgClass}`}>
 <label className="flex items-center gap-2">
 <input
                        type="checkbox"
                        checked={c.done}
                        onChange={() => toggleConduct(i)}
                        disabled={!onUpdate}
                        className="h-3 w-3 shrink-0 cursor-pointer accent-clinical-stable"
                      />
 <span className={`text-[11px] font-bold uppercase tracking-wider ${meta.className} ${c.done ? "line-through opacity-70" : ""}`}> {meta.label}
 </span>
 <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{c.team}</span>
 </label> {c.subItems && c.subItems.length > 0 ? (
 <ul className="mt-1.5 ml-2 space-y-1 border-l border-border/60 pl-2"> {c.subItems.map((sub, si) => {
                          const colMeta = sub.color ? ANNOTATION_COLOR_META[sub.color] : ANNOTATION_COLOR_META.default;
                          return (
 <li key={si}>
 <label className="flex items-start gap-1.5 text-[11.5px] leading-snug">
 <input
                                  type="checkbox"
                                  checked={!!sub.done}
                                  onChange={() => toggleSubItem(i, si)}
                                  disabled={!onUpdate}
                                  className="mt-[3px] h-2.5 w-2.5 shrink-0 cursor-pointer accent-clinical-stable"
                                />
 <span className={`whitespace-pre-wrap break-words ${sub.done ? "text-muted-foreground line-through" : colMeta.textClass || "text-foreground"}`}> {sub.text || <span className="italic text-muted-foreground">(anotação vazia)</span>}
 </span>
 </label>
 </li> );
                        })}
 </ul> ) : (
 <div className="mt-1 text-[10.5px] italic text-muted-foreground">Sem condutas registradas.</div> )}
 </li> );
              })}
               {patient.conducts.length === 0 && (
 <li className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground"> Nenhuma conduta registrada.
 </li> )}
 </ul>

 <div className="mt-3">
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Metas</div>
 <ul className="space-y-1"> {patient.goals.map((g, i) => (
 <li key={i} className="flex items-center gap-2 text-[12px]">
 <span className={`h-1.5 w-1.5 rounded-full ${g.met ? "bg-clinical-stable" : "bg-clinical-critical"}`} />
 <span className={g.met ? "text-foreground" : "text-clinical-critical"}>{g.text}</span>
 </li> ))}
 </ul>
 </div>
 </div>

 </div>
 </div> )}




      {/* Anatomical map embedded — visible immediately upon expansion */}
      {open && (
 <div className="border-t border-border bg-surface/40 px-5 py-5">
 <div className="mb-3 flex items-center justify-between">
 <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> Mapa anatômico · dispositivos & lesões por pressão
 </div>
 <div className="text-[10px] text-muted-foreground"> {activeDevices.length} dispositivo(s) · {lppSummary.totalActive} LPP ativa(s)
 </div>
 </div>
 <AnatomicalMap
            devices={patient.devices ?? []}
            patient={patient}
            lpp={patient.lpp ?? []}
            onLPPChange={onUpdate ? (next) => onUpdate({ ...patient, lpp: next }) : undefined}
          />
 <div className="mt-5">
  {mounted && <SofaPanel patient={patient} />}
 </div>
 <div className="mt-5">
 <ClinicalTrendChart patient={patient} />

 </div>

 <div className="mt-5 flex flex-col gap-2 rounded-md border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
 <div className="min-w-0">
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Documento para a família</div>
 <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Relatório ilustrado em linguagem simples: jornada desde a chegada, motivos da internação, o que já foi feito, aparelhos e medicamentos em uso, plano de cuidados e glossário.
 </div>
 </div>
 <button
            type="button"
            onClick={() => generateFamilyReport(patient)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-clinical-stable px-3 py-2 text-[11.5px] font-semibold text-ink transition-opacity hover:opacity-90"
            title="Gerar PDF ilustrado para a família"
          >
 <FileText className="h-3.5 w-3.5" /> Gerar PDF para a família
 </button>
 </div>
 </div> )}

      {/* Medication Analysis Dialog */}
 <MedicationAnalysisModal
        open={medAnalysisOpen}
        onClose={() => setMedAnalysisOpen(false)}
        patient={patient}
      />

 <AntibioticHistory
        open={atbHistOpen}
        onOpenChange={setAtbHistOpen}
        patient={patient}
        onUpdate={onUpdate}
      /> {/* Pump Monitor Dialog */}
 <Dialog open={pumpOpen} onOpenChange={setPumpOpen}>
 <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Gauge className="h-4 w-4 text-clinical-resp" /> Central de bombas · {patient.name}
 </DialogTitle>
 </DialogHeader>
 <PumpMonitor patient={patient} onChange={onUpdate} />
 </DialogContent>
 </Dialog> {/* AI Therapy Suggestions Dialog */}
 <Dialog open={aiOpen} onOpenChange={setAiOpen}>
 <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-clinical-attention" /> Ajustar terapia · sugestões para {patient.name}
 </DialogTitle>
 </DialogHeader>
 <p className="text-[11px] text-muted-foreground"> Sugestões baseadas em parâmetros atuais. <b>Não executam ações</b> — exigem confirmação médica.
 </p>
 <ul className="mt-2 space-y-2"> {suggestions.map((s, i) => {
              const cls = s.severity === "critical" ? "border-clinical-critical/40 bg-clinical-critical/5"
                : s.severity === "attention" ? "border-clinical-attention/40 bg-clinical-attention/5"
                : "border-border bg-surface";
              return (
 <li key={i} className={`rounded-md border p-3 text-[12px] ${cls}`}>
 <div className="flex items-center gap-2 font-semibold text-foreground">
 <span>{s.title}</span>
 </div>
 <div className="mt-1 text-[11px] text-muted-foreground">{s.rationale}</div>
 </li> );
            })}
 </ul>
 </DialogContent>
 </Dialog> {/* Anatomical Map Dialog — Devices + Pressure Injuries unificados */}
 <Dialog open={mapOpen} onOpenChange={setMapOpen}>
 <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"> Mapa anatômico · {patient.name}
 </DialogTitle>
 </DialogHeader>
 <AnatomicalMap
            devices={patient.devices ?? []}
            patient={patient}
            lpp={patient.lpp ?? []}
            onLPPChange={onUpdate ? (next) => onUpdate({ ...patient, lpp: next }) : undefined}
          />
 </DialogContent>
 </Dialog> {/* Image lightbox for exam attachments */}
 <Dialog open={!!zoomImg} onOpenChange={(o) => !o && setZoomImg(null)}>
 <DialogContent className="max-h-[95vh] max-w-4xl overflow-hidden p-2">
 <DialogHeader>
 <DialogTitle className="text-[12px]">Imagem do exame</DialogTitle>
 </DialogHeader> {zoomImg && (
 <img src={zoomImg} alt="Imagem ampliada" className="mx-auto max-h-[85vh] w-auto rounded" /> )}
 </DialogContent>
 </Dialog> {/* Intubation Journey */}
      {onUpdate && (
 <IntubationJourney
          open={intubOpen}
          onClose={() => setIntubOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* SAPS 3 */}
      {onUpdate && (
 <Saps3Modal
          open={saps3Open}
          onClose={() => setSaps3Open(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* Escala de Fisher */}
      {onUpdate && (
 <FisherModal
          open={fisherOpen}
          onClose={() => setFisherOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* Escala de Hunt-Hess */}
      {onUpdate && (
        <HuntHessModal
          open={huntHessOpen}
          onClose={() => setHuntHessOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* Escala WFNS */}
      {onUpdate && (
        <WfnsModal
          open={wfnsOpen}
          onClose={() => setWfnsOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* ICH Score */}
      {onUpdate && (
        <IchScoreModal
          open={ichOpen}
          onClose={() => setIchOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* NIHSS */}
      {onUpdate && (
        <NihssModal
          open={nihssOpen}
          onClose={() => setNihssOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

      {/* Discharge readiness check */}
      {onUpdate && (
 <DischargeCheckModal
          open={dischargeOpen}
          onClose={() => setDischargeOpen(false)}
          patient={patient}
          onSave={onUpdate}
        /> )}

 </div> );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
 <div className="flex justify-between gap-2">
 <dt className="f-fixed text-[11px] uppercase tracking-wider">{k}</dt>
 <dd className="f-var text-right text-[12px] text-foreground">{v}</dd>
 </div> );
}

export { Activity };
// silence unused import lint
void categoryLabel; void categoryIcon; void STAGE_META;
