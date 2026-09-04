import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type FisherSah = "none" | "thin" | "thick";
export type FisherYN = "no" | "yes";

export type FisherRecord = {
  sah?: FisherSah;
  ivh?: FisherYN;
  /** @deprecated mantido para compatibilidade com registros antigos (Fisher clássica). */
  iph?: string;
  grade?: number | null;
  at?: string;
};

export const FISHER_DESCRIPTION: Record<number, string> = {
  0: "Sem hemorragia subaracnoidea e sem hemorragia intraventricular.",
  1: "Hemorragia subaracnoidea fina (< 1 mm), sem hemorragia intraventricular.",
  2: "Hemorragia subaracnoidea fina (< 1 mm), com hemorragia intraventricular.",
  3: "Hemorragia subaracnoidea espessa (≥ 1 mm), sem hemorragia intraventricular.",
  4: "Hemorragia subaracnoidea espessa (≥ 1 mm), com hemorragia intraventricular.",
};

export const FISHER_TABLE: { g: number; sah: string; ivh: string }[] = [
  { g: 0, sah: "Ausente", ivh: "Não" },
  { g: 1, sah: "Fina < 1 mm", ivh: "Não" },
  { g: 2, sah: "Fina < 1 mm", ivh: "Sim" },
  { g: 3, sah: "Espessa ≥ 1 mm", ivh: "Não" },
  { g: 4, sah: "Espessa ≥ 1 mm", ivh: "Sim" },
];

const SAH_POINTS: Record<FisherSah, number> = { none: 0, thin: 1, thick: 2 };
const SAH_LABEL: Record<FisherSah, string> = { none: "Ausente", thin: "Fina (< 1 mm)", thick: "Espessa (≥ 1 mm)" };

/** Lógica pura da Escala de Fisher Modificada (0 a 4). */
export function computeFisher(r: FisherRecord | undefined): {
  grade: number | null;
  incomplete: boolean;
  sahPts: number;
  ivhPts: number;
} {
  const sah = r?.sah;
  const ivh = r?.ivh;
  if (!sah || !ivh) return { grade: null, incomplete: true, sahPts: 0, ivhPts: 0 };
  const sahPts = SAH_POINTS[sah];
  const ivhPts = ivh === "yes" ? 1 : 0;
  // HSA ausente com HIV isolada permanece no padrão da matriz de referência.
  const grade = sahPts === 0 ? (ivhPts === 1 ? 1 : 0) : sahPts === 1 ? (ivhPts ? 2 : 1) : ivhPts ? 4 : 3;
  return { grade, incomplete: false, sahPts, ivhPts };
}

const SAH_OPTS: { v: FisherSah; label: string; pts: string }[] = [
  { v: "none", label: "Ausente", pts: "0 pontos" },
  { v: "thin", label: "HSA fina (< 1 mm)", pts: "1 ponto" },
  { v: "thick", label: "HSA espessa (≥ 1 mm)", pts: "2 pontos" },
];

const YN_OPTS: { v: FisherYN; label: string; pts: string }[] = [
  { v: "no", label: "Não", pts: "0 pontos" },
  { v: "yes", label: "Sim", pts: "+1 ponto" },
];

// --------------------------------------------------------------- botão

export function FisherButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { fisher?: FisherRecord }).fisher;
  const { grade } = useMemo(() => computeFisher(rec), [rec]);
  const cls = grade != null
    ? grade >= 3
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Escala de Fisher Modificada para hemorragia subaracnoidea"
    >
      <span className="inline-flex items-center gap-1">
        <Brain className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> Fisher Mod.
        {grade != null && <span className="font-mono">{grade}/4</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {grade != null ? `HSA ${FISHER_TABLE[grade].sah} · HIV ${FISHER_TABLE[grade].ivh}` : "Não classificado"}
      </span>
    </button>
  );
}

// --------------------------------------------------------------- UI helpers

function CtIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" aria-hidden="true">
      <circle cx="32" cy="32" r="28" className="fill-surface-2 stroke-border" strokeWidth="2" />
      <circle cx="32" cy="32" r="21" className="fill-none stroke-border" strokeWidth="1.5" />
      <path d="M22 26c4-6 16-6 20 0 3 5 1 12-4 15-4 2-8 2-12 0-5-3-7-10-4-15Z" className="fill-clinical-neuro/20 stroke-clinical-neuro" strokeWidth="1.5" />
      <path d="M28 30c2-2 6-2 8 0" className="fill-none stroke-clinical-neuro" strokeWidth="1.5" />
    </svg>
  );
}

