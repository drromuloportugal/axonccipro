import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Droplet, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

export type IchYN = "no" | "yes";
export type IchLocation = "supra" | "infra";

export type IchRecord = {
  gcsMode?: "band" | "components";
  gcsBand?: "13-15" | "5-12" | "3-4";
  e?: number | null;
  v?: number | null;
  m?: number | null;
  volumeMode?: "band" | "ml";
  volumeBand?: "lt30" | "gte30";
  volumeMl?: number | null;
  ivh?: IchYN;
  location?: IchLocation;
  age?: number | null;
  score?: number | null;
  at?: string;
};

export function ichGcs(r: IchRecord | undefined): number | null {
  if (!r) return null;
  if (r.gcsMode === "components") {
    if (r.e == null || r.v == null || r.m == null) return null;
    return r.e + r.v + r.m;
  }
  return null;
}

function gcsPointsFromValue(g: number): number {
  if (g >= 13) return 0;
  if (g >= 5) return 1;
  return 2;
}

export type IchResult = {
  score: number | null;
  gcs: number | null;
  gcsPts: number | null;
  volPts: number | null;
  ivhPts: number | null;
  locPts: number | null;
  agePts: number | null;
  incomplete: boolean;
  invalid: string | null;
};

/** Lógica pura do ICH Score (0–6). */
export function computeIch(r: IchRecord | undefined): IchResult {
  const empty: IchResult = {
    score: null, gcs: null, gcsPts: null, volPts: null, ivhPts: null,
    locPts: null, agePts: null, incomplete: true, invalid: null,
  };
  if (!r) return empty;

  const gcs = ichGcs(r);
  let gcsPts: number | null = null;
  if ((r.gcsMode ?? "band") === "components") {
    if (gcs == null) return { ...empty, gcs };
    if (gcs < 3 || gcs > 15) return { ...empty, gcs, incomplete: false, invalid: "A GCS deve estar entre 3 e 15." };
    gcsPts = gcsPointsFromValue(gcs);
  } else {
    if (!r.gcsBand) return empty;
    gcsPts = r.gcsBand === "13-15" ? 0 : r.gcsBand === "5-12" ? 1 : 2;
  }

  let volPts: number | null = null;
  if ((r.volumeMode ?? "band") === "ml") {
    if (r.volumeMl == null) return { ...empty, gcs, gcsPts };
    if (r.volumeMl < 0) return { ...empty, gcs, gcsPts, incomplete: false, invalid: "O volume deve ser maior ou igual a 0 mL." };
    volPts = r.volumeMl >= 30 ? 1 : 0;
  } else {
    if (!r.volumeBand) return { ...empty, gcs, gcsPts };
    volPts = r.volumeBand === "gte30" ? 1 : 0;
  }

  if (!r.ivh || !r.location || r.age == null) {
    return { ...empty, gcs, gcsPts, volPts };
  }
  if (r.age < 0) {
    return { ...empty, gcs, gcsPts, volPts, incomplete: false, invalid: "A idade deve ser maior ou igual a 0." };
  }

  const ivhPts = r.ivh === "yes" ? 1 : 0;
  const locPts = r.location === "infra" ? 1 : 0;
  const agePts = r.age >= 80 ? 1 : 0;

  return {
    score: gcsPts + volPts + ivhPts + locPts + agePts,
    gcs, gcsPts, volPts, ivhPts, locPts, agePts,
    incomplete: false, invalid: null,
  };
}

const E_OPTS = [
  { v: 4, label: "4 — Espontânea" }, { v: 3, label: "3 — Ao chamado" },
  { v: 2, label: "2 — À dor" }, { v: 1, label: "1 — Nenhuma" },
];
const V_OPTS = [
  { v: 5, label: "5 — Orientado" }, { v: 4, label: "4 — Confuso" },
  { v: 3, label: "3 — Palavras inadequadas" }, { v: 2, label: "2 — Sons incompreensíveis" },
  { v: 1, label: "1 — Nenhuma" },
];
const M_OPTS = [
  { v: 6, label: "6 — Obedece comandos" }, { v: 5, label: "5 — Localiza dor" },
  { v: 4, label: "4 — Retira à dor" }, { v: 3, label: "3 — Flexão anormal" },
  { v: 2, label: "2 — Extensão anormal" }, { v: 1, label: "1 — Nenhuma" },
];

