import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const InputSchema = z.object({
  context: z.string().min(1),
});

const SYSTEM_PROMPT = `Você é um farmacêutico clínico especialista em UTI com formação em farmacologia clínica avançada.
Sua função é realizar uma análise medicamentosa completa e contextualizada da prescrição de um paciente crítico,
priorizando riscos com maior impacto e evitando "fadiga de alertas".

Retorne EXCLUSIVAMENTE JSON válido no schema:
{
 "resumo": {
 "totalMedicamentos": number,
 "classesTerapeuticas": string[],
 "altoRisco": string[],
 "potencialmenteInapropriados": string[],
 "polifarmacia": boolean,
 "observacoes": string
  },
 "interacoes": [
    { "medicamentos": [string, string], "mecanismo": string, "relevancia": string,
 "frequencia": string, "consequencias": string, "conduta": string,
 "gravidade": "sem"|"leve"|"moderada"|"grave"|"contraindicada" }
  ],
 "interacoesCondicoes": [
    { "medicamento": string, "condicao": string, "risco": string, "conduta": string,
 "gravidade": "leve"|"moderada"|"grave" }
  ],
 "ajusteDose": [
    { "medicamento": string, "doseAtual": string, "doseSugerida": string,
 "justificativa": string, "fator": string }
  ],
 "eventosAdversos": [
    { "evento": string, "medicamentosEnvolvidos": string[], "risco": "baixo"|"moderado"|"alto"|"muito_alto",
 "justificativa": string, "monitorizacao": string }
  ],
 "compatibilidade": [
    { "medicamentos": string[], "problema": string, "conduta": string,
 "gravidade": "leve"|"moderada"|"grave"|"contraindicada" }
  ],
 "duplicidade": [
    { "medicamentos": string[], "tipo": string, "conduta": string }
  ],
 "desnecessarios": [
    { "medicamento": string, "motivo": string, "conduta": string }
  ],
 "otimizacoes": [
    { "recomendacao": string, "justificativa": string, "prioridade": "baixa"|"media"|"alta" }
  ],
 "resumoExecutivo": {
 "interacoesLeves": number,
 "interacoesModeradas": number,
 "interacoesGraves": number,
 "interacoesContraindicadas": number,
 "riscosPrioritarios": [ { "descricao": string, "gravidade": "moderada"|"grave"|"contraindicada" } ],
 "recomendacoesPriorizadas": string[]
  },
 "referencias": [
    { "titulo": string, "autores": string, "ano": string, "recomendacao": string, "nivelEvidencia": string }
  ],
 "dataAnalise": string,
 "observacaoConsenso": string
}

Regras:
- Seja específico e clínico. Justifique cada item.
- Não invente medicamentos ausentes na prescrição.
- Priorize riscos de maior impacto (QT, sangramento, nefrotoxicidade, hipercalemia, sedação, etc.).
- Se não houver achados em uma seção, retorne array vazio.
- As referências devem ser reais e atuais (UpToDate, IDSA, SCCM, Micromedex, Sanford, bulas ANVISA/FDA, sociedades médicas).
- Toda análise em português brasileiro.`;

export const analyzeMedications = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const supabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
    const authorization = getRequest()?.headers.get("authorization");
    if (!supabaseUrl || !authorization) {
      throw new Error("Sessão ou configuração do Supabase indisponível.");
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/axon-gemini-analysis`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.context },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      throw new Error(`Falha na análise (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.analysis ?? "{}";
    return { analysisJson: content };
  });
