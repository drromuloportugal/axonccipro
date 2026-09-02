import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type FisherSah = "none" | "thin" | "thick" | "unable";
export type FisherYN = "no" | "yes" | "unknown";

export type FisherRecord = {
  sah?: FisherSah;
  ivh?: FisherYN;
  iph?: FisherYN;
  grade?: number | null;
  at?: string;
};

export const FISHER_DESCRIPTION: Record<number, string> = {
  1: "Sem sangue subaracnoideo detectável na TC de crânio.",
  2: "Hemorragia subaracnoidea difusa ou em camada fina, com espessura menor que 1 mm.",
  3: "Coágulo localizado e/ou camada de sangue subaracnoideo espessa, com espessura maior ou igual a 1 mm.",
  4: "Hemorragia intraventricular ou intraparenquimatosa, com ou sem sangue subaracnoideo difuso.",
};

export const FISHER_TABLE: { g: number; t: string }[] = [
  { g: 1, t: "Sem sangue subaracnoideo" },
  { g: 2, t: "HSA fina/difusa < 1 mm" },
  { g: 3, t: "Coágulo ou HSA espessa ≥ 1 mm" },
  { g: 4, t: "Hemorragia intraventricular ou intraparenquimatosa" },
];

/** Lógica pura da Escala de Fisher clássica. */
export function computeFisher(r: FisherRecord | undefined): { grade: number | null; incomplete: boolean } {
  const sah = r?.sah;
  const ivh = r?.ivh;
  const iph = r?.iph;
  if (!sah || !ivh || !iph) return { grade: null, incomplete: true };
  if (ivh === "yes" || iph === "yes") return { grade: 4, incomplete: false };
  if (sah === "unable" || ivh === "unknown" || iph === "unknown") return { grade: null, incomplete: true };
  if (sah === "none") return { grade: 1, incomplete: false };
  if (sah === "thin") return { grade: 2, incomplete: false };
  return { grade: 3, incomplete: false };
}

const SAH_OPTS: { v: FisherSah; label: string }[] = [
  { v: "none", label: "Nenhum sangue subaracnoideo visível" },
  { v: "thin", label: "HSA difusa ou em camada fina (< 1 mm)" },
  { v: "thick", label: "Coágulo ou HSA espessa (≥ 1 mm)" },
  { v: "unable", label: "Não é possível avaliar" },
];

const YN_OPTS: { v: FisherYN; label: string }[] = [
  { v: "no", label: "Não" },
  { v: "yes", label: "Sim" },
  { v: "unknown", label: "Não informado" },
];

// --------------------------------------------------------------- botão

export function FisherButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { fisher?: FisherRecord }).fisher;
  const { grade } = useMemo(() => computeFisher(rec), [rec]);
  const cls = grade
    ? grade >= 3
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Escala de Fisher clássica para hemorragia subaracnoidea"
    >
      <span className="inline-flex items-center gap-1">
        <Brain className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> Fisher
        {grade !== null && <span className="font-mono">Grau {grade}</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {grade !== null ? FISHER_TABLE[grade - 1].t : "Não classificado"}
      </span>
    </button>
  );
}

// --------------------------------------------------------------- modal

function RadioGroupField<T extends string>({
  name, options, value, onChange,
}: { name: string; options: { v: T; label: string }[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.v}
          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
            value === o.v ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-surface-3"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
            className="accent-current"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function FisherModal({
  open, onClose, patient, onSave,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSave: (p: Patient) => void;
}) {
  const saved = (patient as Patient & { fisher?: FisherRecord }).fisher ?? {};
  const [draft, setDraft] = useState<FisherRecord>(saved);
  const [showResult, setShowResult] = useState<boolean>(saved.grade != null);

  const { grade, incomplete } = useMemo(() => computeFisher(draft), [draft]);

  const set = (patchKey: keyof FisherRecord, v: string) => {
    setDraft((d) => ({ ...d, [patchKey]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    const at = new Date().toISOString();
    onSave({ ...patient, fisher: { ...draft, grade, at } } as Patient);
  };

  const clear = () => {
    setDraft({});
    setShowResult(false);
    onSave({ ...patient, fisher: undefined } as Patient);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-clinical-neuro" />
            Calculadora — Escala de Fisher para Hemorragia Subaracnoidea
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          Esta calculadora utiliza a classificação de Fisher clássica (não é a Escala de Fisher Modificada).
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1 · Sangue subaracnoideo
            </div>
            <div className="mb-1 text-[12px] font-semibold">Qual é o achado de sangue subaracnoideo na TC?</div>
            <RadioGroupField name="fisher-sah" options={SAH_OPTS} value={draft.sah} onChange={(v) => set("sah", v)} />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              2 · Hemorragia intraventricular
            </div>
            <div className="mb-1 text-[12px] font-semibold">Existe hemorragia intraventricular (HIV)?</div>
            <RadioGroupField name="fisher-ivh" options={YN_OPTS} value={draft.ivh} onChange={(v) => set("ivh", v)} />
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              3 · Hemorragia intraparenquimatosa
            </div>
            <div className="mb-1 text-[12px] font-semibold">Existe hemorragia intraparenquimatosa?</div>
            <RadioGroupField name="fisher-iph" options={YN_OPTS} value={draft.iph} onChange={(v) => set("iph", v)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular Fisher
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>

        {showResult && incomplete && (
          <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
            <AlertTriangle className="h-4 w-4" />
            Classificação incompleta — selecione todos os achados necessários da TC.
          </div>
        )}

        {showResult && grade !== null && (
          <div className="rounded-md border-2 border-border bg-surface p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Escore de Fisher</div>
            <div className="font-mono text-4xl font-black text-foreground">{grade}</div>
            <div className="mx-auto mt-2 max-w-md text-[12px] text-foreground">
              <span className="font-semibold">Descrição: </span>{FISHER_DESCRIPTION[grade]}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-2 text-left">Grau</th><th className="p-2 text-left">Achado na TC</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FISHER_TABLE.map((row) => (
                <tr key={row.g} className={grade === row.g && showResult ? "bg-primary/10 font-semibold" : ""}>
                  <td className="p-2 font-mono">{row.g}</td>
                  <td className="p-2">{row.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Ferramenta de apoio à avaliação clínica. A classificação deve ser realizada com base na interpretação adequada
          da TC de crânio e não substitui avaliação médica especializada.
        </div>
      </DialogContent>
    </Dialog>
  );
}
