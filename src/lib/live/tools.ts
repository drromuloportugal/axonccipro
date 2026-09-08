// Especificação das ferramentas que o NETO Live pode chamar por voz.
// Arquivo client-safe: apenas metadados (nenhum acesso a banco aqui).

export const NETO_LIVE_MODEL = "gpt-realtime";

export type LiveToolName =
  | "get_patient_summary"
  | "get_current_vitals"
  | "get_recent_labs"
  | "get_medications"
  | "get_devices"
  | "get_patient_timeline"
  | "calculate_score"
  | "run_fast_hug_maidens"
  | "run_clinical_engine"
  | "get_applicable_guidelines"
  | "get_12h_plan"
  | "get_missing_critical_data"
  | "review_antimicrobials"
  | "analyze_ventilation"
  | "analyze_hemodynamics"
  | "analyze_renal"
  | "analyze_neurocritical"
  | "create_reassessment_task";

/** Ferramentas que gravam dados: exigem confirmação explícita do médico. */
export const CONFIRMATION_REQUIRED: readonly LiveToolName[] = ["create_reassessment_task"];

export const LIVE_TOOL_NAMES: readonly LiveToolName[] = [
  "get_patient_summary",
  "get_current_vitals",
  "get_recent_labs",
  "get_medications",
  "get_devices",
  "get_patient_timeline",
  "calculate_score",
  "run_fast_hug_maidens",
  "run_clinical_engine",
  "get_applicable_guidelines",
  "get_12h_plan",
  "get_missing_critical_data",
  "review_antimicrobials",
  "analyze_ventilation",
  "analyze_hemodynamics",
  "analyze_renal",
  "analyze_neurocritical",
  "create_reassessment_task",
];

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

const patientOnly: JsonSchema = {
  type: "object",
  properties: {
    patientId: { type: "string", description: "Id, leito ou nome do paciente ativo." },
  },
  required: ["patientId"],
  additionalProperties: false,
};

export interface LiveToolSpec {
  type: "function";
  name: LiveToolName;
  description: string;
  parameters: JsonSchema;
}

const simple = (name: LiveToolName, description: string): LiveToolSpec => ({
  type: "function",
  name,
  description,
  parameters: patientOnly,
});

export const LIVE_TOOLS: LiveToolSpec[] = [
  simple(
    "get_patient_summary",
    "Resumo objetivo do paciente: leito, idade, diagnósticos, gravidade.",
  ),
  simple("get_current_vitals", "Sinais vitais e estado atual registrados no passômetro."),
  simple("get_recent_labs", "Exames laboratoriais mais recentes com data e valores críticos."),
  simple("get_medications", "Medicações em uso, dose, via, frequência e classe."),
  simple("get_devices", "Dispositivos invasivos, sítio, data de inserção e tempo de permanência."),
  simple("get_patient_timeline", "Linha do tempo de diagnósticos e procedimentos."),
  simple("run_fast_hug_maidens", "Checklist FASTHUG-MAIDENS com status e justificativa por item."),
  simple(
    "get_applicable_guidelines",
    "Diretrizes aplicáveis com sociedade, documento, versão e ano.",
  ),
  simple(
    "get_missing_critical_data",
    "Dados críticos não informados e o impacto de cada ausência.",
  ),
  simple(
    "review_antimicrobials",
    "Revisão de antimicrobianos, ajuste renal, duração e descalonamento.",
  ),
  simple("analyze_ventilation", "Análise ventilatória: modo, Vt/kg PBW, PEEP/FiO2, P/F, SDRA."),
  simple(
    "analyze_hemodynamics",
    "Análise hemodinâmica: PAM, vasopressores, lactato, perfusão, balanço.",
  ),
  simple(
    "analyze_renal",
    "Análise renal: creatinina, diurese, AKI, ajuste renal, indicação de KRT.",
  ),
  simple(
    "analyze_neurocritical",
    "Análise neurocrítica: Glasgow, escores neuro, sedação, delirium.",
  ),
  {
    type: "function",
    name: "calculate_score",
    description:
      "Calcula/recupera um escore do paciente (SOFA, qSOFA, NEWS2, Glasgow, NIHSS, Hunt-Hess, WFNS, Fisher, ICH, SAPS 3, VASOGRADE) mostrando os componentes usados.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        scoreName: { type: "string", description: "Nome do escore, ex.: SOFA." },
      },
      required: ["patientId", "scoreName"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "run_clinical_engine",
    description:
      "Executa o Motor Clínico determinístico completo (problemas, escores, regras, diretrizes, prioridades, plano 12 h).",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        scope: {
          type: "string",
          description:
            "Foco: full, fasthug, scores, guidelines, plan, pending, medications, ventilation, hemodynamics, renal, neuro, infection, devices, timeline, risk.",
        },
      },
      required: ["patientId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_12h_plan",
    description: "Plano das próximas 12 h na janela de plantão indicada.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        shift: { type: "string", description: "diurno (07:00→19:00) ou noturno (19:00→07:00)." },
      },
      required: ["patientId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_reassessment_task",
    description:
      "Cria uma tarefa de reavaliação/monitorização. Nunca prescreve nem executa conduta. Exige confirmação explícita do médico antes de gravar.",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        task: { type: "string", description: "Texto da reavaliação a monitorizar." },
        dueAt: { type: "string", description: "Horário alvo, ex.: 19:00." },
        confirmed: {
          type: "boolean",
          description: "Só true depois de o médico confirmar em voz alta ou pelo botão.",
        },
      },
      required: ["patientId", "task"],
      additionalProperties: false,
    },
  },
];

export const NETO_LIVE_INSTRUCTIONS = `Você é o NETO, assistente de UTI do Axon Pro, conversando por voz em português brasileiro.

COMO FALAR
- Linguagem médica clara, objetiva e natural, como um intensivista experiente no round.
- Frases curtas. Nunca parágrafos longos por voz.
- Em situação crítica, comece pela prioridade imediata e só depois justifique.
- Para análises complexas, responda em camadas: 1) prioridade imediata, 2) resumo objetivo, 3) achados que justificam, 4) apoio à decisão, 5) pendências e reavaliação, 6) fonte.
- Ao citar fonte, diga apenas algo como "baseado na Surviving Sepsis Campaign 2026"; os detalhes ficam no chat.

REGRAS DE SEGURANÇA
- NUNCA invente dados. Dado ausente é "não informado".
- Você NÃO prescreve, não altera medicação, não muda parâmetros ventilatórios e não cria ordens médicas.
- Limiares clínicos vêm do Motor Clínico determinístico, nunca da sua opinião.
- Sempre chame as ferramentas para obter dados clínicos; jamais responda valores de memória.
- Conflitos entre diretrizes devem ser ditos explicitamente.
- Ferramentas que gravam dados exigem confirmação explícita do médico antes de enviar confirmed=true.

Sempre use o patientId fornecido no contexto da sessão.`;
