import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type HHConsciousness = "alert" | "drowsy" | "confused" | "stupor" | "coma";
export type HHHeadache = "none" | "moderate" | "severe";
export type HHNeck = "absent" | "mild" | "marked";
export type HHFocal = "absent" | "mild" | "moderate";
export type HHYN = "no" | "yes";

export type HuntHessRecord = {
  consciousness?: HHConsciousness;
  headache?: HHHeadache;
  neck?: HHNeck;
  focal?: HHFocal;
  cranialNerve?: HHYN;
  vegetative?: HHYN;
  decerebrate?: HHYN;
  grade?: number | null;
  at?: string;
};

export const HH_DESCRIPTION: Record<number, string> = {
  1: "Assintomático ou cefaleia leve, com rigidez de nuca discreta.",
  2: "Cefaleia moderada a intensa e rigidez de nuca, sem déficit neurológico significativo, exceto possível paralisia de nervo craniano.",
  3: "Sonolência, confusão mental e/ou déficit neurológico focal leve.",
  4: "Estupor, déficit motor moderado a grave, podendo apresentar distúrbio vegetativo.",
  5: "Coma profundo, postura de descerebração e aparência moribunda.",
};

export const HH_TABLE: { g: number; r: string; t: string }[] = [
  { g: 1, r: "I", t: "Assintomático ou cefaleia leve + rigidez de nuca discreta" },
  { g: 2, r: "II", t: "Cefaleia moderada/intensa + rigidez de nuca, sem déficit significativo" },
  { g: 3, r: "III", t: "Sonolência/confusão e/ou déficit focal leve" },
  { g: 4, r: "IV", t: "Estupor e/ou déficit motor moderado/grave" },
  { g: 5, r: "V", t: "Coma profundo e/ou descerebração" },
];

/** Lógica pura da Escala de Hunt-Hess original — usa sempre o pior achado. */
export function computeHuntHess(r: HuntHessRecord | undefined): { grade: number | null; incomplete: boolean } {
  if (!r?.consciousness || !r.headache || !r.neck || !r.focal) return { grade: null, incomplete: true };

  let grade = 1;
  const bump = (g: number) => { if (g > grade) grade = g; };

  // Grau V
  if (r.consciousness === "coma" || r.decerebrate === "yes") bump(5);
  // Grau IV
  if (r.consciousness === "stupor" || r.focal === "moderate" || r.vegetative === "yes") bump(4);
  // Grau III
  if (r.consciousness === "drowsy" || r.consciousness === "confused" || r.focal === "mild") bump(3);
  // Grau II
  if (r.headache === "moderate" || r.headache === "severe" || r.neck === "marked" || r.cranialNerve === "yes") bump(2);

  return { grade, incomplete: false };
}

const CONS_OPTS: { v: HHConsciousness; label: string }[] = [
  { v: "alert", label: "Normal / alerta" },
  { v: "drowsy", label: "Sonolento" },
  { v: "confused", label: "Confuso" },
  { v: "stupor", label: "Estupor" },
  { v: "coma", label: "Coma profundo" },
];
const HEAD_OPTS: { v: HHHeadache; label: string }[] = [
  { v: "none", label: "Ausente ou leve" },
  { v: "moderate", label: "Moderada" },
  { v: "severe", label: "Intensa" },
];
const NECK_OPTS: { v: HHNeck; label: string }[] = [
  { v: "absent", label: "Ausente" },
  { v: "mild", label: "Discreta" },
  { v: "marked", label: "Presente / importante" },
];
const FOCAL_OPTS: { v: HHFocal; label: string }[] = [
  { v: "absent", label: "Ausente" },
  { v: "mild", label: "Déficit focal leve" },
  { v: "moderate", label: "Déficit focal moderado/grave" },
];
const YN_OPTS: { v: HHYN; label: string }[] = [
  { v: "no", label: "Ausente" },
  { v: "yes", label: "Presente" },
];

export function HuntHessButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { huntHess?: HuntHessRecord }).huntHess;
  const { grade } = useMemo(() => computeHuntHess(rec), [rec]);
  const cls = grade
    ? grade >= 4
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Escala de Hunt-Hess para hemorragia subaracnoidea"
    >
      <span className="inline-flex items-center gap-1">
        <Activity className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> Hunt-Hess
        {grade != null && <span className="font-mono">Grau {HH_TABLE[grade - 1].r}</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {grade != null ? HH_TABLE[grade - 1].t : "Não classificado"}
      </span>
    </button>
  );
}

