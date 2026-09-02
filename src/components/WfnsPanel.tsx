import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Stethoscope, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type WfnsYN = "no" | "yes";

export type WfnsRecord = {
  mode?: "total" | "components";
  gcs?: number | null;
  e?: number | null;
  v?: number | null;
  m?: number | null;
  motorDeficit?: WfnsYN;
  grade?: number | null;
  at?: string;
};

export const WFNS_DESCRIPTION: Record<number, string> = {
  1: "GCS 15, sem déficit motor. Paciente neurologicamente íntegro.",
  2: "GCS 13–14, sem déficit motor focal.",
  3: "GCS 13–14, com déficit motor focal.",
  4: "GCS 7–12, com ou sem déficit motor.",
  5: "GCS 3–6, com ou sem déficit motor.",
};

export const WFNS_TABLE: { g: number; r: string; gcs: string; def: string }[] = [
  { g: 1, r: "I", gcs: "15", def: "Não" },
  { g: 2, r: "II", gcs: "13–14", def: "Não" },
  { g: 3, r: "III", gcs: "13–14", def: "Sim" },
  { g: 4, r: "IV", gcs: "7–12", def: "Com ou sem" },
  { g: 5, r: "V", gcs: "3–6", def: "Com ou sem" },
];

export function wfnsGcs(r: WfnsRecord | undefined): number | null {
  if (!r) return null;
  if (r.mode === "components") {
    if (r.e == null || r.v == null || r.m == null) return null;
    return r.e + r.v + r.m;
  }
  return r.gcs ?? null;
}

/** Lógica pura da Escala WFNS. */
export function computeWfns(r: WfnsRecord | undefined): {
  grade: number | null;
  gcs: number | null;
  incomplete: boolean;
  inconsistent: boolean;
} {
  const gcs = wfnsGcs(r);
  const deficit = r?.motorDeficit;
  if (gcs == null || !deficit) return { grade: null, gcs, incomplete: true, inconsistent: false };
  if (gcs < 3 || gcs > 15) return { grade: null, gcs, incomplete: false, inconsistent: true };
  let grade: number;
  if (gcs === 15) grade = deficit === "yes" ? 2 : 1;
  else if (gcs >= 13) grade = deficit === "yes" ? 3 : 2;
  else if (gcs >= 7) grade = 4;
  else grade = 5;
  return { grade, gcs, incomplete: false, inconsistent: false };
}

const E_OPTS = [
  { v: 4, label: "4 — Espontânea" },
  { v: 3, label: "3 — Ao chamado" },
  { v: 2, label: "2 — À dor" },
  { v: 1, label: "1 — Nenhuma" },
];
const V_OPTS = [
  { v: 5, label: "5 — Orientado" },
  { v: 4, label: "4 — Confuso" },
  { v: 3, label: "3 — Palavras inadequadas" },
  { v: 2, label: "2 — Sons incompreensíveis" },
  { v: 1, label: "1 — Nenhuma" },
];
const M_OPTS = [
  { v: 6, label: "6 — Obedece comandos" },
  { v: 5, label: "5 — Localiza dor" },
  { v: 4, label: "4 — Retira à dor" },
  { v: 3, label: "3 — Flexão anormal" },
  { v: 2, label: "2 — Extensão anormal" },
  { v: 1, label: "1 — Nenhuma" },
];

export function WfnsButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { wfns?: WfnsRecord }).wfns;
  const { grade } = useMemo(() => computeWfns(rec), [rec]);
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
      title="Escala WFNS para hemorragia subaracnoidea"
    >
      <span className="inline-flex items-center gap-1">
        <Stethoscope className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> WFNS
        {grade != null && <span className="font-mono">Grau {WFNS_TABLE[grade - 1].r}</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {grade != null ? `GCS ${WFNS_TABLE[grade - 1].gcs} · déficit ${WFNS_TABLE[grade - 1].def}` : "Não classificado"}
      </span>
    </button>
  );
}

