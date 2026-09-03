import type { DeviceCategory } from "./devices";

export type Severity = "stable" | "attention" | "critical";

export type TimelineKind =
  | "neutral"
  | "resp"
  | "stable"
  | "attention"
  | "device"
  | "critical"
  | "neuro"
  | "nutri";

export type DiagnosisCategory = "previous" | "current" | "inactive" | "complication";

export interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
  kind: TimelineKind;
  /** Apenas para diagnósticos: classifica como pregresso, atual ou complicação. */
  category?: DiagnosisCategory;
}

export interface AntibioticChange {
  kind: "prorrogação" | "escalonamento" | "descalonamento" | "suspensão";
  note: string;
  date: string; // ISO
}

export type PumpMode = "continua" | "intermitente" | "bolus";
export type PumpCategory =
  | "vasoativa" | "sedativo" | "antimicrobiano"
  | "insulina" | "hidratacao" | "analgesico" | "outro";
export type SolventType = "SF 0,9%" | "SG 5%" | "Água destilada" | "Outra";
export type PumpStatus =
  | "running"//  em funcionamento
  | "ending_soon"//  próxima de terminar
  | "needs_change" //  necessita troca
  | "stopped"//  interrompida
  | "occluded"//  oclusão detectada
  | "titrating";   //  em titulação

export interface PumpInfusion {
  mode: PumpMode;
  solvent: SolventType;
  /** Nome livre do medicamento na bomba (independente do nome técnico da medicação). */
  pumpDrugName?: string;
  drugAmountMg: number;           // qty of drug in the bag (mg or UI)
  finalVolumeMl: number;          // total bag volume (mL)
  concentrationMcgPerMl?: number; // calculated, mcg/mL (or UI/mL)
  targetDoseValue?: number;
  targetDoseUnit?: "mcg/kg/min" | "mg/kg/h" | "UI/h" | "mL/h" | "mcg/min" | "mg/h";
  rateMlPerHour?: number;         // calculated or manual
  bagVolumeMl?: number;           // bag start volume
  bagStartedAt?: string;          // ISO when bag started
  infusionDurationMin?: number;   // intermittent/ATB pumps (per dose)
  status?: PumpStatus;            // manual operational status
  accessDeviceId?: string;        // linked InvasiveDevice.id
  accessLumen?: number;           // which lumen of the access is used
  pumpNotes?: string;             // free-text history / alteration notes
}

export type DiluentSolution =
  | "SF 0,9%" | "SG 5%" | "SG 10%" | "Ringer Lactato"
  | "Ringer Simples" | "Água destilada (ABD)" | "Outra";

export interface Diluent {
  solution: DiluentSolution;
  volumeMl: number;
}

export interface PastMedication {
  id: string;
  name: string;
  dose?: string;
  route?: string;
  freq?: string;
  period?: string;     // free text e.g. "2020-2024" or "3 meses"
  reason?: string;     // indication
  status?: "em uso domiciliar" | "suspenso" | "alergia/reação" | "uso prévio";
  notes?: string;
}

/** Class used to group meds in the dashboard column 4. */
export type MedicationClass =
  | "antibiotic" | "pump" | "hydration" | "iv" | "im" | "sc" | "oral" | "inhaled" | "topical";

export interface Medication {
  name: string;
  dose: string;
  route: string;
  freq: string;
  start: string;
  end?: string;
  kind: TimelineKind;
  active?: boolean;
  /** Explicit classification for the medications column grouping. */
  class?: MedicationClass;
  protocol?: "Geral" | "Neuro" | "Cardio";
  concentrationMgPerMl?: number;
  mlPerHour?: number;

  /** Faixa de dose administrável definida na calculadora (dois pontos da barra). */
  doseMinValue?: number;
  doseMaxValue?: number;
  doseRangeUnit?: string;
  /** mL/h correspondentes à dose mínima e máxima. */
  mlPerHourMin?: number;
  mlPerHourMax?: number;


  // Diluent / soro chosen by user (independent of pump bag)
  diluent?: Diluent;

  // Pump
  pump?: PumpInfusion;
  category?: PumpCategory;
  therapeuticClass?: string;

  // Antimicrobial tracking
  isAntibiotic?: boolean;
  startISO?: string;
  plannedEndISO?: string;
  plannedDoses?: number;
  dosesGiven?: number;
  changes?: AntibioticChange[];
}

export interface ExamRow {
  label: string;
  value: string;
  unit?: string;
  trend: "up" | "down" | "flat";
  critical?: boolean;
  code?: string;
  valueNum?: number;
  takenAt?: string;
  history?: { takenAt: string; value: number }[];
}

export type ImagingModality =
  | "RX" | "USG" | "TC" | "RM" | "ECO" | "ECODOPPLER" | "ANGIO" | "MAMO" | "PET" | "CINTILO" | "OUTRO";


export interface ImagingImage {
  id: string;
  dataUrl: string;   // base64 data URL (persisted in JSON)
  caption?: string;
}

export interface ImagingExam {
  id: string;
  modality: ImagingModality;
  region: string;          // ex.: "Tórax", "Crânio", "Abdome total"
  performedAt: string;     // ISO date / datetime
  summary?: string;        // resumo do achado / impressão
  conclusion?: "normal" | "alterado" | "critico" | "pendente";
  /** Expectativa do resultado: bom (esperado) ou mau (desfavorável). */
  outcome?: "bom" | "mau";
  /** Status de solicitação: solicitado ou concluído. */
  status?: "solicitado" | "concluido";
  reportedBy?: string;
  images?: ImagingImage[]; // anexos do exame
}

/** Eletroencefalograma com parecer. */
export interface EegRecord {
  id: string;
  performedAt: string;     // ISO date
  report: string;          // parecer / laudo descritivo
  reportedBy?: string;
}

/** Registro de hemotransfusão (transfusão de hemocomponentes). */
export interface Hemotransfusion {
  id: string;
  date: string;            // ISO date
  component: string;       // ex.: "Concentrado de hemácias", "Plasma", "Plaquetas"
  volume?: string;         // ex.: "1 bolsa · 250 mL"
  note?: string;           // indicação / observação
}


export type ConductSystem =
  | "dieta" | "fono" | "resp" | "cardio" | "neuro" | "renal" | "gi" | "infec"
  | "hemato" | "skin" | "other";

export type AnnotationColor = "default" | "green" | "yellow" | "orange" | "red" | "teal" | "purple";

export interface ConductSubItem {
  text: string;
  done?: boolean;
  /** Cor de destaque da fonte da anotação. */
  color?: AnnotationColor;
}

export interface Conduct {
  team: "Médica" | "Enfermagem" | "Fisioterapia" | "Nutrição" | "Fono" | "Psicologia";
  /** @deprecated Mantido para compat; agora o "tópico" é o próprio sistema orgânico. */
  text: string;
  done: boolean;
  system?: ConductSystem;
  subItems?: ConductSubItem[];
}


export interface Goal {
  text: string;
  met: boolean;
}

export interface InvasiveDevice {
  id: string;
  category: DeviceCategory;
  typeCode: string;             // matches DEVICE_TYPES.code
  site?: string;
  side?: "D" | "E";
  lumens?: 1 | 2 | 3 | 4;
  size?: string;                // tube nº, Fr, "3 vias"
  insertedAt: string;           // ISO datetime
  insertedBy?: string;
  /** Indicação clínica para o dispositivo. */
  indication?: string;
  /** Número de tentativas de punção/inserção. */
  attempts?: number;
  /** Técnica utilizada (ex.: USG, anatômica, Seldinger, broncoscopia). */
  technique?: string;
  /** Última avaliação registrada (ISO). */
  lastReviewedAt?: string;
  /** Data programada para próxima troca (ISO). */
  nextChangeAt?: string;
  notes?: string;
  recommendedMaxDays?: number;  // override default
  removedAt?: string;

  /** Traqueostomia: tipo de cânula. */
  cannulaType?: "metálica" | "plástica";
  /** Traqueostomia: data da última troca de cânula (renova o prazo). */
  lastCannulaChangeAt?: string;
  /** Histórico de trocas de cânula. */
  cannulaChanges?: { at: string; type?: "metálica" | "plástica"; notes?: string }[];
}


export interface PatientOrigin {
  type: "Hospital" | "UPA" | "Enfermaria" | "Centro Cirúrgico" | "Pronto-Socorro" | "Domicílio" | "Outro";
  name?: string;
  unit?: string;
  city?: string;
  state?: string;
}

// ============================================================================
// Infection model
// ============================================================================

export type InfectionStatus = "resolvido" | "suspeito" | "provavel" | "confirmado";

export type InfectionSite =
  | "PAC" | "PAV" | "EMPIEMA" | "ABSC_PULM"
  | "MENINGITE" | "VENTRICULITE" | "INF_DVE" | "ABSC_CEREBRAL"
  | "BACTEREMIA" | "SEPSE" | "IRC"
  | "ITU" | "PIELONEFRITE" | "INF_SVD"
  | "PERITONITE" | "COLECISTITE" | "DIVERTICULITE" | "ABSC_ABD" | "FISTULA_INF"
  | "CELULITE" | "FASCEITE" | "LPP_INF"
  | "OSTEOMIELITE" | "ARTRITE_SEPTICA";

export interface InfectionFocus {
  id: string;
  site: InfectionSite;
  status: InfectionStatus;
  unstable?: boolean;
  startedAt: string;
  resolvedAt?: string;
  relatedDeviceIds?: string[];
  cultureIds?: string[];
  antimicrobials?: string[];   // medication.name references
  notes?: string;
}

export type CultureResult = "negativa" | "positiva" | "andamento";
export type AntibiogramResult = "S" | "I" | "R";
export interface AntibiogramEntry {
  drug: string;
  result: AntibiogramResult;
  mic?: string;
}

export interface Culture {
  id: string;
  source: string;              // free label ("Hemocultura periférica", "Urocultura"...)
  sourceCode?: string;         // catalog code (see lib/cultures.ts)
  collectedAt: string;
  collectionSite?: string;     // ex.: "CVC jugular D", "Veia periférica", "Sonda vesical"
  method?: string;             // ex.: "jato médio", "punção suprapúbica", "broncoscopia"
  sampleCount?: number;        // nº de amostras coletadas (hemoculturas pareadas)
  bacterialCount?: string;     // ex.: ">100.000 UFC/mL"
  aspect?: string;             // secreção: purulenta, sanguinolenta etc.
  result?: CultureResult;
  organism?: string;
  resistanceProfile?: "MDR" | "XDR" | "PDR" | "sensivel" | "pendente";
  sensitivities?: string[];
  resistances?: string[];
  antibiogram?: AntibiogramEntry[];
  notes?: string;
  linkedFocusId?: string;
  linkedDeviceId?: string;
}

export type InfectionEventKind =
  | "febre" | "cultura_coletada" | "cultura_positiva"
  | "atb_inicio" | "atb_fim" | "pcr" | "controle_foco" | "instabilidade" | "outro";

export interface InfectionTimelineEvent {
  at: string;
  kind: InfectionEventKind;
  label: string;
  focusId?: string;
}


