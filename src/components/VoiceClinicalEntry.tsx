import { useRef, useState } from "react";
import { Mic, Square, Loader2, Check, ClipboardCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { transcribeVoice } from "@/lib/live/voice.functions";
import type { Conduct, InvasiveDevice, Medication, Patient, TimelineEvent } from "@/data/patients";
import { DEVICE_TYPES } from "@/data/devices";

type Proposal = { label: string; detail: string };

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

function proposalFromTranscript(patient: Patient, transcript: string) {
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
    { key: "glicemia", label: "Glicemia", expression: /(?:glicemia|hgt)\s*(?:de|=)?\s*(\d{2,3})/i, unit: "mg/dL" },
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
  const foundDevice = DEVICE_TYPES.find((device) => low.includes(device.label.toLocaleLowerCase("pt-BR")) || low.includes(device.code.toLocaleLowerCase("pt-BR")));
  if (foundDevice && /(?:inserir|instalar|passar|dispositivo|cateter|sonda|dreno|tubo)/i.test(text)) {
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

export function VoiceClinicalEntry({ patient, onApply }: { patient: Patient; onApply: (next: Patient) => void }) {
  const runTranscribe = useServerFn(transcribeVoice);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const draft = proposalFromTranscript(patient, transcript);

  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); setRecording(false); return; }
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
    onApply({
      ...patient,
      state: {
        ...patient.state,
        ...draft.state,
        notes: [patient.state.notes, `[Ditado ${new Date().toLocaleString("pt-BR")}]: ${transcript.trim()}`]
          .filter(Boolean)
          .join("\n"),
      },
      medications: [...patient.medications, ...draft.medications],
      devices: [...(patient.devices ?? []), ...draft.devices],
      diagnoses: [...patient.diagnoses, ...draft.diagnoses],
      conducts: [...patient.conducts, ...draft.conducts],
    });
    setTranscript("");
  };

  return <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-semibold">Registro clínico por voz</p><p className="text-[11px] text-muted-foreground">Dite os dados; revise cada proposta antes de confirmar. O áudio não é armazenado.</p></div>
      <Button type="button" size="sm" variant={recording ? "destructive" : "outline"} onClick={toggleRecording} disabled={transcribing}>
        {transcribing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : recording ? <Square className="mr-1 h-3.5 w-3.5" /> : <Mic className="mr-1 h-4 w-4" />}
        {transcribing ? "Transcrevendo" : recording ? "Parar ditado" : "Ditar"}
      </Button>
    </div>
    <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Ex.: PA 120 por 70, FC 86, saturação 96, temperatura 37, Glasgow 15. Conduta: reavaliar em duas horas." className="mt-3 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
    {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    {!!transcript.trim() && <div className="mt-3 rounded-lg border bg-background/80 p-2">
      <p className="flex items-center gap-1 text-xs font-semibold"><ClipboardCheck className="h-3.5 w-3.5" /> Proposta para revisão</p>
      {draft.proposals.length ? <ul className="mt-1 space-y-1 text-xs">{draft.proposals.map((item, index) => <li key={`${item.label}-${index}`}><b>{item.label}:</b> {item.detail}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">Nenhum comando estruturado reconhecido. Ajuste o texto antes de confirmar.</p>}
      <div className="mt-2 flex justify-end"><Button type="button" size="sm" onClick={apply} disabled={!draft.proposals.length}><Check className="mr-1 h-4 w-4" />Confirmar e aplicar</Button></div>
    </div>}
  </section>;
}
