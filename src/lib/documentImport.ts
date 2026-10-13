import type { Patient, TimelineEvent } from "@/data/patients";

export type DocumentImportSuggestion = {
  label: string;
  detail: string;
};

export type DocumentImportPreview = {
  patient: Patient;
  suggestions: DocumentImportSuggestion[];
};

const clean = (value: string) =>
  value.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim().replace(/[;,.]+$/, "");

const firstMatch = (text: string, expression: RegExp) => clean(expression.exec(text)?.[1] ?? "");

const numberFrom = (text: string, expression: RegExp) => {
  const raw = expression.exec(text)?.[1]?.replace(",", ".");
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
};

const addSuggestion = (
  suggestions: DocumentImportSuggestion[],
  label: string,
  detail: string,
) => suggestions.push({ label, detail });

/**
 * Extrai somente campos explícitos no documento. O texto integral também é
 * preservado como contexto da evolução prévia, sem transformá-lo em fato clínico.
 */
export function previewPatientDocumentImport(
  patient: Patient,
  documentText: string,
): DocumentImportPreview {
  const text = documentText.replace(/\r/g, "").trim().slice(0, 50_000);
  const suggestions: DocumentImportSuggestion[] = [];
  if (!text) return { patient, suggestions };

  let next: Patient = patient;
  const identityPatch: Partial<Patient> = {};

  const name = firstMatch(text, /(?:^|\n)\s*(?:paciente|nome)\s*[:\-]\s*([^\n]{3,100})/im);
  if (name && !/^(nao informado|não informado|ignorado)$/i.test(name)) {
    identityPatch.name = name;
    addSuggestion(suggestions, "Nome", name);
  }

  const bed = firstMatch(text, /(?:^|\n)\s*(?:leito|bed)\s*[:#\-]?\s*([a-z0-9][a-z0-9\-/]{0,30})/im);
  if (bed) {
    identityPatch.bed = bed;
    addSuggestion(suggestions, "Leito", bed);
  }

  const age =
    numberFrom(text, /(?:idade)\s*[:\-]?\s*(\d{1,3})\s*(?:anos?)?/i) ??
    numberFrom(text, /\b(\d{1,3})\s*anos\b/i);
  if (age !== undefined && age > 0 && age < 130) {
    identityPatch.age = age;
    addSuggestion(suggestions, "Idade", `${age} anos`);
  }

  const sex = firstMatch(text, /(?:sexo)\s*[:\-]?\s*(masculino|feminino|masc\.?|fem\.?|m|f)\b/i);
  if (sex) {
    identityPatch.sex = /^f|femin/i.test(sex) ? "F" : "M";
    addSuggestion(suggestions, "Sexo", identityPatch.sex);
  }

  const weight = numberFrom(text, /(?:peso)\s*[:\-]?\s*(\d{1,3}(?:[,.]\d+)?)\s*kg\b/i);
  if (weight !== undefined && weight > 0 && weight < 400) {
    identityPatch.weight = weight;
    addSuggestion(suggestions, "Peso", `${weight} kg`);
  }

  const height = numberFrom(text, /(?:altura|estatura)\s*[:\-]?\s*(\d{2,3})\s*(?:cm)?\b/i);
  if (height !== undefined && height > 40 && height < 260) {
    identityPatch.height = height;
    addSuggestion(suggestions, "Altura", `${height} cm`);
  }

  next = { ...next, ...identityPatch };

  const statePatch: Partial<Patient["state"]> = {};
  const pasPad = /(?:\bpa\b|press[aã]o arterial)\s*[:=\-]?\s*(\d{2,3})\s*(?:x|\/|por)\s*(\d{2,3})/i.exec(text);
  if (pasPad) {
    const pas = Number(pasPad[1]);
    const pad = Number(pasPad[2]);
    statePatch.pas = pas;
    statePatch.pad = pad;
    statePatch.pam = Math.round((pas + 2 * pad) / 3);
    addSuggestion(suggestions, "Pressão arterial", `${pas}/${pad} mmHg · PAM ${statePatch.pam}`);
  }

  const numericFields: Array<{
    key: keyof Patient["state"];
    label: string;
    expression: RegExp;
    unit: string;
    valid: (value: number) => boolean;
  }> = [
    { key: "fcMax", label: "Frequência cardíaca", expression: /(?:\bfc\b|frequ[eê]ncia card[ií]aca)\s*[:=\-]?\s*(\d{2,3})/i, unit: "bpm", valid: (value) => value >= 20 && value <= 280 },
    { key: "fr", label: "Frequência respiratória", expression: /(?:\bfr\b|frequ[eê]ncia respirat[oó]ria)\s*[:=\-]?\s*(\d{1,3})/i, unit: "ipm", valid: (value) => value >= 4 && value <= 100 },
    { key: "spo2", label: "Saturação", expression: /(?:spo2|sat(?:ura[cç][aã]o)?)\s*[:=\-]?\s*(\d{2,3})\s*%?/i, unit: "%", valid: (value) => value >= 40 && value <= 100 },
    { key: "temp", label: "Temperatura", expression: /(?:temperatura|\btemp\b)\s*[:=\-]?\s*(\d{2}(?:[,.]\d+)?)/i, unit: "°C", valid: (value) => value >= 25 && value <= 45 },
    { key: "fio2", label: "FiO₂", expression: /(?:fio2|fi\s*o2)\s*[:=\-]?\s*(\d{1,3})\s*%?/i, unit: "%", valid: (value) => value >= 21 && value <= 100 },
    { key: "glicemia", label: "Glicemia", expression: /(?:glicemia|glicose|\bhgt\b)\s*[:=\-]?\s*(\d{2,3})/i, unit: "mg/dL", valid: (value) => value >= 10 && value <= 900 },
    { key: "glasgow", label: "Glasgow", expression: /(?:glasgow|\bgcs\b)\s*[:=\-]?\s*(\d{1,2})/i, unit: "", valid: (value) => value >= 3 && value <= 15 },
    { key: "rass", label: "RASS", expression: /(?:\brass\b)\s*[:=\-]?\s*([+-]?\d)/i, unit: "", valid: (value) => value >= -5 && value <= 4 },
    { key: "pam", label: "PAM", expression: /(?:press[aã]o arterial m[eé]dia|\bpam\b)\s*[:=\-]?\s*(\d{2,3})/i, unit: "mmHg", valid: (value) => value >= 20 && value <= 200 },
  ];

  numericFields.forEach(({ key, label, expression, unit, valid }) => {
    const value = numberFrom(text, expression);
    if (value === undefined || !valid(value)) return;
    statePatch[key] = value as never;
    addSuggestion(suggestions, label, `${value}${unit ? ` ${unit}` : ""}`);
  });

  if (Object.keys(statePatch).length) {
    next = { ...next, state: { ...next.state, ...statePatch } };
  }

  const allergiesLine = firstMatch(text, /(?:^|\n)\s*alergias?\s*[:\-]\s*([^\n]{2,500})/im);
  if (allergiesLine && !/nega|nenhuma|sem alergia/i.test(allergiesLine)) {
    const allergies = allergiesLine
      .split(/[,;•]/)
      .map(clean)
      .filter((item) => item.length > 1)
      .slice(0, 12);
    if (allergies.length) {
      next = { ...next, allergies };
      addSuggestion(suggestions, "Alergias", allergies.join(", "));
    }
  }

  const diagnosisLines = text
    .split("\n")
    .flatMap((line) => {
      const value = /(?:diagn[oó]sticos?|hip[oó]teses? diagn[oó]sticas?|\bhd\b)\s*[:\-]\s*(.{3,300})/i.exec(line)?.[1];
      return value ? value.split(/[;•]/).map(clean) : [];
    })
    .filter((item) => item.length >= 3 && item.length <= 220)
    .slice(0, 8);

  if (diagnosisLines.length) {
    const date = new Date().toISOString();
    const additions: TimelineEvent[] = diagnosisLines
      .filter(
        (label) =>
          !next.diagnoses.some(
            (diagnosis) => diagnosis.label.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"),
          ),
      )
      .map((label) => ({ date, label, kind: "attention", category: "current" }));
    if (additions.length) {
      next = { ...next, diagnoses: [...next.diagnoses, ...additions] };
      addSuggestion(suggestions, "Diagnósticos atuais", additions.map((item) => item.label).join("; "));
    }
  }

  const sourceNote = `[Documento importado em ${new Date().toLocaleString("pt-BR")}]\n${text}`;
  next = {
    ...next,
    priorEvolution: [next.priorEvolution?.trim(), sourceNote].filter(Boolean).join("\n\n"),
  };
  addSuggestion(suggestions, "Documento de origem", "Texto integral preservado na evolução prévia para revisão.");

  return { patient: next, suggestions };
}
