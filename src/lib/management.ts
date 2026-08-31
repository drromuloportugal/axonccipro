// Camada de cálculo do dashboard executivo de gestão da UTI.
// Funções puras: ocupação, risco, alertas, indicadores de qualidade e séries
// históricas determinísticas (demonstração) derivadas dos pacientes ativos.

import type { Patient } from "@/data/patients";

export type PeriodKey = "24h" | "7d" | "30d";

export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "24h", label: "Últimas 24 horas", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
];

export type RiskLevel = "high" | "moderate" | "low";

export const RISK_META: Record<RiskLevel, { label: string; token: string }> = {
  high: { label: "Alto", token: "var(--clinical-critical)" },
  moderate: { label: "Moderado", token: "var(--clinical-attention)" },
  low: { label: "Baixo", token: "var(--clinical-stable)" },
};

/** Capacidade padrão da unidade (usada quando não há configuração). */
export const DEFAULT_TOTAL_BEDS = 12;

// ---------------------------------------------------------------------------
// Detectores clínicos
// ---------------------------------------------------------------------------

export function onMechanicalVentilation(p: Patient): boolean {
  const vent = (p.state?.vent ?? "").toLowerCase();
  if (/vm|pcv|psv|simv|a\/c|invasiv/.test(vent)) return true;
  return (p.devices ?? []).some(
    (d) => !d.removedAt && (d.typeCode === "TOT" || d.typeCode === "TQT" || d.category === "airway"),
  );
}

export function onVasoactive(p: Patient): boolean {
  const dva = p.state?.dva;
  if (dva && dva.trim() && !/^n(ã|a)o$|^sem|^-$/i.test(dva.trim())) return true;
  const vaso = /nora|noradren|adrenalina|dobuta|dopamina|vasopressina|terlipressina|milrinona/i;
  return (p.medications ?? []).some(
    (m) => m.active !== false && m.pump?.status !== "stopped" && vaso.test(m.pump?.pumpDrugName ?? m.name ?? ""),
  );
}

export function lengthOfStay(p: Patient): number {
  return Math.max(0, Math.round(p.daysICU ?? 0));
}

export function prolongedStay(p: Patient): boolean {
  return lengthOfStay(p) >= 14;
}

export function awaitingTransfer(p: Patient): boolean {
  return Boolean(p.dischargeCheck?.expectedTransfer);
}

export function dischargeForecast(p: Patient): boolean {
  return Boolean(p.dischargeCheck?.startedAt) && p.severity === "stable";
}

export function riskOf(p: Patient): RiskLevel {
  if (p.severity === "critical") return "high";
  if (onVasoactive(p) && onMechanicalVentilation(p)) return "high";
  if (p.severity === "attention" || onMechanicalVentilation(p) || onVasoactive(p)) return "moderate";
  return "low";
}

export interface PriorityPatient {
  id: string;
  bed: string;
  name: string;
  reason: string;
  risk: RiskLevel;
  los: number;
  situation: string[];
}

export function priorityList(patients: Patient[]): PriorityPatient[] {
  const order: Record<RiskLevel, number> = { high: 0, moderate: 1, low: 2 };
  return patients
    .map((p) => {
      const situation: string[] = [];
      if (onMechanicalVentilation(p)) situation.push("Ventilação mecânica");
      if (onVasoactive(p)) situation.push("Droga vasoativa");
      if (awaitingTransfer(p)) situation.push("Aguarda transferência");
      if (dischargeForecast(p)) situation.push("Previsão de alta");
      if (prolongedStay(p)) situation.push("Permanência prolongada");

      let reason = "Acompanhamento de rotina";
      if (p.severity === "critical") reason = "Paciente crítico — reavaliação prioritária";
      else if (onVasoactive(p)) reason = "Instabilidade hemodinâmica em vasoativo";
      else if (onMechanicalVentilation(p)) reason = "Suporte ventilatório invasivo";
      else if (prolongedStay(p)) reason = "Permanência acima de 14 dias";
      else if (awaitingTransfer(p)) reason = "Transferência pendente";

      return { id: p.id, bed: p.bed, name: p.name, reason, risk: riskOf(p), los: lengthOfStay(p), situation };
    })
    .sort((a, b) => order[a.risk] - order[b.risk] || b.los - a.los);
}

// ---------------------------------------------------------------------------
// Leitos
// ---------------------------------------------------------------------------

export interface BedOverview {
  total: number;
  occupied: number;
  available: number;
  rate: number; // 0-100
  status: "ok" | "warn" | "critical";
}

