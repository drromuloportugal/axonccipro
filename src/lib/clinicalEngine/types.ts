// Tipos do Motor Clínico consumido pelo assistente NETO.
// O motor é determinístico: nenhum limiar clínico depende do modelo de linguagem.

export type Provenance = "informado" | "calculado" | "inferido" | "nao_informado";

export type Priority = "critical" | "attention" | "pending" | "adequate";

export type Domain =
  | "sepse"
  | "ventilacao"
  | "hemodinamica"
  | "renal"
  | "neurocritico"
  | "infeccao"
  | "medicacoes"
  | "dispositivos"
  | "nutricao"
  | "dor_sedacao_delirium"
  | "trombose"
  | "transfusao"
  | "endocrino"
  | "cardiologia"
  | "paliativo"
  | "seguranca"
  | "timeline";

export const DOMAIN_LABEL: Record<Domain, string> = {
  sepse: "Sepse / choque",
  ventilacao: "Respiratório / ventilação",
  hemodinamica: "Hemodinâmica",
  renal: "Renal / metabólico",
  neurocritico: "Neurológico",
  infeccao: "Infecção / antimicrobianos",
  medicacoes: "Medicações",
  dispositivos: "Dispositivos invasivos",
  nutricao: "Nutrição / metabolismo",
  dor_sedacao_delirium: "Dor, sedação, delirium, mobilidade e sono",
  trombose: "Trombose / anticoagulação",
  transfusao: "Transfusão",
  endocrino: "Endócrino / glicemia",
  cardiologia: "Cardiologia",
  paliativo: "Metas de cuidado",
  seguranca: "Segurança e qualidade",
  timeline: "Linha do tempo",
};

/** Cor/prioridade visual exibida no NETO. */
export const PRIORITY_META: Record<
  Priority,
  { badge: string; label: string; className: string; rank: number }
> = {
  critical: {
    badge: "🔴",
    label: "CRÍTICO",
    className: "text-clinical-critical",
    rank: 0,
  },
  attention: {
    badge: "🟠",
    label: "ATENÇÃO",
    className: "text-clinical-warning",
    rank: 1,
  },
  pending: {
    badge: "🟡",
    label: "PENDÊNCIA",
    className: "text-clinical-attention",
    rank: 2,
  },
  adequate: {
    badge: "🟢",
    label: "ADEQUADO",
    className: "text-clinical-stable",
    rank: 3,
  },
};

export const DOMAIN_BADGE: Partial<Record<Domain, string>> = {
  ventilacao: "🔵",
  neurocritico: "🟣",
  dispositivos: "🟧",
  nutricao: "🩵",
};

/** Um dado do paciente, sempre com a origem classificada. */
export interface DataPoint {
  key: string;
  label: string;
  value: string;
  num?: number | null;
  unit?: string;
  provenance: Provenance;
  at?: string;
  domain: Domain;
  note?: string;
}

/** Referência de evidência versionada. */
export interface EvidenceRef {
  code: string;
  society: string;
  document: string;
  version: string;
  year: number;
  topic: string;
  statement: string;
  strength?: string;
  certainty?: string;
  url: string;
}

export interface MissingData {
  key: string;
  label: string;
  impact: string;
  domain: Domain;
}

export interface EngineRecommendation {
  text: string;
  /** Tarefa de monitorização/reavaliação — nunca uma ordem executada. */
  monitoring: string;
  evidence?: EvidenceRef;
  institutional?: { code: string; name: string; statement: string; precedence: boolean };
}

export interface Finding {
  code: string;
  domain: Domain;
  priority: Priority;
  title: string;
  /** Bloco "POR QUE?" — dados que dispararam a regra. */
  why: string[];
  recommendations: EngineRecommendation[];
  missing: MissingData[];
}

export interface ScoreOutput {
  key: string;
  label: string;
  value: number | string | null;
  interpretation: string;
  components: { label: string; value: string }[];
  missing: string[];
  available: boolean;
  source: string;
  at?: string;
}

export interface GuidelineConflict {
  topic: string;
  domain: Domain;
  guideline: string;
  institutional: string;
  resolution: string;
}

export interface PlanTask {
  window: "07:00→19:00" | "19:00→07:00";
  time: string;
  domain: Domain;
  priority: Priority;
  text: string;
}

export type FasthugStatus = "ok" | "pending" | "attention" | "contraindicated" | "nodata";

export interface FasthugItem {
  key: string;
  letter: string;
  title: string;
  system: string;
  domain: Domain;
  status: FasthugStatus;
  assessment: string;
  suggestions: string[];
  evidence?: EvidenceRef;
}

export type EngineIntent =
  | "full"
  | "fasthug"
  | "scores"
  | "guidelines"
  | "plan"
  | "pending"
  | "medications"
  | "ventilation"
  | "hemodynamics"
  | "renal"
  | "neuro"
  | "infection"
  | "devices"
  | "timeline"
  | "risk";

export interface EngineResult {
  patientId: string;
  patientLabel: string;
  intent: EngineIntent;
  intentLabel: string;
  generatedAt: string;
  /** Etapas do pipeline efetivamente executadas. */
  pipeline: string[];
  dataset: DataPoint[];
  problems: string[];
  scores: ScoreOutput[];
  findings: Finding[];
  fasthug: FasthugItem[];
  plan: PlanTask[];
  missing: MissingData[];
  conflicts: GuidelineConflict[];
  /** Perguntas que o motor não pode concluir com os dados presentes. */
  inconclusive: string[];
  guidelines: EvidenceRef[];
  timeline: { at: string; label: string; domain: Domain }[];
  summary: string;
}