function RadioField<T extends string>({
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
          <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} className="accent-current" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function Section({ n, title, question, children }: { n: string; title: string; question?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{n} · {title}</div>
      {question && <div className="mb-1 text-[12px] font-semibold">{question}</div>}
      {children}
    </div>
  );
}

export function HuntHessModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const saved = (patient as Patient & { huntHess?: HuntHessRecord }).huntHess ?? {};
  const [draft, setDraft] = useState<HuntHessRecord>(saved);
  const [showResult, setShowResult] = useState<boolean>(saved.grade != null);

  const { grade, incomplete } = useMemo(() => computeHuntHess(draft), [draft]);

  const set = (k: keyof HuntHessRecord, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    onSave({ ...patient, huntHess: { ...draft, grade, at: new Date().toISOString() } } as Patient);
  };
  const clear = () => {
    setDraft({});
    setShowResult(false);
    onSave({ ...patient, huntHess: undefined } as Patient);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-clinical-neuro" />
            Calculadora — Escala de Hunt-Hess para Hemorragia Subaracnoidea
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          Esta calculadora utiliza a Escala de Hunt-Hess original. Não confundir com a World Federation of Neurosurgical
          Societies (WFNS).
        </div>

        <div className="space-y-3">
          <Section n="1" title="Nível de consciência" question="Qual é o nível de consciência do paciente?">
            <RadioField name="hh-cons" options={CONS_OPTS} value={draft.consciousness} onChange={(v) => set("consciousness", v)} />
          </Section>
          <Section n="2" title="Cefaleia">
            <RadioField name="hh-head" options={HEAD_OPTS} value={draft.headache} onChange={(v) => set("headache", v)} />
          </Section>
          <Section n="3" title="Rigidez de nuca">
            <RadioField name="hh-neck" options={NECK_OPTS} value={draft.neck} onChange={(v) => set("neck", v)} />
          </Section>
          <Section n="4" title="Déficit neurológico focal">
            <RadioField name="hh-focal" options={FOCAL_OPTS} value={draft.focal} onChange={(v) => set("focal", v)} />
          </Section>
          <Section n="5" title="Paralisia de nervo craniano">
            <RadioField name="hh-cn" options={YN_OPTS} value={draft.cranialNerve} onChange={(v) => set("cranialNerve", v)} />
          </Section>
          <Section n="6" title="Distúrbio vegetativo">
            <RadioField name="hh-veg" options={YN_OPTS} value={draft.vegetative} onChange={(v) => set("vegetative", v)} />
          </Section>
          <Section n="7" title="Postura de descerebração">
            <RadioField name="hh-dec" options={YN_OPTS} value={draft.decerebrate} onChange={(v) => set("decerebrate", v)} />
          </Section>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular Hunt-Hess
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
            Avaliação incompleta — preencha os achados clínicos necessários para determinar o grau Hunt-Hess.
          </div>
        )}

        {showResult && grade != null && (
          <div className="rounded-md border-2 border-border bg-surface p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hunt-Hess</div>
            <div className="font-mono text-4xl font-black text-foreground">GRAU {HH_TABLE[grade - 1].r}</div>
            <div className="mx-auto mt-2 max-w-md text-[12px] text-foreground">
              <span className="font-semibold">Classificação clínica: </span>{HH_DESCRIPTION[grade]}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-2 text-left">Grau</th><th className="p-2 text-left">Características clínicas</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {HH_TABLE.map((row) => (
                <tr key={row.g} className={grade === row.g && showResult ? "bg-primary/10 font-semibold" : ""}>
                  <td className="p-2 font-mono">{row.r}</td>
                  <td className="p-2">{row.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          A Escala de Hunt-Hess é uma classificação clínica utilizada para graduar a gravidade da hemorragia
          subaracnoidea aneurismática. A avaliação deve ser realizada por profissional habilitado e não substitui
          julgamento clínico, exame neurológico completo ou protocolos institucionais.
        </div>
      </DialogContent>
    </Dialog>
  );
}
