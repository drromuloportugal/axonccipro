import type { Patient, StoolEntry, VitalReading } from "@/data/patients";

/**
 * Assistente Inteligente de Monitoramento — UTI
 * Analisa parâmetros clínicos das últimas 24h e classifica por gravidade.
 *  Normal ·  Leve ·  Moderada ·  Grave ·  Não informado
 */

type Level = "normal" | "leve" | "mod" | "grave" | "na";

const LEVEL_META: Record<Level, { emoji: string; label: string; badge: string; ring: string }> = {
  normal: {
    emoji: "",
    label: "Normal",
    badge: "bg-clinical-stable/15 text-clinical-stable border-clinical-stable/40",
    ring: "ring-clinical-stable/30",
  },
  leve: {
    emoji: "",
    label: "Alteração leve",
    badge: "bg-yellow-500/15 text-yellow-600 border-yellow-500/40",
    ring: "ring-yellow-500/30",
  },
  mod: {
    emoji: "",
    label: "Alteração moderada",
    badge: "bg-orange-500/15 text-orange-600 border-orange-500/40",
    ring: "ring-orange-500/30",
  },
  grave: {
    emoji: "",
    label: "Alteração grave",
    badge: "bg-clinical-critical/15 text-clinical-critical border-clinical-critical/40",
    ring: "ring-clinical-critical/30",
  },
  na: {
    emoji: "",
    label: "Não informado",
    badge: "bg-muted text-muted-foreground border-border",
    ring: "ring-border",
  },
};

const worst = (...ls: Level[]): Level => {
  const rank: Record<Level, number> = { normal: 0, na: 0, leve: 1, mod: 2, grave: 3 };
  return ls.reduce((a, b) => (rank[b] > rank[a] ? b : a), "na");
};

// ---------- Classificadores ----------

function classifyBristol(b?: number): { level: Level; text: string } {
  if (!b) return { level: "na", text: "—" };
  const map: Record<number, { level: Level; text: string }> = {
    1: { level: "mod", text: "B1 · Constipação grave" },
    2: { level: "leve", text: "B2 · Constipação moderada" },
    3: { level: "normal", text: "B3 · Normal" },
    4: { level: "normal", text: "B4 · Normal" },
    5: { level: "leve", text: "B5 · Fezes amolecidas" },
    6: { level: "mod", text: "B6 · Diarreia moderada" },
    7: { level: "grave", text: "B7 · Diarreia intensa" },
  };
  return map[b];
}
function classifyFecalVolume(v?: string): { level: Level; text: string } {
  if (!v) return { level: "na", text: "—" };
  const map: Record<string, { level: Level; text: string }> = {
    ausente: { level: "na", text: "Sem evacuação" },
    "+": { level: "normal", text: "+ · Pequeno volume" },
    "++": { level: "normal", text: "++ · Volume moderado" },
    "+++": { level: "leve", text: "+++ · Grande volume" },
  };
  return map[v] ?? { level: "na", text: "—" };
}

function classifyTemp(t?: number): { level: Level; text: string } {
  if (t == null) return { level: "na", text: "—" };
  if (t < 35) return { level: "grave", text: `${t.toFixed(1)}°C · Hipotermia grave` };
  if (t < 36) return { level: "mod", text: `${t.toFixed(1)}°C · Hipotermia` };
  if (t <= 37.5) return { level: "normal", text: `${t.toFixed(1)}°C · Normal` };
  if (t <= 38) return { level: "leve", text: `${t.toFixed(1)}°C · Febrícula` };
  if (t <= 39) return { level: "mod", text: `${t.toFixed(1)}°C · Febre` };
  return { level: "grave", text: `${t.toFixed(1)}°C · Hipertermia importante` };
}

const RESP_MAP: Record<string, Level> = {
  "Ar ambiente": "normal",
  "Cateter O₂": "leve",
  "Máscara O₂": "mod",
  "Cateter alto fluxo": "mod",
  VNI: "mod",
  "VM PSV": "grave",
  "VM PCV": "grave",
  "VM VCV": "grave",
  "VM APRV": "grave",
  ECMO: "grave",
};
function classifyResp(v?: string): { level: Level; text: string } {
  if (!v) return { level: "na", text: "—" };
  const lvl = RESP_MAP[v] ?? (v.toUpperCase().includes("VM") ? "grave" : "leve");
  return { level: lvl, text: v };
}

