// Análise profunda — relato clínico evolutivo lido por intensivista neurológico
// a partir do passômetro, com chat clínico baseado em evidência (OpenEvidence).

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X, Brain, Loader2, RefreshCw, Copy, Download, Send, MessageSquare, FileText, Stethoscope,
} from "lucide-react";
import type { Patient } from "@/data/patients";
import { buildPassometroContext } from "@/lib/deepAnalysis";
import { generateCaseReport, askAboutCase } from "@/lib/api/deep-analysis.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  initialPatientId?: string;
  onPersist?: (patientId: string, deep: NonNullable<Patient["deepAnalysis"]>) => void;
}

const EVIDENCE_URL = "https://www.openevidence.com";

type Mode = "report" | "handoff" | "changes" | "concerns" | "working" | "notworking";

const MODES: { key: Mode; label: string; title: string }[] = [
  { key: "report", label: "Relato de caso", title: "Relato clínico evolutivo + análise multissistêmica" },
  { key: "handoff", label: "Passagem de plantão", title: "Passagem de plantão estruturada com ICU Liberation A-F" },
  { key: "changes", label: "O que mudou?", title: "Alterações clinicamente relevantes priorizadas" },
  { key: "concerns", label: "Por que estou preocupado?", title: "Achados que justificam atenção, com evidências" },
  { key: "working", label: "O que está funcionando?", title: "Intervenções com resposta favorável documentada" },
  { key: "notworking", label: "O que não está funcionando?", title: "Aumento de suporte sem melhora proporcional" },
];

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Render leve de markdown (títulos, negrito, listas) sem dependências novas. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s*/, "");
        const isHeading =
          /^#{1,6}\s/.test(raw) ||
          (raw.trim().length > 0 && raw.trim() === raw.trim().toUpperCase() && /[A-ZÀ-Ú]{4,}/.test(raw.trim()) && raw.trim().length < 90);
        const isBullet = /^\s*[-*•]\s+/.test(raw);
        const isNumber = /^\s*\d+[.)]\s+/.test(raw);

        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (isHeading) {
          return (
            <h4 key={i} className="mt-3 rounded-md bg-primary/10 px-2.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-foreground">
              {line.trim()}
            </h4>
          );
        }
        if (isBullet || isNumber) {
          return (
            <p key={i} className="pl-4 text-[13px] leading-relaxed text-foreground">
              {line.trim()}
            </p>
          );
        }
        return (
          <p key={i} className="text-[13px] leading-relaxed text-foreground">
            {line.trim()}
          </p>
        );
      })}
    </div>
  );
}

