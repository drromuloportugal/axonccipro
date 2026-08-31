import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea, ReferenceLine, Legend,
} from "recharts";
import type { Patient, ExamRow } from "@/data/patients";

// ---------------------------------------------------------------------------
// Organ systems
// ---------------------------------------------------------------------------

type SysKey =
  | "cardio" | "resp" | "neuro" | "hemato" | "infec"
  | "renal" | "hepato" | "gi" | "musc" | "metab";

interface SysDef {
  key: SysKey;
  label: string;
  icon: string;
  color: string;
  weight: number; // for global index
}

const SYSTEMS: SysDef[] = [
  { key: "cardio", label: "Cardiovascular", icon: "", color: "#ef4444", weight: 1.4 },
  { key: "resp",   label: "Respiratório",   icon: "", color: "#3b82f6", weight: 1.4 },
  { key: "neuro",  label: "Neurológico",    icon: "", color: "#8b5cf6", weight: 1.2 },
  { key: "hemato", label: "Hematológico",   icon: "", color: "#7f1d1d", weight: 1.0 },
  { key: "infec",  label: "Infeccioso",     icon: "", color: "#f97316", weight: 1.3 },
  { key: "renal",  label: "Renal",          icon: "", color: "#eab308", weight: 1.1 },
  { key: "hepato", label: "Hepático",       icon: "", color: "#166534", weight: 0.9 },
  { key: "gi",     label: "Gastrointestinal", icon: "", color: "#84cc16", weight: 0.7 },
  { key: "musc",   label: "Musculoesquelético", icon: "", color: "#92400e", weight: 0.6 },
  { key: "metab",  label: "Metabólico",     icon: "", color: "#14b8a6", weight: 0.9 },
];

// ---------------------------------------------------------------------------
// Exam helpers
// ---------------------------------------------------------------------------

function num(s?: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}
function exam(p: Patient, ...labels: string[]): ExamRow | undefined {
  return p.exams.find((e) => labels.some((l) => e.label.toLowerCase().includes(l.toLowerCase()))
  );
}
function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

// Score each system from patient state — 0=falência, 100=hígido.
function currentScores(p: Patient): Record<SysKey, number> {
  const s = p.state;

  // Respiratório — FiO2, VM, PEEP indirect
  let resp = 100;
  if (s.fio2 > 21) resp -= (s.fio2 - 21) * 0.9;
  if (/vm|psv|pcv|vcv/i.test(s.vent)) resp -= 25;
  if (s.fio2 >= 60) resp -= 10;

  // Cardiovascular — PAM, DVA, lactato
  let cardio = 100;
  if (s.pam < 65) cardio -= (65 - s.pam) * 2.2;
  if (s.dva) cardio -= 28;
  const lact = num(exam(p, "lactato")?.value);
  if (lact !== undefined) {
    if (lact > 2) cardio -= (lact - 2) * 8;
  }

  // Neuro — Glasgow, RASS
  let neuro = (s.glasgow / 15) * 100;
  if (Math.abs(s.rass) >= 3) neuro -= 15;
  else if (Math.abs(s.rass) >= 2) neuro -= 8;

  // Renal — Creat, diurese
  let renal = 100;
  const creat = num(exam(p, "creat")?.value);
  if (creat !== undefined) {
    if (creat > 1.2) renal -= (creat - 1.2) * 22;
  }
  if (s.diurese < 0.5) renal -= 25;
  else if (s.diurese < 1) renal -= 10;

  // Hepático — Bilirrubinas, INR, TGO/TGP
  let hepato = 100;
  const bil = num(exam(p, "bilirr", "bt")?.value);
  if (bil && bil > 1.2) hepato -= (bil - 1.2) * 12;
  const inr = num(exam(p, "inr", "rni")?.value);
  if (inr && inr > 1.2) hepato -= (inr - 1.2) * 25;
  const tgo = num(exam(p, "tgo", "ast")?.value);
  if (tgo && tgo > 40) hepato -= Math.min(30, (tgo - 40) / 8);

  // Hematológico — Hb, plaquetas
  let hemato = 100;
  const hb = num(exam(p, "hb", "hemoglob")?.value);
  if (hb !== undefined) {
    if (hb < 12) hemato -= (12 - hb) * 5;
  }
  const plaq = num(exam(p, "plaq")?.value);
  if (plaq !== undefined) {
    if (plaq < 150) hemato -= (150 - plaq) * 0.2;
  }

  // Infeccioso — PCR, leuco, febre, infections
  let infec = 100;
  const pcr = num(exam(p, "pcr")?.value);
  if (pcr && pcr > 1) infec -= Math.min(45, pcr * 1.6);
  const leuco = num(exam(p, "leuco")?.value);
  if (leuco !== undefined) {
    if (leuco > 12000) infec -= Math.min(25, (leuco - 12000) / 600);
    if (leuco < 4000) infec -= 20;
  }
  if (s.temp >= 38) infec -= (s.temp - 37.8) * 12;
  const activeInf = (p.infections ?? []).filter((i) => i.status !== "resolvido").length;
  infec -= activeInf * 10;

  // GI — dieta
  let gi = 100;
  const d = (s.dieta ?? "").toLowerCase();
  if (d.includes("zero") || d.includes("jejum")) gi -= 35;
  else if (d.includes("trofic") || d.includes("tróf")) gi -= 18;
  else if (d.includes("parenter")) gi -= 25;

  // Músculo — tempo de UTI
  let musc = 100 - Math.min(55, p.daysICU * 3.5);

  // Metabólico — pH, glicemia
  let metab = 100;
  const ph = num(exam(p, "ph")?.value);
  if (ph !== undefined) {
    const dev = Math.abs(ph - 7.4);
    metab -= dev * 90;
  }
  const glic = num(exam(p, "glic", "glicem", "hgt")?.value);
  if (glic !== undefined) {
    if (glic > 180) metab -= Math.min(25, (glic - 180) / 12);
    if (glic < 70) metab -= 25;
  }

  return {
    cardio: clamp(cardio), resp: clamp(resp), neuro: clamp(neuro),
    hemato: clamp(hemato), infec: clamp(infec), renal: clamp(renal),
    hepato: clamp(hepato), gi: clamp(gi), musc: clamp(musc), metab: clamp(metab),
  };
}

