// Voz do NETO apoiada no Gemini: transcrição, raciocínio clínico
// determinístico e fala. Nenhuma chave sai do servidor e nenhum áudio é gravado.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Patient } from "@/data/patients";
import { runNetoLiveTool } from "./toolRunner";
import { detectIntent } from "@/lib/clinicalEngine/intent";
import type { EngineIntent } from "@/lib/clinicalEngine";

export const VOICE_SESSION_MODEL = "gemini-voice";

async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const supabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  const authorization = getRequest()?.headers.get("authorization");
  if (!supabaseUrl || !authorization) {
    throw new Error("Sessão ou configuração do Supabase indisponível.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error ?? "Falha no serviço de voz."));
  return payload;
}

const SPEECH_STYLE = `Você é o NETO, assistente de UTI do Axon Pro, falando por voz em português brasileiro.
Reescreva o relatório determinístico abaixo como fala curta de intensivista no round.
REGRAS: comece pela prioridade imediata; depois resumo objetivo, achados que justificam, apoio à decisão, pendências/reavaliação e a fonte em uma frase curta ("baseado na Surviving Sepsis Campaign 2026").
NUNCA invente dado nenhum: o que não estiver no relatório é "não informado". Não prescreva, não altere medicação nem parâmetros ventilatórios.
Máximo 8 frases curtas. Sem listas, sem markdown, sem números de referência.`;

type PatientsDb = {
  from: (table: "patients") => {
    select: (columns: "data") => {
      order: (column: "position") => PromiseLike<{
        data: { data: unknown }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

async function resolvePatient(db: PatientsDb, patientId: string): Promise<Patient> {
  const query = String(patientId ?? "").trim();
  const { data, error } = await db.from("patients").select("data").order("position");
  if (error) throw new Error(error.message);
  const patients = (data ?? []).map((r) => r.data as Patient);
  const q = query.toLowerCase();
  const found =
    patients.find((p) => p.id?.toLowerCase() === q) ??
    patients.find((p) => String(p.bed ?? "").toLowerCase() === q) ??
    patients.find((p) => (p.name ?? "").toLowerCase().includes(q));
  if (!found) throw new Error(`Paciente "${query}" não encontrado no passômetro.`);
  return found;
}

/** Abre a sessão de voz (apenas auditoria — nenhuma conexão externa persistente). */
export const startVoiceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { patientId?: string }) => ({ patientId: data?.patientId ?? "" }))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("realtime_sessions")
      .insert({
        user_id: context.userId,
        patient_id: data.patientId || null,
        model: VOICE_SESSION_MODEL,
      })
      .select("id")
      .single();
    return { sessionId: (row?.id as string | undefined) ?? null, model: VOICE_SESSION_MODEL };
  });

/** Transcreve um trecho de fala com o Gemini. O áudio não é armazenado. */
export const transcribeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audioBase64: string; mimeType?: string }) => {
    const audioBase64 = String(data?.audioBase64 ?? "");
    if (!audioBase64) throw new Error("Nenhum áudio recebido.");
    return { audioBase64, mimeType: data?.mimeType || "audio/wav" };
  })
  .handler(async ({ data }) => {
    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.byteLength < 2048) return { text: "", tooShort: true as const };
    if (bytes.byteLength > 14 * 1024 * 1024) {
      throw new Error("Trecho de fala muito longo. Fale em blocos mais curtos.");
    }

    const payload = await invokeEdgeFunction("axon-voice", {
      action: "transcribe",
      audioBase64: data.audioBase64,
      mimeType: data.mimeType,
    });
    return { text: String(payload.text ?? "").trim(), tooShort: false as const };
  });

const WRITE_INTENT = /\b(registr|anot|crie? (uma )?tarefa|agende|reavalia(r|ção) às)\b/i;

