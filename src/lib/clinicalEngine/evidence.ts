// Biblioteca de evidências versionada do Motor Clínico.
// Espelha as tabelas clinical_guidelines / guideline_versions / guideline_recommendations
// para que o motor rode de forma determinística mesmo sem consulta ao banco.
// Novas versões entram aqui (e no banco) sem reescrever o NETO.

import type { Domain, EvidenceRef } from "./types";

interface EvidenceSeed extends Omit<EvidenceRef, "code"> {
  domain: Domain;
  status: "active" | "superseded";
}

const SSC26 = {
  society: "SCCM / ESICM — Surviving Sepsis Campaign",
  document: "Surviving Sepsis Campaign — sepse e choque séptico em adultos",
  version: "SSC 2026",
  year: 2026,
  url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-guidelines",
} as const;

const PADIS18 = {
  society: "SCCM",
  document: "PADIS — dor, agitação/sedação, delirium, imobilidade e sono",
  version: "PADIS 2018",
  year: 2018,
  url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/clinical-practice-guidelines-for-the-prevention-and",
} as const;

const PADIS25 = {
  society: "SCCM",
  document: "PADIS — atualização focada (aplicada junto ao documento de 2018)",
  version: "PADIS Focused Update 2025",
  year: 2025,
  url: "https://www.sccm.org/clinical-resources/guidelines",
} as const;

const ARDS = {
  society: "ATS / ESICM / SCCM",
  document: "Ventilação mecânica na SDRA do adulto",
  version: "ARDS 2023-2024",
  year: 2024,
  url: "https://www.thoracic.org/statements/",
} as const;

const VAP = {
  society: "IDSA / ATS",
  document: "Pneumonia adquirida no hospital e associada à ventilação",
  version: "HAP/VAP 2016",
  year: 2016,
  url: "https://www.idsociety.org/practice-guideline/hap_vap/",
} as const;

const SAH = {
  society: "AHA/ASA e Neurocritical Care Society",
  document: "Hemorragia subaracnóidea aneurismática",
  version: "AHA/ASA aSAH 2023",
  year: 2023,
  url: "https://www.ahajournals.org/journal/str",
} as const;

const ICH = {
  society: "AHA/ASA",
  document: "Hemorragia intracerebral espontânea",
  version: "AHA/ASA ICH 2022",
  year: 2022,
  url: "https://www.ahajournals.org/journal/str",
} as const;

const STROKE = {
  society: "AHA/ASA",
  document: "AVC isquêmico agudo",
  version: "AHA/ASA AIS 2019/2021",
  year: 2021,
  url: "https://www.ahajournals.org/journal/str",
} as const;

const TBI = {
  society: "Brain Trauma Foundation",
  document: "Traumatismo cranioencefálico grave",
  version: "BTF 4ª edição",
  year: 2016,
  url: "https://braintrauma.org/guidelines",
} as const;

const SE = {
  society: "Neurocritical Care Society / AES",
  document: "Status epilepticus",
  version: "NCS/AES 2016",
  year: 2016,
  url: "https://www.neurocriticalcaresociety.org/guidelines",
} as const;

const KDIGO = {
  society: "KDIGO",
  document: "Lesão renal aguda e terapia renal substitutiva",
  version: "KDIGO AKI 2012 (+ atualizações)",
  year: 2012,
  url: "https://kdigo.org/guidelines/acute-kidney-injury/",
} as const;

const NUT = {
  society: "ASPEN / SCCM e ESPEN",
  document: "Terapia nutricional no paciente crítico",
  version: "ASPEN/SCCM 2022 e ESPEN 2023",
  year: 2023,
  url: "https://www.nutritioncare.org/guidelines_and_clinical_resources/",
} as const;

const VTE = {
  society: "ASH e CHEST",
  document: "Profilaxia e tratamento de tromboembolismo venoso",
  version: "ASH 2018/2019 e CHEST 2021",
  year: 2021,
  url: "https://ashpublications.org/",
} as const;

const TRF = {
  society: "AABB",
  document: "Limiares de transfusão de hemácias",
  version: "AABB 2023",
  year: 2023,
  url: "https://www.aabb.org/",
} as const;

const GLY = {
  society: "ADA / SCCM",
  document: "Controle glicêmico no paciente crítico",
  version: "ADA 2025",
  year: 2025,
  url: "https://diabetesjournals.org/care",
} as const;

