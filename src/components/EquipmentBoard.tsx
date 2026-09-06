// Painel de aparelhos em curso — monitores "reais" ao redor do mapa anatômico.
// Cada card só aparece quando a terapia/dispositivo está efetivamente em uso,
// e exibe as leituras registradas para aquele equipamento.

import {
  Activity, Brain, Droplet, FlaskConical, Heart, Syringe, Utensils, Waves, Wind,
} from "lucide-react";
import type { ReactNode } from "react";
import type { InvasiveDevice, Patient, VitalReading } from "@/data/patients";

interface Props {
  patient?: Patient;
  devices: InvasiveDevice[];
  /** Lado do corpo em que o card é ancorado (apenas organiza a coluna). */
  side: "left" | "right";
}

type Readout = { label: string; value: string; unit?: string; alert?: boolean };

function latest(readings?: VitalReading[]): number | undefined {
  if (!readings?.length) return undefined;
  const sorted = [...readings]
    .filter((r) => typeof r.value === "number")
    .sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
  return sorted.length ? sorted[sorted.length - 1]!.value : undefined;
}

function fmt(v: number | undefined, digits = 0): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function examValue(patient: Patient | undefined, codes: string[]): { value: string; unit?: string; critical?: boolean } | undefined {
  const rows = patient?.exams ?? [];
  for (const code of codes) {
    const row = rows.find(
      (r) => r.code?.toLowerCase() === code.toLowerCase() || r.label.toLowerCase() === code.toLowerCase(),
    );
    if (row) return { value: row.value, unit: row.unit, critical: row.critical };
  }
  return undefined;
}

