import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  LineChart as LineChartIcon,
  Printer,
  RotateCcw,
  Save,
  Wand2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/data/patients";
import {
  SOFA_COMPONENTS,
  SOFA_DISCLAIMER,
  SOFA_REFERENCES,
  SEVERITY_LABEL,
  SOURCE_LABEL,
  VASOPRESSOR_LABEL,
  buildAssessment,
  calculateTotalSOFA,
  compareAssessments,
  deltaText,
  emptySofaInputs,
  gcsFromComponents,
  prefillFromPatient,
  severityClass,
  sortAssessments,
  validateSofaInputs,
  type SofaAssessment,
  type SofaComponentKey,
  type SofaFieldKey,
  type SofaInputs,
  type Vasopressor,
} from "@/lib/sofaScore";

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  source,
  at,
  step = "any",
  placeholder = "Não informado",
  error,
}: {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  source?: string;
  at?: string;
  step?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`mt-0.5 w-full rounded-md border bg-background px-2 py-1 font-mono text-[12px] ${
          error ? "border-clinical-critical" : "border-border"
        }`}
      />
      {source && (
        <span className="mt-0.5 block text-[9px] text-muted-foreground">
          {source}
          {at ? ` · ${fmtDateTime(at)}` : ""}
        </span>
      )}
      {error && (
        <span className="mt-0.5 block text-[10px] font-semibold text-clinical-critical">
          {error}
        </span>
      )}
    </label>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${severityClass(score)}`}
      title={score == null ? "Componente não calculável" : SEVERITY_LABEL[score]}
    >
      {score == null ? "Não informado" : `${score} pt${score === 1 ? "" : "s"}`}
    </span>
  );
}

function OrganCard({
  icon,
  title,
  detail,
  score,
  reason,
  children,
}: {
  icon: string;
  title: string;
  detail: string;
  score: number | null;
  reason?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-foreground">
            <span className="mr-1">{icon}</span>
            {title}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{detail}</div>
        </div>
        <ScoreBadge score={score} />
      </div>
      <div className="space-y-2">{children}</div>
      {score == null && reason && (
        <div className="mt-2 flex items-start gap-1 rounded border border-dashed border-border px-2 py-1 text-[10px] italic text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Componente não calculável — {reason}</span>
        </div>
      )}
    </div>
  );
}

const CRIT: Record<SofaComponentKey, string[]> = {
  resp: [
    "0 — PaO₂/FiO₂ ≥ 400",
    "1 — < 400",
    "2 — < 300",
    "3 — < 200 com suporte respiratório",
    "4 — < 100 com suporte respiratório",
  ],
  coag: ["0 — ≥150", "1 — <150", "2 — <100", "3 — <50", "4 — <20"],
  liver: ["0 — <1,2", "1 — 1,2–1,9", "2 — 2,0–5,9", "3 — 6,0–11,9", "4 — ≥12,0"],
  cardio: [
    "0 — PAM ≥70 mmHg",
    "1 — PAM <70 mmHg",
    "2 — dopamina ≤5 ou dobutamina em qualquer dose",
    "3 — dopamina >5–15 ou nora/adrenalina ≤0,1",
    "4 — dopamina >15 ou nora/adrenalina >0,1",
  ],
  cns: ["0 — 15", "1 — 13–14", "2 — 10–12", "3 — 6–9", "4 — <6"],
  renal: [
    "0 — creatinina <1,2",
    "1 — 1,2–1,9",
    "2 — 2,0–3,4",
    "3 — 3,5–4,9 ou diurese <500 mL/dia",
    "4 — ≥5,0 ou diurese <200 mL/dia",
  ],
};

function Criteria({ k }: { k: SofaComponentKey }) {
  return (
    <details className="rounded border border-border/60 bg-surface-2 px-2 py-1">
      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Critérios de pontuação
      </summary>
      <ul className="mt-1 space-y-0.5">
        {CRIT[k].map((c) => (
          <li key={c} className="font-mono text-[10px] text-muted-foreground">
            {c}
          </li>
        ))}
      </ul>
    </details>
  );
}

const GCS_BANDS: { label: string; value: number; score: number }[] = [
  { label: "15", value: 15, score: 0 },
  { label: "13–14", value: 14, score: 1 },
  { label: "10–12", value: 12, score: 2 },
  { label: "6–9", value: 9, score: 3 },
  { label: "<6", value: 5, score: 4 },
];

// ---------------------------------------------------------------------------
// Calculadora
// ---------------------------------------------------------------------------

export function SofaCalculator({
  patient,
  onSave,
  evaluator,
}: {
  patient: Patient;
  onSave?: (p: Patient) => void;
  evaluator?: string;
}) {
  const history = useMemo(
    () => sortAssessments(patient.sofaAssessments ?? []),
    [patient.sofaAssessments],
  );

  const [autoUser, setAutoUser] = useState<string | null>(null);
  useEffect(() => {
    if (evaluator) return;
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!alive || !u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const nome = typeof meta["nome"] === "string" ? (meta["nome"] as string) : null;
      setAutoUser(nome || u.email || null);
    });
    return () => {
      alive = false;
    };
  }, [evaluator]);
  const who = evaluator ?? autoUser ?? undefined;

  const [inputs, setInputs] = useState<SofaInputs>(() => prefillFromPatient(patient));
  const [startedAt] = useState(() => new Date().toISOString());
  const [showEvolution, setShowEvolution] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const [series, setSeries] = useState<Record<"total" | SofaComponentKey, boolean>>({
    total: true,
    resp: false,
    coag: false,
    liver: false,
    cardio: false,
    cns: false,
    renal: false,
  });
  const [saved, setSaved] = useState<string | null>(null);

  const result = useMemo(() => calculateTotalSOFA(inputs), [inputs]);
  const issues = useMemo(() => validateSofaInputs(inputs), [inputs]);
  const errorOf = (f: SofaFieldKey | "vasopressor") =>
    issues.find((i) => i.field === f)?.message;

  const set = <K extends keyof SofaInputs>(k: K, v: SofaInputs[K]) => {
    setInputs((d) => {
      const sources = { ...(d.sources ?? {}) };
      if (k in sources) delete sources[k as SofaFieldKey];
      return { ...d, [k]: v, sources };
    });
    setSaved(null);
  };
  const srcOf = (f: SofaFieldKey) => {
    const s = inputs.sources?.[f];
    return s ? SOURCE_LABEL[s] : SOURCE_LABEL.manual;
  };

  const gcs =
    inputs.gcsMode === "components"
      ? gcsFromComponents(inputs.gcsE, inputs.gcsV, inputs.gcsM)
      : inputs.gcsTotal;

  const comparison = useMemo(() => compareAssessments(history), [history]);

  const chartRows = useMemo(
    () =>
      [...history].reverse().map((a) => {
        const row: Record<string, number | string | null> = {
          label: fmtShort(a.at),
          total: a.total,
        };
        for (const c of SOFA_COMPONENTS) row[c.key] = a.scores[c.key];
        return row;
      }),
    [history],
  );

  const save = () => {
    if (!onSave) return;
    const a = buildAssessment(inputs, result, who);
    const next: Patient = {
      ...patient,
      sofaAssessments: [a, ...(patient.sofaAssessments ?? [])],
    };
    onSave(next);
    setSaved(a.at);
  };

  const reset = () => {
    setInputs(emptySofaInputs());
    setSaved(null);
  };

  const refill = () => {
    setInputs(prefillFromPatient(patient));
    setSaved(null);
  };

  const print = () => {
    const rows = SOFA_COMPONENTS.map(
      (c) =>
        `<tr><td>${c.label}</td><td>${result.scores[c.key] ?? "Não informado"}</td><td>${result.components[c.key].detail}</td></tr>`,
    ).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>SOFA — ${patient.name}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0}table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12px}td,th{border:1px solid #ccc;padding:6px;text-align:left}.total{font-size:32px;font-weight:700;margin-top:12px}small{color:#555}</style>
</head><body>
<h1>SOFA — Sequential Organ Failure Assessment</h1>
<p><strong>Paciente:</strong> ${patient.name} · Leito ${patient.bed}<br>
<strong>Data/hora da avaliação:</strong> ${fmtDateTime(new Date().toISOString())}<br>
<strong>Avaliador:</strong> ${who ?? "Não identificado"}</p>
<div class="total">SOFA ${result.total ?? "—"} / 24${result.partial ? " (parcialmente calculado)" : ""}</div>
<table><thead><tr><th>Sistema</th><th>Pontos</th><th>Dados utilizados</th></tr></thead><tbody>${rows}</tbody></table>
<p><small>${SOFA_DISCLAIMER}</small></p>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-3">
      {/* Identificação */}
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
          SOFA
        </div>
        <div className="text-[10px] text-muted-foreground">
          Sequential Organ Failure Assessment
        </div>
        <div className="mt-2 grid gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Paciente: </span>
            <span className="font-semibold text-foreground">{patient.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Data/hora: </span>
            <span className="font-mono text-foreground">{fmtDateTime(startedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avaliador: </span>
            <span className="font-semibold text-foreground">
              {who ?? "Não identificado"}
            </span>
          </div>
        </div>
      </div>

      {onSave && (
        <button
          type="button"
          onClick={refill}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-surface-3"
        >
          <Wand2 className="h-3 w-3" /> Preencher com dados do passômetro
        </button>
      )}

      {/* Módulos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Respiração */}
        <OrganCard
          icon="🫁"
          title="Respiração"
          detail={`${result.components.resp.detail} · Suporte: ${inputs.respSupport ? "Sim" : "Não"}`}
          score={result.scores.resp}
          reason={result.components.resp.reason}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="PaO₂"
              unit="mmHg"
              value={inputs.pao2}
              onChange={(v) => set("pao2", v)}
              source={srcOf("pao2")}
              at={inputs.timestamps?.pao2}
              error={errorOf("pao2")}
            />
            <NumberField
              label="FiO₂"
              unit="%"
              value={inputs.fio2}
              onChange={(v) => set("fio2", v)}
              source={srcOf("fio2")}
              at={inputs.timestamps?.fio2}
              error={errorOf("fio2")}
            />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suporte respiratório?
            </span>
            <div className="mt-0.5 flex gap-2">
              {[
                { l: "Não", v: false },
                { l: "Sim", v: true },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => set("respSupport", o.v)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    inputs.respSupport === o.v
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-surface-3"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {(() => {
              const r = result.components.resp.score;
              const ratioLow =
                inputs.pao2 != null && inputs.fio2 != null && (result.components.resp.detail.match(/(\d+)/)?.[1] ?? "");
              return r != null && ratioLow && Number(ratioLow) < 200 ? (
                <div className="mt-1 text-[10px] italic text-muted-foreground">
                  O suporte respiratório altera a pontuação nesta faixa (3–4 pts).
                </div>
              ) : null;
            })()}
          </div>
          <Criteria k="resp" />
        </OrganCard>

        {/* Coagulação */}
        <OrganCard
          icon="🩸"
          title="Coagulação"
          detail={result.components.coag.detail}
          score={result.scores.coag}
          reason={result.components.coag.reason}
        >
          <NumberField
            label="Plaquetas"
            unit="×10³/µL"
            value={inputs.platelets}
            onChange={(v) => set("platelets", v)}
            source={srcOf("platelets")}
            at={inputs.timestamps?.platelets}
            error={errorOf("platelets")}
          />
          <Criteria k="coag" />
        </OrganCard>

        {/* Fígado */}
        <OrganCard
          icon="🧫"
          title="Fígado"
          detail={result.components.liver.detail}
          score={result.scores.liver}
          reason={result.components.liver.reason}
        >
          <NumberField
            label="Bilirrubina total"
            unit="mg/dL"
            value={inputs.bilirubin}
            onChange={(v) => set("bilirubin", v)}
            source={srcOf("bilirubin")}
            at={inputs.timestamps?.bilirubin}
            error={errorOf("bilirubin")}
          />
          <Criteria k="liver" />
        </OrganCard>

        {/* Cardiovascular */}
        <OrganCard
          icon="❤️"
          title="Cardiovascular"
          detail={result.components.cardio.detail}
          score={result.scores.cardio}
          reason={result.components.cardio.reason}
        >
          <NumberField
            label="Pressão arterial média"
            unit="mmHg"
            value={inputs.map}
            onChange={(v) => set("map", v)}
            source={srcOf("map")}
            error={errorOf("map")}
          />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Uso de vasopressor / inotrópico?
            </span>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {(Object.keys(VASOPRESSOR_LABEL) as Vasopressor[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    set("vasopressor", v);
                    if (v === "none") set("vasoDose", null);
                  }}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    inputs.vasopressor === v
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-surface-3"
                  }`}
                >
                  {VASOPRESSOR_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          {inputs.vasopressor !== "none" && (
            <NumberField
              label="Dose"
              unit="µg/kg/min"
              step="0.01"
              value={inputs.vasoDose}
              onChange={(v) => set("vasoDose", v)}
              source={srcOf("vasoDose")}
              error={errorOf("vasoDose")}
            />
          )}
          <Criteria k="cardio" />
        </OrganCard>

        {/* SNC */}
        <OrganCard
          icon="🧠"
          title="Sistema nervoso central"
          detail={result.components.cns.detail}
          score={result.scores.cns}
          reason={result.components.cns.reason}
        >
          <div className="flex gap-1">
            {(
              [
                { k: "band", l: "Faixa de Glasgow" },
                { k: "components", l: "Calcular por E+V+M" },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => set("gcsMode", o.k)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                  inputs.gcsMode === o.k
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-surface-3"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {inputs.gcsMode === "band" ? (
            <div className="flex flex-wrap gap-1">
              {GCS_BANDS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => set("gcsTotal", b.value)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    inputs.gcsTotal === b.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-surface-3"
                  }`}
                  title={`${b.score} ponto(s)`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Ocular (E)"
                value={inputs.gcsE}
                onChange={(v) => set("gcsE", v)}
              />
              <NumberField
                label="Verbal (V)"
                value={inputs.gcsV}
                onChange={(v) => set("gcsV", v)}
              />
              <NumberField
                label="Motora (M)"
                value={inputs.gcsM}
                onChange={(v) => set("gcsM", v)}
              />
            </div>
          )}
          <NumberField
            label="Glasgow total (edição manual)"
            value={gcs}
            onChange={(v) => {
              set("gcsMode", "band");
              set("gcsTotal", v);
            }}
            error={errorOf("gcsTotal")}
            source={srcOf("gcsTotal")}
          />
          <Criteria k="cns" />
        </OrganCard>

        {/* Renal */}
        <OrganCard
          icon="💧"
          title="Renal"
          detail={result.components.renal.detail}
          score={result.scores.renal}
          reason={result.components.renal.reason}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Creatinina"
              unit="mg/dL"
              value={inputs.creatinine}
              onChange={(v) => set("creatinine", v)}
              source={srcOf("creatinine")}
              at={inputs.timestamps?.creatinine}
              error={errorOf("creatinine")}
            />
            <NumberField
              label="Débito urinário"
              unit="mL/24h"
              value={inputs.urineOutput}
              onChange={(v) => set("urineOutput", v)}
              source={srcOf("urineOutput")}
              error={errorOf("urineOutput")}
            />
          </div>
          <Criteria k="renal" />
        </OrganCard>
      </div>

      {/* Alertas de consistência */}
      {issues.length > 0 && (
        <div className="rounded-lg border border-clinical-critical/40 bg-clinical-critical/10 p-3">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-clinical-critical">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas de consistência
          </div>
          <ul className="space-y-0.5">
            {issues.map((i) => (
              <li key={`${i.field}-${i.message}`} className="text-[11px] text-foreground">
                • {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Painel de resultado */}
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              SOFA total
            </div>
            <div className="font-mono text-4xl font-bold leading-none text-foreground">
              {result.total ?? "—"}
              <span className="text-lg text-muted-foreground"> / 24</span>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {result.partial
                ? `SOFA parcialmente calculado — ${result.missing.length} componente(s) sem dado`
                : "Disfunção orgânica avaliada pelos seis componentes do SOFA."}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
            {SOFA_COMPONENTS.map((c) => (
              <div key={c.key} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="font-mono font-semibold text-foreground">
                  {result.scores[c.key] ?? "N/I"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {result.partial && (
          <div className="mt-2 rounded border border-dashed border-border px-2 py-1 text-[10px] text-muted-foreground">
            Componentes incompletos:{" "}
            {result.missing.map((k) => SOFA_COMPONENTS.find((c) => c.key === k)?.label).join(" · ")}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {onSave && (
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              <Save className="h-3.5 w-3.5" /> Salvar avaliação
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Nova avaliação
          </button>
          <button
            type="button"
            onClick={() => setShowEvolution((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-3"
          >
            <LineChartIcon className="h-3.5 w-3.5" />{" "}
            {showEvolution ? "Ocultar evolução" : "Ver evolução"}
          </button>
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-3"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir / Exportar
          </button>
        </div>
        {saved && (
          <div className="mt-2 text-[10px] font-semibold text-clinical-stable">
            Avaliação salva em {fmtDateTime(saved)}.
          </div>
        )}
      </div>

      {/* Comparação */}
      {comparison.previous && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Comparação entre avaliações
          </div>
          <div className="grid gap-x-4 text-[11px] sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">SOFA anterior: </span>
              <span className="font-mono font-semibold">{comparison.previous.total ?? "N/I"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SOFA atual: </span>
              <span className="font-mono font-semibold">
                {comparison.current?.total ?? "N/I"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Δ SOFA: </span>
              <span className="font-mono font-semibold">
                {comparison.delta == null
                  ? "N/I"
                  : comparison.delta > 0
                    ? `+${comparison.delta}`
                    : comparison.delta}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-foreground">{deltaText(comparison.delta)}</div>
          <div className="mt-1 text-[10px] italic text-muted-foreground">
            A variação numérica não representa, isoladamente, melhora ou piora clínica.
          </div>
        </div>
      )}

      {/* Evolução: histórico + gráfico */}
      {showEvolution && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Histórico de avaliações
          </div>
          {history.length === 0 ? (
            <div className="rounded border border-dashed border-border p-2 text-[11px] italic text-muted-foreground">
              Nenhuma avaliação salva para este paciente.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border text-left uppercase tracking-wider text-muted-foreground">
                      <th className="py-1 pr-2">Data/hora</th>
                      <th className="pr-2">SOFA</th>
                      {SOFA_COMPONENTS.map((c) => (
                        <th key={c.key} className="pr-2">
                          {c.short}
                        </th>
                      ))}
                      <th className="pr-2">Round</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className="border-b border-border/50">
                        <td className="py-1 pr-2 font-mono">{fmtShort(a.at)}</td>
                        <td className="pr-2 font-mono font-bold">
                          {a.total ?? "N/I"}
                          {a.partial ? "*" : ""}
                        </td>
                        {SOFA_COMPONENTS.map((c) => (
                          <td key={c.key} className="pr-2 font-mono">
                            {a.scores[c.key] ?? "—"}
                          </td>
                        ))}
                        <td className="pr-2">{a.round ? `ROUND ${a.round}` : "—"}</td>
                        <td className="truncate">{a.by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[9px] italic text-muted-foreground">
                * SOFA parcialmente calculado (componente sem dado informado).
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "total" as const, label: "SOFA total", color: "hsl(var(--foreground))" },
                    ...SOFA_COMPONENTS.map((c) => ({
                      key: c.key,
                      label: c.label,
                      color: c.color,
                    })),
                  ] as { key: "total" | SofaComponentKey; label: string; color: string }[]
                ).map((s) => (
                  <label
                    key={s.key}
                    className="inline-flex items-center gap-1 text-[10px] text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={series[s.key]}
                      onChange={(e) => setSeries((p) => ({ ...p, [s.key]: e.target.checked }))}
                    />
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </label>
                ))}
              </div>

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, series.total ? 24 : 4]}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    {series.total && (
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="SOFA total"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2.6}
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    )}
                    {SOFA_COMPONENTS.filter((c) => series[c.key]).map((c) => (
                      <Line
                        key={c.key}
                        type="monotone"
                        dataKey={c.key}
                        name={c.label}
                        stroke={c.color}
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-x-4 text-[11px] sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Atual: </span>
                  <span className="font-mono font-semibold">
                    {comparison.current?.total ?? "N/I"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Anterior: </span>
                  <span className="font-mono font-semibold">
                    {comparison.previous?.total ?? "N/I"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Menor: </span>
                  <span className="font-mono font-semibold">{comparison.min?.total ?? "N/I"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Maior: </span>
                  <span className="font-mono font-semibold">{comparison.max?.total ?? "N/I"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Referências */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <button
          type="button"
          onClick={() => setShowRefs((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-surface-3"
        >
          <BookOpen className="h-3 w-3" /> {showRefs ? "Ocultar referências" : "Ver referências"}
        </button>
        {showRefs && (
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Referência metodológica
            </div>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Os critérios utilizados correspondem ao SOFA original publicado e às suas validações
              subsequentes.
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              {SOFA_REFERENCES.map((r) => (
                <li key={r.text} className="text-[10px] text-foreground">
                  {r.text}
                  {r.note && (
                    <span className="block italic text-muted-foreground">{r.note}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[10px] italic text-muted-foreground">
        {SOFA_DISCLAIMER}
      </div>
    </div>
  );
}

/** Modal com a calculadora completa. */
export function SofaCalculatorModal({
  open,
  onClose,
  patient,
  onSave,
  evaluator,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSave?: (p: Patient) => void;
  evaluator?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-clinical-neuro" />
            SOFA — {patient.name} · Leito {patient.bed}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <SofaCalculator patient={patient} onSave={onSave} evaluator={evaluator} />
        )}
      </DialogContent>
    </Dialog>
  );
}
