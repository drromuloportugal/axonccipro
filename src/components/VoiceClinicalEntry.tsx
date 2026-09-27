import { useRef, useState } from "react";
import { Mic, Square, Loader2, Check, ClipboardCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { transcribeVoice } from "@/lib/live/voice.functions";
import type { Conduct, InvasiveDevice, Medication, Patient, TimelineEvent } from "@/data/patients";
import { DEVICE_TYPES } from "@/data/devices";

type Proposal = { label: string; detail: string };
type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type BrowserRecognitionConstructor = new () => BrowserRecognition;

const numberAfter = (text: string, expression: RegExp) => {
  const value = expression.exec(text)?.[1]?.replace(",", ".");
  return value === undefined ? undefined : Number(value);
};

const b64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

export function proposalFromTranscript(patient: Patient, transcript: string) {
  const text = transcript.trim();
  const low = text.toLocaleLowerCase("pt-BR");
  const state: Partial<Patient["state"]> = {};
  const proposals: Proposal[] = [];

  const pa = /(?:press[aã]o|pa)\s*(?:arterial)?\s*(\d{2,3})\s*(?:por|\/)\s*(\d{2,3})/i.exec(text);
  if (pa) {
    state.pas = Number(pa[1]); state.pad = Number(pa[2]); state.pam = Math.round((state.pas + 2 * state.pad) / 3);
    proposals.push({ label: "Pressão arterial", detail: `${state.pas}/${state.pad} mmHg (PAM calculada ${state.pam})` });
  }
  const fields: { key: keyof Patient["state"]; label: string; expression: RegExp; unit: string }[] = [
    { key: "fcMax", label: "Frequência cardíaca", expression: /(?:fc|frequ[eê]ncia card[ií]aca)\s*(?:de|=)?\s*(\d{2,3})/i, unit: "bpm" },
    { key: "fr", label: "Frequência respiratória", expression: /(?:fr|frequ[eê]ncia respirat[oó]ria)\s*(?:de|=)?\s*(\d{1,3})/i, unit: "ipm" },
    { key: "spo2", label: "Saturação", expression: /(?:satura[cç][aã]o|spo2|sat)\s*(?:de|=)?\s*(\d{2,3})/i, unit: "%" },
    { key: "temp", label: "Temperatura", expression: /(?:temperatura|temp)\s*(?:de|=)?\s*(\d{2}(?:[,.]\d+)?)/i, unit: "°C" },
    { key: "fio2", label: "FiO₂", expression: /(?:fio2|fi o2)\s*(?:de|=)?\s*(\d{1,3})/i, unit: "%" },
    { key: "glicemia", label: "Glicemia", expression: /(?:glicemia|glicose|hgt)\s*(?:de|=)?\s*(\d{2,3})/i, unit: "mg/dL" },
    { key: "diurese24", label: "Diurese 24h", expression: /(?:diurese 24h|diurese total)\s*(?:de|=)?\s*(\d{1,5})/i, unit: "mL" },
    { key: "balancoHidrico", label: "Balanço hídrico", expression: /balan[cç]o h[ií]drico\s*(?:de|=)?\s*([+-]?\d{1,5})/i, unit: "mL" },
  ];
  fields.forEach(({ key, label, expression, unit }) => {
    const value = numberAfter(text, expression);
    if (value !== undefined && Number.isFinite(value)) {
      (state as Record<string, number>)[key] = value;
      proposals.push({ label, detail: `${value} ${unit}` });
    }
  });
  const glasgow = numberAfter(text, /(?:glasgow|gcs)\s*(?:de|=)?\s*(\d{1,2})/i);
  if (glasgow !== undefined) { state.glasgow = glasgow; proposals.push({ label: "Glasgow", detail: String(glasgow) }); }
  const rass = numberAfter(text, /rass\s*(?:de|=)?\s*([+-]?\d)/i);
  if (rass !== undefined) { state.rass = rass; proposals.push({ label: "RASS", detail: String(rass) }); }

  const medications: Medication[] = [];
  const medication = /(?:medica[cç][aã]o|medicamento|iniciar|administrar)\s+(.+?)\s+(?:dose\s+)?(\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ui|ml))\s+(?:via\s+)?(ev|iv|vo|im|sc|sne|cne)\b(?:\s*(?:a cada|de)\s*([^,.]+))?/i.exec(text);
  if (medication) {
    medications.push({ name: medication[1].trim(), dose: medication[2], route: medication[3].toUpperCase(), freq: medication[4]?.trim() || "Conforme prescrição", start: new Date().toISOString(), kind: "neutral", active: true });
    proposals.push({ label: "Medicação", detail: `${medication[1].trim()} · ${medication[2]} · ${medication[3].toUpperCase()}` });
  }

  const devices: InvasiveDevice[] = [];
  const foundDevice =
    (/\b(?:iot|tot|tubo oro(?:traqueal)?)\b/i.test(text) ? DEVICE_TYPES.find((device) => device.code === "TOT") : undefined) ??
    DEVICE_TYPES.find((device) => low.includes(device.label.toLocaleLowerCase("pt-BR")) || low.includes(device.code.toLocaleLowerCase("pt-BR")));
  if (foundDevice && /(?:incluir|inserir|instalar|passar|dispositivo|cateter|sonda|dreno|tubo)/i.test(text)) {
    const side = /\b(?:lado\s+)?direit[oa]\b|\bD\b/i.test(text) ? "D" : /\b(?:lado\s+)?esquerd[oa]\b|\bE\b/i.test(text) ? "E" : undefined;
    const site = foundDevice.sites.find((item) => low.includes(item.toLocaleLowerCase("pt-BR"))) ?? foundDevice.sites.find((item) => side ? item.endsWith(` ${side}`) : true);
    devices.push({ id: `voice_${Date.now()}`, category: foundDevice.category, typeCode: foundDevice.code, site, side, insertedAt: new Date().toISOString(), recommendedMaxDays: foundDevice.recommendedMaxDays });
    proposals.push({ label: "Dispositivo invasivo", detail: `${foundDevice.label}${site ? ` · ${site}` : ""}` });
  }

  const diagnoses: TimelineEvent[] = [];
  const diagnosis = /(?:diagn[oó]stico|hip[oó]tese diagn[oó]stica)\s*(?:de|:)?\s*(.+?)(?:\.|$)/i.exec(text);
  if (diagnosis?.[1]) { diagnoses.push({ date: new Date().toISOString(), label: diagnosis[1].trim(), kind: "attention", category: "current" }); proposals.push({ label: "Diagnóstico atual", detail: diagnosis[1].trim() }); }

  const conducts: Conduct[] = [];
  const conduct = /(?:conduta|meta|plano|reavaliar|solicitar)\s*(?:de|:)?\s*(.+?)(?:\.|$)/i.exec(text);
  if (conduct?.[1]) { conducts.push({ team: "Médica", text: conduct[1].trim(), system: "other", startedAt: new Date().toISOString() }); proposals.push({ label: "Conduta / plano", detail: conduct[1].trim() }); }

  // A transcrição inteira é preservada como evolução; assim informações ainda
  // não mapeadas em campo estruturado não se perdem nem são interpretadas como fato.
  if (text) proposals.push({ label: "Evolução ditada", detail: text });
  return { state, medications, devices, diagnoses, conducts, proposals };
}

