// Escala inteligente do próximo plantão — botão, modal, prioridades, tarefas,
// ICU Liberation, evidências, validação, histórico e encerramento do plantão.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X, RefreshCw, Loader2, Clock, CheckCircle2, Pencil, Save, Flag, History, BookOpen, Search, Copy, Download,
} from "lucide-react";
import type { Patient } from "@/data/patients";
import { buildPassometroContext } from "@/lib/deepAnalysis";
import { generateShiftSchedule, closeShiftReport } from "@/lib/api/deep-analysis.functions";
import {
  nextShiftWindow, shiftHoursLabel, extractTasks, SCCM_GUIDELINES, PRIORITY_META,
  type ShiftScheduleRecord, type ShiftTask,
} from "@/lib/shiftSchedule";

/** Botão destacado de escalonamento. */
export function ShiftEscalationButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-md border-2 border-primary bg-primary/15 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-foreground shadow-sm transition-colors hover:bg-primary/25 disabled:opacity-60"
      title="Gerar escala clínica para a próxima janela de plantão de 12 horas"
    >
      Escalar próximo plantão
    </button>
  );
}

const SECTION_RE = /^\s*(?:\*\*)?\d{1,2}\.\s+[^a-z]/;

/** Divide o texto da escala em cartões por seção numerada. */
function splitSections(text: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  let cur: { title: string; body: string } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\*\*/g, "").replace(/^#{1,6}\s*/, "");
    if (SECTION_RE.test(line) && line.trim().length < 90) {
      if (cur) out.push(cur);
      cur = { title: line.trim(), body: "" };
      continue;
    }
    if (!cur) cur = { title: "ESCALA CLÍNICA DO PRÓXIMO PLANTÃO", body: "" };
    cur.body += `${line}\n`;
  }
  if (cur) out.push(cur);
  return out;
}

