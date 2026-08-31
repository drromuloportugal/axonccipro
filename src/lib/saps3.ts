import type { Patient } from "@/data/patients";

// ============================================================================
// SAPS 3 — motor de cálculo integrado ao prontuário
// ============================================================================

export type Saps3Group = 1 | 2 | 3;

export type Saps3Source =
  | "Cadastro" | "Internação" | "Sinais vitais" | "Laboratório" | "Gasometria"
  | "Neurologia" | "Medicações" | "Ventilação" | "História clínica" | "Infecção"
  | "Manual" | "Ausente";

export interface Saps3Item {
  key: string;
  group: Saps3Group;
  label: string;
  /** valor observado formatado (com unidade) */
  value: string | null;
  /** valor bruto usado (número/string/lista) */
  raw?: number | string | string[] | null;
  category: string | null;
  points: number | null;
  source: Saps3Source;
  at?: string;
  manual: boolean;
  missing: boolean;
  unit?: string;
  warning?: string;
}

export interface Saps3Result {
  items: Saps3Item[];
  filled: number;
  total: number;
  autoCount: number;
  manualCount: number;
  missing: Saps3Item[];
  complete: boolean;
  /** soma parcial (inclui offset) — apenas informativo quando incompleto */
  score: number;
  mortality: number | null;
  groupPoints: { g1: number; g2: number; g3: number; offset: number };
}

export const SAPS3_OFFSET = 16;

export function saps3Mortality(score: number): number {
  const logit = -32.6659 + Math.log(score + 20.5958) * 7.3068;
  const p = Math.exp(logit) / (1 + Math.exp(logit));
  return p * 100;
}

// ---------------------------------------------------------------- utilidades

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Busca um exame do prontuário pelo rótulo (match tolerante). */
function findExam(p: Patient, keys: string[]): { n: number; at?: string; label: string } | null {
  for (const e of p.exams ?? []) {
    const l = norm(e.label);
    if (keys.some((k) => l.includes(k))) {
      const n = e.valueNum ?? num(e.value);
      if (n !== null) return { n, at: e.takenAt, label: e.label };
    }
  }
  return null;
}

const VASOACTIVES = [
  "noradrenalina", "norepinefrina", "adrenalina", "epinefrina",
  "vasopressina", "dopamina", "dobutamina", "terlipressina", "milrinona",
];

export function isOnVasoactive(p: Patient): boolean {
  if (p.state?.dva) return true;
  return (p.medications ?? []).some(
    (m) => m.active !== false && VASOACTIVES.some((v) => norm(m.name || "").includes(v)),
  );
}

export function isOnMechanicalVent(p: Patient): boolean {
  const v = norm(p.state?.vent ?? "");
  if (!v) return false;
  if (v.includes("espontan") || v.includes("ar ambiente") || v.includes("cateter") || v.includes("mascara")) return false;
  return v.includes("vm") || v.includes("pcv") || v.includes("vcv") || v.includes("psv") || v.includes("ventila");
}

function parseBR(d?: string): Date | null {
  if (!d) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim());
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function preIcuDays(p: Patient): number | null {
  const h = parseBR(p.admissionHosp);
  const i = parseBR(p.admissionICU);
  if (!h || !i) return null;
  return Math.max(0, Math.round((i.getTime() - h.getTime()) / 86400000));
}

// ------------------------------------------------------------- classificação

const band = (v: number, cuts: { max?: number; min?: number; label: string; pts: number }[]) => {
  for (const c of cuts) {
    const okMin = c.min === undefined || v >= c.min;
    const okMax = c.max === undefined || v < c.max;
    if (okMin && okMax) return c;
  }
  return cuts[cuts.length - 1];
};

// ------------------------------------------------------------ opções (enums)

export const PRE_ICU_LOCATION = [
  { v: "cc", label: "Centro cirúrgico / sala de recuperação", pts: 0 },
  { v: "ps", label: "Pronto-socorro", pts: 5 },
  { v: "uti", label: "Outra UTI", pts: 7 },
  { v: "enf", label: "Outra enfermaria / unidade", pts: 8 },
];

export const ADMISSION_PLANNING = [
  { v: "programada", label: "Programada", pts: 0 },
  { v: "nao_programada", label: "Não programada", pts: 3 },
];

export const SURGICAL_STATUS = [
  { v: "eletiva", label: "Cirurgia programada", pts: 0 },
  { v: "sem", label: "Sem cirurgia", pts: 5 },
  { v: "emergencia", label: "Cirurgia de emergência", pts: 6 },
];

