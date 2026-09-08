// Calculadora de gasometria arterial — funções puras, apoio educacional.
// Não prescreve conduta nem substitui decisão médica.

export type AbgCourse = "acute" | "chronic" | "undefined";

export interface AbgInput {
  ph?: number;
  paco2?: number;
  hco3?: number;
  na?: number;
  cl?: number;
  albumin?: number;
  pao2?: number;
  fio2?: number; // %
  lactate?: number;
  magnesium?: number;
  ketones?: string;
  course?: AbgCourse;
  takenAt?: string;
}

export interface AbgLine {
  label: string;
  value: string;
  tone?: "normal" | "attention" | "critical";
}

export interface AbgResult {
  complete: boolean;
  missing: string[];
  phStatus: string;
  phTone: "normal" | "attention" | "critical";
  primary: string;
  mixed: boolean;
  compensation?: { expected: string; measured: string; verdict: string };
  anionGap?: number;
  anionGapClass?: string;
  anionGapCorrected?: number;
  hco3Calc?: number;
  pfRatio?: number;
  pfClass?: string;
  extras: AbgLine[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeAbg(i: AbgInput): AbgResult {
  const missing: string[] = [];
  if (i.ph == null) missing.push("pH");
  if (i.paco2 == null) missing.push("PaCO₂");
  if (i.hco3 == null) missing.push("HCO₃⁻");
  if (i.na == null) missing.push("Na⁺");
  if (i.cl == null) missing.push("Cl⁻");

  const extras: AbgLine[] = [];
  const res: AbgResult = {
    complete: missing.length === 0,
    missing,
    phStatus: "—",
    phTone: "normal",
    primary: "Dados insuficientes",
    mixed: false,
    extras,
  };

  const { ph, paco2, hco3, na, cl } = i;

  if (ph != null) {
    if (ph < 7.35) { res.phStatus = "Acidemia"; res.phTone = ph < 7.2 ? "critical" : "attention"; }
    else if (ph > 7.45) { res.phStatus = "Alcalemia"; res.phTone = ph > 7.55 ? "critical" : "attention"; }
    else { res.phStatus = "Faixa de referência"; res.phTone = "normal"; }
  }

  if (paco2 != null && ph != null) {
    res.hco3Calc = r1(0.03 * paco2 * Math.pow(10, ph - 6.1));
  }

  if (na != null && cl != null && hco3 != null) {
    const ag = r1(na - (cl + hco3));
    res.anionGap = ag;
    res.anionGapClass = ag > 12 ? "aumentado" : ag < 8 ? "baixo" : "dentro da faixa de referência";
    if (i.albumin != null) res.anionGapCorrected = r1(ag + 2.5 * (4.0 - i.albumin));
  }

  if (i.pao2 != null && i.fio2 != null && i.fio2 > 0) {
    const pf = Math.round(i.pao2 / (i.fio2 / 100));
    res.pfRatio = pf;
    res.pfClass = pf < 100 ? "SDRA grave" : pf < 200 ? "SDRA moderada" : pf < 300 ? "SDRA leve" : "sem critério de SDRA";
  }

  // Distúrbio primário
  if (ph != null && paco2 != null && hco3 != null) {
    const acid = ph < 7.35, alk = ph > 7.45;
    const flags: string[] = [];
    if (acid && hco3 < 22) flags.push("Acidose metabólica");
    if (alk && hco3 > 26) flags.push("Alcalose metabólica");
    if (acid && paco2 > 45) flags.push("Acidose respiratória");
    if (alk && paco2 < 35) flags.push("Alcalose respiratória");

    if (flags.length === 0) {
      if (hco3 < 22 && paco2 < 35) flags.push("Acidose metabólica");
      else if (hco3 > 26 && paco2 > 45) flags.push("Alcalose metabólica");
    }

    if (flags.length === 0) res.primary = "Sem distúrbio primário evidente";
    else if (flags.length === 1) res.primary = flags[0];
    else { res.primary = flags.join(" + "); res.mixed = true; }

    const agHigh = res.anionGap != null && res.anionGap > 12;
    if (flags.includes("Acidose metabólica")) {
      res.primary += agHigh ? " com ânion gap aumentado" : " com ânion gap normal (hiperclorêmica)";
    }

    const course: AbgCourse = i.course ?? "undefined";

    if (flags.includes("Acidose metabólica")) {
      const lo = r1(1.5 * hco3 + 8 - 2), hi = r1(1.5 * hco3 + 8 + 2);
      const verdict = paco2 >= lo && paco2 <= hi
        ? "Compensação respiratória adequada."
        : paco2 > hi
          ? "PaCO₂ acima do esperado — sugere acidose respiratória associada."
          : "PaCO₂ abaixo do esperado — sugere alcalose respiratória associada.";
      res.compensation = {
        expected: `PaCO₂ esperada (Winter): ${lo}–${hi} mmHg`,
        measured: `PaCO₂ medida: ${r1(paco2)} mmHg`,
        verdict,
      };
      if (paco2 < lo || paco2 > hi) res.mixed = true;
    } else if (flags.includes("Alcalose metabólica")) {
      const c = 0.7 * (hco3 - 24) + 40;
      const lo = r1(c - 5), hi = r1(c + 5);
      const verdict = paco2 >= lo && paco2 <= hi
        ? "Compensação respiratória adequada."
        : paco2 > hi
          ? "PaCO₂ acima do esperado — sugere acidose respiratória associada."
          : "PaCO₂ abaixo do esperado — sugere alcalose respiratória associada.";
      res.compensation = { expected: `PaCO₂ esperada: ${lo}–${hi} mmHg`, measured: `PaCO₂ medida: ${r1(paco2)} mmHg`, verdict };
      if (paco2 < lo || paco2 > hi) res.mixed = true;
    } else if (flags.includes("Acidose respiratória")) {
      const ac = r1(24 + (paco2 - 40) / 10);
      const ch = r1(24 + 3.5 * ((paco2 - 40) / 10));
      const expected = course === "acute" ? `HCO₃⁻ esperado (aguda): ${ac} mEq/L`
        : course === "chronic" ? `HCO₃⁻ esperado (crônica): ${ch} mEq/L`
        : `HCO₃⁻ esperado — aguda: ${ac} · crônica: ${ch} mEq/L`;
      const ref = course === "chronic" ? ch : ac;
      const tol = 2;
      const verdict = course === "undefined"
        ? (hco3 >= Math.min(ac, ch) - tol && hco3 <= Math.max(ac, ch) + tol
            ? "HCO₃⁻ compatível com resposta compensatória (curso indefinido)."
            : "HCO₃⁻ fora das faixas aguda e crônica — possível distúrbio misto.")
        : (Math.abs(hco3 - ref) <= tol
            ? "Compensação metabólica adequada."
            : hco3 > ref ? "HCO₃⁻ acima do esperado — sugere alcalose metabólica associada."
                         : "HCO₃⁻ abaixo do esperado — sugere acidose metabólica associada.");
      res.compensation = { expected, measured: `HCO₃⁻ medido: ${r1(hco3)} mEq/L`, verdict };
      if (verdict.includes("associada") || verdict.includes("misto")) res.mixed = true;
    } else if (flags.includes("Alcalose respiratória")) {
      const ac = r1(24 - 2 * ((40 - paco2) / 10));
      const ch = r1(24 - 4.5 * ((40 - paco2) / 10));
      const expected = course === "acute" ? `HCO₃⁻ esperado (aguda): ${ac} mEq/L`
        : course === "chronic" ? `HCO₃⁻ esperado (crônica): ${ch} mEq/L`
        : `HCO₃⁻ esperado — aguda: ${ac} · crônica: ${ch} mEq/L`;
      const ref = course === "chronic" ? ch : ac;
      const tol = 2;
      const verdict = course === "undefined"
        ? (hco3 >= Math.min(ac, ch) - tol && hco3 <= Math.max(ac, ch) + tol
            ? "HCO₃⁻ compatível com resposta compensatória (curso indefinido)."
            : "HCO₃⁻ fora das faixas aguda e crônica — possível distúrbio misto.")
        : (Math.abs(hco3 - ref) <= tol
            ? "Compensação metabólica adequada."
            : hco3 > ref ? "HCO₃⁻ acima do esperado — sugere alcalose metabólica associada."
                         : "HCO₃⁻ abaixo do esperado — sugere acidose metabólica associada.");
      res.compensation = { expected, measured: `HCO₃⁻ medido: ${r1(hco3)} mEq/L`, verdict };
      if (verdict.includes("associada") || verdict.includes("misto")) res.mixed = true;
    }
  }

  if (i.lactate != null) {
    extras.push({
      label: "Lactato",
      value: `${r1(i.lactate)} mmol/L`,
      tone: i.lactate >= 4 ? "critical" : i.lactate > 2 ? "attention" : "normal",
    });
  }
  if (i.ketones) extras.push({ label: "Cetonas", value: i.ketones });
  if (res.hco3Calc != null) extras.push({ label: "HCO₃⁻ calculado", value: `${res.hco3Calc} mEq/L` });

  return res;
}

export const ABG_DISCLAIMER =
  "Ferramenta de apoio educacional. Interpretar em conjunto com contexto clínico, eletrólitos séricos, tempo de evolução, ventilação mecânica, função renal e protocolo institucional. Não gera diagnóstico definitivo, prescrição ou conduta.";
