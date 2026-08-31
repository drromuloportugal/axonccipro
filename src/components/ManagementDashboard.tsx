// Dashboard executivo de gestão da UTI — visão única de lotação, fluxo,
// prioridades clínicas, alertas, indicadores de qualidade e tendências.

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  X, RefreshCw, BedDouble, TrendingUp, TrendingDown, Minus as MinusIcon,
  AlertTriangle, AlertOctagon, Info, Check, Activity, Droplets, Clock, ArrowRight,
} from "lucide-react";
import type { Patient } from "@/data/patients";
import {
  PERIODS, type PeriodKey, bedOverview, statusColor, buildFlowSeries, flowSummary,
  priorityList, qualityIndicators, indicatorTrend, indicatorImproving, buildAlerts,
  alertColor, onMechanicalVentilation, onVasoactive, prolongedStay, riskOf, RISK_META,
  DEFAULT_TOTAL_BEDS, type ManagementAlert,
} from "@/lib/management";

interface Props {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  onSelectPatient?: (patientId: string) => void;
}

const CARD = "rounded-lg border border-border bg-card p-4 shadow-sm";
const TITLE = "mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground";

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20" role="img" aria-label={`Taxa de ocupação ${pct.toFixed(0)} por cento`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 40 40)"
      />
      <text x="40" y="44" textAnchor="middle" className="fill-foreground" style={{ fontSize: 15, fontWeight: 700 }}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${28 - ((p - min) / span) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({
  label, value, hint, color, icon,
}: { label: string; value: string | number; hint?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-3xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ManagementDashboard({ open, onClose, patients, onSelectPatient }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [unit, setUnit] = useState<string>("all");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setRefreshedAt(new Date());
  }, [open]);

  const units = useMemo(
    () => Array.from(new Set(patients.map((p) => p.team).filter(Boolean))).sort(),
    [patients],
  );

  const scoped = useMemo(
    () => (unit === "all" ? patients : patients.filter((p) => p.team === unit)),
    [patients, unit],
  );

  const now = refreshedAt ?? new Date(0);
  const totalBeds = Math.max(DEFAULT_TOTAL_BEDS, scoped.length);
  const beds = useMemo(() => bedOverview(scoped, totalBeds), [scoped, totalBeds]);
  const series = useMemo(() => buildFlowSeries(scoped, period, now, totalBeds), [scoped, period, now, totalBeds]);
  const flow = useMemo(() => flowSummary(series, scoped), [series, scoped]);
  const priority = useMemo(() => priorityList(scoped), [scoped]);
  const quality = useMemo(() => qualityIndicators(scoped, series, totalBeds), [scoped, series, totalBeds]);
  const alerts = useMemo(() => buildAlerts(scoped, series, totalBeds), [scoped, series, totalBeds]);

  if (!open) return null;

  const occColor = statusColor(beds.status);
  const ventCount = scoped.filter(onMechanicalVentilation).length;
  const dvaCount = scoped.filter(onVasoactive).length;
  const highRisk = scoped.filter((p) => riskOf(p) === "high").length;
  const longStay = scoped.filter(prolongedStay).length;

  const toggleSeen = (a: ManagementAlert) =>
    setSeen((prev) => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
      return next;
    });

  const chartAxis = { tick: { fontSize: 10 }, stroke: "var(--border)" } as const;

  return (
    <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-5 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Dashboard da UTI</h1>
            <p className="text-[11px] text-muted-foreground">
              Última atualização:{" "}
              {refreshedAt ? refreshedAt.toLocaleString("pt-BR") : "—"}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    period === p.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-surface-3"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {units.length > 1 && (
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                aria-label="Filtrar por unidade"
                className="rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-foreground"
              >
                <option value="all">Todas as unidades</option>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setRefreshedAt(new Date())}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-3"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar dashboard"
              className="rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-5 py-5">
        {/* Alertas */}
        <section>
          <h2 className={TITLE}>Alertas importantes</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((a) => {
              const color = alertColor(a.level);
              const isSeen = seen.has(a.id);
              const Icon = a.level === "critical" ? AlertOctagon : a.level === "warn" ? AlertTriangle : Info;
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-2 rounded-lg border border-border bg-card p-3 shadow-sm ${isSeen ? "opacity-55" : ""}`}
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-foreground">{a.title}</span>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: color }}>
                        {a.level === "critical" ? "Crítico" : a.level === "warn" ? "Atenção" : "Informativo"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{a.detail}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSeen(a)}
                        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-surface-3"
                      >
                        <Check className="h-3 w-3" /> {isSeen ? "Visualizado" : "Marcar como visto"}
                      </button>
                      {a.patientId && onSelectPatient && (
                        <button
                          type="button"
                          onClick={() => { onSelectPatient(a.patientId!); onClose(); }}
                          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-surface-3"
                        >
                          Ver contexto <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Visão geral de leitos */}
        <section>
          <h2 className={TITLE}>Visão geral de leitos</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total de leitos" value={beds.total} icon={<BedDouble className="h-3.5 w-3.5" />} />
            <Metric label="Leitos ocupados" value={beds.occupied} hint={`${beds.total - beds.occupied} livre(s)`} />
            <Metric
              label="Leitos disponíveis"
              value={beds.available}
              color={beds.available === 0 ? "var(--clinical-critical)" : undefined}
              hint={beds.available === 0 ? "Capacidade esgotada" : "Prontos para admissão"}
            />
            <div className={CARD}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Taxa de ocupação</div>
              <div className="mt-2 flex items-center gap-3">
                <Gauge value={beds.rate} color={occColor} />
                <div>
                  <div className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: occColor }}>
                    {beds.status === "critical" ? "Crítica" : beds.status === "warn" ? "Atenção" : "Confortável"}
                  </div>
                  <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, beds.rate)}%`, background: occColor }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Meta operacional: até 85%</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fluxo de pacientes */}
        <section>
          <h2 className={TITLE}>Fluxo de pacientes · {PERIODS.find((p) => p.key === period)?.label}</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-1">
              <Metric label="Admissões" value={flow.admissions} />
              <Metric label="Altas" value={flow.discharges} />
              <Metric label="Óbitos" value={flow.deaths} color={flow.deaths > 1 ? "var(--clinical-critical)" : undefined} />
              <Metric label="Previsão de alta" value={flow.forecastDischarge} />
              <Metric label="Aguardando transferência" value={flow.awaitingTransfer} icon={<Clock className="h-3.5 w-3.5" />} />
            </div>
            <div className={`${CARD} lg:col-span-2`}>
              <div className={TITLE}>Admissões, altas e ocupação</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" {...chartAxis} />
                    <YAxis yAxisId="l" width={32} {...chartAxis} />
                    <YAxis yAxisId="r" orientation="right" width={38} unit="%" {...chartAxis} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="l" dataKey="admissions" name="Admissões" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                    <Bar yAxisId="l" dataKey="discharges" name="Altas" fill="var(--clinical-stable)" radius={[2, 2, 0, 0]} />
                    <Line yAxisId="r" type="monotone" dataKey="occupancy" name="Ocupação (%)" stroke="var(--clinical-attention)" strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Situação clínica e prioritários */}
        <section>
          <h2 className={TITLE}>Situação clínica</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Ventilação mecânica" value={ventCount} icon={<Activity className="h-3.5 w-3.5" />} hint={`${scoped.length ? Math.round((ventCount / scoped.length) * 100) : 0}% dos internados`} />
            <Metric label="Drogas vasoativas" value={dvaCount} icon={<Droplets className="h-3.5 w-3.5" />} hint={`${scoped.length ? Math.round((dvaCount / scoped.length) * 100) : 0}% dos internados`} />
            <Metric label="Maior risco" value={highRisk} color={highRisk ? "var(--clinical-critical)" : undefined} hint="Classificação de risco alto" />
            <Metric label="Permanência prolongada" value={longStay} hint="14 dias ou mais em UTI" />
          </div>

          <div className={`${CARD} mt-3`}>
            <div className={TITLE}>Pacientes prioritários</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="py-2 pr-3">Leito</th>
                    <th className="py-2 pr-3">Motivo de priorização</th>
                    <th className="py-2 pr-3">Risco</th>
                    <th className="py-2 pr-3">Internação</th>
                    <th className="py-2">Situação atual</th>
                  </tr>
                </thead>
                <tbody>
                  {priority.map((p) => {
                    const meta = RISK_META[p.risk];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => { if (onSelectPatient) { onSelectPatient(p.id); onClose(); } }}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" && onSelectPatient) { onSelectPatient(p.id); onClose(); } }}
                        className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-3"
                      >
                        <td className="py-2 pr-3 font-bold tabular-nums text-foreground">{p.bed}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{p.reason}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: meta.token }}>
                            {p.risk === "high" ? <AlertOctagon className="h-3 w-3" /> : p.risk === "moderate" ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-foreground">{p.los} dias</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {p.situation.length === 0 && <span className="text-muted-foreground">Estável</span>}
                            {p.situation.map((s) => (
                              <span key={s} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Indicadores de qualidade */}
        <section>
          <h2 className={TITLE}>Indicadores de qualidade</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quality.map((ind) => {
              const trend = indicatorTrend(ind);
              const good = indicatorImproving(ind);
              const color = good ? "var(--clinical-stable)" : "var(--clinical-critical)";
              const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : MinusIcon;
              const delta = ind.value - ind.previous;
              return (
                <div key={ind.key} className={CARD}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{ind.label}</div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">{ind.value}</span>
                    <span className="pb-1 text-[11px] text-muted-foreground">{ind.unit}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color }}>
                    <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-semibold">
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)} {ind.unit}
                    </span>
                    <span className="text-muted-foreground">{good ? "melhora" : "piora"}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Meta: {ind.target} {ind.unit}
                  </div>
                  <Sparkline points={ind.spark} color={color} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Tendências */}
        <section className="pb-8">
          <h2 className={TITLE}>Tendências · {PERIODS.find((p) => p.key === period)?.label}</h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {[
              { title: "Ocupação de leitos (%)", lines: [{ k: "occupancy", n: "Ocupação", c: "var(--clinical-attention)" }] },
              { title: "Admissões versus altas", lines: [{ k: "admissions", n: "Admissões", c: "var(--primary)" }, { k: "discharges", n: "Altas", c: "var(--clinical-stable)" }] },
              { title: "Suporte avançado", lines: [{ k: "vent", n: "Ventilação mecânica", c: "var(--clinical-resp)" }, { k: "dva", n: "Drogas vasoativas", c: "var(--clinical-critical)" }] },
              { title: "Óbitos e permanência média", lines: [{ k: "deaths", n: "Óbitos", c: "var(--clinical-critical)" }, { k: "los", n: "Permanência média (dias)", c: "var(--clinical-neutral)" }] },
            ].map((chart) => (
              <div key={chart.title} className={CARD}>
                <div className={TITLE}>{chart.title}</div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" {...chartAxis} />
                      <YAxis width={32} {...chartAxis} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {chart.lines.map((l) => (
                        <Line key={l.k} type="monotone" dataKey={l.k} name={l.n} stroke={l.c} strokeWidth={2} dot={{ r: 2 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
