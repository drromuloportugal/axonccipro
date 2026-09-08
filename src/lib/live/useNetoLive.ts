// Sessão de voz em tempo real do NETO (WebRTC + API Realtime da OpenAI).
// A chave da OpenAI nunca chega ao navegador: usamos token efêmero do backend.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createLiveSession,
  endLiveSession,
  logVoiceInteraction,
  runLiveTool,
} from "./live.functions";
import { LIVE_TOOLS, NETO_LIVE_INSTRUCTIONS, type LiveToolName } from "./tools";
import { CONFIRMATION_REQUIRED } from "./tools";

export type LiveStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "reconnecting";

export interface LiveTranscript {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface PendingConfirmation {
  callId: string;
  name: LiveToolName;
  args: Record<string, unknown>;
  question: string;
}

interface Options {
  patientId?: string;
  patientLabel?: string;
  /** Recebe as falas transcritas para guardar no histórico do chat textual. */
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onToolResult?: (name: LiveToolName, summary: string) => void;
}

const rid = () => Math.random().toString(36).slice(2);

export function useNetoLive({ patientId, patientLabel, onTranscript, onToolResult }: Options) {
  const openSession = useServerFn(createLiveSession);
  const closeSession = useServerFn(endLiveSession);
  const logVoice = useServerFn(logVoiceInteraction);
  const callTool = useServerFn(runLiveTool);

  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [level, setLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const speakingRef = useRef(false);
  const stoppingRef = useRef(false);

  const send = useCallback((payload: unknown) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(payload));
  }, []);

  const pushTranscript = useCallback(
    (role: "user" | "assistant", text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setTranscripts((t) => [...t, { id: rid(), role, text: clean }]);
      onTranscript?.(role, clean);
      void logVoice({
        data: {
          sessionId: sessionIdRef.current,
          patientId: patientId ?? null,
          role,
          transcript: clean,
        },
      }).catch(() => undefined);
    },
    [logVoice, onTranscript, patientId],
  );

  const teardown = useCallback(() => {
    if (analyserRef.current) {
      cancelAnimationFrame(analyserRef.current.raf);
      void analyserRef.current.ctx.close().catch(() => undefined);
      analyserRef.current = null;
    }
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    speakingRef.current = false;
    setLevel(0);
  }, []);

  const stop = useCallback(
    (reason = "user") => {
      stoppingRef.current = true;
      const id = sessionIdRef.current;
      teardown();
      sessionIdRef.current = null;
      setPending(null);
      setStatus("idle");
      if (id) void closeSession({ data: { sessionId: id, reason } }).catch(() => undefined);
      stoppingRef.current = false;
    },
    [closeSession, teardown],
  );

  /** Interrompe imediatamente a fala do NETO (barge-in). */
  const interrupt = useCallback(() => {
    if (!speakingRef.current) return;
    send({ type: "response.cancel" });
    if (audioRef.current) audioRef.current.currentTime = audioRef.current.duration || 0;
    speakingRef.current = false;
    setStatus("listening");
  }, [send]);

