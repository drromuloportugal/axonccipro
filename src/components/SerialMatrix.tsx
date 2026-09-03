// Preenchimento seriado em forma de tabela: cada item é uma linha, cada data é uma coluna.
// Cobre sinais vitais, escala de Bristol, balanço hídrico, exames laboratoriais e gasometria arterial.

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

// Parâmetros pré-estabelecidos para inserção rápida de novos índices vitais.
const VITAL_PRESETS: { label: string; unit: string }[] = [
  { label: "PVC", unit: "cmH₂O" },
  { label: "PIA (pressão intra-abdominal)", unit: "mmHg" },
  { label: "Diurese", unit: "mL" },
  { label: "Diurese/kg/h", unit: "mL/kg/h" },
  { label: "Dor (EVA)", unit: "0–10" },
  { label: "RASS", unit: "-5 a +4" },
  { label: "Glasgow", unit: "3–15" },
  { label: "Pupila direita", unit: "mm" },
  { label: "Pupila esquerda", unit: "mm" },
  { label: "EtCO₂", unit: "mmHg" },
  { label: "FiO₂", unit: "%" },
  { label: "PEEP", unit: "cmH₂O" },
  { label: "Pressão de platô", unit: "cmH₂O" },
  { label: "Driving pressure", unit: "cmH₂O" },
  { label: "Volume corrente", unit: "mL" },
  { label: "Complacência estática", unit: "mL/cmH₂O" },
  { label: "Peso", unit: "kg" },
  { label: "Perímetro abdominal", unit: "cm" },
  { label: "Resíduo gástrico", unit: "mL" },
  { label: "Dieta ofertada", unit: "mL" },
  { label: "Braden", unit: "6–23" },
  { label: "Temperatura axilar", unit: "°C" },
];

// Parâmetros laboratoriais pré-estabelecidos.
const LAB_PRESETS: { label: string; unit: string }[] = [
  { label: "Hemoglobina", unit: "g/dL" },
  { label: "Hematócrito", unit: "%" },
  { label: "Leucócitos", unit: "/mm³" },
  { label: "Bastões", unit: "%" },
  { label: "Plaquetas", unit: "/mm³" },
  { label: "Ureia", unit: "mg/dL" },
  { label: "Creatinina", unit: "mg/dL" },
  { label: "Sódio", unit: "mEq/L" },
  { label: "Potássio", unit: "mEq/L" },
  { label: "Cloro", unit: "mEq/L" },
  { label: "Cálcio total", unit: "mg/dL" },
  { label: "Cálcio iônico", unit: "mmol/L" },
  { label: "Magnésio", unit: "mg/dL" },
  { label: "Fósforo", unit: "mg/dL" },
  { label: "PCR", unit: "mg/L" },
  { label: "Procalcitonina", unit: "ng/mL" },
  { label: "Lactato", unit: "mmol/L" },
  { label: "Albumina", unit: "g/dL" },
  { label: "Proteínas totais", unit: "g/dL" },
  { label: "Bilirrubina total", unit: "mg/dL" },
  { label: "Bilirrubina direta", unit: "mg/dL" },
  { label: "TGO (AST)", unit: "U/L" },
  { label: "TGP (ALT)", unit: "U/L" },
  { label: "Fosfatase alcalina", unit: "U/L" },
  { label: "GGT", unit: "U/L" },
  { label: "Amilase", unit: "U/L" },
  { label: "Lipase", unit: "U/L" },
  { label: "CPK", unit: "U/L" },
  { label: "Troponina", unit: "ng/mL" },
  { label: "BNP", unit: "pg/mL" },
  { label: "INR", unit: "" },
  { label: "TAP (atividade)", unit: "%" },
  { label: "TTPa (relação)", unit: "" },
  { label: "Fibrinogênio", unit: "mg/dL" },
  { label: "D-dímero", unit: "µg/mL" },
  { label: "Glicemia laboratorial", unit: "mg/dL" },
  { label: "Triglicerídeos", unit: "mg/dL" },
  { label: "TSH", unit: "µUI/mL" },
  { label: "Vitamina D", unit: "ng/mL" },
  { label: "Ferritina", unit: "ng/mL" },
  { label: "Saturação venosa central (ScvO₂)", unit: "%" },
];

