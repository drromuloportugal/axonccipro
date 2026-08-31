// Preenchimento seriado em forma de tabela: cada item é uma linha, cada data é uma coluna.
// Cobre sinais vitais, escala de Bristol, balanço hídrico e exames laboratoriais.

import { useMemo, useState } from "react";
import type { ExamRow, Patient, VitalReading } from "@/data/patients";

type SeriesKey = keyof NonNullable<Patient["state"]["vitalSeries"]>;

const VITAL_ROWS: { key: SeriesKey; label: string; unit: string; step?: string }[] = [
  { key: "temp", label: "Temperatura", unit: "°C", step: "0.1" },
  { key: "spo2", label: "Saturação O₂", unit: "%" },
  { key: "fc", label: "FC", unit: "bpm" },
  { key: "pam", label: "PAM", unit: "mmHg" },
  { key: "pas", label: "PAS", unit: "mmHg" },
  { key: "pad", label: "PAD", unit: "mmHg" },
  { key: "fr", label: "FR", unit: "ipm" },
  { key: "glicemia", label: "Glicemia", unit: "mg/dL" },
  { key: "bristol", label: "Escala de Bristol", unit: "1–7" },
  { key: "bh", label: "Balanço hídrico", unit: "mL" },
];

const cellCls =
  "h-7 w-full rounded border border-border bg-background px-1 text-center text-[11px] font-mono outline-none focus:border-primary";

const dayKey = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const atFor = (date: string) => `${date}T12:00:00.000Z`;
const uid = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const fmtCol = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};
const parseNum = (s?: string) => {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
};

export function SerialMatrix({
  patient,
  onChangeState,
  onChangeExams,
}: {
  patient: Patient;
  onChangeState: <K extends keyof Patient["state"]>(k: K, v: Patient["state"][K]) => void;
  onChangeExams: (v: ExamRow[]) => void;
}) {
  const series = patient.state.vitalSeries ?? {};
  const exams = patient.exams ?? [];
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");

  const dates = useMemo(() => {
    const set = new Set<string>(extraDates);
    for (const row of VITAL_ROWS) {
      for (const r of series[row.key] ?? []) if (r.at) set.add(dayKey(r.at));
    }
    for (const e of exams) {
      if (e.takenAt) set.add(dayKey(e.takenAt));
      for (const h of e.history ?? []) if (h.takenAt) set.add(dayKey(h.takenAt));
    }
    if (set.size === 0) set.add(new Date().toISOString().slice(0, 10));
    return Array.from(set).filter(Boolean).sort();
  }, [series, exams, extraDates]);

  const setVital = (key: SeriesKey, date: string, raw: string) => {
    const value = parseNum(raw);
    const arr = [...(series[key] ?? [])];
    const idx = arr.findIndex((r) => dayKey(r.at) === date);
    if (value == null) {
      if (idx >= 0) arr.splice(idx, 1);
    } else if (idx >= 0) {
      arr[idx] = { ...arr[idx], value, at: arr[idx].at ?? atFor(date) };
    } else {
      arr.push({ id: uid(), value, at: atFor(date) } as VitalReading);
    }
    arr.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
    onChangeState("vitalSeries", { ...series, [key]: arr });
  };

  const getVital = (key: SeriesKey, date: string) => {
    const r = (series[key] ?? []).find((x) => dayKey(x.at) === date);
    return r?.value ?? "";
  };

  const examPoints = (e: ExamRow) => {
    const map = new Map<string, number>();
    for (const h of e.history ?? []) if (h.takenAt && typeof h.value === "number") map.set(dayKey(h.takenAt), h.value);
    const legacy = e.valueNum ?? parseNum(e.value);
    if (e.takenAt && legacy != null) map.set(dayKey(e.takenAt), legacy);
    return map;
  };

  const setExam = (i: number, date: string, raw: string) => {
    const e = exams[i];
    const map = examPoints(e);
    const value = parseNum(raw);
    if (value == null) map.delete(date);
    else map.set(date, value);
    const points = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ takenAt: atFor(d), value: v }));
    const last = points[points.length - 1];
    const next: ExamRow = {
      ...e,
      history: points,
      value: last ? String(last.value) : "",
      valueNum: last?.value,
      takenAt: last?.takenAt,
    };
    onChangeExams(exams.map((x, k) => (k === i ? next : x)));
  };

  const addDate = () => {
    if (!newDate) return;
    setExtraDates((prev) => (prev.includes(newDate) ? prev : [...prev, newDate]));
    setNewDate("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nova coluna (data)
          </span>
          <input
            type="date"
            className="h-8 rounded border border-border bg-background px-2 text-[12px]"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={addDate}
          className="h-8 rounded border border-border bg-surface px-3 text-[12px] font-semibold hover:bg-surface-3"
        >
          + Adicionar data
        </button>
        <span className="text-[10px] text-muted-foreground">
          Deixe a célula vazia para remover o registro daquela data.
        </span>
      </div>

      <div className="max-h-[62vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="sticky left-0 z-20 min-w-[170px] bg-surface-2 px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                Item
              </th>
              <th className="px-1 py-1.5 text-left font-semibold text-muted-foreground">Un.</th>
              {dates.map((d) => (
                <th key={d} className="min-w-[74px] px-1 py-1.5 text-center font-mono font-bold">
                  {fmtCol(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-clinical-neutral/10">
              <td colSpan={dates.length + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Sinais vitais · Bristol · Balanço hídrico
              </td>
            </tr>
            {VITAL_ROWS.map((row) => (
              <tr key={String(row.key)} className="border-t border-border/60">
                <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">{row.label}</td>
                <td className="px-1 py-1 text-[10px] text-muted-foreground">{row.unit}</td>
                {dates.map((d) => (
                  <td key={d} className="px-1 py-1">
                    <input
                      type="number"
                      step={row.step ?? "1"}
                      className={cellCls}
                      value={getVital(row.key, d)}
                      onChange={(e) => setVital(row.key, d, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="bg-clinical-neutral/10">
              <td colSpan={dates.length + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Exames laboratoriais
              </td>
            </tr>
            {exams.length === 0 && (
              <tr>
                <td colSpan={dates.length + 2} className="px-2 py-2 text-[11px] italic text-muted-foreground">
                  Nenhum exame cadastrado — adicione exames na lista abaixo.
                </td>
              </tr>
            )}
            {exams.map((e, i) => {
              const map = examPoints(e);
              return (
                <tr key={`${e.code ?? e.label}-${i}`} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">{e.label}</td>
                  <td className="px-1 py-1 text-[10px] text-muted-foreground">{e.unit ?? ""}</td>
                  {dates.map((d) => (
                    <td key={d} className="px-1 py-1">
                      <input
                        type="number"
                        step="any"
                        className={cellCls}
                        value={map.get(d) ?? ""}
                        onChange={(ev) => setExam(i, d, ev.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