export function IchScoreButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { ichScore?: IchRecord }).ichScore;
  const { score } = useMemo(() => computeIch(rec), [rec]);
  const cls = score != null
    ? score >= 3
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="ICH Score — hemorragia intracerebral"
    >
      <span className="inline-flex items-center gap-1">
        <Droplet className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> ICH Score
        {score != null && <span className="font-mono">{score}/6</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {score != null ? "Estratificação prognóstica" : "Não calculado"}
      </span>
    </button>
  );
}

function RadioRow<T extends string | number>({
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

function Head({ n, title }: { n: string; title: string }) {
  return <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{n} · {title}</div>;
}

export function IchScoreModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const saved = (patient as Patient & { ichScore?: IchRecord }).ichScore ?? {};
  const [draft, setDraft] = useState<IchRecord>({ gcsMode: "band", volumeMode: "band", ...saved });
  const [showResult, setShowResult] = useState<boolean>(saved.score != null);

  const res = useMemo(() => computeIch(draft), [draft]);

  const set = <K extends keyof IchRecord>(k: K, v: IchRecord[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    onSave({ ...patient, ichScore: { ...draft, score: res.score, at: new Date().toISOString() } } as Patient);
  };
  const clear = () => {
    setDraft({ gcsMode: "band", volumeMode: "band" });
    setShowResult(false);
    onSave({ ...patient, ichScore: undefined } as Patient);
  };

  const volumeLabel =
    (draft.volumeMode ?? "band") === "ml"
      ? draft.volumeMl != null ? `${draft.volumeMl} mL` : "—"
      : draft.volumeBand === "gte30" ? "≥ 30 mL" : draft.volumeBand === "lt30" ? "< 30 mL" : "—";

  const gcsLabel =
    (draft.gcsMode ?? "band") === "components"
      ? res.gcs != null ? `${res.gcs}/15` : "—"
      : draft.gcsBand ?? "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Droplet className="h-4 w-4 text-clinical-neuro" />
            Calculadora ICH Score — Hemorragia Intracerebral
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* 1 GCS */}
          <div>
            <Head n="1" title="Escala de Coma de Glasgow (GCS)" />
            <div className="mb-2 flex gap-2">
              {(["band", "components"] as const).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => set("gcsMode", mo)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    (draft.gcsMode ?? "band") === mo ? "border-primary bg-primary/10" : "border-border hover:bg-surface-3"
                  }`}
                >
                  {mo === "band" ? "Faixa de GCS" : "Calcular por E + V + M"}
                </button>
              ))}
            </div>
            {(draft.gcsMode ?? "band") === "band" ? (
              <RadioRow
                name="ich-gcs"
                options={[
                  { v: "13-15" as const, label: "GCS 13–15 → 0 ponto" },
                  { v: "5-12" as const, label: "GCS 5–12 → 1 ponto" },
                  { v: "3-4" as const, label: "GCS 3–4 → 2 pontos" },
                ]}
                value={draft.gcsBand}
                onChange={(v) => set("gcsBand", v)}
              />
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Abertura ocular (E)</div>
                  <RadioRow name="ich-e" options={E_OPTS} value={draft.e} onChange={(v) => set("e", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta verbal (V)</div>
                  <RadioRow name="ich-v" options={V_OPTS} value={draft.v} onChange={(v) => set("v", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold">Resposta motora (M)</div>
                  <RadioRow name="ich-m" options={M_OPTS} value={draft.m} onChange={(v) => set("m", v)} />
                </div>
                {res.gcs != null && <div className="text-[12px] font-semibold">GCS: {res.gcs}/15</div>}
              </div>
            )}
          </div>

          {/* 2 Volume */}
          <div>
            <Head n="2" title="Volume da hemorragia intracerebral" />
            <div className="mb-2 flex gap-2">
              {(["band", "ml"] as const).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => set("volumeMode", mo)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                    (draft.volumeMode ?? "band") === mo ? "border-primary bg-primary/10" : "border-border hover:bg-surface-3"
                  }`}
                >
                  {mo === "band" ? "Selecionar faixa" : "Informar volume (mL)"}
                </button>
              ))}
            </div>
            {(draft.volumeMode ?? "band") === "band" ? (
              <RadioRow
                name="ich-vol"
                options={[
                  { v: "lt30" as const, label: "< 30 mL → 0 ponto" },
                  { v: "gte30" as const, label: "≥ 30 mL → 1 ponto" },
                ]}
                value={draft.volumeBand}
                onChange={(v) => set("volumeBand", v)}
              />
            ) : (
              <label className="flex items-center gap-2 text-[12px]">
                <span className="font-semibold">Volume (mL):</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={draft.volumeMl ?? ""}
                  onChange={(e) => set("volumeMl", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-28 rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                />
              </label>
            )}
          </div>

          {/* 3 HIV */}
          <div>
            <Head n="3" title="Hemorragia intraventricular (HIV)" />
            <RadioRow
              name="ich-ivh"
              options={[{ v: "no" as IchYN, label: "Não → 0 ponto" }, { v: "yes" as IchYN, label: "Sim → 1 ponto" }]}
              value={draft.ivh}
              onChange={(v) => set("ivh", v)}
            />
          </div>

          {/* 4 Localização */}
          <div>
            <Head n="4" title="Localização da hemorragia" />
            <RadioRow
              name="ich-loc"
              options={[
                { v: "supra" as IchLocation, label: "Supratentorial → 0 ponto" },
                { v: "infra" as IchLocation, label: "Infratentorial (cerebelo ou tronco) → 1 ponto" },
              ]}
              value={draft.location}
              onChange={(v) => set("location", v)}
            />
          </div>

          {/* 5 Idade */}
          <div>
            <Head n="5" title="Idade do paciente" />
            <label className="flex items-center gap-2 text-[12px]">
              <span className="font-semibold">Idade (anos):</span>
              <input
                type="number"
                min={0}
                value={draft.age ?? ""}
                onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))}
                className="w-24 rounded-md border border-border bg-background px-2 py-1 text-[12px]"
              />
              <span className="text-muted-foreground">&lt; 80 → 0 ponto · ≥ 80 → 1 ponto</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular ICH Score
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>

        {showResult && (res.incomplete || res.invalid) && (
          <div className="flex items-center gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
            <AlertTriangle className="h-4 w-4" />
            {res.invalid ?? "Avaliação incompleta — preencha todos os campos para calcular o ICH Score."}
          </div>
        )}

        {showResult && res.score != null && (
          <div className="rounded-md border-2 border-border bg-surface p-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">ICH Score</div>
              <div className="font-mono text-4xl font-black text-foreground">{res.score}/6</div>
            </div>
            <div className="mx-auto mt-3 max-w-md space-y-0.5 text-[12px] text-foreground">
              <div>GCS: {gcsLabel} · Pontuação GCS: {res.gcsPts}</div>
              <div>Volume: {volumeLabel} · Pontuação do volume: {res.volPts}</div>
              <div>HIV: {draft.ivh === "yes" ? "Sim" : "Não"} · Pontuação HIV: {res.ivhPts}</div>
              <div>
                Localização: {draft.location === "infra" ? "Infratentorial" : "Supratentorial"} · Pontuação localização: {res.locPts}
              </div>
              <div>Idade: {draft.age} anos · Pontuação idade: {res.agePts}</div>
              <div className="pt-1 font-semibold">Pontuação total: {res.score}/6</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Componente</th>
                <th className="p-2 text-left">Critério</th>
                <th className="p-2 text-left">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td className="p-2">GCS</td><td className="p-2">13–15 / 5–12 / 3–4</td><td className="p-2 font-mono">0 / 1 / 2</td></tr>
              <tr><td className="p-2">Volume</td><td className="p-2">&lt; 30 mL / ≥ 30 mL</td><td className="p-2 font-mono">0 / 1</td></tr>
              <tr><td className="p-2">HIV</td><td className="p-2">Não / Sim</td><td className="p-2 font-mono">0 / 1</td></tr>
              <tr><td className="p-2">Localização</td><td className="p-2">Supratentorial / Infratentorial</td><td className="p-2 font-mono">0 / 1</td></tr>
              <tr><td className="p-2">Idade</td><td className="p-2">&lt; 80 / ≥ 80 anos</td><td className="p-2 font-mono">0 / 1</td></tr>
            </tbody>
          </table>
        </div>

        {showResult && res.score != null && (
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-[11px] text-foreground">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Interpretação</div>
            O ICH Score é um instrumento de estratificação prognóstica utilizado em pacientes com hemorragia intracerebral
            espontânea, agregando gravidade neurológica, volume e localização do sangramento, extensão intraventricular e
            idade. O escore descreve gravidade em nível de grupo e não constitui diagnóstico nem previsão individual
            determinística de mortalidade. Não deve ser transformado isoladamente em decisão de tratamento.
          </div>
        )}

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Ferramenta de apoio à avaliação clínica. O ICH Score é uma ferramenta prognóstica e não substitui avaliação
          médica, exame clínico, interpretação adequada da neuroimagem ou protocolos institucionais. O resultado não deve
          ser utilizado isoladamente para determinar condutas terapêuticas ou limitar tratamento.
        </div>
      </DialogContent>
    </Dialog>
  );
}