// Severity influences historical trajectory shape.
function trajectoryBias(p: Patient): number {
  if (p.severity === "critical") return -10;
  if (p.severity === "stable") return +6;
  return -2;
}

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build a smooth random-walk history that lands at `target` on day=now,
// starting near `start` (computed from bias).
function buildSeries(
  target: number, days: number, bias: number,
  rnd: () => number,
): number[] {
  const n = Math.max(2, days + 1);
  // start: opposite direction of bias (e.g. critical→started higher and fell)
  const start = clamp(target - bias * (1 + rnd() * 0.5));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = start + (target - start) * t;
    const noise = (rnd() - 0.5) * 8;
    out.push(clamp(base + noise));
  }
  out[out.length - 1] = target; // anchor to "now"
  return out;
}

// Linear projection from last slope.
function project(history: number[], steps: number, bias: number, rnd: () => number): number[] {
  const last = history[history.length - 1];
  const prev = history[history.length - 2] ?? last;
  const slope = (last - prev) * 0.6 + bias * 0.15;
  const out: number[] = [];
  let v = last;
  for (let i = 1; i <= steps; i++) {
    v += slope + (rnd() - 0.5) * 3;
    out.push(clamp(v));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Time-axis units
// ---------------------------------------------------------------------------

type Unit = "h" | "d" | "s";

function pickUnit(daysICU: number): Unit {
  if (daysICU <= 2) return "h";
  if (daysICU <= 21) return "d";
  return "s";
}

function tickLabel(daysFromAdmission: number, unit: Unit, now: number): string {
  const offset = daysFromAdmission - now;
  if (unit === "h") {
    const h = Math.round(daysFromAdmission * 24);
    return `${h}h`;
  }
  if (unit === "s") {
    const w = (daysFromAdmission / 7).toFixed(1);
    return `${w}s`;
  }
  // d
  if (offset === 0) return "Hoje";
  if (offset > 0) return `+${offset}d`;
  return `D${Math.round(daysFromAdmission)}`;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

interface Alert {
  level: "critical" | "attention" | "watch" | "good";
  icon: string;
  text: string;
}

function buildAlerts(global: number[], nowIdx: number): Alert[] {
  const alerts: Alert[] = [];
  const cur = global[nowIdx];
  const m1 = global[Math.max(0, nowIdx - 1)];
  const m2 = global[Math.max(0, nowIdx - 2)];
  const m3 = global[Math.max(0, nowIdx - 3)];

  if (m1 !== undefined && m1 - cur >= 15) {
    alerts.push({ level: "critical", icon: "", text: "Queda >15 pts em 24h" });
  } else if (m2 !== undefined && m2 - cur >= 10) {
    alerts.push({ level: "attention", icon: "", text: "Queda >10 pts em 48h" });
  }
  if (m3 !== undefined && Math.abs(cur - m3) < 3) {
    alerts.push({ level: "watch", icon: "", text: "Estável sem melhora 72h" });
  }
  const min = Math.min(...global.slice(0, nowIdx + 1));
  if (cur - min >= 20) {
    alerts.push({ level: "good", icon: "", text: "Recuperação sustentada >20 pts" });
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrganIntegrityChart({ patient }: { patient: Patient }) {
  const [hidden, setHidden] = useState<Set<SysKey | "global">>(new Set());

  const data = useMemo(() => {
    const scores = currentScores(patient);
    const bias = trajectoryBias(patient);
    const rnd = mulberry32(hashId(patient.id));
    const daysICU = Math.max(1, patient.daysICU);
    const projDays = 7;

    const series: Record<SysKey, number[]> = {} as never;
    SYSTEMS.forEach((s) => {
      const hist = buildSeries(scores[s.key], daysICU, bias, rnd);
      const proj = project(hist, projDays, bias, rnd);
      series[s.key] = [...hist, ...proj];
    });

    const len = series.cardio.length;
    const nowIdx = daysICU; // index of "now"
    const unit = pickUnit(daysICU);

    // Global weighted mean per timestep
    const totalW = SYSTEMS.reduce((a, s) => a + s.weight, 0);
    const global: number[] = [];
    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (const s of SYSTEMS) sum += series[s.key][i] * s.weight;
      global.push(clamp(sum / totalW));
    }

    const rows = Array.from({ length: len }, (_, i) => {
      const day = i; // 0..daysICU+proj
      const row: Record<string, number | string | null> = {
        x: day,
        label: tickLabel(day, unit, nowIdx),
        isFuture: i > nowIdx ? 1 : 0,
      };
      for (const s of SYSTEMS) {
        // split historical vs projected: historical only up to nowIdx (inclusive),
        // projected starts at nowIdx (overlap of 1 to connect lines)
        row[`${s.key}_hist`] = i <= nowIdx ? series[s.key][i] : null;
        row[`${s.key}_proj`] = i >= nowIdx ? series[s.key][i] : null;
      }
      row.global_hist = i <= nowIdx ? global[i] : null;
      row.global_proj = i >= nowIdx ? global[i] : null;
      return row;
    });

    const alerts = buildAlerts(global, nowIdx);

    return { rows, nowIdx, unit, alerts, currentGlobal: global[nowIdx], scores };
  }, [patient]);

  const toggle = (key: SysKey | "global") => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const globalLabel =
    data.currentGlobal >= 80 ? "Hígido" :
    data.currentGlobal >= 60 ? "Estável" :
    data.currentGlobal >= 40 ? "Crítico" :
    data.currentGlobal >= 20 ? "Alto risco" : "Falência multiorgânica";

  const globalColor =
    data.currentGlobal >= 80 ? "text-clinical-stable" :
    data.currentGlobal >= 60 ? "text-clinical-stable" :
    data.currentGlobal >= 40 ? "text-clinical-attention" :
    "text-clinical-critical";

  return (
    <div className="rounded-md border border-border bg-surface p-4"> {/* Header */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> Mapa Temporal de Integridade Orgânica
          </div>
          <div className="text-[10px] text-muted-foreground"> Eletrocardiograma da recuperação · escala 0–100 ·{" "}
            {data.unit === "h" ? "horas" : data.unit === "s" ? "semanas" : "dias"} desde admissão UTI
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> Índice Global
            </div>
            <div className={`font-mono text-2xl font-bold leading-none ${globalColor}`}> {data.currentGlobal.toFixed(0)}
            </div>
            <div className={`text-[10px] font-semibold ${globalColor}`}>{globalLabel}</div>
          </div>
        </div>
      </div> {/* Alerts strip */}
      {data.alerts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5"> {data.alerts.map((a, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                a.level === "critical" ? "border-clinical-critical/40 bg-clinical-critical/10 text-clinical-critical" :
                a.level === "attention" ? "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention" :
                a.level === "watch" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-600" :
                "border-clinical-stable/40 bg-clinical-stable/10 text-clinical-stable"
              }`}
            >
              <span>{a.icon}</span>{a.text}
            </span> ))}
        </div> )}

      {/* Chart */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.rows} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} /> {/* Severity bands */}
            <ReferenceArea y1={80} y2={100} fill="hsl(142 65% 42%)" fillOpacity={0.05} />
            <ReferenceArea y1={60} y2={80} fill="hsl(82 60% 50%)" fillOpacity={0.05} />
            <ReferenceArea y1={40} y2={60} fill="hsl(40 90% 55%)" fillOpacity={0.06} />
            <ReferenceArea y1={20} y2={40} fill="hsl(20 85% 55%)" fillOpacity={0.07} />
            <ReferenceArea y1={0}  y2={20} fill="hsl(0 75% 55%)"fillOpacity={0.08} />

            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
            /> {/* Now marker */}
            <ReferenceLine
              x={data.rows[data.nowIdx]?.label as string}
              stroke="hsl(var(--foreground))"
              strokeDasharray="4 2"
              strokeOpacity={0.5}
              label={{ value: "agora", fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "top" }}
            />

            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ fontWeight: 600, fontSize: 11 }}
              formatter={(v: number, name: string) => {
                if (v == null) return ["—", name];
                const clean = name.replace(/_(hist|proj)$/, "");
                const sys = SYSTEMS.find((s) => s.key === clean);
                return [v.toFixed(0), sys ? `${sys.icon} ${sys.label}` : "Índice global"];
              }}
            /> {/* System lines (historical + projection) */}
            {SYSTEMS.flatMap((s) => {
              if (hidden.has(s.key)) return [];
              return [
                <Line
                  key={`${s.key}-h`}
                  type="monotone"
                  dataKey={`${s.key}_hist`}
                  name={`${s.key}_hist`}
                  stroke={s.color}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />,
                <Line
                  key={`${s.key}-p`}
                  type="monotone"
                  dataKey={`${s.key}_proj`}
                  name={`${s.key}_proj`}
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />,
              ];
            })}

            {/* Global index — thick line */}
            {!hidden.has("global") && (
              <>
                <Line
                  type="monotone"
                  dataKey="global_hist"
                  name="global_hist"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={3.2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="global_proj"
                  name="global_proj"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </> )}

            <Legend content={() => null} />
          </LineChart>
        </ResponsiveContainer>
      </div> {/* Custom legend — toggleable chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => toggle("global")}
          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold transition-opacity ${
            hidden.has("global") ? "opacity-40" : ""
          } border-foreground/40 bg-foreground/5 text-foreground`}
          title="Índice Global de Integridade (média ponderada)"
        >
          <span className="inline-block h-0.5 w-4 bg-foreground" style={{ height: 3 }} /> Índice Global
        </button> {SYSTEMS.map((s) => {
          const cur = data.scores[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px] transition-opacity ${
                hidden.has(s.key) ? "opacity-35" : ""
              }`}
              title={`${s.label} · ${cur.toFixed(0)}/100`}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span>{s.icon}</span>
              <span className="font-medium text-foreground">{s.label}</span>
              <span className="font-mono text-muted-foreground">{cur.toFixed(0)}</span>
            </button> );
        })}
      </div> {/* Band legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="font-semibold text-foreground">Faixas:</span>
        <span>80–100 Preservada</span>
        <span>60–79 Disf. leve</span>
        <span>40–59 Moderada</span>
        <span>20–39 Grave</span>
        <span>0–19 Falência</span>
        <span>· · · Projeção 7d</span>
      </div>
    </div> );
}
