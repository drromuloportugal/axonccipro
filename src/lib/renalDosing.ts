// Cálculo de depuração de creatinina (Cockcroft-Gault) e detecção de antimicrobianos
// apontados pelo assistente, para sugestão de ajuste de dose renal.

import type { Medication, Patient } from "@/data/patients";
import { detectAntibiotic } from "@/lib/clinical";

export interface CrClResult {
  /** mL/min por Cockcroft-Gault (peso informado). */
  value: number;
  creat: number;
  creatUnit: string;
  takenAt?: string;
  ageYears: number;
  weightKg: number;
  sex: "M" | "F";
  /** Faixa de função renal segundo o clearance. */
  band: string;
  bandClass: string;
  /** Variação da creatinina no histórico disponível (mg/dL). */
  creatDelta?: number;
  /** Sinal de lesão renal aguda pela variação da creatinina. */
  akiFlag?: string;
}

const CREAT_RE = /creat/i;

/** Linha de creatinina mais recente do paciente (por código ou rótulo). */
export function findCreatinineRow(p: Patient) {
  return (p.exams ?? []).find((e) => CREAT_RE.test(e.code ?? "") || CREAT_RE.test(e.label ?? ""));
}

function band(v: number): { band: string; bandClass: string } {
  if (v >= 90) return { band: "Função renal preservada", bandClass: "text-clinical-stable" };
  if (v >= 60) return { band: "Redução leve (60–89 mL/min)", bandClass: "text-clinical-stable" };
  if (v >= 30) return { band: "Redução moderada (30–59 mL/min)", bandClass: "text-clinical-warning" };
  if (v >= 15) return { band: "Redução grave (15–29 mL/min)", bandClass: "text-clinical-critical" };
  return { band: "Falência renal (<15 mL/min)", bandClass: "text-clinical-critical" };
}

/** Depuração de creatinina por Cockcroft-Gault, com faixa e tendência. */
export function creatinineClearance(p: Patient): CrClResult | null {
  const row = findCreatinineRow(p);
  if (!row) return null;
  const creat = row.valueNum ?? parseFloat(String(row.value).replace(",", "."));
  if (!Number.isFinite(creat) || creat <= 0) return null;
  const ageYears = p.age;
  const weightKg = p.weight;
  if (!ageYears || !weightKg) return null;
  let v = ((140 - ageYears) * weightKg) / (72 * creat);
  if (p.sex === "F") v *= 0.85;
  if (!Number.isFinite(v) || v <= 0) return null;
  const value = Math.round(v);

  const hist = row.history ?? [];
  let creatDelta: number | undefined;
  let akiFlag: string | undefined;
  if (hist.length >= 2) {
    const window = hist.slice(-8);
    const min = Math.min(...window.map((h) => h.value));
    creatDelta = Math.round((creat - min) * 100) / 100;
    if (creat >= min * 1.5) akiFlag = "Creatinina ≥ 1,5× o menor valor recente — padrão de LRA (KDIGO).";
    else if (creatDelta >= 0.3) akiFlag = "Elevação ≥ 0,3 mg/dL na janela recente — vigiar LRA (KDIGO).";
  }

  return {
    value,
    creat,
    creatUnit: row.unit ?? "mg/dL",
    takenAt: row.takenAt,
    ageYears,
    weightKg,
    sex: p.sex,
    ...band(value),
    creatDelta,
    akiFlag,
  };
}

/** Medicações ativas do paciente. */
function activeMeds(p: Patient): Medication[] {
  return (p.medications ?? []).filter((m) => m.active !== false && !m.end);
}

const ATB_WORDS =
  /antibi[óo]tic|antimicrobian|atb|antifúngic|antifungic|antiviral|vancomicin|meropenem|cefepim|ceftriax|ceftazidim|cefazolin|piperacilin|tazobact|amicacin|amikacin|gentamicin|polimixin|colistin|tigeciclin|linezolid|daptomicin|ciprofloxacin|levofloxacin|metronidazol|ampicilin|sulbactam|ertapenem|imipenem|fluconazol|anidulafungin|micafungin|caspofungin|aciclovir|oseltamivir|sulfametoxazol|claritromicin|azitromicin|clindamicin/i;

/** Antimicrobianos relacionados ao trecho apontado pelo balão. */
export function pointedAntimicrobials(p: Patient, info: string): Medication[] {
  const text = (info ?? "").toLowerCase();
  if (!text) return [];
  const atbs = activeMeds(p).filter((m) => m.isAntibiotic ?? detectAntibiotic(m.name));
  const named = atbs.filter((m) => {
    const base = m.name.toLowerCase().split(/[\s(/-]/)[0] ?? "";
    return base.length >= 4 && text.includes(base);
  });
  if (named.length > 0) return named;
  // Menção genérica a antimicrobianos no trecho: considera todos os ativos.
  return ATB_WORDS.test(text) ? atbs : [];
}

/** Resumo textual do estado renal para enviar ao motor de análise. */
export function renalContextText(p: Patient, crcl: CrClResult | null): string {
  if (!crcl)
    return "DEPURAÇÃO DE CREATININA: não calculável — dado ausente no passômetro (creatinina, peso, idade ou sexo).";
  const lines = [
    `DEPURAÇÃO DE CREATININA (Cockcroft-Gault): ${crcl.value} mL/min — ${crcl.band}.`,
    `Cálculo: ((140 − ${crcl.ageYears}) × ${crcl.weightKg} kg) ÷ (72 × ${crcl.creat} ${crcl.creatUnit})${crcl.sex === "F" ? " × 0,85 (sexo feminino)" : ""}.`,
  ];
  if (crcl.takenAt) lines.push(`Creatinina coletada em ${crcl.takenAt}.`);
  if (crcl.creatDelta !== undefined)
    lines.push(`Variação recente da creatinina: ${crcl.creatDelta >= 0 ? "+" : ""}${crcl.creatDelta} mg/dL.`);
  if (crcl.akiFlag) lines.push(`Alerta: ${crcl.akiFlag}`);
  return lines.join("\n");
}