export function bedOverview(patients: Patient[], total = DEFAULT_TOTAL_BEDS): BedOverview {
  const occupied = patients.length;
  const effectiveTotal = Math.max(total, occupied);
  const available = effectiveTotal - occupied;
  const rate = effectiveTotal ? (occupied / effectiveTotal) * 100 : 0;
  const status = rate >= 90 || available === 0 ? "critical" : rate >= 80 ? "warn" : "ok";
  return { total: effectiveTotal, occupied, available, rate, status };
}

export function statusColor(status: "ok" | "warn" | "critical"): string {
  return status === "critical"
    ? "var(--clinical-critical)"
    : status === "warn"
      ? "var(--clinical-attention)"
      : "var(--clinical-stable)";
}

// ---------------------------------------------------------------------------
// Séries históricas determinísticas (dados demonstrativos)
// ---------------------------------------------------------------------------

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FlowPoint {
  t: number;
  label: string;
  admissions: number;
  discharges: number;
  deaths: number;
  occupancy: number;
  vent: number;
  dva: number;
  los: number;
}

/**
 * Gera a série do período ancorada no estado atual da unidade.
 * O último ponto reflete os números reais; os anteriores são demonstrativos
 * estáveis (mesma semente ⇒ mesma série).
 */
export function buildFlowSeries(
  patients: Patient[],
  period: PeriodKey,
  now: Date,
  total = DEFAULT_TOTAL_BEDS,
): FlowPoint[] {
  const days = PERIODS.find((p) => p.key === period)?.days ?? 7;
  const buckets = period === "24h" ? 12 : days;
  const stepMs = period === "24h" ? 2 * 3600_000 : 86_400_000;

  const beds = bedOverview(patients, total);
  const ventNow = patients.filter(onMechanicalVentilation).length;
  const dvaNow = patients.filter(onVasoactive).length;
  const losNow = patients.length
    ? patients.reduce((s, p) => s + lengthOfStay(p), 0) / patients.length
    : 0;

  const rand = mulberry(1013 + buckets * 31 + patients.length * 7);
  const out: FlowPoint[] = [];

  for (let i = buckets - 1; i >= 0; i--) {
    const t = now.getTime() - i * stepMs;
    const isLast = i === 0;
    const jitter = (amp: number) => (rand() - 0.5) * 2 * amp;
    const occupancy = isLast
      ? Math.round(beds.rate)
      : Math.min(100, Math.max(45, Math.round(beds.rate - 6 + jitter(9))));
    out.push({
      t,
      label:
        period === "24h"
          ? new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      admissions: period === "24h" ? (rand() < 0.35 ? 1 : 0) : Math.round(1 + rand() * 3),
      discharges: period === "24h" ? (rand() < 0.3 ? 1 : 0) : Math.round(1 + rand() * 3),
      deaths: rand() < (period === "24h" ? 0.06 : 0.18) ? 1 : 0,
      occupancy,
      vent: isLast ? ventNow : Math.max(0, ventNow + Math.round(jitter(2))),
      dva: isLast ? dvaNow : Math.max(0, dvaNow + Math.round(jitter(2))),
      los: isLast ? Number(losNow.toFixed(1)) : Number(Math.max(2, losNow + jitter(2.5)).toFixed(1)),
    });
  }
  return out;
}

export interface FlowSummary {
  admissions: number;
  discharges: number;
  deaths: number;
  forecastDischarge: number;
  awaitingTransfer: number;
}

export function flowSummary(series: FlowPoint[], patients: Patient[]): FlowSummary {
  return {
    admissions: series.reduce((s, p) => s + p.admissions, 0),
    discharges: series.reduce((s, p) => s + p.discharges, 0),
    deaths: series.reduce((s, p) => s + p.deaths, 0),
    forecastDischarge: patients.filter(dischargeForecast).length,
    awaitingTransfer: patients.filter(awaitingTransfer).length,
  };
}

// ---------------------------------------------------------------------------
// Indicadores de qualidade
// ---------------------------------------------------------------------------

export interface QualityIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  /** true = valores menores são melhores */
  lowerIsBetter: boolean;
  previous: number;
  spark: number[];
}

