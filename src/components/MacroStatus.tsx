import type { Patient } from "@/data/patients";
import {
  Wind, HeartPulse, Droplets, Pill, Moon, Biohazard, Utensils,
  Bandage, Activity, Clock, Syringe, Thermometer,
} from "lucide-react";
import { onMechanicalVentilation, onVasoactive, lengthOfStay } from "@/lib/management";
import { detectAntibiotic } from "@/lib/clinical";
import { summarizeLPP } from "@/lib/lpp";

type Tone = "critical" | "attention" | "stable" | "device" | "neuro" | "resp" | "nutri" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  critical: "border-clinical-critical/40 bg-clinical-critical/10 text-clinical-critical",
  attention: "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention",
  stable: "border-clinical-stable/40 bg-clinical-stable/10 text-clinical-stable",
  device: "border-clinical-device/40 bg-clinical-device/10 text-clinical-device",
  neuro: "border-clinical-neuro/40 bg-clinical-neuro/10 text-clinical-neuro",
  resp: "border-clinical-resp/40 bg-clinical-resp/10 text-clinical-resp",
  nutri: "border-clinical-nutri/40 bg-clinical-nutri/10 text-clinical-nutri",
  neutral: "border-border bg-surface-2 text-muted-foreground",
};

export interface MacroFlag {
  key: string;
  label: string;
  short: string;
  tone: Tone;
  Icon: typeof Wind;
}

const activeDevices = (p: Patient) => (p.devices ?? []).filter((d) => !d.removedAt);

/** Sinalizadores macro derivados do estado atual do paciente. */
export function macroFlags(p: Patient): MacroFlag[] {
  const out: MacroFlag[] = [];
  const devices = activeDevices(p);
  const meds = (p.medications ?? []).filter((m) => m.active !== false);
  const medNames = meds.map((m) => `${m.pump?.pumpDrugName ?? ""} ${m.name ?? ""}`).join(" ");

  if (onMechanicalVentilation(p)) {
    const tqt = devices.some((d) => d.typeCode === "TQT");
    out.push({
      key: "vm", tone: "resp", Icon: Wind,
      short: tqt ? "TQT" : "VM",
      label: tqt ? "Ventilação mecânica via traqueostomia" : "Ventilação mecânica invasiva",
    });
  }
  if (onVasoactive(p)) {
    out.push({ key: "dva", tone: "critical", Icon: HeartPulse, short: "DVA", label: "Em droga vasoativa" });
  }
  const dialysis = devices.some((d) => d.typeCode === "HD_CAT")
    || /crrt|hemodi|di(á|a)lise|hdi|secc/i.test(`${p.state?.renal ?? ""} ${devices.map((d) => d.label ?? "").join(" ")}`);
  if (dialysis) {
    out.push({ key: "trs", tone: "neuro", Icon: Droplets, short: "TRS", label: "Terapia renal substitutiva" });
  }
  const atb = meds.filter((m) => detectAntibiotic(m.name ?? ""));
  if (atb.length) {
    out.push({ key: "atb", tone: "attention", Icon: Pill, short: `ATB ${atb.length}`, label: `Antimicrobiano em curso: ${atb.map((m) => m.name).join(", ")}` });
  }
  if (/fentan|midazol|propofol|dexmedet|morfina|cetamina|ketamina/i.test(medNames)) {
    out.push({ key: "sed", tone: "neuro", Icon: Moon, short: "SED", label: "Sedação / analgesia contínua" });
  }
  const positives = (p.cultures ?? []).filter((c) => c.result === "positiva");
  if (positives.length) {
    out.push({ key: "cult", tone: "critical", Icon: Biohazard, short: `CULT ${positives.length}`, label: `Cultura(s) positiva(s): ${positives.map((c) => c.organism ?? c.source).filter(Boolean).join(", ")}` });
  }
  if (devices.some((d) => d.category === "enteral")) {
    out.push({ key: "nut", tone: "nutri", Icon: Utensils, short: "NE", label: "Nutrição enteral / sonda" });
  }
  if (devices.some((d) => d.category === "venous_central")) {
    out.push({ key: "cvc", tone: "device", Icon: Syringe, short: "CVC", label: "Acesso venoso central" });
  }
  const lpp = summarizeLPP(p.pressureInjuries);
  if (lpp.totalActive > 0) {
    out.push({ key: "lpp", tone: "attention", Icon: Bandage, short: `LPP ${lpp.totalActive}`, label: `${lpp.totalActive} lesão(ões) por pressão ativa(s)` });
  }
  if (/febr|hipertermi/i.test(p.state?.temp ?? "")) {
    out.push({ key: "temp", tone: "critical", Icon: Thermometer, short: "FEBRE", label: "Temperatura alterada" });
  }
  const los = lengthOfStay(p);
  if (los >= 14) {
    out.push({ key: "los", tone: "neutral", Icon: Clock, short: `D${los}`, label: `Internação prolongada na UTI (${los} dias)` });
  }
  if (!out.length) {
    out.push({ key: "ok", tone: "stable", Icon: Activity, short: "SEM SUPORTE", label: "Sem suporte orgânico artificial em curso" });
  }
  return out;
}

/** Faixa compacta de ícones clínicos para leitura macro do paciente. */
export function MacroStatusBar({ patient, compact = false }: { patient: Patient; compact?: boolean }) {
  const flags = macroFlags(patient);
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`} aria-label="Resumo macro do paciente">
      {flags.map((f) => (
        <span
          key={f.key}
          title={f.label}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] ${
            compact ? "text-[9px]" : "text-[10px]"
          } ${TONE_CLASS[f.tone]}`}
        >
          <f.Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.2} />
          {f.short}
        </span>
      ))}
    </div>
  );
}
