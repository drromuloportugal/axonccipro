// Sequência temporal dos itens da coluna 6 (estado atual): sinais vitais
// seriados, exames laboratoriais, gasometria e balanço hídrico.
// Permite isolar itens (seleção) e agrupar resultados por categoria.

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { Patient } from "@/data/patients";

type GroupKey = "vitals" | "lab" | "gaso" | "fluid";

const GROUP_META: Record<GroupKey, { label: string; color: string }> = {
  vitals: { label: "Sinais vitais", color: "#0ea5e9" },
  lab: { label: "Laboratoriais", color: "#16a34a" },
  gaso: { label: "Gasometria", color: "#7c3aed" },
  fluid: { label: "Balanço hídrico", color: "#f59e0b" },
};

const PALETTE = [
  "#0ea5e9", "#16a34a", "#dc2626", "#7c3aed", "#f59e0b", "#0891b2",
  "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#b91c1c",
];

interface SeriesDef {
  key: string;
  label: string;
  unit?: string;
  group: GroupKey;
  color: string;
  points: { t: number; v: number }[];
}

const isGaso = (code?: string, label?: string) =>
  /pH|PaO2|PaCO2|HCO3|SatO2|Lact|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(code ?? label ?? "");

function num(s?: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}

function buildSeries(patient: Patient): SeriesDef[] {
  const out: SeriesDef[] = [];
  const series = patient.state.vitalSeries ?? {};

  const vitalDefs: { key: keyof typeof series; label: string; unit: string }[] = [
    { key: "temp", label: "Temperatura", unit: "°C" },
    { key: "spo2", label: "SpO₂", unit: "%" },
    { key: "fc", label: "FC", unit: "bpm" },
    { key: "pam", label: "PAM", unit: "mmHg" },
    { key: "pas", label: "PAS", unit: "mmHg" },
    { key: "pad", label: "PAD", unit: "mmHg" },
    { key: "fr", label: "FR", unit: "ipm" },
    { key: "glicemia", label: "Glicemia", unit: "mg/dL" },
  ];

  for (const d of vitalDefs) {
    const readings = (series[d.key] ?? []) as { value?: number; at?: string }[];
    const points = readings
      .filter((r) => typeof r.value === "number" && r.at)
      .map((r) => ({ t: new Date(r.at!).getTime(), v: r.value as number }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    if (points.length) {
      out.push({ key: `v:${String(d.key)}`, label: d.label, unit: d.unit, group: "vitals", color: "", points });
    }
  }

  for (const e of patient.exams) {
    const group: GroupKey = isGaso(e.code, e.label) ? "gaso" : "lab";
    const hist = (e.history ?? [])
      .filter((h) => typeof h.value === "number" && h.takenAt)
      .map((h) => ({ t: new Date(h.takenAt).getTime(), v: h.value }));
    const last = e.valueNum ?? num(e.value);
    if (e.takenAt && last != null) hist.push({ t: new Date(e.takenAt).getTime(), v: last });
    const points = hist.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (points.length > 0) {
      out.push({ key: `e:${e.code ?? e.label}`, label: e.label, unit: e.unit, group, color: "", points });
    }
  }

  return out.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
}

export function ClinicalTrendChart({ patient }: { patient: Patient }) {
  const all = useMemo(() => buildSeries(patient), [patient]);
  const [groups, setGroups] = useState<Set<GroupKey>>(new Set<GroupKey>(["vitals", "lab", "gaso", "fluid"]));
  const [isolated, setIsolated] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const byGroup = all.filter((s) => groups.has(s.group));
    return isolated.size ? byGroup.filter((s) => isolated.has(s.key)) : byGroup;
  }, [all, groups, isolated]);

  const data = useMemo(() => {
    const byTime = new Map<number, Record<string, number | string>>();
    for (const s of visible) {
      for (const p of s.points) {
        const row = byTime.get(p.t) ?? { t: p.t };
        row[s.key] = p.v;
        byTime.set(p.t, row);
      }
    }
    return Array.from(byTime.values()).sort((a, b) => (a.t as number) - (b.t as number));
  }, [visible]);

  const toggleGroup = (g: GroupKey) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });

  const toggleIsolate = (k: string) =>
    setIsolated((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-md bg-clinical-neutral px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
          Sequência temporal de resultados
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(GROUP_META) as GroupKey[]).map((g) => {
            const on = groups.has(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  on ? "border-transparent text-white" : "border-border bg-surface text-muted-foreground"
                }`}
                style={on ? { background: GROUP_META[g].color } : undefined}
              >
                {GROUP_META[g].label}
              </button>
            );
          })}
          {isolated.size > 0 && (
            <button
              type="button"
              onClick={() => setIsolated(new Set())}
              className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-surface-3"
            >
              Limpar isolamento ({isolated.size})
            </button>
          )}
        </div>
      </header>

      {all.length === 0 ? (
        <div className="rounded border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
          Sem registros seriados com data para plotar. Registre valores datados nos sinais vitais e exames.
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {all
              .filter((s) => groups.has(s.group))
              .map((s) => {
                const on = isolated.size === 0 || isolated.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleIsolate(s.key)}
                    title="Isolar / incluir este resultado"
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity ${
                      on ? "border-border bg-surface text-foreground" : "border-border/60 bg-surface-2 text-muted-foreground opacity-60"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </button>
                );
              })}
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--border))"
                />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" width={38} />
                <Tooltip
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString("pt-BR")}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {visible.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.unit ? `${s.label} (${s.unit})` : s.label}
                    stroke={s.color}
                    strokeWidth={1.8}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