  const executeTool = useCallback(
    async (callId: string, name: LiveToolName, args: Record<string, unknown>) => {
      const res = await callTool({
        data: { name, args, patientId: patientId ?? "", sessionId: sessionIdRef.current },
      }).catch((e: unknown) => ({
        ok: false as const,
        summary: e instanceof Error ? e.message : "Falha na ferramenta.",
        requiresConfirmation: false,
        json: "null",
      }));

      onToolResult?.(name, res.summary);
      send({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: res.summary },
      });
      send({ type: "response.create" });
    },
    [callTool, onToolResult, patientId, send],
  );

  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = String(event["type"] ?? "");

      if (type === "input_audio_buffer.speech_started") {
        interrupt();
        setStatus("listening");
        return;
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        pushTranscript("user", String(event["transcript"] ?? ""));
        return;
      }
      if (type === "response.created") {
        setStatus("thinking");
        return;
      }
      if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        speakingRef.current = true;
        setStatus("speaking");
        return;
      }
      if (
        type === "response.output_audio_transcript.done" ||
        type === "response.audio_transcript.done"
      ) {
        pushTranscript("assistant", String(event["transcript"] ?? ""));
        return;
      }
      if (type === "response.done" || type === "response.output_audio.done") {
        speakingRef.current = false;
        setStatus("listening");
        return;
      }
      if (type === "response.function_call_arguments.done") {
        const name = String(event["name"] ?? "") as LiveToolName;
        const callId = String(event["call_id"] ?? "");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(event["arguments"] ?? "{}")) as Record<string, unknown>;
        } catch {
          args = {};
        }
        if (patientId && !args["patientId"]) args["patientId"] = patientId;

        if (CONFIRMATION_REQUIRED.includes(name) && args["confirmed"] !== true) {
          setPending({
            callId,
            name,
            args,
            question: `Confirmar: ${String(args["task"] ?? name)}${args["dueAt"] ? ` às ${String(args["dueAt"])}` : ""}?`,
          });
          send({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output:
                "Confirmação pendente do médico na tela. Peça a confirmação em voz alta e não grave nada agora.",
            },
          });
          send({ type: "response.create" });
          return;
        }
        void executeTool(callId, name, args);
        return;
      }
      if (type === "error") {
        const err = event["error"] as { message?: string } | undefined;
        setError(err?.message ?? "Erro na sessão de voz.");
      }
    },
    [executeTool, interrupt, patientId, pushTranscript, send],
  );

  const monitorLevel = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += (v - 128) * (v - 128);
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) / 24));
        const raf = requestAnimationFrame(tick);
        if (analyserRef.current) analyserRef.current.raf = raf;
      };
      analyserRef.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {
      // medidor é opcional
    }
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setError(null);
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("error");
      setError("Microfone bloqueado. Autorize o microfone no navegador para usar o NETO Live.");
      return;
    }
    streamRef.current = stream;

    try {
      const session = await openSession({ data: { patientId: patientId ?? "" } });
      sessionIdRef.current = session.sessionId;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0] ?? null;
        void audio.play().catch(() => undefined);
      };

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        send({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: `${NETO_LIVE_INSTRUCTIONS}\n\nPaciente ativo: ${patientLabel ?? "não informado"} (patientId="${patientId ?? ""}").`,
            tools: LIVE_TOOLS,
            tool_choice: "auto",
          },
        });
        setStatus("listening");
      };
      dc.onmessage = (e) => {
        try {
          handleEvent(JSON.parse(String(e.data)) as Record<string, unknown>);
        } catch {
          // evento não-JSON: ignorado
        }
      };

      pc.onconnectionstatechange = () => {
        if (stoppingRef.current) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setStatus("reconnecting");
          setError("Conexão instável. Encerre e reinicie o NETO Live.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answer = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(session.model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        },
      );
      if (!answer.ok) throw new Error(`Não foi possível negociar o áudio (${answer.status}).`);
      await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });

      monitorLevel(stream);
    } catch (e) {
      teardown();
      setStatus("error");
      setError(
        e instanceof Error
          ? e.message
          : "Modo voz indisponível — continuando no chat de texto do NETO.",
      );
    }
  }, [handleEvent, monitorLevel, openSession, patientId, patientLabel, send, status, teardown]);

  /** Confirma (ou recusa) a ferramenta que grava dados clínicos. */
  const resolvePending = useCallback(
    (approve: boolean) => {
      const p = pending;
      setPending(null);
      if (!p) return;
      if (!approve) {
        send({
          type: "conversation.item.create",
          item: {
            role: "user",
            type: "message",
            content: [{ type: "input_text", text: "Não confirmo essa reavaliação. Não registre." }],
          },
        });
        send({ type: "response.create" });
        return;
      }
      void executeTool(`${p.callId}-confirmed`, p.name, { ...p.args, confirmed: true });
    },
    [executeTool, pending, send],
  );

  /** Envia um comando de texto para a sessão de voz (ex.: ações rápidas). */
  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || status === "idle") return;
      interrupt();
      send({
        type: "conversation.item.create",
        item: { role: "user", type: "message", content: [{ type: "input_text", text }] },
      });
      send({ type: "response.create" });
      setStatus("thinking");
    },
    [interrupt, send, status],
  );

  useEffect(() => () => teardown(), [teardown]);

  return {
    status,
    error,
    transcripts,
    pending,
    level,
    active: status !== "idle" && status !== "error",
    start,
    stop,
    interrupt,
    sendText,
    resolvePending,
  };
}