function OptionCard<T extends string>({
  name, options, value, onChange,
}: { name: string; options: { v: T; label: string; pts: string }[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <label
          key={o.v}
          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border-2 px-3 py-3 text-[12px] transition-colors ${
            value === o.v ? "border-primary bg-primary/10 font-bold" : "border-border hover:bg-surface-3"
          }`}
        >
          <span className="flex items-center gap-2">
            <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} className="accent-current" />
            <span>{o.label}</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{o.pts}</span>
        </label>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- modal

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

  const { grade, incomplete, sahPts, ivhPts } = useMemo(() => computeFisher(draft), [draft]);

  const set = (key: keyof FisherRecord, v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    if (incomplete) return;
    onSave({ ...patient, fisher: { ...draft, grade, at: new Date().toISOString() } } as Patient);
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
            Calculadora Fisher Modificada — Hemorragia Subaracnoidea
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          <CtIcon />
          <span>
            Classificação radiológica baseada na TC de crânio sem contraste. Utilize como referência a maior espessura
            da camada de sangue subaracnoideo identificada no exame.
          </span>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1 · Hemorragia subaracnoidea (HSA)
            </div>
            <div className="mb-2 text-[12px] font-semibold">
              Qual é a quantidade/espessura da hemorragia subaracnoidea (HSA) na TC?
            </div>
            <OptionCard name="fisher-sah" options={SAH_OPTS} value={draft.sah} onChange={(v) => set("sah", v)} />
            <div className="mt-2 text-[11px] text-muted-foreground">
              Pontuação HSA: <span className="font-mono font-bold text-foreground">{draft.sah ? SAH_POINTS[draft.sah] : "—"}</span>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              2 · Hemorragia intraventricular (HIV)
            </div>
            <div className="mb-2 text-[12px] font-semibold">Existe hemorragia intraventricular (HIV)?</div>
            <OptionCard name="fisher-ivh" options={YN_OPTS} value={draft.ivh} onChange={(v) => set("ivh", v)} />
            <div className="mt-2 text-[11px] text-muted-foreground">
              Pontuação HIV: <span className="font-mono font-bold text-foreground">{draft.ivh ? (draft.ivh === "yes" ? 1 : 0) : "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular Fisher Modificada
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
            Classificação incompleta — informe a quantidade de HSA e a presença ou ausência de hemorragia intraventricular.
          </div>
        )}

        {showResult && grade != null && (
          <div className="rounded-lg border-2 border-border bg-surface p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fisher Modificada</div>
            <div className="font-mono text-4xl font-black text-foreground">{grade}/4</div>
            <div className="mx-auto mt-3 grid max-w-md gap-1 text-left text-[12px]">
              <div>
                <span className="font-semibold">HSA: </span>
                {draft.sah ? SAH_LABEL[draft.sah] : "—"} · Pontuação HSA:{" "}
                <span className="font-mono font-bold">{sahPts}</span>
              </div>
              <div>
                <span className="font-semibold">HIV: </span>
                {draft.ivh === "yes" ? "Presente" : "Ausente"} · Pontuação HIV:{" "}
                <span className="font-mono font-bold">{ivhPts}</span>
              </div>
              <div>
                <span className="font-semibold">Pontuação final: </span>
                <span className="font-mono font-bold">{grade}/4</span>
              </div>
              <div className="mt-1">
                <span className="font-semibold">Descrição: </span>{FISHER_DESCRIPTION[grade]}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Fisher Modificada</th>
                <th className="p-2 text-left">HSA</th>
                <th className="p-2 text-left">HIV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FISHER_TABLE.map((row) => (
                <tr key={row.g} className={grade === row.g && showResult ? "bg-primary/10 font-semibold" : ""}>
                  <td className="p-2 font-mono">{row.g}</td>
                  <td className="p-2">{row.sah}</td>
                  <td className="p-2">{row.ivh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-border bg-surface p-3 text-[11px] text-foreground">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Interpretação clínica
          </div>
          A Fisher Modificada é uma classificação radiológica da hemorragia subaracnoidea utilizada principalmente para
          estratificação do risco de vasoespasmo cerebral e isquemia cerebral tardia após HSA aneurismática. O grau
          isolado não deve ser transformado em diagnóstico, prognóstico individual definitivo ou indicação automática de
          tratamento.
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Ferramenta de apoio à avaliação clínica. A Fisher Modificada é uma classificação radiológica e deve ser
          aplicada a partir da interpretação adequada da TC de crânio. Não substitui avaliação médica especializada,
          interpretação radiológica ou protocolos institucionais.
        </div>
      </DialogContent>
    </Dialog>
  );
}
