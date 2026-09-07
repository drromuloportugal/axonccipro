import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const EVIDENCE_SOURCE = "https://www.openevidence.com";

export const ANALYSIS_MODES = [
  "report",
  "handoff",
  "changes",
  "concerns",
  "working",
  "notworking",
] as const;

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

/** Motor de análise clínica profunda — regras transversais a todos os modos. */
const ENGINE_SYSTEM = `Você é o MOTOR DE ANÁLISE CLÍNICA do PASSÔMETRO, sistema de apoio à decisão para pacientes críticos. Sua função não é resumir prontuário: é organizar dados, reconstruir a trajetória temporal, identificar tendências, correlacionar intervenção e resposta, integrar sistemas orgânicos e sinalizar deterioração.

REFERÊNCIA INSTITUCIONAL: Society of Critical Care Medicine (SCCM) — ICU Liberation Bundle A-F, PADIS Guidelines e Focused Update, Surviving Sepsis Campaign, Family-Centered Care Guidelines. Quando a recomendação vier de outra sociedade, identifique explicitamente a fonte. NUNCA atribua à SCCM uma recomendação que não seja dela.

RACIOCÍNIO LONGITUDINAL: nunca interprete valor isolado. Sempre combine valor atual + valor anterior + tendência + velocidade de mudança + intervenções + resposta + contexto clínico + disfunções + suporte artificial. Pergunte sempre: o que mudou, quando, o que houve antes, houve intervenção, como respondeu, a resposta foi sustentada, há deterioração, há explicação alternativa, há dados suficientes.

SEGURANÇA CLÍNICA: nunca invente dados; nunca preencha lacuna com suposição. Dado ausente = "Dado não disponível". Conclusão impossível = "Não é possível determinar com os dados disponíveis". Registros divergentes = "Existem registros conflitantes" apresentando ambos, sem escolher. Rotule explicitamente FATO, TENDÊNCIA, INTERPRETAÇÃO, HIPÓTESE e RECOMENDAÇÃO. Hipótese nunca se torna diagnóstico; alerta nunca se torna diagnóstico. Associação temporal não é causalidade — use "pode estar relacionado", "ocorreu após", "necessita correlação clínica".

TENDÊNCIAS: para cada variável relevante informe valor atual, anterior, mínimo, máximo, direção, velocidade e intervalo, classificando em ESTÁVEL / MELHORANDO / PIORANDO / OSCILANTE / INDETERMINADO / SEM DADOS SUFICIENTES. Nunca defina tendência com um único valor.

SUPORTE vs MELHORA: distinga melhora real de aumento de suporte (ex.: FiO2 e PEEP crescentes com PaO2 estável = necessidade crescente de suporte, não estabilidade). Nunca atribua queda de consciência exclusivamente ao neurológico quando houver sedação, causa metabólica ou sistêmica plausível.

DETERIORAÇÃO: procure valor crítico, tendência progressiva, velocidade de mudança, conjunto de sinais convergentes e necessidade crescente de suporte. Classifique alertas em INFORMATIVO / ATENÇÃO / ALERTA / ALTA PRIORIDADE, priorizando poucos alertas relevantes, sem redundância e sem alarmismo.

ESCORES: apresente valor, componentes utilizados, data/hora, dados ausentes e interpretação. Nunca calcule escore com dado inventado; use apenas os escores já registrados no passômetro e sinalize componentes faltantes. Considere SOMENTE os escores que constam no bloco "ESCORES DE GRAVIDADE E ESCALAS NEUROLÓGICAS" desta leitura — escores que não aparecem ali não foram preenchidos na aba Gestão e devem ser tratados como "DADO NÃO DISPONÍVEL NO PASSÔMETRO", sem estimar, presumir ou sugerir valor provável.

DADOS AUSENTES: sempre inclua uma seção "DADOS IMPORTANTES NÃO DISPONÍVEIS" listando o que poderia mudar a interpretação (gasometria, lactato, diurese, RASS, CAM-ICU, avaliação de dor, culturas, imagem recente). Não solicite exames — apenas informe a limitação.

TRANSPARÊNCIA: em cada interpretação ou alerta, mostre as evidências usadas (valores, datas, intervalo), no formato "Evidências: ...".

NÃO SUBSTITUIÇÃO: o Passômetro é apoio à decisão; não substitui avaliação médica, exame físico, julgamento clínico ou protocolos institucionais. Recomendações são sugestões para avaliação do profissional responsável.

FORMATO: português do Brasil, linguagem médica objetiva, estruturada, temporal, sem repetição. Markdown com títulos em maiúsculas.`;