const CARD = {
  society: "AHA/ACC e ESC",
  document: "Choque cardiogênico, SCA, fibrilação atrial e insuficiência cardíaca",
  version: "AHA/ACC e ESC 2021-2023",
  year: 2023,
  url: "https://www.acc.org/Guidelines",
} as const;

const DEV = {
  society: "CDC / SHEA e ANVISA",
  document: "Prevenção de infecção relacionada a dispositivos invasivos",
  version: "CDC/SHEA 2022-2023",
  year: 2023,
  url: "https://www.cdc.gov/infection-control/hcp/index.html",
} as const;

const PAL = {
  society: "SCCM",
  document: "Cuidados paliativos e metas de cuidado na UTI",
  version: "SCCM 2017 e atualizações",
  year: 2017,
  url: "https://www.sccm.org/clinical-resources/guidelines",
} as const;

const SAFE = {
  society: "SCCM / IHI",
  document: "Segurança e qualidade assistencial na UTI",
  version: "SCCM/IHI 2023",
  year: 2023,
  url: "https://www.sccm.org/clinical-resources/guidelines",
} as const;

const POCUS = {
  society: "SCCM",
  document: "Ultrassonografia point-of-care na UTI",
  version: "SCCM POCUS 2024",
  year: 2024,
  url: "https://www.sccm.org/clinical-resources/guidelines",
} as const;

const ELSO = {
  society: "ELSO",
  document: "Suporte extracorpóreo (ECMO)",
  version: "ELSO 2021",
  year: 2021,
  url: "https://www.elso.org/resources/guidelines.aspx",
} as const;

const TRAUMA = {
  society: "ATLS / EAST",
  document: "Trauma grave em terapia intensiva",
  version: "EAST 2023",
  year: 2023,
  url: "https://www.east.org/education-resources/practice-management-guidelines",
} as const;

const BURN = {
  society: "American Burn Association",
  document: "Grande queimado",
  version: "ABA 2023",
  year: 2023,
  url: "https://ameriburn.org/resources/guidelines/",
} as const;

/**
 * Resumos próprios das recomendações (não reprodução literal de texto protegido),
 * com sociedade, documento, versão, ano, força e certeza para rastreabilidade.
 */
