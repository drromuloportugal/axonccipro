/**
 * Abreviações faladas e apelidos frequentes em UTI.
 * Só servem para reconhecimento do comando de voz; o prontuário sempre grava
 * o nome padronizado do princípio ativo.
 */
export const MEDICATION_ALIASES: Record<string, string> = {
  // Vasoativos / inotrópicos
  nora: "Noradrenalina",
  norad: "Noradrenalina",
  nor: "Noradrenalina",
  adre: "Adrenalina",
  epi: "Adrenalina",
  epinefrina: "Adrenalina",
  dobuta: "Dobutamina",
  dobut: "Dobutamina",
  vaso: "Vasopressina",
  vasop: "Vasopressina",
  nipride: "Nitroprussiato",
  nitro: "Nitroprussiato",

  // Sedação, analgesia e bloqueio
  fenta: "Fentanil",
  fen: "Fentanil",
  mida: "Midazolam",
  midaz: "Midazolam",
  propo: "Propofol",
  dex: "Dexmedetomidina",
  dexa: "Dexmedetomidina",
  cisa: "Cisatracúrio",

  // Infusões frequentes
  insulina: "Insulina regular",
  hepa: "Heparina",
  amio: "Amiodarona",
  atrop: "Atropina",
  atropina: "Atropina",
  lido: "Lidocaína",
  lidocaina: "Lidocaína",
  magnesio: "Sulfato de magnésio",
  calcio: "Gluconato de cálcio",
  bicarb: "Bicarbonato de sódio",
  txa: "Ácido tranexâmico",
  tranexamico: "Ácido tranexâmico",
  hidro: "Hidrocortisona",
};

export function medicationNameFromSpeech(text: string): string | undefined {
  const normalized = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return Object.entries(MEDICATION_ALIASES).find(([alias]) =>
    new RegExp(`(?:^|[^a-z])${alias}(?:$|[^a-z])`, "i").test(normalized),
  )?.[1];
}