/** Aplica somente os campos explicitamente reconhecidos no comando de voz. */
export function applyVoiceTranscript(patient: Patient, transcript: string) {
  const draft = proposalFromTranscript(patient, transcript);
  const at = new Date().toISOString();
  const series = { ...(patient.state.vitalSeries ?? {}) };
  const readings: { key: "glicemia" | "fc" | "temp" | "spo2" | "fr" | "pas" | "pad" | "pam"; value?: number }[] = [
    { key: "glicemia", value: draft.state.glicemia }, { key: "fc", value: draft.state.fcMax },
    { key: "temp", value: draft.state.temp }, { key: "spo2", value: draft.state.spo2 },
    { key: "fr", value: draft.state.fr }, { key: "pas", value: draft.state.pas },
    { key: "pad", value: draft.state.pad }, { key: "pam", value: draft.state.pam },
  ];
  readings.forEach(({ key, value }) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const existing = series[key] ?? [];
    series[key] = [...existing, { id: `voice_${Date.now()}_${key}`, value, at }];
  });
  return {
    proposals: draft.proposals,
    patient: {
      ...patient,
      state: {
        ...patient.state,
        ...draft.state,
        vitalSeries: series,
        notes: [patient.state.notes, `[Ditado ${new Date().toLocaleString("pt-BR")}]: ${transcript.trim()}`]
          .filter(Boolean)
          .join("\n"),
      },
      medications: [...patient.medications, ...draft.medications],
      devices: [...(patient.devices ?? []), ...draft.devices],
      diagnoses: [...patient.diagnoses, ...draft.diagnoses],
      conducts: [...patient.conducts, ...draft.conducts],
    },
  };
}