export function DeepAnalysisPanel({ open, onClose, patients, initialPatientId, onPersist }: Props) {
  const runReport = useServerFn(generateCaseReport);
  const runAsk = useServerFn(askAboutCase);

  const selectable = useMemo(
    () => patients.filter((p) => !p.archived).sort((a, b) => a.bed.localeCompare(b.bed, "pt-BR", { numeric: true })),
    [patients],
  );

  const [patientId, setPatientId] = useState<string>(initialPatientId ?? selectable[0]?.id ?? "");
  const [report, setReport] = useState<string>("");
  const [reportAt, setReportAt] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("report");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const patient = useMemo(() => selectable.find((p) => p.id === patientId), [selectable, patientId]);

  useEffect(() => {
    if (open && initialPatientId) setPatientId(initialPatientId);
  }, [open, initialPatientId]);

  // Carrega o último relato e a conversa salvos neste paciente
  useEffect(() => {
    const saved = patients.find((p) => p.id === patientId)?.deepAnalysis;
    setReport(saved?.report ?? "");
    setReportAt(saved?.reportAt ? new Date(saved.reportAt) : null);
    setChat((saved?.chat ?? []) as ChatMessage[]);
    setError(null);
    setChatError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, asking]);

  const generate = async () => {
    if (!patient) return;
    setLoading(true);
    setError(null);
    setReport("");
    try {
      const res = await runReport({ data: { context: buildPassometroContext(patient) } });
      const at = new Date();
      setReport(res.report);
      setReportAt(at);
      onPersist?.(patient.id, {
        report: res.report,
        reportAt: at.toISOString(),
        chat,
        chatAt: patient.deepAnalysis?.chatAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o relato.");
    } finally {
      setLoading(false);
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || !patient || asking) return;
    setQuestion("");
    setChatError(null);
    const withUser: ChatMessage[] = [...chat, { role: "user", content: q }];
    setChat(withUser);
    setAsking(true);
    try {
      const res = await runAsk({
        data: {
          context: buildPassometroContext(patient),
          report: report || undefined,
          question: q,
          history: chat.slice(-10),
        },
      });
      const next: ChatMessage[] = [...withUser, { role: "assistant", content: res.answer }];
      setChat(next);
      onPersist?.(patient.id, {
        report: report || undefined,
        reportAt: reportAt?.toISOString(),
        chat: next,
        chatAt: new Date().toISOString(),
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Falha ao consultar o especialista.");
    } finally {
      setAsking(false);
    }
  };

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(report); } catch { /* ignore */ }
  };

  const downloadReport = () => {
    if (!patient) return;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relato Clinico Evolutivo - ${patient.bed} - ${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        {/* Cabeçalho */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-strong bg-card p-4 shadow-sm">
          <Brain className="h-6 w-6 text-primary" />
          <div className="min-w-[220px] flex-1">
            <h2 className="text-[17px] font-bold text-foreground">Análise profunda — relato de caso</h2>
            <p className="text-[11px] text-muted-foreground">
              Leitura do passômetro por intensivista neurológico · evidência consultada em{" "}
              <a href={EVIDENCE_URL} target="_blank" rel="noreferrer" className="underline">
                openevidence.com
              </a>
            </p>
          </div>

          <label className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            Paciente
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="rounded-md border border-strong bg-white px-2 py-1.5 text-[12px] outline-none focus:border-primary"
            >
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.bed} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={loading || !patient}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : report ? <RefreshCw className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? "Analisando o passômetro…" : report ? "Gerar novamente" : "Gerar relato de caso"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-strong bg-muted text-foreground transition-colors hover:bg-muted/70"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Relato */}
          <section className="rounded-lg border border-strong bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Relato clínico evolutivo</h3>
              {report && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{reportAt?.toLocaleString("pt-BR")}</span>
                  <button type="button" onClick={copyReport} className="rounded-md border border-border p-1.5 hover:bg-muted" title="Copiar">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={downloadReport} className="rounded-md border border-border p-1.5 hover:bg-muted" title="Baixar">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-3 rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-2 text-[12px] font-semibold text-clinical-critical">
                {error}
              </div>
            )}

            {!report && !loading && !error && (
              <p className="text-[12px] text-muted-foreground">
                Selecione o paciente e gere o relato. A análise reconstrói a trajetória clínica de forma cronológica e
                contextualizada, com impressão do intensivista, problemas ativos e plano atual, sem inventar dados
                ausentes do passômetro.
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reconstruindo a história clínica do paciente…
              </div>
            )}

            {report && <RichText text={report} />}
          </section>

          {/* Chat */}
          <section className="flex max-h-[75vh] flex-col rounded-lg border border-strong bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Consulta ao especialista</h3>
            </div>

            <div className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {chat.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Pergunte sobre o caso — conduta, diagnóstico diferencial, escores, vasoespasmo, sedação, sódio,
                  antimicrobianos, prognóstico. As respostas são fundamentadas nos dados deste paciente e em evidência
                  consultada em openevidence.com, com referências ao final.
                </p>
              )}
              {chat.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-6 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-[12px] font-semibold text-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="rounded-md border border-border bg-surface-3/40 px-3 py-2">
                    <RichText text={m.content} />
                  </div>
                ),
              )}
              {asking && (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando evidência e formulando a resposta…
                </div>
              )}
              {chatError && (
                <div className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-2 text-[12px] font-semibold text-clinical-critical">
                  {chatError}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-end gap-2 border-t border-border pt-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                rows={2}
                placeholder="Pergunte sobre o caso deste paciente…"
                className="min-h-[46px] flex-1 resize-y rounded-md border border-strong bg-white px-2.5 py-2 text-[12px] outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => void ask()}
                disabled={asking || !question.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
