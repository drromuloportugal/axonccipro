// Análise profunda — relato clínico evolutivo lido por intensivista neurológico
// a partir do passômetro, com chat clínico baseado em evidência (OpenEvidence).

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X, Brain, Loader2, RefreshCw, Copy, Download, Send, MessageSquare, FileText, Stethoscope, Trash2, Mic, Upload,
} from "lucide-react";
import type { Patient } from "@/data/patients";
import { buildPassometroContext } from "@/lib/deepAnalysis";
import { generateCaseReport, askAboutCase } from "@/lib/api/deep-analysis.functions";
import { transcribeVoice } from "@/lib/live/voice.functions";
import { ShiftEscalationButton, ShiftEscalationModal } from "@/components/ShiftEscalationModal";

interface Props {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  initialPatientId?: string;
  onPersist?: (patientId: string, deep: NonNullable<Patient["deepAnalysis"]>) => void;
  onPatientChange?: (p: Patient) => void;
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

const modeLabel = (key: string) => MODES.find((m) => m.key === key)?.label ?? "Relato de caso";

type ChatMessage = { role: "user" | "assistant"; content: string; id?: string };
type ReportItem = { id: string; mode: string; at: string; content: string };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

export function DeepAnalysisPanel({ open, onClose, patients, initialPatientId, onPersist, onPatientChange }: Props) {
  const runReport = useServerFn(generateCaseReport);
  const runAsk = useServerFn(askAboutCase);
  const runTranscribe = useServerFn(transcribeVoice);

  const selectable = useMemo(
    () => patients.filter((p) => !p.archived).sort((a, b) => a.bed.localeCompare(b.bed, "pt-BR", { numeric: true })),
    [patients],
  );

  const [patientId, setPatientId] = useState<string>(initialPatientId ?? selectable[0]?.id ?? "");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [mode, setMode] = useState<Mode>("report");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileVoiceRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const patient = useMemo(() => selectable.find((p) => p.id === patientId), [selectable, patientId]);
  const latest = reports[0];

  useEffect(() => {
    if (open && initialPatientId) setPatientId(initialPatientId);
  }, [open, initialPatientId]);

  // Carrega os relatórios e a conversa salvos neste paciente
  useEffect(() => {
    const saved = patients.find((p) => p.id === patientId)?.deepAnalysis;
    const list: ReportItem[] = saved?.reports?.length
      ? saved.reports
      : saved?.report
        ? [{ id: newId(), mode: "report", at: saved.reportAt ?? new Date().toISOString(), content: saved.report }]
        : [];
    setReports(list);
    setChat(((saved?.chat ?? []) as ChatMessage[]).map((m) => ({ ...m, id: m.id ?? newId() })));
    setError(null);
    setChatError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, asking]);

  const persist = (nextReports: ReportItem[], nextChat: ChatMessage[]) => {
    if (!patient) return;
    onPersist?.(patient.id, {
      report: nextReports[0]?.content,
      reportAt: nextReports[0]?.at,
      reports: nextReports,
      chat: nextChat,
      chatAt: nextChat.length ? new Date().toISOString() : undefined,
    });
  };

  const generate = async (m: Mode = mode) => {
    if (!patient) return;
    setMode(m);
    setLoading(true);
    setError(null);
    try {
      const res = await runReport({ data: { context: buildPassometroContext(patient), mode: m } });
      const item: ReportItem = { id: newId(), mode: m, at: new Date().toISOString(), content: res.report };
      const next = [item, ...reports];
      setReports(next);
      persist(next, chat);
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
    const withUser: ChatMessage[] = [...chat, { id: newId(), role: "user", content: q }];
    setChat(withUser);
    setAsking(true);
    try {
      const res = await runAsk({
        data: {
          context: buildPassometroContext(patient),
          report: latest?.content || undefined,
          question: q,
          history: chat.slice(-10).map(({ role, content }) => ({ role, content })),
        },
      });
      const next: ChatMessage[] = [...withUser, { id: newId(), role: "assistant", content: res.answer }];
      setChat(next);
      persist(reports, next);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Falha ao consultar o especialista.");
    } finally {
      setAsking(false);
    }
  };

  const deleteReport = (id: string) => {
    if (!window.confirm("Apagar este relatório?")) return;
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    persist(next, chat);
  };

  const deleteMessage = (id?: string) => {
    if (!id) return;
    if (!window.confirm("Apagar esta mensagem da conversa?")) return;
    const next = chat.filter((m) => m.id !== id);
    setChat(next);
    persist(reports, next);
  };

  const deleteChat = () => {
    if (!window.confirm("Apagar toda a conversa com o especialista deste paciente?")) return;
    setChat([]);
    setChatError(null);
    persist(reports, []);
  };

  const copyReport = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  const downloadReport = (r: ReportItem) => {
    if (!patient) return;
    const blob = new Blob([r.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modeLabel(r.mode)} - ${patient.bed} - ${r.at.slice(0, 10)}.txt`;
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
            onClick={() => void generate(mode)}
            disabled={loading || !patient}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : reports.length ? <RefreshCw className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? "Analisando o passômetro…" : reports.length ? "Gerar novo relatório" : "Gerar análise"}
          </button>
        </div>

        {/* Modos do motor de análise */}
        <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-strong bg-card p-3 shadow-sm">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              title={m.title}
              disabled={loading || !patient}
              onClick={() => void generate(m.key)}
              className={`rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                mode === m.key
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-strong bg-muted text-foreground transition-colors hover:bg-muted/70"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>


        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Relatos */}
          <section className="rounded-lg border border-strong bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Relatórios gerados</h3>
              {reports.length > 0 && (
                <span className="ml-auto text-[11px] text-muted-foreground">{reports.length} salvo(s)</span>
              )}
            </div>

            {error && (
              <div className="mb-3 rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-2 text-[12px] font-semibold text-clinical-critical">
                {error}
              </div>
            )}

            {reports.length === 0 && !loading && !error && (
              <p className="text-[12px] text-muted-foreground">
                Selecione o paciente e gere o relato. A análise reconstrói a trajetória clínica de forma cronológica e
                contextualizada, com impressão do intensivista, problemas ativos e plano atual, sem inventar dados
                ausentes do passômetro.
              </p>
            )}

            {loading && (
              <div className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reconstruindo a história clínica do paciente…
              </div>
            )}

            <div className="space-y-4">
              {reports.map((r) => (
                <article key={r.id} className="rounded-md border border-border bg-surface-3/30 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary/15 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-foreground">
                      {modeLabel(r.mode)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{new Date(r.at).toLocaleString("pt-BR")}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button type="button" onClick={() => void copyReport(r.content)} className="rounded-md border border-border p-1.5 hover:bg-muted" title="Copiar">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => downloadReport(r)} className="rounded-md border border-border p-1.5 hover:bg-muted" title="Baixar">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteReport(r.id)}
                        className="rounded-md border border-clinical-critical/40 p-1.5 text-clinical-critical hover:bg-clinical-critical/10"
                        title="Apagar este relatório"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <RichText text={r.content} />
                </article>
              ))}
            </div>
          </section>

          {/* Chat */}
          <section className="flex max-h-[75vh] flex-col rounded-lg border border-strong bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Consulta ao especialista</h3>
              <div className="ml-auto flex items-center gap-2">
                {chat.length > 0 && (
                  <button
                    type="button"
                    onClick={deleteChat}
                    className="rounded-md border border-clinical-critical/40 p-1.5 text-clinical-critical hover:bg-clinical-critical/10"
                    title="Apagar toda a conversa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <ShiftEscalationButton onClick={() => setShiftOpen(true)} disabled={!patient} />
              </div>
            </div>

            <div className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {chat.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Pergunte sobre o caso — conduta, diagnóstico diferencial, escores, vasoespasmo, sedação, sódio,
                  antimicrobianos, prognóstico. As respostas são fundamentadas nos dados deste paciente e em evidência
                  consultada em openevidence.com, com referências ao final.
                </p>
              )}
              {chat.map((m) => (
                <div key={m.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => deleteMessage(m.id)}
                    className="absolute right-1 top-1 hidden rounded-md border border-clinical-critical/40 bg-card p-1 text-clinical-critical group-hover:block"
                    title="Apagar esta mensagem"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {m.role === "user" ? (
                    <div className="ml-6 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 pr-9 text-[12px] font-semibold text-foreground">
                      {m.content}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-surface-3/40 px-3 py-2 pr-9">
                      <RichText text={m.content} />
                    </div>
                  )}
                </div>
              ))}
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
              <input
                ref={fileVoiceRef}
                type="file"
                accept="audio/*,.ogg,.mp3,.wav,.webm,.m4a"
                className="hidden"
                onChange={handleAudioUpload}
              />
              <button
                type="button"
                onClick={toggleVoiceRecord}
                disabled={transcribingAudio}
                title={recordingAudio ? "Parar gravação" : "Falar pergunta por microfone"}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold transition-colors ${
                  recordingAudio
                    ? "bg-clinical-critical text-white animate-pulse"
                    : "border border-border bg-surface-2 text-foreground hover:bg-surface-3"
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
                {recordingAudio ? "Gravando…" : "Voz"}
              </button>
              <button
                type="button"
                onClick={() => fileVoiceRef.current?.click()}
                disabled={transcribingAudio}
                title="Enviar áudio (WhatsApp PTT .ogg, .wav, .mp3)"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-3 disabled:opacity-60"
              >
                {transcribingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Áudio
              </button>
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

      <ShiftEscalationModal
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        patient={patient}
        onPatientChange={onPatientChange}
        report={latest?.content ?? ""}
      />
    </div>
  );
}
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranscribingAudio(true);
    setChatError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      const res = await runTranscribe({
        data: { audioBase64: btoa(binary), mimeType: file.type || "audio/ogg" },
      });
      if (res.text) {
        setQuestion((prev) => (prev ? `${prev} ${res.text}` : res.text));
      } else {
        setChatError("Nenhuma fala detectada no áudio enviado.");
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Falha na transcrição do áudio.");
    } finally {
      setTranscribingAudio(false);
      if (fileVoiceRef.current) fileVoiceRef.current.value = "";
    }
  };

  const toggleVoiceRecord = async () => {
    if (recordingAudio) {
      mediaRecorderRef.current?.stop();
      setRecordingAudio(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribingAudio(true);
        try {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          bytes.forEach((b) => {
            binary += String.fromCharCode(b);
          });
          const res = await runTranscribe({
            data: { audioBase64: btoa(binary), mimeType: blob.type },
          });
          if (res.text) {
            setQuestion((prev) => (prev ? `${prev} ${res.text}` : res.text));
          }
        } catch (err: unknown) {
          setChatError(err instanceof Error ? err.message : "Falha na transcrição da voz.");
        } finally {
          setTranscribingAudio(false);
        }
      };
      recorder.start();
      setRecordingAudio(true);
    } catch {
      setChatError("Microfone indisponível ou permissão negada.");
    }
  };
