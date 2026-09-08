// Voz do NETO por turnos (Gemini para ouvir, Motor Clínico para decidir, fala em áudio).
// Nenhuma chave de IA chega ao navegador: tudo passa pelas funções de servidor.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  askNetoVoice,
  speakNetoVoice,
  startVoiceSession,
  transcribeVoice,
} from "./voice.functions";
import { endLiveSession, runLiveTool } from "./live.functions";
import type { LiveToolName } from "./tools";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceTranscript {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface VoicePending {
  task: string;
  dueAt: string;
  question: string;
}

interface Options {
  patientId?: string;
  patientLabel?: string;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onToolResult?: (name: LiveToolName, summary: string) => void;
}

const rid = () => Math.random().toString(36).slice(2);
const TARGET_RATE = 16000;
const SILENCE_MS = 1200;
const MIN_SPEECH_MS = 400;

/** PCM float mono -> WAV 16 bit (arquivo completo, aceito pela transcrição). */
function encodeWav(chunks: Float32Array[], sourceRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const ratio = Math.max(1, Math.floor(sourceRate / TARGET_RATE));
  const outRate = Math.round(sourceRate / ratio);
  const length = Math.floor(merged.length / ratio);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const str = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, merged[i * ratio] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o áudio gravado."));
    reader.readAsDataURL(blob);
  });

