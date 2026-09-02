// Sequência temporal dos itens da coluna 6 (estado atual): sinais vitais
// seriados, exames laboratoriais, gasometria e balanço hídrico.
// Eixo Y padrão: índice de referência individual de cada parâmetro
// (0 = limite inferior, 1 = limite superior), permitindo comparar curvas
// com escalas totalmente diferentes na mesma área de plotagem.

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine,
} from "recharts";
import type { Patient } from "@/data/patients";
import { labByCode, labByLabel } from "@/lib/clinical";


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

interface Ref { low: number; high: number }

interface SeriesDef {
  key: string;
  label: string;
  unit?: string;
  group: GroupKey;
  color: string;
  ref?: Ref;
  points: { t: number; v: number }[];
}

const isGaso = (code?: string, label?: string) =>
  /pH|PaO2|PaCO2|HCO3|SatO2|Lact|^BE$|BE \(|Base Excess|P\/F|PaO.*FiO/i.test(code ?? label ?? "");

// Faixas de referência dos sinais vitais / balanço (adulto crítico).
const VITAL_REFS: Record<string, Ref> = {
  temp: { low: 36, high: 37.8 },
  spo2: { low: 92, high: 100 },
  fc: { low: 60, high: 100 },
  pam: { low: 65, high: 100 },
  pas: { low: 100, high: 140 },
  pad: { low: 60, high: 90 },
  fr: { low: 12, high: 20 },
  glicemia: { low: 70, high: 180 },
  bristol: { low: 3, high: 5 },
  bh: { low: -500, high: 500 },
};

function num(s?: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}

// Índice de referência: 0 = limite inferior, 1 = limite superior.
// Fora da faixa, mantém a mesma escala relativa (largura da faixa),
// com compressão logarítmica suave para não distorcer o gráfico.
function toIndex(v: number, ref?: Ref): number {
  if (!ref || !(ref.high > ref.low)) return v;
  const span = ref.high - ref.low;
  const raw = (v - ref.low) / span;
  if (raw >= 0 && raw <= 1) return raw;
  const over = raw > 1 ? raw - 1 : -raw;
  const compressed = Math.log10(1 + over * 9); // 1 faixa de excesso => 1.0
  return raw > 1 ? 1 + compressed : -compressed;
}

function buildSeries(patient: Patient): SeriesDef[] {
  const out: SeriesDef[] = [];
  const series = patient.state.vitalSeries ?? {};

  const vitalDefs: { key: keyof typeof series; label: string; unit: string; group?: GroupKey }[] = [
    { key: "temp", label: "Temperatura", unit: "°C" },
    { key: "spo2", label: "SpO₂", unit: "%" },
    { key: "fc", label: "FC", unit: "bpm" },
    { key: "pam", label: "PAM", unit: "mmHg" },
    { key: "pas", label: "PAS", unit: "mmHg" },
    { key: "pad", label: "PAD", unit: "mmHg" },
    { key: "fr", label: "FR", unit: "ipm" },
    { key: "glicemia", label: "Glicemia", unit: "mg/dL" },
    { key: "bristol", label: "Escala de Bristol", unit: "1–7" },
    { key: "bh", label: "Balanço hídrico", unit: "mL", group: "fluid" },
  ];

  for (const d of vitalDefs) {
    const readings = (series[d.key] ?? []) as { value?: number; at?: string }[];
    const extra: { t: number; v: number }[] = [];
    if (d.key === "bristol") {
      for (const st of patient.state.stools ?? []) {
        if (typeof st.bristol === "number" && st.at) extra.push({ t: new Date(st.at).getTime(), v: st.bristol });
      }
    }
    const points = readings
      .filter((r) => typeof r.value === "number" && r.at)
      .map((r) => ({ t: new Date(r.at!).getTime(), v: r.value as number }))
      .concat(extra)
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    if (points.length) {
      out.push({
        key: `v:${String(d.key)}`, label: d.label, unit: d.unit,
        group: d.group ?? "vitals", color: "",
        ref: VITAL_REFS[String(d.key)], points,
      });
    }
  }

  const sex = patient.sex;
  for (const e of patient.exams) {
    const group: GroupKey = isGaso(e.code, e.label) ? "gaso" : "lab";
    const hist = (e.history ?? [])
      .filter((h) => typeof h.value === "number" && h.takenAt)
      .map((h) => ({ t: new Date(h.takenAt).getTime(), v: h.value }));
    const last = e.valueNum ?? num(e.value);
    if (e.takenAt && last != null) hist.push({ t: new Date(e.takenAt).getTime(), v: last });
    const points = hist.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (points.length > 0) {
      const def = (e.code ? labByCode(e.code) : undefined) ?? labByLabel(e.label);
      const defRef = def ? (sex === "F" && def.refF ? def.refF : def.ref) : undefined;
      const ref: Ref | undefined = defRef ? { low: defRef.low, high: defRef.high } : undefined;

      out.push({ key: `e:${e.code ?? e.label}`, label: e.label, unit: e.unit ?? def?.unit, group, color: "", ref, points });
    }
  }

  return out.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
}


// Série alterada = último valor fora da faixa de referência.
function isAltered(s: SeriesDef): boolean {
  if (!s.ref || !s.points.length) return false;
  const last = s.points[s.points.length - 1].v;
  return last < s.ref.low || last > s.ref.high;
}

export function ClinicalTrendChart({ patient }: { patient: Patient }) {
  const all = useMemo(() => buildSeries(patient), [patient]);
  const [groups, setGroups] = useState<Set<GroupKey>>(new Set<GroupKey>(["vitals", "lab", "gaso", "fluid"]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"index" | "raw">("index");

  const visible = useMemo(
    () => all.filter((s) => groups.has(s.group) && selected.has(s.key)),
    [all, groups, selected],
  );

  const data = useMemo(() => {
    const byTime = new Map<number, Record<string, number | string>>();
    for (const s of visible) {
      for (const p of s.points) {
        const row = byTime.get(p.t) ?? { t: p.t };
        row[s.key] = mode === "index" ? toIndex(p.v, s.ref) : p.v;
        row[`${s.key}#raw`] = p.v;
        byTime.set(p.t, row);
      }
    }
    return Array.from(byTime.values()).sort((a, b) => (a.t as number) - (b.t as number));
  }, [visible, mode]);

  const toggleGroup = (g: GroupKey) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });

  const toggleSelect = (k: string) =>
    setSelected((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const byKey = useMemo(() => new Map(visible.map((s) => [s.key, s])), [visible]);

  const TrendTooltip = ({ active, label, payload }: {
    active?: boolean; label?: number | string;
    payload?: { dataKey?: string | number; payload?: Record<string, number | string> }[];
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload ?? {};
    return (
      <div className="rounded border border-border bg-card px-2 py-1.5 text-[11px] shadow">
        <div className="mb-1 font-semibold text-foreground">
          {new Date(Number(label)).toLocaleString("pt-BR")}
        </div>
        {payload.map((p) => {
          const key = String(p.dataKey ?? "");
          const s = byKey.get(key);
          if (!s) return null;
          const raw = row[`${key}#raw`];
          const idx = toIndex(Number(raw), s.ref);
          const status = !s.ref ? "" : idx > 1 ? " acima" : idx < 0 ? " abaixo" : " normal";
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-foreground">{s.label}:</span>
              <strong>{String(raw)}{s.unit ? ` ${s.unit}` : ""}</strong>
              {s.ref && (
                <span className="text-muted-foreground">
                  (ref {s.ref.low}–{s.ref.high} · índice {idx.toFixed(2)}{status})
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };


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
          <button
            type="button"
            onClick={() => setMode((m) => (m === "index" ? "raw" : "index"))}
            title="Alternar entre índice de referência e valor absoluto"
            className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-surface-3"
          >
            {mode === "index" ? "Eixo: índice de referência" : "Eixo: valor absoluto"}
          </button>

          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-surface-3"
            >
              Limpar seleção ({selected.size})
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
                const on = selected.has(s.key);
                const alt = isAltered(s);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSelect(s.key)}
                    title={alt ? "Último valor fora da faixa de referência" : "Selecionar este resultado"}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity ${
                      on ? "border-border bg-surface text-foreground" : "border-border/60 bg-surface-2 text-muted-foreground opacity-70"
                    }`}
                  >
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      {alt && (
                        <span
                          className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-75"
                          style={{ background: "hsl(var(--clinical-critical, 0 70% 50%))" }}
                        />
                      )}
                      <span className="relative h-2 w-2 rounded-full" style={{ background: s.color }} />
                    </span>
                    {s.label}
                    {alt && <span className="text-[9px] font-bold text-destructive">alterado</span>}
                  </button>
                );
              })}
          </div>

          {selected.size === 0 && (
            <div className="mb-2 rounded border border-dashed border-border/60 px-3 py-2 text-center text-[11px] text-muted-foreground">
              Selecione um ou mais parâmetros acima para exibir as curvas.
            </div>
          )}

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
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--border))"
                  width={mode === "index" ? 56 : 44}
                  domain={mode === "index" ? [-1.2, 2.2] : ["auto", "auto"]}
                  ticks={mode === "index" ? [-1, 0, 1, 2] : undefined}
                  tickFormatter={
                    mode === "index"
                      ? (v: number) => (v === 0 ? "Ref mín" : v === 1 ? "Ref máx" : v.toFixed(1))
                      : undefined
                  }
                />
                {mode === "index" && (
                  <>
                    <ReferenceArea y1={-1.2} y2={0} fill="#0ea5e9" fillOpacity={0.07}
                      label={{ value: "Abaixo da referência", position: "insideBottomLeft", fontSize: 9, fill: "#0369a1" }} />
                    <ReferenceArea y1={0} y2={1} fill="#16a34a" fillOpacity={0.1}
                      label={{ value: "Faixa de referência", position: "insideLeft", fontSize: 9, fill: "#15803d" }} />
                    <ReferenceArea y1={1} y2={2.2} fill="#dc2626" fillOpacity={0.07}
                      label={{ value: "Acima da referência", position: "insideTopLeft", fontSize: 9, fill: "#b91c1c" }} />
                    <ReferenceLine y={0} stroke="#16a34a" strokeDasharray="4 4" />
                    <ReferenceLine y={1} stroke="#16a34a" strokeDasharray="4 4" />
                  </>
                )}
                <Tooltip content={<TrendTooltip />} />
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