// ============================================================================
// Pressure injury (LPP / escara)
// ============================================================================

export type LPPStage = "1" | "2" | "3" | "4" | "NC" | "LTP";
export type LPPView = "anterior" | "posterior" | "lateral_d" | "lateral_e";
export type LPPSide = "D" | "E" | "central" | "bilateral";

export interface LPPEvolution {
  at: string;
  stage: LPPStage;
  professional: string;
  notes?: string;
}

export interface LPPLesion {
  id: string;
  identifiedAt: string;          // ISO date+time
  professional: string;
  site: string;                  // catalog key OR "Livre"
  siteLabel?: string;
  view: LPPView;
  side?: LPPSide;
  count: number;
  stage: LPPStage;
  x?: number;                    // free position on the SVG (viewBox 200×510)
  y?: number;
  notes?: string;
  evolutions?: LPPEvolution[];
  resolvedAt?: string;
}


// ============================================================================
// Intubação orotraqueal — Jornada guiada
// ============================================================================

export type IntubationMode = "ISR" | "DSI" | "Convencional";
export type IntubationStatus = "em_andamento" | "concluida" | "cancelada";

export interface IntubationRecord {
  id: string;
  createdAt: string;
  updatedAt?: string;
  mode: IntubationMode;
  status: IntubationStatus;
  currentStep?: number;
  progress?: number;

  weightKg?: number;
  heightCm?: number;
  sex?: "M" | "F";
  age?: number;

  equipment?: Record<string, boolean>;
  team?: Record<string, string>;

  physio?: {
    pas?: number; pad?: number; fc?: number; fr?: number;
    spo2?: number; temp?: number; glasgow?: number;
    conditions?: string[];
  };

  preoxMethod?: string;
  preoxSeconds?: number;

  drugs?: { name: string; doseMg?: number; volumeMl?: number; note?: string }[];

  procedure?: {
    attempt?: number;
    device?: string;
    cormack?: "I" | "II" | "III" | "IV";
    burp?: boolean;
    bougie?: boolean;
    laryngoscopySec?: number;
    complications?: string[];
  };

  confirmation?: Record<string, boolean>;
  confirmed?: boolean;

  postVent?: {
    mode?: string; fio2?: number; peep?: number; fr?: number;
    vt?: number; ie?: string; plateau?: number; drivingPressure?: number;
    sedation?: string; analgesia?: string; nmb?: string;
  };

  complications?: string[];
  notes?: string;
}





export interface Patient {
  id: string;
  name: string;
  bed: string;
  archived?: boolean;
  archivedAt?: string;          // ISO
  age: number;
  sex: "M" | "F";
  weight: number;
  height?: number;              // cm
  birthDate?: string;           // ISO yyyy-mm-dd
  origin?: PatientOrigin;

  admissionHosp: string;
  admissionICU: string;
  daysHosp: number;
  daysICU: number;
  attending: string;
  team: string;
  severity: Severity;

  diagnoses: TimelineEvent[];
  social: { tabagismo?: string; etilismo?: string; ocupacao?: string; dependencia?: string };
  pastMedications?: PastMedication[];
  allergies: string[];

  /** Representante legal / contato de emergência */
  legalRepresentative?: { name?: string; relation?: string; phone?: string };
  /** Segundo representante legal / contato adicional */
  legalRepresentative2?: { name?: string; relation?: string; phone?: string };
  /** Diretivas antecipadas de vontade */
  advanceDirective?: {
    intubation?: "allow" | "refuse" | "unknown";
    resuscitation?: "allow" | "refuse" | "unknown";
    notes?: string;
  };
  /** Doação de órgãos */
  organDonation?: "yes" | "no" | "family" | "unknown";

  procedures: TimelineEvent[];
  medications: Medication[];
  exams: ExamRow[];
  imaging?: ImagingExam[];
  eeg?: EegRecord[];
  hemotransfusions?: Hemotransfusion[];
  devices?: InvasiveDevice[];

  conducts: Conduct[];
  goals: Goal[];

  infections?: InfectionFocus[];
  cultures?: Culture[];
  infectionTimeline?: InfectionTimelineEvent[];


  lpp?: LPPLesion[];
  intubations?: IntubationRecord[];
  dischargeCheck?: DischargeCheck;
  saps3?: Saps3Record;
  fisher?: import("@/components/FisherPanel").FisherRecord;
  huntHess?: import("@/components/HuntHessPanel").HuntHessRecord;
  wfns?: import("@/components/WfnsPanel").WfnsRecord;
  ichScore?: import("@/components/IchScorePanel").IchRecord;
  nihss?: import("@/components/NihssPanel").NihssRecord;



  state: {
    glasgow: number;
    rass: number;
    pam: number;
    dva: string | null;
    vent: string;
    fio2: number;
    diurese: number;
    temp: number;
    dieta: string;
    infection?: string;
    notes?: string;
    // Parâmetros vitais ampliados (todos opcionais)
    fcMax?: number;
    fr?: number;
    tempMax?: number;
    spo2?: number;
    glicemia?: number;
    diureseHoraria?: number;
    balancoHidrico?: number;
    /** Bristol stool scale for last evacuation (1-7) — mantido para compat. */
    bristol?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    /** Volume qualitativo das fezes (compat). */
    fecalVolume?: "ausente" | "+" | "++" | "+++";
    /** Histórico de eliminações intestinais no plantão (permite múltiplas). */
    stools?: StoolEntry[];
    /** Horas sem evacuar (para detecção de constipação grave >72h). */
    hoursWithoutStool?: number;
    /** FC mínima em 24h. */
    fcMin?: number;
    /** Pressão arterial sistólica (mmHg). */
    pas?: number;
    /** Pressão arterial diastólica (mmHg). */
    pad?: number;
    /** Descrição qualitativa da PA (quando não houver PAS/PAD). */
    bpQualitative?: "normotensa" | "hip_leve" | "hip_mod" | "hip_grave" | "hipotensao";
    /** Diurese total em 24h (mL). */
    diurese24?: number;
    /** Resíduo gástrico (mL). */
    residuoGastrico?: number;

    /** Registros seriados de sinais vitais (múltiplas medidas por parâmetro). */
    vitalSeries?: {
      temp?: VitalReading[];
      spo2?: VitalReading[];
      fc?: VitalReading[];
      pam?: VitalReading[];
      glicemia?: VitalReading[];
      /** Frequência respiratória (ipm). */
      fr?: VitalReading[];
      /** Pressão arterial sistólica (mmHg). */
      pas?: VitalReading[];
      /** Pressão arterial diastólica (mmHg). */
      pad?: VitalReading[];
      /** Balanço hídrico seriado (mL, positivo = retenção). */
      bh?: VitalReading[];
      /** Escala de Bristol seriada (1–7). */
      bristol?: VitalReading[];
    };

    /** Índices seriados adicionais criados pelo usuário (sinais vitais extras). */
    customSeries?: { id: string; label: string; unit?: string; readings: VitalReading[] }[];


    /** Detailed intake/output ledger; enables real-time balance calculation. */
    fluidBalance?: {
      intake?: FluidEntry[];
      output?: FluidEntry[];
      drains?: DrainEntry[];
      derivations?: DerivationEntry[];
    };
  };
}

export interface VitalReading {
  id: string;
  value?: number;
  at?: string; // ISO datetime
}

export interface StoolEntry {
  id: string;
  bristol?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  volume?: "ausente" | "+" | "++" | "+++";
  at?: string;   // ISO datetime
  notes?: string;
}



export interface FluidEntry {
  id: string;
  name: string;
  volumeMl: number;
  unit?: "mL" | "L";
  at?: string;
  type?: "hidratacao" | "medicacao" | "dieta" | "sangue" | "drenagem" | "diurese" | "outro";
}

export interface DrainEntry {
  id: string;
  name: string;
  site?: string;
  volumeMl: number;
  aspect?: string;
  at?: string;
}

/** Surgical/clinical derivations that produce output (e.g. DVE, gastrostomy, nephrostomy). */
export interface DerivationEntry {
  id: string;
  name: string;              // e.g. "DVE", "Gastrostomia", "Nefrostomia"
  site?: string;
  volumeMl: number;
  aspect?: string;
  at?: string;
}

// ============ Discharge readiness check (ICU → enfermaria) ============
export type DischargeBlockerId =
  | "dva"
  | "vent_invasive"
  | "gcs_drop"
  | "seizure"
  | "hemo_instability"
  | "resp_failure"
  | "airway_unprotected"
  | "metab_severe"
  | "active_bleeding"
  | "urgent_procedure"
  | "incompatible_device"
  | "no_ward_structure";

export interface DischargeDeviceRow {
  id: string;
  name: string;
  keep?: boolean;
  reason?: string;
  removalPlan?: string;
}

export interface DischargeCheck {
  startedAt?: string;
  updatedAt?: string;
  expectedTransfer?: string;
  stability?: { neuro?: boolean; hemo?: boolean; resp?: boolean; metab?: boolean };
  neuro?: { glasgow?: number; nihss?: number; pupils?: string; deficits?: string; notes?: string };
  diagnosis?: { dx?: string; procedures?: string; lastImaging?: string; complications?: string };
  meds?: {
    conciliation?: boolean; anticoag?: boolean; antiplt?: boolean;
    anticonv?: boolean; abx?: boolean; critical?: boolean; notes?: string;
  };
  nutrition?: { oral?: boolean; sne?: boolean; gtt?: boolean; fono?: boolean; aspRisk?: boolean };
  devices?: DischargeDeviceRow[];
  functionality?: { mobility?: boolean; physio?: boolean; fallRisk?: boolean; lpp?: boolean; needsHelp?: boolean };
  pendencies?: { lab?: string; imaging?: string; consults?: string; cultures?: string; owner?: string; deadline?: string };
  communication?: {
    medSummary?: boolean; medHandoff?: boolean; nurseHandoff?: boolean;
    family?: boolean; receivingTeam?: boolean; rxReviewed?: boolean;
  };
  blockers?: DischargeBlockerId[];
  finalization?: { fit?: "sim" | "nao"; notes?: string; responsible?: string; date?: string; time?: string };
}
const daysAgoISO = (d: number, hour = 10, minute = 0): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
};

// ---------------------------------------------------------------------------
// Geradores determinísticos para simulação de séries longas (>15 dias de UTI)
// ---------------------------------------------------------------------------

/** Série vital datada: começa em `from`, termina em `to`, com oscilação suave. */
const mkVitals = (
  id: string,
  days: number,
  from: number,
  to: number,
  amp = 0,
  decimals = 0,
): VitalReading[] => {
  const out: VitalReading[] = [];
  for (let i = 0; i < days; i++) {
    const d = days - 1 - i; // dias atrás
    const t = days === 1 ? 1 : i / (days - 1);
    const wiggle = amp * Math.sin(i * 1.7);
    const raw = from + (to - from) * t + wiggle;
    const f = 10 ** decimals;
    out.push({ id: `${id}_${i}`, value: Math.round(raw * f) / f, at: daysAgoISO(d, 8, 0) });
  }
  return out;
};

