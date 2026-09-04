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

export type ClassicFisherFinding =
  | "none"
  | "diffuse_thin"
  | "localized_clot"
  | "thick"
  | "ivh_or_ich";

export type ClassicFisherRecord = {
  finding?: ClassicFisherFinding;
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

export const CLASSIC_FISHER_DESCRIPTION: Record<number, string> = {
  1: "Ausência de hemorragia subaracnoidea detectada na TC.",
  2: "Hemorragia subaracnoidea difusa e fina (< 1 mm de espessura).",
  3: "Coágulos localizados ou camada espessa de hemorragia subaracnoidea (≥ 1 mm).",
  4: "Sangue intraventricular ou intracerebral, com pouca ou nenhuma hemorragia subaracnoidea livre.",
};

export const FISHER_TABLE: { g: number; sah: string; ivh: string }[] = [
  { g: 0, sah: "Ausente", ivh: "Não" },
  { g: 1, sah: "Fina < 1 mm", ivh: "Não" },
  { g: 2, sah: "Fina < 1 mm", ivh: "Sim" },
  { g: 3, sah: "Espessa ≥ 1 mm", ivh: "Não" },
  { g: 4, sah: "Espessa ≥ 1 mm", ivh: "Sim" },
];

export const CLASSIC_FISHER_TABLE: { g: number; finding: string }[] = [
  { g: 1, finding: "Nenhuma hemorragia subaracnoidea" },
  { g: 2, finding: "Hemorragia subaracnoidea difusa e fina (< 1 mm)" },
  { g: 3, finding: "Coágulos localizados ou camada espessa (≥ 1 mm)" },
  { g: 4, finding: "Sangue intraventricular ou intracerebral" },
];

const SAH_POINTS: Record<FisherSah, number> = { none: 0, thin: 1, thick: 2 };
const SAH_LABEL: Record<FisherSah, string> = { none: "Ausente", thin: "Fina (< 1 mm)", thick: "Espessa (≥ 1 mm)" };

const CLASSIC_FISHER_POINTS: Record<ClassicFisherFinding, number> = {
  none: 1,
  diffuse_thin: 2,
  localized_clot: 3,
  thick: 3,
  ivh_or_ich: 4,
};

const CLASSIC_FISHER_LABEL: Record<ClassicFisherFinding, string> = {
  none: "Nenhuma hemorragia subaracnoidea",
  diffuse_thin: "HSA difusa e fina (< 1 mm)",
  localized_clot: "Coágulos localizados",
  thick: "Camada espessa (≥ 1 mm)",
  ivh_or_ich: "Sangue intraventricular/intracerebral",
};

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

/** Lógica pura da Escala de Fisher Clássica (1 a 4). */
export function computeClassicFisher(r: ClassicFisherRecord | undefined): {
  grade: number | null;
  incomplete: boolean;
} {
  const finding = r?.finding;
  if (!finding) return { grade: null, incomplete: true };
  return { grade: CLASSIC_FISHER_POINTS[finding], incomplete: false };
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

const CLASSIC_OPTS: { v: ClassicFisherFinding; label: string; grade: string }[] = [
  { v: "none", label: CLASSIC_FISHER_LABEL.none, grade: "Grau 1" },
  { v: "diffuse_thin", label: CLASSIC_FISHER_LABEL.diffuse_thin, grade: "Grau 2" },
  { v: "localized_clot", label: CLASSIC_FISHER_LABEL.localized_clot, grade: "Grau 3" },
  { v: "thick", label: CLASSIC_FISHER_LABEL.thick, grade: "Grau 3" },
  { v: "ivh_or_ich", label: CLASSIC_FISHER_LABEL.ivh_or_ich, grade: "Grau 4" },
];

// --------------------------------------------------------------- botão

export function FisherButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { fisher?: FisherRecord }).fisher;
  const classic = (patient as Patient & { classicFisher?: ClassicFisherRecord }).classicFisher;
  const { grade } = useMemo(() => computeFisher(rec), [rec]);
  const { grade: classicGrade } = useMemo(() => computeClassicFisher(classic), [classic]);

  const displayGrade = classicGrade ?? grade;
  const hasModified = grade != null;
  const hasClassic = classicGrade != null;
  const cls = displayGrade != null
    ? displayGrade >= 3
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Escala de Fisher (clássica e modificada) para hemorragia subaracnoidea"
    >
      <span className="inline-flex items-center gap-1">
        <Brain className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> Fisher
        {displayGrade != null && <span className="font-mono">{displayGrade}</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {hasClassic && hasModified ? "Clássica + Modificada"
          : hasClassic ? "Clássica"
          : hasModified ? "Modificada"
          : "Não classificado"}
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

function ClassicOptionCard({
  value, onChange,
}: { value: ClassicFisherFinding | undefined; onChange: (v: ClassicFisherFinding) => void }) {
  return (
    <div className="grid gap-2">
      {CLASSIC_OPTS.map((o) => (
        <label
          key={o.v}
          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border-2 px-3 py-3 text-[12px] transition-colors ${
            value === o.v ? "border-primary bg-primary/10 font-bold" : "border-border hover:bg-surface-3"
          }`}
        >
          <span className="flex items-center gap-2">
            <input type="radio" name="fisher-classic" checked={value === o.v} onChange={() => onChange(o.v)} className="accent-current" />
            <span>{o.label}</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{o.grade}</span>
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
  type Tab = "classic" | "modified";
  const [tab, setTab] = useState<Tab>("classic");

  const savedModified = (patient as Patient & { fisher?: FisherRecord }).fisher ?? {};
  const savedClassic = (patient as Patient & { classicFisher?: ClassicFisherRecord }).classicFisher ?? {};

  const [draftModified, setDraftModified] = useState<FisherRecord>(savedModified);
  const [draftClassic, setDraftClassic] = useState<ClassicFisherRecord>(savedClassic);
  const [showModifiedResult, setShowModifiedResult] = useState<boolean>(savedModified.grade != null);
  const [showClassicResult, setShowClassicResult] = useState<boolean>(savedClassic.grade != null);

  const { grade: modifiedGrade, incomplete: modifiedIncomplete, sahPts, ivhPts } = useMemo(() => computeFisher(draftModified), [draftModified]);
  const { grade: classicGrade, incomplete: classicIncomplete } = useMemo(() => computeClassicFisher(draftClassic), [draftClassic]);

  const setModified = (key: keyof FisherRecord, v: string) => {
    setDraftModified((d) => ({ ...d, [key]: v }));
    setShowModifiedResult(false);
  };
  const setClassic = (finding: ClassicFisherFinding) => {
    setDraftClassic({ finding });
    setShowClassicResult(false);
  };

  const calcModified = () => {
    setShowModifiedResult(true);
    if (modifiedIncomplete) return;
    onSave({ ...patient, fisher: { ...draftModified, grade: modifiedGrade, at: new Date().toISOString() } } as Patient);
  };

  const calcClassic = () => {
    setShowClassicResult(true);
    if (classicIncomplete) return;
    onSave({ ...patient, classicFisher: { ...draftClassic, grade: classicGrade, at: new Date().toISOString() } } as Patient);
  };

  const clearModified = () => {
    setDraftModified({});
    setShowModifiedResult(false);
    onSave({ ...patient, fisher: undefined } as Patient);
  };

  const clearClassic = () => {
    setDraftClassic({});
    setShowClassicResult(false);
    onSave({ ...patient, classicFisher: undefined } as Patient);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-clinical-neuro" />
            Escala de Fisher — Hemorragia Subaracnoidea
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          <CtIcon />
          <span>
            Classificação radiológica baseada na TC de crânio sem contraste. Escolha abaixo entre a escala Fisher
            clássica ou a Fisher Modificada.
          </span>
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {([
            { key: "classic", label: "Fisher Clássica" },
            { key: "modified", label: "Fisher Modificada" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-3"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "modified" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                1 · Hemorragia subaracnoidea (HSA)
              </div>
              <div className="mb-2 text-[12px] font-semibold">
                Qual é a quantidade/espessura da hemorragia subaracnoidea (HSA) na TC?
              </div>
              <OptionCard name="fisher-sah" options={SAH_OPTS} value={draftModified.sah} onChange={(v) => setModified("sah", v)} />
              <div className="mt-2 text-[11px] text-muted-foreground">
                Pontuação HSA: <span className="font-mono font-bold text-foreground">{draftModified.sah ? SAH_POINTS[draftModified.sah] : "—"}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                2 · Hemorragia intraventricular (HIV)
              </div>
              <div className="mb-2 text-[12px] font-semibold">Existe hemorragia intraventricular (HIV)?</div>
              <OptionCard name="fisher-ivh" options={YN_OPTS} value={draftModified.ivh} onChange={(v) => setModified("ivh", v)} />
              <div className="mt-2 text-[11px] text-muted-foreground">
                Pontuação HIV: <span className="font-mono font-bold text-foreground">{draftModified.ivh ? (draftModified.ivh === "yes" ? 1 : 0) : "—"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={calcModified}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
              >
                <Calculator className="h-3.5 w-3.5" /> Calcular Fisher Modificada
              </button>
              <button
                type="button"
                onClick={clearModified}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>

            {showModifiedResult && modifiedIncomplete && (
              <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
                <AlertTriangle className="h-4 w-4" />
                Classificação incompleta — informe a quantidade de HSA e a presença ou ausência de hemorragia intraventricular.
              </div>
            )}

            {showModifiedResult && modifiedGrade != null && (
              <div className="rounded-lg border-2 border-border bg-surface p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fisher Modificada</div>
                <div className="font-mono text-4xl font-black text-foreground">{modifiedGrade}/4</div>
                <div className="mx-auto mt-3 grid max-w-md gap-1 text-left text-[12px]">
                  <div>
                    <span className="font-semibold">HSA: </span>
                    {draftModified.sah ? SAH_LABEL[draftModified.sah] : "—"} · Pontuação HSA:{" "}
                    <span className="font-mono font-bold">{sahPts}</span>
                  </div>
                  <div>
                    <span className="font-semibold">HIV: </span>
                    {draftModified.ivh === "yes" ? "Presente" : "Ausente"} · Pontuação HIV:{" "}
                    <span className="font-mono font-bold">{ivhPts}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Pontuação final: </span>
                    <span className="font-mono font-bold">{modifiedGrade}/4</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">Descrição: </span>{FISHER_DESCRIPTION[modifiedGrade]}
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
                    <tr key={row.g} className={modifiedGrade === row.g && showModifiedResult ? "bg-primary/10 font-semibold" : ""}>
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
          </div>
        )}

        {tab === "classic" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                1 · Achado principal na TC de crânio
              </div>
              <div className="mb-2 text-[12px] font-semibold">
                Selecione o padrão de hemorragia subaracnoidea observado no exame:
              </div>
              <ClassicOptionCard value={draftClassic.finding} onChange={setClassic} />
              <div className="mt-2 text-[11px] text-muted-foreground">
                Grau clássico: <span className="font-mono font-bold text-foreground">{draftClassic.finding ? `${CLASSIC_FISHER_POINTS[draftClassic.finding]}` : "—"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={calcClassic}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
              >
                <Calculator className="h-3.5 w-3.5" /> Calcular Fisher Clássica
              </button>
              <button
                type="button"
                onClick={clearClassic}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>

            {showClassicResult && classicIncomplete && (
              <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
                <AlertTriangle className="h-4 w-4" />
                Classificação incompleta — selecione o achado principal na TC.
              </div>
            )}

            {showClassicResult && classicGrade != null && (
              <div className="rounded-lg border-2 border-border bg-surface p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fisher Clássica</div>
                <div className="font-mono text-4xl font-black text-foreground">{classicGrade}/4</div>
                <div className="mx-auto mt-3 max-w-md text-left text-[12px]">
                  <div>
                    <span className="font-semibold">Achado: </span>
                    {draftClassic.finding ? CLASSIC_FISHER_LABEL[draftClassic.finding] : "—"}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">Descrição: </span>{CLASSIC_FISHER_DESCRIPTION[classicGrade]}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[11px]">
                <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Grau</th>
                    <th className="p-2 text-left">Achado na TC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CLASSIC_FISHER_TABLE.map((row) => (
                    <tr key={row.g} className={classicGrade === row.g && showClassicResult ? "bg-primary/10 font-semibold" : ""}>
                      <td className="p-2 font-mono">{row.g}</td>
                      <td className="p-2">{row.finding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-border bg-surface p-3 text-[11px] text-foreground">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Interpretação clínica
              </div>
              A escala de Fisher clássica descreve o padrão de sangue subaracnoideo na TC e está relacionada ao risco de
              vasoespasmo cerebral após hemorragia subaracnoidea aneurismática. Grau 3 e 4 tradicionalmente associam-se a
              maior probabilidade de vasoespasmo sintomático.
            </div>

            <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
              Ferramenta de apoio à avaliação clínica. A escala de Fisher é uma classificação radiológica e deve ser
              aplicada a partir da interpretação adequada da TC de crânio. Não substitui avaliação médica especializada,
              interpretação radiológica ou protocolos institucionais.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
