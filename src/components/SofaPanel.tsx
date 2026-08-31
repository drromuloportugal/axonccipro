import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { Patient } from "@/data/patients";
import {
  SOFA_SYSTEMS, TRAJECTORY_META, fmtDelta, summarizeSofa,
} from "@/lib/sofa";

function deltaClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-clinical-critical";
  if (v < 0) return "text-clinical-stable";
  return "text-muted-foreground";
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function SofaPanel({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const s = useMemo(() => summarizeSofa(patient), [patient]);

  const traj = TRAJECTORY_META[s.trajectory];
  const cur = s.current?.total ?? null;

  const dominantText = s.dominant
    ? s.dominant.keys
        .map((k) => {
          const meta = SOFA_SYSTEMS.find((x) => x.key === k)!;
           return meta.label;
        })
        .join(" · ") + ` — ${s.dominant.score}`
    : "N/D";

  const chartRows = useMemo(
    () => s.series.map((p) => {
        const row: Record<string, number | string | null> = {
          label: shortTime(p.t),
          total: p.total,
        };
        for (const sys of SOFA_SYSTEMS) row[sys.key] = p.components[sys.key];
        return row;
      }),
    [s.series],
  );

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "SOFA basal", value: s.baseline?.total != null ? String(s.baseline.total) : "N/D" },
    { label: "SOFA atual", value: cur != null ? String(cur) : "N/D" },
    { label: "Δ 24 h", value: fmtDelta(s.delta24), className: deltaClass(s.delta24) },
    { label: "Δ 48 h", value: fmtDelta(s.delta48), className: deltaClass(s.delta48) },
    { label: "Δ desde admissão", value: fmtDelta(s.deltaAdmission), className: deltaClass(s.deltaAdmission) },
    { label: "Maior SOFA", value: s.max ? `${s.max.value} (${shortTime(s.max.t)})` : "N/D" },
    { label: "Órgão dominante", value: dominantText },
    {
      label: "Sistemas ≥2",
      value: s.systemsGte2 != null ? `${s.systemsGte2}/6` : "N/D",
    },
    { label: "Trajetória", value: traj.label, className: traj.className },
  ];

  return (
 <div className="rounded-md border border-border bg-surface p-4">
 <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"> SOFA — Evolução da Disfunção Orgânica
 </div>
 <div className="text-[10px] text-muted-foreground"> Cálculo automático dos 6 sistemas · sem dado suficiente = N/D
 </div>
 </div>
 <div className="text-right">
 <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> SOFA atual
 </div>
 <div className="font-mono text-2xl font-bold leading-none text-foreground"> {cur != null ? cur : "N/D"}
 </div>
  <div className={`text-[10px] font-semibold ${deltaClass(s.delta24)}`}> {s.delta24 != null ? `${fmtDelta(s.delta24)} / 24 h` : "Δ 24 h N/D"}
 </div>
 </div>
 </div> {/* Tabela compacta */}
 <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2"> {rows.map((r) => (
 <div
            key={r.label}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1 text-[11px] last:border-b-0"
          >
 <span className="text-muted-foreground">{r.label}</span>
 <span className={`font-mono font-semibold ${r.className ?? "text-foreground"}`}> {r.value}
 </span>
 </div> ))}
 </div> {/* Componentes atuais */}
 <div className="mt-3 flex flex-wrap gap-1.5"> {SOFA_SYSTEMS.map((sys) => {
          const v = s.current?.components[sys.key] ?? null;
          return (
 <span
              key={sys.key}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px]"
              title={`${sys.label}: ${v == null ? "sem dado" : `${v} pts`}`}
            >
 <span className="inline-block h-2 w-2 rounded-full" style={{ background: sys.color }} />
 <span className="font-medium text-foreground">{sys.label}</span>
 <span className="font-mono text-muted-foreground">{v == null ? "N/D" : v}</span>
 </span> );
        })}
 </div>

 <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 rounded border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:bg-surface"
      > {open ? "Ocultar evolução SOFA" : "Ver evolução SOFA"}
 </button> {open && (
 <div className="mt-3 space-y-3"> {s.series.length < 2 ? (
 <div className="rounded border border-dashed border-border p-3 text-[11px] italic text-muted-foreground"> Dados insuficientes para gráfico temporal — é necessário mais de um registro
              laboratorial datado.
 </div> ) : (
 <>
 <div>
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> SOFA total × tempo
 </div>
 <div className="h-[180px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartRows} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
 <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
 <YAxis domain={[0, 24]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
 <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                        formatter={(v: number) => [v ?? "N/D", "SOFA total"]}
                      />
 <Line
                        type="monotone"
                        dataKey="total"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2.6}
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                        connectNulls
                      />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 <div>
 <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Evolução por sistema (0–4)
 </div>
 <div className="h-[180px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartRows} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
 <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
 <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
 <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                        formatter={(v: number, name: string) => {
                          const sys = SOFA_SYSTEMS.find((x) => x.key === name);
                           return [v ?? "N/D", sys ? sys.label : name];
                        }}
                      /> {SOFA_SYSTEMS.map((sys) => (
 <Line
                          key={sys.key}
                          type="monotone"
                          dataKey={sys.key}
                          stroke={sys.color}
                          strokeWidth={1.8}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls
                        /> ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 </> )}
 </div> )}
 </div> );
}
