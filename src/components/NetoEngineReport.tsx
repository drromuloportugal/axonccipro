// Render do resultado do Motor Clínico dentro do assistente NETO.
// Determinístico: apenas exibe o que o motor calculou, com fontes e lacunas.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DOMAIN_LABEL,
  FASTHUG_STATUS_META,
  PRIORITY_META,
  type EngineResult,
} from "@/lib/clinicalEngine";

function Section({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[12px] border border-neto-line bg-neto-panel-strong p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neto-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neto-muted" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-neto-muted">
          {title}
        </span>
        {count != null && (
          <span className="ml-auto shrink-0 text-[10px] font-black !text-white">{count}</span>
        )}
      </button>
      {open && <div className="mt-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

interface Props {
  result: EngineResult;
  asking?: boolean;
  onDiscuss: (question: string) => void;
}

export function NetoEngineReport({ result, asking, onDiscuss }: Props) {
  return (
    <div className="neto-panel space-y-2 rounded-[18px] p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-neto-muted">
          Motor Clínico · {result.intentLabel}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-neto-muted">
          {new Date(result.generatedAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <p className="text-[11px] font-bold leading-relaxed !text-white">{result.summary}</p>

      {result.findings.length > 0 && (
        <Section title="Achados priorizados" count={result.findings.length} defaultOpen>
          {result.findings.map((f) => {
            const meta = PRIORITY_META[f.priority];
            return (
              <div key={f.code} className="space-y-1 rounded-[10px] border border-neto-line p-1.5">
                <p className="text-[11px] font-black leading-snug !text-white">
                  {meta.badge} {f.title}
                </p>
                <p className={`text-[10px] font-bold ${meta.className}`}>
                  {meta.label} · {DOMAIN_LABEL[f.domain]}
                </p>
                {f.why.length > 0 && (
                  <p className="text-[10px] leading-snug text-neto-muted">
                    POR QUE: {f.why.join("; ")}
                  </p>
                )}
                {f.recommendations.map((r, i) => (
                  <div key={i} className="space-y-0.5">
                    <p className="text-[10px] font-semibold leading-snug !text-white">→ {r.text}</p>
                    <p className="text-[10px] leading-snug text-neto-muted">
                      Monitorizar: {r.monitoring}
                    </p>
                    {r.evidence && (
                      <p className="text-[10px] leading-snug text-neto-muted">
                        📚 {r.evidence.society} {r.evidence.document} {r.evidence.version}
                        {r.evidence.strength ? ` · ${r.evidence.strength}` : ""}
                      </p>
                    )}
                    {r.institutional && (
                      <p className="text-[10px] leading-snug text-clinical-warning">
                        🏥 {r.institutional.name}: {r.institutional.statement}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </Section>
      )}

      {result.scores.length > 0 && (
        <Section title="Escores" count={result.scores.length}>
          {result.scores.map((s) => (
            <div key={s.key} className="space-y-0.5">
              <p className="text-[11px] font-bold leading-snug !text-white">
                {s.label}: {s.available ? (s.value ?? "—") : "DADO NÃO INFORMADO"}
              </p>
              <p className="text-[10px] leading-snug text-neto-muted">
                {s.available
                  ? [s.interpretation, s.components.map((c) => `${c.label} ${c.value}`).join(" · ")]
                      .filter(Boolean)
                      .join(" · ")
                  : `Faltam: ${s.missing.join(", ") || "dados"}`}
              </p>
            </div>
          ))}
        </Section>
      )}

      {result.fasthug.length > 0 && (
        <Section title="FASTHUG-MAIDENS" count={result.fasthug.length}>
          {result.fasthug.map((it) => (
            <div key={it.key} className="space-y-0.5">
              <p className="text-[11px] font-bold leading-snug !text-white">
                {FASTHUG_STATUS_META[it.status].badge} {it.letter} · {it.title} —{" "}
                {FASTHUG_STATUS_META[it.status].label}
              </p>
              <p className="text-[10px] leading-snug text-neto-muted">{it.assessment}</p>
              {it.suggestions.map((s, i) => (
                <p key={i} className="text-[10px] font-semibold leading-snug !text-white">
                  → {s}
                </p>
              ))}
            </div>
          ))}
        </Section>
      )}

      {result.plan.length > 0 && (
        <Section title={`Plano ${result.plan[0]?.window ?? "12 h"}`} count={result.plan.length}>
          {result.plan.map((t, i) => (
            <p key={i} className="text-[10px] font-semibold leading-snug !text-white">
              [{t.time}] {PRIORITY_META[t.priority].badge} {t.text}
            </p>
          ))}
        </Section>
      )}

      {result.missing.length > 0 && (
        <Section title="Dados faltantes" count={result.missing.length}>
          {result.missing.map((m) => (
            <p key={m.key} className="text-[10px] leading-snug text-neto-muted">
              <span className="font-bold !text-white">{m.label}:</span> {m.impact}
            </p>
          ))}
        </Section>
      )}

      {result.conflicts.length > 0 && (
        <Section title="Conflito entre diretrizes" count={result.conflicts.length}>
          {result.conflicts.map((c, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-[10px] font-bold leading-snug text-clinical-warning">
                ⚠️ {c.topic}
              </p>
              <p className="text-[10px] leading-snug text-neto-muted">
                Diretriz: {c.guideline} · Institucional: {c.institutional} · {c.resolution}
              </p>
            </div>
          ))}
        </Section>
      )}

      {result.inconclusive.length > 0 && (
        <Section title="Não é possível concluir" count={result.inconclusive.length}>
          {result.inconclusive.map((t, i) => (
            <p key={i} className="text-[10px] leading-snug text-neto-muted">
              {t}
            </p>
          ))}
        </Section>
      )}

      {result.guidelines.length > 0 && (
        <Section title="Diretrizes aplicáveis" count={result.guidelines.length}>
          {result.guidelines.map((g) => (
            <p key={g.code} className="text-[10px] leading-snug text-neto-muted">
              📚 {g.society} · {g.document} {g.version} ({g.year}) · {g.topic}
              {g.strength ? ` · ${g.strength}` : ""}
            </p>
          ))}
        </Section>
      )}

      {result.timeline.length > 0 && (
        <Section title="Linha do tempo" count={result.timeline.length}>
          {result.timeline.map((t, i) => (
            <p key={i} className="text-[10px] leading-snug text-neto-muted">
              {t.at ? new Date(t.at).toLocaleDateString("pt-BR") : "—"} · {t.label}
            </p>
          ))}
        </Section>
      )}

      {result.dataset.length > 0 && (
        <Section title="Dados utilizados" count={result.dataset.length}>
          {result.dataset.map((d) => (
            <p key={d.key} className="text-[10px] leading-snug text-neto-muted">
              {d.label}: <span className="font-bold !text-white">{d.value}</span> ({d.provenance})
            </p>
          ))}
        </Section>
      )}

      <Section title="Pipeline e auditoria" count={result.pipeline.length}>
        {result.pipeline.map((p, i) => (
          <p key={i} className="text-[10px] leading-snug text-neto-muted">
            {p}
          </p>
        ))}
      </Section>

      <Button
        type="button"
        variant="ghost"
        disabled={asking}
        onClick={() =>
          onDiscuss(
            `Discuta com base no Motor Clínico (${result.intentLabel}): ${result.summary} Achados: ${result.findings
              .map((f) => f.title)
              .join("; ")}. Justifique com evidência e aponte lacunas.`,
          )
        }
        className="h-7 w-full rounded-full px-2 text-[10px] font-bold text-neto-foreground hover:bg-neto-panel-strong"
      >
        Discutir com o especialista
      </Button>
    </div>
  );
}