function NumField({
  name, options, value, onChange,
}: { name: string; options: { v: number; label: string }[]; value: number | null | undefined; onChange: (v: number) => void }) {
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

export function WfnsModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const saved = (patient as Patient & { wfns?: WfnsRecord }).wfns ?? {};
  const [draft, setDraft] = useState<WfnsRecord>({ mode: "total", ...saved });
  const [showResult, setShowResult] = useState<boolean>(saved.grade != null);

  const { grade, gcs, incomplete, inconsistent } = useMemo(() => computeWfns(draft), [draft]);

  const set = <K extends keyof WfnsRecord>(k: K, v: WfnsRecord[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    onSave({ ...patient, wfns: { ...draft, gcs, grade, at: new Date().toISOString() } } as Patient);
  };
  const clear = () => {
    setDraft({ mode: "total" });
    setShowResult(false);
    onSave({ ...patient, wfns: undefined } as Patient);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Stethoscope className="h-4 w-4 text-clinical-neuro" />
            Calculadora WFNS para Hemorragia Subaracnoidea
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          A classificação WFNS utiliza a Escala de Coma de Glasgow e a presença de déficit motor.
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1 · Escala de Coma de Glasgow
            </div>
            <div className="mb-2 flex gap-2">
              {(["total", "components"] as const).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => set("mode", mo)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    (draft.mode ?? "total") === mo ? "border-primary bg-primary/10" : "border-border hover:bg-surface-3"
                  }`}
                >
                  {mo === "total" ? "Informar GCS total" : "Calcular por E + V + M"}
                </button>
              ))}
            </div>

            {(draft.mode ?? "total") === "total" ? (
              <label className="flex items-center gap-2 text-[12px]">
                <span className="font-semibold">GCS (3–15):</span>
                <select
                  value={draft.gcs ?? ""}
                  onChange={(e) => set("gcs", e.target.value === "" ? null : Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                >
                  <option value="">Selecione</option>
                  {Array.from({ length: 13 }, (_, i) => 15 - i).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Abertura ocular (E)</div>
                  <NumField name="wfns-e" options={E_OPTS} value={draft.e} onChange={(v) => set("e", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta verbal (V)</div>
                  <NumField name="wfns-v" options={V_OPTS} value={draft.v} onChange={(v) => set("v", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta motora (M)</div>
                  <NumField name="wfns-m" options={M_OPTS} value={draft.m} onChange={(v) => set("m", v)} />
                </div>
              </div>
            )}

            {gcs != null && (
              <div className="mt-2 text-[12px] font-semibold">GCS: {gcs}/15</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              2 · Déficit motor
            </div>
            <div className="mb-1 text-[12px] font-semibold">Existe déficit motor focal clinicamente relevante?</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {([{ v: "no", label: "Não" }, { v: "yes", label: "Sim" }] as { v: WfnsYN; label: string }[]).map((o) => (
                <label
                  key={o.v}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                    draft.motorDeficit === o.v ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-surface-3"
                  }`}
                >
                  <input
                    type="radio"
                    name="wfns-def"
                    checked={draft.motorDeficit === o.v}
                    onChange={() => set("motorDeficit", o.v)}
                    className="accent-current"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular WFNS
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>

        {showResult && (incomplete || inconsistent) && (
          <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
            <AlertTriangle className="h-4 w-4" />
            {inconsistent
              ? "Verifique os componentes da Escala de Coma de Glasgow."
              : "Avaliação incompleta — informe a GCS e a presença ou ausência de déficit motor."}
          </div>
        )}

        {showResult && grade != null && (
          <div className="rounded-md border-2 border-border bg-surface p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">WFNS</div>
            <div className="font-mono text-4xl font-black text-foreground">GRAU {WFNS_TABLE[grade - 1].r}</div>
            <div className="mx-auto mt-2 max-w-md space-y-1 text-[12px] text-foreground">
              <div>GCS: {gcs}/15</div>
              <div>Déficit motor: {draft.motorDeficit === "yes" ? "Sim" : "Não"}</div>
              <div>Classificação: WFNS {WFNS_TABLE[grade - 1].r}</div>
              <div><span className="font-semibold">Descrição: </span>{WFNS_DESCRIPTION[grade]}</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">WFNS</th>
                <th className="p-2 text-left">GCS</th>
                <th className="p-2 text-left">Déficit motor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WFNS_TABLE.map((row) => (
                <tr key={row.g} className={grade === row.g && showResult ? "bg-primary/10 font-semibold" : ""}>
                  <td className="p-2 font-mono">{row.r}</td>
                  <td className="p-2">{row.gcs}</td>
                  <td className="p-2">{row.def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Ferramenta de apoio à avaliação clínica. A Escala WFNS não substitui o exame neurológico completo, avaliação
          médica especializada ou protocolos institucionais.
        </div>
      </DialogContent>
    </Dialog>
  );
}