// Gasometria arterial — parâmetros fixos e pré-estabelecidos.
const GAS_ROWS: { code: string; label: string; unit: string; step: string; re: RegExp }[] = [
  { code: "PH", label: "pH", unit: "", step: "0.01", re: /^p?H$|^pH\b/i },
  { code: "PACO2", label: "PaCO₂", unit: "mmHg", step: "0.1", re: /PaCO2|PCO2|PaCO₂/i },
  { code: "PAO2", label: "PaO₂", unit: "mmHg", step: "1", re: /PaO2|^PO2$|PaO₂/i },
  { code: "HCO3", label: "HCO₃⁻", unit: "mEq/L", step: "0.1", re: /HCO3|HCO₃|bicarbon/i },
  { code: "BE", label: "Base excess (BE)", unit: "mEq/L", step: "0.1", re: /base excess|^BE$/i },
  { code: "SATO2A", label: "SatO₂ arterial", unit: "%", step: "1", re: /SatO2 arterial|SATO2A/i },
  { code: "GNA", label: "Na⁺ (gasometria)", unit: "mEq/L", step: "1", re: /^GNA$|Na⁺ \(gaso/i },
  { code: "GCL", label: "Cl⁻ (gasometria)", unit: "mEq/L", step: "1", re: /^GCL$|Cl⁻ \(gaso/i },
  { code: "GK", label: "K⁺ (gasometria)", unit: "mEq/L", step: "0.1", re: /^GK$|K⁺ \(gaso/i },
  { code: "GCA", label: "Cálcio iônico (gasometria)", unit: "mmol/L", step: "0.01", re: /^GCA$/i },
  { code: "GLAC", label: "Lactato arterial", unit: "mmol/L", step: "0.1", re: /^GLAC$|Lactato arterial/i },
  { code: "GGLU", label: "Glicose (gasometria)", unit: "mg/dL", step: "1", re: /^GGLU$/i },
  { code: "GHB", label: "Hemoglobina (gasometria)", unit: "g/dL", step: "0.1", re: /^GHB$/i },
  { code: "GFIO2", label: "FiO₂ (gasometria)", unit: "%", step: "1", re: /^GFIO2$/i },
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
  const custom = patient.state.customSeries ?? [];
  const exams = patient.exams ?? [];
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newVital, setNewVital] = useState({ label: "", unit: "" });
  const [newExam, setNewExam] = useState({ label: "", unit: "" });

  const isGasExam = (e: ExamRow) =>
    GAS_ROWS.some((g) => g.code === (e.code ?? "").toUpperCase() || g.re.test(e.label ?? ""));

  const dates = useMemo(() => {
    const set = new Set<string>(extraDates);
    for (const row of VITAL_ROWS) {
      for (const r of series[row.key] ?? []) if (r.at) set.add(dayKey(r.at));
    }
    for (const c of custom) {
      for (const r of c.readings ?? []) if (r.at) set.add(dayKey(r.at));
    }
    for (const e of exams) {
      if (e.takenAt) set.add(dayKey(e.takenAt));
      for (const h of e.history ?? []) if (h.takenAt) set.add(dayKey(h.takenAt));
    }
    if (set.size === 0) set.add(new Date().toISOString().slice(0, 10));
    return Array.from(set).filter(Boolean).sort();
  }, [series, custom, exams, extraDates]);

  const setCustom = (id: string, date: string, field: MinMax, raw: string) => {
    const value = parseNum(raw);
    const next = custom.map((c) => {
      if (c.id !== id) return c;
      const arr = [...(c.readings ?? [])];
      const idx = arr.findIndex((r) => dayKey(r.at) === date);
      const patch = field === "max" ? { value } : { min: value ?? undefined };
      if (idx >= 0) {
        const merged = { ...arr[idx], ...patch, at: arr[idx].at ?? atFor(date) } as VitalReading;
        if (merged.value == null && merged.min == null) arr.splice(idx, 1);
        else arr[idx] = merged;
      } else if (value != null) {
        arr.push({ id: uid(), at: atFor(date), ...patch } as VitalReading);
      }
      arr.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      return { ...c, readings: arr };
    });
    onChangeState("customSeries", next);
  };

  const addCustom = () => {
    const label = newVital.label.trim();
    if (!label) return;
    const preset = VITAL_PRESETS.find((p) => p.label === label);
    onChangeState("customSeries", [
      ...custom,
      { id: uid(), label, unit: newVital.unit.trim() || preset?.unit || undefined, readings: [] },
    ]);
    setNewVital({ label: "", unit: "" });
  };

  const removeCustom = (id: string) =>
    onChangeState("customSeries", custom.filter((c) => c.id !== id));

  const addExam = () => {
    const label = newExam.label.trim();
    if (!label) return;
    const preset = LAB_PRESETS.find((p) => p.label === label);
    onChangeExams([
      ...exams,
      {
        label,
        value: "",
        unit: newExam.unit.trim() || preset?.unit || undefined,
        trend: "flat",
        history: [],
      },
    ]);
    setNewExam({ label: "", unit: "" });
  };

  const removeExam = (e: ExamRow) => onChangeExams(exams.filter((x) => x !== e));

  const setVital = (key: SeriesKey, date: string, field: MinMax, raw: string) => {
    const value = parseNum(raw);
    const arr = [...(series[key] ?? [])];
    const idx = arr.findIndex((r) => dayKey(r.at) === date);
    const patch = field === "max" ? { value } : { min: value ?? undefined };
    if (idx >= 0) {
      const merged = { ...arr[idx], ...patch, at: arr[idx].at ?? atFor(date) } as VitalReading;
      if (merged.value == null && merged.min == null) arr.splice(idx, 1);
      else arr[idx] = merged;
    } else if (value != null) {
      arr.push({ id: uid(), at: atFor(date), ...patch } as VitalReading);
    }
    arr.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
    onChangeState("vitalSeries", { ...series, [key]: arr });
  };

  const getVital = (key: SeriesKey, date: string, field: MinMax) => {
    const r = (series[key] ?? []).find((x) => dayKey(x.at) === date);
    const v = field === "max" ? r?.value : r?.min;
    return v ?? "";
  };

  const examPoints = (e: ExamRow) => {
    const map = new Map<string, number>();
    for (const h of e.history ?? []) if (h.takenAt && typeof h.value === "number") map.set(dayKey(h.takenAt), h.value);
    const legacy = e.valueNum ?? parseNum(e.value);
    if (e.takenAt && legacy != null) map.set(dayKey(e.takenAt), legacy);
    return map;
  };

  // Escreve um ponto datado em uma linha de exame, devolvendo a linha atualizada.
  const writeExam = (e: ExamRow, date: string, raw: string): ExamRow => {
    const map = examPoints(e);
    const value = parseNum(raw);
    if (value == null) map.delete(date);
    else map.set(date, value);
    const points = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ takenAt: atFor(d), value: v }));
    const last = points[points.length - 1];
    return {
      ...e,
      history: points,
      value: last ? String(last.value) : "",
      valueNum: last?.value,
      takenAt: last?.takenAt,
    };
  };

  const setExam = (target: ExamRow, date: string, raw: string) =>
    onChangeExams(exams.map((x) => (x === target ? writeExam(x, date, raw) : x)));

  const findGas = (g: (typeof GAS_ROWS)[number]) =>
    exams.find((e) => (e.code ?? "").toUpperCase() === g.code || g.re.test(e.label ?? ""));

  const setGas = (g: (typeof GAS_ROWS)[number], date: string, raw: string) => {
    const existing = findGas(g);
    if (existing) {
      setExam(existing, date, raw);
      return;
    }
    if (parseNum(raw) == null) return;
    const created: ExamRow = {
      label: g.label,
      code: g.code,
      unit: g.unit || undefined,
      value: "",
      trend: "flat",
      history: [],
    };
    onChangeExams([...exams, writeExam(created, date, raw)]);
  };

  const addDate = () => {
    if (!newDate) return;
    setExtraDates((prev) => (prev.includes(newDate) ? prev : [...prev, newDate]));
    setNewDate("");
  };

  const labExams = exams.filter((e) => !isGasExam(e));

  return (
    <div className="space-y-2">
      <datalist id="vital-presets">
        {VITAL_PRESETS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.unit}
          </option>
        ))}
      </datalist>
      <datalist id="lab-presets">
        {LAB_PRESETS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.unit}
          </option>
        ))}
      </datalist>

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
              <td colSpan={dates.length * 2 + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Sinais vitais · Bristol · Balanço hídrico
              </td>
            </tr>
            {VITAL_ROWS.map((row) => (
              <tr key={String(row.key)} className="border-t border-border/60">
                <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">{row.label}</td>
                <td className="px-1 py-1 text-[10px] text-muted-foreground">{row.unit}</td>
                {dates.map((d) => (
                  <Fragment key={d}>
                    <td className="border-l border-border/60 px-1 py-1">
                      <input
                        type="number"
                        step={row.step ?? "1"}
                        className={cellCls}
                        title="Valor máximo"
                        value={getVital(row.key, d, "max")}
                        onChange={(e) => setVital(row.key, d, "max", e.target.value)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step={row.step ?? "1"}
                        className={cellCls}
                        title="Valor mínimo"
                        value={getVital(row.key, d, "min")}
                        onChange={(e) => setVital(row.key, d, "min", e.target.value)}
                      />
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
            {custom.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">
                  <span className="flex items-center gap-1">
                    {c.label}
                    <button
                      type="button"
                      onClick={() => removeCustom(c.id)}
                      className="text-[10px] text-muted-foreground hover:text-clinical-critical"
                      title="Remover índice"
                    >
                      Remover
                    </button>
                  </span>
                </td>
                <td className="px-1 py-1 text-[10px] text-muted-foreground">{c.unit ?? ""}</td>
                {dates.map((d) => {
                  const r = (c.readings ?? []).find((x) => dayKey(x.at) === d);
                  return (
                    <Fragment key={d}>
                      <td className="border-l border-border/60 px-1 py-1">
                        <input
                          type="number"
                          step="any"
                          className={cellCls}
                          title="Valor máximo"
                          value={r?.value ?? ""}
                          onChange={(e) => setCustom(c.id, d, "max", e.target.value)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          step="any"
                          className={cellCls}
                          title="Valor mínimo"
                          value={r?.min ?? ""}
                          onChange={(e) => setCustom(c.id, d, "min", e.target.value)}
                        />
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-border/60">
              <td colSpan={dates.length * 2 + 2} className="px-2 py-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <select
                    className="h-7 w-48 rounded border border-border bg-background px-1 text-[11px]"
                    value=""
                    onChange={(e) => {
                      const p = VITAL_PRESETS.find((x) => x.label === e.target.value);
                      if (p) setNewVital({ label: p.label, unit: p.unit });
                    }}
                  >
                    <option value="">Parâmetros vitais disponíveis…</option>
                    {VITAL_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                        {p.unit ? ` (${p.unit})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    list="vital-presets"
                    className="h-7 w-40 rounded border border-border bg-background px-2 text-[11px]"
                    placeholder="Novo índice vital"
                    value={newVital.label}
                    onChange={(e) => setNewVital((s) => ({ ...s, label: e.target.value }))}
                  />
                  <input
                    className="h-7 w-20 rounded border border-border bg-background px-2 text-[11px]"
                    placeholder="Unidade"
                    value={newVital.unit}
                    onChange={(e) => setNewVital((s) => ({ ...s, unit: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={addCustom}
                    className="h-7 rounded border border-border bg-surface px-2 text-[11px] font-semibold hover:bg-surface-3"
                  >
                    + Adicionar índice
                  </button>
                </span>
              </td>
            </tr>

            <tr className="bg-clinical-neutral/10">
              <td colSpan={dates.length * 2 + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Exames laboratoriais
              </td>
            </tr>
            {labExams.length === 0 && (
              <tr>
                <td colSpan={dates.length * 2 + 2} className="px-2 py-2 text-[11px] italic text-muted-foreground">
                  Nenhum exame cadastrado — selecione um parâmetro abaixo.
                </td>
              </tr>
            )}
            {labExams.map((e, i) => {
              const map = examPoints(e);
              return (
                <tr key={`${e.code ?? e.label}-${i}`} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">
                    <span className="flex items-center gap-1">
                      {e.label}
                      <button
                        type="button"
                        onClick={() => removeExam(e)}
                        className="text-[10px] text-muted-foreground hover:text-clinical-critical"
                        title="Remover exame"
                      >
                        Remover
                      </button>
                    </span>
                  </td>
                  <td className="px-1 py-1 text-[10px] text-muted-foreground">{e.unit ?? ""}</td>
                  {dates.map((d) => (
                    <td key={d} colSpan={2} className="px-1 py-1">
                      <input
                        type="number"
                        step="any"
                        className={cellCls}
                        value={map.get(d) ?? ""}
                        onChange={(ev) => setExam(e, d, ev.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="border-t border-border/60">
              <td colSpan={dates.length * 2 + 2} className="px-2 py-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <select
                    className="h-7 w-52 rounded border border-border bg-background px-1 text-[11px]"
                    value=""
                    onChange={(e) => {
                      const p = LAB_PRESETS.find((x) => x.label === e.target.value);
                      if (p) setNewExam({ label: p.label, unit: p.unit });
                    }}
                  >
                    <option value="">Exames laboratoriais disponíveis…</option>
                    {LAB_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                        {p.unit ? ` (${p.unit})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    list="lab-presets"
                    className="h-7 w-44 rounded border border-border bg-background px-2 text-[11px]"
                    placeholder="Novo exame laboratorial"
                    value={newExam.label}
                    onChange={(e) => setNewExam((s) => ({ ...s, label: e.target.value }))}
                  />
                  <input
                    className="h-7 w-20 rounded border border-border bg-background px-2 text-[11px]"
                    placeholder="Unidade"
                    value={newExam.unit}
                    onChange={(e) => setNewExam((s) => ({ ...s, unit: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={addExam}
                    className="h-7 rounded border border-border bg-surface px-2 text-[11px] font-semibold hover:bg-surface-3"
                  >
                    + Adicionar exame
                  </button>
                </span>
              </td>
            </tr>

            <tr className="bg-clinical-neutral/10">
              <td colSpan={dates.length * 2 + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Gasometria arterial
              </td>
            </tr>
            {GAS_ROWS.map((g) => {
              const row = findGas(g);
              const map = row ? examPoints(row) : new Map<string, number>();
              return (
                <tr key={g.code} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-semibold">{g.label}</td>
                  <td className="px-1 py-1 text-[10px] text-muted-foreground">{g.unit}</td>
                  {dates.map((d) => (
                    <td key={d} colSpan={2} className="px-1 py-1">
                      <input
                        type="number"
                        step={g.step}
                        className={cellCls}
                        value={map.get(d) ?? ""}
                        onChange={(ev) => setGas(g, d, ev.target.value)}
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