const ICU_LIBERATION = `ICU LIBERATION A-F (SCCM) — sempre que houver dados, estruture:
A PAIN: CPOT/BPS/NRS, analgesia, resposta; existe dor não controlada?
B BOTH SAT AND SBT: elegibilidade, realização, motivo de não realização, resultado. Ausência de SAT/SBT não é falha quando há contraindicação documentada.
C CHOICE OF SEDATION: sedativos, analgésicos, doses, meta de RASS vs RASS observado, possível sobressedação.
D DELIRIUM: CAM-ICU/ICDSC, fatores de risco modificáveis, sono, mobilidade, cognição, audição/visão, medidas não farmacológicas multicomponente.
E EARLY MOBILITY: nível funcional, fisioterapia, mobilização, barreiras e contraindicações documentadas.
F FAMILY ENGAGEMENT: presença, comunicação, conferências, objetivos de cuidado, necessidades da família.
Cada componente ausente deve ser marcado "Dado não disponível".`;

const MODE_TASKS: Record<string, string> = {
  handoff: `Produza a PASSAGEM DE PLANTÃO estruturada, exatamente nestas seções:
IDENTIFICAÇÃO / MOTIVO DA INTERNAÇÃO / DIAGNÓSTICO PRINCIPAL / EVENTOS IMPORTANTES / ESTADO ATUAL / SUPORTE RESPIRATÓRIO / SUPORTE HEMODINÂMICO / NEUROLÓGICO / RENAL E METABÓLICO / INFECÇÃO / HEMATOLOGIA / DISPOSITIVOS / MEDICAÇÕES CRÍTICAS / ICU LIBERATION A-F / O QUE MUDOU NAS ÚLTIMAS 24 HORAS / PRINCIPAIS RISCOS / O QUE PRECISA SER OBSERVADO NO PRÓXIMO TURNO / DADOS IMPORTANTES NÃO DISPONÍVEIS.
Cada item objetivo, com data/hora quando disponível.`,
  changes: `Produza a tela "O QUE MUDOU?" — apenas alterações clinicamente relevantes, ordenadas por prioridade, uma por linha, no formato:
[ALTA PRIORIDADE|ALERTA|ATENÇÃO|INFORMATIVO] variável: valor anterior → valor atual (intervalo) · direção · intervenção relacionada · resposta · Evidências: ...
Depois, as seções: O QUE MELHOROU / O QUE PIOROU / O QUE PERMANECE ESTÁVEL / NOVOS EVENTOS / INTERVENÇÕES E RESPOSTAS / PRINCIPAIS RISCOS / DADOS IMPORTANTES NÃO DISPONÍVEIS. Nada de alterações sem mudança documentada.`,
  concerns: `Produza a tela "POR QUE ESTOU PREOCUPADO?". Liste no máximo 8 achados priorizados; para cada um:
ACHADO / EVIDÊNCIA (valores, datas, intervalo) / TENDÊNCIA / POSSÍVEL SIGNIFICADO (interpretação ou hipótese, rotulada) / O QUE PRECISA SER CORRELACIONADO.
Inclua também ACHADOS QUE NECESSITAM CORRELAÇÃO (ex.: Glasgow pior após aumento de sedação, PA adequada com mais vasopressor, SpO2 estável com FiO2 maior, creatinina estável com diurese em queda, lactato persistente com PA normalizada, febre sem evidência microbiológica) e DADOS IMPORTANTES NÃO DISPONÍVEIS. Sem diagnóstico automático.`,
  working: `Produza a tela "O QUE ESTÁ FUNCIONANDO?". Para cada intervenção com resposta temporal favorável: INTERVENÇÃO (data/hora) → ALTERAÇÃO FISIOLÓGICA → RESPOSTA → DURAÇÃO DA RESPOSTA · Evidências: ... Classifique em RESPOSTA SUSTENTADA, RESPOSTA TRANSITÓRIA ou SEM RESPOSTA DOCUMENTADA. Termine com DADOS IMPORTANTES NÃO DISPONÍVEIS.`,
  notworking: `Produza a tela "O QUE NÃO ESTÁ FUNCIONANDO?". Identifique aumento de suporte sem melhora proporcional, intervenção repetida, resposta apenas transitória, persistência de alteração e tendência de piora — cada item com evidências, intervalo e o que precisa ser correlacionado. Não conclua falha terapêutica sem evidência suficiente. Termine com DADOS IMPORTANTES NÃO DISPONÍVEIS.`,
};