export const ACUTE_INFECTION = [
  { v: "nenhuma", label: "Nenhuma / outra", pts: 0 },
  { v: "nosocomial", label: "Infecção nosocomial", pts: 4 },
  { v: "respiratoria", label: "Infecção respiratória", pts: 5 },
];

export const COMORBIDITIES = [
  { v: "onco_tto", label: "Tratamento oncológico / imunossupressor", pts: 3 },
  { v: "icc_nyha4", label: "Insuficiência cardíaca crônica NYHA IV", pts: 6 },
  { v: "hemato", label: "Câncer hematológico", pts: 6 },
  { v: "cirrose", label: "Cirrose", pts: 8 },
  { v: "aids", label: "AIDS", pts: 8 },
  { v: "metastatico", label: "Câncer metastático", pts: 11 },
];

export const ADMISSION_REASONS = [
  { v: "ritmo", label: "Cardiovascular — distúrbio do ritmo", pts: -5 },
  { v: "convulsao", label: "Neurológico — convulsão", pts: -4 },
  { v: "choque_hipo", label: "Choque hipovolêmico (hemorrágico ou não)", pts: 3 },
  { v: "choque_septico", label: "Choque séptico", pts: 5 },
  { v: "choque_misto", label: "Choque anafilático, misto ou indefinido", pts: 5 },
  { v: "coma", label: "Coma, estupor, confusão, agitação ou delirium", pts: 4 },
  { v: "deficit_focal", label: "Déficit neurológico focal", pts: 7 },
  { v: "massa_ic", label: "Efeito de massa intracraniano", pts: 10 },
  { v: "abdome", label: "Digestivo — abdome agudo / outros", pts: 3 },
  { v: "pancreatite", label: "Pancreatite grave", pts: 9 },
  { v: "hepatica", label: "Insuficiência hepática", pts: 6 },
];

export type Saps3Manual = Record<string, number | string | string[] | null>;

// ---------------------------------------------------------------- computação

