// Área "NETO LIVE" dentro do próprio painel do assistente (sem tela separada).
// Voz por turnos: Gemini ouve, o Motor Clínico decide, o NETO fala.

import {
  Mic,
  MicOff,
  Square,
  Loader2,
  AudioLines,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetoVoice, type VoiceStatus } from "@/lib/live/useNetoVoice";
import type { LiveToolName } from "@/lib/live/tools";

const STATUS_META: Record<VoiceStatus, { label: string; className: string }> = {
  idle: { label: "Voz desligada", className: "text-neto-muted" },
  connecting: { label: "Conectando…", className: "text-clinical-warning" },
  listening: { label: "Ouvindo você", className: "text-clinical-stable" },
  transcribing: { label: "Transcrevendo…", className: "text-clinical-warning" },
  thinking: { label: "NETO pensando…", className: "text-clinical-warning" },
  speaking: { label: "NETO está falando", className: "text-clinical-attention" },
  error: { label: "Modo voz indisponível", className: "text-clinical-critical" },
};

const QUICK_VOICE = [
  { label: "🩺 Analisar paciente", text: "Analise o paciente com o Motor Clínico completo." },
  { label: "📊 SOFA", text: "Qual o SOFA dele e quais componentes usou?" },
  { label: "✅ FASTHUG", text: "Faça o FASTHUG-MAIDENS." },
  { label: "🫁 Ventilação", text: "Como está a ventilação?" },
  { label: "💉 Antibióticos", text: "Revise os antibióticos." },
  { label: "🕒 Round 19h", text: "Prepare meu round das 19 horas." },
  { label: "❓ O que falta", text: "Quais dados críticos estão faltando?" },
];

interface Props {
  patientId?: string;
  patientLabel?: string;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onToolResult?: (name: LiveToolName, summary: string) => void;
}

export function NetoLivePanel({ patientId, patientLabel, onTranscript, onToolResult }: Props) {
  const live = useNetoVoice({ patientId, patientLabel, onTranscript, onToolResult });
  const meta = STATUS_META[live.status];
  const bars = [0, 1, 2, 3, 4];

  return (
    <div className="neto-panel space-y-2 rounded-[18px] p-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neto-muted">
          Neto Live
        </p>
        {patientLabel && (
          <span className="rounded-full bg-neto-panel-strong px-2 py-0.5 text-[9px] font-bold text-neto-foreground">
            {patientLabel}
          </span>
        )}
        <span className={`ml-auto text-[10px] font-bold ${meta.className}`}>{meta.label}</span>
      </div>

      <div className="flex items-center gap-2">
        {!live.active ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void live.start()}
            className="neto-chip h-8 gap-1.5 rounded-full px-3 text-[11px] font-bold !text-white hover:bg-neto-panel-strong"
          >
            <Mic className="h-3.5 w-3.5" /> Falar com o NETO
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => live.stop("user")}
              className="neto-chip h-8 gap-1.5 rounded-full px-3 text-[11px] font-bold !text-white hover:bg-neto-panel-strong"
            >
              <Square className="h-3 w-3" /> Encerrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => live.interrupt()}
              disabled={live.status !== "speaking"}
              className="neto-chip h-8 gap-1.5 rounded-full px-3 text-[11px] font-bold text-neto-foreground hover:bg-neto-panel-strong"
            >
              <MicOff className="h-3.5 w-3.5" /> Interromper
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={() => live.setSpoken(!live.spoken)}
          title={live.spoken ? "Desligar a fala (mantém o texto)" : "Ligar a fala"}
          className="neto-chip h-8 w-8 rounded-full p-0 text-neto-foreground hover:bg-neto-panel-strong"
        >
          {live.spoken ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => live.setVoice(live.voice === "alloy" ? "shimmer" : "alloy")}
          title="Alternar a voz do NETO"
          className="neto-chip h-8 rounded-full px-2 text-[10px] font-bold text-neto-foreground hover:bg-neto-panel-strong"
        >
          {live.voice === "alloy" ? "Voz 1" : "Voz 2"}
        </Button>

        {(live.status === "connecting" ||
          live.status === "transcribing" ||
          live.status === "thinking") && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-neto-muted" />
        )}

        {(live.status === "listening" || live.status === "speaking") && (
          <div className="ml-auto flex items-end gap-0.5" aria-hidden>
            {bars.map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-neto-glow"
                style={{
                  height: `${6 + (live.status === "speaking" ? 10 : live.level * 18) * (1 - Math.abs(i - 2) / 4)}px`,
                }}
              />
            ))}
            <AudioLines className="ml-1 h-3.5 w-3.5 text-neto-glow" />
          </div>
        )}
      </div>

      {live.error && (
        <p className="flex items-start gap-1 text-[10px] font-semibold text-clinical-critical">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {live.error} O chat de texto do NETO continua funcionando.
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {QUICK_VOICE.map((q) => (
          <Button
            key={q.label}
            type="button"
            variant="ghost"
            onClick={() => live.sendText(q.text)}
            className="neto-chip h-auto rounded-full px-2 py-1 text-[10px] font-bold leading-none text-neto-foreground hover:bg-neto-panel-strong"
          >
            {q.label}
          </Button>
        ))}
      </div>

      {live.pending && (
        <div className="space-y-1.5 rounded-[12px] border border-clinical-warning/50 bg-neto-panel-strong p-2">
          <p className="text-[10px] font-bold text-clinical-warning">
            Confirmação necessária — nada foi gravado ainda
          </p>
          <p className="text-[11px] font-semibold !text-white">
            Registrar: {live.pending.task}
            {live.pending.dueAt ? ` (${live.pending.dueAt})` : ""}
          </p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => live.resolvePending(true)}
              className="neto-chip h-7 rounded-full px-2 text-[10px] font-bold !text-white"
            >
              Confirmar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => live.resolvePending(false)}
              className="h-7 rounded-full px-2 text-[10px] font-bold text-neto-muted"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {live.transcripts.length > 0 && (
        <div className="max-h-[110px] space-y-1 overflow-y-auto pr-0.5">
          {live.transcripts.slice(-8).map((t) => (
            <p key={t.id} className="text-[10px] leading-snug">
              <span className="font-bold text-neto-muted">
                {t.role === "user" ? "Você: " : "NETO: "}
              </span>
              <span className="font-semibold !text-white">{t.text}</span>
            </p>
          ))}
        </div>
      )}

      <p className="text-[9px] leading-snug text-neto-muted">
        A voz não prescreve nem altera condutas. Dado ausente é reportado como não informado. Áudio
        não é gravado — apenas a transcrição fica na auditoria.
      </p>
    </div>
  );
}
