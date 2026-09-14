import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationText } from "@/components/AnnotationText";
import { AnnotationEditor } from "@/components/AnnotationEditor";

import type { Patient, Severity, TimelineKind, InvasiveDevice, Medication } from "@/data/patients";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  CircleDot,
  Pencil,
  Printer,
  Gauge,
  Sparkles,
  Download,
  Trash2,
  LogOut,
  Archive,
  FileText,
  History,
} from "lucide-react";
import { generateFamilyReport } from "@/lib/familyReport";
import { exportPatient } from "@/lib/patientIO";
import {
  examInsight,
  bucketBadge,
  trendArrow,
  computeAge,
  computeBMI,
  computeCrCl,
  daysSinceAdmission,
  antibioticProgress,
  atbAlertBadge,
  detectAntibiotic,
  deviceRisk,
  aiTherapySuggestions,
  medClassOf,
  MEDICATION_CLASS_META,
  MEDICATION_CLASS_ORDER,
  computeFluidBalance,
  CONDUCT_SYSTEM_META,
  ANNOTATION_COLOR_META,
  formatDateBR,
  formatDayMonth,
  organDonationLabel,
  directiveLabel,
} from "@/lib/clinical";
import { currentVitalsSummary, latestDayVitals } from "@/components/SmartMonitoring";
import type { VitalSummaryEntry } from "@/components/SmartMonitoring";

import { summarizeLPP, STAGE_META } from "@/lib/lpp";
import { cultureResultBadge, detectCultureAlerts } from "@/lib/cultures";
import {
  DEVICE_CATEGORIES,
  categoryLabel,
  categoryIcon,
  deviceTypeByCode,
  type DeviceCategory,
} from "@/data/devices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PumpMonitor, PumpDashboard } from "@/components/PumpMonitor";
import { AnatomicalMap } from "@/components/AnatomicalMap";
import { ClinicalTrendChart } from "@/components/ClinicalTrendChart";
import { SofaButton } from "@/components/SofaPanel";
import { SofaCalculatorModal } from "@/components/SofaCalculator";

import { IntubationJourney } from "@/components/IntubationJourney";
import { DischargeCheckModal, dischargeStatus } from "@/components/DischargeCheck";
import { Saps3Modal, Saps3Button, saps3Status } from "@/components/Saps3Panel";
import {
  FisherModal,
  FisherButton,
  computeFisher,
  computeClassicFisher,
} from "@/components/FisherPanel";
import { HuntHessModal, HuntHessButton, computeHuntHess } from "@/components/HuntHessPanel";
import { WfnsModal, WfnsButton, computeWfns } from "@/components/WfnsPanel";
import { IchScoreModal, IchScoreButton, computeIch } from "@/components/IchScorePanel";
import { NihssModal, NihssButton, computeNihss } from "@/components/NihssPanel";
import { VasogradeModal, VasogradeButton } from "@/components/VasogradePanel";
import { summarizeSofa } from "@/lib/sofa";
import { MedicationAnalysisModal } from "@/components/MedicationAnalysis";
import { AntibioticHistory } from "@/components/AntibioticHistory";
import { BloodGasPanel } from "@/components/BloodGasPanel";
import { MacroStatusBar } from "@/components/MacroStatus";

import { Pill, CircleCheck, CirclePause, Ban, RotateCcw } from "lucide-react";

/** Linha secundária da medicação no painel principal: bomba → mL/h; demais → dose · via · intervalo. */
function medSecondary(m: Medication): string {
  if (medClassOf(m) === "pump") {
    const r = m.pump?.rateMlPerHour ?? m.mlPerHour;
    return r != null ? `${r.toFixed(1)} mL/h` : (m.dose ?? "");
  }
  return [m.dose, m.route, m.freq].filter(Boolean).join(" · ");
}

/** Antimicrobianos: apenas o número de doses já administradas. */
function medDosesLabel(m: Medication): string | null {
  const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
  if (!isAtb) return null;
  const g = m.dosesGiven;
  if (g == null) return null;
  return g === 1 ? "1 dose" : `${g} doses`;
}

const VITAL_LEVEL_TXT: Record<string, string> = {
  normal: "text-clinical-stable",
  leve: "text-yellow-600",
  mod: "text-orange-600",
  grave: "text-clinical-critical",
  na: "text-muted-foreground",
};