const ANALYSIS_TASK = `Produza a ANÁLISE CLÍNICA PROFUNDA nesta ordem de seções:
IDENTIFICAÇÃO CLÍNICA / PROBLEMA CENTRAL (problema principal, problemas secundários, disfunções orgânicas, complicações, riscos atuais, intervenções principais) / LINHA DO TEMPO CLÍNICA (data, hora, evento, sistema, intervenção, resposta, relevância) / ANÁLISE MULTISSISTÊMICA (neurológico, cardiovascular, respiratório, renal, hematológico, infeccioso, gastrointestinal e nutrição, pele e mobilidade — cada um com estado, tendência, suporte, intervenção→resposta) / DISPOSITIVOS INVASIVOS (local, inserção, dias, indicação, débito/aspecto, necessidade atual sinalizada para avaliação da equipe) / LINHA TEMPORAL FARMACOLÓGICA (medicamento, dose, via, início/suspensão/ajuste, indicação, resposta observada) / ESCORES / ICU LIBERATION A-F / ÚLTIMAS 24 HORAS / ALERTAS PRIORIZADOS (com evidências) / ACHADOS QUE NECESSITAM CORRELAÇÃO / DADOS IMPORTANTES NÃO DISPONÍVEIS / SÍNTESE CLÍNICA (objetiva, começando por "Paciente criticamente enfermo com…").
Ative MODO NEUROINTENSIVO se houver diagnóstico neurológico (separando alteração neurológica real de efeito de sedação, causa metabólica e causa sistêmica) e MODO SEPSE se houver suspeita, diagnóstico ou risco de sepse (reconhecimento, foco, culturas, antimicrobianos, lactato, perfusão, fluidos, reavaliação, controle de foco, descalonamento) — sem diagnosticar sepse automaticamente.`;

