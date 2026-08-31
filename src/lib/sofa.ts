import type { Patient, ExamRow } from "@/data/patients";

// ---------------------------------------------------------------------------
// SOFA — cálculo objetivo dos 6 sistemas
// Sem dado suficiente => null (exibido como "N/D"), nunca 0.
// ---------------------------------------------------------------------------

export type SofaKey = "resp" | "cardio" | "neuro" | "coag" | "hepato" | "renal";

export const SOFA_SYSTEMS: { key: SofaKey; label: string; icon: string; color: string }[] = [
  { key: "resp", label: "Respiratório", icon: "🫁", color: "#3b82f6" },
  { key: "cardio", label: "Cardiovascular", icon: "🫀", color: "#ef4444" },
  { key: "neuro", label: "Neurológico", icon: "🧠", color: "#8b5cf6" },
  { key: "coag", label: "Coagulação", icon: "🩸", color: "#7f1d1d" },
  { key: "hepato", label: "Hepático", icon: "🧬", color: "#166534" },
  { key: "renal", label: "Renal", icon: "🩺", color: "#eab308" },
];

export type SofaComponents = Record<SofaKey, number | null>;

export interface SofaPoint {
  /** ISO timestamp do ponto */
  t: string;
  /** ms epoch */
  ms: number;
  components: SofaComponents;
  /** soma dos componentes disponíveis */
  total: number | null;
  /** número de sistemas com dado */
  known: number;
}