function classifyFC(min?: number, max?: number): { level: Level; text: string } {
  const one = (v?: number): Level => {
    if (v == null) return "na";
    if (v < 40) return "grave";
    if (v <= 49) return "mod";
    if (v <= 59) return "leve";
    if (v <= 100) return "normal";
    if (v <= 120) return "leve";
    if (v <= 140) return "mod";
    return "grave";
  };
  if (min == null && max == null) return { level: "na", text: "—" };
  const l = worst(one(min), one(max));
  const range = min != null && max != null ? `${min}–${max} bpm` : `${max ?? min} bpm`;
  return { level: l, text: range };
}

const BP_MAP: Record<string, { level: Level; label: string }> = {
  normotensa: { level: "normal", label: "Normotensa" },
  hip_leve: { level: "leve", label: "Hipertensão leve" },
  hip_mod: { level: "mod", label: "Hipertensão moderada" },
  hip_grave: { level: "grave", label: "Hipertensão grave" },
  hipotensao: { level: "grave", label: "Hipotensão" },
};
function classifyBP(
  pas?: number,
  pad?: number,
  pam?: number,
  quali?: string,
): { level: Level; text: string } {
  if (pas != null && pad != null && !Number.isNaN(pas) && !Number.isNaN(pad)) {
    const mapCalc = Math.round(pad + (pas - pad) / 3);
    let level: Level = "normal";
    let hint = "Normotensa";
    if (pas < 90 || pad < 60 || mapCalc < 65) {
      level = "grave";
      hint = "Hipotensão";
    } else if (pas >= 180 || pad >= 120) {
      level = "grave";
      hint = "Hipertensão grave";
    } else if (pas >= 160 || pad >= 100) {
      level = "mod";
      hint = "Hipertensão moderada";
    } else if (pas >= 140 || pad >= 90) {
      level = "leve";
      hint = "Hipertensão leve";
    }
    return { level, text: `PAS ${pas} / PAD ${pad} mmHg (PAM ~${mapCalc}) · ${hint}` };
  }
  if (pam != null && !Number.isNaN(pam)) {
    if (pam < 60) return { level: "grave", text: `PAM ${pam} mmHg · Hipotensão` };
    if (pam <= 64) return { level: "mod", text: `PAM ${pam} mmHg · Limite` };
    return { level: "normal", text: `PAM ${pam} mmHg · Adequada` };
  }
  if (quali && BP_MAP[quali]) return { level: BP_MAP[quali].level, text: BP_MAP[quali].label };
  return { level: "na", text: "—" };
}

function classifySpO2(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 85) return { level: "grave", text: `${v}% · Hipoxemia grave` };
  if (v < 90) return { level: "mod", text: `${v}% · Hipoxemia moderada` };
  if (v < 94) return { level: "leve", text: `${v}% · Hipoxemia leve` };
  return { level: "normal", text: `${v}% · Adequada` };
}

function classifyPAM(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 60) return { level: "grave", text: `${v} mmHg · Hipotensão` };
  if (v <= 64) return { level: "mod", text: `${v} mmHg · Limítrofe` };
  if (v <= 100) return { level: "normal", text: `${v} mmHg · Adequada` };
  if (v <= 110) return { level: "leve", text: `${v} mmHg · Elevada` };
  if (v <= 130) return { level: "mod", text: `${v} mmHg · Hipertensão` };
  return { level: "grave", text: `${v} mmHg · Hipertensão grave` };
}

function classifyGlicemia(g?: number): { level: Level; text: string } {
  if (g == null) return { level: "na", text: "—" };
  if (g < 54) return { level: "grave", text: `${g} mg/dL · Hipoglicemia grave` };
  if (g < 70) return { level: "mod", text: `${g} mg/dL · Hipoglicemia` };
  if (g <= 180) return { level: "normal", text: `${g} mg/dL · Adequada` };
  if (g <= 250) return { level: "leve", text: `${g} mg/dL · Hiperglicemia leve` };
  if (g <= 300) return { level: "mod", text: `${g} mg/dL · Hiperglicemia moderada` };
  return { level: "grave", text: `${g} mg/dL · Hiperglicemia grave` };
}