export function computeSaps3(p: Patient): Saps3Result {
  const manual: Saps3Manual = (p.saps3?.manual ?? {}) as Saps3Manual;
  const items: Saps3Item[] = [];

  const push = (i: Saps3Item) => items.push(i);

  const mv = (k: string) => (manual[k] === undefined || manual[k] === null || manual[k] === "" ? null : manual[k]);

  // -------- G1: características do paciente e condição pré-UTI
  // 1. Idade
  {
    const m = num(mv("age"));
    const v = m ?? p.age ?? null;
    const c = v === null ? null : band(v, [
      { max: 40, label: "< 40 anos", pts: 0 },
      { max: 60, label: "40–59 anos", pts: 5 },
      { max: 70, label: "60–69 anos", pts: 9 },
      { max: 75, label: "70–74 anos", pts: 13 },
      { max: 80, label: "75–79 anos", pts: 15 },
      { min: 80, label: "≥ 80 anos", pts: 18 },
    ]);
    push({
      key: "age", group: 1, label: "Idade", unit: "anos",
      value: v === null ? null : `${v} anos`, raw: v,
      category: c?.label ?? null, points: c?.pts ?? null,
      source: m !== null ? "Manual" : v !== null ? "Cadastro" : "Ausente",
      manual: m !== null, missing: v === null,
    });
  }

  // 2. Tempo de internação antes da UTI
  {
    const m = num(mv("preIcuDays"));
    const auto = preIcuDays(p);
    const v = m ?? auto;
    const c = v === null ? null : band(v, [
      { max: 14, label: "< 14 dias", pts: 0 },
      { max: 28, label: "14–27 dias", pts: 6 },
      { min: 28, label: "≥ 28 dias", pts: 7 },
    ]);
    push({
      key: "preIcuDays", group: 1, label: "Internação hospitalar antes da UTI", unit: "dias",
      value: v === null ? null : `${v} dias`, raw: v,
      category: c?.label ?? null, points: c?.pts ?? null,
      source: m !== null ? "Manual" : v !== null ? "Internação" : "Ausente",
      manual: m !== null, missing: v === null,
    });
  }

  // 3. Localização intra-hospitalar antes da UTI
  {
    const m = mv("preIcuLocation") as string | null;
    let autoV: string | null = null;
    const o = norm(p.origin?.type ?? "");
    if (o.includes("pronto")) autoV = "ps";
    else if (o.includes("enfermaria")) autoV = "enf";
    else if (o.includes("centro cirurgico")) autoV = "cc";
    else if (o.includes("hospital") || o.includes("upa")) autoV = "enf";
    const v = m ?? autoV;
    const opt = PRE_ICU_LOCATION.find((x) => x.v === v) ?? null;
    push({
      key: "preIcuLocation", group: 1, label: "Localização antes da UTI",
      value: opt?.label ?? null, raw: v,
      category: opt?.label ?? null, points: opt?.pts ?? null,
      source: m ? "Manual" : v ? "Internação" : "Ausente",
      manual: !!m, missing: !v,
    });
  }

  // 4. Comorbidades
  {
    const m = mv("comorbidities") as string[] | null;
    const auto: string[] = [];
    const dxText = norm((p.diagnoses ?? []).map((d) => d.label).join(" | "));
    if (dxText.includes("cirrose")) auto.push("cirrose");
    if (dxText.includes("aids") || dxText.includes("hiv")) auto.push("aids");
    if (dxText.includes("metasta")) auto.push("metastatico");
    if (dxText.includes("leucemia") || dxText.includes("linfoma") || dxText.includes("mieloma")) auto.push("hemato");
    if (dxText.includes("nyha iv")) auto.push("icc_nyha4");
    if (dxText.includes("quimioterapia") || dxText.includes("imunossup")) auto.push("onco_tto");
    const sel = m ?? (auto.length ? auto : null);
    // regra SAPS 3: considerar a comorbidade de maior pontuação
    const pts = sel === null ? null : sel.length === 0 ? 0
      : Math.max(...sel.map((s) => COMORBIDITIES.find((c) => c.v === s)?.pts ?? 0));
    const labels = (sel ?? []).map((s) => COMORBIDITIES.find((c) => c.v === s)?.label ?? s);
    push({
      key: "comorbidities", group: 1, label: "Comorbidades",
      value: sel === null ? null : labels.length ? labels.join(" · ") : "Nenhuma", raw: sel,
      category: sel === null ? null : labels.length ? `Maior pontuação aplicada` : "Nenhuma",
      points: pts,
      source: m ? "Manual" : sel ? "História clínica" : "Ausente",
      manual: !!m, missing: sel === null,
    });
  }

  // 5. Uso de vasoativo antes da UTI
  {
    const m = mv("vasoactivePre") as string | null;
    const auto = isOnVasoactive(p) ? "sim" : null;
    const v = m ?? auto;
    push({
      key: "vasoactivePre", group: 1, label: "Droga vasoativa antes da UTI",
      value: v === null ? null : v === "sim" ? "Sim" : "Não", raw: v,
      category: v === null ? null : v === "sim" ? "Sim" : "Não",
      points: v === null ? null : v === "sim" ? 3 : 0,
      source: m ? "Manual" : v ? "Medicações" : "Ausente",
      manual: !!m, missing: !v,
    });
  }

  // -------- G2: circunstâncias da admissão
  {
    const m = mv("planning") as string | null;
    const opt = ADMISSION_PLANNING.find((x) => x.v === m) ?? null;
    push({
      key: "planning", group: 2, label: "Admissão na UTI",
      value: opt?.label ?? null, raw: m, category: opt?.label ?? null, points: opt?.pts ?? null,
      source: m ? "Manual" : "Ausente", manual: !!m, missing: !m,
    });
  }
  {
    const m = mv("surgical") as string | null;
    const opt = SURGICAL_STATUS.find((x) => x.v === m) ?? null;
    push({
      key: "surgical", group: 2, label: "Status cirúrgico",
      value: opt?.label ?? null, raw: m, category: opt?.label ?? null, points: opt?.pts ?? null,
      source: m ? "Manual" : "Ausente", manual: !!m, missing: !m,
    });
  }
  {
    const m = mv("infection") as string | null;
    let auto: string | null = null;
    const focos = (p.infections ?? []).filter((f) => !f.resolvedAt);
    if (focos.some((f) => ["PAC", "PAV", "EMPIEMA", "ABSC_PULM"].includes(f.site))) auto = "respiratoria";
    else if (focos.length) auto = "nosocomial";
    const v = m ?? auto;
    const opt = ACUTE_INFECTION.find((x) => x.v === v) ?? null;
    push({
      key: "infection", group: 2, label: "Infecção aguda na admissão",
      value: opt?.label ?? null, raw: v, category: opt?.label ?? null, points: opt?.pts ?? null,
      source: m ? "Manual" : v ? "Infecção" : "Ausente", manual: !!m, missing: !v,
    });
  }
  {
    const m = mv("reasons") as string[] | null;
    const sel = m;
    let pts: number | null = null;
    if (sel) {
      const chosen = sel.map((s) => ADMISSION_REASONS.find((r) => r.v === s)).filter(Boolean) as typeof ADMISSION_REASONS;
      const negs = chosen.filter((c) => c.pts < 0);
      const poss = chosen.filter((c) => c.pts > 0);
      // regra SAPS 3: entre ritmo (-5) e convulsão (-4) conta apenas a pior categoria
      pts = poss.reduce((a, b) => a + b.pts, 0) + (negs.length ? Math.min(...negs.map((n) => n.pts)) : 0);
    }
    push({
      key: "reasons", group: 2, label: "Motivo da admissão na UTI",
      value: sel === null ? null : sel.length
        ? sel.map((s) => ADMISSION_REASONS.find((r) => r.v === s)?.label ?? s).join(" · ")
        : "Nenhum dos listados",
      raw: sel, category: sel === null ? null : `${sel.length} selecionado(s)`, points: pts,
      source: m ? "Manual" : "Ausente", manual: !!m, missing: sel === null,
    });
  }

  // -------- G3: alterações fisiológicas agudas
  const physio = (
    key: string, label: string, unit: string,
    autoVal: number | null, autoSrc: Saps3Source, at: string | undefined,
    cuts: { max?: number; min?: number; label: string; pts: number }[],
    fmt?: (n: number) => string,
  ) => {
    const m = num(mv(key));
    const v = m ?? autoVal;
    const c = v === null ? null : band(v, cuts);
    push({
      key, group: 3, label, unit,
      value: v === null ? null : `${fmt ? fmt(v) : v} ${unit}`.trim(), raw: v,
      category: c?.label ?? null, points: c?.pts ?? null,
      source: m !== null ? "Manual" : v !== null ? autoSrc : "Ausente",
      at: m !== null ? undefined : at,
      manual: m !== null, missing: v === null,
    });
  };

  physio("glasgow", "Escala de coma de Glasgow", "", p.state?.glasgow ?? null, "Neurologia", undefined, [
    { max: 5, label: "GCS 3–4", pts: 15 },
    { max: 6, label: "GCS 5", pts: 10 },
    { max: 7, label: "GCS 6", pts: 7 },
    { max: 13, label: "GCS 7–12", pts: 2 },
    { min: 13, label: "GCS ≥ 13", pts: 0 },
  ]);

  const bili = findExam(p, ["bilirrubina", "bt ", "bili"]);
  physio("bilirubin", "Bilirrubina total", "mg/dL", bili?.n ?? null, "Laboratório", bili?.at, [
    { max: 2, label: "< 2 mg/dL", pts: 0 },
    { max: 6, label: "2–5,9 mg/dL", pts: 4 },
    { min: 6, label: "≥ 6 mg/dL", pts: 5 },
  ]);

  const temp = p.state?.tempMax ?? p.state?.temp ?? null;
  physio("temperature", "Temperatura (maior valor)", "°C", temp, "Sinais vitais", undefined, [
    { max: 35, label: "< 35 °C", pts: 7 },
    { min: 35, label: "≥ 35 °C", pts: 0 },
  ]);

  const creat = findExam(p, ["creat"]);
  physio("creatinine", "Creatinina (maior valor)", "mg/dL", creat?.n ?? null, "Laboratório", creat?.at, [
    { max: 1.2, label: "< 1,2 mg/dL", pts: 0 },
    { max: 2, label: "1,2–1,9 mg/dL", pts: 2 },
    { max: 3.5, label: "2,0–3,4 mg/dL", pts: 7 },
    { min: 3.5, label: "≥ 3,5 mg/dL", pts: 8 },
  ]);

  physio("heartRate", "Frequência cardíaca (maior valor)", "bpm", p.state?.fcMax ?? null, "Sinais vitais", undefined, [
    { max: 120, label: "< 120 bpm", pts: 0 },
    { max: 160, label: "120–159 bpm", pts: 5 },
    { min: 160, label: "≥ 160 bpm", pts: 7 },
  ]);

  const leuco = findExam(p, ["leuco"]);
  const leucoG = leuco ? (leuco.n > 1000 ? leuco.n / 1000 : leuco.n) : null;
  physio("leukocytes", "Leucócitos (maior valor)", "G/L", leucoG, "Laboratório", leuco?.at, [
    { max: 15, label: "< 15 G/L", pts: 0 },
    { min: 15, label: "≥ 15 G/L", pts: 2 },
  ]);

  const ph = findExam(p, ["ph"]);
  physio("ph", "pH arterial (menor valor)", "", ph?.n ?? null, "Gasometria", ph?.at, [
    { max: 7.2501, label: "≤ 7,25", pts: 3 },
    { min: 7.2501, label: "> 7,25", pts: 0 },
  ]);

  const plaq = findExam(p, ["plaq", "plt"]);
  const plaqG = plaq ? (plaq.n > 1000 ? plaq.n / 1000 : plaq.n) : null;
  physio("platelets", "Plaquetas (menor valor)", "G/L", plaqG, "Laboratório", plaq?.at, [
    { max: 20, label: "< 20 G/L", pts: 13 },
    { max: 50, label: "20–49 G/L", pts: 8 },
    { max: 100, label: "50–99 G/L", pts: 5 },
    { min: 100, label: "≥ 100 G/L", pts: 0 },
  ]);

  physio("sbp", "PA sistólica (menor valor)", "mmHg", p.state?.pas ?? null, "Sinais vitais", undefined, [
    { max: 40, label: "< 40 mmHg", pts: 11 },
    { max: 70, label: "40–69 mmHg", pts: 8 },
    { max: 120, label: "70–119 mmHg", pts: 3 },
    { min: 120, label: "≥ 120 mmHg", pts: 0 },
  ]);

  // Oxigenação
  {
    const vm = isOnMechanicalVent(p);
    const pao2Exam = findExam(p, ["pao2", "po2"]);
    const pao2 = num(mv("pao2")) ?? pao2Exam?.n ?? null;
    const fio2Manual = num(mv("fio2"));
    let fio2 = fio2Manual ?? p.state?.fio2 ?? null;
    if (fio2 !== null && fio2 > 1) fio2 = fio2 / 100;
    let points: number | null = null;
    let category: string | null = null;
    let value: string | null = null;
    let warning: string | undefined;
    if (pao2 === null) {
      warning = "⚠️ PaO₂ necessária (gasometria arterial).";
    } else if (vm) {
      if (!fio2) {
        warning = "⚠️ FiO₂ necessária para calcular PaO₂/FiO₂.";
        value = `PaO₂ ${pao2} mmHg · em VM`;
      } else {
        const pf = pao2 / fio2;
        value = `PaO₂/FiO₂ ${pf.toFixed(0)} (PaO₂ ${pao2} / FiO₂ ${(fio2 * 100).toFixed(0)}%) · em VM`;
        category = pf >= 100 ? "PaO₂/FiO₂ ≥ 100 em VM" : "PaO₂/FiO₂ < 100 em VM";
        points = pf >= 100 ? 7 : 11;
      }
    } else {
      value = `PaO₂ ${pao2} mmHg · sem VM`;
      category = pao2 >= 60 ? "PaO₂ ≥ 60 mmHg" : "PaO₂ < 60 mmHg";
      points = pao2 >= 60 ? 0 : 5;
    }
    push({
      key: "oxygenation", group: 3, label: "Oxigenação",
      value, raw: pao2, category, points,
      source: points === null ? "Ausente" : (mv("pao2") !== null || fio2Manual !== null) ? "Manual" : "Gasometria",
      at: pao2Exam?.at, manual: mv("pao2") !== null, missing: points === null, warning,
    });
  }

  // -------- totais
  const sum = (g: Saps3Group) =>
    items.filter((i) => i.group === g).reduce((a, b) => a + (b.points ?? 0), 0);
  const g1 = sum(1), g2 = sum(2), g3 = sum(3);
  const score = g1 + g2 + g3 + SAPS3_OFFSET;
  const missing = items.filter((i) => i.missing);
  const complete = missing.length === 0;

  return {
    items,
    filled: items.length - missing.length,
    total: items.length,
    autoCount: items.filter((i) => !i.missing && !i.manual).length,
    manualCount: items.filter((i) => !i.missing && i.manual).length,
    missing,
    complete,
    score,
    mortality: complete ? saps3Mortality(score) : null,
    groupPoints: { g1, g2, g3, offset: SAPS3_OFFSET },
  };
}

export const SAPS3_GROUP_LABEL: Record<Saps3Group, string> = {
  1: "Grupo 1 — Características do paciente e condição pré-UTI",
  2: "Grupo 2 — Circunstâncias da admissão na UTI",
  3: "Grupo 3 — Alterações fisiológicas agudas",
};