/** Interpreta a fala, roda o Motor Clínico e devolve texto para chat e para voz. */
export const askNetoVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { question: string; patientId?: string; sessionId?: string | null }) => ({
    question: String(data?.question ?? "").slice(0, 2000),
    patientId: String(data?.patientId ?? ""),
    sessionId: data?.sessionId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    if (!data.question.trim()) throw new Error("Nenhuma pergunta reconhecida na fala.");

    await db.from("voice_interactions").insert({
      user_id: context.userId,
      session_id: data.sessionId,
      patient_id: data.patientId || null,
      role: "user",
      transcript: data.question,
    });

    if (!data.patientId) {
      const msg = "Selecione um paciente no passômetro para eu analisar por voz.";
      return {
        intent: "full" as EngineIntent,
        report: msg,
        speech: msg,
        requiresConfirmation: null as null | { task: string; dueAt: string },
      };
    }

    const patient = await resolvePatient(db as unknown as PatientsDb, data.patientId);
    const intent = detectIntent(data.question);

    // Pedido de gravação: nada é escrito sem confirmação explícita na tela.
    if (WRITE_INTENT.test(data.question)) {
      const dueAt = /(\d{1,2})[:h](\d{2})/.exec(data.question)?.[0]?.replace("h", ":") ?? "";
      const speech =
        "Preparei a reavaliação, mas não gravei nada. Confirme na tela para eu registrar.";
      return {
        intent,
        report: `Confirmação necessária antes de gravar: "${data.question}"${dueAt ? ` (${dueAt})` : ""}.`,
        speech,
        requiresConfirmation: { task: data.question, dueAt },
      };
    }

    const outcome = runNetoLiveTool(patient, "run_clinical_engine", {
      patientId: patient.id,
      scope: intent,
    });

    let speech = outcome.summary;
    try {
      const payload = await invokeEdgeFunction("axon-gemini-analysis", {
        messages: [
          { role: "system", content: SPEECH_STYLE },
          {
            role: "user",
            content: `Pergunta do médico: "${data.question}"\n\nRelatório determinístico do Motor Clínico (única fonte de dados):\n${outcome.summary}`,
          },
        ],
      });
      const text = String(payload?.analysis ?? "").trim();
      if (text) speech = text;
    } catch (e) {
      // Fallback seguro: fala o relatório determinístico, sem inventar nada.
      if (e instanceof Error && /indisponível/i.test(e.message)) throw e;
    }

    await db.from("voice_interactions").insert({
      user_id: context.userId,
      session_id: data.sessionId,
      patient_id: patient.id,
      role: "assistant",
      transcript: speech.slice(0, 4000),
    });

    if (outcome.audit) {
      await db.from("clinical_audit_events").insert({
        user_id: context.userId,
        session_id: data.sessionId,
        patient_id: patient.id,
        source: "neto_voice",
        question: data.question,
        scope: outcome.audit.scope,
        scores: outcome.audit.scores as never,
        rules: outcome.audit.rules as never,
        guidelines: outcome.audit.guidelines as never,
        recommendations: outcome.audit.recommendations as never,
      });
    }

    await db.from("realtime_tool_calls").insert({
      user_id: context.userId,
      session_id: data.sessionId,
      patient_id: patient.id,
      tool_name: "run_clinical_engine",
      arguments: { scope: intent, question: data.question } as never,
      requires_confirmation: false,
      result_summary: speech.slice(0, 4000),
      confirmed: false,
    });

    return {
      intent,
      report: outcome.summary,
      speech,
      requiresConfirmation: null as null | { task: string; dueAt: string },
    };
  });

/** Converte a resposta do NETO em áudio (mp3 em base64). */
export const speakNetoVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string; voice?: string }) => ({
    text: String(data?.text ?? "").slice(0, 4000),
    voice: "Kore",
  }))
  .handler(async ({ data }) => {
    if (!data.text.trim()) return { audioBase64: "", mimeType: "audio/wav" };
    const payload = await invokeEdgeFunction("axon-voice", {
      action: "speak",
      text: data.text,
      voice: data.voice,
    });
    return {
      audioBase64: String(payload.audioBase64 ?? ""),
      mimeType: String(payload.mimeType ?? "audio/wav"),
    };
  });