function classifyDiurese(vol24?: number, mlkgh?: number): { level: Level; text: string } {
  if (mlkgh != null) {
    if (mlkgh < 0.3)
      return { level: "grave", text: `${mlkgh.toFixed(2)} mL/kg/h · Oligúria grave` };
    if (mlkgh < 0.5) return { level: "mod", text: `${mlkgh.toFixed(2)} mL/kg/h · Oligúria` };
    return { level: "normal", text: `${mlkgh.toFixed(2)} mL/kg/h · Adequada` };
  }
  if (vol24 == null) return { level: "na", text: "—" };
  if (vol24 <= 0) return { level: "grave", text: "Anúria" };
  if (vol24 < 400) return { level: "grave", text: `${vol24} mL/24h · Oligúria grave` };
  if (vol24 < 800) return { level: "mod", text: `${vol24} mL/24h · Oligúria` };
  if (vol24 < 1500) return { level: "leve", text: `${vol24} mL/24h · Reduzida` };
  return { level: "normal", text: `${vol24} mL/24h · Adequada` };
}

function classifyBH(bh?: number): { level: Level; text: string } {
  if (bh == null) return { level: "na", text: "—" };
  const a = Math.abs(bh);
  const sign = bh >= 0 ? "+" : "−";
  const shown = `${sign}${Math.round(a)} mL`;
  if (a <= 500) return { level: "normal", text: shown };
  if (a <= 1000) return { level: "leve", text: shown };
  if (a <= 2000) return { level: "mod", text: shown };
  return { level: "grave", text: shown };
}

function classifyResiduo(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 250) return { level: "normal", text: `${v} mL` };
  if (v <= 500) return { level: "leve", text: `${v} mL` };
  if (v <= 1000) return { level: "mod", text: `${v} mL` };
  return { level: "grave", text: `${v} mL` };
}

// ---------- UI helpers ----------

const inputCls =
  "w-full rounded border border-border bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary";
const L = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </label>
);

function Card({
  n,
  title,
  level,
  detail,
  children,
}: {
  n: number;
  title: string;
  level: Level;
  detail: string;
  children: React.ReactNode;
}) {
  const meta = LEVEL_META[level];
  return (
    <section className={`rounded-lg border bg-surface p-3 ring-1 ${meta.ring} border-border`}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {" "}
            {String(n).padStart(2, "0")} · {title}
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-foreground">{detail}</div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}
        >
          {" "}
          {meta.emoji} {meta.label}
        </span>
      </header>{" "}
      {children}
    </section>
  );
}

// ---------- Resumo de sinais vitais (reutilizável na coluna 6) ----------

export interface VitalSummaryEntry {
  level: Level;
  text: string;
  /** Último valor máximo registrado. */
  max?: number;
  /** Último valor mínimo registrado (quando informado). */
  min?: number;
  unit?: string;
  dec?: number;
}
export interface VitalSummary {
  temp: VitalSummaryEntry;
  spo2: VitalSummaryEntry;
  resp: VitalSummaryEntry;
  fc: VitalSummaryEntry;
  bp: VitalSummaryEntry;
  gli: VitalSummaryEntry;
  fr: VitalSummaryEntry;
  pas: VitalSummaryEntry;
  pad: VitalSummaryEntry;
}

function classifyFR(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 8) return { level: "grave", text: `${v} ipm · Bradipneia grave` };
  if (v < 12) return { level: "leve", text: `${v} ipm · Bradipneia` };
  if (v <= 20) return { level: "normal", text: `${v} ipm · Normal` };
  if (v <= 24) return { level: "leve", text: `${v} ipm · Taquipneia leve` };
  if (v <= 30) return { level: "mod", text: `${v} ipm · Taquipneia` };
  return { level: "grave", text: `${v} ipm · Taquipneia grave` };
}

function classifyPAS(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 90) return { level: "grave", text: `${v} mmHg · Hipotensão` };
  if (v < 100) return { level: "mod", text: `${v} mmHg · Limítrofe` };
  if (v <= 139) return { level: "normal", text: `${v} mmHg · Normal` };
  if (v <= 159) return { level: "leve", text: `${v} mmHg · HAS leve` };
  if (v <= 179) return { level: "mod", text: `${v} mmHg · HAS moderada` };
  return { level: "grave", text: `${v} mmHg · HAS grave` };
}

