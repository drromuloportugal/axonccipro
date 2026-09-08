// Etapa 2 e 3 do pipeline: coleta dos dados estruturados do paciente
// e classificação da origem de cada dado (informado / calculado / inferido / não informado).

import type { InvasiveDevice, Medication, Patient } from "@/data/patients";
import { detectAntibiotic, isMedActive } from "@/lib/clinical";
import { creatinineClearance, findCreatinineRow } from "@/lib/renalDosing";
import type { DataPoint, Domain, Provenance } from "./types";

const NUM = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export interface ExamFact {
  value: number | null;
  raw?: string;
  unit?: string;
  at?: string;
  count: number;
  previous: number | null;
  min: number | null;
  max: number | null;
}

const EMPTY_EXAM: ExamFact = {
  value: null,
  count: 0,
  previous: null,
  min: null,
  max: null,
};

/** Lê um exame por código ou rótulo, com série histórica. */
export function examFact(p: Patient, ...needles: string[]): ExamFact {
  const rows = p.exams ?? [];
  const row = rows.find((e) =>
    needles.some(
      (n) =>
        (e.code ?? "").toLowerCase().includes(n.toLowerCase()) ||
        (e.label ?? "").toLowerCase().includes(n.toLowerCase()),
    ),
  );
  if (!row) return { ...EMPTY_EXAM };
  const current = row.valueNum ?? NUM(row.value);
  const hist = (row.history ?? [])
    .slice()
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((h) => h.value)
    .filter((v): v is number => Number.isFinite(v));
  const series = current != null ? [...hist, current] : hist;
  return {
    value: current,
    raw: row.value,
    unit: row.unit,
    at: row.takenAt,
    count: series.length,
    previous: series.length >= 2 ? (series[series.length - 2] ?? null) : null,
    min: series.length ? Math.min(...series) : null,
    max: series.length ? Math.max(...series) : null,
  };
}

export interface DeviceFact {
  device: InvasiveDevice;
  days: number | null;
  hasIndication: boolean;
}

export interface Facts {
  patient: Patient;
  points: DataPoint[];

  // antropometria
  weightKg: number | null;
  heightCm: number | null;
  predictedWeight: number | null;

  // hemodinâmica / vitais
  pam: number | null;
  pas: number | null;
  pad: number | null;
  fcMax: number | null;
  fr: number | null;
  spo2: number | null;
  tempMax: number | null;
  glicemia: number | null;
  balanco: number | null;

  // neuro
  gcs: number | null;
  gcsPrevious: number | null;
  rass: number | null;
  pic: number | null;

  // renal
  diureseHoraria: number | null;
  diurese24: number | null;
  creat: ExamFact;
  crcl: number | null;
  ureia: number | null;

  // laboratório
  lactate: ExamFact;
  hb: ExamFact;
  plaq: ExamFact;
  pao2: ExamFact;
  paco2: ExamFact;
  ph: ExamFact;
  sodio: ExamFact;
  potassio: ExamFact;
  inr: ExamFact;
  bilirrubina: ExamFact;

  // ventilação
  ventText: string;
  invasiveVent: boolean;
  noninvasiveSupport: boolean;
  fio2: number | null;
  peep: number | null;
  vt: number | null;
  vtPerKg: number | null;
  plateau: number | null;
  drivingPressure: number | null;
  pfRatio: number | null;

  // farmacologia
  vasopressors: string[];
  activeMeds: Medication[];
  antimicrobials: Medication[];
  maxAtbDays: number | null;
  sedatives: Medication[];
  benzodiazepines: Medication[];
  vteProphylaxis: boolean;
  insulin: boolean;

  // infecção
  hasInfectionFocus: boolean;
  infectionLabels: string[];
  culturesCount: number;
  positiveCultures: number;

  // dispositivos
  devices: DeviceFact[];

  // nutrição
  diet: string;
  dietSuspended: boolean;
  residuoGastrico: number | null;

  // avaliações registradas em texto
  painAssessed: boolean;
  deliriumAssessed: boolean;
  sbtAssessed: boolean;
  mobilityAssessed: boolean;
  familyAssessed: boolean;