export type VoiceCommandReview = {
  proposals: Proposal[];
  missing: string[];
  suggestedColumn: "Estado atual" | "Medicações" | "Invasões" | "Plano" | "História";
  canApply: boolean;
  requiresConfirmation: boolean;
  requestedColumn?: "Estado atual" | "Medicações" | "Invasões" | "Plano" | "História";
};

const COLUMN_ALIASES: { target: VoiceCommandReview["suggestedColumn"]; patterns: RegExp[] }[] = [
  { target: "Estado atual", patterns: [/\bcoluna\s*6\b/i, /estado atual/i, /sinais vitais/i] },
  { target: "Medicações", patterns: [/\bcoluna\s*4\b/i, /medica[cç][oõ]es/i] },
  { target: "Invasões", patterns: [/\bcoluna\s*3\b/i, /invas[oõ]es|dispositivos invasivos/i] },
  { target: "Plano", patterns: [/\bcoluna\s*7\b/i, /plano|condutas?/i] },
  { target: "História", patterns: [/\bcoluna\s*2\b/i, /hist[oó]ria/i] },
];

function requestedColumn(text: string) {
  return COLUMN_ALIASES.find((entry) => entry.patterns.some((pattern) => pattern.test(text)))?.target;
}

/** Interpretação local, baseada nos catálogos e dados já existentes do paciente. */
export function reviewVoiceCommand(patient: Patient, transcript: string): VoiceCommandReview {
  const draft = proposalFromTranscript(patient, transcript);
  const low = transcript.toLocaleLowerCase("pt-BR");
  const explicitCount = Object.keys(draft.state).length + draft.medications.length + draft.devices.length + draft.diagnoses.length + draft.conducts.length;
  const medicationIntent = /medica[cç][aã]o|medicamento|iniciar|administrar/i.test(transcript);
  const deviceIntent = /iot|tot|dispositivo|cateter|sonda|dreno|tubo|incluir|inserir|instalar|passar/i.test(transcript);
  const planIntent = /conduta|meta|plano|reavaliar|solicitar/i.test(transcript);
  const missing: string[] = [];
  let suggestedColumn: VoiceCommandReview["suggestedColumn"] = "Estado atual";
  const requested = requestedColumn(transcript);

  if (medicationIntent) {
    suggestedColumn = "Medicações";
    if (!draft.medications.length) missing.push("nome, dose e via da medicação");
  } else if (deviceIntent) {
    suggestedColumn = "Invasões";
    if (!draft.devices.length) missing.push("tipo do dispositivo e sítio anatômico");
    else if (!draft.devices[0].site) missing.push("sítio anatômico do dispositivo");
  } else if (planIntent) {
    suggestedColumn = "Plano";
    if (!draft.conducts.length) missing.push("descrição da conduta ou da meta");
  } else if (explicitCount === 0) {
    const knownMedication = patient.medications.find((med) => low.includes(med.name.toLocaleLowerCase("pt-BR")));
    suggestedColumn = knownMedication ? "Medicações" : "História";
    missing.push(knownMedication ? `dose, via ou frequência para ${knownMedication.name}` : "qual dado clínico deve ser registrado e seu valor");
  }
  if (!requested) missing.unshift("informe a coluna de destino (por exemplo: “coluna 6” ou “Estado atual”)");
  else if (requested !== suggestedColumn) missing.unshift(`o comando indica ${requested}, mas a informação parece pertencer a ${suggestedColumn}`);
  return {
    proposals: draft.proposals,
    missing,
    suggestedColumn,
    canApply: explicitCount > 0 && missing.length === 0,
    // Inserção/alteração de dispositivo é exibida para conferência mesmo quando
    // a sigla e o sítio foram identificados pelo catálogo clínico.
    requiresConfirmation: deviceIntent,
    requestedColumn: requested,
  };
}

