// Balão flutuante arrastável: aponta para uma informação do paciente e abre
// 4 raciocínios (2 sobre o caso, 2 acadêmicos) + opção de escrever, com chat flutuante.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, PenLine, Stethoscope, BookOpen, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { Patient } from "@/data/patients";
import { buildPassometroContext } from "@/lib/deepAnalysis";
import { askAboutCase, suggestInsightAngles } from "@/lib/api/deep-analysis.functions";
import netoAvatar from "@/assets/neto-avatar.png";

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

  useEffect(() => {
    setPos((p) => ({
      x: clamp(p.x, 8, window.innerWidth - 320),
      y: clamp(p.y, 8, window.innerHeight - 120),
    }));
  }, []);

  const patient =
    patients.find((p) => p.id === patientId) ?? patients.find((p) => p.id === currentPatientId);

  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    rootRef.current?.setPointerCapture?.(e.pointerId);
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
    for (
      let i = 0;
      i < 4 && (node.textContent ?? "").trim().length < 24 && node.parentElement;
      i++
    ) {
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
      className="fixed z-[80] select-none print:hidden"
      onPointerDown={startDrag}
      onPointerMove={onMove}
      onPointerUp={() => {
        const moved = dragRef.current?.moved;
        dragRef.current = null;
        if (!moved) void provoke();
      }}
    >
      <div
        className={`neto-glass relative touch-none cursor-grab text-neto-foreground transition-[width,padding,border-radius] duration-300 active:cursor-grabbing ${open ? "w-[330px] max-w-[92vw] rounded-[24px] p-3" : "h-14 w-14 cursor-pointer rounded-full"}`}
      >
        <span
          aria-hidden
          className={`neto-tail absolute ${open ? "-bottom-2 right-8 h-5 w-5" : "-right-1.5 top-1/2 h-3 w-3 -translate-y-1/2"}`}
        />

        <img
          src={netoAvatar}
          alt="Assistente"
          width={512}
          height={512}
          className={`pointer-events-none absolute z-10 object-contain drop-shadow-lg transition-all duration-300 ${open ? "-left-3 -top-5 h-[72px] w-[72px]" : "left-1/2 top-1/2 h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2"}`}
        />
        <span
          aria-hidden
          className={`absolute z-20 rounded-full border-2 border-neto-shell-deep bg-neto-online shadow-sm ${open ? "left-[45px] top-[38px] h-3.5 w-3.5" : "left-[34px] top-[34px] h-3 w-3"}`}
        />

        <Button
          type="button"
          onPointerDown={startDrag}
          variant="ghost"
          size="icon"
          className={`absolute cursor-grab text-neto-muted hover:bg-neto-panel active:cursor-grabbing ${open ? "left-[58px] top-1.5 h-6 w-6 opacity-60" : "inset-0 z-20 h-full w-full rounded-full opacity-0"}`}
          title="Arrastar o balão"
          aria-label="Arrastar o balão"
        >
          <GripVertical className={`h-3.5 w-3.5 ${open ? "" : "hidden"}`} />
        </Button>

        {open ? (
          <div className="flex min-h-[46px] items-center pl-[64px]">
            <span className="sr-only">Assistente</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="ml-auto h-7 w-7 rounded-full text-neto-muted hover:bg-neto-panel hover:text-neto-foreground"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="sr-only">Assistente</span>
        )}

        {open && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="mt-2 cursor-default space-y-2.5"
          >
            {patient && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neto-muted">
                {patient.bed} · {patient.name}
              </p>
            )}
            {loading && (
              <Shimmer className="text-[11px] text-neto-muted">
                Estruturando os raciocínios…
              </Shimmer>
            )}

            {angles.length > 0 && chat.length === 0 && (
              <div className="space-y-1.5">
                {angles.map((a, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="ghost"
                    onClick={() => void ask(a.question)}
                    disabled={asking}
                    className="neto-chip h-auto w-full justify-start whitespace-normal rounded-full px-3 py-2 text-left text-[11px] font-semibold leading-snug text-neto-foreground hover:bg-neto-panel-strong"
                  >
                    {a.kind === "case" ? (
                      <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neto-glow" />
                    ) : (
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neto-glow" />
                    )}
                    {a.label || a.question.slice(0, 60)}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWriting((v) => !v)}
                  className="neto-chip h-auto w-full justify-start rounded-full px-3 py-2 text-left text-[11px] font-semibold text-neto-foreground hover:bg-neto-panel-strong"
                >
                  <PenLine className="h-3.5 w-3.5 text-neto-glow" /> Escrever minha pergunta
                </Button>
              </div>
            )}

            {(chat.length > 0 || asking) && (
              <Conversation className="neto-panel max-h-[40vh] min-h-[96px] overflow-y-auto rounded-[18px]">
                <ConversationContent className="gap-2.5 p-2.5">
                  {chat.map((m, i) => (
                    <Message key={i} from={m.role} className="max-w-full">
                      <MessageContent
                        className={
                          m.role === "user"
                            ? "rounded-[15px] border border-neto-line bg-neto-panel-strong px-3 py-2 text-[11px] font-semibold text-neto-foreground"
                            : "px-1 py-1 text-[12px] font-bold leading-relaxed text-white"
                        }
                      >
                        <MessageResponse>{m.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}
                  {asking && (
                    <Shimmer className="text-[11px] text-neto-muted">
                      Consultando evidência…
                    </Shimmer>
                  )}
                </ConversationContent>
                <ConversationScrollButton className="border-neto-line bg-neto-panel-strong text-neto-foreground hover:bg-neto-panel" />
              </Conversation>
            )}

            {error && (
              <p className="rounded-[14px] border border-clinical-critical/60 bg-clinical-critical/20 px-3 py-2 text-[11px] font-semibold text-neto-foreground">
                {error}
              </p>
            )}

            {(writing || chat.length > 0) && (
              <PromptInput
                onSubmit={({ text }) => {
                  const q = text || question;
                  setQuestion("");
                  void ask(q);
                }}
                className="neto-panel overflow-hidden rounded-[20px] border-neto-line bg-transparent shadow-none"
              >
                <PromptInputTextarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={1}
                  placeholder="Escreva sua pergunta sobre esta informação…"
                  className="min-h-[42px] px-3.5 py-2 text-[11px] text-neto-foreground placeholder:text-neto-muted"
                />
                <PromptInputFooter className="justify-end px-2.5 pb-2.5 pt-0">
                  <PromptInputSubmit
                    status={asking ? "submitted" : undefined}
                    disabled={asking || !question.trim()}
                    aria-label="Enviar pergunta"
                    className="h-9 w-9 rounded-full bg-neto-glow text-neto-shell-deep shadow-md hover:bg-neto-glow/90"
                  />
                </PromptInputFooter>
              </PromptInput>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