  // contexto diagnóstico
  diagnosisText: string;
  neuroCase: boolean;
  sahCase: boolean;
  ichCase: boolean;
  strokeCase: boolean;
  tbiCase: boolean;
  seizureCase: boolean;
  sepsisSuspected: boolean;
  ardsSuspected: boolean;
  daysICU: number | null;
  goalsOfCareRegistered: boolean;
}

const conductText = (p: Patient) =>
  [
    ...(p.conducts ?? []).flatMap((c) => [c.text, ...(c.subItems ?? []).map((s) => s.text)]),
    p.state?.notes ?? "",
    ...(p.goals ?? []).map((g) => g.text),
  ]
    .join(" · ")
    .toLowerCase();

const PBW = (sex: "M" | "F", heightCm: number) =>
  sex === "M" ? 50 + 0.91 * (heightCm - 152.4) : 45.5 + 0.91 * (heightCm - 152.4);

function push(
  points: DataPoint[],
  key: string,
  label: string,
  num: number | null | undefined,
  unit: string,
  domain: Domain,
  provenance: Provenance = "informado",
  at?: string,
) {
  const has = num != null && Number.isFinite(num);
  points.push({
    key,
    label,
    value: has ? `${num}${unit ? ` ${unit}` : ""}` : "DADO NÃO INFORMADO",
    num: has ? num : null,
    unit,
    domain,
    provenance: has ? provenance : "nao_informado",
    at,
  });
}