function toNum(raw?: string | number | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  const s = raw.trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function findExam(p: Patient, ...labels: string[]): ExamRow | undefined {
  return (p.exams ?? []).find((e) =>
    labels.some((l) => (e.label ?? "").toLowerCase().includes(l.toLowerCase())),
  );
}

/** Série temporal (ms → valor) de um exame, incluindo o valor atual. */
function examSeries(p: Patient, ...labels: string[]): { ms: number; value: number }[] {
  const e = findExam(p, ...labels);
  if (!e) return [];
  const out: { ms: number; value: number }[] = [];
  for (const h of e.history ?? []) {
    const ms = Date.parse(h.takenAt);
    if (!isNaN(ms) && typeof h.value === "number") out.push({ ms, value: h.value });
  }
  const cur = e.valueNum ?? toNum(e.value);
  if (cur != null) {
    const ms = e.takenAt ? Date.parse(e.takenAt) : Date.now();
    out.push({ ms: isNaN(ms) ? Date.now() : ms, value: cur });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/** Último valor conhecido até `ms` (LOCF). */
function valueAt(series: { ms: number; value: number }[], ms: number): number | null {
  let v: number | null = null;
  for (const s of series) {
    if (s.ms <= ms + 1) v = s.value;
    else break;
  }
  return v;
}

// --- escores por sistema ---------------------------------------------------

export function scoreCoag(plaquetas: number | null): number | null {
  if (plaquetas == null) return null;
  // aceita 10^3/µL ou valor absoluto
  const k = plaquetas > 2000 ? plaquetas / 1000 : plaquetas;
  if (k < 20) return 4;
  if (k < 50) return 3;
  if (k < 100) return 2;
  if (k < 150) return 1;
  return 0;
}

export function scoreHepato(bilirrubina: number | null): number | null {
  if (bilirrubina == null) return null;
  if (bilirrubina >= 12) return 4;
  if (bilirrubina >= 6) return 3;
  if (bilirrubina >= 2) return 2;
  if (bilirrubina >= 1.2) return 1;
  return 0;
}

export function scoreRenal(creatinina: number | null, diurese24?: number | null): number | null {
  let s: number | null = null;
  if (creatinina != null) {
    s = creatinina >= 5 ? 4 : creatinina >= 3.5 ? 3 : creatinina >= 2 ? 2 : creatinina >= 1.2 ? 1 : 0;
  }
  if (diurese24 != null && diurese24 > 0) {
    const d = diurese24 < 200 ? 4 : diurese24 < 500 ? 3 : 0;
    s = s == null ? d : Math.max(s, d);
  }
  return s;
}

export function scoreNeuro(glasgow: number | null): number | null {
  if (glasgow == null || glasgow < 3 || glasgow > 15) return null;
  if (glasgow < 6) return 4;
  if (glasgow < 10) return 3;
  if (glasgow < 13) return 2;
  if (glasgow < 15) return 1;
  return 0;
}

export function scoreResp(
  pf: number | null,
  sf: number | null,
  ventilated: boolean,
): number | null {
  if (pf != null) {
    if (pf < 100 && ventilated) return 4;
    if (pf < 200 && ventilated) return 3;
    if (pf < 300) return 2;
    if (pf < 400) return 1;
    return 0;
  }
  if (sf != null) {
    if (sf < 148 && ventilated) return 4;
    if (sf < 221 && ventilated) return 3;
    if (sf < 264) return 2;
    if (sf < 357) return 1;
    return 0;
  }
  return null;
}

export function scoreCardio(pam: number | null, dva: string | null | undefined): number | null {
  const d = (dva ?? "").toLowerCase();
  if (d.trim()) {
    const dose = toNum((d.match(/(\d+[.,]?\d*)\s*mcg\/kg\/min/) ?? [])[1]);
    const isPotente = /nora|noradren|adren|epinef|vasopress|terlipress/.test(d);
    const isDopaDobu = /dopa|dobuta/.test(d);
    if (isPotente) {
      if (dose != null) return dose > 0.1 ? 4 : 3;
      return 3;
    }
    if (isDopaDobu) {
      if (/dopa/.test(d) && dose != null && dose > 15) return 4;
      if (/dopa/.test(d) && dose != null && dose > 5) return 3;
      return 2;
    }
    return 2;
  }
  if (pam == null) return null;
  return pam < 70 ? 1 : 0;
}

// --- montagem da série -----------------------------------------------------

function sumComponents(c: SofaComponents): { total: number | null; known: number } {
  let total = 0;
  let known = 0;
  for (const k of Object.keys(c) as SofaKey[]) {
    const v = c[k];
    if (v != null) {
      total += v;
      known++;
    }
  }
  return { total: known ? total : null, known };
}

/**
 * Constrói a série temporal do SOFA a partir dos exames laboratoriais datados.
 * Os parâmetros clínicos (resp/cardio/neuro) provêm do estado atual e são
 * mantidos constantes no tempo (LOCF retroativo), pois não há registro seriado.
 */
export function buildSofaSeries(p: Patient): SofaPoint[] {
  const plaq = examSeries(p, "plaq");
  const bili = examSeries(p, "bilirrubina total", "bilirr", "bt ");
  const creat = examSeries(p, "creatinina", "creat");
  const pao2 = examSeries(p, "pao2", "po2");

  const s = p.state ?? ({} as Patient["state"]);
  const ventilated = /vm|psv|pcv|vcv|iot|tot|traq/i.test(s?.vent ?? "");
  const fio2 = s?.fio2 && s.fio2 > 0 ? s.fio2 : null;
  const sf = fio2 && s?.spo2 ? s.spo2 / (fio2 / 100) : null;
  const neuro = scoreNeuro(typeof s?.glasgow === "number" ? s.glasgow : null);
  const cardio = scoreCardio(typeof s?.pam === "number" ? s.pam : null, s?.dva);

  const stamps = new Set<number>();
  for (const arr of [plaq, bili, creat, pao2]) for (const x of arr) stamps.add(x.ms);
  const nowMs = Date.now();
  stamps.add(nowMs);

  const sorted = [...stamps].sort((a, b) => a - b);
  const points: SofaPoint[] = sorted.map((ms) => {
    const pfVal = valueAt(pao2, ms);
    const pf = pfVal != null && fio2 ? pfVal / (fio2 / 100) : null;
    const components: SofaComponents = {
      resp: scoreResp(pf, sf, ventilated),
      cardio,
      neuro,
      coag: scoreCoag(valueAt(plaq, ms)),
      hepato: scoreHepato(valueAt(bili, ms)),
      renal: scoreRenal(valueAt(creat, ms), s?.diurese24 ?? null),
    };
    const { total, known } = sumComponents(components);
    return { t: new Date(ms).toISOString(), ms, components, total, known };
  });

  return points.filter((pt) => pt.known > 0);
}

export type Trajectory = "up" | "flat" | "down" | "unknown";

export interface SofaSummary {
  series: SofaPoint[];
  current: SofaPoint | null;
  baseline: SofaPoint | null;
  delta24: number | null;
  delta48: number | null;
  deltaAdmission: number | null;
  max: { value: number; t: string } | null;
  dominant: { keys: SofaKey[]; score: number } | null;
  systemsGte2: number | null;
  trajectory: Trajectory;
}

/** Delta comparável: só usa sistemas com dado em ambos os pontos. */
function comparableDelta(cur: SofaPoint, prev: SofaPoint): number | null {
  let d = 0;
  let n = 0;
  for (const { key } of SOFA_SYSTEMS) {
    const a = cur.components[key];
    const b = prev.components[key];
    if (a != null && b != null) {
      d += a - b;
      n++;
    }
  }
  return n ? d : null;
}

function pointBefore(series: SofaPoint[], ms: number): SofaPoint | null {
  let out: SofaPoint | null = null;
  for (const p of series) {
    if (p.ms <= ms) out = p;
    else break;
  }
  return out;
}

export function summarizeSofa(patient: Patient): SofaSummary {
  const series = buildSofaSeries(patient);
  const current = series.length ? series[series.length - 1] : null;
  const baseline = series.length ? series[0] : null;

  const H = 3600_000;
  const p24 = current ? pointBefore(series.slice(0, -1), current.ms - 20 * H) : null;
  const p48 = current ? pointBefore(series.slice(0, -1), current.ms - 44 * H) : null;

  const delta24 = current && p24 ? comparableDelta(current, p24) : null;
  const delta48 = current && p48 ? comparableDelta(current, p48) : null;
  const deltaAdmission =
    current && baseline && baseline !== current ? comparableDelta(current, baseline) : null;

  let max: SofaSummary["max"] = null;
  for (const p of series) {
    if (p.total != null && (!max || p.total > max.value)) max = { value: p.total, t: p.t };
  }

  let dominant: SofaSummary["dominant"] = null;
  let systemsGte2: number | null = null;
  if (current) {
    let best = -1;
    const keys: SofaKey[] = [];
    let gte2 = 0;
    for (const { key } of SOFA_SYSTEMS) {
      const v = current.components[key];
      if (v == null) continue;
      if (v >= 2) gte2++;
      if (v > best) {
        best = v;
        keys.length = 0;
        keys.push(key);
      } else if (v === best) keys.push(key);
    }
    if (best >= 0) dominant = { keys, score: best };
    systemsGte2 = current.known ? gte2 : null;
  }

  // Trajetória: prioriza tendência 24–48h
  let trajectory: Trajectory = "unknown";
  const trend = delta24 ?? delta48;
  if (trend != null) {
    const combined = delta24 != null && delta48 != null ? delta24 + (delta48 - delta24) * 0.5 : trend;
    trajectory = combined >= 1 ? "up" : combined <= -1 ? "down" : "flat";
  }

  return {
    series,
    current,
    baseline,
    delta24,
    delta48,
    deltaAdmission,
    max,
    dominant,
    systemsGte2,
    trajectory,
  };
}

export const TRAJECTORY_META: Record<Trajectory, { icon: string; label: string; className: string }> = {
  up: { icon: "↑", label: "Piora", className: "text-clinical-critical" },
  flat: { icon: "→", label: "Estável", className: "text-clinical-attention" },
  down: { icon: "↓", label: "Melhora", className: "text-clinical-stable" },
  unknown: { icon: "—", label: "N/D", className: "text-muted-foreground" },
};

export function fmtDelta(v: number | null): string {
  if (v == null) return "N/D";
  if (v > 0) return `+${v}`;
  return `${v}`;
}