function Body({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((raw, i) => {
        const line = raw.replace(/\*\*/g, "").trim();
        if (!line) return <div key={i} className="h-1" />;
        const strong = /^[A-ZÀ-Ú\s/·-]{4,}:?$/.test(line) && line.length < 70;
        return (
          <p key={i} className={strong ? "mt-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-foreground" : "text-[12.5px] leading-relaxed text-foreground"}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: Patient;
  onPatientChange?: (p: Patient) => void;
  /** Relato de caso já gerado na análise profunda (contexto adicional). */
  report?: string;
  userLabel?: string;
}

export function ShiftEscalationModal({ open, onClose, patient, onPatientChange, report, userLabel }: Props) {
  const runShift = useServerFn(generateShiftSchedule);
  const runClose = useServerFn(closeShiftReport);

  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  const window0 = useMemo(() => (open ? nextShiftWindow(new Date()) : null), [open]);

  const history = patient?.shiftSchedules ?? [];
  const current = history.find((s) => s.window.startISO === window0?.startISO) ?? history[0];
  const previous = history.find((s) => s.id !== current?.id && s.closingReport);

  const persist = (next: ShiftScheduleRecord) => {
    if (!patient || !onPatientChange) return;
    const rest = (patient.shiftSchedules ?? []).filter((s) => s.id !== next.id);
    onPatientChange({ ...patient, shiftSchedules: [next, ...rest].slice(0, 20) });
  };

  const generate = async () => {
    if (!patient || !window0) return;
    setLoading(true);
    setError(null);
    try {
      const context = buildPassometroContext(patient);
      const res = await runShift({
        data: {
          context,
          clinicalHistory: patient.clinicalHistory || undefined,
          report: report || patient.deepAnalysis?.report || undefined,
          windowLabel: window0.label,
          windowKind: window0.kind,
          windowHours: shiftHoursLabel(window0.kind),
          timeZone: window0.timeZone,
          previousShift: previous?.closingReport,
        },
      });
      const rec: ShiftScheduleRecord = {
        id: `${patient.id}-${window0.startISO}`,
        window: window0,
        content: res.schedule,
        originalContent: res.schedule,
        generatedAt: new Date().toISOString(),
        audit: {
          user: userLabel,
          patientId: patient.id,
          contextChars: context.length,
          guidelines: SCCM_GUIDELINES.map((g) => `${g.name} (${g.year})`),
        },
        tasks: extractTasks(res.schedule),
        version: (current?.version ?? 0) + 1,
        status: "rascunho",
      };
      persist(rec);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar a escala do próximo plantão.");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = () => {
    if (!current) return;
    persist({
      ...current,
      content: draft,
      edited: draft !== current.originalContent,
      version: current.version + 1,
      tasks: extractTasks(draft),
      status: current.status === "encerrada" ? "encerrada" : "rascunho",
    });
    setEditing(false);
  };

  const validate = () => {
    if (!current) return;
    persist({
      ...current,
      status: "validada",
      validatedAt: new Date().toISOString(),
      validatedBy: userLabel ?? "equipe",
    });
  };

  const toggleTask = (id: string) => {
    if (!current) return;
    persist({ ...current, tasks: current.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  };

  const addTask = (text: string) => {
    if (!current || !text.trim()) return;
    const task: ShiftTask = { id: `m${Date.now()}`, text: text.trim(), priority: "info" };
    persist({ ...current, tasks: [...current.tasks, task] });
  };

  const removeTask = (id: string) => {
    if (!current) return;
    persist({ ...current, tasks: current.tasks.filter((t) => t.id !== id) });
  };

  const closeShift = async () => {
    if (!patient || !current) return;
    setClosing(true);
    setError(null);
    try {
      const res = await runClose({
        data: {
          context: buildPassometroContext(patient),
          schedule: current.content,
          windowLabel: current.window.label,
          tasks: current.tasks.map((t) => ({ text: t.text, done: Boolean(t.done) })),
          notes: closingNotes || undefined,
        },
      });
      persist({ ...current, status: "encerrada", closedAt: new Date().toISOString(), closingReport: res.report });
      setClosingNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao encerrar o plantão.");
    } finally {
      setClosing(false);
    }
  };

  const copy = async () => {
    if (current) { try { await navigator.clipboard.writeText(current.content); } catch { /* ignore */ } }
  };

  const download = () => {
    if (!current || !patient) return;
    const blob = new Blob([current.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Escala plantao - ${patient.bed} - ${current.window.startISO.slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open || !window0) return null;

  const sections = current ? splitSections(current.content) : [];
  const diagnosis = patient?.diagnoses?.[patient.diagnoses.length - 1]?.label ?? "NÃO DISPONÍVEL";

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-background/98">
      <div className="mx-auto max-w-[1200px] px-3 py-4 sm:px-4">
        {/* Cabeçalho */}
        <div className="mb-3 rounded-lg border-2 border-strong bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[200px] flex-1">
              <h2 className="text-[16px] font-bold text-foreground">Escala do próximo plantão</h2>
              <p className="mt-0.5 text-[12px] text-foreground">
                {patient?.name ?? "—"} · Leito <span className="font-mono font-semibold">{patient?.bed ?? "—"}</span> · {diagnosis}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-foreground">
                Plantão {window0.kind} · {shiftHoursLabel(window0.kind)}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                ESCALA PREPARADA PARA: {window0.label} ({window0.timeZone})
              </p>
              {current && (
                <p className="text-[11px] text-muted-foreground">
                  Gerada em {new Date(current.generatedAt).toLocaleString("pt-BR")} · versão {current.version} ·{" "}
                  {current.status === "validada" ? "validada" : current.status === "encerrada" ? "encerrada" : "rascunho — revisão médica pendente"}
                  {current.edited ? " · editada" : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={loading || !patient}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {loading ? "Analisando…" : current ? "Gerar novamente" : "Gerar escala"}
              </button>
              <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-strong bg-muted hover:bg-muted/70" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {current && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">
              {!editing ? (
                <button type="button" onClick={() => { setDraft(current.content); setEditing(true); }} className="inline-flex items-center gap-1.5 rounded-md border border-strong px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" /> Editar escala
                </button>
              ) : (
                <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1.5 rounded-md border border-strong bg-muted px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted/70">
                  <Save className="h-3.5 w-3.5" /> Salvar edição
                </button>
              )}
              <button type="button" onClick={validate} className="inline-flex items-center gap-1.5 rounded-md border border-strong px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted">
                <CheckCircle2 className="h-3.5 w-3.5" /> Validar escala
              </button>
              <button type="button" onClick={() => setShowEvidence((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-strong px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted">
                <Search className="h-3.5 w-3.5" /> Ver evidências
              </button>
              <button type="button" onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-strong px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted">
                <History className="h-3.5 w-3.5" /> Histórico
              </button>
              <button type="button" onClick={copy} className="rounded-md border border-strong p-1.5 hover:bg-muted" title="Copiar"><Copy className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={download} className="rounded-md border border-strong p-1.5 hover:bg-muted" title="Baixar"><Download className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-2 text-[12px] font-semibold text-clinical-critical">{error}</div>
        )}

        {!current && !loading && (
          <p className="rounded-lg border border-strong bg-card p-4 text-[12.5px] text-foreground">
            A escala é construída a partir de todo o passômetro — relato clínico, história clínica registrada, sinais vitais
            seriados, exames, gasometria, imagem, medicações, procedimentos, dispositivos, tendências e eventos das últimas
            24–72 horas — com ICU Liberation A-F e referências SCCM. Apoio à decisão: não prescreve nem substitui avaliação médica.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-lg border border-strong bg-card p-4 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando contexto, tendências, intervenções, respostas, riscos e ICU Liberation…
          </div>
        )}

        {/* Evidências / auditoria */}
        {current && showEvidence && (
          <div className="mb-3 rounded-lg border border-strong bg-card p-3">
            <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-foreground">Evidências e auditoria</h3>
            <p className="text-[11.5px] text-muted-foreground">
              Dados utilizados: passômetro completo deste paciente ({current.audit.contextChars} caracteres){current.audit.user ? ` · usuário ${current.audit.user}` : ""} ·
              janela {current.window.label} · geração {new Date(current.generatedAt).toLocaleString("pt-BR")}
            </p>
            <ul className="mt-2 space-y-1">
              {SCCM_GUIDELINES.map((g) => (
                <li key={g.url} className="text-[12px]">
                  <BookOpen className="mr-1 inline h-3.5 w-3.5" />
                  {g.name} — {g.year} ·{" "}
                  <a href={g.url} target="_blank" rel="noreferrer" className="underline">{g.url}</a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Referências específicas de cada prioridade constam na seção 20 da escala. Referência não localizada é declarada como tal — nunca criada.
            </p>
          </div>
        )}

        {/* Histórico de escalas */}
        {showHistory && (
          <div className="mb-3 rounded-lg border border-strong bg-card p-3">
            <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-foreground">Histórico de escalas</h3>
            {history.length === 0 && <p className="text-[12px] text-muted-foreground">Nenhuma escala registrada.</p>}
            <ul className="space-y-1">
              {history.map((s) => (
                <li key={s.id} className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[12px]">
                  {s.window.label} · plantão {s.window.kind} · {new Date(s.generatedAt).toLocaleString("pt-BR")} ·{" "}
                  {s.validatedBy ? `validada por ${s.validatedBy}` : "sem validação"} · {s.status}
                  {s.closingReport ? " · encerrada" : ""}
                </li>
              ))}
            </ul>
            {previous?.closingReport && (
              <div className="mt-2 rounded-md border border-border bg-surface-3/40 p-2.5">
                <h4 className="mb-1 text-[11.5px] font-bold uppercase text-foreground">Plantão anterior — encerramento</h4>
                <Body text={previous.closingReport} />
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da escala */}
        {current && editing && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={30}
            className="mb-3 w-full rounded-lg border border-strong bg-white p-3 font-mono text-[12px] outline-none focus:border-primary"
          />
        )}

        {current && !editing && (
          <div className="grid gap-3 lg:grid-cols-2">
            {sections.map((s, i) => (
              <section key={i} className={`rounded-lg border border-strong bg-card p-3 shadow-sm ${i < 3 ? "lg:col-span-2" : ""}`}>
                <h3 className="mb-1.5 rounded-md bg-primary/12 px-2.5 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-foreground">
                  {s.title}
                </h3>
                <Body text={s.body} />
              </section>
            ))}
          </div>
        )}

        {/* Tarefas / pendências editáveis */}
        {current && (
          <div className="mt-3 rounded-lg border border-strong bg-card p-3">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-foreground">Tarefas e pendências do plantão</h3>
            <ul className="space-y-1">
              {current.tasks.map((t) => (
                <li key={t.id} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[12px] ${PRIORITY_META[t.priority].cls}`}>
                  <input type="checkbox" checked={Boolean(t.done)} onChange={() => toggleTask(t.id)} className="mt-0.5" />
                  <span className={t.done ? "flex-1 line-through opacity-70" : "flex-1"}>
                    {PRIORITY_META[t.priority].dot} {t.text}
                    {t.time ? ` · ${t.time}` : ""}
                  </span>
                  <button type="button" onClick={() => removeTask(t.id)} className="text-muted-foreground hover:text-clinical-critical" title="Excluir">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {current.tasks.length === 0 && <li className="text-[12px] text-muted-foreground">Nenhuma pendência extraída.</li>}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("task") as HTMLInputElement | null;
                if (input) { addTask(input.value); input.value = ""; }
              }}
            >
              <input name="task" placeholder="Adicionar tarefa ou observação…" className="flex-1 rounded-md border border-strong bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-primary" />
              <button type="submit" className="rounded-md border border-strong px-2.5 py-1.5 text-[12px] font-semibold hover:bg-muted">Adicionar</button>
            </form>
          </div>
        )}

        {/* Encerramento */}
        {current && (
          <div className="mt-3 rounded-lg border border-strong bg-card p-3">
            <h3 className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-foreground">
              <Flag className="h-3.5 w-3.5" /> Encerrar plantão
            </h3>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={3}
              placeholder="Observações da equipe sobre o plantão (opcional)…"
              className="w-full rounded-md border border-strong bg-white px-2.5 py-2 text-[12px] outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void closeShift()}
              disabled={closing}
              className="mt-2 inline-flex items-center gap-2 rounded-md border-2 border-strong bg-muted px-3 py-2 text-[12px] font-bold hover:bg-muted/70 disabled:opacity-60"
            >
              {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              {closing ? "Gerando encerramento…" : "Encerrar plantão e preparar handoff"}
            </button>
            {current.closingReport && (
              <div className="mt-2 rounded-md border border-border bg-surface-3/40 p-2.5">
                <Body text={current.closingReport} />
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Apoio à decisão clínica: a escala não prescreve, não suspende medicamentos, não determina alta ou limitação
          terapêutica e não substitui exame físico, avaliação médica ou protocolos institucionais.
        </p>
      </div>
    </div>
  );
}