function classifyPAD(v?: number): { level: Level; text: string } {
  if (v == null) return { level: "na", text: "—" };
  if (v < 50) return { level: "grave", text: `${v} mmHg · Hipotensão` };
  if (v < 60) return { level: "mod", text: `${v} mmHg · Limítrofe` };
  if (v <= 89) return { level: "normal", text: `${v} mmHg · Normal` };
  if (v <= 99) return { level: "leve", text: `${v} mmHg · Elevada` };
  if (v <= 119) return { level: "mod", text: `${v} mmHg · HAS moderada` };
  return { level: "grave", text: `${v} mmHg · HAS grave` };
}

/**
 * Resumo dos sinais vitais.
 * Regra: a classificação e o alerta consideram SOMENTE o último registro
 * (máximo e mínimo daquele registro), não a série inteira.
 */
export function currentVitalsSummary(patient: Patient): VitalSummary {
  const s = patient.state;
  const series = s.vitalSeries ?? {};

  /** Último registro da série (por data), com máximo e mínimo. */
  const lastMM = (arr?: VitalReading[], fbMin?: number, fbMax?: number) => {
    const valid = (arr ?? []).filter((r) => typeof r.value === "number" && !Number.isNaN(r.value));
    if (!valid.length) return { min: fbMin, max: fbMax };
    const sorted = [...valid].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
    const last = sorted[sorted.length - 1]!;
    const max = last.value;
    const min = typeof last.min === "number" && !Number.isNaN(last.min) ? last.min : undefined;
    return { min, max };
  };

  const range = (
    r: { min?: number; max?: number },
    fn: (v?: number) => { level: Level; text: string },
    unit: string,
    dec = 0,
  ): VitalSummaryEntry => {
    if (r.min == null && r.max == null) return { level: "na", text: "—", unit, dec };
    const a = fn(r.min),
      b = fn(r.max);
    const lvl = worst(a.level, b.level);
    const fmt = (v?: number) => (v == null ? "—" : v.toFixed(dec));
    const txt =
      r.min != null && r.max != null && r.min !== r.max
        ? `${fmt(r.max)}–${fmt(r.min)} ${unit}`
        : `${fmt(r.max ?? r.min)} ${unit}`;
    const hint = (lvl === a.level ? a.text : b.text).split("·").slice(1).join("·").trim();
    return { level: lvl, text: hint ? `${txt} · ${hint}` : txt, max: r.max, min: r.min, unit, dec };
  };

  const tempR = lastMM(series.temp, undefined, s.tempMax ?? s.temp);
  const spo2R = lastMM(series.spo2, undefined, s.spo2);
  const fcR = lastMM(series.fc, s.fcMin, s.fcMax);
  const pamR = lastMM(series.pam, undefined, s.pam);
  const gliR = lastMM(series.glicemia, undefined, s.glicemia);
  const frR = lastMM(series.fr, undefined, s.fr);
  const pasR = lastMM(series.pas, undefined, s.pas);
  const padR = lastMM(series.pad, undefined, s.pad);

  const classifyFCOne = (v?: number) => classifyFC(v, v);

  return {
    temp: range(tempR, classifyTemp, "°C", 1),
    spo2: range(spo2R, classifySpO2, "%"),
    resp: classifyResp(s.vent),
    fc: range(fcR, classifyFCOne, "bpm"),
    bp: range(pamR, classifyPAM, "mmHg"),
    gli: range(gliR, classifyGlicemia, "mg/dL"),
    fr: range(frR, classifyFR, "ipm"),
    pas: range(pasR, classifyPAS, "mmHg"),
    pad: range(padR, classifyPAD, "mmHg"),
  };
}

// ---------- Sinais vitais da data mais recente (coluna 6 do painel) ----------

type VitalSeriesKey = keyof NonNullable<Patient["state"]["vitalSeries"]>;

const LATEST_VITAL_DEFS: {
  key: VitalSeriesKey;
  label: string;
  unit: string;
  dec?: number;
  classify: (v?: number) => { level: Level; text: string };
}[] = [
  { key: "temp", label: "Temp", unit: "°C", dec: 1, classify: classifyTemp },
  { key: "spo2", label: "SpO₂", unit: "%", classify: classifySpO2 },
  { key: "fc", label: "FC", unit: "bpm", classify: (v) => classifyFC(v, v) },
  { key: "fr", label: "FR", unit: "ipm", classify: classifyFR },
  { key: "pas", label: "PAS", unit: "mmHg", classify: classifyPAS },
  { key: "pad", label: "PAD", unit: "mmHg", classify: classifyPAD },
  { key: "pam", label: "PAM", unit: "mmHg", classify: classifyPAM },
  { key: "glicemia", label: "Glic", unit: "mg/dL", classify: classifyGlicemia },
  { key: "bristol", label: "Bristol", unit: "", classify: classifyBristol },
  { key: "bh", label: "BH", unit: "mL", classify: classifyBH },
];