/** Converte "7,32" / "12.4 mg" em número. */
function num(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function outOf(v: number | undefined, min: number, max: number): boolean {
  return typeof v === "number" && (v < min || v > max);
}

function has(devices: InvasiveDevice[], codes: string[]): InvasiveDevice | undefined {
  return devices.find((d) => !d.removedAt && codes.includes(d.typeCode));
}

// ============================================================================

function MonitorCard({
  title, icon, tone, readouts, footer,
}: {
  title: string;
  icon: ReactNode;
  tone: string;
  readouts: Readout[];
  footer?: string;
}) {
  return (
    <div className="anat-map-box">
      <div className={`flex items-center gap-1.5 border-b border-border/40 px-2 py-1 ${tone}`}>
        <span className="text-sm leading-none" aria-hidden="true">{icon}</span>
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em]">{title}</span>
        <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-clinical-stable" />
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2 py-1.5">
        {readouts.map((r) => (
          <div key={r.label} className="flex flex-col leading-tight">
            <span className="f-fixed text-[8.5px] uppercase">{r.label}</span>
            <span className={`f-var text-[12px] ${r.alert ? "alert-value" : "text-foreground"}`} title={r.alert ? "Valor alterado" : undefined}>
              {r.value}
              {r.unit ? <span className="ml-0.5 text-[8px] font-semibold opacity-70">{r.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <div className="border-t border-border/40 px-2 py-1 text-[9px] text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}

// ============================================================================

export function EquipmentBoard({ patient, devices, side }: Props) {
  const st = patient?.state;
  const vs = st?.vitalSeries;
  const active = devices.filter((d) => !d.removedAt);

  const cards: {
    key: string; title: string; icon: ReactNode; tone: string;
    readouts: Readout[]; footer?: string; side: "left" | "right";
  }[] = [];

  // ── Monitor multiparamétrico ───────────────────────────────────────────
  if (st) {
    const fc = latest(vs?.fc) ?? st.fcMax;
    const pas = latest(vs?.pas) ?? st.pas;
    const pad = latest(vs?.pad) ?? st.pad;
    const pam = latest(vs?.pam) ?? st.pam;
    const spo2 = latest(vs?.spo2) ?? st.spo2;
    const temp = latest(vs?.temp) ?? st.temp;
    const fr = latest(vs?.fr) ?? st.fr;
    cards.push({
      key: "monitor", title: "Monitor multiparamétrico", icon: <Activity className="h-4 w-4" />,
      tone: "bg-clinical-resp/20 text-ink", side: "left",
      readouts: [
        { label: "FC", value: fmt(fc), unit: "bpm", alert: typeof fc === "number" && (fc > 120 || fc < 50) },
        { label: "PA", value: pas && pad ? `${fmt(pas)}/${fmt(pad)}` : "—", unit: "mmHg", alert: outOf(pas, 90, 160) || outOf(pad, 50, 100) },
        { label: "PAM", value: fmt(pam), unit: "mmHg", alert: typeof pam === "number" && pam < 65 },
        { label: "SpO₂", value: fmt(spo2), unit: "%", alert: typeof spo2 === "number" && spo2 < 92 },
        { label: "Temp", value: fmt(temp, 1), unit: "°C", alert: typeof temp === "number" && temp >= 37.8 },
        { label: "FR", value: fmt(fr), unit: "ipm", alert: typeof fr === "number" && fr > 24 },
      ],
    });
  }

  // ── Ventilação mecânica ────────────────────────────────────────────────
  const airway = has(active, ["VMI", "TOT", "TNT", "TQT"]);
  const noninv = has(active, ["CPAP", "BIPAP"]);
  const o2 = has(active, ["O2_NAS", "VENTURI", "MNRR"]);
  if (airway || noninv || o2) {
    cards.push({
      key: "vent", title: airway ? "Ventilador mecânico" : noninv ? "Ventilação não invasiva" : "Oxigenoterapia",
      icon: <Wind className="h-4 w-4" />, tone: "bg-clinical-resp/20 text-ink", side: "left",
      readouts: [
        { label: "Modo", value: st?.vent || (airway?.typeCode ?? noninv?.typeCode ?? o2?.typeCode ?? "—") },
        { label: "FiO₂", value: fmt(st?.fio2), unit: "%" },
        { label: "Via aérea", value: airway?.typeCode ?? noninv?.typeCode ?? o2?.typeCode ?? "—" },
        { label: "SpO₂/FiO₂", value: st?.spo2 && st?.fio2 ? fmt((st.spo2 / st.fio2) * 100) : "—" },
      ],
      footer: airway?.site ? `Sítio: ${airway.site}` : undefined,
    });
  }

  // ── Bombas de infusão ──────────────────────────────────────────────────
  const pumps = (patient?.medications ?? []).filter(
    (m) => m.active !== false && (m.pump || m.class === "pump" || typeof m.mlPerHour === "number"),
  );
  if (pumps.length) {
    cards.push({
      key: "pumps", title: `Bombas de infusão (${pumps.length})`, icon: <Syringe className="h-4 w-4" />,
      tone: "bg-clinical-device/20 text-ink", side: "right",
      readouts: pumps.slice(0, 6).map((m) => ({
        label: m.name,
        value: typeof m.mlPerHour === "number" ? m.mlPerHour.toFixed(1) : m.dose || "—",
        unit: typeof m.mlPerHour === "number" ? "mL/h" : undefined,
      })),
      footer: pumps.length > 6 ? `+${pumps.length - 6} infusões em curso` : undefined,
    });
  }

  // ── Monitor hemodinâmico invasivo ──────────────────────────────────────
  const pai = has(active, ["PAI_RAD", "PAI_FEM", "PAI_BRA", "PAI_PED"]);
  const swan = has(active, ["SWAN"]);
  if (pai || swan) {
    cards.push({
      key: "hemo", title: "Monitor hemodinâmico", icon: <Heart className="h-4 w-4" />,
      tone: "bg-clinical-critical/15 text-ink", side: "right",
      readouts: [
        { label: "PAI", value: pai ? (pai.site ?? pai.typeCode) : "—" },
        { label: "PAM", value: fmt(latest(vs?.pam) ?? st?.pam), unit: "mmHg", alert: outOf(latest(vs?.pam) ?? st?.pam, 65, 110) },
        { label: "DVA", value: st?.dva ?? "—", alert: !!st?.dva },
        { label: "Cateter", value: swan ? "Swan-Ganz" : "—" },
      ],
    });
  }

  // ── Gasometria arterial ────────────────────────────────────────────────
  const ph = examValue(patient, ["pH", "PH"]);
  const paco2 = examValue(patient, ["PaCO2", "pCO2"]);
  const pao2 = examValue(patient, ["PaO2", "pO2"]);
  const hco3 = examValue(patient, ["HCO3", "Bicarbonato"]);
  const lac = examValue(patient, ["Lactato", "LAC"]);
  if (ph || paco2 || pao2 || hco3 || lac) {
    cards.push({
      key: "abg", title: "Gasometria arterial", icon: <FlaskConical className="h-4 w-4" />,
      tone: "bg-clinical-nutri/20 text-ink", side: "right",
      readouts: [
        { label: "pH", value: ph?.value ?? "—", alert: ph?.critical || outOf(num(ph?.value), 7.35, 7.45) },
        { label: "PaCO₂", value: paco2?.value ?? "—", unit: paco2?.unit, alert: paco2?.critical || outOf(num(paco2?.value), 35, 45) },
        { label: "PaO₂", value: pao2?.value ?? "—", unit: pao2?.unit, alert: pao2?.critical || outOf(num(pao2?.value), 60, 120) },
        { label: "HCO₃⁻", value: hco3?.value ?? "—", unit: hco3?.unit, alert: hco3?.critical || outOf(num(hco3?.value), 22, 26) },
        { label: "Lactato", value: lac?.value ?? "—", unit: lac?.unit, alert: lac?.critical || outOf(num(lac?.value), 0, 2) },
        { label: "FiO₂", value: fmt(st?.fio2), unit: "%" },
      ],
    });
  }

  // ── Diurese / balanço ──────────────────────────────────────────────────
  const urinary = has(active, ["SVD", "SVA", "CISTO", "NEFRO"]);
  if (urinary || typeof st?.diurese === "number") {
    const bh = latest(vs?.bh) ?? st?.balancoHidrico;
    cards.push({
      key: "diurese", title: urinary ? `Débito urinário · ${urinary.typeCode}` : "Débito urinário",
      icon: <Droplet className="h-4 w-4" />, tone: "bg-clinical-nutri/20 text-ink", side: "left",
      readouts: [
        { label: "Diurese", value: fmt(st?.diurese), unit: "mL/kg/h" },
        { label: "Horária", value: fmt(st?.diureseHoraria), unit: "mL/h" },
        { label: "24h", value: fmt(st?.diurese24), unit: "mL" },
        { label: "Balanço", value: fmt(bh), unit: "mL", alert: typeof bh === "number" && bh > 1500 },
      ],
    });
  }

  // ── Terapia renal substitutiva ─────────────────────────────────────────
  const hd = has(active, ["HD_CAT"]);
  if (hd) {
    cards.push({
      key: "trs", title: "Terapia renal substitutiva", icon: <Waves className="h-4 w-4" />,
      tone: "bg-clinical-neuro/15 text-ink", side: "right",
      readouts: [
        { label: "Acesso", value: hd.site ?? "Cateter HD" },
        { label: "Ureia", value: examValue(patient, ["Ureia", "UR"])?.value ?? "—" },
        { label: "Creatinina", value: examValue(patient, ["Creatinina", "CR"])?.value ?? "—" },
        { label: "K⁺", value: examValue(patient, ["Potássio", "K"])?.value ?? "—" },
      ],
    });
  }

  // ── Nutrição enteral ───────────────────────────────────────────────────
  const enteral = has(active, ["SNE", "SNG", "GTT", "JTT"]);
  if (enteral) {
    cards.push({
      key: "nutri", title: `Nutrição enteral · ${enteral.typeCode}`, icon: <Utensils className="h-4 w-4" />,
      tone: "bg-clinical-attention/20 text-ink", side: "left",
      readouts: [
        { label: "Dieta", value: st?.dieta || "—" },
        { label: "Resíduo", value: fmt(st?.residuoGastrico), unit: "mL" },
        { label: "Sítio", value: enteral.site ?? "—" },
        { label: "Bristol", value: fmt(latest(vs?.bristol) ?? st?.bristol) },
      ],
    });
  }

  // ── Neuromonitorização ─────────────────────────────────────────────────
  const neuro = has(active, ["PICmon", "DVE", "PBTO2"]);
  if (neuro || typeof st?.glasgow === "number") {
    cards.push({
      key: "neuro", title: neuro ? `Neuromonitorização · ${neuro.typeCode}` : "Avaliação neurológica",
      icon: <Brain className="h-4 w-4" />, tone: "bg-clinical-neuro/15 text-ink", side: "right",
      readouts: [
        { label: "Glasgow", value: fmt(st?.glasgow), alert: typeof st?.glasgow === "number" && st.glasgow < 12 },
        { label: "RASS", value: fmt(st?.rass), alert: typeof st?.rass === "number" && (st.rass <= -4 || st.rass >= 2) },
        { label: "Dispositivo", value: neuro?.typeCode ?? "—" },
        { label: "Sítio", value: neuro?.site ?? "—" },
      ],
    });
  }

  // ── Hemotransfusão ─────────────────────────────────────────────────────
  const tx = (patient?.hemotransfusions ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (tx) {
    cards.push({
      key: "tx", title: "Hemotransfusão", icon: "🩸",
      tone: "bg-clinical-critical/15 text-ink", side: "left",
      readouts: [
        { label: "Componente", value: tx.component },
        { label: "Volume", value: tx.volume ?? "—" },
        { label: "Data", value: new Date(tx.date).toLocaleDateString("pt-BR") },
        { label: "Hb", value: examValue(patient, ["Hb", "Hemoglobina"])?.value ?? "—" },
      ],
      footer: tx.note,
    });
  }

  const list = cards.filter((c) => c.side === side);
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {list.map((c) => (
        <MonitorCard key={c.key} title={c.title} icon={c.icon} tone={c.tone} readouts={c.readouts} footer={c.footer} />
      ))}
    </div>
  );
}
