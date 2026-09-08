// Backend do NETO Live: sessão efêmera da API Realtime da OpenAI, execução
// segura das ferramentas clínicas e auditoria. A OPENAI_API_KEY nunca sai daqui.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Patient } from "@/data/patients";
import { runNetoLiveTool, toolRequiresConfirmation } from "./toolRunner";
import {
  LIVE_TOOLS,
  LIVE_TOOL_NAMES,
  NETO_LIVE_INSTRUCTIONS,
  NETO_LIVE_MODEL,
  type LiveToolName,
} from "./tools";

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

/** Cria a sessão de voz e devolve apenas o token efêmero (client secret). */
export const createLiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { patientId?: string }) => ({ patientId: data?.patientId ?? "" }))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "Modo voz indisponível: configure o segredo OPENAI_API_KEY em Configurações do Projeto → Secrets.",
      );
    }

    let patientBrief = "Nenhum paciente selecionado.";
    if (data.patientId) {
      try {
        const p = await resolvePatient(context.supabase as unknown as PatientsDb, data.patientId);
        patientBrief = `Paciente ativo: patientId="${p.id}", leito ${p.bed}, ${p.name}, ${p.age} anos. Use esse patientId em todas as ferramentas.`;
      } catch {
        patientBrief = `patientId informado: "${data.patientId}".`;
      }
    }

    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: NETO_LIVE_MODEL,
          instructions: `${NETO_LIVE_INSTRUCTIONS}\n\n${patientBrief}`,
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe", language: "pt" },
              turn_detection: { type: "semantic_vad" },
            },
            output: { voice: "marin" },
          },
          tools: LIVE_TOOLS,
          tool_choice: "auto",
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Falha ao abrir a sessão de voz (${res.status}). ${detail.slice(0, 300)}`);
    }
    const payload = (await res.json()) as { value?: string; expires_at?: number };
    if (!payload.value) throw new Error("A OpenAI não devolveu o token efêmero da sessão.");

    const { data: row } = await context.supabase
      .from("realtime_sessions")
      .insert({
        user_id: context.userId,
        patient_id: data.patientId || null,
        model: NETO_LIVE_MODEL,
      })
      .select("id")
      .single();

    return {
      clientSecret: payload.value,
      expiresAt: payload.expires_at ?? null,
      model: NETO_LIVE_MODEL,
      sessionId: (row?.id as string | undefined) ?? null,
    };
  });

/** Encerra a sessão e registra o motivo. */
export const endLiveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; reason?: string }) => ({
    sessionId: String(data?.sessionId ?? ""),
    reason: data?.reason ?? "user",
  }))
  .handler(async ({ data, context }) => {
    if (!data.sessionId) return { ok: false as const };
    await context.supabase
      .from("realtime_sessions")
      .update({ ended_at: new Date().toISOString(), end_reason: data.reason })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

/** Guarda a transcrição (texto apenas — nenhum áudio bruto é gravado). */
export const logVoiceInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sessionId?: string | null;
      patientId?: string | null;
      role: string;
      transcript: string;
    }) => ({
      sessionId: data?.sessionId ?? null,
      patientId: data?.patientId ?? null,
      role: data?.role === "assistant" ? "assistant" : "user",
      transcript: String(data?.transcript ?? "").slice(0, 4000),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.transcript.trim()) return { ok: false as const };
    await context.supabase.from("voice_interactions").insert({
      user_id: context.userId,
      session_id: data.sessionId,
      patient_id: data.patientId,
      role: data.role,
      transcript: data.transcript,
    });
    return { ok: true as const };
  });

/** Executa uma ferramenta clínica pedida pela voz, com auditoria. */
export const runLiveTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      args?: Record<string, unknown>;
      patientId?: string;
      sessionId?: string | null;
    }) => {
      const name = String(data?.name ?? "");
      if (!LIVE_TOOL_NAMES.includes(name as LiveToolName)) {
        throw new Error(`Ferramenta não permitida: ${name}`);
      }
      return {
        name: name as LiveToolName,
        args: (data?.args ?? {}) as Record<string, unknown>,
        patientId: String(data?.patientId ?? ""),
        sessionId: data?.sessionId ?? null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const patientId = String(data.args["patientId"] ?? data.patientId ?? "");

    const audit = async (fields: Record<string, unknown>) => {
      await db.from("realtime_tool_calls").insert({
        user_id: context.userId,
        session_id: data.sessionId,
        patient_id: patientId || null,
        tool_name: data.name,
        arguments: data.args as never,
        requires_confirmation: toolRequiresConfirmation(data.name),
        ...fields,
      });
    };

    try {
      const patient = await resolvePatient(db as unknown as PatientsDb, patientId);
      const outcome = runNetoLiveTool(patient, data.name, data.args);

      // Gravação clínica só acontece com confirmação explícita do médico.
      if (data.name === "create_reassessment_task" && !outcome.requiresConfirmation) {
        const task = String(data.args["task"] ?? "");
        const dueAt = String(data.args["dueAt"] ?? "");
        const { error } = await db.from("engine_tasks").insert({
          patient_id: patient.id,
          window_label: "NETO Live",
          due_time: dueAt || null,
          domain: "seguranca",
          priority: "pending",
          text: task,
          status: "open",
          created_by: context.userId,
        });
        if (error) throw new Error(error.message);
      }

      if (outcome.audit) {
        await db.from("clinical_audit_events").insert({
          user_id: context.userId,
          session_id: data.sessionId,
          patient_id: patient.id,
          source: "neto_live",
          question: data.name,
          scope: outcome.audit.scope,
          scores: outcome.audit.scores as never,
          rules: outcome.audit.rules as never,
          guidelines: outcome.audit.guidelines as never,
          recommendations: outcome.audit.recommendations as never,
        });
      }

      await audit({
        result_summary: outcome.summary.slice(0, 4000),
        confirmed: data.args["confirmed"] === true,
      });

      return {
        ok: true as const,
        summary: outcome.summary,
        requiresConfirmation: Boolean(outcome.requiresConfirmation),
        json: JSON.stringify(outcome.data ?? null),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao executar a ferramenta.";
      await audit({ error: message.slice(0, 1000) });
      return { ok: false as const, summary: message, requiresConfirmation: false, json: "null" };
    }
  });
