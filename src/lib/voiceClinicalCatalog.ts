import { DEVICE_TYPES, type DeviceTypeDef } from "@/data/devices";

/**
 * Vocabulário clínico do ditado. Este catálogo é deliberadamente separado da
 * interface: cada termo aponta para um campo ou dispositivo que o painel
 * realmente sabe salvar. Não usamos distância textual global para escolher
 * dispositivos, pois "IT" e "TOT" não são equivalentes clinicamente.
 */
export const VITAL_VOICE_FIELDS = [
  { key: "fcMax", label: "Frequência cardíaca", aliases: ["fc", "frequência cardíaca", "frequencia cardiaca"], unit: "bpm" },
  { key: "pam", label: "Pressão arterial média (PAM)", aliases: ["pam", "pressão arterial média", "pressao arterial media"], unit: "mmHg" },
  { key: "pas", label: "Pressão arterial sistólica", aliases: ["pas", "pressão sistólica", "pressao sistolica"], unit: "mmHg" },
  { key: "pad", label: "Pressão arterial diastólica", aliases: ["pad", "pressão diastólica", "pressao diastolica"], unit: "mmHg" },
  { key: "fr", label: "Frequência respiratória", aliases: ["fr", "frequência respiratória", "frequencia respiratoria"], unit: "ipm" },
  { key: "spo2", label: "Saturação", aliases: ["saturação", "saturacao", "spo2", "sat"], unit: "%" },
  { key: "temp", label: "Temperatura", aliases: ["temperatura", "temp"], unit: "°C" },
  { key: "fio2", label: "FiO₂", aliases: ["fio2", "fi o2", "fio dois"], unit: "%" },
  { key: "glicemia", label: "Glicemia", aliases: ["glicemia", "glicose", "hgt"], unit: "mg/dL" },
  { key: "diurese24", label: "Diurese 24h", aliases: ["diurese 24h", "diurese total"], unit: "mL" },
  { key: "balancoHidrico", label: "Balanço hídrico", aliases: ["balanço hídrico", "balanco hidrico", "balanço", "balanco", "bh"], unit: "mL" },
] as const;

const fold = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const hasTerm = (text: string, term: string) => new RegExp(`(?:^|[^a-z0-9])${fold(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(fold(text));

const DEVICE_ALIASES: Record<string, string[]> = {
  TOT: ["iot", "intubação orotraqueal", "intubacao orotraqueal", "tubo oro", "tubo orotraqueal"],
  TNT: ["intubação nasotraqueal", "intubacao nasotraqueal", "tubo nasotraqueal"],
  TQT: ["traqueo", "traqueostomia"],
  CVC_JUG: ["cvc jugular", "cvc de jugular", "central jugular"],
  CVC_SUB: ["cvc subclávia", "cvc subclavia", "central subclávia", "central subclavia"],
  CVC_FEM: ["cvc femoral", "central femoral"],
  PAI_RAD: ["pai radial", "pressão invasiva radial", "pressao invasiva radial"],
  PAI_FEM: ["pai femoral", "pressão invasiva femoral", "pressao invasiva femoral"],
  SVD: ["sonda vesical", "sonda de demora", "foley"],
  SVA: ["sonda de alívio", "sonda de alivio"],
  SNG: ["sonda nasogástrica", "sonda nasogastrica"],
  SNE: ["sonda nasoenteral", "sonda enteral"],
  DRT: ["dreno torácico", "dreno toracico", "toracostomia"],
  DVE: ["dve", "derivação ventricular", "derivacao ventricular"],
  PICmon: ["monitor de pic", "pic monitor"],
};

export type DeviceVoiceMatch = { device: DeviceTypeDef; confidence: "exact" | "inferred"; clinicalName?: string };

/** Retorna apenas termos clinicamente mapeados; nunca troca IT por TOT por proximidade gráfica. */
export function matchVoiceDevice(text: string, allowAmbiguousIot = false): DeviceVoiceMatch | undefined {
  const normalized = fold(text);
  // "IT" isolado é ruído frequente do STT para IOT. Só sugerimos IOT na aba
  // de invasões, sempre com confirmação posterior.
  if (allowAmbiguousIot && /(?:^|[^a-z])it(?:$|[^a-z])/i.test(normalized)) {
    const device = DEVICE_TYPES.find((item) => item.code === "TOT");
    return device ? { device, confidence: "inferred", clinicalName: "Intubação orotraqueal (IOT)" } : undefined;
  }
  for (const device of DEVICE_TYPES) {
    const terms = [device.code, device.label, ...(DEVICE_ALIASES[device.code] ?? [])];
    if (terms.some((term) => hasTerm(text, term))) {
      return { device, confidence: "exact", clinicalName: device.code === "TOT" ? "Intubação orotraqueal (IOT)" : undefined };
    }
  }
  return undefined;
}

/** Hipóteses relevantes à aba, para o profissional escolher quando o STT falhar. */
export function voiceDeviceSuggestions(text: string): DeviceVoiceMatch[] {
  const words = fold(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  const ranked = DEVICE_TYPES.map((device) => {
    const terms = [device.code, device.label, ...(DEVICE_ALIASES[device.code] ?? [])].map(fold);
    const score = words.reduce((value, word) => value + (terms.some((term) => term.includes(word) || word.includes(term)) ? 1 : 0), 0);
    return { device, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  return ranked.map(({ device }) => ({ device, confidence: "inferred", clinicalName: device.code === "TOT" ? "Intubação orotraqueal (IOT)" : undefined }));
}
