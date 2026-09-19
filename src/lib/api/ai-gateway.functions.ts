export type AiGatewayConfig = {
  baseUrl: string;
  chatUrl: string;
  transcriptionUrl: string;
  model: string;
  headers: HeadersInit;
};

export function createAiConfig(defaultModel: string): AiGatewayConfig {
  const apiKey =
    process.env["AI_GATEWAY_KEY"] ?? process.env["GEMINI_API_KEY"] ?? process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Chave de IA não configurada (AI_GATEWAY_KEY ou LOVABLE_API_KEY).");

  const baseUrl = (
    process.env["AI_GATEWAY_URL"] ??
    process.env["GEMINI_GATEWAY_URL"] ??
    "https://ai.gateway.lovable.dev/v1"
  ).replace(/\/$/, "");

  const lovableDefault = baseUrl === "https://ai.gateway.lovable.dev/v1";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(lovableDefault ? { "Lovable-API-Key": apiKey } : { Authorization: `Bearer ${apiKey}` }),
  };

  return {
    baseUrl,
    chatUrl: `${baseUrl}/chat/completions`,
    transcriptionUrl: `${baseUrl}/audio/transcriptions`,
    model: process.env["GEMINI_PRO_MODEL"] ?? defaultModel,
    headers,
  };
}