const dayKeyOf = (iso?: string) => (iso ? iso.slice(0, 10) : "");

/** Último registro de uma série em uma data específica (AAAA-MM-DD). */
function readingOnDay(arr: VitalReading[] | undefined, day: string): VitalReading | undefined {
  const hits = (arr ?? []).filter(
    (r) => typeof r.value === "number" && !Number.isNaN(r.value) && dayKeyOf(r.at) === day,
  );
  if (!hits.length) return undefined;
  return [...hits].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))[hits.length - 1];
}

function entryFrom(
  r: VitalReading,
  classify: ((v?: number) => { level: Level; text: string }) | undefined,
  unit: string,
  dec = 0,
): VitalSummaryEntry {
  const max = r.value;
  const min = typeof r.min === "number" && !Number.isNaN(r.min) ? r.min : undefined;
  const lvl: Level = classify ? worst(classify(min).level, classify(max).level) : "na";
  const fmt = (v?: number) => (v == null ? "—" : v.toFixed(dec));
  const txt =
    min != null && max != null && min !== max
      ? `${fmt(max)}–${fmt(min)} ${unit}`
      : `${fmt(max ?? min)} ${unit}`;
  return { level: lvl, text: txt.trim(), max, min, unit: unit || undefined, dec };
}

export interface LatestDayVitals {
  /** Data (AAAA-MM-DD) mais recente com registros; null quando não há série datada. */
  date: string | null;
  rows: { label: string; v: VitalSummaryEntry }[];
}

/**
 * Todos os sinais vitais alimentados na data mais atual registrada
 * (vitalSeries + customSeries). Sem registros datados → date null.
 */
export function latestDayVitals(patient: Patient): LatestDayVitals {
  const s = patient.state;
  const series = s.vitalSeries ?? {};
  const custom = s.customSeries ?? [];

  let latest = "";
  const scan = (arr?: VitalReading[]) => {
    for (const r of arr ?? []) {
      if (typeof r.value !== "number" || Number.isNaN(r.value)) continue;
      const d = dayKeyOf(r.at);
      if (d && d > latest) latest = d;
    }
  };
  for (const def of LATEST_VITAL_DEFS) scan(series[def.key]);
  for (const c of custom) scan(c.readings);
  if (!latest) return { date: null, rows: [] };

  const rows: { label: string; v: VitalSummaryEntry }[] = [];
  for (const def of LATEST_VITAL_DEFS) {
    const r = readingOnDay(series[def.key], latest);
    if (r) rows.push({ label: def.label, v: entryFrom(r, def.classify, def.unit, def.dec) });
  }
  for (const c of custom) {
    const r = readingOnDay(c.readings, latest);
    if (!r) continue;
    const decs = [r.value, r.min]
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .map((v) => (Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2));
    const dec = Math.max(0, ...decs);
    rows.push({ label: c.label, v: entryFrom(r, undefined, c.unit ?? "", dec) });
  }
  return { date: latest, rows };
}

// ---------- Componente principal ----------

type Props = {
  patient: Patient;
  onChange: <K extends keyof Patient["state"]>(k: K, v: Patient["state"][K]) => void;
};