export function qualityIndicators(
  patients: Patient[],
  series: FlowPoint[],
  total = DEFAULT_TOTAL_BEDS,
): QualityIndicator[] {
  const beds = bedOverview(patients, total);
  const rand = mulberry(7919 + patients.length * 13 + series.length);
  const spark = (base: number, amp: number) =>
    Array.from({ length: 8 }, (_, i) => Number((base + (rand() - 0.5) * amp * 2 + (i - 4) * amp * 0.08).toFixed(1)));

  const losAvg = patients.length
    ? patients.reduce((s, p) => s + lengthOfStay(p), 0) / patients.length
    : 0;
  const deaths = series.reduce((s, p) => s + p.deaths, 0);
  const discharges = Math.max(1, series.reduce((s, p) => s + p.discharges, 0));
  const mortality = (deaths / (deaths + discharges)) * 100;

  return [
    { key: "occ", label: "Taxa de ocupação", value: Number(beds.rate.toFixed(1)), unit: "%", target: 85, lowerIsBetter: true, previous: Number((beds.rate - 4.2).toFixed(1)), spark: spark(beds.rate, 6) },
    { key: "los", label: "Média de permanência", value: Number(losAvg.toFixed(1)), unit: "dias", target: 7, lowerIsBetter: true, previous: Number((losAvg + 0.8).toFixed(1)), spark: spark(losAvg, 2) },
    { key: "mort", label: "Taxa de mortalidade", value: Number(mortality.toFixed(1)), unit: "%", target: 12, lowerIsBetter: true, previous: Number((mortality + 1.6).toFixed(1)), spark: spark(mortality, 4) },
    { key: "readm", label: "Taxa de reinternação", value: 6.4, unit: "%", target: 8, lowerIsBetter: true, previous: 7.9, spark: spark(6.4, 2) },
    { key: "iras", label: "Infecção relacionada à assistência", value: 4.1, unit: "/1000 dias", target: 3.5, lowerIsBetter: true, previous: 3.4, spark: spark(4.1, 1.2) },
    { key: "transf", label: "Tempo médio para transferência", value: 18.6, unit: "horas", target: 12, lowerIsBetter: true, previous: 21.4, spark: spark(18.6, 5) },
    { key: "plan", label: "Altas planejadas", value: 78, unit: "%", target: 85, lowerIsBetter: false, previous: 72, spark: spark(78, 7) },
  ];
}

export function indicatorTrend(ind: QualityIndicator): "up" | "down" | "flat" {
  const delta = ind.value - ind.previous;
  if (Math.abs(delta) < 0.05) return "flat";
  return delta > 0 ? "up" : "down";
}

export function indicatorImproving(ind: QualityIndicator): boolean {
  const delta = ind.value - ind.previous;
  return ind.lowerIsBetter ? delta < 0 : delta > 0;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export type AlertLevel = "critical" | "warn" | "info";

export interface ManagementAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  patientId?: string;
}

export function buildAlerts(
  patients: Patient[],
  series: FlowPoint[],
  total = DEFAULT_TOTAL_BEDS,
): ManagementAlert[] {
  const beds = bedOverview(patients, total);
  const out: ManagementAlert[] = [];

  if (beds.available === 0) {
    out.push({ id: "no-beds", level: "critical", title: "Sem leitos disponíveis", detail: "Unidade com capacidade esgotada — avaliar remanejamento e priorização de altas." });
  } else if (beds.rate > 90) {
    out.push({ id: "occ-90", level: "critical", title: `Ocupação em ${beds.rate.toFixed(0)}%`, detail: `Apenas ${beds.available} leito(s) livre(s). Antecipar altas planejadas.` });
  } else if (beds.rate >= 80) {
    out.push({ id: "occ-80", level: "warn", title: `Ocupação em ${beds.rate.toFixed(0)}%`, detail: "Faixa de atenção — monitorar fluxo de admissões." });
  }

  for (const p of patients) {
    if (prolongedStay(p)) {
      out.push({ id: `los-${p.id}`, level: "warn", title: `Permanência prolongada — leito ${p.bed}`, detail: `${lengthOfStay(p)} dias de internação em UTI. Revisar plano terapêutico e critérios de alta.`, patientId: p.id });
    }
    if (awaitingTransfer(p)) {
      out.push({ id: `tr-${p.id}`, level: "warn", title: `Transferência pendente — leito ${p.bed}`, detail: "Aguardando vaga há mais de 24 horas. Acionar regulação.", patientId: p.id });
    }
    if (p.severity === "critical") {
      out.push({ id: `crit-${p.id}`, level: "critical", title: `Paciente crítico — leito ${p.bed}`, detail: "Reavaliação médica prioritária no plantão atual.", patientId: p.id });
    }
  }

  const deaths = series.reduce((s, p) => s + p.deaths, 0);
  if (deaths >= 2) {
    out.push({ id: "deaths", level: "warn", title: `${deaths} óbitos no período`, detail: "Acima da média histórica — revisar indicadores assistenciais em reunião clínica." });
  }

  out.push({ id: "res-vm", level: "info", title: "Recurso crítico indisponível", detail: "1 ventilador mecânico em manutenção preventiva — capacidade de suporte reduzida." });

  const rank: Record<AlertLevel, number> = { critical: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function alertColor(level: AlertLevel): string {
  return level === "critical"
    ? "var(--clinical-critical)"
    : level === "warn"
      ? "var(--clinical-attention)"
      : "var(--clinical-neutral)";
}