/** Coleta e classifica todos os dados usados pelo motor. */
export function collectFacts(p: Patient): Facts {
  const s = p.state ?? ({} as Patient["state"]);
  const points: DataPoint[] = [];
  const texts = conductText(p);

  const creat = examFact(p, "creat");
  const lactate = examFact(p, "lactato");
  const hb = examFact(p, "Hb", "hemoglobina");
  const plaq = examFact(p, "plaq");
  const pao2 = examFact(p, "PaO2", "po2");
  const paco2 = examFact(p, "PaCO2", "pco2");
  const ph = examFact(p, "pH");
  const sodio = examFact(p, "Na", "sódio", "sodio");
  const potassio = examFact(p, "K", "potássio", "potassio");
  const inr = examFact(p, "INR");
  const bilirrubina = examFact(p, "bilir");
  const picExam = examFact(p, "PIC");
  const ureia = examFact(p, "ureia");

  const weightKg = NUM(p.weight);
  const heightCm = NUM(p.height);
  const predictedWeight =
    heightCm && heightCm > 120 ? Math.round(PBW(p.sex, heightCm) * 10) / 10 : null;

  const ventText = s.vent ?? "";
  const invasiveVent = /vm|iot|tot|traq|pcv|vcv|psv|siv|a\/c|pressão control/i.test(ventText);
  const noninvasiveSupport = /vni|bipap|cpap|cnaf|máscara|mascara|cateter|ar ambiente/i.test(
    ventText,
  );

  const lastIntub = (p.intubations ?? [])
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  const pv = lastIntub?.postVent;

  const fio2Raw = NUM(s.fio2);
  const fio2 = fio2Raw != null ? (fio2Raw <= 1 ? fio2Raw * 100 : fio2Raw) : (NUM(pv?.fio2) ?? null);
  const vt = NUM(pv?.vt);
  const peep = NUM(pv?.peep);
  const plateau = NUM(pv?.plateau);
  const drivingPressure =
    NUM(pv?.drivingPressure) ?? (plateau != null && peep != null ? plateau - peep : null);
  const vtPerKg =
    vt != null && predictedWeight ? Math.round((vt / predictedWeight) * 10) / 10 : null;
  const pfRatio =
    pao2.value != null && fio2 != null && fio2 > 0 ? Math.round(pao2.value / (fio2 / 100)) : null;

  const activeMeds = (p.medications ?? []).filter((m) => isMedActive(m));
  const antimicrobials = activeMeds.filter((m) => m.isAntibiotic ?? detectAntibiotic(m.name));
  const now = Date.now();
  const atbDays = antimicrobials
    .map((m) => {
      const start = m.startISO ?? m.start;
      const t = start ? Date.parse(start) : NaN;
      return Number.isFinite(t) ? Math.floor((now - t) / 86400000) : null;
    })
    .filter((d): d is number => d != null && d >= 0);
  const maxAtbDays = atbDays.length ? Math.max(...atbDays) : null;

  const SED_RE =
    /propofol|midazolam|dexmedetomidina|precedex|cetamina|ketamina|fentanil|morfina|remifentanil/i;
  const BZD_RE = /midazolam|diazepam|lorazepam/i;
  const VTE_RE =
    /heparina|enoxaparina|clexane|fraxiparina|hbpm|fondaparinux|varfarina|rivaroxaban|apixaban|dabigatran/i;

  const sedatives = activeMeds.filter((m) => SED_RE.test(m.name));
  const benzodiazepines = activeMeds.filter((m) => BZD_RE.test(m.name));
  const vteProphylaxis =
    activeMeds.some((m) => VTE_RE.test(m.name)) ||
    /profilaxia (de )?(tev|tvp)|compressão pneumática|meia elástica|heparina profil/i.test(texts);
  const insulin = activeMeds.some((m) => /insulina/i.test(m.name));

  const vasopressors = (() => {
    const list: string[] = [];
    const dva = s.dva ?? "";
    if (dva && !/^(não|nao|nenhum|sem)/i.test(dva.trim())) list.push(dva.trim());
    for (const m of activeMeds) {
      if (
        /noradren|adrenalina|epinef|vasopressina|dobutamina|dopamina|terlipressina/i.test(m.name)
      ) {
        list.push(`${m.name}${m.dose ? ` ${m.dose}` : ""}`);
      }
    }
    return Array.from(new Set(list));
  })();

  const activeDevices = (p.devices ?? []).filter((d) => !d.removedAt);
  const devices: DeviceFact[] = activeDevices.map((d) => {
    const t = Date.parse(d.insertedAt ?? "");
    return {
      device: d,
      days: Number.isFinite(t) ? Math.floor((now - t) / 86400000) : null,
      hasIndication: !!d.indication?.trim(),
    };
  });

  const infections = (p.infections ?? []).filter((f) => f.status !== "resolvido" && !f.resolvedAt);
  const cultures = p.cultures ?? [];

  const diagnosisText = [
    ...(p.diagnoses ?? []).map((d) => `${d.label} ${d.detail ?? ""}`),
    p.clinicalHistory ?? "",
  ]
    .join(" · ")
    .toLowerCase();

  const sahCase = /subaracn|hsa|aneurism/.test(diagnosisText);
  const ichCase = /hemorragia intra|hip |hematoma intraparenq|avch|avc hemorr/.test(diagnosisText);
  const strokeCase =
    /avc isqu|avci|isquemia cerebral|infarto cerebral|trombect|tromból|trombol/.test(diagnosisText);
  const tbiCase = /tce|traumatismo cranio|trauma cranio/.test(diagnosisText);
  const seizureCase = /status epilep|crise convuls|epilep/.test(diagnosisText);
  const neuroCase =
    sahCase ||
    ichCase ||
    strokeCase ||
    tbiCase ||
    seizureCase ||
    /neuro|cerebral|encefal|meningite|medula|mielo/.test(diagnosisText);

  const sepsisSuspected =
    infections.length > 0 ||
    /sepse|choque séptico|choque septico|sepsis/.test(diagnosisText) ||
    !!s.infection?.trim();
  const ardsSuspected =
    /sdra|ards|síndrome do desconforto|sindrome do desconforto/.test(diagnosisText) ||
    (pfRatio != null && pfRatio < 300 && invasiveVent);

  const gcs = NUM(p.wfns?.gcs ?? p.gcs?.total ?? s.glasgow);
  const gcsHistory = (p.sofaAssessments ?? [])
    .slice()
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .map((a) => NUM(a.inputs?.gcsTotal))
    .filter((v): v is number => v != null);
  const gcsPrevious = gcsHistory.find((v) => v !== gcs) ?? null;

  const crclResult = creatinineClearance(p);

  // ---- pontos de dados classificados ----
  push(points, "pam", "Pressão arterial média", NUM(s.pam), "mmHg", "hemodinamica");
  push(points, "pas", "Pressão sistólica", NUM(s.pas), "mmHg", "hemodinamica");
  push(points, "pad", "Pressão diastólica", NUM(s.pad), "mmHg", "hemodinamica");
  push(points, "fc", "Frequência cardíaca máxima", NUM(s.fcMax), "bpm", "hemodinamica");
  push(points, "fr", "Frequência respiratória", NUM(s.fr), "ipm", "ventilacao");
  push(points, "spo2", "Saturação de oxigênio", NUM(s.spo2), "%", "ventilacao");
  push(points, "temp", "Temperatura máxima", NUM(s.tempMax ?? s.temp), "°C", "infeccao");
  push(points, "glicemia", "Glicemia", NUM(s.glicemia), "mg/dL", "endocrino");
  push(points, "gcs", "Escala de coma de Glasgow (WFNS)", gcs, "", "neurocritico");
  push(points, "rass", "RASS", NUM(s.rass), "", "dor_sedacao_delirium");
  push(
    points,
    "pic",
    "Pressão intracraniana",
    picExam.value,
    "mmHg",
    "neurocritico",
    "informado",
    picExam.at,
  );
  push(points, "diurese_h", "Diurese horária", NUM(s.diureseHoraria), "mL/h", "renal");
  push(points, "diurese_24", "Diurese em 24 h", NUM(s.diurese24 ?? s.diurese), "mL", "renal");
  push(points, "balanco", "Balanço hídrico", NUM(s.balancoHidrico), "mL", "renal");
  push(
    points,
    "creat",
    "Creatinina",
    creat.value,
    creat.unit ?? "mg/dL",
    "renal",
    "informado",
    creat.at,
  );
  push(
    points,
    "lactato",
    "Lactato",
    lactate.value,
    lactate.unit ?? "mmol/L",
    "sepse",
    "informado",
    lactate.at,
  );
  push(points, "hb", "Hemoglobina", hb.value, hb.unit ?? "g/dL", "transfusao", "informado", hb.at);
  push(
    points,
    "plaq",
    "Plaquetas",
    plaq.value,
    plaq.unit ?? "/mm³",
    "transfusao",
    "informado",
    plaq.at,
  );
  push(points, "pao2", "PaO2", pao2.value, "mmHg", "ventilacao", "informado", pao2.at);
  push(points, "paco2", "PaCO2", paco2.value, "mmHg", "ventilacao", "informado", paco2.at);
  push(points, "ph", "pH arterial", ph.value, "", "ventilacao", "informado", ph.at);
  push(points, "na", "Sódio", sodio.value, "mEq/L", "renal", "informado", sodio.at);
  push(points, "k", "Potássio", potassio.value, "mEq/L", "renal", "informado", potassio.at);
  push(points, "fio2", "FiO2", fio2, "%", "ventilacao");
  push(points, "peep", "PEEP", peep, "cmH2O", "ventilacao");
  push(points, "vt", "Volume corrente", vt, "mL", "ventilacao");
  push(
    points,
    "vt_kg",
    "Volume corrente por peso predito",
    vtPerKg,
    "mL/kg",
    "ventilacao",
    "calculado",
  );
  push(points, "plateau", "Pressão de platô", plateau, "cmH2O", "ventilacao");
  push(
    points,
    "driving",
    "Driving pressure",
    drivingPressure,
    "cmH2O",
    "ventilacao",
    NUM(pv?.drivingPressure) != null ? "informado" : "calculado",
  );
  push(points, "pf", "Relação PaO2/FiO2", pfRatio, "", "ventilacao", "calculado");
  push(points, "pbw", "Peso corporal predito", predictedWeight, "kg", "ventilacao", "calculado");
  push(
    points,
    "crcl",
    "Depuração de creatinina (Cockcroft-Gault)",
    crclResult?.value ?? null,
    "mL/min",
    "renal",
    "calculado",
    crclResult?.takenAt,
  );

  points.push({
    key: "vent",
    label: "Suporte ventilatório",
    value: ventText || "DADO NÃO INFORMADO",
    domain: "ventilacao",
    provenance: ventText ? "informado" : "nao_informado",
  });
  points.push({
    key: "dva",
    label: "Vasopressores / inotrópicos",
    value: vasopressors.length ? vasopressors.join(" · ") : "nenhum registrado",
    domain: "hemodinamica",
    provenance: vasopressors.length ? "informado" : "inferido",
    note: vasopressors.length ? undefined : "Ausência de registro tratada como sem vasopressor.",
  });
  points.push({
    key: "atb",
    label: "Antimicrobianos ativos",
    value: antimicrobials.length
      ? antimicrobials.map((m) => m.name).join(" · ")
      : "nenhum registrado",
    domain: "infeccao",
    provenance: antimicrobials.length ? "informado" : "inferido",
  });
  points.push({
    key: "devices",
    label: "Dispositivos invasivos em uso",
    value: devices.length
      ? devices
          .map((d) => `${d.device.typeCode}${d.days != null ? ` (${d.days} d)` : ""}`)
          .join(" · ")
      : "nenhum registrado",
    domain: "dispositivos",
    provenance: devices.length ? "informado" : "inferido",
  });
  points.push({
    key: "dieta",
    label: "Dieta",
    value: s.dieta || "DADO NÃO INFORMADO",
    domain: "nutricao",
    provenance: s.dieta ? "informado" : "nao_informado",
  });
  points.push({
    key: "vte",
    label: "Tromboprofilaxia",
    value: vteProphylaxis ? "identificada nos registros" : "não identificada",
    domain: "trombose",
    provenance: vteProphylaxis ? "informado" : "nao_informado",
  });

  return {
    patient: p,
    points,
    weightKg,
    heightCm,
    predictedWeight,
    pam: NUM(s.pam),
    pas: NUM(s.pas),
    pad: NUM(s.pad),
    fcMax: NUM(s.fcMax),
    fr: NUM(s.fr),
    spo2: NUM(s.spo2),
    tempMax: NUM(s.tempMax ?? s.temp),
    glicemia: NUM(s.glicemia),
    balanco: NUM(s.balancoHidrico),
    gcs,
    gcsPrevious,
    rass: NUM(s.rass),
    pic: picExam.value,
    diureseHoraria: NUM(s.diureseHoraria),
    diurese24: NUM(s.diurese24 ?? s.diurese),
    creat,
    crcl: crclResult?.value ?? null,
    ureia: ureia.value,
    lactate,
    hb,
    plaq,
    pao2,
    paco2,
    ph,
    sodio,
    potassio,
    inr,
    bilirrubina,
    ventText,
    invasiveVent,
    noninvasiveSupport,
    fio2,
    peep,
    vt,
    vtPerKg,
    plateau,
    drivingPressure,
    pfRatio,
    vasopressors,
    activeMeds,
    antimicrobials,
    maxAtbDays,
    sedatives,
    benzodiazepines,
    vteProphylaxis,
    insulin,
    hasInfectionFocus: infections.length > 0,
    infectionLabels: infections.map((f) => `${f.site} (${f.status})`),
    culturesCount: cultures.length,
    positiveCultures: cultures.filter((c) => /positiv/i.test(c.result ?? "") || !!c.organism)
      .length,
    devices,
    diet: s.dieta ?? "",
    dietSuspended: /jejum|suspens|zero|npo/i.test(s.dieta ?? ""),
    residuoGastrico: NUM(s.residuoGastrico),
    painAssessed: /cpot|bps|eva |escala de dor|nrs/.test(texts),
    deliriumAssessed: /cam-icu|cam icu|icdsc|delirium/.test(texts),
    sbtAssessed: /tre|teste de respiração|respiração espontânea|desmame|sbt|sat/.test(texts),
    mobilityAssessed: /mobiliz|fisioterapia|sedestação|deambul|reabilit/.test(texts),
    familyAssessed: /famíl|familia|comunicação com|boletim|conferência familiar/.test(texts),
    diagnosisText,
    neuroCase,
    sahCase,
    ichCase,
    strokeCase,
    tbiCase,
    seizureCase,
    sepsisSuspected,
    ardsSuspected,
    daysICU: NUM(p.daysICU),
    goalsOfCareRegistered:
      !!p.advanceDirective?.intubation ||
      !!p.advanceDirective?.resuscitation ||
      (p.goals ?? []).length > 0,
  };
}

