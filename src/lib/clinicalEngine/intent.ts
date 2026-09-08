// Reconhecimento de intenção: botões de ação rápida e perguntas em linguagem natural.

import type { Domain, EngineIntent } from "./types";

export const QUICK_ACTIONS: { intent: EngineIntent; label: string; emoji: string }[] = [
  { intent: "full", label: "Analisar paciente", emoji: "🧠" },
  { intent: "fasthug", label: "FASTHUG-MAIDENS", emoji: "✅" },
  { intent: "scores", label: "Scores", emoji: "🔢" },
  { intent: "guidelines", label: "Diretrizes", emoji: "📚" },
  { intent: "plan", label: "Plano 12h", emoji: "🕒" },
  { intent: "pending", label: "Pendências", emoji: "🟡" },
  { intent: "medications", label: "Medicações", emoji: "💊" },
  { intent: "ventilation", label: "Ventilação", emoji: "🔵" },
  { intent: "hemodynamics", label: "Hemodinâmica", emoji: "❤️" },
  { intent: "renal", label: "Renal", emoji: "💧" },
  { intent: "neuro", label: "Neurológico", emoji: "🟣" },
  { intent: "infection", label: "Infecção/Antibióticos", emoji: "🦠" },
  { intent: "devices", label: "Dispositivos", emoji: "🟧" },
  { intent: "timeline", label: "Timeline", emoji: "📈" },
];

export const INTENT_LABEL: Record<EngineIntent, string> = {
  full: "Análise completa",
  fasthug: "FASTHUG-MAIDENS",
  scores: "Escores clínicos",
  guidelines: "Diretrizes aplicáveis",
  plan: "Plano das próximas 12 h",
  pending: "Pendências e dados faltantes",
  medications: "Medicações",
  ventilation: "Respiratório e ventilação",
  hemodynamics: "Hemodinâmica",
  renal: "Renal e metabólico",
  neuro: "Neurológico",
  infection: "Infecção e antimicrobianos",
  devices: "Dispositivos invasivos",
  timeline: "Linha do tempo",
  risk: "Principal risco",
};

/** Domínios em foco por intenção; vazio = todos. */
export const INTENT_DOMAINS: Record<EngineIntent, Domain[]> = {
  full: [],
  fasthug: [],
  scores: [],
  guidelines: [],
  plan: [],
  pending: [],
  risk: [],
  timeline: ["timeline"],
  medications: ["medicacoes", "infeccao"],
  ventilation: ["ventilacao"],
  hemodynamics: ["hemodinamica", "sepse", "cardiologia"],
  renal: ["renal"],
  neuro: ["neurocritico", "dor_sedacao_delirium"],
  infection: ["infeccao", "sepse"],
  devices: ["dispositivos"],
};

const PATTERNS: [RegExp, EngineIntent][] = [
  [/round|passagem|plantão|analise|análise|avalia|resum/i, "full"],
  [/fasthug|maidens|checklist/i, "fasthug"],
  [/score|escore|sofa|apache|saps|news|qsofa/i, "scores"],
  [/diretriz|guideline|evidênc|evidenc|sociedade|referênc/i, "guidelines"],
  [/plano|próximas|proximas|12\s?h|conduta das/i, "plan"],
  [/o que falta|falta|pendênc|pendenc|incompleto/i, "pending"],
  [/antibiótic|antibiotic|antimicrobian|infec|cultura|sepse/i, "infection"],
  [/medicaç|medicac|prescriç|remédio|droga/i, "medications"],
  [/ventil|respirat|vm|peep|gasometria|sdra|ards|desmame/i, "ventilation"],
  [/hemodinâm|hemodinam|press|vasopressor|nora|choque|perfus|lactato/i, "hemodynamics"],
  [/renal|creatinina|diurese|rim|aki|diáli|dial/i, "renal"],
  [/neuro|glasgow|sedaç|sedac|delirium|pupil|pic|convuls/i, "neuro"],
  [/dispositiv|cateter|cvc|sonda|dreno|tubo|acesso/i, "devices"],
  [/timeline|linha do tempo|evoluç|evoluc|histór|histor/i, "timeline"],
  [/risco|preocup|gravidade|pior/i, "risk"],
];

export function detectIntent(question: string): EngineIntent {
  const q = question.trim();
  if (!q) return "full";
  for (const [re, intent] of PATTERNS) if (re.test(q)) return intent;
  return "full";
}
