import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type VoiceRequest =
  | { action: "transcribe"; audioBase64: string; mimeType: string }
  | { action: "speak"; text: string; voice?: string };

const TTS_MODEL = "gemini-3.8-flash-lite-tts";
const TRANSCRIBE_MODEL = "gemini-2.5-flash";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") return error("Use POST.", 405);

    let payload: VoiceRequest;
    try {
      payload = await req.json();
    } catch {
      return error("JSON inválido.", 400);
    }

    const apiKey = Deno.env.get("gemini");
    if (!apiKey) {
      console.error("Missing Gemini secret");
      return error("Serviço de voz indisponível.", 503);
    }

    if (payload.action === "transcribe") {
      const audioBase64 = String(payload.audioBase64 ?? "");
      const mimeType = String(payload.mimeType ?? "audio/webm");
      if (!audioBase64 || audioBase64.length > 20_000_000) {
        return error("Áudio ausente ou muito grande.", 400);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TRANSCRIBE_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Transcreva fielmente este áudio em português brasileiro. Retorne somente a transcrição." },
                  { inlineData: { mimeType, data: audioBase64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!response.ok) {
        console.error("Gemini transcription failed", response.status);
        return error("Falha ao transcrever o áudio.", 502);
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("")
          .trim() ?? "";
      return Response.json({ text });
    }

    if (payload.action === "speak") {
      const text = String(payload.text ?? "").trim();
      if (!text || text.length > 4_000) return error("Texto ausente ou muito longo.", 400);

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: [
            {
              type: "user_input",
              content: [
                {
                  type: "text",
                  text,
                  annotations: [
                    {
                      type: "speech_metadata",
                      style: "Português brasileiro, tom calmo, profissional e objetivo de intensivista em round.",
                    },
                  ],
                },
              ],
            },
          ],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: payload.voice ?? "Kore" }] },
        }),
      });
      if (!response.ok) {
        console.error("Gemini speech failed", response.status);
        return error("Falha ao sintetizar a fala.", 502);
      }

      const data = await response.json();
      const audioBase64 = String(data?.output_audio?.data ?? "");
      if (!audioBase64) return error("O Gemini não retornou áudio.", 502);
      return Response.json({ audioBase64, mimeType: "audio/wav" });
    }

    return error("Ação de voz inválida.", 400);
  }),
};