/** Linha de exame com histórico datado (mesma lógica de rampa). */
const mkExam = (
  label: string,
  unit: string | undefined,
  days: number,
  from: number,
  to: number,
  opts: { amp?: number; decimals?: number; code?: string; critical?: boolean } = {},
): ExamRow => {
  const { amp = 0, decimals = 1, code, critical } = opts;
  const readings = mkVitals(`e_${label}`, days, from, to, amp, decimals);
  const history = readings.map((r) => ({ takenAt: r.at as string, value: r.value as number }));
  const last = history[history.length - 1];
  return {
    label,
    code,
    unit,
    value: String(last.value).replace(".", ","),
    valueNum: last.value,
    takenAt: last.takenAt,
    history,
    trend: to > from ? "up" : to < from ? "down" : "flat",
    critical,
  };
};


export const patients: Patient[] = [
  {
    id: "p1",
    name: "Maria Aparecida Souza",
    bed: "UTI-07",
    age: 68,
    sex: "F",
    weight: 62,
    height: 158,
    birthDate: "1957-04-12",
    origin: { type: "Pronto-Socorro", name: "Hospital São José", city: "Itaperuna", state: "RJ" },
    admissionHosp: "02/06/2026",
    admissionICU: "05/06/2026",
    daysHosp: 13,
    daysICU: 10,
    attending: "Dr. R. Almeida",
    team: "UTI Geral A",
    severity: "critical",
    diagnoses: [
      { date: "2018", label: "HAS", kind: "neutral" },
      { date: "2020", label: "DM2", kind: "neutral" },
      { date: "2024", label: "AVC isquêmico", kind: "neuro" },
      { date: "08/06", label: "Pneumonia associada à VM", kind: "resp" },
      { date: "12/06", label: "Sepse de foco pulmonar", kind: "critical" },
    ],
    social: { tabagismo: "40 maços/ano", etilismo: "social", ocupacao: "Aposentada", dependencia: "Parcial" },
    allergies: ["Dipirona"],
    procedures: [
      { date: "05/06 14:20", label: "IOT", detail: "Tubo 7.5 — Dr. Lima", kind: "resp" },
      { date: "10/06 22:40", label: "PCR revertida", detail: "1 ciclo RCP", kind: "critical" },
      { date: "13/06 08:00", label: "CRRT iniciada", kind: "neuro" },
    ],
    devices: [
      { id: "d1", category: "airway", typeCode: "TOT", site: "Oral", size: "7.5", insertedAt: daysAgoISO(10, 14, 20), insertedBy: "Dr. Lima", notes: "Fixação 22 cm", recommendedMaxDays: 7 },
      { id: "d2", category: "venous_central", typeCode: "CVC_SUB", site: "Subclávia D", lumens: 3, insertedAt: daysAgoISO(10, 15, 10), insertedBy: "Dr. Lima", recommendedMaxDays: 7 },
      { id: "d3", category: "urinary", typeCode: "SVD", site: "Uretral", size: "3 vias", insertedAt: daysAgoISO(9, 9, 0), insertedBy: "Enf. Paula", recommendedMaxDays: 14 },
      { id: "d4", category: "arterial", typeCode: "PAI_RAD", site: "Radial E", insertedAt: daysAgoISO(8, 10, 0), recommendedMaxDays: 7 },
      { id: "d5", category: "enteral", typeCode: "SNE", site: "Nasal D", size: "12 Fr", insertedAt: daysAgoISO(7, 8, 0), recommendedMaxDays: 30 },
    ],
    medications: [
      {
        name: "Noradrenalina", dose: "0,28 mcg/kg/min", route: "EV", freq: "BIC",
        start: "10/06", kind: "critical", active: true,
        category: "vasoativa", therapeuticClass: "Vasopressor adrenérgico",
        mlPerHour: 13.0, concentrationMgPerMl: 0.08,
        pump: {
          mode: "continua", solvent: "SF 0,9%",
          drugAmountMg: 8, finalVolumeMl: 100, concentrationMcgPerMl: 80,
          targetDoseValue: 0.28, targetDoseUnit: "mcg/kg/min",
          rateMlPerHour: 13.0,
          bagVolumeMl: 100, bagStartedAt: daysAgoISO(0, -4, 0),
        },
      },
      {
        name: "Meropenem", dose: "1g", route: "EV", freq: "8/8h",
        start: "12/06", kind: "attention", active: true,
        category: "antimicrobiano", therapeuticClass: "Carbapenêmico",
        isAntibiotic: true,
        startISO: daysAgoISO(3, 8, 0),
        plannedEndISO: daysAgoISO(-11, 8, 0),
        plannedDoses: 42, dosesGiven: 9,
        pump: {
          mode: "intermitente", solvent: "SF 0,9%",
          drugAmountMg: 1000, finalVolumeMl: 100, concentrationMcgPerMl: 10000,
          infusionDurationMin: 180, rateMlPerHour: 33,
        },
      },
      {
        name: "Fentanil", dose: "50 mcg/h", route: "EV", freq: "BIC",
        start: "05/06", kind: "neuro", active: true,
        category: "analgesico", therapeuticClass: "Opioide",
        mlPerHour: 1.0, concentrationMgPerMl: 0.05,
        pump: {
          mode: "continua", solvent: "SF 0,9%",
          drugAmountMg: 2.5, finalVolumeMl: 50, concentrationMcgPerMl: 50,
          targetDoseValue: 50, targetDoseUnit: "mcg/min",
          rateMlPerHour: 1.0,
          bagVolumeMl: 50, bagStartedAt: daysAgoISO(0, -10, 0),
        },
      },
      {
        name: "Midazolam", dose: "4 mg/h", route: "EV", freq: "BIC",
        start: "05/06", kind: "neuro", active: true,
        category: "sedativo", therapeuticClass: "Benzodiazepínico",
        mlPerHour: 4.0, concentrationMgPerMl: 1,
        pump: {
          mode: "continua", solvent: "SF 0,9%",
          drugAmountMg: 100, finalVolumeMl: 100, concentrationMcgPerMl: 1000,
          targetDoseValue: 4, targetDoseUnit: "mg/h",
          rateMlPerHour: 4.0,
          bagVolumeMl: 100, bagStartedAt: daysAgoISO(0, -6, 0),
        },
      },
      { name: "Enoxaparina", dose: "40 mg", route: "SC", freq: "1x/d", start: "06/06", kind: "stable", active: true },
    ],
    exams: [
      { label: "Hb", value: "9,8", unit: "g/dL", trend: "down" },
      { label: "Leuco", value: "18.000", trend: "up", critical: true },
      { label: "PCR", value: "22", unit: "mg/dL", trend: "up", critical: true },
      { label: "Lactato", value: "3,1", unit: "mmol/L", trend: "down" },
      { label: "Creat", value: "2,4", unit: "mg/dL", trend: "up" },
      { label: "pH", value: "7,32", trend: "up" },
    ],
    conducts: [
      { team: "Médica", text: "Ajustar antibiótico após cultura", done: false },
      { team: "Médica", text: "Solicitar TC tórax", done: true },
      { team: "Médica", text: "Iniciar desmame ventilatório", done: false },
      { team: "Enfermagem", text: "Troca de curativo CVC", done: true },
      { team: "Enfermagem", text: "Controle glicêmico 4/4h", done: true },
      { team: "Fisioterapia", text: "Mobilização passiva", done: false },
      { team: "Nutrição", text: "Ajuste calórico para 25 kcal/kg", done: true },
      { team: "Fono", text: "Avaliação de deglutição pós-extubação", done: false },
    ],
    goals: [
      { text: "PAM > 65", met: true },
      { text: "SatO2 > 92%", met: true },
      { text: "Diurese > 0,5 ml/kg/h", met: true },
      { text: "Lactato em queda", met: true },
    ],
    infections: [
      {
        id: "inf1",
        site: "PAV",
        status: "confirmado",
        unstable: true,
        startedAt: daysAgoISO(7, 8, 0),
        relatedDeviceIds: ["d1"],
        cultureIds: ["c1"],
        antimicrobials: ["Meropenem"],
        notes: "Aspirado traqueal positivo. Curso 14 dias.",
      },
      {
        id: "inf2",
        site: "IRC",
        status: "suspeito",
        startedAt: daysAgoISO(2, 6, 0),
        relatedDeviceIds: ["d2"],
        cultureIds: ["c2"],
        antimicrobials: ["Meropenem"],
        notes: "CVC subclávia D · 10 dias. Hemocultura coletada.",
      },
      {
        id: "inf3",
        site: "ITU",
        status: "resolvido",
        startedAt: daysAgoISO(12, 8, 0),
        resolvedAt: daysAgoISO(5, 8, 0),
        relatedDeviceIds: ["d3"],
        notes: "Tratada com Ceftriaxona — completou curso.",
      },
    ],
    cultures: [
      {
        id: "c1", source: "Aspirado traqueal", collectedAt: daysAgoISO(6, 7, 30),
        organism: "Pseudomonas aeruginosa", resistanceProfile: "MDR",
        sensitivities: ["Meropenem", "Colistina"], resistances: ["Ceftazidima", "Cipro"],
        linkedFocusId: "inf1",
      },
      {
        id: "c2", source: "Hemocultura periférica", collectedAt: daysAgoISO(1, 6, 0),
        resistanceProfile: "pendente", linkedFocusId: "inf2",
      },
      {
        id: "c3", source: "Hemocultura CVC", collectedAt: daysAgoISO(1, 6, 5),
        resistanceProfile: "pendente", linkedFocusId: "inf2",
      },
    ],
    infectionTimeline: [
      { at: daysAgoISO(8, 4, 0), kind: "febre", label: "Pico febril 38,9°C", focusId: "inf1" },
      { at: daysAgoISO(7, 7, 30), kind: "cultura_coletada", label: "Aspirado traqueal coletado", focusId: "inf1" },
      { at: daysAgoISO(7, 8, 0), kind: "atb_inicio", label: "Início de Meropenem 1g 8/8h", focusId: "inf1" },
      { at: daysAgoISO(6, 9, 0), kind: "cultura_positiva", label: "Pseudomonas MDR sensível a Mero", focusId: "inf1" },
      { at: daysAgoISO(2, 5, 30), kind: "febre", label: "Re-pico febril 38,4°C", focusId: "inf2" },
      { at: daysAgoISO(1, 6, 0), kind: "cultura_coletada", label: "Hemoculturas pareadas (perif+CVC)", focusId: "inf2" },
      { at: daysAgoISO(0, 6, 0), kind: "pcr", label: "PCR 22 mg/dL ↑", focusId: "inf2" },
    ],
    state: {
      glasgow: 10, rass: -2, pam: 72, dva: "Nora 0,28",
      vent: "VM PSV", fio2: 40, diurese: 0.9, temp: 38.4,
      dieta: "Enteral plena", infection: "Sepse pulmonar",
    },
    lpp: [
      {
        id: "lpp1", identifiedAt: daysAgoISO(6, 9, 0), professional: "Enf. Paula",
        site: "sacro", siteLabel: "Sacro", view: "posterior", side: "central",
        count: 1, stage: "2",
        notes: "Hiperemia + bolha — curativo hidrocoloide.",
        evolutions: [
          { at: daysAgoISO(2, 9, 0), stage: "2", professional: "Enf. Paula", notes: "Sem piora." },
        ],
      },
      {
        id: "lpp2", identifiedAt: daysAgoISO(3, 8, 0), professional: "Enf. Paula",
        site: "calcaneo_d", siteLabel: "Calcâneo direito", view: "posterior", side: "D",
        count: 1, stage: "1",
      },
    ],
  },
  {
    id: "p2",
    name: "João Carlos Pereira",
    bed: "UTI-03",
    age: 54,
    sex: "M",
    weight: 84,
    height: 178,
    birthDate: "1971-09-20",
    origin: { type: "Hospital", name: "UPA Muriaé", city: "Muriaé", state: "MG" },
    admissionHosp: "10/06/2026",
    admissionICU: "11/06/2026",
    daysHosp: 5,
    daysICU: 4,
    attending: "Dra. C. Nunes",
    team: "UTI Neuro",
    severity: "attention",
    diagnoses: [
      { date: "2015", label: "Tabagismo", kind: "neutral" },
      { date: "10/06", label: "HSA Fisher IV", kind: "neuro" },
      { date: "11/06", label: "DVE", kind: "neuro" },
    ],
    social: { tabagismo: "20 maços/ano", ocupacao: "Motorista", dependencia: "Independente" },
    allergies: ["—"],
    procedures: [
      { date: "10/06 23:10", label: "IOT", detail: "Tubo 8.0", kind: "resp" },
      { date: "11/06 02:30", label: "DVE", detail: "Neurocirurgia", kind: "neuro" },
    ],
    devices: [
      { id: "d6", category: "airway", typeCode: "TOT", site: "Oral", size: "8.0", insertedAt: daysAgoISO(4, 23, 10), recommendedMaxDays: 7 },
      { id: "d7", category: "neuro", typeCode: "DVE", site: "Frontal D", side: "D", insertedAt: daysAgoISO(4, 2, 30), notes: "Altura 15 cmH₂O", recommendedMaxDays: 7 },
      { id: "d8", category: "neuro", typeCode: "PICmon", site: "Parenquimatoso", insertedAt: daysAgoISO(4, 3, 0), recommendedMaxDays: 7 },
      { id: "d9", category: "venous_central", typeCode: "CVC_JUG", site: "Jugular interna D", lumens: 3, insertedAt: daysAgoISO(4, 4, 0), recommendedMaxDays: 7 },
      { id: "d10", category: "arterial", typeCode: "PAI_RAD", site: "Radial D", insertedAt: daysAgoISO(4, 4, 30), recommendedMaxDays: 7 },
      { id: "d11", category: "urinary", typeCode: "SVD", site: "Uretral", size: "2 vias", insertedAt: daysAgoISO(4, 5, 0), recommendedMaxDays: 14 },
    ],
    medications: [
      { name: "Propofol", dose: "2 mg/kg/h", route: "EV", freq: "BIC", start: "10/06", kind: "neuro", active: true },
      { name: "Nimodipino", dose: "60 mg", route: "VO", freq: "4/4h", start: "11/06", kind: "neuro", active: true },
      {
        name: "Cefazolina", dose: "1g", route: "EV", freq: "8/8h",
        start: "11/06", kind: "attention", active: true,
        isAntibiotic: true,
        startISO: daysAgoISO(4, 6, 0),
        plannedEndISO: daysAgoISO(-2, 6, 0), // 7-day course
        plannedDoses: 21, dosesGiven: 15,
      },
    ],
    exams: [
      { label: "Hb", value: "11,4", unit: "g/dL", trend: "flat" },
      { label: "Na", value: "138", unit: "mEq/L", trend: "flat" },
      { label: "PIC", value: "14", unit: "mmHg", trend: "flat" },
      { label: "Lactato", value: "1,4", trend: "down" },
    ],
    conducts: [
      { team: "Médica", text: "Manter PAM 90-100", done: true },
      { team: "Médica", text: "Doppler transcraniano amanhã", done: false },
      { team: "Enfermagem", text: "Cabeceira 30°", done: true },
      { team: "Fisioterapia", text: "Higiene brônquica", done: true },
    ],
    goals: [
      { text: "PAM 90-100", met: true },
      { text: "PIC < 20", met: true },
      { text: "Na 140-145", met: false },
    ],
    state: {
      glasgow: 7, rass: -4, pam: 95, dva: null,
      vent: "VM VCV", fio2: 35, diurese: 1.2, temp: 36.9, dieta: "Jejum",
    },
  },
  {
    id: "p3",
    name: "Antônio Ribeiro",
    bed: "UTI-12",
    age: 72,
    sex: "M",
    weight: 70,
    height: 172,
    birthDate: "1953-01-30",
    origin: { type: "Enfermaria", name: "Enfermaria Clínica Médica", unit: "Ala B" },
    admissionHosp: "28/05/2026",
    admissionICU: "30/05/2026",
    daysHosp: 18,
    daysICU: 16,
    attending: "Dr. F. Tavares",
    team: "UTI Geral B",
    severity: "stable",
    diagnoses: [
      { date: "2010", label: "DPOC", kind: "resp" },
      { date: "28/05", label: "Exacerbação DPOC", kind: "resp" },
      { date: "01/06", label: "PNM comunitária", kind: "resp" },
    ],
    social: { tabagismo: "ex-tabagista", ocupacao: "Aposentado", dependencia: "Independente" },
    allergies: ["—"],
    procedures: [
      { date: "30/05 10:00", label: "IOT", kind: "resp" },
      { date: "08/06 09:00", label: "Extubação", kind: "resp" },
      { date: "08/06 09:30", label: "VNI", kind: "resp" },
    ],
    devices: [
      { id: "d12", category: "urinary", typeCode: "SVD", site: "Uretral", size: "2 vias", insertedAt: daysAgoISO(16, 11, 0), recommendedMaxDays: 14 },
    ],
    medications: [
      {
        name: "Ceftriaxona", dose: "2g", route: "EV", freq: "1x/d",
        start: "01/06", end: "08/06", kind: "attention", active: false,
        isAntibiotic: true,
        startISO: daysAgoISO(14, 8, 0),
        plannedEndISO: daysAgoISO(7, 8, 0),
        plannedDoses: 7, dosesGiven: 7,
      },
      { name: "Salbutamol", dose: "—", route: "INAL", freq: "6/6h", start: "30/05", kind: "resp", active: true },
    ],
    exams: [
      { label: "Hb", value: "12,1", unit: "g/dL", trend: "up" },
      { label: "Leuco", value: "8.200", trend: "down" },
      { label: "PCR", value: "2,1", trend: "down" },
      { label: "pH", value: "7,41", trend: "flat" },
    ],
    conducts: [
      { team: "Médica", text: "Programar alta UTI", done: false },
      { team: "Fisioterapia", text: "Treino muscular respiratório", done: true },
      { team: "Nutrição", text: "Dieta VO progressiva", done: true },
    ],
    goals: [
      { text: "SatO2 > 92%", met: true },
      { text: "Sem suporte ventilatório", met: true },
    ],
    state: {
      glasgow: 15, rass: 0, pam: 88, dva: null,
      vent: "Ar ambiente", fio2: 21, diurese: 1.4, temp: 36.5, dieta: "VO leve",
    },
  },
  // =========================================================================
  // Simulações de longa permanência (>15 dias) com parâmetros seriados
  // =========================================================================
  {
    id: "p4",
    name: "Sebastião Marques Lima",
    bed: "UTI-05",
    age: 63,
    sex: "M",
    weight: 78,
    height: 170,
    birthDate: "1962-11-03",
    origin: { type: "Centro Cirúrgico", name: "Hospital Unimed", unit: "CC 2" },
    admissionHosp: "08/08/2026",
    admissionICU: "09/08/2026",
    daysHosp: 23,
    daysICU: 22,
    attending: "Dr. R. Almeida",
    team: "UTI Geral A",
    severity: "critical",
    diagnoses: [
      { date: "2012", label: "HAS", kind: "neutral" },
      { date: "2016", label: "DM2 insulino-requerente", kind: "neutral" },
      { date: "09/08", label: "Peritonite fecal por perfuração de sigmoide", kind: "critical" },
      { date: "09/08", label: "Choque séptico de foco abdominal", kind: "critical" },
      { date: "12/08", label: "Lesão renal aguda KDIGO 3 (em CRRT)", kind: "neutral" },
      { date: "18/08", label: "Polineuropatia do doente crítico", kind: "neuro" },
      { date: "24/08", label: "Pneumonia associada à ventilação", kind: "resp" },
    ],
    social: { tabagismo: "30 maços/ano", etilismo: "ex-etilista", ocupacao: "Comerciante", dependencia: "Independente prévio" },
    allergies: ["Sulfa"],
    legalRepresentative: { name: "Marta Lima", relation: "Esposa", phone: "(22) 99999-0001" },
    pastMedications: [
      { id: "pm4a", name: "Losartana", dose: "50 mg", route: "VO", freq: "12/12h", status: "suspenso" },
      { id: "pm4b", name: "Metformina", dose: "850 mg", route: "VO", freq: "12/12h", status: "suspenso" },
    ],
    procedures: [
      { date: "09/08 03:10", label: "Laparotomia exploradora com colostomia", detail: "Cirurgia Geral", kind: "critical" },
      { date: "09/08 06:40", label: "IOT", detail: "Tubo 8.0", kind: "resp" },
      { date: "12/08 14:00", label: "Início de hemodiálise contínua (CRRT)", kind: "neutral" },
      { date: "16/08 10:30", label: "Relaparotomia programada", detail: "Lavagem de cavidade", kind: "critical" },
      { date: "22/08 09:00", label: "Traqueostomia percutânea", detail: "Cânula 8.0 plástica", kind: "resp" },
      { date: "27/08 11:00", label: "Interrupção diária da sedação", kind: "neuro" },
    ],
    devices: [
      { id: "d4a", category: "airway", typeCode: "TQT", site: "Traqueal", size: "8.0", cannulaType: "plástica", insertedAt: daysAgoISO(9, 9, 0), recommendedMaxDays: 30 },
      { id: "d4b", category: "venous_central", typeCode: "CVC_JUG", site: "Jugular interna D", lumens: 3, insertedAt: daysAgoISO(6, 10, 0), recommendedMaxDays: 7 },
      { id: "d4c", category: "venous_central", typeCode: "HD_CAT", site: "Femoral E", insertedAt: daysAgoISO(19, 14, 0), recommendedMaxDays: 14 },
      { id: "d4d", category: "arterial", typeCode: "PAI_RAD", site: "Radial E", insertedAt: daysAgoISO(4, 8, 0), recommendedMaxDays: 7 },
      { id: "d4e", category: "urinary", typeCode: "SVD", site: "Uretral", size: "3 vias", insertedAt: daysAgoISO(22, 7, 0), recommendedMaxDays: 14 },
      { id: "d4f", category: "enteral", typeCode: "SNE", site: "Nasal E", size: "12 Fr", insertedAt: daysAgoISO(20, 8, 0), recommendedMaxDays: 30 },
    ],
    medications: [
      {
        name: "Noradrenalina", dose: "0,15 mcg/kg/min", route: "EV", freq: "BIC",
        start: "09/08", kind: "critical", active: true,
        category: "vasoativa", therapeuticClass: "Vasopressor adrenérgico",
        mlPerHour: 8.8, concentrationMgPerMl: 0.08,
        pump: {
          mode: "continua", solvent: "SF 0,9%",
          drugAmountMg: 8, finalVolumeMl: 100, concentrationMcgPerMl: 80,
          targetDoseValue: 0.15, targetDoseUnit: "mcg/kg/min",
          rateMlPerHour: 8.8, bagVolumeMl: 100, bagStartedAt: daysAgoISO(0, 2, 0),
        },
      },
      {
        name: "Polimixina B", dose: "1.000.000 UI", route: "EV", freq: "12/12h",
        start: "24/08", kind: "attention", active: true,
        category: "antimicrobiano", therapeuticClass: "Polimixina",
        isAntibiotic: true, startISO: daysAgoISO(7, 8, 0), plannedEndISO: daysAgoISO(-7, 8, 0),
        plannedDoses: 28, dosesGiven: 14,
      },
      {
        name: "Meropenem", dose: "2g", route: "EV", freq: "8/8h",
        start: "16/08", end: "26/08", kind: "attention", active: false,
        category: "antimicrobiano", therapeuticClass: "Carbapenêmico",
        isAntibiotic: true, startISO: daysAgoISO(15, 8, 0), plannedEndISO: daysAgoISO(5, 8, 0),
        plannedDoses: 33, dosesGiven: 33,
      },
      { name: "Insulina regular", dose: "2 UI/h", route: "EV", freq: "BIC", start: "10/08", kind: "attention", active: true, category: "outro", therapeuticClass: "Insulina" },
      { name: "Fentanil", dose: "30 mcg/h", route: "EV", freq: "BIC", start: "09/08", kind: "neuro", active: true, category: "analgesico" },
      { name: "Enoxaparina", dose: "40 mg", route: "SC", freq: "1x/d", start: "10/08", kind: "stable", active: true },
    ],
    exams: [
      mkExam("Hemoglobina", "g/dL", 20, 12.4, 8.6, { amp: 0.2 }),
      mkExam("Leucócitos", "/mm³", 20, 22000, 13400, { amp: 900, decimals: 0, critical: true }),
      mkExam("Plaquetas", "/mm³", 20, 96000, 214000, { amp: 6000, decimals: 0 }),
      mkExam("PCR", "mg/L", 20, 312, 88, { amp: 15 }),
      mkExam("Procalcitonina", "ng/mL", 20, 24.6, 1.9, { amp: 0.8, decimals: 2 }),
      mkExam("Creatinina", "mg/dL", 20, 1.2, 3.4, { amp: 0.15, decimals: 2 }),
      mkExam("Ureia", "mg/dL", 20, 68, 142, { amp: 6, decimals: 0 }),
      mkExam("Sódio", "mEq/L", 20, 149, 138, { amp: 1.5, decimals: 0 }),
      mkExam("Potássio", "mEq/L", 20, 5.4, 4.1, { amp: 0.2, decimals: 1 }),
      mkExam("Cloro", "mEq/L", 20, 112, 104, { amp: 1.5, decimals: 0 }),
      mkExam("Albumina", "g/dL", 20, 2.9, 2.2, { amp: 0.1, decimals: 1 }),
      mkExam("Bilirrubina total", "mg/dL", 20, 1.1, 3.6, { amp: 0.2, decimals: 1 }),
      mkExam("Lactato", "mmol/L", 20, 6.2, 2.1, { amp: 0.3, decimals: 1 }),
      mkExam("INR", "", 20, 1.8, 1.3, { amp: 0.05, decimals: 2 }),
      mkExam("pH", "", 20, 7.18, 7.33, { amp: 0.02, decimals: 2, code: "PH" }),
      mkExam("PaCO₂", "mmHg", 20, 32, 46, { amp: 1.5, decimals: 0, code: "PACO2" }),
      mkExam("PaO₂", "mmHg", 20, 68, 88, { amp: 4, decimals: 0, code: "PAO2" }),
      mkExam("HCO₃⁻", "mEq/L", 20, 13, 23, { amp: 0.8, decimals: 1, code: "HCO3" }),
      mkExam("Base excess (BE)", "mEq/L", 20, -12, -2, { amp: 0.6, decimals: 1, code: "BE" }),
      mkExam("SatO₂ arterial", "%", 20, 90, 96, { amp: 1, decimals: 0, code: "SATO2A" }),
      mkExam("Lactato arterial", "mmol/L", 20, 6.0, 2.0, { amp: 0.3, decimals: 1, code: "GLAC" }),
      mkExam("FiO₂ (gasometria)", "%", 20, 80, 40, { amp: 3, decimals: 0, code: "GFIO2" }),
    ],
    imaging: [
      { id: "i4a", modality: "TC", region: "Abdome total", performedAt: daysAgoISO(15, 9, 0), summary: "Coleção em goteira parietocólica esquerda, drenada em relaparotomia.", conclusion: "alterado", status: "concluido" },
      { id: "i4b", modality: "RX", region: "Tórax", performedAt: daysAgoISO(6, 7, 0), summary: "Infiltrado alveolar em base direita, menor que exame prévio.", conclusion: "alterado", status: "concluido" },
      { id: "i4c", modality: "USG", region: "Abdome", performedAt: daysAgoISO(2, 10, 0), summary: "Sem coleções residuais. Alças de calibre normal.", conclusion: "normal", status: "concluido" },
    ],
    eeg: [
      { id: "eeg4", performedAt: daysAgoISO(8, 11, 0), report: "Lentificação difusa moderada, compatível com encefalopatia metabólica/séptica. Sem atividade epileptiforme.", reportedBy: "Dra. L. Prado" },
    ],
    hemotransfusions: [
      { id: "ht4a", date: daysAgoISO(18, 15, 0), component: "Concentrado de hemácias", volume: "2 bolsas · 500 mL", note: "Hb 6,9 g/dL com instabilidade." },
      { id: "ht4b", date: daysAgoISO(11, 13, 0), component: "Plasma fresco congelado", volume: "3 bolsas", note: "INR 2,1 antes de relaparotomia." },
      { id: "ht4c", date: daysAgoISO(4, 16, 0), component: "Concentrado de hemácias", volume: "1 bolsa · 250 mL", note: "Hb 7,2 g/dL." },
    ],
    infections: [
      { id: "inf4a", site: "PERITONITE", status: "confirmado", startedAt: daysAgoISO(22, 3, 0), resolvedAt: daysAgoISO(8, 8, 0), cultureIds: ["c4a"], antimicrobials: ["Meropenem"], notes: "Peritonite fecal — controle de foco cirúrgico." },
      { id: "inf4b", site: "PAV", status: "confirmado", unstable: true, startedAt: daysAgoISO(8, 5, 0), relatedDeviceIds: ["d4a"], cultureIds: ["c4b"], antimicrobials: ["Polimixina B"], notes: "Acinetobacter baumannii XDR." },
    ],
    cultures: [
      { id: "c4a", source: "Líquido peritoneal", collectedAt: daysAgoISO(22, 4, 0), organism: "Escherichia coli", resistanceProfile: "MDR", sensitivities: ["Meropenem", "Amicacina"], resistances: ["Ceftriaxona"], linkedFocusId: "inf4a" },
      { id: "c4b", source: "Aspirado traqueal", collectedAt: daysAgoISO(8, 6, 0), organism: "Acinetobacter baumannii", resistanceProfile: "XDR", sensitivities: ["Polimixina B"], resistances: ["Meropenem", "Ampicilina-sulbactam"], linkedFocusId: "inf4b" },
      { id: "c4c", source: "Hemocultura periférica", collectedAt: daysAgoISO(3, 6, 0), resistanceProfile: "pendente", linkedFocusId: "inf4b" },
    ],
    infectionTimeline: [
      { at: daysAgoISO(22, 3, 0), kind: "atb_inicio", label: "Início de esquema empírico amplo", focusId: "inf4a" },
      { at: daysAgoISO(20, 9, 0), kind: "cultura_positiva", label: "E. coli ESBL em líquido peritoneal", focusId: "inf4a" },
      { at: daysAgoISO(9, 4, 0), kind: "febre", label: "Pico febril 38,7 °C", focusId: "inf4b" },
      { at: daysAgoISO(8, 6, 0), kind: "cultura_coletada", label: "Aspirado traqueal coletado", focusId: "inf4b" },
      { at: daysAgoISO(7, 8, 0), kind: "atb_inicio", label: "Início de Polimixina B", focusId: "inf4b" },
    ],
    lpp: [
      {
        id: "lpp4", identifiedAt: daysAgoISO(14, 9, 0), professional: "Enf. Rita",
        site: "sacro", siteLabel: "Sacro", view: "posterior", side: "central", count: 1, stage: "3",
        notes: "Curativo com espuma de prata, troca em dias alternados.",
        evolutions: [
          { at: daysAgoISO(7, 9, 0), stage: "3", professional: "Enf. Rita", notes: "Tecido de granulação em bordas." },
          { at: daysAgoISO(1, 9, 0), stage: "2", professional: "Enf. Rita", notes: "Redução de profundidade." },
        ],
      },
    ],
    conducts: [
      { team: "Médica", text: "Infectologia", done: false, system: "infec", subItems: [
        { text: "Manter Polimixina B até D14 (07 doses restantes)", done: false },
        { text: "Reavaliar hemoculturas de controle", done: false, color: "orange" },
      ] },
      { team: "Médica", text: "Ventilação", done: false, system: "resp", subItems: [
        { text: "Desmame em PSV por traqueostomia, tolerando 8 h/dia", done: true },
        { text: "Meta: nebulização e válvula de fala em 48 h", done: false },
      ] },
      { team: "Médica", text: "Renal", done: false, system: "renal", subItems: [
        { text: "Transição de CRRT para hemodiálise intermitente", done: true },
        { text: "Avaliar retirada de cateter de diálise femoral", done: false, color: "red" },
      ] },
      { team: "Enfermagem", text: "Pele", done: true, system: "skin", subItems: [
        { text: "Mudança de decúbito 2/2 h", done: true },
        { text: "Curativo de LPP sacral em dias alternados", done: true },
      ] },
      { team: "Fisioterapia", text: "Mobilização", done: false, system: "other", subItems: [
        { text: "Sedestação à beira do leito 2x/dia", done: true },
        { text: "Ortostatismo assistido", done: false },
      ] },
      { team: "Nutrição", text: "Dieta", done: true, system: "dieta", subItems: [
        { text: "Enteral 25 kcal/kg/dia, 1,5 g proteína/kg", done: true },
      ] },
    ],
    goals: [
      { text: "Retirar noradrenalina em 72 h", met: false },
      { text: "Lactato < 2 mmol/L", met: true },
      { text: "Balanço hídrico negativo diário", met: true },
      { text: "Sem novos focos infecciosos", met: false },
    ],
    state: {
      glasgow: 11, rass: -1, pam: 74, dva: "Nora 0,15",
      vent: "PSV por traqueostomia", fio2: 35, diurese: 0.6, temp: 37.4,
      dieta: "Enteral plena", infection: "PAV por Acinetobacter XDR",
      fr: 22, spo2: 95, glicemia: 148, pas: 116, pad: 58, balancoHidrico: -420,
      notes: "22º dia de UTI. Em desmame ventilatório lento e transição dialítica.",
      vitalSeries: {
        temp: mkVitals("v4t", 20, 38.9, 37.3, 0.3, 1),
        spo2: mkVitals("v4s", 20, 89, 96, 1, 0),
        fc: mkVitals("v4f", 20, 128, 92, 5, 0),
        pam: mkVitals("v4p", 20, 58, 76, 3, 0),
        pas: mkVitals("v4pas", 20, 88, 118, 5, 0),
        pad: mkVitals("v4pad", 20, 44, 60, 3, 0),
        fr: mkVitals("v4fr", 20, 32, 21, 2, 0),
        glicemia: mkVitals("v4g", 20, 268, 142, 18, 0),
        bh: mkVitals("v4bh", 20, 2400, -520, 320, 0),
        bristol: mkVitals("v4b", 20, 6, 4, 1, 0),
      },
      customSeries: [
        { id: "cs4a", label: "PEEP", unit: "cmH₂O", readings: mkVitals("cs4a", 20, 14, 6, 1, 0) },
        { id: "cs4b", label: "Diurese", unit: "mL", readings: mkVitals("cs4b", 20, 180, 1120, 90, 0) },
        { id: "cs4c", label: "Dor (EVA)", unit: "0–10", readings: mkVitals("cs4c", 20, 6, 2, 1, 0) },
        { id: "cs4d", label: "RASS", unit: "-5 a +4", readings: mkVitals("cs4d", 20, -4, -1, 0, 0) },
      ],
      fluidBalance: {
        intake: [
          { id: "fi4a", name: "Dieta enteral", volumeMl: 1200, at: daysAgoISO(0, 6, 0), type: "dieta" },
          { id: "fi4b", name: "Soluções e medicações", volumeMl: 640, at: daysAgoISO(0, 6, 0), type: "medicacao" },
        ],
        output: [
          { id: "fo4a", name: "Diurese", volumeMl: 1080, at: daysAgoISO(0, 6, 0), type: "diurese" },
          { id: "fo4b", name: "Ultrafiltração dialítica", volumeMl: 900, at: daysAgoISO(0, 6, 0), type: "outro" },
        ],
        drains: [
          { id: "fd4a", name: "Dreno tubulolaminar", site: "Flanco esquerdo", volumeMl: 120, aspect: "Serossanguinolento", at: daysAgoISO(0, 6, 0) },
        ],
        derivations: [
          { id: "fv4a", name: "Colostomia", site: "Fossa ilíaca esquerda", volumeMl: 380, aspect: "Fecal pastoso", at: daysAgoISO(0, 6, 0) },
        ],
      },
    },
  },
  {
    id: "p5",
    name: "Cleide Fernandes Rocha",
    bed: "UTI-09",
    age: 47,
    sex: "F",
    weight: 92,
    height: 162,
    birthDate: "1978-06-22",
    origin: { type: "UPA", name: "UPA Centro", city: "Itaperuna", state: "RJ" },
    admissionHosp: "12/08/2026",
    admissionICU: "12/08/2026",
    daysHosp: 19,
    daysICU: 19,
    attending: "Dra. C. Nunes",
    team: "UTI Respiratória",
    severity: "attention",
    diagnoses: [
      { date: "2019", label: "Obesidade grau II", kind: "neutral" },
      { date: "2021", label: "Asma persistente moderada", kind: "resp" },
      { date: "12/08", label: "Influenza A com pneumonia viral", kind: "resp" },
      { date: "13/08", label: "SDRA grave (P/F 92)", kind: "critical" },
      { date: "20/08", label: "Pneumotórax à direita pós-barotrauma", kind: "resp" },
      { date: "26/08", label: "Fraqueza adquirida na UTI", kind: "neuro" },
    ],
    social: { tabagismo: "não", etilismo: "não", ocupacao: "Professora", dependencia: "Independente" },
    allergies: ["—"],
    legalRepresentative: { name: "Bruno Rocha", relation: "Filho", phone: "(22) 98888-0002" },
    procedures: [
      { date: "12/08 21:00", label: "IOT", detail: "Tubo 7.5", kind: "resp" },
      { date: "13/08 04:00", label: "Primeira sessão de posição prona", detail: "16 h", kind: "resp" },
      { date: "13/08 a 19/08", label: "Cinco ciclos de prona", kind: "resp" },
      { date: "20/08 08:20", label: "Drenagem torácica à direita", kind: "critical" },
      { date: "28/08 10:00", label: "Teste de respiração espontânea (falha)", kind: "resp" },
      { date: "30/08 10:00", label: "Teste de respiração espontânea (sucesso parcial)", kind: "resp" },
    ],
    devices: [
      { id: "d5a", category: "airway", typeCode: "TOT", site: "Oral", size: "7.5", insertedAt: daysAgoISO(19, 21, 0), recommendedMaxDays: 7, notes: "Fixação 21 cm. Indicação de traqueostomia em discussão." },
      { id: "d5b", category: "venous_central", typeCode: "CVC_SUB", site: "Subclávia D", lumens: 3, insertedAt: daysAgoISO(5, 9, 0), recommendedMaxDays: 7 },
      { id: "d5c", category: "arterial", typeCode: "PAI_RAD", site: "Radial D", insertedAt: daysAgoISO(5, 9, 30), recommendedMaxDays: 7 },
      { id: "d5d", category: "urinary", typeCode: "SVD", site: "Uretral", size: "2 vias", insertedAt: daysAgoISO(19, 22, 0), recommendedMaxDays: 14 },
      { id: "d5e", category: "enteral", typeCode: "SNE", site: "Nasal D", size: "12 Fr", insertedAt: daysAgoISO(18, 8, 0), recommendedMaxDays: 30 },
      { id: "d5f", category: "drain", typeCode: "DRT", site: "Hemitórax direito", side: "D", insertedAt: daysAgoISO(11, 8, 20), recommendedMaxDays: 10, notes: "Selo d'água, sem escape aéreo há 48 h." },
    ],
    medications: [
      { name: "Oseltamivir", dose: "75 mg", route: "SNE", freq: "12/12h", start: "12/08", end: "22/08", kind: "attention", active: false, isAntibiotic: false, category: "antimicrobiano" },
      {
        name: "Piperacilina-tazobactam", dose: "4,5 g", route: "EV", freq: "6/6h",
        start: "21/08", kind: "attention", active: true,
        category: "antimicrobiano", therapeuticClass: "Betalactâmico com inibidor",
        isAntibiotic: true, startISO: daysAgoISO(10, 8, 0), plannedEndISO: daysAgoISO(-3, 8, 0),
        plannedDoses: 52, dosesGiven: 40,
      },
      { name: "Cisatracúrio", dose: "0,12 mg/kg/h", route: "EV", freq: "BIC", start: "13/08", end: "19/08", kind: "neuro", active: false, category: "outro", therapeuticClass: "Bloqueador neuromuscular" },
      { name: "Dexmedetomidina", dose: "0,6 mcg/kg/h", route: "EV", freq: "BIC", start: "24/08", kind: "neuro", active: true, category: "sedativo", mlPerHour: 13.8 },
      { name: "Metilprednisolona", dose: "40 mg", route: "EV", freq: "12/12h", start: "13/08", kind: "attention", active: true, category: "outro", therapeuticClass: "Corticosteroide" },
      { name: "Enoxaparina", dose: "60 mg", route: "SC", freq: "1x/d", start: "13/08", kind: "stable", active: true },
    ],
    exams: [
      mkExam("Hemoglobina", "g/dL", 18, 13.6, 10.4, { amp: 0.2 }),
      mkExam("Leucócitos", "/mm³", 18, 4200, 11800, { amp: 600, decimals: 0 }),
      mkExam("Plaquetas", "/mm³", 18, 128000, 268000, { amp: 8000, decimals: 0 }),
      mkExam("PCR", "mg/L", 18, 248, 46, { amp: 12 }),
      mkExam("D-dímero", "µg/mL", 18, 8.4, 2.2, { amp: 0.4, decimals: 1 }),
      mkExam("Creatinina", "mg/dL", 18, 0.9, 1.1, { amp: 0.08, decimals: 2 }),
      mkExam("Sódio", "mEq/L", 18, 134, 140, { amp: 1, decimals: 0 }),
      mkExam("Potássio", "mEq/L", 18, 3.4, 4.2, { amp: 0.15, decimals: 1 }),
      mkExam("Cloro", "mEq/L", 18, 98, 103, { amp: 1, decimals: 0 }),
      mkExam("Albumina", "g/dL", 18, 3.2, 2.6, { amp: 0.1, decimals: 1 }),
      mkExam("TGO (AST)", "U/L", 18, 118, 42, { amp: 8, decimals: 0 }),
      mkExam("TGP (ALT)", "U/L", 18, 96, 38, { amp: 6, decimals: 0 }),
      mkExam("Lactato", "mmol/L", 18, 3.4, 1.3, { amp: 0.2, decimals: 1 }),
      mkExam("Glicemia laboratorial", "mg/dL", 18, 212, 132, { amp: 14, decimals: 0 }),
      mkExam("pH", "", 18, 7.24, 7.42, { amp: 0.02, decimals: 2, code: "PH" }),
      mkExam("PaCO₂", "mmHg", 18, 62, 41, { amp: 2, decimals: 0, code: "PACO2" }),
      mkExam("PaO₂", "mmHg", 18, 55, 92, { amp: 4, decimals: 0, code: "PAO2" }),
      mkExam("HCO₃⁻", "mEq/L", 18, 26, 25, { amp: 0.7, decimals: 1, code: "HCO3" }),
      mkExam("Base excess (BE)", "mEq/L", 18, -4, 0.5, { amp: 0.5, decimals: 1, code: "BE" }),
      mkExam("SatO₂ arterial", "%", 18, 86, 97, { amp: 1, decimals: 0, code: "SATO2A" }),
      mkExam("FiO₂ (gasometria)", "%", 18, 100, 35, { amp: 4, decimals: 0, code: "GFIO2" }),
      mkExam("Lactato arterial", "mmol/L", 18, 3.2, 1.2, { amp: 0.2, decimals: 1, code: "GLAC" }),
    ],
    imaging: [
      { id: "i5a", modality: "TC", region: "Tórax", performedAt: daysAgoISO(17, 10, 0), summary: "Opacidades em vidro fosco difusas com consolidação dependente bilateral.", conclusion: "critico", status: "concluido" },
      { id: "i5b", modality: "RX", region: "Tórax", performedAt: daysAgoISO(11, 9, 0), summary: "Pneumotórax à direita, drenado no mesmo dia.", conclusion: "critico", status: "concluido" },
      { id: "i5c", modality: "RX", region: "Tórax", performedAt: daysAgoISO(1, 7, 0), summary: "Expansão pulmonar adequada, redução das consolidações.", conclusion: "alterado", status: "concluido" },
      { id: "i5d", modality: "ECO", region: "Ecocardiograma transtorácico", performedAt: daysAgoISO(9, 14, 0), summary: "FEVE 62%, sem disfunção de VD.", conclusion: "normal", status: "concluido" },
    ],
    eeg: [
      { id: "eeg5", performedAt: daysAgoISO(5, 10, 0), report: "Traçado com atividade de base preservada. Sem paroxismos. Compatível com efeito sedativo residual.", reportedBy: "Dra. L. Prado" },
    ],
    hemotransfusions: [
      { id: "ht5a", date: daysAgoISO(13, 12, 0), component: "Concentrado de hemácias", volume: "1 bolsa · 250 mL", note: "Hb 7,1 g/dL durante prona." },
    ],
    infections: [
      { id: "inf5a", site: "PAC", status: "resolvido", startedAt: daysAgoISO(19, 21, 0), resolvedAt: daysAgoISO(9, 8, 0), notes: "Influenza A tratada com oseltamivir por 10 dias." },
      { id: "inf5b", site: "PAV", status: "provavel", startedAt: daysAgoISO(10, 8, 0), relatedDeviceIds: ["d5a"], cultureIds: ["c5a"], antimicrobials: ["Piperacilina-tazobactam"], notes: "Piora de secreção e febre no D9." },
    ],
    cultures: [
      { id: "c5a", source: "Aspirado traqueal", collectedAt: daysAgoISO(10, 7, 0), organism: "Klebsiella pneumoniae", resistanceProfile: "sensivel", sensitivities: ["Piperacilina-tazobactam", "Meropenem"], linkedFocusId: "inf5b" },
      { id: "c5b", source: "Hemocultura periférica", collectedAt: daysAgoISO(10, 7, 10), result: "negativa", linkedFocusId: "inf5b" },
    ],
    infectionTimeline: [
      { at: daysAgoISO(19, 21, 0), kind: "atb_inicio", label: "Oseltamivir iniciado", focusId: "inf5a" },
      { at: daysAgoISO(10, 6, 0), kind: "febre", label: "Pico febril 38,5 °C", focusId: "inf5b" },
      { at: daysAgoISO(10, 7, 0), kind: "cultura_coletada", label: "Aspirado traqueal e hemoculturas", focusId: "inf5b" },
      { at: daysAgoISO(8, 9, 0), kind: "cultura_positiva", label: "Klebsiella sensível", focusId: "inf5b" },
    ],
    conducts: [
      { team: "Médica", text: "Ventilação", done: false, system: "resp", subItems: [
        { text: "Protocolo de desmame diário com TRE às 08 h", done: true },
        { text: "Definir traqueostomia se falha em 48 h", done: false, color: "orange" },
      ] },
      { team: "Médica", text: "Infecção", done: false, system: "infec", subItems: [
        { text: "Completar 14 dias de piperacilina-tazobactam", done: false },
      ] },
      { team: "Médica", text: "Dreno torácico", done: false, system: "resp", subItems: [
        { text: "Sem escape aéreo há 48 h — clampear e retirar", done: false, color: "teal" },
      ] },
      { team: "Fisioterapia", text: "Reabilitação", done: false, system: "other", subItems: [
        { text: "Cicloergômetro de membros inferiores", done: true },
        { text: "Treino de força com faixa elástica", done: false },
      ] },
      { team: "Fono", text: "Deglutição", done: false, system: "fono", subItems: [
        { text: "Avaliação após extubação", done: false },
      ] },
      { team: "Psicologia", text: "Suporte", done: true, system: "other", subItems: [
        { text: "Acolhimento familiar semanal realizado", done: true },
      ] },
    ],
    goals: [
      { text: "P/F > 200", met: true },
      { text: "PEEP ≤ 8 cmH₂O", met: true },
      { text: "Extubação em 72 h", met: false },
      { text: "Sedação leve (RASS -1 a 0)", met: true },
    ],
    state: {
      glasgow: 11, rass: -1, pam: 82, dva: null,
      vent: "VM PSV", fio2: 35, diurese: 1.1, temp: 37.0,
      dieta: "Enteral plena", infection: "PAV provável",
      fr: 24, spo2: 96, glicemia: 138, pas: 124, pad: 62, balancoHidrico: -260,
      notes: "19º dia de UTI. SDRA em resolução, dreno torácico a caminho da retirada.",
      vitalSeries: {
        temp: mkVitals("v5t", 18, 39.2, 36.9, 0.3, 1),
        spo2: mkVitals("v5s", 18, 86, 97, 1.5, 0),
        fc: mkVitals("v5f", 18, 118, 88, 4, 0),
        pam: mkVitals("v5p", 18, 68, 84, 3, 0),
        pas: mkVitals("v5pas", 18, 100, 126, 5, 0),
        pad: mkVitals("v5pad", 18, 52, 64, 3, 0),
        fr: mkVitals("v5fr", 18, 34, 23, 2, 0),
        glicemia: mkVitals("v5g", 18, 216, 134, 15, 0),
        bh: mkVitals("v5bh", 18, 1800, -340, 280, 0),
        bristol: mkVitals("v5b", 18, 5, 4, 1, 0),
      },
      customSeries: [
        { id: "cs5a", label: "PEEP", unit: "cmH₂O", readings: mkVitals("cs5a", 18, 16, 7, 1, 0) },
        { id: "cs5b", label: "FiO₂", unit: "%", readings: mkVitals("cs5b", 18, 100, 35, 4, 0) },
        { id: "cs5c", label: "Driving pressure", unit: "cmH₂O", readings: mkVitals("cs5c", 18, 17, 9, 1, 0) },
        { id: "cs5d", label: "Complacência estática", unit: "mL/cmH₂O", readings: mkVitals("cs5d", 18, 22, 44, 2, 0) },
        { id: "cs5e", label: "Volume corrente", unit: "mL", readings: mkVitals("cs5e", 18, 340, 420, 15, 0) },
      ],
      fluidBalance: {
        intake: [
          { id: "fi5a", name: "Dieta enteral", volumeMl: 1400, at: daysAgoISO(0, 6, 0), type: "dieta" },
          { id: "fi5b", name: "Hidratação e medicações", volumeMl: 720, at: daysAgoISO(0, 6, 0), type: "medicacao" },
        ],
        output: [
          { id: "fo5a", name: "Diurese", volumeMl: 2100, at: daysAgoISO(0, 6, 0), type: "diurese" },
        ],
        drains: [
          { id: "fd5a", name: "Dreno torácico", site: "Hemitórax direito", volumeMl: 80, aspect: "Seroso claro", at: daysAgoISO(0, 6, 0) },
        ],
      },
    },
  },
  {
    id: "p6",
    name: "Roberto Nakamura Alves",
    bed: "UTI-11",
    age: 29,
    sex: "M",
    weight: 74,
    height: 180,
    birthDate: "1996-02-14",
    origin: { type: "Pronto-Socorro", name: "Hospital Regional", city: "Campos", state: "RJ" },
    admissionHosp: "05/08/2026",
    admissionICU: "05/08/2026",
    daysHosp: 26,
    daysICU: 26,
    attending: "Dr. F. Tavares",
    team: "UTI Neuro",
    severity: "stable",
    diagnoses: [
      { date: "05/08", label: "Politrauma por acidente motociclístico", kind: "critical" },
      { date: "05/08", label: "TCE grave com contusão frontal (Glasgow 6)", kind: "neuro" },
      { date: "05/08", label: "Fratura de fêmur direito", kind: "neutral" },
      { date: "07/08", label: "Choque hemorrágico compensado", kind: "neutral", category: "inactive" },
      { date: "14/08", label: "Disautonomia paroxística", kind: "neuro" },
      { date: "23/08", label: "Traqueostomia para proteção de via aérea", kind: "resp" },
    ],
    social: { tabagismo: "não", etilismo: "social", ocupacao: "Entregador", dependencia: "Independente prévio" },
    allergies: ["—"],
    legalRepresentative: { name: "Sandra Alves", relation: "Mãe", phone: "(22) 97777-0003" },
    procedures: [
      { date: "05/08 02:15", label: "IOT em sequência rápida", kind: "resp" },
      { date: "05/08 05:00", label: "Craniotomia descompressiva", detail: "Neurocirurgia", kind: "neuro" },
      { date: "06/08 09:00", label: "Osteossíntese de fêmur direito", kind: "neutral" },
      { date: "05/08 a 12/08", label: "Monitorização de PIC", kind: "neuro" },
      { date: "23/08 09:30", label: "Traqueostomia percutânea", kind: "resp" },
      { date: "29/08 10:00", label: "Início de dieta por gastrostomia", kind: "neutral" },
    ],
    devices: [
      { id: "d6a", category: "airway", typeCode: "TQT", site: "Traqueal", size: "8.0", cannulaType: "plástica", insertedAt: daysAgoISO(8, 9, 30), lastCannulaChangeAt: daysAgoISO(1, 9, 0), recommendedMaxDays: 30 },
      { id: "d6b", category: "enteral", typeCode: "GTT", site: "Epigástrio", insertedAt: daysAgoISO(2, 10, 0), recommendedMaxDays: 90 },
      { id: "d6c", category: "urinary", typeCode: "SVD", site: "Uretral", size: "2 vias", insertedAt: daysAgoISO(3, 8, 0), recommendedMaxDays: 14 },
      { id: "d6d", category: "venous_peripheral", typeCode: "PVP", site: "Antebraço E", insertedAt: daysAgoISO(1, 8, 0), recommendedMaxDays: 4 },
    ],
    medications: [
      { name: "Levetiracetam", dose: "1g", route: "EV", freq: "12/12h", start: "05/08", kind: "neuro", active: true, category: "outro", therapeuticClass: "Anticonvulsivante" },
      { name: "Propranolol", dose: "20 mg", route: "GTT", freq: "8/8h", start: "15/08", kind: "neuro", active: true, category: "outro", therapeuticClass: "Betabloqueador (disautonomia)" },
      { name: "Clonidina", dose: "0,1 mg", route: "GTT", freq: "8/8h", start: "16/08", kind: "neuro", active: true },
      {
        name: "Cefazolina", dose: "2g", route: "EV", freq: "8/8h",
        start: "06/08", end: "08/08", kind: "attention", active: false,
        isAntibiotic: true, startISO: daysAgoISO(25, 8, 0), plannedEndISO: daysAgoISO(23, 8, 0),
        plannedDoses: 6, dosesGiven: 6, category: "antimicrobiano",
      },
      { name: "Enoxaparina", dose: "40 mg", route: "SC", freq: "1x/d", start: "09/08", kind: "stable", active: true },
    ],
    exams: [
      mkExam("Hemoglobina", "g/dL", 22, 7.8, 11.9, { amp: 0.2 }),
      mkExam("Leucócitos", "/mm³", 22, 16800, 8100, { amp: 700, decimals: 0 }),
      mkExam("Plaquetas", "/mm³", 22, 142000, 296000, { amp: 9000, decimals: 0 }),
      mkExam("PCR", "mg/L", 22, 186, 18, { amp: 9 }),
      mkExam("Creatinina", "mg/dL", 22, 1.4, 0.8, { amp: 0.06, decimals: 2 }),
      mkExam("Sódio", "mEq/L", 22, 152, 141, { amp: 1.5, decimals: 0 }),
      mkExam("Potássio", "mEq/L", 22, 3.2, 4.3, { amp: 0.15, decimals: 1 }),
      mkExam("Albumina", "g/dL", 22, 2.4, 3.4, { amp: 0.1, decimals: 1 }),
      mkExam("CPK", "U/L", 22, 4200, 180, { amp: 120, decimals: 0 }),
      mkExam("Lactato", "mmol/L", 22, 4.6, 1.1, { amp: 0.2, decimals: 1 }),
      mkExam("Glicemia laboratorial", "mg/dL", 22, 186, 108, { amp: 10, decimals: 0 }),
      mkExam("pH", "", 22, 7.29, 7.41, { amp: 0.02, decimals: 2, code: "PH" }),
      mkExam("PaCO₂", "mmHg", 22, 48, 39, { amp: 1.5, decimals: 0, code: "PACO2" }),
      mkExam("PaO₂", "mmHg", 22, 76, 98, { amp: 4, decimals: 0, code: "PAO2" }),
      mkExam("HCO₃⁻", "mEq/L", 22, 19, 24, { amp: 0.6, decimals: 1, code: "HCO3" }),
      mkExam("Base excess (BE)", "mEq/L", 22, -6, 0.8, { amp: 0.5, decimals: 1, code: "BE" }),
      mkExam("SatO₂ arterial", "%", 22, 93, 98, { amp: 1, decimals: 0, code: "SATO2A" }),
      mkExam("FiO₂ (gasometria)", "%", 22, 60, 28, { amp: 3, decimals: 0, code: "GFIO2" }),
    ],
    imaging: [
      { id: "i6a", modality: "TC", region: "Crânio", performedAt: daysAgoISO(26, 3, 0), summary: "Contusão frontal bilateral com edema difuso e desvio de linha média de 8 mm.", conclusion: "critico", status: "concluido" },
      { id: "i6b", modality: "TC", region: "Crânio", performedAt: daysAgoISO(12, 9, 0), summary: "Redução do edema, sem novos focos hemorrágicos.", conclusion: "alterado", status: "concluido" },
      { id: "i6c", modality: "RX", region: "Fêmur direito", performedAt: daysAgoISO(20, 11, 0), summary: "Material de osteossíntese com bom posicionamento.", conclusion: "alterado", status: "concluido" },
      { id: "i6d", modality: "TC", region: "Crânio (controle)", performedAt: daysAgoISO(1, 8, 0), summary: "Controle pré-cranioplastia solicitado.", conclusion: "pendente", status: "solicitado" },
    ],
    eeg: [
      { id: "eeg6a", performedAt: daysAgoISO(21, 10, 0), report: "Lentificação difusa acentuada com assimetria frontal esquerda. Sem crises eletrográficas.", reportedBy: "Dra. L. Prado" },
      { id: "eeg6b", performedAt: daysAgoISO(6, 10, 0), report: "Melhora da organização do traçado. Reatividade presente a estímulos. Sem atividade epileptiforme.", reportedBy: "Dra. L. Prado" },
    ],
    hemotransfusions: [
      { id: "ht6a", date: daysAgoISO(26, 4, 0), component: "Concentrado de hemácias", volume: "4 bolsas · 1000 mL", note: "Protocolo de transfusão maciça na admissão." },
      { id: "ht6b", date: daysAgoISO(26, 5, 0), component: "Plasma fresco congelado", volume: "4 bolsas" },
      { id: "ht6c", date: daysAgoISO(25, 12, 0), component: "Plaquetas", volume: "1 pool" },
    ],
    infections: [
      { id: "inf6a", site: "ITU", status: "resolvido", startedAt: daysAgoISO(16, 8, 0), resolvedAt: daysAgoISO(9, 8, 0), relatedDeviceIds: ["d6c"], notes: "Tratada com curso curto, urocultura de controle negativa." },
    ],
    cultures: [
      { id: "c6a", source: "Urocultura", collectedAt: daysAgoISO(16, 7, 0), organism: "Escherichia coli", resistanceProfile: "sensivel", sensitivities: ["Ceftriaxona", "Amicacina"], linkedFocusId: "inf6a" },
      { id: "c6b", source: "Urocultura de controle", collectedAt: daysAgoISO(8, 7, 0), result: "negativa", linkedFocusId: "inf6a" },
    ],
    lpp: [
      {
        id: "lpp6", identifiedAt: daysAgoISO(18, 9, 0), professional: "Enf. Rita",
        site: "occipital", siteLabel: "Occipital", view: "posterior", side: "central", count: 1, stage: "1",
        notes: "Resolvida com coxim de alívio.",
        evolutions: [{ at: daysAgoISO(10, 9, 0), stage: "1", professional: "Enf. Rita", notes: "Sem hiperemia residual." }],
      },
    ],
    conducts: [
      { team: "Médica", text: "Neurológico", done: false, system: "neuro", subItems: [
        { text: "Manter levetiracetam, sem crises há 26 dias", done: true },
        { text: "Programar cranioplastia após TC de controle", done: false, color: "teal" },
      ] },
      { team: "Médica", text: "Respiratório", done: true, system: "resp", subItems: [
        { text: "Traqueostomia em ar ambiente com nebulização", done: true },
        { text: "Avaliar decanulação com fonoaudiologia", done: false },
      ] },
      { team: "Fono", text: "Deglutição", done: false, system: "fono", subItems: [
        { text: "Teste de válvula de fala tolerado por 4 h", done: true },
        { text: "Iniciar dieta pastosa supervisionada", done: false },
      ] },
      { team: "Fisioterapia", text: "Reabilitação motora", done: true, system: "other", subItems: [
        { text: "Transferência leito-poltrona com dois profissionais", done: true },
        { text: "Carga parcial em membro inferior direito liberada", done: true },
      ] },
      { team: "Nutrição", text: "Dieta", done: true, system: "dieta", subItems: [
        { text: "Dieta por gastrostomia 30 kcal/kg/dia", done: true },
      ] },
      { team: "Médica", text: "Planejamento de alta", done: false, system: "other", subItems: [
        { text: "Vaga em unidade de reabilitação solicitada", done: false, color: "green" },
      ] },
    ],
    goals: [
      { text: "Sem crises convulsivas", met: true },
      { text: "Glasgow ≥ 13", met: true },
      { text: "Decanulação em 7 dias", met: false },
      { text: "Alta da UTI para reabilitação", met: false },
    ],
    dischargeCheck: {
      startedAt: daysAgoISO(3, 10, 0),
      updatedAt: daysAgoISO(0, 9, 0),
      expectedTransfer: daysAgoISO(-4, 10, 0),
      stability: { neuro: true, hemo: true, resp: true, metab: true },
      neuro: { glasgow: 14, pupils: "Isocóricas fotorreagentes", deficits: "Hemiparesia esquerda leve" },
      diagnosis: { dx: "TCE grave em reabilitação", procedures: "Craniotomia descompressiva, osteossíntese, traqueostomia" },
      nutrition: { gtt: true, fono: true, aspRisk: true },
      functionality: { mobility: true, physio: true, fallRisk: true, needsHelp: true },
      blockers: ["incompatible_device"],
      finalization: { fit: "nao", notes: "Aguardando decanulação e vaga em reabilitação.", responsible: "Dr. F. Tavares" },
    },
    state: {
      glasgow: 14, rass: 0, pam: 88, dva: null,
      vent: "Ar ambiente por traqueostomia", fio2: 21, diurese: 1.3, temp: 36.6,
      dieta: "Enteral por gastrostomia",
      fr: 18, spo2: 98, glicemia: 106, pas: 128, pad: 68, balancoHidrico: -120,
      notes: "26º dia de UTI. Estável, em reabilitação e programação de decanulação.",
      vitalSeries: {
        temp: mkVitals("v6t", 22, 38.4, 36.6, 0.3, 1),
        spo2: mkVitals("v6s", 22, 93, 98, 1, 0),
        fc: mkVitals("v6f", 22, 132, 82, 6, 0),
        pam: mkVitals("v6p", 22, 70, 90, 3, 0),
        pas: mkVitals("v6pas", 22, 104, 130, 5, 0),
        pad: mkVitals("v6pad", 22, 54, 70, 3, 0),
        fr: mkVitals("v6fr", 22, 28, 18, 2, 0),
        glicemia: mkVitals("v6g", 22, 178, 104, 12, 0),
        bh: mkVitals("v6bh", 22, 1600, -180, 240, 0),
        bristol: mkVitals("v6b", 22, 2, 4, 1, 0),
      },
      customSeries: [
        { id: "cs6a", label: "Glasgow", unit: "3–15", readings: mkVitals("cs6a", 22, 6, 14, 0, 0) },
        { id: "cs6b", label: "RASS", unit: "-5 a +4", readings: mkVitals("cs6b", 22, -5, 0, 0, 0) },
        { id: "cs6c", label: "Peso", unit: "kg", readings: mkVitals("cs6c", 22, 82, 74, 0.5, 1) },
        { id: "cs6d", label: "Braden", unit: "6–23", readings: mkVitals("cs6d", 22, 11, 18, 1, 0) },
        { id: "cs6e", label: "Diurese/kg/h", unit: "mL/kg/h", readings: mkVitals("cs6e", 22, 0.6, 1.3, 0.1, 1) },
      ],
      fluidBalance: {
        intake: [
          { id: "fi6a", name: "Dieta por gastrostomia", volumeMl: 1600, at: daysAgoISO(0, 6, 0), type: "dieta" },
          { id: "fi6b", name: "Água livre", volumeMl: 600, at: daysAgoISO(0, 6, 0), type: "hidratacao" },
        ],
        output: [
          { id: "fo6a", name: "Diurese", volumeMl: 2300, at: daysAgoISO(0, 6, 0), type: "diurese" },
        ],
      },
    },
  },
];


// ============================================================================
// SAPS 3 — registro por admissão de UTI
// ============================================================================

export interface Saps3SnapshotItem {
  key: string;
  label: string;
  value: string | null;
  category: string | null;
  points: number | null;
  source: string;
  at?: string;
}

export interface Saps3Snapshot {
  at: string;                 // ISO do cálculo
  score: number;
  mortality: number | null;   // %
  items: Saps3SnapshotItem[];
  by?: string;                // usuário responsável
  icuAdmission?: string;      // admissão de UTI à qual o cálculo se refere
}

export interface Saps3Record {
  /** Valores informados manualmente (sobrepõem o preenchimento automático). */
  manual?: Record<string, number | string | string[] | null>;
  /** Origem/registro de cada preenchimento manual. */
  meta?: Record<string, { at: string; by?: string; previous?: string | null }>;
  history?: Saps3Snapshot[];
  computedAt?: string;
  icuAdmission?: string;
}
