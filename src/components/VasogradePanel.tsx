import { useEffect, useMemo, useRef, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, AlertTriangle, RotateCcw, Calculator, Eraser } from "lucide-react";
import { computeFisher, type FisherSah, type FisherYN } from "@/components/FisherPanel";
import { computeWfns, type WfnsYN } from "@/components/WfnsPanel";

export type VasoColor = "green" | "yellow" | "red";

export type VasogradeRecord = {
  fisher?: number | null;
  wfns?: number | null;
  color?: VasoColor | null;
  at?: string;
};

export const VASO_LABEL: Record<VasoColor, string> = {
  green: "VERDE",
  yellow: "AMARELO",
  red: "VERMELHO",
};

export const VASO_RISK: Record<VasoColor, string> = {
  green: "Baixo risco de isquemia cerebral tardia (DCI).",
  yellow: "Risco intermediário de isquemia cerebral tardia (DCI).",
  red: "Alto risco de isquemia cerebral tardia (DCI).",
};

export const VASO_LEVEL: Record<VasoColor, string> = {
  green: "Baixo",
  yellow: "Intermediário",
  red: "Alto",
};

const WFNS_ROMAN = ["I", "II", "III", "IV", "V"];

/** Lógica pura da classificação VASOGRADE. */
export function computeVasograde(fisher: number | null | undefined, wfns: number | null | undefined): VasoColor | null {
  if (fisher == null || wfns == null) return null;
  if (wfns >= 4) return "red";
  if (fisher >= 3) return "yellow";
  return wfns <= 2 ? "green" : "yellow";
}

const CELL_CLASS: Record<VasoColor, string> = {
  green: "bg-clinical-stable/25 text-ink",
  yellow: "bg-clinical-attention/30 text-ink",
  red: "bg-clinical-critical/25 text-ink",
};

const BANNER_CLASS: Record<VasoColor, string> = {
  green: "border-clinical-stable/60 bg-clinical-stable/15",
  yellow: "border-clinical-attention/60 bg-clinical-attention/15",
  red: "border-clinical-critical/60 bg-clinical-critical/15",
};

const FISHER_OPTS = [
  { v: 0, label: "0 — HSA ausente, sem HIV" },
  { v: 1, label: "1 — HSA fina (< 1 mm), sem HIV" },
  { v: 2, label: "2 — HSA fina (< 1 mm), com HIV" },
  { v: 3, label: "3 — HSA espessa (≥ 1 mm), sem HIV" },
  { v: 4, label: "4 — HSA espessa (≥ 1 mm), com HIV" },
];

const SAH_OPTS: { v: FisherSah; label: string }[] = [
  { v: "none", label: "Ausente" },
  { v: "thin", label: "Fina < 1 mm" },
  { v: "thick", label: "Espessa ≥ 1 mm" },
];

const YN_OPTS: { v: FisherYN; label: string }[] = [
  { v: "no", label: "Não" },
  { v: "yes", label: "Sim" },
];

export function VasogradeButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { vasograde?: VasogradeRecord }).vasograde;
  const color = rec?.color ?? null;
  const cls = color
    ? color === "red"
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : color === "yellow"
        ? "bg-clinical-attention/20 text-ink hover:bg-clinical-attention/30"
        : "bg-clinical-stable/20 text-ink hover:bg-clinical-stable/30"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Classificação VASOGRADE para hemorragia subaracnoidea aneurismática"
    >
      <span className="inline-flex items-center gap-1">
        <Activity className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> VASOGRADE
        {color && <span className="font-mono">{VASO_LABEL[color]}</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {color
          ? `WFNS ${WFNS_ROMAN[(rec?.wfns ?? 1) - 1]} · Fisher mod. ${rec?.fisher}`
          : "Não classificado"}
      </span>
    </button>
  );
}