export const EVIDENCE: Record<string, EvidenceSeed> = {
  // ---- Surviving Sepsis Campaign 2026 (129 statements, 46 novos) ----
  "SSC26-SCREEN": {
    ...SSC26,
    domain: "sepse",
    status: "active",
    topic: "Triagem de sepse",
    statement:
      "Usar rotina de triagem sistemática de sepse em pacientes de risco, em vez de depender de sinais isolados.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-CULT": {
    ...SSC26,
    domain: "sepse",
    status: "active",
    topic: "Culturas",
    statement:
      "Coletar culturas apropriadas, incluindo hemoculturas, antes do antimicrobiano quando isso não atrasar significativamente a terapia.",
    strength: "boa prática",
  },
  "SSC26-LACT": {
    ...SSC26,
    domain: "sepse",
    status: "active",
    topic: "Lactato",
    statement:
      "Medir lactato e repetir a medida para guiar a ressuscitação quando o valor inicial estiver elevado.",
    strength: "condicional",
    certainty: "baixa",
  },
  "SSC26-FLUID": {
    ...SSC26,
    domain: "sepse",
    status: "active",
    topic: "Ressuscitação volêmica",
    statement:
      "Ressuscitar com cristaloide balanceado e reavaliar a resposta com medidas dinâmicas, evitando sobrecarga volêmica.",
    strength: "condicional",
    certainty: "baixa",
  },
  "SSC26-ATB": {
    ...SSC26,
    domain: "sepse",
    status: "active",
    topic: "Antimicrobianos",
    statement:
      "Antimicrobiano de amplo espectro precoce no choque séptico; na sepse sem choque, avaliação rápida com início conforme probabilidade de infecção.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-STEW": {
    ...SSC26,
    domain: "infeccao",
    status: "active",
    topic: "Stewardship antimicrobiano",
    statement:
      "Reavaliar diariamente espectro e duração, descalonar conforme cultura e resposta clínica e usar a menor duração efetiva.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-HEMO": {
    ...SSC26,
    domain: "hemodinamica",
    status: "active",
    topic: "Alvo hemodinâmico",
    statement:
      "Alvo inicial de pressão arterial média de 65 mmHg, com noradrenalina como vasopressor de primeira escolha.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-VENT": {
    ...SSC26,
    domain: "ventilacao",
    status: "active",
    topic: "Ventilação na sepse",
    statement:
      "Na SDRA induzida por sepse, ventilação protetora com volume corrente baixo e limitação da pressão de platô.",
    strength: "forte",
    certainty: "alta",
  },
  "SSC26-VTE": {
    ...SSC26,
    domain: "trombose",
    status: "active",
    topic: "Tromboprofilaxia",
    statement:
      "Oferecer profilaxia farmacológica de tromboembolismo venoso na ausência de contraindicação.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-MEDREC": {
    ...SSC26,
    domain: "medicacoes",
    status: "active",
    topic: "Reconciliação medicamentosa",
    statement: "Reconciliação medicamentosa na admissão e em todas as transições de cuidado.",
    strength: "boa prática",
  },
  "SSC26-GOALS": {
    ...SSC26,
    domain: "paliativo",
    status: "active",
    topic: "Metas de cuidado",
    statement:
      "Discutir metas de cuidado precocemente, integrando a família e o cuidado paliativo quando indicado.",
    strength: "forte",
    certainty: "moderada",
  },
  "SSC26-TRANS": {
    ...SSC26,
    domain: "seguranca",
    status: "active",
    topic: "Transições de cuidado",
    statement: "Estruturar a transição de cuidado com comunicação padronizada e plano de seguimento.",
    strength: "boa prática",
  },
  "SSC21-LEGACY": {
    society: SSC26.society,
    document: SSC26.document,
    version: "SSC 2021",
    year: 2021,
    url: SSC26.url,
    domain: "sepse",
    status: "superseded",
    topic: "Versão anterior",
    statement: "Versão substituída pela SSC 2026; mantida apenas para rastreabilidade histórica.",
  },

  // ---- PADIS 2018 + atualização focada 2025 ----
  "PADIS18-PAIN": {
    ...PADIS18,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Dor",
    statement:
      "Avaliar dor sistematicamente com escala validada (CPOT ou BPS) e tratar guiado pela avaliação.",
    strength: "forte",
    certainty: "moderada",
  },
  "PADIS18-SED": {
    ...PADIS18,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Sedação",
    statement:
      "Sedação leve com meta definida, priorizando analgesia e evitando benzodiazepínico como sedativo de escolha.",
    strength: "condicional",
    certainty: "baixa",
  },
  "PADIS18-DEL": {
    ...PADIS18,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Delirium",
    statement:
      "Rastrear delirium rotineiramente com CAM-ICU ou ICDSC e priorizar medidas não farmacológicas multicomponente.",
    strength: "forte",
    certainty: "moderada",
  },
  "PADIS18-MOB": {
    ...PADIS18,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Mobilidade",
    statement: "Mobilização e reabilitação precoces quando não houver contraindicação.",
    strength: "condicional",
    certainty: "baixa",
  },
  "PADIS18-SLEEP": {
    ...PADIS18,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Sono",
    statement:
      "Protocolo de promoção do sono com redução de ruído, luz e interrupções noturnas.",
    strength: "condicional",
    certainty: "muito baixa",
  },
  "PADIS25-FOCUS": {
    ...PADIS25,
    domain: "dor_sedacao_delirium",
    status: "active",
    topic: "Atualização focada 2025",
    statement:
      "Aplicar a atualização focada de 2025 em conjunto com o documento de 2018 para analgesia, escolha de sedativo e manejo do delirium.",
    strength: "condicional",
    certainty: "moderada",
  },

  // ---- SDRA / ventilação ----
  "ARDS-VT": {
    ...ARDS,
    domain: "ventilacao",
    status: "active",
    topic: "Volume corrente e platô",
    statement:
      "Ventilar com 4 a 8 mL/kg de peso corporal predito e manter pressão de platô ≤ 30 cmH2O.",
    strength: "forte",
    certainty: "alta",
  },
  "ARDS-DP": {
    ...ARDS,
    domain: "ventilacao",
    status: "active",
    topic: "Driving pressure",
    statement:
      "Manter driving pressure a mais baixa possível, idealmente ≤ 15 cmH2O, quando o dado estiver disponível.",
    strength: "condicional",
    certainty: "moderada",
  },
  "ARDS-PRONE": {
    ...ARDS,
    domain: "ventilacao",
    status: "active",
    topic: "Pronação",
    statement:
      "Na SDRA moderada a grave com PaO2/FiO2 < 150, considerar pronação prolongada.",
    strength: "forte",
    certainty: "moderada",
  },
  "ARDS-WEAN": {
    ...ARDS,
    domain: "ventilacao",
    status: "active",
    topic: "Desmame",
    statement: "Avaliar diariamente elegibilidade para teste de respiração espontânea.",
    strength: "forte",
    certainty: "moderada",
  },

  // ---- HAP/VAP ----
  "VAP-EMP": {
    ...VAP,
    domain: "infeccao",
    status: "active",
    topic: "Terapia empírica",
    statement:
      "Escolher terapia empírica conforme fatores de risco para multirresistência e perfil microbiológico local.",
    strength: "forte",
    certainty: "moderada",
  },
  "VAP-DUR": {
    ...VAP,
    domain: "infeccao",
    status: "active",
    topic: "Duração",
    statement:
      "Sete dias de tratamento para a maioria dos casos, individualizando conforme resposta clínica.",
    strength: "forte",
    certainty: "moderada",
  },

  // ---- Neurocrítico ----
  "SAH-VASO": {
    ...SAH,
    domain: "neurocritico",
    status: "active",
    topic: "Vasoespasmo / isquemia tardia",
    statement:
      "Monitorar isquemia cerebral tardia, manter euvolemia e usar nimodipino conforme a diretriz.",
    strength: "forte",
    certainty: "moderada",
  },
  "ICH-BP": {
    ...ICH,
    domain: "neurocritico",
    status: "active",
    topic: "Pressão arterial na hemorragia",
    statement:
      "Controle precoce, suave e sustentado da pressão arterial, evitando grandes variações.",
    strength: "condicional",
    certainty: "moderada",
  },
  "AIS-CARE": {
    ...STROKE,
    domain: "neurocritico",
    status: "active",
    topic: "AVC isquêmico agudo",
    statement:
      "Cuidados na fase aguda com avaliação de trombólise/trombectomia, controle pressórico e prevenção de complicações.",
    strength: "forte",
    certainty: "moderada",
  },
  "TBI-ICP": {
    ...TBI,
    domain: "neurocritico",
    status: "active",
    topic: "Pressão intracraniana",
    statement:
      "Tratar pressão intracraniana acima de 22 mmHg e manter pressão de perfusão cerebral na faixa recomendada.",
    strength: "condicional",
    certainty: "baixa",
  },
  "SE-STEP": {
    ...SE,
    domain: "neurocritico",
    status: "active",
    topic: "Status epilepticus",
    statement:
      "Tratamento em etapas com benzodiazepínico seguido de antiepiléptico, com EEG quando persistir alteração de consciência.",
    strength: "forte",
    certainty: "moderada",
  },

  // ---- Renal ----
  "AKI-STAGE": {
    ...KDIGO,
    domain: "renal",
    status: "active",
    topic: "Estadiamento de LRA",
    statement: "Estadiar lesão renal aguda por variação de creatinina e por débito urinário.",
    strength: "forte",
    certainty: "alta",
  },
  "AKI-NEPHRO": {
    ...KDIGO,
    domain: "renal",
    status: "active",
    topic: "Nefroproteção",
    statement:
      "Evitar nefrotóxicos, ajustar dose dos medicamentos à função renal e manter perfusão adequada.",
    strength: "forte",
    certainty: "moderada",
  },
  "AKI-KRT": {
    ...KDIGO,
    domain: "renal",
    status: "active",
    topic: "Terapia renal substitutiva",
    statement:
      "Indicar terapia renal substitutiva por indicações clássicas e pela trajetória clínica, não por valor isolado.",
    strength: "condicional",
    certainty: "moderada",
  },

  // ---- Outros domínios ----
  "NUT-EN": {
    ...NUT,
    domain: "nutricao",
    status: "active",
    topic: "Nutrição enteral precoce",
    statement:
      "Iniciar nutrição enteral precoce com trato gastrointestinal funcionante e paciente hemodinamicamente estável.",
    strength: "forte",
    certainty: "moderada",
  },
  "VTE-PROPH": {
    ...VTE,
    domain: "trombose",
    status: "active",
    topic: "Profilaxia de TEV",
    statement:
      "Profilaxia farmacológica na ausência de contraindicação; profilaxia mecânica quando houver contraindicação ao fármaco.",
    strength: "forte",
    certainty: "moderada",
  },
  "TRF-RESTR": {
    ...TRF,
    domain: "transfusao",
    status: "active",
    topic: "Estratégia restritiva",
    statement:
      "Estratégia restritiva de transfusão de hemácias na maioria dos pacientes críticos estáveis.",
    strength: "forte",
    certainty: "moderada",
  },
  "GLY-TARGET": {
    ...GLY,
    domain: "endocrino",
    status: "active",
    topic: "Meta glicêmica",
    statement:
      "Manter glicemia entre 140 e 180 mg/dL na maioria dos pacientes críticos, evitando hipoglicemia.",
    strength: "forte",
    certainty: "moderada",
  },
  "CARD-SHOCK": {
    ...CARD,
    domain: "cardiologia",
    status: "active",
    topic: "Choque cardiogênico",
    statement:
      "Avaliar perfil hemodinâmico, corrigir a causa e considerar suporte mecânico em centro habilitado.",
    strength: "condicional",
    certainty: "baixa",
  },
  "DEV-REVIEW": {
    ...DEV,
    domain: "dispositivos",
    status: "active",
    topic: "Necessidade do dispositivo",
    statement:
      "Reavaliar diariamente a necessidade de cada dispositivo invasivo e remover assim que possível.",
    strength: "forte",
    certainty: "moderada",
  },
  "PAL-GOALS": {
    ...PAL,
    domain: "paliativo",
    status: "active",
    topic: "Metas de cuidado",
    statement: "Conversas estruturadas sobre metas de cuidado, com registro das diretivas.",
    strength: "forte",
    certainty: "moderada",
  },
  "SAFE-CHECK": {
    ...SAFE,
    domain: "seguranca",
    status: "active",
    topic: "Checklist diário",
    statement: "Checklist diário estruturado para prevenir omissões assistenciais.",
    strength: "boa prática",
  },
  "POCUS-HEMO": {
    ...POCUS,
    domain: "hemodinamica",
    status: "active",
    topic: "POCUS hemodinâmico",
    statement:
      "Ultrassonografia point-of-care para avaliar responsividade a fluidos e função cardíaca quando disponível.",
    strength: "condicional",
    certainty: "baixa",
  },
  "ECMO-IND": {
    ...ELSO,
    domain: "ventilacao",
    status: "active",
    topic: "Suporte extracorpóreo",
    statement: "Indicação, manejo e desmame de ECMO conforme critérios e centro habilitado.",
    strength: "condicional",
    certainty: "baixa",
  },
  "TRAUMA-ICU": {
    ...TRAUMA,
    domain: "seguranca",
    status: "active",
    topic: "Trauma grave",
    statement: "Manejo estruturado do trauma grave em terapia intensiva, com reavaliação seriada.",
    strength: "condicional",
    certainty: "baixa",
  },
  "BURN-RESUS": {
    ...BURN,
    domain: "seguranca",
    status: "active",
    topic: "Grande queimado",
    statement: "Ressuscitação volêmica guiada por metas e cuidados específicos do grande queimado.",
    strength: "condicional",
    certainty: "baixa",
  },
};

/** Referência versionada de uma recomendação. Retorna undefined se o código não existir. */
export function evidence(code: string): EvidenceRef | undefined {
  const seed = EVIDENCE[code];
  if (!seed || seed.status !== "active") return undefined;
  const { domain: _domain, status: _status, ...rest } = seed;
  return { code, ...rest };
}

/** Todas as recomendações vigentes de um domínio. */
export function evidenceByDomain(domain: Domain): EvidenceRef[] {
  return Object.keys(EVIDENCE)
    .filter((c) => EVIDENCE[c]?.domain === domain && EVIDENCE[c]?.status === "active")
    .map((c) => evidence(c))
    .filter((e): e is EvidenceRef => !!e);
}

/** Protocolo institucional ativo (padrão da unidade; pode ser sobrescrito pelo banco). */
export interface InstitutionalProtocol {
  code: string;
  name: string;
  domain: Domain;
  statement: string;
  precedence: boolean;
  active: boolean;
}

export const DEFAULT_PROTOCOLS: InstitutionalProtocol[] = [
  {
    code: "INST-PAM-65",
    name: "Meta de pressão arterial média da unidade",
    domain: "hemodinamica",
    statement:
      "Manter PAM ≥ 65 mmHg, salvo meta individualizada registrada pela equipe.",
    precedence: false,
    active: true,
  },
  {
    code: "INST-GLI-140-180",
    name: "Meta glicêmica da unidade",
    domain: "endocrino",
    statement: "Manter glicemia entre 140 e 180 mg/dL com o protocolo de insulina da unidade.",
    precedence: false,
    active: true,
  },
  {
    code: "INST-CVC-REVIEW",
    name: "Revisão diária de dispositivos",
    domain: "dispositivos",
    statement: "Revisar diariamente a necessidade de CVC, sonda vesical e tubo orotraqueal.",
    precedence: false,
    active: true,
  },
];