export function VoiceClinicalEntry({ patient, onApply }: { patient: Patient; onApply: (next: Patient) => void }) {
  const runTranscribe = useServerFn(transcribeVoice);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const draft = proposalFromTranscript(patient, transcript);

  const toggleRecording = async () => {
    if (recording) {
      recognitionRef.current?.stop();
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    // Chrome oferece reconhecimento de fala nativo. Ele evita enviar áudio ou
    // depender de uma chave de provedor apenas para registrar o ditado.
    const browser = window as typeof window & {
      SpeechRecognition?: BrowserRecognitionConstructor;
      webkitSpeechRecognition?: BrowserRecognitionConstructor;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (Recognition) {
      setError(null);
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const spoken = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
        if (spoken) setTranscript((current) => current ? `${current} ${spoken}` : spoken);
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") setError("O reconhecimento de fala do navegador falhou. Tente novamente ou digite o texto.");
      };
      recognition.onend = () => { setRecording(false); recognitionRef.current = null; };
      try { recognition.start(); setRecording(true); return; }
      catch { recognitionRef.current = null; }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audio.size < 1000) return;
        setTranscribing(true); setError(null);
        try {
          const result = await runTranscribe({ data: { audioBase64: await b64(audio), mimeType: audio.type } });
          if (result.text) setTranscript((current) => current ? `${current} ${result.text}` : result.text);
          else setError("Não foi possível reconhecer fala neste trecho.");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na transcrição."); }
        finally { setTranscribing(false); }
      };
      recorder.start(); setRecording(true);
    } catch { setError("Permita o uso do microfone para fazer o ditado."); }
  };

  const apply = () => {
    if (!draft.proposals.length) return;
    onApply(applyVoiceTranscript(patient, transcript).patient);
    setTranscript("");
    setApplied(true);
  };

  return <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-semibold">Registro clínico por voz</p><p className="text-[11px] text-muted-foreground">Dite os dados; revise cada proposta antes de confirmar. O áudio não é armazenado.</p></div>
      <Button type="button" size="sm" variant={recording ? "destructive" : "outline"} onClick={toggleRecording} disabled={transcribing}>
        {transcribing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : recording ? <Square className="mr-1 h-3.5 w-3.5" /> : <Mic className="mr-1 h-4 w-4" />}
        {transcribing ? "Transcrevendo" : recording ? "Parar ditado" : "Ditar"}
      </Button>
    </div>
    <textarea value={transcript} onChange={(e) => { setTranscript(e.target.value); setApplied(false); }} placeholder="Ex.: PA 120 por 70, FC 86, saturação 96, temperatura 37, Glasgow 15. Conduta: reavaliar em duas horas." className="mt-3 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
    {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    {applied && <p className="mt-2 text-xs font-medium text-emerald-700">Alterações confirmadas e aplicadas ao paciente.</p>}
    {!!transcript.trim() && <div className="mt-3 rounded-lg border bg-background/80 p-2">
      <p className="flex items-center gap-1 text-xs font-semibold"><ClipboardCheck className="h-3.5 w-3.5" /> Proposta para revisão</p>
      {draft.proposals.length ? <ul className="mt-1 space-y-1 text-xs">{draft.proposals.map((item, index) => <li key={`${item.label}-${index}`}><b>{item.label}:</b> {item.detail}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">Nenhum comando estruturado reconhecido. Ajuste o texto antes de confirmar.</p>}
      <div className="mt-2 flex justify-end"><Button type="button" size="sm" onClick={apply} disabled={!draft.proposals.length}><Check className="mr-1 h-4 w-4" />Confirmar e aplicar</Button></div>
    </div>}
  </section>;
}
