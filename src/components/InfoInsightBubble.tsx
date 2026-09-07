// Balão flutuante arrastável: aponta para uma informação do paciente e abre
// 4 raciocínios (2 sobre o caso, 2 acadêmicos) + opção de escrever, com chat flutuante.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2, X, Send, PenLine, Stethoscope, BookOpen, GripVertical } from "lucide-react";
import type { Patient } from "@/data/patients";
import { buildPassometroContext } from "@/lib/deepAnalysis";
import { askAboutCase, suggestInsightAngles } from "@/lib/api/deep-analysis.functions";

type Angle = { kind: "case" | "topic"; label: string; question: string };
type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  patients: Patient[];
  currentPatientId?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function InfoInsightBubble({ patients, currentPatientId }: Props) {
  const runAngles = useServerFn(suggestInsightAngles);
  const runAsk = useServerFn(askAboutCase);

  const [pos, setPos] = useState({ x: 24, y: 220 });
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState("");
  const [patientId, setPatientId] = useState<string | undefined>(currentPatientId);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<Msg[]>([]);
  const [asking, setAsking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [question, setQuestion] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPos((p) => ({ x: clamp(p.x, 8, window.innerWidth - 320), y: clamp(p.y, 8, window.innerHeight - 120) }));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, asking]);

  const patient = patients.find((p) => p.id === patientId) ?? patients.find((p) => p.id === currentPatientId);

  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = clamp(e.clientX - d.dx, 4, window.innerWidth - 60);
    const ny = clamp(e.clientY - d.dy, 4, window.innerHeight - 60);
    if (Math.abs(nx - pos.x) > 2 || Math.abs(ny - pos.y) > 2) d.moved = true;
    setPos({ x: nx, y: ny });
  };

  /** Lê a informação que está sob a quina apontadora (lado direito do balão). */
  const readPointedInfo = () => {
    const el = rootRef.current;
    if (!el) return { text: "", pid: currentPatientId };
    const rect = el.getBoundingClientRect();
    const x = clamp(rect.right + 12, 1, window.innerWidth - 2);
    const y = clamp(rect.top + 22, 1, window.innerHeight - 2);
    el.style.visibility = "hidden";
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    el.style.visibility = "";
    if (!target) return { text: "", pid: currentPatientId };
    const host = target.closest("[data-patient-id]") as HTMLElement | null;
    let node: HTMLElement = target;
    // sobe até um bloco com texto suficiente para dar contexto
    for (let i = 0; i < 4 && (node.textContent ?? "").trim().length < 24 && node.parentElement; i++) {
      node = node.parentElement;
    }
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 900);
    return { text, pid: host?.dataset.patientId ?? currentPatientId };
  };

  const provoke = async () => {
    if (dragRef.current?.moved) return;
    const { text, pid } = readPointedInfo();
    setPatientId(pid);
    setOpen(true);
    setWriting(false);
    setChat([]);
    setAngles([]);
    setError(null);
    setInfo(text);
    const p = patients.find((x) => x.id === pid) ?? patients.find((x) => x.id === currentPatientId);
    if (!text || !p) {
      setError("Aponte a quina do balão para uma informação do paciente e clique novamente.");
      return;
    }
    setLoading(true);
    try {
      const res = await runAngles({ data: { context: buildPassometroContext(p), info: text } });
      setAngles(res.angles as Angle[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao montar os raciocínios.");
    } finally {
      setLoading(false);
    }
  };

  const ask = async (q: string) => {
    const p = patient;
    if (!q.trim() || !p || asking) return;
    const withUser: Msg[] = [...chat, { role: "user", content: q.trim() }];
    setChat(withUser);
    setAsking(true);
    setError(null);
    try {
      const res = await runAsk({
        data: {
          context: buildPassometroContext(p),
          question: `Informação apontada no passômetro: "${info.slice(0, 700)}"\n\n${q.trim()}`,
          history: chat.slice(-8),
        },
      });
      setChat([...withUser, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao consultar a evidência.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div
      ref={rootRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[80] print:hidden"
      onPointerMove={onMove}
      onPointerUp={() => {
        const moved = dragRef.current?.moved;
        dragRef.current = null;
        if (!moved) void provoke();
      }}
    >
      <div
        className={`relative rounded-2xl border border-strong bg-card shadow-xl transition-all ${
          open ? "w-[340px] max-w-[92vw] p-3" : "w-auto p-2"
        }`}
      >
        {/* quina apontadora, à direita */}
        <span
          aria-hidden
          className="absolute -right-2 top-4 h-0 w-0 border-y-8 border-l-[10px] border-y-transparent border-l-primary"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={startDrag}
            className="cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            title="Arrastar o balão"
            aria-label="Arrastar o balão"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-bold text-foreground">
            {open ? "Raciocínio sobre a informação" : "Insight"}
          </span>
          {open && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="ml-auto rounded-md border border-border p-1 text-foreground hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {open && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="mt-2 space-y-2"
          >
            {patient && (
              <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                {patient.bed} · {patient.name}
              </p>
            )}
            {info && (
              <p className="rounded-md border border-border bg-surface-3/30 px-2 py-1.5 text-[11px] leading-snug text-foreground">
                {info.slice(0, 220)}
                {info.length > 220 ? "…" : ""}
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Estruturando os raciocínios…
              </div>
            )}

            {angles.length > 0 && (
              <div className="space-y-1.5">
                {angles.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void ask(a.question)}
                    disabled={asking}
                    className="flex w-full items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    {a.kind === "case" ? (
                      <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    {a.label || a.question.slice(0, 60)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWriting((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-left text-[11px] font-semibold text-foreground hover:bg-primary/15"
                >
                  <PenLine className="h-3.5 w-3.5 text-primary" /> Escrever minha pergunta
                </button>
              </div>
            )}

            {(chat.length > 0 || asking) && (
              <div className="max-h-[38vh] space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                {chat.map((m, i) =>
                  m.role === "user" ? (
                    <p key={i} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">
                      {m.content}
                    </p>
                  ) : (
                    <p key={i} className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
                      {m.content}
                    </p>
                  ),
                )}
                {asking && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando evidência…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {error && (
              <p className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-2 py-1.5 text-[11px] font-semibold text-clinical-critical">
                {error}
              </p>
            )}

            {(writing || chat.length > 0) && (
              <div className="flex items-end gap-1.5">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const q = question;
                      setQuestion("");
                      void ask(q);
                    }
                  }}
                  rows={2}
                  placeholder="Escreva sua pergunta sobre esta informação…"
                  className="min-h-[40px] flex-1 resize-y rounded-md border border-strong bg-white px-2 py-1.5 text-[11px] outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = question;
                    setQuestion("");
                    void ask(q);
                  }}
                  disabled={asking || !question.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