/** Dados faltantes relevantes do dataset (para o bloco DADOS FALTANTES). */
export function missingFromFacts(f: Facts) {
  const out: { key: string; label: string; impact: string; domain: Domain }[] = [];
  const add = (key: string, label: string, impact: string, domain: Domain) =>
    out.push({ key, label, impact, domain });

  if (f.lactate.value == null)
    add(
      "lactato",
      "Lactato",
      "Sem lactato não é possível avaliar hipoperfusão e resposta à ressuscitação.",
      "sepse",
    );
  else if (f.lactate.count < 2)
    add(
      "lactato_serie",
      "Lactato seriado",
      "Um único valor não permite avaliar clareamento.",
      "sepse",
    );
  if (f.pao2.value == null)
    add(
      "gasometria",
      "Gasometria arterial",
      "Sem PaO2/PaCO2 não é possível calcular PaO2/FiO2 nem avaliar troca gasosa.",
      "ventilacao",
    );
  if (f.invasiveVent && f.plateau == null)
    add(
      "plateau",
      "Pressão de platô",
      "Sem platô não é possível confirmar segurança da ventilação protetora.",
      "ventilacao",
    );
  if (f.invasiveVent && f.vt == null)
    add(
      "vt",
      "Volume corrente",
      "Sem volume corrente não é possível checar mL/kg de peso predito.",
      "ventilacao",
    );
  if (f.predictedWeight == null)
    add(
      "altura",
      "Altura",
      "Sem altura não é possível calcular o peso predito e o volume corrente-alvo.",
      "ventilacao",
    );
  if (f.diureseHoraria == null && f.diurese24 == null)
    add(
      "diurese",
      "Diurese",
      "Sem débito urinário não é possível estadiar lesão renal aguda por diurese.",
      "renal",
    );
  if (f.creat.value == null)
    add(
      "creatinina",
      "Creatinina",
      "Sem creatinina não há estadiamento renal nem ajuste de dose.",
      "renal",
    );
  if (f.rass == null)
    add(
      "rass",
      "RASS",
      "Sem RASS não é possível avaliar profundidade de sedação.",
      "dor_sedacao_delirium",
    );
  if (!f.painAssessed)
    add(
      "dor",
      "Avaliação de dor (CPOT/BPS)",
      "Sem escala de dor a analgesia não pode ser guiada.",
      "dor_sedacao_delirium",
    );
  if (!f.deliriumAssessed)
    add(
      "delirium",
      "Rastreio de delirium (CAM-ICU/ICDSC)",
      "Sem rastreio o delirium fica subdiagnosticado.",
      "dor_sedacao_delirium",
    );
  if (f.culturesCount === 0 && (f.antimicrobials.length > 0 || f.hasInfectionFocus))
    add(
      "culturas",
      "Culturas",
      "Sem culturas não é possível descalonar com segurança.",
      "infeccao",
    );
  if (f.gcs == null)
    add(
      "gcs",
      "Escala de coma de Glasgow",
      "Sem Glasgow não é possível avaliar o nível de consciência nem compor escores.",
      "neurocritico",
    );
  if (!f.goalsOfCareRegistered)
    add(
      "metas",
      "Metas de cuidado / diretivas",
      "Sem metas registradas as decisões de limite terapêutico ficam sem referência.",
      "paliativo",
    );
  return out;
}
