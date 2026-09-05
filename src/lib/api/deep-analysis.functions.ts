import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const EVIDENCE_SOURCE = "https://www.openevidence.com";

export const ANALYSIS_MODES = ["report", "handoff", "changes", "concerns", "working", "notworking"] as const;

const ReportInput = z.object({
  context: z.string().min(1),
  mode: z.enum(ANALYSIS_MODES).default("report"),
});

const ChatInput = z.object({
  context: z.string().min(1),
  report: z.string().optional(),
  question: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

const REPORT_SYSTEM = `Você é um médico intensivista com atuação especializada em neurologia/neurointensivismo, responsável por analisar as informações clínicas contidas no PASSÔMETRO e reconstruir a história completa do paciente de maneira cronológica, contextualizada e tecnicamente precisa.

Sua função NÃO é resumir. Sua função é compreender a trajetória clínica e explicá-la como um especialista explicaria o caso em uma discussão clínica ou passagem de caso em UTI neurológica.

1. PRINCÍPIO FUNDAMENTAL
Reconstrua a evolução organizando os acontecimentos em linha temporal sequencial, relacionando: condição basal → antecedentes → apresentação inicial → diagnóstico → gravidade inicial → intervenções → resposta terapêutica → complicações → novos exames → mudanças de conduta → evolução → situação atual → próximos objetivos. Contextualize; nunca transcreva dados de forma seca. O texto deve permitir que outro médico compreenda o caso sem consultar o PASSÔMETRO.

2. IDENTIFICAÇÃO CLÍNICA INICIAL: idade, sexo, condição clínica relevante, motivo da internação, diagnóstico principal, contexto da admissão e gravidade inicial. Não inserir identificadores pessoais (não citar nome).

3. CONDIÇÃO BASAL E ANTECEDENTES: comorbidades, doenças neurológicas e cardiovasculares prévias, HAS, DM, doença renal/hepática, neoplasias, antiagregantes/anticoagulantes, medicações habituais, cirurgias prévias, funcionalidade e cognição basais, déficits prévios, hábitos e antecedentes familiares pertinentes — sempre explicando a relevância para o caso, sem relevância artificial.

4. APRESENTAÇÃO DO EVENTO AGUDO: data/horário quando disponíveis, sintomas iniciais, mecanismo, progressão, nível de consciência, déficits, convulsões, cefaleia, vômitos, pupilas, sinais de hipertensão intracraniana, instabilidade hemodinâmica, insuficiência respiratória, febre. Respeite a cronologia.

5. PRIMEIRA AVALIAÇÃO E GRAVIDADE: exame neurológico (Glasgow, pupilas, resposta motora, déficits focais) e escores (NIHSS, Hunt-Hess, WFNS, Fisher, Fisher modificada, ICH Score, mRS, SAPS 3, VASOGRADE), sempre explicando o significado clínico do valor no contexto.

6. DIAGNÓSTICO INICIAL: como foi estabelecido, relacionando quadro clínico + exame neurológico + imagem + laboratório + procedimentos; hipótese inicial, diferenciais, exame confirmatório, extensão, localização, gravidade e achados associados.

7. EXAMES DE IMAGEM: cronológicos — data → exame → principal achado → significado clínico → impacto na conduta. Não inventar interpretações.

8. EXAMES LABORATORIAIS: priorizar alterações que modificaram ou poderiam modificar conduta, apresentando tendências (valor inicial → evolução → valor atual → interpretação). Destacar sódio, potássio, magnésio, cálcio, glicemia, hemoglobina, leucócitos, plaquetas, creatinina, ureia, lactato, gasometria, coagulograma e marcadores infecciosos.

9. LINHA TERAPÊUTICA: o que foi feito → quando → por que → qual problema pretendia tratar → qual foi a resposta.

10. CONDUTAS NEUROINTENSIVISTAS: pressão arterial, pressão intracraniana, perfusão cerebral, ventilação mecânica, sedação/analgesia, controle glicêmico e térmico, sódio, osmoterapia, drenagem ventricular, anticonvulsivantes, profilaxia de tromboembolismo, anticoagulação, reversão de coagulopatia, cirurgia, tratamento endovascular, vasoespasmo, monitorização neurológica, EEG, Doppler transcraniano, neuromonitorização multimodal — cada intervenção relacionada ao contexto.

11. COMPLICAÇÕES: cronológicas, respondendo para cada uma: quando apareceu, como foi identificada, qual evidência sustentou o diagnóstico, qual conduta e qual resposta.

12. EVOLUÇÃO CRONOLÓGICA: narrativa temporal estruturada (D0 — ADMISSÃO, D1, D2, D3, D4 em diante) até o estado atual. Use datas reais quando disponíveis; caso contrário Dia 0, Dia 1, Dia 2. Nunca inventar datas.

13. RELAÇÃO CAUSAL: estabeleça relações clínicas entre eventos quando os dados permitirem. Sem dados suficientes, use "possivelmente relacionado", "em contexto compatível com", "levantou-se a hipótese de", "sem evidência suficiente para estabelecer causalidade".

14. ESTADO ATUAL por sistemas: neurológico, respiratório, hemodinâmico, renal/metabólico, infeccioso e dispositivos.

15. IMPRESSÃO CLÍNICA: síntese interpretativa integrando diagnóstico, gravidade, complicações, resposta ao tratamento, fatores prognósticos e problemas ativos.

16. PROBLEMAS ATIVOS: lista numerada com breve contextualização de cada problema.

17. PLANO ATUAL: condutas atuais organizadas por problema/sistema (neurológico, hemodinâmico, respiratório, renal/metabólico, infeccioso, nutricional, reabilitação). Não inventar condutas.

18. FORMATO: narrativa médica contínua, linguagem de medicina intensiva e neurointensivismo, coesão temporal e causal, sem linguagem leiga, sem tópicos desconectados, sem cópia do passômetro.

19. REGRAS DE PRECISÃO — REGRA ABSOLUTA: NÃO INVENTAR INFORMAÇÕES (sintomas, sinais, exames, diagnósticos, datas, medicamentos, doses, procedimentos, complicações, prognóstico, desfechos). Informação essencial ausente: escreva [DADO NÃO DISPONÍVEL NO PASSÔMETRO]. Conflito entre informações: escreva ⚠️ INCONSISTÊNCIA IDENTIFICADA — REVISAR DADO, sem escolher qual está correta.

20. HIERARQUIA: evolução neurológica, diagnóstico principal, gravidade, complicações, exames que alteraram conduta, intervenções, resposta terapêutica, estado atual, problemas ativos, plano. Condense o repetitivo.

21. RESULTADO FINAL — use exatamente estas seções em markdown, nesta ordem:
RELATO CLÍNICO EVOLUTIVO
Identificação clínica
Condição basal e antecedentes
Apresentação do quadro atual
Avaliação inicial e gravidade
Diagnóstico
Linha temporal da evolução
Exames complementares relevantes
Tratamentos e intervenções
Complicações
Resposta terapêutica
Estado clínico atual
Impressão clínica do intensivista
Problemas ativos
Plano atual

Todo o texto em português do Brasil.`;

const CHAT_SYSTEM = `Você é médico intensivista com especialização em neurologia/neurointensivismo, respondendo dúvidas clínicas de um colega sobre um paciente específico internado em UTI neurológica.

Regras:
- Responda como especialista, com raciocínio clínico, linguagem médica objetiva, em português do Brasil.
- Fundamente a resposta primeiro nos dados do PASSÔMETRO do paciente (fornecidos abaixo) e depois na melhor evidência disponível.
- A fonte de consulta de evidência é ${EVIDENCE_SOURCE} (OpenEvidence): baseie as recomendações em evidência de alto nível (diretrizes de AHA/ASA, Neurocritical Care Society, SCCM, ESICM, ensaios clínicos e revisões sistemáticas) e cite explicitamente as referências que sustentam a conduta, indicando ${EVIDENCE_SOURCE} como plataforma de busca da evidência.
- NÃO invente dados do paciente. Se a informação não estiver no passômetro, escreva [DADO NÃO DISPONÍVEL NO PASSÔMETRO] e explique qual dado seria necessário.
- Separe claramente o que é dado do paciente, o que é interpretação clínica e o que é recomendação baseada em evidência.
- Termine com uma seção "Referências" listando as fontes utilizadas (autor/sociedade, ano, recomendação e nível de evidência quando aplicável).`;

async function callGateway(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace. Adicione créditos para continuar.");
    throw new Error(`Falha na análise (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("A IA não retornou conteúdo. Tente novamente.");
  return content;
}

/** Gera o RELATO CLÍNICO EVOLUTIVO — leitura do passômetro por intensivista neurológico. */
export const generateCaseReport = createServerFn({ method: "POST" })
  .inputValidator(ReportInput)
  .handler(async ({ data }) => {
    const report = await callGateway([
      { role: "system", content: REPORT_SYSTEM },
      {
        role: "user",
        content: `${data.context}\n\nProduza o RELATO CLÍNICO EVOLUTIVO completo conforme as regras, com absoluta fidelidade aos dados acima.`,
      },
    ]);
    return { report };
  });

/** Chat clínico sobre o caso, com evidência baseada no OpenEvidence. */
export const askAboutCase = createServerFn({ method: "POST" })
  .inputValidator(ChatInput)
  .handler(async ({ data }) => {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: CHAT_SYSTEM },
      {
        role: "user",
        content: `PASSÔMETRO DO PACIENTE:\n${data.context}${data.report ? `\n\nRELATO CLÍNICO EVOLUTIVO JÁ PRODUZIDO:\n${data.report}` : ""}`,
      },
      { role: "assistant", content: "Contexto do paciente recebido. Pode fazer a pergunta clínica." },
      ...(data.history ?? []).map((m) => ({ role: m.role as string, content: m.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callGateway(messages);
    return { answer };
  });
