import type {
  Conduct,
  ExamRow,
  ImagingExam,
  InvasiveDevice,
  Medication,
  Patient,
  TimelineEvent,
} from "@/data/patients";

export type SevenColumnSuggestion = { label: string; detail: string };

const clean = (value: string) =>
  value.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim().replace(/[;,.]+$/, "");

const headings = [
  /\b(?:identifica[çc][ãa]o|dados\s+do\s+paciente)\b/i,
  /\b(?:diagn[oó]sticos?|hip[oó]teses?\s+diagn[oó]sticas?|\bhd\b)\b/i,
  /\b(?:invas[oõ]es?|dispositivos?|acessos?)\b/i,
  /\b(?:medica[çc][õo]es?|medicamentos?|prescri[çc][ãa]o)\b/i,
  /\b(?:exames?\s+(?:laboratoriais?|de\s+imagem)|laborat[oó]rio|imagem)\b/i,
  /\b(?:gasometria|balan[çc]o\s+h[ií]drico|\bbh\b)\b/i,
  /\b(?:condutas?|plano(?:\s+terap[eê]utico)?|pend[eê]ncias?)\b/i,
];

const section = (text: string, names: RegExp[]) => {
  const rows = text.split("\n");
  const start = rows.findIndex((row) => names.some((name) => name.test(row)));
  if (start < 0) return "";
  const rest = rows.slice(start + 1);
  const end = rest.findIndex((row) => headings.some((heading) => heading.test(row)));
  return rest.slice(0, end < 0 ? undefined : end).join("\n");
};

const rows = (text: string) =>
  text
    .split("\n")
    .map((row) => clean(row.replace(/^\s*(?:[-–—•▪◦]+|\d+[.)])\s*/, "")))
    .filter((row) => row.length >= 3 && row.length <= 500);