function Choice<T extends string | number>({
  name, options, value, onChange,
}: { name: string; options: { v: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={String(o.v)}
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

export function VasogradeModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const p = patient as Patient & { vasograde?: VasogradeRecord };
  const saved = p.vasograde ?? {};

  const [fisher, setFisher] = useState<number | null>(saved.fisher ?? null);
  const [wfns, setWfns] = useState<number | null>(saved.wfns ?? null);
  const [fisherGuided, setFisherGuided] = useState(false);
  const [wfnsGuided, setWfnsGuided] = useState(false);
  const [sah, setSah] = useState<FisherSah | undefined>();
  const [ivh, setIvh] = useState<FisherYN | undefined>();
  const [gcs, setGcs] = useState<number | null>(null);
  const [deficit, setDeficit] = useState<WfnsYN | undefined>();

  const guidedFisher = useMemo(() => computeFisher({ sah, ivh }).grade, [sah, ivh]);
  const guidedWfns = useMemo(() => computeWfns({ mode: "total", gcs, motorDeficit: deficit }).grade, [gcs, deficit]);

  const color = useMemo(() => computeVasograde(fisher, wfns), [fisher, wfns]);
  const incomplete = fisher == null || wfns == null;

  const reset = () => {
    setFisher(null); setWfns(null); setSah(undefined); setIvh(undefined);
    setGcs(null); setDeficit(undefined);
    setFisherGuided(false); setWfnsGuided(false);
  };

  const calc = () => {
    setShowResult(true);
    if (!incomplete) {
      onSave({ ...patient, vasograde: { fisher, wfns, color, at: new Date().toISOString() } } as Patient);
    }
  };

  const clear = () => {
    lastSaved.current = "";
    reset();
    onSave({ ...patient, vasograde: undefined } as Patient);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-clinical-neuro" />
            Calculadora VASOGRADE — Hemorragia Subaracnoidea Aneurismática
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          A classificação VASOGRADE combina a Escala de Fisher Modificada (carga hemorrágica) com a WFNS
          (gravidade neurológica) para estratificar o risco de isquemia cerebral tardia.
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Fisher modificada */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1 · Fisher Modificada
            </div>
            <div className="mb-2 text-[12px] font-semibold">Qual é o grau da Fisher Modificada?</div>
            <div className="grid gap-1">
              {FISHER_OPTS.map((o) => (
                <label
                  key={o.v}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                    fisher === o.v ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-surface-3"
                  }`}
                >
                  <input
                    type="radio"
                    name="vaso-fisher"
                    checked={fisher === o.v}
                    onChange={() => { setFisher(o.v); }}
                    className="accent-current"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFisherGuided((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-surface-3"
            >
              <Calculator className="h-3.5 w-3.5" /> Calcular Fisher Modificada
            </button>

            {fisherGuided && (
              <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2">
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Espessura da HSA</div>
                  <Choice name="vaso-sah" options={SAH_OPTS} value={sah} onChange={(v) => { setSah(v); }} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Hemorragia intraventricular</div>
                  <Choice name="vaso-ivh" options={YN_OPTS} value={ivh} onChange={(v) => { setIvh(v); }} />
                </div>
                {guidedFisher != null && (
                  <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                    <span>Fisher Modificada calculada: {guidedFisher}</span>
                    <button
                      type="button"
                      onClick={() => { setFisher(guidedFisher); }}
                      className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
                    >
                      Usar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* WFNS */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              2 · WFNS
            </div>
            <div className="mb-2 text-[12px] font-semibold">Qual é o grau WFNS?</div>
            <div className="grid gap-1">
              {WFNS_ROMAN.map((r, i) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                    wfns === i + 1 ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-surface-3"
                  }`}
                >
                  <input
                    type="radio"
                    name="vaso-wfns"
                    checked={wfns === i + 1}
                    onChange={() => { setWfns(i + 1); }}
                    className="accent-current"
                  />
                  <span>WFNS {r}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setWfnsGuided((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-surface-3"
            >
              <Calculator className="h-3.5 w-3.5" /> Modo guiado (GCS + déficit motor)
            </button>

            {wfnsGuided && (
              <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2">
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="font-semibold">GCS (3–15):</span>
                  <input
                    type="number"
                    min={3}
                    max={15}
                    value={gcs ?? ""}
                    onChange={(e) => { setGcs(e.target.value === "" ? null : Number(e.target.value)); }}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                  />
                </label>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Déficit motor</div>
                  <Choice name="vaso-def" options={YN_OPTS} value={deficit} onChange={(v) => { setDeficit(v); }} />
                </div>
                {guidedWfns != null && (
                  <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                    <span>WFNS calculada: {WFNS_ROMAN[guidedWfns - 1]}</span>
                    <button
                      type="button"
                      onClick={() => { setWfns(guidedWfns); }}
                      className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
                    >
                      Usar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink">
            <Calculator className="h-3.5 w-3.5" /> Cálculo automático
          </div>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reiniciar avaliação
          </button>
        </div>

        {incomplete && (
          <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-ink">
            <AlertTriangle className="h-4 w-4" />
            Avaliação incompleta — determine a Fisher Modificada e a WFNS para calcular o VASOGRADE.
          </div>
        )}

        {color && wfns != null && fisher != null && (
          <>
            <div className={`rounded-md border-2 p-4 text-center ${BANNER_CLASS[color]}`}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">VASOGRADE</div>
              <div className="font-mono text-4xl font-black text-ink">{VASO_LABEL[color]}</div>
              <div className="mx-auto mt-2 max-w-md space-y-1 text-[12px] text-ink">
                <div>WFNS: {WFNS_ROMAN[wfns - 1]}</div>
                <div>Fisher Modificada: {fisher}</div>
                <div>VASOGRADE: {VASO_LABEL[color]}</div>
                <div className="font-semibold">Estratificação de risco de DCI: {VASO_LEVEL[color]}</div>
                <div>{VASO_RISK[color]}</div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avaliação neurológica</div>
                <div className="text-[13px] font-bold text-ink">WFNS: {WFNS_ROMAN[wfns - 1]}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Carga hemorrágica</div>
                <div className="text-[13px] font-bold text-ink">Fisher Modificada: {fisher}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Classificação final</div>
                <div className="text-[13px] font-bold text-ink">VASOGRADE: {VASO_LABEL[color]}</div>
              </div>
            </div>
          </>
        )}

        {/* Matriz interativa */}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">WFNS \ Fisher mod.</th>
                {[0, 1, 2, 3, 4].map((f) => (
                  <th key={f} className="p-2 text-center">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WFNS_ROMAN.map((r, i) => (
                <tr key={r}>
                  <td className="p-2 font-mono font-semibold">WFNS {r}</td>
                  {[0, 1, 2, 3, 4].map((f) => {
                    const c = computeVasograde(f, i + 1)!;
                    const active = fisher === f && wfns === i + 1;
                    return (
                      <td
                        key={f}
                        onClick={() => { setFisher(f); setWfns(i + 1); }}
                        className={`cursor-pointer p-2 text-center font-semibold ${CELL_CLASS[c]} ${active ? "ring-2 ring-inset ring-primary" : ""}`}
                      >
                        {VASO_LABEL[c]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          O VASOGRADE é uma ferramenta de estratificação de risco para isquemia cerebral tardia após hemorragia
          subaracnoidea aneurismática. O resultado não substitui avaliação neurológica seriada, monitorização clínica,
          investigação complementar ou protocolos institucionais.
        </div>
      </DialogContent>
    </Dialog>
  );
}
