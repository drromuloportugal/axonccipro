import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type GcsMode = "total" | "components";

export type GcsRecord = {
  mode?: GcsMode;
  total?: number | null;
  e?: number | null;
  v?: number | null;
  m?: number | null;
  at?: string;
};

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

export function gcsTotal(r: GcsRecord | undefined): number | null {
  if (!r) return null;
  if (r.mode === "components") {
    if (r.e == null || r.v == null || r.m == null) return null;
    return r.e + r.v + r.m;
  }
  return r.total ?? null;
}

export function computeGcs(r: GcsRecord | undefined): {
  total: number | null;
  incomplete: boolean;
  inconsistent: boolean;
} {
  const total = gcsTotal(r);
  if (total == null) return { total: null, incomplete: true, inconsistent: false };
  if (total < 3 || total > 15) return { total: null, incomplete: false, inconsistent: true };
  return { total, incomplete: false, inconsistent: false };
}

function NumField({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { v: number; label: string }[];
  value: number | null | undefined;
  onChange: (v: number) => void;
}) {
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

export function GcsButton({
  patient,
  onClick,
  compact = false,
}: {
  patient: Patient;
  onClick: () => void;
  compact?: boolean;
}) {
  const rec = (patient as Patient & { gcs?: GcsRecord }).gcs;
  const total = rec?.total ?? patient.state.glasgow ?? null;
  const cls =
    total == null
      ? "border border-border text-muted-foreground hover:bg-surface-3"
      : total <= 8
        ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
        : total <= 12
          ? "bg-clinical-attention/15 text-clinical-attention hover:bg-clinical-attention/25"
          : "bg-clinical-stable/15 text-clinical-stable hover:bg-clinical-stable/25";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="Escala de Coma de Glasgow (GCS)"
    >
      <span className="inline-flex items-center gap-1">
        <Brain className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> GCS
        {total != null && <span className="font-mono">{total}/15</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {total == null ? "Não classificado" : total <= 8 ? "Coma grave" : total <= 12 ? "Deterioração" : "Alerta / normal"}
      </span>
    </button>
  );
}

export function GcsModal({
  open,
  onClose,
  patient,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSave: (p: Patient) => void;
}) {
  const saved = (patient as Patient & { gcs?: GcsRecord }).gcs ?? {};
  const [draft, setDraft] = useState<GcsRecord>({ mode: "total", ...saved });
  const [showResult, setShowResult] = useState<boolean>(saved.total != null);

  const { total, incomplete, inconsistent } = useMemo(() => computeGcs(draft), [draft]);

  const set = <K extends keyof GcsRecord>(k: K, v: GcsRecord[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    const next: Patient = {
      ...patient,
      gcs: { ...draft, total, at: new Date().toISOString() },
      state: { ...patient.state, glasgow: total ?? patient.state.glasgow },
    };
    onSave(next);
  };
  const clear = () => {
    setDraft({ mode: "total" });
    setShowResult(false);
    const next: Patient = { ...patient, gcs: undefined };
    onSave(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-clinical-neuro" />
            Escala de Coma de Glasgow (GCS)
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          A GCS avalia abertura ocular (E), resposta verbal (V) e resposta motora (M). Soma mínima 3,
          máxima 15.
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Modo de entrada
            </div>
            <div className="mb-2 flex gap-2">
              {(["total", "components"] as const).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => set("mode", mo)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    (draft.mode ?? "total") === mo
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-surface-3"
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
                  value={draft.total ?? ""}
                  onChange={(e) =>
                    set("total", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                >
                  <option value="">Selecione</option>
                  {Array.from({ length: 13 }, (_, i) => 15 - i).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Abertura ocular (E)</div>
                  <NumField name="gcs-e" options={E_OPTS} value={draft.e} onChange={(v) => set("e", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta verbal (V)</div>
                  <NumField name="gcs-v" options={V_OPTS} value={draft.v} onChange={(v) => set("v", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta motora (M)</div>
                  <NumField name="gcs-m" options={M_OPTS} value={draft.m} onChange={(v) => set("m", v)} />
                </div>
              </div>
            )}

            {total != null && (
              <div className="mt-2 text-[12px] font-semibold">GCS: {total}/15</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Salvar GCS
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
              ? "Verifique os valores informados. A GCS deve estar entre 3 e 15."
              : "Avaliação incompleta — informe a GCS total ou todos os componentes E, V e M."}
          </div>
        )}

        {showResult && total != null && (
          <div className="rounded-md border-2 border-border bg-surface p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">GCS</div>
            <div className="font-mono text-4xl font-black text-foreground">{total}/15</div>
            <div className="mx-auto mt-2 max-w-md text-[12px] text-foreground">
              <span className="font-semibold">Interpretação: </span>
              {total <= 8 ? "Coma grave — considerar proteção de vias aéreas" : total <= 12 ? "Deterioração neurológica" : "Alerta / resposta normal"}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">GCS</th>
                <th className="p-2 text-left">Interpretação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className={total != null && total >= 13 && showResult ? "bg-primary/10 font-semibold" : ""}>
                <td className="p-2 font-mono">13–15</td>
                <td className="p-2">Leve / alerta</td>
              </tr>
              <tr className={total != null && total >= 9 && total <= 12 && showResult ? "bg-primary/10 font-semibold" : ""}>
                <td className="p-2 font-mono">9–12</td>
                <td className="p-2">Moderada</td>
              </tr>
              <tr className={total != null && total <= 8 && showResult ? "bg-primary/10 font-semibold" : ""}>
                <td className="p-2 font-mono">3–8</td>
                <td className="p-2">Grave — coma</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Ferramenta de apoio à avaliação neurológica. A GCS não substitui o exame neurológico
          completo nem o julgamento clínico especializado.
        </div>
      </DialogContent>
    </Dialog>
  );
}
