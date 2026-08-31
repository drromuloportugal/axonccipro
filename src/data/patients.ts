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

export type DiagnosisCategory = "previous" | "current" | "complication";

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
  /** Status de solicitação: solicitado ou concluído. */
  status?: "solicitado" | "concluido";
  reportedBy?: string;
  images?: ImagingImage[]; // anexos do exame
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
    };

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
      { date: "05/06 14:20", label: " IOT", detail: "Tubo 7.5 — Dr. Lima", kind: "resp" },
      { date: "10/06 22:40", label: "⚡ PCR revertida", detail: "1 ciclo RCP", kind: "critical" },
      { date: "13/06 08:00", label: " CRRT iniciada", kind: "neuro" },
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
      { date: "10/06 23:10", label: " IOT", detail: "Tubo 8.0", kind: "resp" },
      { date: "11/06 02:30", label: " DVE", detail: "Neurocirurgia", kind: "neuro" },
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
      { date: "30/05 10:00", label: " IOT", kind: "resp" },
      { date: "08/06 09:00", label: " Extubação", kind: "resp" },
      { date: "08/06 09:30", label: " VNI", kind: "resp" },
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