export function SmartMonitoring({ patient, onChange }: Props) {
  const s = patient.state;
  const weight = patient.weight || undefined;

  // Eliminação intestinal — considera lista de stools[] + campos legados.
  const stoolsArr = s.stools ?? [];
  const worstStool = stoolsArr.reduce<{ b?: number; v?: string }>(
    (acc, st) => {
      const bLvl = worst(
        acc.b == null ? "na" : classifyBristol(acc.b).level,
        classifyBristol(st.bristol).level,
      );
      const vLvl = worst(
        acc.v == null ? "na" : classifyFecalVolume(acc.v).level,
        classifyFecalVolume(st.volume).level,
      );
      return {
        b: bLvl === classifyBristol(st.bristol).level ? st.bristol : acc.b,
        v: vLvl === classifyFecalVolume(st.volume).level ? st.volume : acc.v,
      };
    },
    { b: s.bristol, v: s.fecalVolume },
  );
  const bristol = classifyBristol(worstStool.b);
  const vol = classifyFecalVolume(worstStool.v);
  const countText = stoolsArr.length ? `${stoolsArr.length} eliminação(ões)` : "";
  let intest: { level: Level; text: string } = {
    level: worst(bristol.level, vol.level),
    text: [countText, `${bristol.text} · ${vol.text}`].filter(Boolean).join(" · "),
  };
  if ((worstStool.b === 6 || worstStool.b === 7) && worstStool.v === "+++") {
    intest = { level: "grave", text: `Diarreia de grande volume · ${bristol.text} + ${vol.text}` };
  }
  if (
    worstStool.b === 1 ||
    (s.hoursWithoutStool != null &&
      s.hoursWithoutStool > 72 &&
      stoolsArr.length === 0 &&
      (!s.fecalVolume || s.fecalVolume === "ausente"))
  ) {
    intest = {
      level: "grave",
      text: intest.text + (s.hoursWithoutStool ? ` · ${s.hoursWithoutStool}h sem evacuação` : ""),
    };
  }

  const series = s.vitalSeries ?? {};
  const vs = currentVitalsSummary(patient);
  const { temp, spo2, resp, fc, bp, gli } = vs;

  const setSeries = (k: keyof NonNullable<Patient["state"]["vitalSeries"]>, v: VitalReading[]) =>
    onChange("vitalSeries", { ...series, [k]: v });

  const diu = classifyDiurese(
    s.diurese24,
    s.diureseHoraria != null && weight ? s.diureseHoraria / weight : s.diurese || undefined,
  );
  const bh = classifyBH(s.balancoHidrico);
  const res = classifyResiduo(s.residuoGastrico);

  const overall = worst(
    intest.level,
    temp.level,
    resp.level,
    spo2.level,
    fc.level,
    bp.level,
    gli.level,
    diu.level,
    bh.level,
    res.level,
  );
  const overallMeta = LEVEL_META[overall];

  return (
    <div className="space-y-3">
      {" "}
      {/* Resumo */}
      <div
        className={`flex items-center justify-between rounded-lg border p-3 ${overallMeta.badge}`}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
            Assistente inteligente de monitoramento · UTI
          </div>
          <div className="mt-0.5 text-[13px] font-semibold">Estado clínico geral (últimas 24h)</div>
        </div>
        <div className="text-right">
          <div className="text-[22px] leading-none">{overallMeta.emoji}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider">
            {overallMeta.label}
          </div>
        </div>
      </div>{" "}
      {/* ============ ESTADO ATUAL — SINAIS VITAIS ============ */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
            {" "}
            Estado atual · Sinais vitais
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {" "}
          {/* 1. Temperatura — múltiplos registros */}
          <Card n={1} title="Temperatura (mín / máx)" level={temp.level} detail={temp.text}>
            <ReadingList
              items={series.temp ?? []}
              unit="°C"
              step="0.1"
              placeholder="36.5"
              legacy={s.temp}
              onChange={(v) => {
                setSeries("temp", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) {
                  onChange("temp", Math.min(...n));
                  onChange("tempMax", Math.max(...n));
                }
              }}
            />
          </Card>{" "}
          {/* 2. Saturação de O₂ — múltiplos registros */}
          <Card
            n={2}
            title="Saturação de O₂ (mín / máx)"
            level={worst(spo2.level, resp.level)}
            detail={`${spo2.text} · ${resp.text}`}
          >
            <ReadingList
              items={series.spo2 ?? []}
              unit="%"
              placeholder="96"
              legacy={s.spo2}
              onChange={(v) => {
                setSeries("spo2", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("spo2", Math.min(...n));
              }}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <L>Suporte respiratório</L>
                <select
                  className={inputCls}
                  value={s.vent}
                  onChange={(e) => onChange("vent", e.target.value)}
                >
                  {" "}
                  {[
                    "Ar ambiente",
                    "Cateter O₂",
                    "Máscara O₂",
                    "Cateter alto fluxo",
                    "VNI",
                    "VM PSV",
                    "VM PCV",
                    "VM VCV",
                    "VM APRV",
                    "ECMO",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <L>FiO₂ (%)</L>
                <input
                  type="number"
                  min={21}
                  max={100}
                  className={inputCls}
                  value={s.fio2 ?? ""}
                  onChange={(e) => onChange("fio2", Number(e.target.value))}
                />
              </div>
            </div>
          </Card>{" "}
          {/* 3. FC — múltiplos registros */}
          <Card n={3} title="Frequência cardíaca (mín / máx)" level={fc.level} detail={fc.text}>
            <ReadingList
              items={series.fc ?? []}
              unit="bpm"
              placeholder="80"
              legacy={s.fcMax ?? s.fcMin}
              onChange={(v) => {
                setSeries("fc", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) {
                  onChange("fcMin", Math.min(...n));
                  onChange("fcMax", Math.max(...n));
                }
              }}
            />
          </Card>{" "}
          {/* 4. PAM — múltiplos registros */}
          <Card n={4} title="PAM (mín / máx)" level={bp.level} detail={bp.text}>
            <ReadingList
              items={series.pam ?? []}
              unit="mmHg"
              placeholder="75"
              legacy={s.pam}
              onChange={(v) => {
                setSeries("pam", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("pam", Math.min(...n));
              }}
            />
          </Card>{" "}
          {/* 5. Glicemia — múltiplos registros */}
          <Card n={5} title="Glicemia (mín / máx)" level={gli.level} detail={gli.text}>
            <ReadingList
              items={series.glicemia ?? []}
              unit="mg/dL"
              placeholder="110"
              legacy={s.glicemia}
              onChange={(v) => {
                setSeries("glicemia", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("glicemia", Math.max(...n));
              }}
            />
          </Card>{" "}
          {/* 6. FR — múltiplos registros */}
          <Card
            n={6}
            title="Frequência respiratória (mín / máx)"
            level={vs.fr.level}
            detail={vs.fr.text}
          >
            <ReadingList
              items={series.fr ?? []}
              unit="ipm"
              placeholder="18"
              legacy={s.fr}
              onChange={(v) => {
                setSeries("fr", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("fr", Math.max(...n));
              }}
            />
          </Card>{" "}
          {/* 7. PAS — múltiplos registros */}
          <Card n={7} title="PAS — sistólica (mín / máx)" level={vs.pas.level} detail={vs.pas.text}>
            <ReadingList
              items={series.pas ?? []}
              unit="mmHg"
              placeholder="120"
              legacy={s.pas}
              onChange={(v) => {
                setSeries("pas", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("pas", Math.min(...n));
              }}
            />
          </Card>{" "}
          {/* 8. PAD — múltiplos registros */}
          <Card
            n={8}
            title="PAD — diastólica (mín / máx)"
            level={vs.pad.level}
            detail={vs.pad.text}
          >
            <ReadingList
              items={series.pad ?? []}
              unit="mmHg"
              placeholder="70"
              legacy={s.pad}
              onChange={(v) => {
                setSeries("pad", v);
                const n = v.map((r) => r.value).filter((x): x is number => typeof x === "number");
                if (n.length) onChange("pad", Math.min(...n));
              }}
            />
          </Card>
        </div>
      </div>{" "}
      {/* ============ ESCALA DE BRISTOL — ELIMINAÇÃO INTESTINAL ============ */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
            {" "}
            Escala de Bristol · Eliminação intestinal
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card n={1} title="Eliminação intestinal" level={intest.level} detail={intest.text}>
            <StoolList
              items={s.stools ?? []}
              legacyBristol={s.bristol}
              legacyVolume={s.fecalVolume}
              hoursWithoutStool={s.hoursWithoutStool}
              onChangeStools={(v) => onChange("stools", v)}
              onChangeHours={(v) => onChange("hoursWithoutStool", v)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- StoolList: múltiplas eliminações intestinais ----------

const uid = () => `stool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function StoolList({
  items,
  legacyBristol,
  legacyVolume,
  hoursWithoutStool,
  onChangeStools,
  onChangeHours,
}: {
  items: StoolEntry[];
  legacyBristol?: number;
  legacyVolume?: string;
  hoursWithoutStool?: number;
  onChangeStools: (v: StoolEntry[]) => void;
  onChangeHours: (v: number | undefined) => void;
}) {
  const upd = (id: string, patch: Partial<StoolEntry>) =>
    onChangeStools(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => onChangeStools(items.filter((x) => x.id !== id));
  const add = () =>
    onChangeStools([
      ...items,
      {
        id: uid(),
        bristol: (legacyBristol as StoolEntry["bristol"]) ?? undefined,
        volume: (legacyVolume as StoolEntry["volume"]) ?? undefined,
        at: new Date().toISOString(),
      },
    ]);

  return (
    <div className="space-y-2">
      <div>
        <L>h sem evacuar</L>
        <input
          type="number"
          min={0}
          className={inputCls}
          value={hoursWithoutStool ?? ""}
          onChange={(e) =>
            onChangeHours(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      </div>
      <ul className="space-y-1">
        {" "}
        {items.map((st) => (
          <li key={st.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
            <select
              className={inputCls}
              value={st.bristol ?? ""}
              onChange={(e) =>
                upd(st.id, {
                  bristol:
                    e.target.value === ""
                      ? undefined
                      : (Number(e.target.value) as StoolEntry["bristol"]),
                })
              }
            >
              <option value="">— Bristol —</option>{" "}
              {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                <option key={v} value={v}>
                  Tipo {v}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={st.volume ?? ""}
              onChange={(e) =>
                upd(st.id, { volume: (e.target.value || undefined) as StoolEntry["volume"] })
              }
            >
              <option value="">— Volume —</option>
              <option value="ausente">Ausente</option>
              <option value="+">+ Pequeno</option>
              <option value="++">++ Moderado</option>
              <option value="+++">+++ Grande</option>
            </select>
            <input
              type="datetime-local"
              className={inputCls}
              value={st.at ? new Date(st.at).toISOString().slice(0, 16) : ""}
              onChange={(e) =>
                upd(st.id, {
                  at: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
            <button
              type="button"
              onClick={() => del(st.id)}
              className="rounded border border-border bg-surface px-2 text-[11px] hover:bg-destructive/10 hover:text-destructive"
              title="Remover"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="rounded-md border border-dashed border-border bg-surface px-2 py-1 text-[11px] font-semibold hover:bg-surface-3"
      >
        {" "}
        + Adicionar eliminação
      </button>
    </div>
  );
}

// ---------- ReadingList: múltiplos registros de um parâmetro vital ----------

const rid = () => `vr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function ReadingList({
  items,
  unit,
  step,
  placeholder,
  legacy,
  onChange,
}: {
  items: VitalReading[];
  unit: string;
  step?: string;
  placeholder?: string;
  legacy?: number;
  onChange: (v: VitalReading[]) => void;
}) {
  const vals = items
    .map((r) => r.value)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  const min = vals.length ? Math.min(...vals) : legacy;
  const max = vals.length ? Math.max(...vals) : legacy;

  const upd = (id: string, patch: Partial<VitalReading>) =>
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => onChange(items.filter((x) => x.id !== id));
  const add = () =>
    onChange([...items, { id: rid(), value: legacy, at: new Date().toISOString() }]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-border bg-surface px-2 py-1">
          <L>Mínima</L>
          <div className="text-[13px] font-bold text-foreground">
            {min ?? "—"} {min != null ? unit : ""}
          </div>
        </div>
        <div className="rounded border border-border bg-surface px-2 py-1">
          <L>Máxima</L>
          <div className="text-[13px] font-bold text-foreground">
            {max ?? "—"} {max != null ? unit : ""}
          </div>
        </div>
      </div>
      <ul className="space-y-1">
        {" "}
        {items.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-1">
            <input
              type="number"
              step={step}
              placeholder={placeholder}
              className={inputCls}
              value={r.value ?? ""}
              onChange={(e) =>
                upd(r.id, { value: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
            <input
              type="datetime-local"
              className={inputCls}
              value={r.at ? new Date(r.at).toISOString().slice(0, 16) : ""}
              onChange={(e) =>
                upd(r.id, {
                  at: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
            <button
              type="button"
              onClick={() => del(r.id)}
              className="rounded border border-border bg-surface px-2 text-[11px] hover:bg-destructive/10 hover:text-destructive"
              title="Remover"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="rounded-md border border-dashed border-border bg-surface px-2 py-1 text-[11px] font-semibold hover:bg-surface-3"
      >
        {" "}
        + Adicionar registro ({unit})
      </button>
    </div>
  );
}