const CHAT_SYSTEM = `Você é médico intensivista com especialização em neurologia/neurointensivismo, respondendo dúvidas clínicas de um colega sobre um paciente específico internado em UTI neurológica.

Regras:
- Responda como especialista, com raciocínio clínico, linguagem médica objetiva, em português do Brasil.
- Fundamente a resposta primeiro nos dados do PASSÔMETRO do paciente (fornecidos abaixo) e depois na melhor evidência disponível.
- A fonte de consulta de evidência é ${EVIDENCE_SOURCE} (OpenEvidence): baseie as recomendações em evidência de alto nível (diretrizes de AHA/ASA, Neurocritical Care Society, SCCM, ESICM, ensaios clínicos e revisões sistemáticas) e cite explicitamente as referências que sustentam a conduta, indicando ${EVIDENCE_SOURCE} como plataforma de busca da evidência.
- NÃO invente dados do paciente. Se a informação não estiver no passômetro, escreva [DADO NÃO DISPONÍVEL NO PASSÔMETRO] e explique qual dado seria necessário.
- Separe claramente o que é dado do paciente, o que é interpretação clínica e o que é recomendação baseada em evidência.
- Termine com uma seção "Referências" listando as fontes utilizadas (autor/sociedade, ano, recomendação e nível de evidência quando aplicável).
- Responda no formato do MOTOR DE ANÁLISE: o que aconteceu, o que mudou, por que pode ter acontecido, qual foi a resposta, qual a principal preocupação e quais dados faltam. Rotule FATO / TENDÊNCIA / INTERPRETAÇÃO / HIPÓTESE / RECOMENDAÇÃO.
- Perguntas como "faça minha passagem de plantão", "o que mudou nas últimas 24h", "compare 6/12/24/48/72 horas", "qual órgão está mais comprometido", "o paciente está realmente melhorando", "qual suporte está aumentando" devem ser respondidas com comparação ANTES → AGORA → TENDÊNCIA e evidências (valores, datas, intervalo).
- Não calcule escore com dado ausente; apresente componentes utilizados e componentes faltantes.

${ENGINE_SYSTEM}

${ICU_LIBERATION}`;

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
    if (res.status === 429)
      throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402)
      throw new Error("Créditos de IA esgotados no workspace. Adicione créditos para continuar.");
    throw new Error(`Falha na análise (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("A IA não retornou conteúdo. Tente novamente.");
  return content;
}

/** Gera relato / passagem de plantão / telas analíticas do motor de análise profunda. */
export const generateCaseReport = createServerFn({ method: "POST" })
  .inputValidator(ReportInput)
  .handler(async ({ data }) => {
    const mode = data.mode ?? "report";
    const task =
      mode === "report"
        ? `Produza o RELATO CLÍNICO EVOLUTIVO completo conforme as regras, com absoluta fidelidade aos dados acima.\n\nEm seguida, acrescente as seções do motor de análise:\n${ANALYSIS_TASK}`
        : (MODE_TASKS[mode] ?? ANALYSIS_TASK);

    const system =
      mode === "report"
        ? `${REPORT_SYSTEM}\n\n${ENGINE_SYSTEM}\n\n${ICU_LIBERATION}`
        : `${ENGINE_SYSTEM}\n\n${ICU_LIBERATION}`;

    const report = await callGateway([
      { role: "system", content: system },
      { role: "user", content: `${data.context}\n\n${task}` },
    ]);
    return { report, mode };
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
      {
        role: "assistant",
        content: "Contexto do paciente recebido. Pode fazer a pergunta clínica.",
      },
      ...(data.history ?? []).map((m) => ({ role: m.role as string, content: m.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callGateway(messages);
    return { answer };
  });

/* ===================== ESCALA INTELIGENTE DO PRÓXIMO PLANTÃO ===================== */

const ShiftInput = z.object({
  context: z.string().min(1),
  clinicalHistory: z.string().optional(),
  report: z.string().optional(),
  windowLabel: z.string().min(1),
  windowKind: z.enum(["diurno", "noturno"]),
  windowHours: z.string().min(1),
  timeZone: z.string().optional(),
  /** Relato de encerramento do plantão anterior, quando existir. */
  previousShift: z.string().optional(),
});

const SHIFT_SYSTEM = `${ENGINE_SYSTEM}

${ICU_LIBERATION}

FONTES: a fonte institucional prioritária é a Society of Critical Care Medicine (SCCM), nas versões vigentes — ICU Liberation / ABCDEF Bundle, PADIS e PADIS Focused Update, Surviving Sepsis Campaign, Family-Centered Care. Quando a questão não for coberta pela SCCM, cite a diretriz especializada relevante identificando explicitamente a sociedade. OpenEvidence (https://www.openevidence.com) é fonte complementar de consulta de evidência, nunca verdade absoluta.

REGRA DE REFERÊNCIAS: toda recomendação relevante traz Fonte · Documento · Ano · Referência · Link. NUNCA inventar referência, DOI ou URL. Sem referência confiável, escreva "Referência específica não localizada.". Use apenas links institucionais reais e estáveis (sccm.org, openevidence.com).

SEGURANÇA: apoio à decisão. Não prescrever, não suspender medicamento, não determinar alta nem limitação terapêutica. Use "avaliar", "considerar", "monitorar", "reavaliar", "correlacionar".

NÃO ALUCINAÇÃO: informação inexistente = "NÃO DISPONÍVEL."; conflito = "DADOS CONFLITANTES."; conclusão impossível = "NÃO É POSSÍVEL DETERMINAR COM OS DADOS DISPONÍVEIS.". Não inventar horários: use apenas horários e frequências já documentados, ou justifique a periodicidade.

CORES: 🔴 alta prioridade · 🟠 atenção · 🟡 monitoramento · 🟢 favorável/estável · 🔵 informação · ⚪ dado ausente. Sempre acompanhar de texto.`;

const SHIFT_TASK = `Analise TODO o período disponível (não apenas o último registro), com foco nos eventos das últimas 24–72 horas, e execute internamente: contexto → linha do tempo → tendências → intervenções → respostas → riscos → ICU Liberation A-F → evidências.

Produza a ESCALA CLÍNICA DO PRÓXIMO PLANTÃO exatamente com estas seções numeradas, nesta ordem:

1. RESUMO EXECUTIVO — cartão 🧠 RESUMO DO PACIENTE, 5 a 8 linhas: por que está internado, estado atual, principais disfunções, suportes, evolução, principal preocupação.
2. O QUE MUDOU — 🔄 apenas alterações relevantes, uma por linha: cor + variável + valor anterior → valor atual (unidade) · horário/data · tendência · interpretação.
3. PRINCIPAIS PRIORIDADES — 🚨 de 3 a 5, cada uma com PRIORIDADE / EVIDÊNCIAS (valores, datas, intervalo) / TENDÊNCIA / O QUE MONITORAR / QUANDO REAVALIAR (só se houver horário ou frequência justificável) / CRITÉRIO DE ESCALADA / REFERÊNCIA.
4. NEUROLÓGICO — 5. HEMODINÂMICO — 6. RESPIRATÓRIO — 7. RENAL/METABÓLICO — 8. INFECCIOSO — 9. HEMATOLÓGICO — 10. NUTRIÇÃO — 11. MEDICAMENTOS CRÍTICOS — 12. DISPOSITIVOS: em cada um apresente ESTADO ATUAL / TENDÊNCIA / PRINCIPAIS ACHADOS / PRÓXIMAS 12 HORAS / PONTOS DE ATENÇÃO / REFERÊNCIAS. No neurológico integre Glasgow, NIHSS, pupilas, RASS, sedação, CAM-ICU, PIC, PPC, drenagem, neuroimagem, PA/PAM, PaCO2, PaO2, sódio, glicemia e temperatura, diferenciando deterioração neurológica de efeito de sedação, causa metabólica e causa sistêmica. No respiratório distinga "melhora com redução de suporte" de "estabilidade mantida com aumento de suporte". No infeccioso, quando aplicável, use Surviving Sepsis Campaign (SCCM).
13. ICU LIBERATION A-F — A PAIN / B SAT-SBT (elegível, realizado, motivo) / C ANALGESIA-SEDAÇÃO (RASS/SAS, meta) / D DELIRIUM (CAM-ICU/ICDSC, tendência) / E MOBILIDADE (barreiras) / F FAMÍLIA (comunicação, participação, objetivos de cuidado).
14. AGENDA DAS PRÓXIMAS 12 HORAS — ⏱️ linhas "HH:MM — ação", começando pelo início e terminando pelo fim da janela informada; somente horários documentados, frequências já estabelecidas ou rotinas justificáveis.
15. PENDÊNCIAS — 📋 lista com "☐ item — prioridade · motivo · horário (quando disponível) · fonte".
16. NÃO ESQUECER — 🔴 no máximo 5 itens, ordenados por prioridade.
17. RISCOS A MONITORAR — 🔮 no máximo 5, linguagem probabilística ("risco de…"), nunca afirmar piora futura.
18. CRITÉRIOS DE REAVALIAÇÃO — 🚨 alterações que devem motivar nova avaliação, baseadas em diretriz, protocolo ou meta registrada; não inventar limites.
19. PERGUNTAS PARA O PRÓXIMO PLANTÃO — ❓ até 5 perguntas objetivas.
20. EVIDÊNCIAS E REFERÊNCIAS — 📚 separadas em SCCM / OPENEVIDENCE / OUTRAS DIRETRIZES, cada uma com Fonte · Documento · Ano · Referência · Link real.

Encerre com ⚪ DADOS IMPORTANTES AUSENTES listando o que limita a análise.`;

/** Gera a escala clínica estruturada para a próxima janela de plantão de 12 horas. */
export const generateShiftSchedule = createServerFn({ method: "POST" })
  .inputValidator(ShiftInput)
  .handler(async ({ data }) => {
    const user = [
      `JANELA DO PRÓXIMO PLANTÃO: ${data.windowKind.toUpperCase()} (${data.windowHours})`,
      `ESCALA PREPARADA PARA: ${data.windowLabel}`,
      data.timeZone ? `Fuso horário: ${data.timeZone}` : "",
      "",
      `PASSÔMETRO DO PACIENTE:\n${data.context}`,
      data.clinicalHistory
        ? `\nHISTÓRIA CLÍNICA REGISTRADA PELA EQUIPE:\n${data.clinicalHistory}`
        : "",
      data.report ? `\nRELATO CLÍNICO EVOLUTIVO JÁ PRODUZIDO:\n${data.report}` : "",
      data.previousShift ? `\nENCERRAMENTO DO PLANTÃO ANTERIOR:\n${data.previousShift}` : "",
      "",
      SHIFT_TASK,
    ]
      .filter(Boolean)
      .join("\n");

    const schedule = await callGateway([
      { role: "system", content: SHIFT_SYSTEM },
      { role: "user", content: user },
    ]);
    return { schedule };
  });

const CloseShiftInput = z.object({
  context: z.string().min(1),
  schedule: z.string().min(1),
  windowLabel: z.string().min(1),
  tasks: z
    .array(z.object({ text: z.string(), done: z.boolean() }))
    .max(40)
    .optional(),
  notes: z.string().optional(),
});

/** Encerramento do plantão: eventos, tarefas concluídas/pendentes e handoff. */
export const closeShiftReport = createServerFn({ method: "POST" })
  .inputValidator(CloseShiftInput)
  .handler(async ({ data }) => {
    const tasks = (data.tasks ?? []).map((t) => `${t.done ? "☑" : "☐"} ${t.text}`).join("\n");
    const report = await callGateway([
      { role: "system", content: SHIFT_SYSTEM },
      {
        role: "user",
        content: `PASSÔMETRO DO PACIENTE:\n${data.context}\n\nESCALA DO PLANTÃO ${data.windowLabel}:\n${data.schedule}${
          tasks ? `\n\nSITUAÇÃO DAS TAREFAS:\n${tasks}` : ""
        }${data.notes ? `\n\nOBSERVAÇÕES DA EQUIPE:\n${data.notes}` : ""}\n\nProduza o 🏁 ENCERRAMENTO DO PLANTÃO com as seções: EVENTOS OCORRIDOS / TAREFAS CONCLUÍDAS / TAREFAS NÃO CONCLUÍDAS / ALTERAÇÕES CLÍNICAS / NOVOS PROBLEMAS / PENDÊNCIAS TRANSFERIDAS / RISCOS ATUAIS / HANDOFF PARA O PRÓXIMO PLANTÃO. Baseie-se apenas nos dados fornecidos; use "NÃO DISPONÍVEL." quando faltar informação.`,
      },
    ]);
    return { report };
  });

/* ===================== BALÃO DE INSIGHTS SOBRE UMA INFORMAÇÃO ===================== */

const InsightInput = z.object({
  context: z.string().min(1),
  info: z.string().min(1),
});

/** Sugere 4 ângulos de raciocínio sobre a informação apontada pelo balão. */
export const suggestInsightAngles = createServerFn({ method: "POST" })
  .inputValidator(InsightInput)
  .handler(async ({ data }) => {
    const content = await callGateway([
      {
        role: "system",
        content: `${ENGINE_SYSTEM}

Você recebe um TRECHO DE INFORMAÇÃO selecionado no passômetro de um paciente crítico e deve propor quatro ângulos de raciocínio clínico curtos, específicos e úteis, na seguinte ordem:
1 e 2 — relação direta dessa informação com ESTE caso (dados, tendência, interações, risco, conduta).
3 e 4 — o assunto em si, do ponto de vista acadêmico/científico (fisiopatologia, evidência, diretrizes, metas), com evidência consultada em ${EVIDENCE_SOURCE}.

Responda APENAS com JSON válido, sem comentários e sem blocos de código, no formato:
{"angles":[{"kind":"case","label":"até 6 palavras","question":"pergunta clínica completa"},...4 itens...]}
Os dois primeiros com kind "case", os dois últimos com kind "topic". Em português do Brasil.`,
      },
      {
        role: "user",
        content: `PASSÔMETRO DO PACIENTE:\n${data.context}\n\nINFORMAÇÃO APONTADA:\n"""${data.info.slice(0, 1200)}"""`,
      },
    ]);

    const raw = content.replace(/```json|```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let angles: Array<{ kind: string; label: string; question: string }> = [];
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed?.angles)) angles = parsed.angles;
    } catch {
      angles = [];
    }
    if (angles.length < 4) {
      angles = [
        {
          kind: "case",
          label: "Impacto neste caso",
          question: `Qual o significado clínico desta informação neste paciente: ${data.info.slice(0, 300)}?`,
        },
        {
          kind: "case",
          label: "Riscos e conduta",
          question: `Que riscos e condutas esta informação sugere neste paciente: ${data.info.slice(0, 300)}?`,
        },
        {
          kind: "topic",
          label: "Fisiopatologia",
          question: `Explique a fisiopatologia e os fundamentos científicos do assunto: ${data.info.slice(0, 300)}.`,
        },
        {
          kind: "topic",
          label: "Evidência e metas",
          question: `Qual a evidência atual e as metas recomendadas sobre: ${data.info.slice(0, 300)}? Cite referências.`,
        },
      ];
    }
    return {
      angles: angles.slice(0, 4).map((a) => ({
        kind: a.kind === "topic" ? "topic" : "case",
        label: String(a.label ?? "").slice(0, 60),
        question: String(a.question ?? ""),
      })),
    };
  });

/* ===================== MODO FASTHUG MAIDENS ===================== */

const FasthugInput = z.object({ context: z.string().min(1) });

/** Itens do checklist FASTHUG MAIDENS, na ordem de revisão. */
export const FASTHUG_MAIDENS_ITEMS = [
  { key: "F", title: "Feeding — nutrição", system: "dieta" },
  { key: "A", title: "Analgesia", system: "neuro" },
  { key: "S", title: "Sedação", system: "neuro" },
  { key: "T", title: "Tromboprofilaxia", system: "hemato" },
  { key: "H", title: "Cabeceira elevada (Head of bed)", system: "resp" },
  { key: "U", title: "Profilaxia de úlcera de estresse", system: "gi" },
  { key: "G", title: "Controle glicêmico", system: "renal" },
  { key: "M", title: "Medicações — reconciliação", system: "other" },
  { key: "A2", title: "Antimicrobianos — indicação e duração", system: "infec" },
  { key: "I", title: "Indicação de cada droga", system: "other" },
  { key: "D", title: "Dose e ajuste (renal/hepático)", system: "renal" },
  { key: "E", title: "Eletrólitos e distúrbios metabólicos", system: "renal" },
  { key: "N", title: "Não esquecer interações medicamentosas", system: "other" },
  { key: "S2", title: "Suspensão / desprescrição (stop dates)", system: "other" },
] as const;

export type FasthugStatus = "ok" | "attention" | "alert" | "nodata";

const FASTHUG_SYSTEM = `${ENGINE_SYSTEM}

Você conduz a revisão FASTHUG MAIDENS (SCCM / Vincent JL) do paciente crítico, item por item, usando SOMENTE os dados do passômetro.

Para cada um dos 14 itens informe:
- status: "ok" (adequado/contemplado), "attention" (parcial ou a otimizar), "alert" (lacuna relevante ou risco), "nodata" (não há dado no passômetro).
- assessment: 1 a 3 frases objetivas, citando os dados que sustentam o julgamento (valores, medicações, datas). Dado ausente = "Dado não disponível no passômetro".
- suggestions: de 0 a 3 sugestões de conduta, cada uma como frase curta e acionável, no estilo de prescrição/conduta de UTI (ex.: "Elevar cabeceira a 30–45°", "Avaliar profilaxia de TEV com enoxaparina após liberação neurocirúrgica"). Use verbos de apoio à decisão (avaliar, considerar, ajustar, monitorar, suspender se…). Não inventar dose que não conste no passômetro sem indicar que é sugestão a confirmar. Se o item já estiver adequado, retorne suggestions vazio.
- evidence: uma linha curta com a referência de apoio (sociedade + documento + ano), ou "Referência específica não localizada.".

Baseie a evidência na SCCM (ICU Liberation, PADIS, Surviving Sepsis Campaign) e, quando necessário, em diretriz especializada identificada. ${EVIDENCE_SOURCE} é fonte complementar de consulta.

Responda APENAS com JSON válido, sem comentários e sem blocos de código:
{"items":[{"key":"F","status":"ok","assessment":"...","evidence":"...","suggestions":["...","..."]}, ...14 itens na ordem informada...]}
Em português do Brasil.`;

/** Revisão FASTHUG MAIDENS item por item, com sugestões aplicáveis às condutas. */
export const reviewFasthugMaidens = createServerFn({ method: "POST" })
  .inputValidator(FasthugInput)
  .handler(async ({ data }) => {
    const list = FASTHUG_MAIDENS_ITEMS.map((i) => `${i.key} — ${i.title}`).join("\n");
    const content = await callGateway([
      { role: "system", content: FASTHUG_SYSTEM },
      {
        role: "user",
        content: `PASSÔMETRO DO PACIENTE:\n${data.context}\n\nITENS A REVISAR (use exatamente estas chaves em "key"):\n${list}`,
      },
    ]);

    const raw = content.replace(/```json|```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let parsedItems: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed?.items)) parsedItems = parsed.items;
    } catch {
      parsedItems = [];
    }

    const byKey = new Map(parsedItems.map((i) => [String(i["key"] ?? ""), i]));
    const items = FASTHUG_MAIDENS_ITEMS.map((def) => {
      const found = byKey.get(def.key);
      const status = String(found?.["status"] ?? "nodata");
      const suggestions = Array.isArray(found?.["suggestions"])
        ? (found["suggestions"] as unknown[])
            .map((s) => String(s).trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];
      return {
        key: def.key,
        title: def.title,
        system: def.system as string,
        status: (["ok", "attention", "alert", "nodata"].includes(status)
          ? status
          : "nodata") as FasthugStatus,
        assessment: String(found?.["assessment"] ?? "Dado não disponível no passômetro."),
        evidence: String(found?.["evidence"] ?? ""),
        suggestions,
      };
    });

    return { items };
  });

/* ===================== AJUSTE ANTIMICROBIANO PELA FUNÇÃO RENAL ===================== */

const RenalInput = z.object({
  context: z.string().min(1),
  info: z.string().min(1),
  renal: z.string().min(1),
  drugs: z.array(z.string()).min(1),
});

const RENAL_SYSTEM = `${ENGINE_SYSTEM}

Você atua agora como suporte de FARMACOLOGIA CLÍNICA / STEWARDSHIP em UTI, focado em AJUSTE DE DOSE ANTIMICROBIANA PELA FUNÇÃO RENAL e PRESERVAÇÃO DA FUNÇÃO RENAL.

A depuração de creatinina (Cockcroft-Gault) já foi calculada pelo passômetro e é fornecida: NÃO recalcule nem contradiga esse valor; use-o como referência. Se vier como não calculável, declare "[DADO NÃO DISPONÍVEL NO PASSÔMETRO]" e indique o que falta.

Para CADA antimicrobiano informado, produza:
- drug: nome exatamente como recebido.
- current: dose/via/intervalo em uso segundo o passômetro, ou "Dado não disponível no passômetro".
- adjustment: recomendação objetiva para a faixa de clearance atual (dose, intervalo, infusão estendida quando aplicável, dose de ataque preservada quando indicada, necessidade de nível sérico). Deixe claro quando NÃO houver necessidade de ajuste.
- nephro: medidas de preservação da função renal ligadas a essa droga (evitar associação nefrotóxica, hidratação, monitorização de creatinina/diurese, alvo de vale, substituição por opção menos nefrotóxica).
- risk: "alto", "moderado" ou "baixo" — risco de nefrotoxicidade/acúmulo neste paciente.
- evidence: referência curta (sociedade/consenso/bula + ano).

Considere terapia de substituição renal, diálise intermitente ou contínua, balanço hídrico e nefrotóxicos concomitantes (contraste, vancomicina + piperacilina-tazobactam, aminoglicosídeos, polimixina, AINE, IECA/BRA) quando constarem no passômetro.

Regras de precisão: não invente valores; dado ausente = "Dado não disponível no passômetro"; conflito entre registros = "⚠️ INCONSISTÊNCIA IDENTIFICADA". Evidência complementar consultada em ${EVIDENCE_SOURCE}.

Responda APENAS com JSON válido, sem comentários e sem blocos de código:
{"summary":"1 a 2 frases sobre a função renal atual e o impacto no esquema antimicrobiano","items":[{"drug":"...","current":"...","adjustment":"...","nephro":"...","risk":"moderado","evidence":"..."}]}
Em português do Brasil.`;

/** Sugere ajuste antimicrobiano conforme a depuração de creatinina calculada. */
export const suggestRenalAntimicrobialAdjustment = createServerFn({ method: "POST" })
  .inputValidator(RenalInput)
  .handler(async ({ data }) => {
    const content = await callGateway([
      { role: "system", content: RENAL_SYSTEM },
      {
        role: "user",
        content: `PASSÔMETRO DO PACIENTE:\n${data.context}\n\nFUNÇÃO RENAL CALCULADA PELO PASSÔMETRO:\n${data.renal}\n\nINFORMAÇÃO APONTADA NO PASSÔMETRO:\n"""${data.info.slice(0, 900)}"""\n\nANTIMICROBIANOS A AVALIAR (use exatamente estes nomes em "drug"):\n${data.drugs.join("\n")}`,
      },
    ]);

    const raw = content.replace(/```json|```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let summary = "";
    let list: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      summary = String(parsed?.summary ?? "");
      if (Array.isArray(parsed?.items)) list = parsed.items;
    } catch {
      list = [];
    }

    const items = list.slice(0, 8).map((i) => {
      const risk = String(i["risk"] ?? "moderado").toLowerCase();
      return {
        drug: String(i["drug"] ?? "").slice(0, 80),
        current: String(i["current"] ?? "Dado não disponível no passômetro"),
        adjustment: String(i["adjustment"] ?? "Dado não disponível no passômetro"),
        nephro: String(i["nephro"] ?? ""),
        risk: (["alto", "moderado", "baixo"].includes(risk) ? risk : "moderado") as
          | "alto"
          | "moderado"
          | "baixo",
        evidence: String(i["evidence"] ?? ""),
      };
    });

    return { summary, items };
  });