/** Formata o último registro do sinal vital: máximo (linha de cima) e mínimo (linha de baixo). */
function vitalMinMax(v: VitalSummaryEntry): { max: string; min: string | null } {
  const dec = v.dec ?? 0;
  const unit = v.unit ? ` ${v.unit}` : "";
  const fmt = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(dec)}${unit}` : null;
  const max = fmt(v.max);
  const min = fmt(v.min);
  if (!max && !min) return { max: v.text.split("·")[0].trim() || "—", min: null };
  if (max && min && max === min) return { max, min: null };
  return { max: max ?? min ?? "—", min: max ? min : null };
}

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

function Chip({
  kind,
  children,
  className,
}: {
  kind: TimelineKind | "neutral";
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`chip ${kindClass[kind]} ${className ?? ""}`}>{children}</span>;
}

const TITLE_GREENS = [
  "title-green-1",
  "title-green-2",
  "title-green-3",
  "title-green-4",
  "title-green-5",
  "title-green-6",
  "title-green-7",
] as const;

function ColTitle({ children, tone = 0 }: { children: React.ReactNode; tone?: number }) {
  return (
    <div className={`title-box ${TITLE_GREENS[tone % TITLE_GREENS.length]} mb-2`}>
      {" "}
      <span className="leading-tight">{children}</span>
    </div>
  );
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
    <div
      className={`ios-inset px-1.5 pb-1 pt-1 ${mounted && r.days > r.max ? "alert-outline" : ""}`}
      title={tip}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="min-w-0 flex-1 truncate f-var text-[11px] leading-snug">
          {deviceShort(d)}
        </span>{" "}
        {mounted && (
          <span className={`shrink-0 f-var text-[10px] ${r.className}`}>
            {days}/{r.max}d
          </span>
        )}
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-surface-3">
        {" "}
        {mounted && (
          <div
            className={`h-full rounded-full transition-all ${DEVICE_BAR[r.level]}`}
            style={{ width: `${Math.min(100, Math.max(4, r.percent))}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function PatientRow({
  patient,
  onEdit,
  onPrint,
  onUpdate,
  onDelete,
  onArchive,
  onDischarge,
  defaultOpen = false,
}: {
  patient: Patient;
  onEdit?: (p: Patient, tab?: string) => void;
  onPrint?: (p: Patient) => void;
  onUpdate?: (p: Patient) => void;
  onDelete?: (p: Patient) => void;
  onArchive?: (p: Patient) => void;
  onDischarge?: (p: Patient) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pumpOpen, setPumpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDraft, setHistoryDraft] = useState(patient.clinicalHistory ?? "");
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
  const [vasoOpen, setVasoOpen] = useState(false);
  const [sofaOpen, setSofaOpen] = useState(false);
  const [scalesExpanded, setScalesExpanded] = useState(true);
  const [pastMedsExpanded, setPastMedsExpanded] = useState(true);
  // Coluna 7 inicia em modo leitura; qualquer clique na coluna ativa a edição inline.
  const [planInlineEdit, setPlanInlineEdit] = useState(false);
  const planColRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!planInlineEdit) return;
    const handle = (e: MouseEvent) => {
      if (planColRef.current?.contains(e.target as Node)) return;
      setPlanInlineEdit(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [planInlineEdit]);
  const dcStatus = useMemo(() => dischargeStatus(patient), [patient]);
  const dcBtnClass =
    dcStatus.status === "ready"
      ? "bg-clinical-stable/20 text-clinical-stable hover:bg-clinical-stable/30"
      : dcStatus.status === "blocked"
        ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
        : dcStatus.status === "progress"
          ? "bg-clinical-attention/15 text-clinical-attention hover:bg-clinical-attention/25"
          : "border border-border text-muted-foreground hover:bg-surface-3";
  const dcBtnLabel =
    dcStatus.status === "ready"
      ? "Apto p/ alta"
      : dcStatus.status === "blocked"
        ? "Alta bloqueada"
        : dcStatus.status === "progress"
          ? `Alta ${dcStatus.pct}%`
          : "Checar Alta";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lppSummary = useMemo(() => summarizeLPP(patient.lpp), [patient.lpp]);

  const suggestions = useMemo(() => aiTherapySuggestions(patient), [patient]);
  const activeMeds = patient.medications.filter((m) => m.active !== false);
  const activeDevices = (patient.devices ?? []).filter((d) => !d.removedAt);
  const removedDevices = (patient.devices ?? []).filter((d) => d.removedAt);

  const computedAge = computeAge(patient.birthDate) ?? patient.age;
  const bmi = computeBMI(patient.weight, patient.height);
  const dHosp = daysSinceAdmission(patient.admissionHosp) ?? patient.daysHosp;
  const dICU = daysSinceAdmission(patient.admissionICU) ?? patient.daysICU;

  const finalizeMed = (med: Medication) => {
    if (!onUpdate) return;
    const today = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const end = `${p(today.getDate())}/${p(today.getMonth() + 1)}/${today.getFullYear()}`;
    onUpdate({
      ...patient,
      medications: patient.medications.map((m) =>
        m === med ? { ...m, active: false, end: m.end ?? end } : m,
      ),
    });
  };

  const reactivateMed = (med: Medication) => {
    if (!onUpdate) return;
    onUpdate({
      ...patient,
      medications: patient.medications.map((m) =>
        m === med ? { ...m, active: true, end: undefined } : m,
      ),
    });
  };

  // Edição direta das anotações da coluna 7 (painel principal).
  const updateConductSub = (ci: number, si: number, text: string) => {
    if (!onUpdate) return;
    onUpdate({
      ...patient,
      conducts: patient.conducts.map((c, idx) =>
        idx !== ci
          ? c
          : { ...c, subItems: (c.subItems ?? []).map((s, j) => (j === si ? { ...s, text } : s)) },
      ),
    });
  };

  const addConductSub = (ci: number) => {
    if (!onUpdate) return;
    onUpdate({
      ...patient,
      conducts: patient.conducts.map((c, idx) =>
        idx !== ci ? c : { ...c, subItems: [...(c.subItems ?? []), { text: "" }] },
      ),
    });
  };

  const removeConductSub = (ci: number, si: number) => {
    if (!onUpdate) return;
    onUpdate({
      ...patient,
      conducts: patient.conducts.map((c, idx) =>
        idx !== ci ? c : { ...c, subItems: (c.subItems ?? []).filter((_, j) => j !== si) },
      ),
    });
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
  const fluidBalance = useMemo(
    () => computeFluidBalance(patient.state.fluidBalance),
    [patient.state.fluidBalance],
  );
  const crcl = useMemo(() => computeCrCl(patient), [patient]);
  const bhRate = useMemo(() => {
    const w = patient.weight;
    if (!w || !Number.isFinite(w) || w <= 0) return null;
    return fluidBalance.balance / w / 24; // mL/kg/h (janela de 24 h)
  }, [fluidBalance.balance, patient.weight]);
  const vitals = currentVitalsSummary(patient);
  const latestVitals = useMemo(() => latestDayVitals(patient), [patient]);
  const vitalRows = latestVitals.date
    ? latestVitals.rows
    : [
        { label: "Temp", v: vitals.temp },
        { label: "SpO₂", v: vitals.spo2 },
        { label: "FC", v: vitals.fc },
        { label: "FR", v: vitals.fr },
        { label: "PAS", v: vitals.pas },
        { label: "PAD", v: vitals.pad },
        { label: "PAM", v: vitals.bp },
      ].filter((r) => r.v.level !== "na");
  const vitalsDateLabel = latestVitals.date ? formatDayMonth(latestVitals.date) : null;

  // Image lightbox
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const editBtn = (tab: string, title = "Editar este bloco") =>
    onEdit ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(patient, tab);
        }}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        title={title}
      >
        <Pencil className="h-3 w-3" />
      </button>
    ) : null;

  // On collapsed rows, any column click expands the row. Once expanded, a
  // column click opens the editor for that block (ou ativa edição inline no plano).
  const colClick = (tab: string) => (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label, [role='button']")) return;
    e.stopPropagation();
    if (!open) {
      setOpen(true);
      return;
    }
    if (tab === "plan" && onUpdate) {
      setPlanInlineEdit(true);
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
      <span
        className={`title-box ${TITLE_GREENS[tone % TITLE_GREENS.length]} min-w-0 !text-[11px] leading-tight`}
      >
        {" "}
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {" "}
        {right}
        {editBtn(tab, title)}
      </span>
    </div>
  );

  return (
    <div className="border-b border-border last:border-b-0 bg-soft-blue-gradient">
      {" "}
      {/* Collapsed row — 7 columns, separated by vertical dividers */}
      {!open && (
        <div className="col-shadowed-grid grid w-full grid-cols-[1.3fr_1.2fr_1.2fr_1.35fr_1.2fr_1.3fr_1.75fr] items-start gap-2 p-2 text-left font-semibold [&>div]:min-w-0 [&>div]:overflow-hidden [&>div]:ios-card [&>div]:px-2.5 [&>div]:py-2.5 [&>div]:cursor-pointer [&>div:hover]:ios-card-hover">
          {" "}
          {/* 1 - Identificação */}
          <div
            onClick={colClick("id")}
            className="col-ink flex min-w-0 flex-col px-3 first:pl-0 last:pr-0"
          >
            <div className="mb-1.5 flex items-center justify-between gap-1.5">
              <span className="title-box title-green-1 min-w-0 !text-[11px] leading-tight">
                {" "}
                🪪 Identificação
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                {" "}
                {onPrint && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint(patient);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    title="Imprimir paciente"
                  >
                    <Printer className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportPatient(patient);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  title="Exportar paciente (JSON)"
                >
                  <Download className="h-3 w-3" />
                </button>{" "}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Remover ${patient.name} (${patient.bed}) do sistema? Esta ação não pode ser desfeita.`,
                        )
                      )
                        onDelete(patient);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-clinical-critical/15 hover:text-clinical-critical"
                    title="Excluir paciente"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(patient);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    title="Arquivar paciente (histórico)"
                  >
                    <Archive className="h-3 w-3" />
                  </button>
                )}
                {editBtn("id", "Editar identificação")}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDischargeOpen(true);
              }}
              className={`mb-1.5 inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${dcBtnClass}`}
              title="Checar critérios de alta da UTI"
            >
              <LogOut className="h-3 w-3" /> {dcBtnLabel}
            </button>
            <div className="flex min-w-0 items-center gap-2 border-b-2 border-clinical-critical/70 pb-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${sevDot[patient.severity]}`}
                title={sevLabel[patient.severity]}
              />
              <span className="truncate text-lg font-extrabold leading-tight text-foreground">
                {patient.name}
              </span>
            </div>
            <div className="mt-1.5">
              <MacroStatusBar patient={patient} compact />
            </div>
            {/* Médico em pilha */}
            <div className="mt-1.5 space-y-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground f-fixed">
                Médico
              </div>
              <div className="truncate text-[11px] font-semibold text-foreground f-var">
                {patient.attending}
              </div>
            </div>
            {/* Idade inline + leito/peso/altura */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-muted-foreground">
              <span className="font-mono font-medium text-clinical-neutral">{patient.bed}</span>
              <span className="text-border">·</span>
              <span>
                Idade{" "}
                <span className="font-mono font-semibold text-foreground">{computedAge}a</span>
              </span>
              <span className="text-border">·</span>
              <span>{patient.sex}</span>
              <span className="text-border">·</span>
              <span>
                {patient.weight}kg{patient.height ? `/${patient.height}cm` : ""}
              </span>
            </div>
            {/* Admissões empilhadas: dias à frente da data */}
            <div className="mt-1.5 space-y-0.5">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground f-fixed">
                Adm Hosp
              </div>
              <div className="text-[10px] font-mono text-foreground">
                <span className="font-semibold text-clinical-neutral">D{dHosp}</span>
                <span className="mx-1 text-border">·</span>
                <span>{patient.admissionHosp}</span>
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground f-fixed">
                Adm UTI
              </div>
              <div className="text-[10px] font-mono text-foreground">
                <span className="font-semibold text-clinical-neutral">D{dICU}</span>
                <span className="mx-1 text-border">·</span>
                <span>{patient.admissionICU}</span>
              </div>
            </div>{" "}
            {patient.origin && (
              <div className="mt-1 truncate text-[10px] leading-snug text-muted-foreground">
                <span className="font-semibold">Origem:</span>{" "}
                {[
                  patient.origin.name ?? patient.origin.type,
                  patient.origin.city,
                  patient.origin.state,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {/* Escalas — scores empilhados, Fisher separada */}
            <div
              className="mt-2 border-t border-border/60 pt-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setScalesExpanded((v) => !v)}
                className="title-box title-green-1 mb-1 inline-flex items-center gap-1 !text-[10px]"
              >
                {scalesExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                ⚙️ Escalas
              </button>
              {scalesExpanded && (
                <div className="flex flex-col items-start gap-0.5">
                  <Saps3Button patient={patient} onClick={() => setSaps3Open(true)} compact />
                  <FisherButton
                    patient={patient}
                    onClick={() => setFisherOpen(true)}
                    compact
                    variant="classic"
                  />
                  <FisherButton
                    patient={patient}
                    onClick={() => setFisherOpen(true)}
                    compact
                    variant="modified"
                  />
                  <HuntHessButton patient={patient} onClick={() => setHuntHessOpen(true)} compact />
                  <WfnsButton patient={patient} onClick={() => setWfnsOpen(true)} compact />
                  <IchScoreButton patient={patient} onClick={() => setIchOpen(true)} compact />
                  <NihssButton patient={patient} onClick={() => setNihssOpen(true)} compact />
                  <VasogradeButton patient={patient} onClick={() => setVasoOpen(true)} compact />
                  <SofaButton patient={patient} onClick={() => setSofaOpen(true)} compact />
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="rounded border border-strong bg-muted/50 px-1.5 py-1 text-[10px] font-semibold text-foreground hover:bg-muted"
                    title="História clínica — evolução do paciente no hospital"
                  >
                    📖 História clínica{patient.clinicalHistory ? " ✓" : ""}
                  </button>
                </div>
              )}
            </div>
            {/* Procedimentos & eventos — agora exibidos na coluna 03 */}
          </div>{" "}
          {/* 2 - História */}
          <div
            onClick={colClick("hist")}
            className="flex min-w-0 flex-col gap-0.5 !px-1.5 text-[11px]"
          >
            <ColHead label="📋 História" tab="hist" title="Editar história" tone={1} />
            <div className="flex flex-wrap gap-0.5">
              {" "}
              {patient.diagnoses.slice(-3).map((d, i) => (
                <Chip key={i} kind={d.kind} className="!text-[10px]">
                  {d.label}
                </Chip>
              ))}
              {patient.diagnoses.length === 0 && (
                <span className="text-[11px] italic text-muted-foreground/60">
                  Sem diagnósticos
                </span>
              )}
            </div>
          </div>{" "}
          {/* 3 - Invasões / Dispositivos */}
          <div onClick={colClick("proc")} className="flex min-w-0 flex-col gap-1.5">
            <ColHead
              label="🧷 Invasões"
              tab="proc"
              title="Editar dispositivos invasivos"
              tone={2}
              right={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIntubOpen(true);
                  }}
                  className="rounded p-0.5 text-clinical-critical hover:bg-clinical-critical/15"
                  title="Jornada de intubação"
                ></button>
              }
            />
            <div className="space-y-0.5">
              {" "}
              {activeDevices.slice(0, 4).map((d) => (
                <DeviceCompact key={d.id} d={d} mounted={mounted} />
              ))}
              {activeDevices.length > 4 && (
                <div className="text-[10px] text-muted-foreground">
                  +{activeDevices.length - 4} dispositivo(s)
                </div>
              )}
              {activeDevices.length === 0 && (
                <span className="text-[11px] italic text-muted-foreground/60">
                  Sem dispositivos
                </span>
              )}
            </div>
            {patient.procedures.length > 0 && (
              <div className="mt-2 border-t border-border/60 pt-1.5">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {" "}
                  Procedimentos & eventos
                </div>
                <div className="flex flex-wrap gap-1">
                  {" "}
                  {patient.procedures.slice(-3).map((p, i) => (
                    <Chip key={i} kind={p.kind}>
                      {p.label}
                    </Chip>
                  ))}
                  {patient.procedures.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{patient.procedures.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>{" "}
          {/* 4 - Medicações com dashboard de bombas */}
          <div
            onClick={colClick("med")}
            className="flex min-w-0 flex-col gap-1 !px-1.5 text-[11px]"
          >
            <ColHead
              label="💊 Medicações"
              tab="med"
              title="Editar medicações"
              tone={3}
              right={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMedAnalysisOpen(true);
                    }}
                    className="rounded p-0.5 text-primary hover:bg-primary/15"
                    title="Análise Medicamentosa"
                  >
                    <Pill className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiOpen(true);
                    }}
                    className="rounded p-0.5 text-clinical-attention hover:bg-clinical-attention/15"
                    title="Ajustar terapia (IA)"
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                </div>
              }
            />

            <div onClick={(e) => e.stopPropagation()}>
              <PumpDashboard patient={patient} onOpen={() => setPumpOpen(true)} />
            </div>

            <div className="space-y-0.5">
              {" "}
              {MEDICATION_CLASS_ORDER.map((cls) => {
                const list = medsByClass.get(cls);
                if (!list || !list.length) return null;
                const meta = MEDICATION_CLASS_META[cls];
                return (
                  <div
                    key={cls}
                    className={`rounded border ${meta.borderClass} ${meta.bgClass} px-1 py-0.5`}
                  >
                    <div
                      className={`mb-0 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider ${meta.className}`}
                    >
                      <span>{meta.short}</span>
                      <span className="font-mono">{list.length}</span>
                    </div>{" "}
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((m, i) => {
                        const secondary = medSecondary(m);
                        const doses = medDosesLabel(m);
                        return (
                          <div key={i} className="text-[10.5px] leading-snug">
                            <div className="flex items-center gap-1">
                              <CircleDot className={`h-1.5 w-1.5 shrink-0 ${kindClass[m.kind]}`} />
                              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                                {m.name}
                              </span>
                            </div>{" "}
                            {secondary && (
                              <div className="ml-2.5 font-mono text-[9.5px] text-muted-foreground">
                                {secondary}
                              </div>
                            )}
                            {doses && (
                              <div className="ml-2.5 font-mono text-[9px] text-muted-foreground">
                                {doses}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {list.length > 3 && (
                      <div className="text-[9px] text-muted-foreground">+{list.length - 3}</div>
                    )}
                  </div>
                );
              })}
              {activeMeds.length === 0 && (
                <span className="text-[11px] italic text-muted-foreground/60">
                  Sem medicações ativas
                </span>
              )}
            </div>
          </div>{" "}
          {/* 5 - Culturas → Lab → Gasometria → Imagem */}
          <div onClick={colClick("exam")} className="flex min-w-0 flex-col gap-1">
            <ColHead label="🦠 Culturas · Imagem" tab="exam" title="Editar exames" tone={4} />{" "}
            {/* 1) Culturas */}
            {(patient.cultures?.length ?? 0) > 0 && (
              <div
                className="space-y-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) onEdit(patient, "cult");
                }}
              >
                {" "}
                {patient
                  .cultures!.slice(-2)
                  .reverse()
                  .map((c) => {
                    const r = cultureResultBadge(c);
                    const borderCls =
                      r.label === "Positiva"
                        ? "border border-clinical-critical/70"
                        : r.label === "Negativa"
                          ? "border border-clinical-stable/70"
                          : "border border-clinical-attention/70";
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-[10.5px] leading-snug ${borderCls}`}
                        title={`${c.organism ?? c.source} — ${r.label}`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-semibold text-foreground"> {c.source}</span>{" "}
                          {c.organism ? (
                            <span className="text-muted-foreground"> · {c.organism}</span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
            {/* 4) Imagem */}
            {(patient.imaging?.length ?? 0) > 0 && (
              <div className="mt-1 space-y-0.5">
                {" "}
                {patient.imaging!.slice(0, 2).map((im) => {
                  const pending = im.status === "solicitado" || im.conclusion === "pendente";
                  const borderClass = pending
                    ? "border-2 border-clinical-attention/80 bg-clinical-attention/10"
                    : im.conclusion === "normal"
                      ? "border-2 border-clinical-stable/80 bg-clinical-stable/10"
                      : im.conclusion === "alterado" || im.conclusion === "critico"
                        ? "border-2 border-clinical-critical/80 bg-clinical-critical/10"
                        : "border border-border";
                  return (
                  <div
                    key={im.id}
                    className={`rounded px-1 py-0.5 text-[10.5px] leading-snug ${borderClass}`}
                    title={pending ? "Resultado pendente" : im.conclusion ? `Resultado ${im.conclusion}` : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 truncate" title={im.summary}>
                        <span className="font-semibold text-foreground">{im.modality}</span>
                        <span className="text-muted-foreground"> {im.region}</span>
                      </span>
                      {im.images && im.images.length > 0 && (
                        <span className="shrink-0 rounded bg-clinical-resp/15 px-1 text-[8.5px] font-bold text-clinical-resp">
                          {" "}
                          {im.images.length}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {formatDateBR(im.performedAt)}
                    </div>
                    {im.status && (
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-foreground">
                        {im.status === "concluido" ? "Concluído" : "Solicitado"}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>{" "}
          {/* 6 - Estado atual (Sinais vitais) · Balanço hídrico · Notas */}
          <div
            onClick={colClick("sup")}
            className="flex min-w-0 flex-col gap-0.5 !px-1.5 text-[11px]"
          >
            <ColHead label="📈 Estado atual" tab="sup" title="Editar estado atual" tone={5} />{" "}
            {/* Estado atual — sinais vitais (linhas) */}
            <div className="ios-inset px-1.5 py-1">
              <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground">
                {" "}
                Sinais vitais{vitalsDateLabel ? ` · ${vitalsDateLabel}` : ""}
              </div>
              <div className="space-y-0.5">
                {" "}
                {vitalRows.map((r) => {
                  const abn = r.v.level === "grave" || r.v.level === "mod" || r.v.level === "leve";
                  const mm = vitalMinMax(r.v);
                  return (
                    <div
                      key={r.label}
                      className={`grid grid-cols-[34px_1fr_auto] items-center gap-x-1 py-[1px] text-[10px] ${abn ? "alert-outline px-1" : ""}`}
                      title={abn ? "Sinal vital alterado (último registro)" : undefined}
                    >
                      <span
                        className="f-fixed truncate font-semibold text-muted-foreground"
                        title={r.label}
                      >
                        {r.label}
                      </span>
                      <span
                        className={`flex flex-col items-end leading-tight font-mono font-bold tabular-nums ${VITAL_LEVEL_TXT[r.v.level]}`}
                      >
                        <span title="Valor máximo">{mm.max}</span>
                        {mm.min ? (
                          <span className="opacity-80" title="Valor mínimo">
                            {mm.min}
                          </span>
                        ) : null}
                      </span>
                      <span className="w-2 text-right">
                        {r.v.level === "grave" && (
                          <span className="alert-dot" title="Alteração grave" />
                        )}
                      </span>
                    </div>
                  );
                })}
                {crcl && (
                  <div className="mt-0.5 grid grid-cols-[34px_1fr_auto] items-baseline gap-x-1 border-t border-border/50 pt-0.5 text-[10px]">
                    <span className="f-fixed font-semibold text-muted-foreground">ClCr</span>
                    <span
                      className="text-right font-mono font-bold tabular-nums text-foreground"
                      title={`Cockcroft-Gault · Cr ${crcl.creat} mg/dL`}
                    >
                      {" "}
                      {crcl.value}
                    </span>
                    <span className="w-2" />
                  </div>
                )}
              </div>
            </div>{" "}
            {/* Laboratoriais + Gasometria (compacto) */}
            {(() => {
              const isGaso = (code?: string, label?: string) =>
                /pH|PaO2|PaCO2|HCO3|SatO2|Lact|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(
                  code ?? label ?? "",
                );
              const filled = patient.exams.filter(
                (e) => String(e.value ?? "").trim() !== "" && String(e.value).trim() !== "—",
              );
              const lab = filled.filter((e) => !isGaso(e.code, e.label)).slice(0, 3);
              const gaso = filled.filter((e) => isGaso(e.code, e.label)).slice(0, 3);
              const rows = (list: typeof patient.exams) =>
                list.map((e, i) => {
                  const ins = examInsight(e, patient.sex);
                  const b = ins.bucket ? bucketBadge(ins.bucket) : null;
                  const abn = !!ins.bucket && ins.bucket !== "normal";
                  return (
                    <div
                      key={i}
                      className={`flex items-baseline justify-between gap-1 rounded text-[10px] ${abn ? "alert-outline px-1" : ""}`}
                      title={abn ? `Resultado alterado · ${b?.label}` : undefined}
                    >
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {e.label}
                      </span>
                      <span
                        className={`shrink-0 font-mono font-bold ${b?.className ?? "text-foreground"}`}
                      >
                        {e.value}
                      </span>
                    </div>
                  );
                });
              return (
                <>
                  {" "}
                  {lab.length > 0 && (
                    <div className="ios-inset px-1.5 py-1">
                      <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground">
                        Laboratoriais
                      </div>
                      <div className="space-y-0.5">{rows(lab)}</div>
                    </div>
                  )}
                  {gaso.length > 0 && (
                    <div className="ios-inset px-1.5 py-1">
                      <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-clinical-resp">
                        Gasometria
                      </div>
                      <div className="space-y-0.5">{rows(gaso)}</div>
                    </div>
                  )}
                </>
              );
            })()}{" "}
            {/* Balanço hídrico — linhas */}
            {patient.state.fluidBalance &&
            (fluidBalance.totalIntake || fluidBalance.totalOutput || fluidBalance.totalDrains) ? (
              <div className="ios-inset px-1.5 py-1">
                <div className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  {" "}
                  Balanço hídrico
                </div>
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
                  <div
                    className={`flex items-baseline justify-between gap-1 border-t border-border pt-0.5 font-bold ${
                      fluidBalance.balance > 500
                        ? "text-clinical-attention"
                        : fluidBalance.balance < -500
                          ? "text-clinical-critical"
                          : "text-clinical-stable"
                    }`}
                  >
                    <span>BH</span>
                    <span>
                      {" "}
                      {bhRate != null
                        ? `${bhRate >= 0 ? "+" : ""}${bhRate.toFixed(2)} mL/kg/h`
                        : `${fluidBalance.balance >= 0 ? "+" : ""}${fluidBalance.balance} mL`}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            {patient.state.notes && (
              <div className="mt-1 text-[10px] italic text-muted-foreground line-clamp-3">
                {" "}
                {patient.state.notes}
              </div>
            )}
          </div>{" "}
          {/* 7 - Plano · Tarefas */}
          <div onClick={colClick("plan")} className="flex min-w-0 flex-col">
            <ColHead label="✅ Plano · Condutas" tab="plan" title="Editar plano e tarefas" />
            <ul
              className="list-none space-y-1 p-0"
              onClick={(e) => {
                e.stopPropagation();
                const t = e.target as HTMLElement;
                if (t.closest("button, a, input, select, textarea, label, [role='button']")) return;
                if (onEdit) onEdit(patient, "plan");
              }}
            >
              {" "}
              {patient.conducts.slice(0, 4).map((c, i) => {
                const meta = c.system ? CONDUCT_SYSTEM_META[c.system] : CONDUCT_SYSTEM_META.other;
                const visibleSubs = c.subItems?.filter((s) => !s.hidden) ?? [];
                const firstAnn = visibleSubs.find((s) => s.text?.trim());
                const annColor = firstAnn?.color ? ANNOTATION_COLOR_META[firstAnn.color] : null;
                const annDate = firstAnn?.date ?? c.startedAt;
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-1.5 rounded border px-1.5 py-0.5 text-[11px] leading-snug ${meta.borderClass}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-ink">
                        {meta.short}
                      </span>{" "}
                      {firstAnn ? (
                        <span
                          className={`block whitespace-pre-wrap break-words ${annColor?.textClass ?? "text-foreground"}`}
                        >
                          <AnnotationText
                            text={firstAnn.text}
                            base={firstAnn.color ?? "default"}
                            defaultClass=""
                          />
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground">Sem anotações</span>
                      )}
                      {visibleSubs.length > 1 && (
                        <span className="ml-1 text-[9px] text-muted-foreground">
                          · +{visibleSubs.length - 1}
                        </span>
                      )}
                    </span>
                    {annDate && (
                      <span className="shrink-0 text-[9px] font-mono text-muted-foreground">
                        {formatDayMonth(annDate)}
                      </span>
                    )}
                  </li>
                );
              })}
              {patient.conducts.length > 4 && (
                <li className="text-[10px] text-muted-foreground">
                  +{patient.conducts.length - 4} sistema(s)
                </li>
              )}
            </ul>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="mt-auto flex items-center gap-1 pt-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              title={open ? "Recolher linha" : "Expandir linha"}
            >
              {" "}
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {open ? "Recolher" : "Expandir"}
            </button>
          </div>
        </div>
      )}
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
            <div className="flex items-center gap-1">
              {" "}
              {onPrint && (
                <button
                  type="button"
                  onClick={() => onPrint(patient)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  title="Imprimir"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => exportPatient(patient)}
                className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                title="Exportar JSON"
              >
                <Download className="h-3.5 w-3.5" />
              </button>{" "}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(patient)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remover ${patient.name} (${patient.bed}) do sistema? Esta ação não pode ser desfeita.`,
                      )
                    )
                      onDelete(patient);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-clinical-critical/15 hover:text-clinical-critical"
                  title="Excluir paciente"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {onArchive && (
                <button
                  type="button"
                  onClick={() => onArchive(patient)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  title="Arquivar paciente (histórico)"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setDischargeOpen(true)}
                className={`ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${dcBtnClass}`}
                title="Checar critérios de alta da UTI"
              >
                <LogOut className="h-3.5 w-3.5" /> {dcBtnLabel}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-1 ios-inset px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {" "}
                Recolher
              </button>
            </div>
          </div>
          <div className="col-shadowed-grid grid grid-cols-[1.15fr_1.2fr_1.2fr_1.2fr_1.2fr_1.35fr_1.9fr] items-start gap-2 p-2 text-[12px] font-semibold [&>div]:min-w-0 [&>div]:overflow-hidden [&>div]:ios-card [&>div]:px-2.5 [&>div]:py-2.5">
            {" "}
            {/* 1 */}
            <div onClick={colClick("id")} className="col-ink">
              <ColTitle tone={0}>🪪 Identificação</ColTitle>
              {/* Médico em pilha */}
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground f-fixed">
                  Médico
                </div>
                <div className="truncate text-[12px] font-semibold text-foreground f-var">
                  {patient.attending}
                </div>
              </div>
              {/* Idade inline com sexo/peso/altura */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  Idade{" "}
                  <span className="font-mono font-semibold text-foreground">{computedAge}a</span>
                </span>
                <span className="text-border">·</span>
                <span>{patient.sex}</span>
                <span className="text-border">·</span>
                <span>
                  {patient.weight}kg{patient.height ? `/${patient.height}cm` : ""}
                </span>
              </div>
              {/* Leito */}
              <div className="mt-1 text-[11px] text-muted-foreground">
                Leito <span className="font-mono font-semibold text-foreground">{patient.bed}</span>
              </div>
              {/* Admissões empilhadas: dias à frente da data */}
              <div className="mt-2 space-y-1">
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground f-fixed">
                    Adm Hosp
                  </div>
                  <div className="text-[11px] font-mono text-foreground">
                    <span className="font-semibold text-clinical-neutral">D{dHosp}</span>
                    <span className="mx-1 text-border">·</span>
                    <span>{patient.admissionHosp}</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground f-fixed">
                    Adm UTI
                  </div>
                  <div className="text-[11px] font-mono text-foreground">
                    <span className="font-semibold text-clinical-neutral">D{dICU}</span>
                    <span className="mx-1 text-border">·</span>
                    <span>{patient.admissionICU}</span>
                  </div>
                </div>
              </div>
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <Row k="Alergias" v={patient.allergies.join(", ")} />{" "}
                {(patient.legalRepresentative?.name || patient.legalRepresentative?.phone) && (
                  <Row
                    k="Repr. legal"
                    v={`${patient.legalRepresentative.name ?? "—"}${patient.legalRepresentative.relation ? ` (${patient.legalRepresentative.relation})` : ""}${patient.legalRepresentative.phone ? ` · ${patient.legalRepresentative.phone}` : ""}`}
                  />
                )}
                {(patient.legalRepresentative2?.name || patient.legalRepresentative2?.phone) && (
                  <Row
                    k="Repr. legal 2"
                    v={`${patient.legalRepresentative2.name ?? "—"}${patient.legalRepresentative2.relation ? ` (${patient.legalRepresentative2.relation})` : ""}${patient.legalRepresentative2.phone ? ` · ${patient.legalRepresentative2.phone}` : ""}`}
                  />
                )}
                {patient.advanceDirective &&
                  (patient.advanceDirective.intubation !== "unknown" ||
                    patient.advanceDirective.resuscitation !== "unknown") && (
                    <Row
                      k="Diretivas"
                      v={`${directiveLabel(patient.advanceDirective.intubation, "Entubar")} · ${directiveLabel(patient.advanceDirective.resuscitation, "RCP")}`}
                    />
                  )}
                {patient.organDonation && patient.organDonation !== "unknown" && (
                  <Row k="Doação órgãos" v={organDonationLabel[patient.organDonation]} />
                )}
              </dl>{" "}
              {patient.origin && (
                <div className="mt-2 ios-inset px-2 py-1.5 text-[11px]">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Origem
                  </div>
                  <div className="text-foreground">
                    {patient.origin.name ?? patient.origin.type}
                  </div>
                  <div className="text-muted-foreground">
                    {" "}
                    {patient.origin.type}
                    {patient.origin.unit ? ` · ${patient.origin.unit}` : ""}
                    {patient.origin.city ? ` · ${patient.origin.city}` : ""}
                    {patient.origin.state ? `/${patient.origin.state}` : ""}
                  </div>
                </div>
              )}
              <div className="mt-3">
                <span
                  className={`chip ${kindClass[patient.severity === "critical" ? "critical" : patient.severity === "attention" ? "attention" : "stable"]}`}
                >
                  {" "}
                  {sevLabel[patient.severity]}
                </span>
              </div>{" "}
              {/* Escalas — scores empilhados */}
              <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setScalesExpanded((v) => !v)}
                  className="mb-1.5 flex w-full items-center justify-between gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                >
                  <ColTitle tone={5}>⚙️ Escalas</ColTitle>
                  {scalesExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                {scalesExpanded && (
                  <div className="flex flex-col items-start gap-1">
                    <Saps3Button patient={patient} onClick={() => setSaps3Open(true)} />
                    <FisherButton
                      patient={patient}
                      onClick={() => setFisherOpen(true)}
                      variant="classic"
                    />
                    <FisherButton
                      patient={patient}
                      onClick={() => setFisherOpen(true)}
                      variant="modified"
                    />
                    <HuntHessButton patient={patient} onClick={() => setHuntHessOpen(true)} />
                    <WfnsButton patient={patient} onClick={() => setWfnsOpen(true)} />
                    <IchScoreButton patient={patient} onClick={() => setIchOpen(true)} />
                    <NihssButton patient={patient} onClick={() => setNihssOpen(true)} />
                    <VasogradeButton patient={patient} onClick={() => setVasoOpen(true)} />
                    <SofaButton patient={patient} onClick={() => setSofaOpen(true)} />
                  </div>
                )}
              </div>
              {/* Procedimentos & eventos — agora exibidos na coluna 03 */}
            </div>{" "}
            {/* 2 */}
            <div onClick={colClick("hist")} className="text-[11px] !px-1.5">
              <ColTitle tone={1}>📋 História clínica</ColTitle>
              <div className="space-y-2">
                {" "}
                {(
                  [
                    {
                      cat: "current",
                      label: "Diagnósticos atuais",
                      box: "pastel-current",
                      text: "text-ink",
                      head: "pastel-current-head",
                    },
                    {
                      cat: "inactive",
                      label: "Diagnósticos inativos",
                      box: "pastel-inactive",
                      text: "text-ink",
                      head: "pastel-inactive-head",
                    },
                    {
                      cat: "previous",
                      label: "Diagnósticos pregressos",
                      box: "pastel-previous",
                      text: "text-ink",
                      head: "pastel-previous-head",
                    },
                    {
                      cat: "complication",
                      label: "Complicações",
                      box: "pastel-complication",
                      text: "text-ink",
                      head: "pastel-complication-head",
                    },
                  ] as const
                ).map((g) => {
                  const list = patient.diagnoses.filter((d) => (d.category ?? "current") === g.cat);
                  if (!list.length) return null;
                  return (
                    <div key={g.cat}>
                      <div
                        className={`mb-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink ${g.head}`}
                      >
                        {" "}
                        {g.label} · {list.length}
                      </div>
                      <ol className="relative ml-2 space-y-1 border-l border-border pl-3">
                        {" "}
                        {list.map((d, i) => (
                          <li key={i} className="relative">
                            <span
                              className={`absolute -left-[14px] top-1.5 h-1.5 w-1.5 rounded-full bg-current ${kindClass[d.kind]}`}
                            />
                            <div className={`rounded-md border px-2 py-1 text-ink ${g.box}`}>
                              <div className="text-[10px] text-ink">{d.date}</div>
                              <div className="text-[11px] font-semibold text-ink">
                                {d.label}
                              </div>{" "}
                              {d.detail && <div className="text-[10px] text-ink">{d.detail}</div>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
                {patient.diagnoses.length === 0 && (
                  <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">
                    Sem diagnósticos registrados.
                  </div>
                )}
              </div>

              {/* Medicações de uso prévio domiciliar */}
              {patient.pastMedications && patient.pastMedications.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setPastMedsExpanded((v) => !v)}
                    className="title-box title-green-2 mb-1 inline-flex items-center gap-1 !text-[10px]"
                  >
                    {pastMedsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    💊 Medicamentos de uso prévio · {patient.pastMedications.length}
                  </button>
                  {pastMedsExpanded && (
                    <div className="space-y-1">
                      {patient.pastMedications.map((pm) => (
                        <div
                          key={pm.id}
                          className="ios-inset rounded px-1.5 py-1 text-[10px] leading-snug text-foreground"
                        >
                          <div>
                            <span className="font-semibold">{pm.name}</span>
                            {pm.dose && <span className="text-muted-foreground"> · {pm.dose}</span>}
                            {pm.freq && <span className="text-muted-foreground"> · {pm.freq}</span>}
                          </div>
                          {pm.period && (
                            <div className="mt-0.5 text-[9px] text-muted-foreground">
                              Tempo de uso: {pm.period}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {" "}
                {patient.social.tabagismo && <div>Tabagismo: {patient.social.tabagismo}</div>}
                {patient.social.ocupacao && <div>Ocupação: {patient.social.ocupacao}</div>}
                {patient.social.dependencia && <div>Funcional: {patient.social.dependencia}</div>}
              </div>
            </div>{" "}
            {/* 3 - Dispositivos Invasivos */}
            <div onClick={colClick("proc")}>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <ColTitle tone={2}>🧷 Dispositivos invasivos</ColTitle>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {" "}
                    {(patient.infections?.filter((i) => i.status !== "resolvido").length ?? 0) >
                      0 && (
                      <button
                        onClick={() => setMapOpen(true)}
                        className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-critical hover:bg-clinical-critical/15"
                        title="Mapa de infecção"
                      >
                        {" "}
                        {patient.infections!.filter((i) => i.status !== "resolvido").length} focos
                      </button>
                    )}
                    {activeDevices.length > 0 && (
                      <button
                        onClick={() => setMapOpen(true)}
                        className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-clinical-resp hover:bg-primary/10"
                      >
                        {" "}
                        Visualizar dispositivos
                      </button>
                    )}
                    <button
                      onClick={() => setLppOpen(true)}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${lppSummary.totalActive > 0 ? "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention hover:bg-clinical-attention/15" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"}`}
                      title="Lesões por pressão"
                    >
                      {" "}
                      {lppSummary.totalActive > 0 ? `${lppSummary.totalActive} LPP` : "+ LPP"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIntubOpen(true);
                      }}
                      className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-critical hover:bg-clinical-critical/20"
                      title="Iniciar/continuar jornada de intubação orotraqueal"
                    >
                      {" "}
                      Intubação
                    </button>
                  </div>
                </div>{" "}
                {activeDevices.length === 0 && (
                  <div className="text-[11px] text-muted-foreground">Sem dispositivos ativos.</div>
                )}
                {DEVICE_CATEGORIES.map((cat) => {
                  const list = devicesByCat.get(cat.code);
                  if (!list || !list.length) return null;
                  return (
                    <div key={cat.code} className="mb-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {" "}
                        {cat.label}
                      </div>
                      <ul className="space-y-1">
                        {" "}
                        {list.map((d) => {
                          const r = deviceRisk(d);
                          return (
                            <li
                              key={d.id}
                              className={`ios-inset px-2 pb-1.5 pt-1.5 text-[11px] ${mounted && r.days > r.max ? "alert-outline" : ""}`}
                              title={mounted ? (r.semaphoreHint ?? r.label) : undefined}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="f-var">{deviceShort(d)}</span>{" "}
                                {mounted && (
                                  <span className={`f-var text-[10px] ${r.className}`}>
                                    {" "}
                                    {Math.floor(r.days)}/{r.max}d
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 h-[4px] w-full overflow-hidden rounded-full bg-surface-3">
                                {" "}
                                {mounted && (
                                  <div
                                    className={`h-full rounded-full ${DEVICE_BAR[r.level]}`}
                                    style={{ width: `${Math.min(100, Math.max(4, r.percent))}%` }}
                                  />
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {removedDevices.length > 0 && (
                  <details className="mt-1 ios-inset p-1.5" onClick={(e) => e.stopPropagation()}>
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {" "}
                      Histórico de invasões ({removedDevices.length})
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {" "}
                      {removedDevices.map((d) => {
                        const def = deviceTypeByCode(d.typeCode);
                        const days = Math.max(
                          0,
                          Math.floor(
                            (new Date(d.removedAt!).getTime() - new Date(d.insertedAt).getTime()) /
                              86400000,
                          ),
                        );
                        return (
                          <li
                            key={d.id}
                            className="ios-inset px-1.5 py-1 text-[10px] text-muted-foreground"
                          >
                            <span className="f-var">{deviceShort(d)}</span> {" · "}
                            {formatDateBR(d.insertedAt)} → {formatDateBR(d.removedAt!)} ({days}d)
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
              {/* Procedimentos & eventos — exibidos na coluna 03 */}
              {patient.procedures.length > 0 && (
                <div className="mt-4">
                  <ColTitle tone={2}>🗓️ Procedimentos & eventos</ColTitle>
                  <ol className="relative ml-2 space-y-2 border-l border-border pl-3">
                    {" "}
                    {patient.procedures.map((p, i) => (
                      <li key={i} className="relative">
                        <span
                          className={`absolute -left-[14px] mt-1.5 h-1.5 w-1.5 rounded-full bg-current ${kindClass[p.kind]}`}
                        />
                        <div className="text-[11px] text-muted-foreground">{p.date}</div>
                        <div className={`text-[12px] ${kindClass[p.kind]}`}>{p.label}</div>{" "}
                        {p.detail && (
                          <div className="text-[11px] text-muted-foreground">{p.detail}</div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>{" "}
            {/* 4 — Medicações agrupadas por classe */}
            <div onClick={colClick("med")} className="text-[11px] !px-1.5">
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
              </div>{" "}
              {(() => {
                // only meds in use; finished ones go to the history box below
                const allByClass = new Map<string, Medication[]>();
                for (const m of patient.medications.filter((x) => x.active !== false)) {
                  const cls = medClassOf(m);
                  if (!allByClass.has(cls)) allByClass.set(cls, []);
                  allByClass.get(cls)!.push(m);
                }
                return MEDICATION_CLASS_ORDER.map((cls) => {
                  const list = allByClass.get(cls);
                  if (!list || !list.length) return null;
                  const meta = MEDICATION_CLASS_META[cls];
                  return (
                    <div
                      key={cls}
                      className={`mb-1 rounded-md border ${meta.borderClass} ${meta.bgClass} p-1`}
                    >
                      <div
                        className={`mb-0.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider ${meta.className}`}
                      >
                        <span>{meta.label}</span>
                        <span className="font-mono">{list.length}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {" "}
                        {list.map((m, i) => {
                          const secondary = medSecondary(m);
                          const doses = medDosesLabel(m);
                          return (
                            <li key={i} className="ios-inset px-1.5 py-1 text-[12px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">{m.name}</span>
                              </div>
                              {secondary && (
                                <div className="font-mono text-[11px] text-muted-foreground">
                                  {secondary}
                                </div>
                              )}
                              {doses && (
                                <div className="font-mono text-[10.5px] text-muted-foreground">
                                  {doses}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                });
              })()}
              {patient.medications.length === 0 && (
                <div className="text-[11px] italic text-muted-foreground">
                  Sem medicações registradas.
                </div>
              )}
              {(() => {
                const done = patient.medications.filter((m) => m.active === false);
                if (!done.length) return null;
                return (
                  <div
                    className="mt-2 rounded-md border border-border bg-surface-2/50 p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>💊 Já utilizados</span>
                      <span className="font-mono">{done.length}</span>
                    </div>
                    <ul className="space-y-1">
                      {" "}
                      {done.map((m, i) => (
                        <li
                          key={i}
                          className="ios-inset flex items-start justify-between gap-2 px-2 py-1 text-[11px]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <CirclePause className="h-3 w-3 shrink-0 text-clinical-neutral" />
                              <span className="truncate font-semibold text-foreground">
                                {m.name}
                              </span>
                            </div>
                            <div className="ml-4 font-mono text-[10px] text-muted-foreground">
                              {" "}
                              {m.dose} · {m.route} · {m.freq}
                            </div>
                            <div className="ml-4 font-mono text-[10px] text-muted-foreground">
                              {" "}
                              {m.start}
                              {m.end ? ` → ${m.end}` : ""}
                            </div>
                          </div>{" "}
                          {onUpdate && (
                            <button
                              type="button"
                              onClick={() => reactivateMed(m)}
                              className="shrink-0 rounded border border-clinical-stable/40 bg-surface/60 p-0.5 text-clinical-stable hover:bg-surface-3"
                              title="Reativar medicação"
                              aria-label={`Reativar ${m.name}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>{" "}
            {/* 5 — Culturas → Lab → Gasometria → Imagem */}
            <div onClick={colClick("exam")}>
              {" "}
              {/* 1) Culturas */}
              <ColTitle tone={4}>🦠 Culturas · Imagem</ColTitle>
              <div
                className="mb-3"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("button, a, input, select, textarea")) return;
                  e.stopPropagation();
                  if (onEdit) onEdit(patient, "cult");
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {" "}
                    Culturas microbiológicas
                  </div>{" "}
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(patient, "cult");
                      }}
                      className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3"
                      title="Adicionar cultura"
                    >
                      +
                    </button>
                  )}
                </div>{" "}
                {(patient.cultures?.length ?? 0) === 0 ? (
                  <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">
                    Nenhuma cultura registrada.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {" "}
                    {patient
                      .cultures!.slice()
                      .reverse()
                      .map((c) => {
                        const r = cultureResultBadge(c);
                        const alerts = detectCultureAlerts(c);
                        const borderCls =
                          r.label === "Positiva"
                            ? "border-2 border-clinical-critical/70"
                            : r.label === "Negativa"
                              ? "border-2 border-clinical-stable/70"
                              : "border-2 border-clinical-attention/70";
                        return (
                          <li
                            key={c.id}
                            className={`ios-inset px-2 py-1.5 text-[11px] ${borderCls}`}
                            title={r.label}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span className="truncate">{c.source}</span>
                              </div>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {" "}
                              {new Date(c.collectedAt).toLocaleDateString("pt-BR")}
                              {c.collectionSite ? ` · ${c.collectionSite}` : ""}
                            </div>{" "}
                            {c.organism && (
                              <div className="mt-0.5 text-[10.5px] italic text-foreground">
                                {c.organism}
                              </div>
                            )}
                            {c.resistanceProfile && c.resistanceProfile !== "pendente" && (
                              <div className="text-[10px] text-muted-foreground">
                                Perfil: {c.resistanceProfile}
                              </div>
                            )}
                            {alerts.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {" "}
                                {alerts.map((a) => (
                                  <span
                                    key={a.code}
                                    className={`rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${
                                      a.severity === "critical"
                                        ? "bg-clinical-critical/15 text-clinical-critical"
                                        : "bg-clinical-attention/15 text-clinical-attention"
                                    }`}
                                  >
                                    {" "}
                                    {a.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {c.antibiogram && c.antibiogram.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[10px] font-semibold text-foreground hover:underline">
                                  Antibiograma ({c.antibiogram.length})
                                </summary>
                                <ul className="mt-1 space-y-0.5 text-[10px]">
                                  {" "}
                                  {c.antibiogram.map((ab, i) => (
                                    <li key={i} className="flex items-center justify-between">
                                      <span className="text-muted-foreground">{ab.drug}</span>
                                      <span
                                        className={`font-mono font-semibold ${
                                          ab.result === "S"
                                            ? "text-clinical-stable"
                                            : ab.result === "I"
                                              ? "text-clinical-attention"
                                              : "text-clinical-critical"
                                        }`}
                                      >
                                        {ab.result}
                                        {ab.mic ? ` · ${ab.mic}` : ""}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
              {/* 4) Imagem — com miniaturas */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {" "}
                    Exames de imagem
                  </div>{" "}
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(patient, "exam");
                      }}
                      className="ios-inset px-1.5 py-0.5 text-[9px] font-semibold text-foreground hover:bg-surface-3"
                      title="Adicionar imagem"
                    >
                      +
                    </button>
                  )}
                </div>{" "}
                {(patient.imaging?.length ?? 0) === 0 ? (
                  <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">
                    Nenhum exame de imagem registrado.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {" "}
                    {patient
                      .imaging!.slice()
                      .reverse()
                      .map((im) => {
                        const pending =
                          im.status === "solicitado" || im.conclusion === "pendente";
                        const borderClass = pending
                          ? "border-2 border-clinical-attention/80 bg-clinical-attention/10"
                          : im.conclusion === "normal"
                            ? "border-2 border-clinical-stable/80 bg-clinical-stable/10"
                            : im.conclusion === "alterado" || im.conclusion === "critico"
                              ? "border-2 border-clinical-critical/80 bg-clinical-critical/10"
                              : "border border-border";
                        return (
                          <li
                            key={im.id}
                            className={`rounded-md px-2 py-1.5 text-[11px] ${borderClass}`}
                            title={
                              pending
                                ? "Resultado pendente"
                                : im.conclusion
                                  ? `Resultado ${im.conclusion}`
                                  : undefined
                            }
                          >
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span>
                                {im.modality} · {im.region}
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {formatDateBR(im.performedAt)}
                            </div>
                            {im.status && (
                              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground">
                                {im.status === "concluido" ? "Concluído" : "Solicitado"}
                              </div>
                            )}{" "}
                            {im.summary && (
                              <details className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Impressão diagnóstica
                                </summary>
                                <div className="mt-1 text-[10.5px] text-muted-foreground">
                                  {im.summary}
                                </div>
                              </details>
                            )}
                            {im.reportedBy && (
                              <div className="mt-0.5 text-[9px] text-muted-foreground">
                                — {im.reportedBy}
                              </div>
                            )}
                            {im.images && im.images.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {" "}
                                {im.images.map((img) => (
                                  <button
                                    key={img.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomImg(img.dataUrl);
                                    }}
                                    className="group relative h-14 w-14 overflow-hidden rounded border border-border bg-surface-2 transition-transform hover:scale-105"
                                    title={img.caption ?? "Ampliar"}
                                  >
                                    <img
                                      src={img.dataUrl}
                                      alt={img.caption ?? "Imagem do exame"}
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
              {/* EEG e hemotransfusão ficam apenas no painel de edição */}
            </div>{" "}
            {/* 6 */}
            <div onClick={colClick("sup")} className="text-[11px] !px-1.5">
              <ColTitle tone={5}>📈 Estado atual</ColTitle> {/* Sinais vitais (linhas) */}
              <div className="mt-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {" "}
                  Sinais vitais{vitalsDateLabel ? ` · ${vitalsDateLabel}` : ""}
                </div>
                <div className="ios-inset px-2 py-2">
                  {" "}
                  {vitalRows.map((r) => {
                    const crit = r.v.level === "grave";
                    const abn =
                      r.v.level === "grave" || r.v.level === "mod" || r.v.level === "leve";
                    const mm = vitalMinMax(r.v);
                    return (
                      <div
                        key={r.label}
                        className={`grid grid-cols-[46px_1fr_auto] items-center gap-x-2 py-[3px] text-[11px] ${abn ? "alert-outline px-1.5" : ""}`}
                        title={abn ? "Sinal vital alterado (último registro)" : undefined}
                      >
                        <span
                          className="f-fixed truncate font-bold uppercase tracking-wider text-muted-foreground"
                          title={r.label}
                        >
                          {r.label}
                        </span>
                        <span
                          className={`flex flex-col leading-tight font-mono font-bold tabular-nums ${VITAL_LEVEL_TXT[r.v.level]}`}
                        >
                          <span title="Valor máximo">{mm.max}</span>
                          {mm.min ? (
                            <span className="opacity-80" title="Valor mínimo">
                              {mm.min}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center justify-end gap-1 text-right">
                          {crit && (
                            <span
                              className="alert-dot"
                              title="Alteração grave"
                              aria-label="Alteração grave"
                            />
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {crcl && (
                    <div className="mt-1 grid grid-cols-[46px_1fr_auto] items-baseline gap-x-2 border-t border-border/50 pt-1 text-[11px]">
                      <span className="f-fixed font-bold uppercase tracking-wider text-muted-foreground">
                        ClCr
                      </span>
                      <span
                        className="font-mono font-bold tabular-nums text-foreground"
                        title={`Cockcroft-Gault · Cr ${crcl.creat} mg/dL · ${crcl.ageYears}a · ${crcl.weightKg}kg`}
                      >
                        {crcl.value}
                      </span>
                      <span className="text-right text-[10px] text-muted-foreground">mL/min</span>
                    </div>
                  )}
                </div>
              </div>{" "}
              {/* Laboratoriais + Gasometria (movidos da coluna 5) */}
              {(() => {
                const isGaso = (code?: string, label?: string) =>
                  /pH|PaO2|PaCO2|HCO3|SatO2|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(
                    code ?? label ?? "",
                  );
                const filled = patient.exams.filter(
                  (e) => String(e.value ?? "").trim() !== "" && String(e.value).trim() !== "—",
                );
                const lab = filled.filter((e) => !isGaso(e.code, e.label));
                const gaso = filled.filter((e) => isGaso(e.code, e.label));
                const renderTable = (rows: typeof patient.exams) => (
                  <table className="w-full text-[11px]">
                    <tbody>
                      {rows.map((e, i) => {
                        const ins = examInsight(e, patient.sex);
                        const b = ins.bucket ? bucketBadge(ins.bucket) : null;
                        const t = trendArrow(ins.movement, ins.trend);
                        const abn = !!ins.bucket && ins.bucket !== "normal";
                        return (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td
                              className="py-1 text-muted-foreground"
                              title={abn ? `Resultado alterado · ${b?.label}` : undefined}
                            >
                              <span className={abn ? "alert-outline inline-block px-1.5" : ""}>
                                {e.label}
                              </span>
                            </td>
                            <td className="py-1 font-mono">
                              <span
                                className={`${abn ? "alert-outline inline-block px-1.5 " : ""}${b?.className ?? "text-foreground"}`}
                              >
                                {e.value} {e.unit}
                              </span>
                            </td>
                            <td
                              className={`py-1 text-right text-[12px] leading-none ${t.className}`}
                              title={t.label}
                              aria-label={t.label}
                            >
                              {t.arrow}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
                return (
                  <>
                    {lab.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {" "}
                          Exames laboratoriais
                        </div>{" "}
                        {renderTable(lab)}
                      </div>
                    )}
                    {gaso.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-clinical-resp">
                          {" "}
                          Gasometria arterial
                        </div>{" "}
                        {renderTable(gaso)}
                        <BloodGasPanel patient={patient} />
                      </div>
                    )}
                  </>
                );
              })()}
              {/* Balanço hídrico — linhas */}
              <div className="mt-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {" "}
                  Balanço hídrico
                </div>{" "}
                {!patient.state.fluidBalance ||
                (!patient.state.fluidBalance.intake?.length &&
                  !patient.state.fluidBalance.output?.length &&
                  !patient.state.fluidBalance.drains?.length) ? (
                  <div className="rounded border border-dashed border-border/60 px-2 py-2 text-center text-[10.5px] text-muted-foreground">
                    {" "}
                    Sem registros de entradas / saídas / drenos.
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="space-y-0.5 ios-inset px-2 py-1.5 text-[11px] font-mono font-semibold">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans font-bold uppercase tracking-wider text-clinical-resp">
                          Entradas
                        </span>
                        <span className="text-foreground">+{fluidBalance.totalIntake} mL</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans font-bold uppercase tracking-wider text-clinical-attention">
                          Saídas
                        </span>
                        <span className="text-foreground">−{fluidBalance.totalOutput} mL</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans font-bold uppercase tracking-wider text-clinical-device">
                          Drenos
                        </span>
                        <span className="text-foreground">−{fluidBalance.totalDrains} mL</span>
                      </div>
                      <div
                        className={`flex items-baseline justify-between gap-2 border-t border-border pt-1 text-[12px] font-bold ${
                          fluidBalance.balance > 500
                            ? "text-clinical-attention"
                            : fluidBalance.balance < -500
                              ? "text-clinical-critical"
                              : "text-clinical-stable"
                        }`}
                      >
                        <span className="font-sans uppercase tracking-wider">BH</span>
                        <span>
                          {" "}
                          {bhRate != null
                            ? `${bhRate >= 0 ? "+" : ""}${bhRate.toFixed(2)} mL/kg/h`
                            : "—"}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {" "}
                            ({fluidBalance.balance >= 0 ? "+" : ""}
                            {fluidBalance.balance} mL/24h)
                          </span>
                        </span>
                      </div>
                    </div>{" "}
                    {(patient.state.fluidBalance?.drains?.length ?? 0) > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[10.5px]">
                        {" "}
                        {patient.state.fluidBalance!.drains!.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between ios-inset px-2 py-0.5"
                          >
                            <span className="truncate">
                              <span className="font-semibold text-foreground">{d.name}</span>{" "}
                              {d.site ? (
                                <span className="text-muted-foreground"> · {d.site}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono text-clinical-device">
                              {d.volumeMl} mL
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>{" "}
            {/* 7 - Plano · Metas por sistema orgânico */}
            <div ref={planColRef} onClick={colClick("plan")} className="!p-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <ColTitle tone={6}>✅ Condutas</ColTitle>
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(patient, "plan");
                    }}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-surface-3"
                  >
                    ✏️ editar no painel
                  </button>
                )}
              </div>
              <ul
                className="list-none space-y-1 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const t = e.target as HTMLElement;
                  if (t.closest("button, a, input, select, textarea, label, [role='button']"))
                    return;
                  if (planInlineEdit) return;
                  if (onUpdate) {
                    setPlanInlineEdit(true);
                  } else if (onEdit) {
                    onEdit(patient, "plan");
                  }
                }}
              >
                {" "}
                {[...patient.conducts]
                  .map((c, i) => ({ c, i }))
                  .sort((a, b) => {
                    const order = [
                      "dieta",
                      "fono",
                      "gi",
                      "neuro",
                      "cardio",
                      "resp",
                      "renal",
                      "infec",
                      "hemato",
                      "skin",
                      "other",
                    ];
                    return (
                      order.indexOf(a.c.system ?? "other") - order.indexOf(b.c.system ?? "other")
                    );
                  })
                  .map(({ c, i }) => {
                    const meta = c.system
                      ? CONDUCT_SYSTEM_META[c.system]
                      : CONDUCT_SYSTEM_META.other;
                    const subs = (c.subItems ?? [])
                      .map((s, si) => ({ s, si }))
                      .filter(({ s }) => planInlineEdit || !s.hidden);
                    return (
                      <li
                        key={i}
                        className={`rounded-md border px-1.5 py-1 text-[11px] ${meta.borderClass}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink">
                            {" "}
                            {meta.label}
                          </span>
                          <span className="ml-auto text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.team}
                          </span>
                        </div>{" "}
                        {planInlineEdit ? (
                          <div className="mt-1 space-y-1">
                            {subs.map(({ s, si }) => (
                              <div key={si} className="flex items-start gap-1">
                                <div className="min-w-0 flex-1">
                                  <AnnotationEditor
                                    value={s.text ?? ""}
                                    onChange={(next) => updateConductSub(i, si, next)}
                                    placeholder="Anotação"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeConductSub(i, si)}
                                  title="Remover anotação"
                                  className="rounded border border-border px-1 text-[10px] text-muted-foreground hover:bg-surface-3"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addConductSub(i)}
                              className="rounded border border-dashed border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-surface-3"
                            >
                              + anotação
                            </button>
                          </div>
                        ) : subs.length ? (
                          <div className="mt-1 space-y-0.5">
                            {" "}
                            {subs.map(({ s: sub, si }) => {
                              const colMeta = sub.color
                                ? ANNOTATION_COLOR_META[sub.color]
                                : ANNOTATION_COLOR_META.default;
                              return (
                                <div key={si} className="text-[10.5px] leading-tight">
                                  <span className="break-words whitespace-pre-wrap">
                                    <span className={colMeta.textClass || "text-foreground"}>
                                      {sub.text ? (
                                        <AnnotationText
                                          text={sub.text}
                                          base={sub.color ?? "default"}
                                          defaultClass=""
                                        />
                                      ) : (
                                        <span className="italic text-muted-foreground">
                                          (anotação vazia)
                                        </span>
                                      )}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] italic text-muted-foreground">
                            Sem condutas registradas.
                          </div>
                        )}
                      </li>
                    );
                  })}
                {patient.conducts.length === 0 && (
                  <li className="rounded border border-dashed border-border/60 px-1.5 py-1.5 text-center text-[10px] text-muted-foreground">
                    {" "}
                    Nenhuma conduta registrada.
                  </li>
                )}
              </ul>

              <div className="mt-2">
                <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Metas
                </div>
                <ul className="space-y-0.5">
                  {" "}
                  {patient.goals.map((g, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${g.met ? "bg-clinical-stable" : "bg-clinical-critical"}`}
                      />
                      <span className={g.met ? "text-foreground" : "text-clinical-critical"}>
                        {g.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Anatomical map embedded — visible immediately upon expansion */}
      {open && (
        <div className="border-t border-border bg-surface/40 px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {" "}
              Mapa anatômico · dispositivos & lesões por pressão
            </div>
            <div className="text-[10px] text-muted-foreground">
              {" "}
              {activeDevices.length} dispositivo(s) · {lppSummary.totalActive} LPP ativa(s)
            </div>
          </div>
          <AnatomicalMap
            devices={patient.devices ?? []}
            patient={patient}
            lpp={patient.lpp ?? []}
            onLPPChange={onUpdate ? (next) => onUpdate({ ...patient, lpp: next }) : undefined}
          />
          <div className="mt-5">
            <ClinicalTrendChart patient={patient} />
          </div>

          <div className="mt-5 flex flex-col gap-2 rounded-md border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Documento para a família
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                Relatório ilustrado em linguagem simples: jornada desde a chegada, motivos da
                internação, o que já foi feito, aparelhos e medicamentos em uso, plano de cuidados e
                glossário.
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
        </div>
      )}
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
      />{" "}
      {/* Pump Monitor Dialog */}
      <Dialog open={pumpOpen} onOpenChange={setPumpOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-clinical-resp" /> Central de bombas · {patient.name}
            </DialogTitle>
          </DialogHeader>
          <PumpMonitor patient={patient} onChange={onUpdate} />
        </DialogContent>
      </Dialog>{" "}
      {/* AI Therapy Suggestions Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-clinical-attention" /> Ajustar terapia · sugestões
              para {patient.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            {" "}
            Sugestões baseadas em parâmetros atuais. <b>Não executam ações</b> — exigem confirmação
            médica.
          </p>
          <ul className="mt-2 space-y-2">
            {" "}
            {suggestions.map((s, i) => {
              const cls =
                s.severity === "critical"
                  ? "border-clinical-critical/40 bg-clinical-critical/5"
                  : s.severity === "attention"
                    ? "border-clinical-attention/40 bg-clinical-attention/5"
                    : "border-border bg-surface";
              return (
                <li key={i} className={`rounded-md border p-3 text-[12px] ${cls}`}>
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span>{s.title}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.rationale}</div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>{" "}
      {/* Anatomical Map Dialog — Devices + Pressure Injuries unificados */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {" "}
              Mapa anatômico · {patient.name}
            </DialogTitle>
          </DialogHeader>
          <AnatomicalMap
            devices={patient.devices ?? []}
            patient={patient}
            lpp={patient.lpp ?? []}
            onLPPChange={onUpdate ? (next) => onUpdate({ ...patient, lpp: next }) : undefined}
          />
        </DialogContent>
      </Dialog>{" "}
      {/* Image lightbox for exam attachments */}
      <Dialog open={!!zoomImg} onOpenChange={(o) => !o && setZoomImg(null)}>
        <DialogContent className="max-h-[95vh] max-w-4xl overflow-hidden p-2">
          <DialogHeader>
            <DialogTitle className="text-[12px]">Imagem do exame</DialogTitle>
          </DialogHeader>{" "}
          {zoomImg && (
            <img
              src={zoomImg}
              alt="Imagem ampliada"
              className="mx-auto max-h-[85vh] w-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>{" "}
      {/* Intubation Journey */}
      {onUpdate && (
        <IntubationJourney
          open={intubOpen}
          onClose={() => setIntubOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* SAPS 3 */}
      {onUpdate && (
        <Saps3Modal
          open={saps3Open}
          onClose={() => setSaps3Open(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* Escala de Fisher */}
      {onUpdate && (
        <FisherModal
          open={fisherOpen}
          onClose={() => setFisherOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* Escala de Hunt-Hess */}
      {onUpdate && (
        <HuntHessModal
          open={huntHessOpen}
          onClose={() => setHuntHessOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* Escala WFNS */}
      {onUpdate && (
        <WfnsModal
          open={wfnsOpen}
          onClose={() => setWfnsOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* ICH Score */}
      {onUpdate && (
        <IchScoreModal
          open={ichOpen}
          onClose={() => setIchOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* NIHSS */}
      {onUpdate && (
        <NihssModal
          open={nihssOpen}
          onClose={() => setNihssOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* VASOGRADE */}
      {onUpdate && (
        <VasogradeModal
          open={vasoOpen}
          onClose={() => setVasoOpen(false)}
          patient={patient}
          onSave={onUpdate}
        />
      )}
      {/* SOFA */}
      <SofaCalculatorModal
        open={sofaOpen}
        onClose={() => setSofaOpen(false)}
        patient={patient}
        onSave={onUpdate}
      />
      {/* História clínica — narrativa da evolução no hospital */}
      <Dialog
        open={historyOpen}
        onOpenChange={(o) => {
          setHistoryOpen(o);
          if (o) setHistoryDraft(patient.clinicalHistory ?? "");
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              📖 História clínica — {patient.bed} · {patient.name}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={historyDraft}
            onChange={(e) => setHistoryDraft(e.target.value)}
            rows={16}
            placeholder="Narrativa da evolução do paciente no hospital…"
            className="w-full rounded-md border border-strong bg-white px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus:border-primary"
            disabled={!onUpdate}
          />
          {onUpdate && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-md border border-strong px-3 py-1.5 text-[12px] font-semibold hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({ ...patient, clinicalHistory: historyDraft });
                  setHistoryOpen(false);
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Salvar história clínica
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Discharge readiness check */}
      {onUpdate && (
        <DischargeCheckModal
          open={dischargeOpen}
          onClose={() => setDischargeOpen(false)}
          patient={patient}
          onSave={onUpdate}
          onDischarge={onDischarge}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="f-fixed text-[11px] uppercase tracking-wider">{k}</dt>
      <dd className="f-var text-right text-[12px] text-foreground">{v}</dd>
    </div>
  );
}

export { Activity };
// silence unused import lint
void categoryLabel;
void categoryIcon;
void STAGE_META;