const unique = (values: string[]) =>
  values.filter(
    (value, index, all) =>
      all.findIndex((other) => other.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR")) === index,
  );

const valueFor = (text: string, expression: RegExp) => clean(expression.exec(text)?.[1] ?? "");

const deviceDate = (source: string, fallback: string) => {
  const match = source.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (!match) return { value: fallback, known: false };
  const day = Number(match[1]);
  const month = Number(match[2]);
  const current = new Date(fallback);
  const providedYear = match[3] ? Number(match[3].length === 2 ? "20" + match[3] : match[3]) : current.getFullYear();
  const parsed = new Date(providedYear, month - 1, day, current.getHours(), current.getMinutes(), current.getSeconds());
  if (parsed.getFullYear() !== providedYear || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return { value: fallback, known: false };
  return { value: parsed.toISOString(), known: true };
};

const normaliseRoute = (route: string) => {
  const value = route.toUpperCase().replace(/[.\s]/g, "");
  if (/^(?:EV|IV|E\/V|I\/V|ENDOVENOSO|INTRAVENOSO)$/.test(value)) return "EV";
  if (/^(?:VO|V\/O|ORAL)$/.test(value)) return "VO";
  if (/^(?:SC|S\/C|SUBCUT[ÂA]NEO)$/.test(value)) return "SC";
  if (/^(?:IM|I\/M|INTRAMUSCULAR)$/.test(value)) return "IM";
  if (/^(?:SNE|SNG|CNE|GTT|SONDA)$/.test(value)) return "CNE";
  if (/^(?:SL|SUBLINGUAL)$/.test(value)) return "SL";
  if (/^(?:INALAT[ÓO]RIA|NEBULIZA[ÇC][ÃA]O|NEB)$/.test(value)) return "INALATÓRIA";
  return "";
};

const DEVICE_RULES: Array<{
  code: string;
  category: InvasiveDevice["category"];
  label: string;
  expression: RegExp;
  site: string;
}> = [
  { code: "CVC_JUG", category: "venous_central", label: "CVC jugular", expression: /\b(?:cvc|cateter\s+(?:venoso\s+)?central)\s*(?:ji|jug|jugular)\b|\bcvc\s*(?:ji|jug(?:ular)?)\b/i, site: "Jugular interna" },
  { code: "CVC_SUB", category: "venous_central", label: "CVC subclávia", expression: /\b(?:cvc|cateter\s+(?:venoso\s+)?central)\s*(?:sub|scl|subcl[aá]via)\b|\bcvc\s*(?:sub|scl)\b/i, site: "Subclávia" },
  { code: "CVC_FEM", category: "venous_central", label: "CVC femoral", expression: /\b(?:cvc|cateter\s+(?:venoso\s+)?central)\s*(?:fem|femoral)\b|\bcvc\s*fem\b/i, site: "Femoral" },
  { code: "PICC", category: "venous_central", label: "PICC", expression: /\bpicc\b|cateter\s+central\s+de\s+inser[çc][ãa]o\s+perif[eé]rica/i, site: "Braquial" },
  { code: "HD_CAT", category: "venous_central", label: "Cateter de hemodiálise", expression: /\b(?:cat(?:eter)?\s*(?:de\s*)?(?:hd|hemodi[aá]lise)|cdl)\b/i, site: "Jugular interna" },
  { code: "SWAN", category: "venous_central", label: "Swan-Ganz", expression: /\b(?:swan(?:[-\s]?ganz)?|cateter\s+de\s+art[eé]ria\s+pulmonar)\b/i, site: "Jugular interna" },
  { code: "PVP", category: "venous_peripheral", label: "Acesso periférico", expression: /\b(?:pvp|avp|acesso\s+(?:venoso\s+)?perif[eé]rico|jelco|abocath)\b/i, site: "Antebraço" },
  { code: "MIDLINE", category: "venous_peripheral", label: "Midline", expression: /\bmidline\b/i, site: "Braquial" },
  { code: "PAI_RAD", category: "arterial", label: "PA invasiva radial", expression: /\b(?:pai|pam\s+invasiva|lai|linha\s+arterial|ai)\b.*\b(?:radial|rad)\b|\b(?:pai|ai)\s*rad\b/i, site: "Radial" },
  { code: "PAI_FEM", category: "arterial", label: "PA invasiva femoral", expression: /\b(?:pai|pam\s+invasiva|lai|linha\s+arterial|ai)\b.*\b(?:femoral|fem)\b|\b(?:pai|ai)\s*fem\b/i, site: "Femoral" },
  { code: "PAI_BRA", category: "arterial", label: "PA invasiva braquial", expression: /\b(?:pai|pam\s+invasiva|lai|linha\s+arterial|ai)\b.*\b(?:braquial|braq)\b/i, site: "Braquial" },
  { code: "TOT", category: "airway", label: "Tubo orotraqueal", expression: /\b(?:tot|iot|cot|tubo\s+orotraqueal|intubad[oa])\b/i, site: "Oral" },
  { code: "TNT", category: "airway", label: "Tubo nasotraqueal", expression: /\b(?:tnt|tubo\s+nasotraqueal)\b/i, site: "Nasal" },
  { code: "TQT", category: "airway", label: "Traqueostomia", expression: /\b(?:tqt|traqueostomia)\b/i, site: "Percutânea" },
  { code: "SNG", category: "enteral", label: "Sonda nasogástrica", expression: /\b(?:sng|sonda\s+nasog[aá]strica)\b/i, site: "Nasal" },
  { code: "SNE", category: "enteral", label: "Sonda nasoenteral", expression: /\b(?:sne|cne|sonda|cateter)\s*(?:nasoenteral|nasoent[eé]rico)\b|\b(?:sne|cne)\b/i, site: "Nasal" },
  { code: "SOE", category: "enteral", label: "Sonda oroenteral", expression: /\b(?:soe|sonda\s+oroenteral)\b/i, site: "Oral" },
  { code: "GTT", category: "enteral", label: "Gastrostomia", expression: /\b(?:gtt|peg|gastrostomia)\b/i, site: "Abdome" },
  { code: "JTT", category: "enteral", label: "Jejunostomia", expression: /\b(?:jtt|jejunostomia)\b/i, site: "Abdome" },
  { code: "SVD", category: "urinary", label: "Sonda vesical de demora", expression: /\b(?:svd|sonda\s+vesical(?:\s+de\s+demora)?|foley)\b/i, site: "Uretral" },
  { code: "SVA", category: "urinary", label: "Sonda vesical de alívio", expression: /\b(?:sva|sonda\s+vesical\s+de\s+al[ií]vio)\b/i, site: "Uretral" },
  { code: "NEFRO", category: "urinary", label: "Nefrostomia", expression: /\b(?:nefrostomia|nefro)\b/i, site: "Flanco" },
  { code: "DRT", category: "drain", label: "Dreno torácico", expression: /\b(?:dreno\s+(?:tor[aá]cico|pleural)|drt)\b/i, site: "Hemitórax" },
  { code: "PVAC", category: "drain", label: "Portovac", expression: /\b(?:portovac|p-?vac)\b/i, site: "Outro" },
  { code: "HVAC", category: "drain", label: "Hemovac", expression: /\bhemovac\b/i, site: "Outro" },
  { code: "JP", category: "drain", label: "Jackson-Pratt", expression: /\b(?:jackson[-\s]?pratt|\bjp\b)\b/i, site: "Outro" },
  { code: "DVE", category: "neuro", label: "Derivação ventricular externa", expression: /\b(?:dve|deriva[çc][ãa]o\s+ventricular)\b/i, site: "Frontal" },
  { code: "DLE", category: "neuro", label: "Derivação lombar externa", expression: /\b(?:dle|deriva[çc][ãa]o\s+lombar)\b/i, site: "Lombar" },
  { code: "ECMO_VV", category: "advanced", label: "ECMO veno-venosa", expression: /\b(?:ecmo\s*(?:vv|veno[-\s]?venosa))\b/i, site: "Femoral" },
  { code: "ECMO_VA", category: "advanced", label: "ECMO veno-arterial", expression: /\b(?:ecmo\s*(?:va|veno[-\s]?arterial))\b/i, site: "Femoral" },
  { code: "IABP", category: "advanced", label: "Balão intra-aórtico", expression: /\b(?:iabp|bia|bal[aã]o\s+intra[-\s]?a[oó]rtico)\b/i, site: "Femoral" },
  { code: "MPT", category: "advanced", label: "Marca-passo temporário", expression: /\b(?:mpt|marca[-\s]?passo\s+tempor[aá]rio)\b/i, site: "Jugular interna" },
];

const LAB_RULES: Array<{ label: string; expression: RegExp; unit: string; code: string }> = [
  { label: "Hemoglobina", expression: /(?:\bhb\b|hemoglobina)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "g/dL", code: "HB" },
  { label: "Leucócitos", expression: /(?:leuc[oó]citos?|\bwbc\b)\s*[:= -]?\s*(\d{3,6})/i, unit: "/mm³", code: "WBC" },
  { label: "Plaquetas", expression: /(?:plaquetas?|\bplt\b)\s*[:= -]?\s*(\d{3,6})/i, unit: "/mm³", code: "PLT" },
  { label: "Creatinina", expression: /(?:creatinina|\bcr\b)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mg/dL", code: "CR" },
  { label: "Ureia", expression: /(?:ureia|ur[eé]ia)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mg/dL", code: "UREIA" },
  { label: "Sódio", expression: /(?:s[oó]dio|\bna\b)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mEq/L", code: "NA" },
  { label: "Potássio", expression: /(?:pot[aá]ssio|\bk\b)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mEq/L", code: "K" },
  { label: "PCR", expression: /(?:\bpcr\b|prote[ií]na\s+c\s+reativa)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mg/L", code: "PCR" },
  { label: "Lactato", expression: /(?:lactato)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mmol/L", code: "LAC" },
  { label: "pH", expression: /(?:\bph\b)\s*[:= -]?\s*(\d(?:[,.]\d{1,3}))/i, unit: "", code: "PH" },
  { label: "PaCO₂", expression: /(?:paco2|pa\s*co2|pco2)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mmHg", code: "PACO2" },
  { label: "PaO₂", expression: /(?:pao2|pa\s*o2|po2)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mmHg", code: "PAO2" },
  { label: "HCO₃⁻", expression: /(?:hco3|bicarbonato)\s*[:= -]?\s*(\d+(?:[,.]\d+)?)/i, unit: "mEq/L", code: "HCO3" },
  { label: "Base excess (BE)", expression: /(?:\bbe\b|base\s+excess)\s*[:= -]?\s*([+-]?\d+(?:[,.]\d+)?)/i, unit: "mEq/L", code: "BE" },
];

export function enrichPatientFromSevenColumns(patient: Patient, text: string) {
  let next = patient;
  const suggestions: SevenColumnSuggestion[] = [];
  const now = new Date().toISOString();
  const date = new Date(now).toLocaleDateString("pt-BR");
  const id = (kind: string, index: number) => kind + "-import-" + Date.now() + "-" + index;

  const diagnosisText = section(text, [/\b(?:diagn[oó]sticos?|hip[oó]teses?\s+diagn[oó]sticas?|\bhd\b)\b/i]);
  const diagnoses = unique(rows(diagnosisText).flatMap((row) => row.split(/[;•]/).map(clean)))
    .filter((label) => label.length >= 3 && !/^sem diagn[oó]stico/i.test(label))
    .slice(0, 12);
  const diagnosisAdditions: TimelineEvent[] = diagnoses
    .filter((label) => !next.diagnoses.some((item) => item.label.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR")))
    .map((label) => ({ date, label, kind: "attention", category: "current" }));
  if (diagnosisAdditions.length) {
    next = { ...next, diagnoses: [...next.diagnoses, ...diagnosisAdditions] };
    suggestions.push({ label: "Diagnósticos", detail: diagnosisAdditions.map((item) => item.label).join("; ") });
  }

  const invasionText = section(text, [/\b(?:invas[oõ]es?|dispositivos?|acessos?)\b/i]) || text;
  const devices: InvasiveDevice[] = [];
  rows(invasionText).forEach((source) => {
    DEVICE_RULES.forEach((rule) => {
      if (!rule.expression.test(source)) return;
      const side = /\b(?:esquerd[oa]|esq\.?|e)\b/i.test(source)
        ? "E"
        : /\b(?:direit[oa]|dir\.?|d)\b/i.test(source)
          ? "D"
          : undefined;
      const site = rule.site === "Oral" || rule.site === "Nasal" || rule.site === "Uretral" || rule.site === "Abdome" || rule.site === "Lombar" || rule.site === "Outro"
        ? rule.site
        : rule.site + (side ? " " + side : "");
      const duplicate = [...(next.devices || []), ...devices].some((item) => item.typeCode === rule.code && item.site === site);
      if (duplicate) return;
      const size = valueFor(source, /(?:n[ºo]?|fr|calibre|tamanho|gauge)\s*[:# -]?\s*(\d+(?:[,.]\d+)?(?:\s*vias?)?)/i);
      const inserted = deviceDate(source, now);
      devices.push({
        id: id("device", devices.length),
        category: rule.category,
        typeCode: rule.code,
        site,
        ...(side ? { side } : {}),
        ...(size ? { size } : {}),
        insertedAt: inserted.value,
        notes: "Importado de documento: " + source.slice(0, 180) + (inserted.known ? ". Data de inserção identificada na linha." : ". Data de inserção não informada."),
      });
    });
  });
  if (devices.length) {
    next = { ...next, devices: [...(next.devices || []), ...devices] };
    suggestions.push({ label: "Invasões", detail: devices.map((item) => DEVICE_RULES.find((rule) => rule.code === item.typeCode)?.label || item.typeCode).join("; ") });
  }

  const medicationText = section(text, [/\b(?:medica[çc][õo]es?|medicamentos?|prescri[çc][ãa]o)\b/i]);
  const medicationRows = rows(medicationText);
  const candidateMedicationRows = medicationRows.length
    ? medicationRows
    : rows(text).filter((row) => /\b(?:ev|e\/v|iv|i\/v|vo|v\.?o\.?|sc|s\/c|im|i\/m|sne|sng|cne|gtt|bi|bic|bomba(?:\s+de\s+infus[aã]o)?)\b/i.test(row));
  const medications: Medication[] = [];
  candidateMedicationRows.forEach((row) => {
    if (/^(?:sem|nenhum|medica[çc][õo]es?|prescri[çc][ãa]o)\b/i.test(row)) return;
    const dose = valueFor(row, /\b(\d+(?:[,.]\d+)?\s*(?:mcg|mg|g|ui|u|gotas?|comprimidos?))\b/i);
    const routeFound = valueFor(row, /\b(EV|E\/V|IV|I\/V|VO|V\.?O\.?|SC|S\/C|IM|I\/M|SL|SNE|SNG|CNE|GTT|TQT|INALAT[ÓO]RIA|NEBULIZA[ÇC][ÃA]O)\b/i);
    const pumpMatch = row.match(/\b(?:bi|bic|bomba(?:\s+de\s+infus[aã]o)?|infus[aã]o\s+cont[ií]nua)\b/i);
    const range = row.match(/\b(\d+(?:[,.]\d+)?)\s*(?:a|at[eé]|[-–])\s*(\d+(?:[,.]\d+)?)\s*m?l\s*\/?\s*h\b/i);
    const fixedRate = range ? undefined : valueFor(row, /\b(\d+(?:[,.]\d+)?)\s*m?l\s*\/?\s*h\b/i);
    const infusion = Boolean(pumpMatch || range || fixedRate);
    const frequency = valueFor(row, /\b(\d{1,2}\s*\/\s*\d{1,2}\s*h|\d+\s*x\s*\/\s*dia|1\s*x\s*\/\s*dia|cont[ií]nu[oa]|se\s+necess[aá]rio)\b/i);
    const positions = [
      row.search(/\b\d+(?:[,.]\d+)?\s*(?:mcg|mg|g|ui|u|gotas?|comprimidos?)\b/i),
      row.search(/\b(?:EV|E\/V|IV|I\/V|VO|V\.?O\.?|SC|S\/C|IM|I\/M|SL|SNE|SNG|CNE|GTT|TQT|INALAT[ÓO]RIA|NEBULIZA[ÇC][ÃA]O)\b/i),
      row.search(/\b(?:bi|bic|bomba(?:\s+de\s+infus[aã]o)?|infus[aã]o\s+cont[ií]nua)\b/i),
      row.search(/\b\d+(?:[,.]\d+)?\s*(?:a|at[eé]|[-–])\s*\d+(?:[,.]\d+)?\s*m?l\s*\/?\s*h\b/i),
      row.search(/\b(?:\d{1,2}\s*\/\s*\d{1,2}\s*h|\d+\s*x\s*\/\s*dia|cont[ií]nu[oa])\b/i),
    ].filter((position) => position >= 0).sort((a, b) => a - b);
    const name = clean((positions.length ? row.slice(0, positions[0]) : row).replace(/^(?:medicamentos?|prescri[çc][ãa]o|em\s+uso)\s*[: -]?\s*/i, "").replace(/[,:;\-]+$/, ""));
    if (name.length < 3 || name.length > 100 || /^(?:dose|via|hor[aá]rio)$/i.test(name) || [...next.medications, ...medications].some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) return;
    const route = normaliseRoute(routeFound) || (infusion ? "BI" : "NÃO INFORMADA");
    const antibiotic = /cef|penicil|cilina|floxacin|oxacil|vancom|meropen|piperac|azitro|clinda|metronidazol|polimix/i.test(name);
    const rangeMin = range ? Number(range[1].replace(",", ".")) : undefined;
    const rangeMax = range ? Number(range[2].replace(",", ".")) : undefined;
    const rate = fixedRate ? Number(fixedRate.replace(",", ".")) : undefined;
    medications.push({
      name,
      dose: dose || "NÃO INFORMADA",
      route,
      freq: frequency || (infusion ? "CONTÍNUA" : "NÃO INFORMADA"),
      start: date,
      kind: "neutral",
      active: true,
      class: antibiotic ? "antibiotic" : infusion ? "pump" : route === "EV" ? "iv" : route === "IM" ? "im" : route === "SC" ? "sc" : route === "VO" ? "oral" : route === "CNE" ? "cne" : route === "INALATÓRIA" ? "inhaled" : "oral",
      ...(infusion ? { category: "outro" as const } : {}),
      ...(range ? { mlPerHourMin: rangeMin, mlPerHourMax: rangeMax, doseRangeUnit: "mL/h" } : {}),
      ...(rate !== undefined ? { mlPerHour: rate, doseRangeUnit: "mL/h" } : {}),
      ...(antibiotic ? { isAntibiotic: true, category: "antimicrobiano" as const } : {}),
    });
  });
  if (medications.length) {
    next = { ...next, medications: [...next.medications, ...medications] };
    suggestions.push({ label: "Medicamentos", detail: medications.map((item) => item.name).join("; ") });
  }

  const laboratoryText = [section(text, [/\b(?:exames?\s+(?:laboratoriais?|de\s+imagem)|laborat[oó]rio|imagem)\b/i]), section(text, [/\b(?:gasometria|balan[çc]o\s+h[ií]drico|\bbh\b)\b/i]), text].filter(Boolean).join("\n");
  const exams: ExamRow[] = [];
  LAB_RULES.forEach((rule) => {
    const value = valueFor(laboratoryText, rule.expression);
    if (!value || next.exams.some((item) => item.label.toLocaleLowerCase("pt-BR") === rule.label.toLocaleLowerCase("pt-BR"))) return;
    const valueNum = Number(value.replace(",", "."));
    exams.push({
      label: rule.label,
      value,
      unit: rule.unit,
      trend: "flat",
      code: rule.code,
      takenAt: now,
      ...(Number.isFinite(valueNum) ? { valueNum } : {}),
    });
  });
  if (exams.length) {
    next = { ...next, exams: [...next.exams, ...exams] };
    suggestions.push({ label: "Exames / Gasometria", detail: exams.map((item) => item.label + ": " + item.value + (item.unit ? " " + item.unit : "")).join("; ") });
  }

  const imagingText = section(text, [/\b(?:exames?\s+(?:laboratoriais?|de\s+imagem)|laborat[oó]rio|imagem)\b/i]);
  const imaging: ImagingExam[] = [];
  rows(imagingText).filter((row) => /\b(?:tc|tomografia|rx|radiografia|usg|ultrassom|eco(?:cardio)?|rm|resson[aâ]ncia|doppler)\b/i.test(row)).forEach((row, index) => {
    const modality = /\b(?:tc|tomografia)\b/i.test(row) ? "TC" : /\b(?:rx|radiografia)\b/i.test(row) ? "RX" : /\b(?:usg|ultrassom)\b/i.test(row) ? "USG" : /\b(?:eco(?:cardio)?|ecocardiograma)\b/i.test(row) ? "ECO" : /\b(?:rm|resson[aâ]ncia)\b/i.test(row) ? "RM" : "ECODOPPLER";
    const after = clean(row.replace(/.*?\b(?:tc|tomografia|rx|radiografia|usg|ultrassom|eco(?:cardio)?|ecocardiograma|rm|resson[aâ]ncia|doppler)\b\s*(?:de|do|da)?\s*/i, ""));
    const parts = after.split(/[:—–-]/);
    const region = clean(parts[0]) || "NÃO INFORMADA";
    if (next.imaging?.some((item) => item.modality === modality && item.region.toLocaleLowerCase("pt-BR") === region.toLocaleLowerCase("pt-BR"))) return;
    const summary = clean(parts.slice(1).join(" "));
    const conclusion = /cr[ií]tic|hemorrag|pneumot[oó]rax|tromboembol/i.test(row) ? "critico" : /solicit|pendente|aguard/i.test(row) ? "pendente" : "alterado";
    imaging.push({ id: id("imaging", index), modality, region, performedAt: now, ...(summary ? { summary } : {}), conclusion, status: conclusion === "pendente" ? "solicitado" : "concluido" });
  });
  if (imaging.length) {
    next = { ...next, imaging: [...(next.imaging || []), ...imaging] };
    suggestions.push({ label: "Exames de imagem", detail: imaging.map((item) => item.modality + " " + item.region).join("; ") });
  }

  const balance = valueFor(text, /(?:balan[çc]o\s+h[ií]drico|\bbh\b)\s*[:= -]?\s*([+-]?\d{1,5})\s*m?l?/i);
  const diet = valueFor(text, /(?:^|\n)\s*dieta\s*[: -]\s*([^\n]{3,180})/im);
  if (balance || diet) {
    const patch: Partial<Patient["state"]> = {};
    if (balance) patch.balancoHidrico = Number(balance);
    if (diet) patch.dieta = diet;
    next = { ...next, state: { ...next.state, ...patch } };
    suggestions.push({ label: "Balanço hídrico", detail: [balance ? "BH " + balance + " mL" : "", diet ? "Dieta: " + diet : ""].filter(Boolean).join(" · ") });
  }

  const conductText = section(text, [/\b(?:condutas?|plano(?:\s+terap[eê]utico)?|pend[eê]ncias?)\b/i]);
  const conductItems = unique(rows(conductText)).filter((item) => !/^(?:sem|condutas?|plano|pend[eê]ncias?)\b/i).slice(0, 20);
  if (conductItems.length) {
    const previous = next.conducts.find((item) => item.text === "Condutas importadas");
    const newItems = conductItems.filter((item) => !previous?.subItems?.some((subItem) => subItem.text.toLocaleLowerCase("pt-BR") === item.toLocaleLowerCase("pt-BR"))).map((text) => ({ text, date: now, done: false }));
    if (newItems.length) {
      const conduct: Conduct = { team: "Médica", text: "Condutas importadas", system: "other", startedAt: now, done: false, subItems: newItems };
      next = { ...next, conducts: previous ? next.conducts.map((item) => item === previous ? { ...item, subItems: [...(item.subItems || []), ...newItems] } : item) : [...next.conducts, conduct] };
      suggestions.push({ label: "Condutas", detail: newItems.map((item) => item.text).join("; ") });
    }
  }

  return { patient: next, suggestions };
}