export function useNetoVoice({ patientId, patientLabel, onTranscript, onToolResult }: Options) {
  const openSession = useServerFn(startVoiceSession);
  const closeSession = useServerFn(endLiveSession);
  const transcribe = useServerFn(transcribeVoice);
  const ask = useServerFn(askNetoVoice);
  const speak = useServerFn(speakNetoVoice);
  const callTool = useServerFn(runLiveTool);

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [pending, setPending] = useState<VoicePending | null>(null);
  const [level, setLevel] = useState(0);
  const [voice, setVoice] = useState<"alloy" | "shimmer">("alloy");
  const [spoken, setSpoken] = useState(true);

  const activeRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speakingSinceRef = useRef(0);
  const silenceSinceRef = useRef(0);
  const busyRef = useRef(false);
  const spokenRef = useRef(true);
  const voiceRef = useRef<"alloy" | "shimmer">("alloy");

  useEffect(() => {
    spokenRef.current = spoken;
    voiceRef.current = voice;
  }, [spoken, voice]);

  const push = useCallback(
    (role: "user" | "assistant", text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setTranscripts((t) => [...t, { id: rid(), role, text: clean }]);
      onTranscript?.(role, clean);
    },
    [onTranscript],
  );

  /** Interrompe a fala do NETO imediatamente (barge-in). */
  const interrupt = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.src = "";
      audioRef.current = null;
      if (activeRef.current) setStatus("listening");
    }
  }, []);

  const playSpeech = useCallback(
    async (text: string) => {
      if (!spokenRef.current) return;
      const audio = await speak({ data: { text, voice: voiceRef.current } });
      if (!audio.audioBase64 || !activeRef.current) return;
      const el = new Audio(`data:${audio.mimeType};base64,${audio.audioBase64}`);
      audioRef.current = el;
      setStatus("speaking");
      await new Promise<void>((resolve) => {
        el.onended = () => resolve();
        el.onerror = () => resolve();
        void el.play().catch(() => resolve());
      });
      if (audioRef.current === el) audioRef.current = null;
      setStatus(activeRef.current ? "listening" : "idle");
    },
    [speak],
  );

  const handleQuestion = useCallback(
    async (question: string) => {
      setStatus("thinking");
      const res = await ask({
        data: { question, patientId: patientId ?? "", sessionId: sessionIdRef.current },
      });
      push("assistant", res.report);
      onToolResult?.("run_clinical_engine", res.report);
      if (res.requiresConfirmation) {
        setPending({ ...res.requiresConfirmation, question });
      }
      await playSpeech(res.speech);
      setStatus(activeRef.current ? "listening" : "idle");
    },
    [ask, onToolResult, patientId, playSpeech, push],
  );

  const flushSegment = useCallback(async () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const ctx = ctxRef.current;
    if (!chunks.length || !ctx) return;
    busyRef.current = true;
    try {
      const wav = encodeWav(chunks, ctx.sampleRate);
      if (wav.size < 2048) return;
      setStatus("transcribing");
      const heard = await transcribe({
        data: { audioBase64: await toBase64(wav), mimeType: "audio/wav" },
      });
      if (!heard.text) {
        if (activeRef.current) setStatus("listening");
        return;
      }
      push("user", heard.text);
      await handleQuestion(heard.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao processar a fala.");
      if (activeRef.current) setStatus("listening");
    } finally {
      busyRef.current = false;
    }
  }, [handleQuestion, push, transcribe]);

  const stop = useCallback(
    (reason = "user") => {
      activeRef.current = false;
      const id = sessionIdRef.current;
      sessionIdRef.current = null;
      interrupt();
      nodeRef.current?.disconnect();
      nodeRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
      chunksRef.current = [];
      setLevel(0);
      setPending(null);
      setStatus("idle");
      if (id) void closeSession({ data: { sessionId: id, reason } }).catch(() => undefined);
    },
    [closeSession, interrupt],
  );

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setError(null);
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("error");
      setError("Microfone bloqueado. Autorize o microfone no navegador para falar com o NETO.");
      return;
    }
    streamRef.current = stream;

    try {
      const session = await openSession({ data: { patientId: patientId ?? "" } });
      sessionIdRef.current = session.sessionId;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;

      node.onaudioprocess = (e) => {
        if (!activeRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (const v of input) sum += v * v;
        const rms = Math.sqrt(sum / input.length);
        setLevel(Math.min(1, rms * 8));

        const now = performance.now();
        const talking = rms > 0.012;

        if (talking) {
          if (audioRef.current) interrupt();
          if (busyRef.current) return;
          if (!chunksRef.current.length) speakingSinceRef.current = now;
          silenceSinceRef.current = 0;
          chunksRef.current.push(new Float32Array(input));
          return;
        }

        if (!chunksRef.current.length || busyRef.current) return;
        chunksRef.current.push(new Float32Array(input));
        if (!silenceSinceRef.current) silenceSinceRef.current = now;
        const spokeEnough = now - speakingSinceRef.current > MIN_SPEECH_MS;
        if (now - silenceSinceRef.current > SILENCE_MS) {
          silenceSinceRef.current = 0;
          if (spokeEnough) void flushSegment();
          else chunksRef.current = [];
        }
      };

      source.connect(node);
      node.connect(ctx.destination);
      activeRef.current = true;
      setStatus("listening");
      void patientLabel;
    } catch (e) {
      stop("error");
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "Modo voz indisponível — continue no chat de texto.",
      );
    }
  }, [flushSegment, interrupt, openSession, patientId, patientLabel, status, stop]);

  /** Envia um comando de texto (ações rápidas) pela mesma via da voz. */
  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      interrupt();
      push("user", text);
      void handleQuestion(text).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Falha ao consultar o NETO.");
        setStatus(activeRef.current ? "listening" : "idle");
      });
    },
    [handleQuestion, interrupt, push],
  );

  /** Confirma (ou recusa) a gravação da reavaliação pedida por voz. */
  const resolvePending = useCallback(
    (approve: boolean) => {
      const p = pending;
      setPending(null);
      if (!p) return;
      if (!approve) {
        push("assistant", "Reavaliação não confirmada — nada foi registrado.");
        return;
      }
      void callTool({
        data: {
          name: "create_reassessment_task",
          args: {
            patientId: patientId ?? "",
            task: p.task,
            dueAt: p.dueAt,
            confirmed: true,
          },
          patientId: patientId ?? "",
          sessionId: sessionIdRef.current,
        },
      })
        .then((res) => {
          push("assistant", res.summary);
          onToolResult?.("create_reassessment_task", res.summary);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Falha ao registrar a reavaliação.");
        });
    },
    [callTool, onToolResult, patientId, pending, push],
  );

  useEffect(() => () => stop("unmount"), [stop]);

  return {
    status,
    error,
    transcripts,
    pending,
    level,
    voice,
    setVoice,
    spoken,
    setSpoken,
    active: status !== "idle" && status !== "error",
    start,
    stop,
    interrupt,
    sendText,
    resolvePending,
  };
}
