// Parecer técnico resumido de gasometria arterial (coluna 6).
// Extrai os valores dos exames do paciente e aplica a calculadora pura.

import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { computeAbg, type AbgCourse } from "@/lib/bloodgas";

function num(s?: string): number | undefined {
  if (s == null) return undefined;
  const n = parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function pick(patient: Patient, re: RegExp): number | undefined {
  const e = patient.exams.find((x) => re.test(x.code ?? "") || re.test(x.label ?? ""));
  if (!e) return undefined;
  return e.valueNum ?? num(e.value);
}

const TONE: Record<string, string> = {
  normal: "text-clinical-stable",
  attention: "text-clinical-attention",
  critical: "text-clinical-critical",
};

export function BloodGasPanel({ patient }: { patient: Patient }) {
  const [course, setCourse] = useState<AbgCourse>("undefined");
  const [open, setOpen] = useState(false);


  const input = useMemo(() => ({
    ph: pick(patient, /^p?H$|^pH\b/i),
    paco2: pick(patient, /PaCO2|PCO2/i),
    hco3: pick(patient, /HCO3|bicarbon/i),
    na: pick(patient, /^Na\+?$|S[óo]dio/i),
    cl: pick(patient, /^Cl-?$|Cloro/i),
    albumin: pick(patient, /albumin/i),
    pao2: pick(patient, /PaO2|^PO2$/i),
    fio2: patient.state?.fio2,
    lactate: pick(patient, /lactat/i),
    course,
  }), [patient, course]);

  const r = useMemo(() => computeAbg(input), [input]);

  return (
    <div className="mt-2 rounded border-2 border-foreground/70 bg-surface px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-clinical-resp"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Parecer técnico da gasometria
        </button>
        {open && (
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value as AbgCourse)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-border bg-card px-1 py-0.5 text-[9.5px] font-semibold text-foreground"
          >
            <option value="undefined">Curso indefinido</option>
            <option value="acute">Agudo</option>
            <option value="chronic">Crônico</option>
          </select>
        )}
      </div>

      {open && (
      <div className="mt-1">


      {!r.complete && (
        <div className="mb-1 rounded border border-dashed border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
          Dados faltantes para interpretação completa: {r.missing.join(", ")}.
        </div>
      )}

      <ul className="space-y-1 text-[11px] leading-snug">
        <li>
          <span className="font-semibold text-muted-foreground">Situação do pH: </span>
          <span className={`font-bold ${TONE[r.phTone]}`}>{r.phStatus}</span>
        </li>
        <li>
          <span className="font-semibold text-muted-foreground">Distúrbio primário: </span>
          <span className="font-bold text-foreground">{r.primary}</span>
        </li>
        {r.compensation && (
          <li>
            <span className="font-semibold text-muted-foreground">Compensação: </span>
            <span className="text-foreground">
              {r.compensation.expected}. {r.compensation.measured}. {r.compensation.verdict}
            </span>
          </li>
        )}
        {r.mixed && (
          <li className="font-bold text-clinical-attention">Possível distúrbio misto.</li>
        )}
        {r.anionGap != null && (
          <li>
            <span className="font-semibold text-muted-foreground">Ânion gap: </span>
            <span className="font-mono font-bold text-foreground">{r.anionGap} mEq/L</span>
            <span className="text-foreground"> — {r.anionGapClass}</span>
          </li>
        )}
        {r.anionGapCorrected != null && (
          <li>
            <span className="font-semibold text-muted-foreground">AG corrigido pela albumina: </span>
            <span className="font-mono font-bold text-foreground">{r.anionGapCorrected} mEq/L</span>
          </li>
        )}
        {r.pfRatio != null && (
          <li>
            <span className="font-semibold text-muted-foreground">Relação P/F: </span>
            <span className="font-mono font-bold text-foreground">{r.pfRatio}</span>
            <span className="text-foreground"> — {r.pfClass}</span>
          </li>
        )}
        {r.extras.map((x) => (
          <li key={x.label}>
            <span className="font-semibold text-muted-foreground">{x.label}: </span>
            <span className={`font-mono font-bold ${x.tone ? TONE[x.tone] : "text-foreground"}`}>{x.value}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}
