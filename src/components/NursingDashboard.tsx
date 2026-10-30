import { useEffect, useRef, useState } from "react";
import { bucketBadge, daysSinceAdmission, deviceRisk, examInsight } from "@/lib/clinical";
import type { Patient, Severity } from "@/data/patients";
import mainLogo from "@/assets/axon-critical-care-logo-transparent.png";
import { CalendarDays, ClipboardList, LogOut, Menu, ShieldCheck, Stethoscope, UserRoundCog } from "lucide-react";

type Props = {
  patients: Patient[];
  onOpenMedicalPanel: () => void;
  onSignOut: () => void;
  onUpdatePatient: (patient: Patient, previousId?: string) => void;
};

type WorkflowActivity = {
  id?: string;
  label: string;
  time: string;
  /** Horário limite para conclusão da atividade neste plantão. */
  dueAt?: string;
  type: "monitoring" | "medication" | "device" | "care";
  completed?: boolean;
  note?: string;
  important?: boolean;
  hidden?: boolean;
  source?: "default" | "custom" | "fasthug";
  scheduledDate?: string;
  repeatEveryHours?: number;
  repeatParentId?: string;
};

type FastHugStatus = "adequado" | "atencao" | "nao_aplicavel";
type FastHugCriterion = { status: FastHugStatus; note: string };
type FastHugReviewData = { criteria: Record<string, FastHugCriterion>; reviewedAt?: string };
type NursingWorkflowWithFastHug = NonNullable<Patient["nursingWorkflow"]> & { fastHugReview?: FastHugReviewData };

const severityMeta: Record<Severity, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-clinical-critical text-white" },
  attention: { label: "Atenção", className: "bg-clinical-attention text-white" },
  stable: { label: "Estável", className: "bg-clinical-stable text-white" },
};

const fastHugCriteria = [
  ["F", "Dieta e suporte nutricional"],
  ["A", "Analgesia"],
  ["S", "Sedação"],
  ["T", "Profilaxia tromboembólica"],
  ["H", "Delirium hipo ou hiperativo"],
  ["U", "Profilaxia de úlcera de estresse"],
  ["G", "Controle glicêmico"],
  ["M", "Reconciliação medicamentosa"],
  ["A", "Antimicrobianos / anti-infecciosos"],
  ["I", "Indicação de cada medicamento"],
  ["D", "Dose dos medicamentos"],
  ["E", "Eletrólitos, hematologia e demais exames"],
  ["N", "Interações, alergias, duplicidades e efeitos adversos"],
  ["S", "Datas de suspensão"],
] as const;

const activityMeta: Record<WorkflowActivity["type"], { label: string; className: string }> = {
  monitoring: {
    label: "Monitorização",
    className: "border-cyan-700/95 bg-gradient-to-br from-cyan-200/30 via-cyan-400/25 to-sky-500/30 text-slate-950",
  },
  medication: {
    label: "Medicação",
    className: "border-emerald-700/95 bg-gradient-to-br from-emerald-200/30 via-emerald-400/25 to-teal-500/30 text-slate-950",
  },
  device: {
    label: "Dispositivos",
    className: "border-violet-700/95 bg-gradient-to-br from-violet-200/30 via-violet-400/25 to-indigo-500/30 text-slate-950",
  },
  care: {
    label: "Cuidados",
    className: "border-blue-700/95 bg-gradient-to-br from-blue-200/30 via-blue-400/25 to-cyan-500/30 text-slate-950",
  },
};

function shiftPeriod() {
  const now = new Date();
  const start = new Date(now);
  if (now.getHours() < 7) start.setDate(start.getDate() - 1);
  start.setHours(7, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const date = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `07:00 de ${date(start)} até 07:00 de ${date(end)}`;
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentShiftDate() {
  const date = new Date();
  if (date.getHours() < 7) date.setDate(date.getDate() - 1);
  return localIsoDate(date);
}

function activityDeadlineTime(activity: WorkflowActivity) {
  if (activity.dueAt) return activity.dueAt;
  return timeForShiftMinute(shiftMinuteFor(activity.time) + 60);
}

function activityDeadline(activity: WorkflowActivity) {
  const referenceTime = activityDeadlineTime(activity);
  const date = new Date(`${activity.scheduledDate ?? currentShiftDate()}T${referenceTime}:00`);
  if (Number.isNaN(date.getTime())) return null;
  const [hour] = referenceTime.split(":").map(Number);
  if (Number.isFinite(hour) && hour < 7) date.setDate(date.getDate() + 1);
  return date;
}

function isActivityOverdue(activity: WorkflowActivity) {
  const deadline = activityDeadline(activity);
  return !activity.completed && !!deadline && deadline.getTime() < Date.now();
}

function overdueElapsedLabel(activity: WorkflowActivity) {
  const deadline = activityDeadline(activity);
  if (!deadline) return "ATRASADA";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - deadline.getTime()) / 60_000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `ATRASADA HÁ ${hours}H ${String(minutes).padStart(2, "0")}MIN`;
}

function activityTimelineTime(activity: WorkflowActivity) {
  return activity.dueAt ?? activity.time;
}

function activityStartColumn(time: string) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 7;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const hourOnShift = hour < 7 ? hour + 24 : hour;
  const offset = Math.max(0, Math.min(23, hourOnShift - 7 + (minute >= 30 ? 0.5 : 0)));
  return Math.floor(offset) + 1;
}

function centeredActivityColumn(time: string, span: number) {
  const hourColumn = activityStartColumn(time);
  const halfWidth = Math.floor(span / 2);
  return Math.max(1, Math.min(25 - span, hourColumn - halfWidth));
}

/** Faz a borda direita do cartão terminar na coluna do prazo. */
function deadlineActivityColumn(time: string, span: number) {
  const hourColumn = activityStartColumn(time);
  return Math.max(1, Math.min(25 - span, hourColumn - span + 1));
}

function shiftMinuteFor(time: string) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 7;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return ((hour < 7 ? hour + 24 : hour) - 7) * 60 + minute;
}

function timeForShiftMinute(totalMinutes: number) {
  const hour = (7 + Math.floor(totalMinutes / 60)) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function expandRepeatedActivities(activities: WorkflowActivity[]) {
  return activities.flatMap((activity) => {
    const everyHours = Math.floor(Number(activity.repeatEveryHours ?? 0));
    if (!Number.isFinite(everyHours) || everyHours < 1) return [activity];

    const startMinute = shiftMinuteFor(activity.time);
    const occurrences: WorkflowActivity[] = [];
    for (let minute = startMinute, occurrence = 0; minute < 24 * 60; minute += everyHours * 60, occurrence += 1) {
      occurrences.push(
        occurrence === 0
          ? activity
          : {
              ...activity,
              id: `${activity.id ?? activity.label}-repeat-${occurrence}`,
              repeatParentId: activity.id,
              time: timeForShiftMinute(minute),
            },
      );
    }
    return occurrences;
  });
}

function twelveHourColumn(time: string, dayPeriod: boolean) {
  const [rawHour] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 7;
  if (dayPeriod) return hour >= 7 && hour < 19 ? hour - 7 + 1 : null;
  const nightHour = hour < 7 ? hour + 24 : hour;
  return nightHour >= 19 && nightHour < 31 ? nightHour - 19 + 1 : null;
}
function activitiesFor(patient: Patient): WorkflowActivity[] {
  const activeMeds = patient.medications.filter((med) => med.active !== false).slice(0, 2);
  const nurseConducts = patient.conducts
    .filter((conduct) => conduct.team === "Enfermagem")
    .flatMap((conduct) => [
      ...(conduct.text ? [conduct.text] : []),
      ...(conduct.subItems ?? [])
        .filter((item) => !item.hidden && item.text)
        .map((item) => item.text),
    ])
    .slice(0, 2);
  const activeDevices = (patient.devices ?? []).filter((device) => !device.removedAt);

  const activities: WorkflowActivity[] = [
    { label: "Sinais vitais e avaliação", time: "07:00", type: "monitoring" },
    ...activeMeds.map((med, index) => ({
      label: `Administrar ${med.name}`,
      time: index === 0 ? "09:00" : "15:00",
      type: "medication" as const,
    })),
  ];

  if (activeDevices.length) {
    activities.push({
      label: `Checar ${activeDevices.length} invasão(ões)`,
      time: "19:00",
      type: "device",
    });
  }

  activities.push({
    label: "REVISÃO FASTHUG",
    time: "17:00",
    type: "care",
    source: "fasthug",
  });

  activities.push(
    ...(nurseConducts.length
      ? nurseConducts.map((label, index) => ({
          label,
          time: index === 0 ? "23:00" : "03:00",
          type: "care" as const,
        }))
      : [{ label: "Balanço hídrico e reavaliação", time: "23:00", type: "care" as const }]),
  );

  return activities;
}

function workflowActivitiesForToday(patient: Patient): WorkflowActivity[] {
  const storedActivities = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
  const baseActivities = activitiesFor(patient).map((activity, index) => ({
    ...activity,
    id: `base-${index}`,
    source: activity.source ?? "default" as const,
  }));

  return expandRepeatedActivities([
    ...baseActivities
      .map((activity) => ({ ...activity, ...(storedActivities.find((item) => item.id === activity.id) ?? {}) }))
      .filter((activity) => !activity.hidden),
    ...storedActivities.filter((activity) =>
      !baseActivities.some((base) => base.id === activity.id)
      && !activity.hidden
      && (!activity.scheduledDate || activity.scheduledDate === currentShiftDate()),
    ),
  ]);
}

function icuDays(patient: Patient) {
  const elapsedDays = daysSinceAdmission(patient.admissionICU);
  return elapsedDays === null ? null : elapsedDays + 1;
}

function currentDiagnosis(patient: Patient) {
  const current = patient.diagnoses.filter((diagnosis) => diagnosis.category === "current");
  return (current.at(-1) ?? patient.diagnoses.at(-1))?.label ?? "Não informado";
}

function listItems(items: string[], empty = "Não informado") {
  if (!items.length) return <p className="text-[11px] italic text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-[11px] leading-snug text-foreground">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="ios-inset border-l-2 border-primary/45 px-2 py-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

type ResultState = "pending" | "changed" | "normal";

const resultStateMeta: Record<ResultState, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border-clinical-attention/40 bg-clinical-attention/10 text-ink" },
  changed: { label: "Alterado", className: "border-clinical-critical/40 bg-clinical-critical/10 text-ink" },
  normal: { label: "Sem alteração", className: "border-clinical-stable/40 bg-clinical-stable/10 text-ink" },
};

function resultItems(items: { text: string; state: ResultState }[], empty: string) {
  if (!items.length) return <p className="text-[11px] italic text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, index) => {
        const meta = resultStateMeta[item.state];
        return <li key={`${item.text}-${index}`} className={`rounded border px-2 py-1 text-[10px] leading-snug ${meta.className}`}>{item.text}</li>;
      })}
    </ul>
  );
}

function labAppearance(bucket: string | null, critical?: boolean) {
  if (critical || bucket === "very_low" || bucket === "very_high") {
    return "border-clinical-critical/45 bg-clinical-critical/10 text-clinical-critical";
  }
  if (bucket === "low") return "border-clinical-attention/45 bg-clinical-attention/10 text-clinical-attention";
  if (bucket === "high") return "border-clinical-device/45 bg-clinical-device/10 text-clinical-device";
  return "border-clinical-stable/45 bg-clinical-stable/10 text-clinical-stable";
}

function deviceBarAppearance(level?: string) {
  if (level === "red") return "bg-clinical-critical";
  if (level === "orange") return "bg-clinical-device";
  if (level === "yellow") return "bg-clinical-attention";
  return "bg-clinical-stable";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="title-box mb-3 !text-[10px]">{children}</h3>;
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function ReadLines({ value, empty = "Não informado" }: { value: string; empty?: string }) {
  const lines = splitLines(value);
  return lines.length ? <div className="space-y-1 text-[11px] font-semibold text-foreground">{lines.map((line, index) => <p key={`${line}-${index}`} className="ios-inset px-2 py-1">{line}</p>)}</div> : <p className="text-[11px] italic text-muted-foreground">{empty}</p>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-[10px] font-bold uppercase text-muted-foreground">{label}<input type={type} className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold text-foreground" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SbarPanel({ patient, onClose, onUpdatePatient }: { patient: Patient; onClose: () => void; onUpdatePatient: (patient: Patient, previousId?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [identity, setIdentity] = useState(() => ({ name: patient.name, bed: patient.bed, id: patient.id, age: String(patient.age), sex: patient.sex, admissionICU: patient.admissionICU, expectedDischarge: patient.dischargeCheck?.expectedTransfer ?? "" }));
  const [diagnosis, setDiagnosis] = useState(() => currentDiagnosis(patient));
  const [situationObservation, setSituationObservation] = useState(() => patient.nursingWorkflow?.situationObservation ?? "");
  const [consciousnessState, setConsciousnessState] = useState(() => patient.nursingWorkflow?.consciousnessState ?? "Não informado");
  const [severity, setSeverity] = useState<Severity>(() => patient.severity);
  const [baseConditions, setBaseConditions] = useState(() => patient.diagnoses.filter((item) => item.category === "previous" || item.category === "inactive").map((item) => item.label).join("\n"));
  const [surgeries, setSurgeries] = useState(() => patient.procedures.map((item) => item.label).join("\n"));
  const [allergies, setAllergies] = useState(() => patient.allergies.filter((item) => item !== "—").join("\n"));
  const [chronicMeds, setChronicMeds] = useState(() => (patient.pastMedications ?? []).map((item) => [item.name, item.dose, item.route].filter(Boolean).join(" · ")).join("\n"));
  const [diet, setDiet] = useState(() => patient.state.dieta ?? "");
  const [devices, setDevices] = useState(() => (patient.devices ?? []).filter((item) => !item.removedAt).map((item) => ({ id: item.id, code: item.typeCode, site: item.site ?? "", size: item.size ?? "", lumens: item.lumens ? String(item.lumens) : "", insertedAt: item.insertedAt ? item.insertedAt.slice(0, 10) : "" })));
  const [skinCare, setSkinCare] = useState(() => patient.conducts.filter((item) => item.system === "skin").flatMap((item) => [item.text, ...(item.subItems ?? []).filter((sub) => !sub.hidden).map((sub) => sub.text)]).filter(Boolean).join("\n"));
  const [pendingLab, setPendingLab] = useState(() => patient.dischargeCheck?.pendencies?.lab ?? "");
  const [pendingImaging, setPendingImaging] = useState(() => patient.dischargeCheck?.pendencies?.imaging ?? "");
  const [pendingCultures, setPendingCultures] = useState(() => patient.dischargeCheck?.pendencies?.cultures ?? "");
  const [nursingCare, setNursingCare] = useState(() => patient.conducts.filter((item) => item.team === "Enfermagem").flatMap((item) => [item.text, ...(item.subItems ?? []).filter((sub) => !sub.hidden).map((sub) => sub.text)]).filter(Boolean).join("\n"));
  const [laboratory, setLaboratory] = useState(() => (patient.exams ?? []).map((item) => `${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`).join("\n"));
  const [imaging, setImaging] = useState(() => (patient.imaging ?? []).map((item) => [item.modality, item.region, item.summary ?? item.status ?? ""].filter(Boolean).join(" · ")).join("\n"));
  const [cultures, setCultures] = useState(() => (patient.cultures ?? []).map((item) => [item.source, item.organism, item.result].filter(Boolean).join(" · ")).join("\n"));
  const calculatedIcuDays = icuDays({ ...patient, admissionICU: identity.admissionICU });

  const saveSbar = () => {
    const currentDiagnosisIndex = patient.diagnoses.map((item) => item.category).lastIndexOf("current");
    const diagnoses = patient.diagnoses.filter((_, index) => index !== currentDiagnosisIndex && !["previous", "inactive"].includes(patient.diagnoses[index].category ?? ""));
    if (diagnosis.trim()) diagnoses.push({ date: "", label: diagnosis.trim(), kind: "neutral", category: "current" });
    diagnoses.push(...splitLines(baseConditions).map((label) => ({ date: "", label, kind: "neutral" as const, category: "previous" as const })));

    const deviceById = new Map(devices.map((device) => [device.id, device]));
    const nextDevices = (patient.devices ?? []).map((device) => {
      const draft = deviceById.get(device.id);
      if (!draft) return device;
      const lumens = Number(draft.lumens);
      return { ...device, typeCode: draft.code.trim() || device.typeCode, site: draft.site.trim() || undefined, size: draft.size.trim() || undefined, lumens: ([1, 2, 3, 4].includes(lumens) ? lumens : undefined) as 1 | 2 | 3 | 4 | undefined, insertedAt: draft.insertedAt || device.insertedAt };
    });

    const otherConducts = patient.conducts.filter((item) => item.team !== "Enfermagem" && item.system !== "skin");
    const nextConducts = [
      ...otherConducts,
      ...(splitLines(nursingCare).length ? [{ team: "Enfermagem" as const, text: "Cuidados de enfermagem", system: "other" as const, subItems: splitLines(nursingCare).map((text) => ({ text })) }] : []),
      ...(splitLines(skinCare).length ? [{ team: "Enfermagem" as const, text: "Pele, LPP e curativos", system: "skin" as const, subItems: splitLines(skinCare).map((text) => ({ text })) }] : []),
    ];
    const labLines = splitLines(laboratory);
    const imageLines = splitLines(imaging);
    const cultureLines = splitLines(cultures);
    const updated: Patient = {
      ...patient,
      id: identity.id.trim() || patient.id,
      name: identity.name.trim() || patient.name,
      bed: identity.bed.trim(),
      age: Number(identity.age) || patient.age,
      sex: identity.sex,
      admissionICU: identity.admissionICU,
      severity,
      nursingWorkflow: { ...patient.nursingWorkflow, situationObservation: situationObservation.trim() || undefined, consciousnessState: consciousnessState === "Não informado" ? undefined : consciousnessState },
      diagnoses,
      procedures: splitLines(surgeries).map((label) => ({ date: "", label, kind: "neutral" as const })),
      allergies: splitLines(allergies),
      pastMedications: splitLines(chronicMeds).map((name, index) => ({ id: `sbar-med-${index}`, name })),
      devices: nextDevices,
      conducts: nextConducts,
      state: { ...patient.state, dieta: diet },
      exams: patient.exams.map((exam, index) => {
        const line = labLines[index] ?? "";
        const [, value = exam.value] = line.split(/:\s*/, 2);
        return { ...exam, value: value.replace(new RegExp(`\\s*${exam.unit ?? ""}$`), "").trim() || exam.value };
      }),
      imaging: (patient.imaging ?? []).map((exam, index) => ({ ...exam, summary: imageLines[index] ?? exam.summary })),
      cultures: (patient.cultures ?? []).map((culture, index) => ({ ...culture, result: cultureLines[index] ?? culture.result })),
      dischargeCheck: {
        ...patient.dischargeCheck,
        expectedTransfer: identity.expectedDischarge,
        pendencies: { ...patient.dischargeCheck?.pendencies, lab: pendingLab, imaging: pendingImaging, cultures: pendingCultures },
      },
    };
    onUpdatePatient(updated, patient.id);
    setEditing(false);
  };

  const area = (label: string, value: string, onChange: (value: string) => void, empty?: string) => (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      {editing ? <textarea rows={3} className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[11px] font-bold" value={value} onChange={(event) => onChange(event.target.value)} placeholder={empty} /> : <ReadLines value={value} empty={empty} />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Resumo SBAR de ${patient.name}`} onClick={onClose}>
      <section className="max-h-[92vh] w-full max-w-[1600px] overflow-y-auto rounded-xl border border-border bg-soft-blue-gradient shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="neto-glass sticky top-0 z-10 flex items-center justify-between px-5 py-4 text-neto-foreground backdrop-blur">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neto-muted">SBAR · Enfermagem</p><h2 className="mt-1 text-base font-bold text-neto-foreground">{patient.name} · Leito {patient.bed || "—"}</h2></div>
          <div className="flex items-center gap-2">{editing ? <><button type="button" onClick={() => setEditing(false)} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Cancelar</button><button type="button" onClick={saveSbar} className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-primary">Salvar tudo</button></> : <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Editar SBAR</button>}<button type="button" onClick={onClose} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Fechar</button></div>
        </header>
        <div className="grid gap-3 p-4 text-[13px] font-bold xl:grid-cols-5">
          <section className="ios-card rounded-lg p-4"><SectionTitle>Identificação</SectionTitle>{editing ? <div className="grid gap-2"><Field label="Paciente" value={identity.name} onChange={(value) => setIdentity({ ...identity, name: value })}/><Field label="Leito" value={identity.bed} onChange={(value) => setIdentity({ ...identity, bed: value })}/><Field label="Nº do atendimento" value={identity.id} onChange={(value) => setIdentity({ ...identity, id: value })}/><Field label="Idade" type="number" value={identity.age} onChange={(value) => setIdentity({ ...identity, age: value })}/><label className="text-[10px] font-bold uppercase text-muted-foreground">Sexo<select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold" value={identity.sex} onChange={(event) => setIdentity({ ...identity, sex: event.target.value as "M" | "F" })}><option value="M">Masculino</option><option value="F">Feminino</option></select></label><Field label="Admissão UTI" value={identity.admissionICU} onChange={(value) => setIdentity({ ...identity, admissionICU: value })}/><Field label="Previsão de alta" value={identity.expectedDischarge} onChange={(value) => setIdentity({ ...identity, expectedDischarge: value })}/></div> : <dl className="space-y-2 text-[11px]"><div><dt className="text-muted-foreground">Paciente</dt><dd>{identity.name || "—"}</dd></div><div><dt className="text-muted-foreground">Leito</dt><dd>{identity.bed || "—"}</dd></div><div><dt className="text-muted-foreground">Nº do atendimento</dt><dd className="font-mono">{identity.id}</dd></div><div><dt className="text-muted-foreground">Idade / sexo</dt><dd>{identity.age} anos · {identity.sex === "M" ? "Masculino" : "Feminino"}</dd></div><div><dt className="text-muted-foreground">Admissão UTI</dt><dd>{identity.admissionICU || "Não informada"}</dd></div><div><dt className="text-muted-foreground">Dias de UTI</dt><dd>{calculatedIcuDays ? `${calculatedIcuDays}º dia` : "Não calculado"}</dd></div><div><dt className="text-muted-foreground">Previsão de alta</dt><dd>{identity.expectedDischarge || "Não informada"}</dd></div></dl>}</section>
          <section className="ios-card rounded-lg p-4"><SectionTitle>Situação</SectionTitle><p className="text-[11px] text-muted-foreground">Diagnóstico principal</p>{editing ? <input className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)}/> : <p className="mt-1 text-sm font-bold text-foreground">{diagnosis || "Não informado"}</p>}<p className="mt-4 text-[11px] text-muted-foreground">Observação para o workflow</p>{editing ? <textarea rows={3} className="mt-1 w-full resize-y rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={situationObservation} onChange={(event) => setSituationObservation(event.target.value)} placeholder="Registrar observação livre do paciente" /> : <p className="mt-1 min-h-8 whitespace-pre-wrap text-[12px] font-semibold text-foreground">{situationObservation}</p>}<p className="mt-4 text-[11px] text-muted-foreground">Estado de consciência</p>{editing ? <select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={consciousnessState} onChange={(event) => setConsciousnessState(event.target.value)}><option>Não informado</option><option>Alerta</option><option>Sonolento</option><option>Obnubilado</option><option>Torporoso</option><option>Comatoso</option><option>Sedado</option></select> : <p className="mt-1 text-[12px] font-bold text-foreground">{consciousnessState}</p>}<p className="mt-4 text-[11px] text-muted-foreground">Estado atual</p>{editing ? <select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}><option value="stable">Estável</option><option value="attention">Atenção</option><option value="critical">Crítico</option></select> : <span className={`mt-1 inline-flex rounded px-2 py-1 text-[12px] font-bold ${severityMeta[severity].className}`}>{severityMeta[severity].label}</span>}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Background</SectionTitle>{area("Doenças de base", baseConditions, setBaseConditions, "Uma condição por linha")}{area("Cirurgias / procedimentos prévios", surgeries, setSurgeries, "Um item por linha")}{area("Alergias", allergies, setAllergies, "Uma alergia por linha")}{area("Uso contínuo", chronicMeds, setChronicMeds, "Um medicamento por linha")}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Avaliação</SectionTitle><p className="text-[10px] font-semibold uppercase text-muted-foreground">Dieta</p>{editing ? <input className="w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diet} onChange={(event) => setDiet(event.target.value)}/> : <p className="text-[11px] font-semibold">{diet || "Não informada"}</p>}<p className="text-[10px] font-semibold uppercase text-muted-foreground">Dispositivos invasivos</p>{devices.length ? devices.map((device) => {
  const sourceDevice = (patient.devices ?? []).find((item) => item.id === device.id);
  const risk = sourceDevice ? deviceRisk({ ...sourceDevice, typeCode: device.code.trim() || sourceDevice.typeCode, insertedAt: device.insertedAt || sourceDevice.insertedAt }) : null;
  const deviceDays = risk ? Math.max(1, Math.floor(risk.days) + 1) : null;
  return editing ? <div key={device.id} className="ios-inset grid gap-1 p-2"><Field label="Dispositivo" value={device.code} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, code: value } : item))}/><Field label="Sítio" value={device.site} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, site: value } : item))}/><div className="grid grid-cols-2 gap-1"><Field label="Calibre" value={device.size} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, size: value } : item))}/><Field label="Lúmens" value={device.lumens} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, lumens: value } : item))}/></div><Field label="Inserção" type="date" value={device.insertedAt} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, insertedAt: value } : item))}/></div> : <div key={device.id} className="ios-inset px-2 py-2 text-[11px]" title={risk?.label}><div className="flex items-baseline justify-between gap-2"><b className="min-w-0 truncate">{device.code}</b><span className={`shrink-0 text-[10px] font-black ${risk?.className ?? "text-muted-foreground"}`}>{deviceDays && risk ? `${deviceDays}/${risk.max}d` : "SEM DATA"}</span></div><div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{device.lumens ? `${device.lumens} lúmen(s)` : "Lúmens não informados"}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">{risk && <div className={`h-full rounded-full ${deviceBarAppearance(risk.level)}`} style={{ width: `${Math.min(100, Math.max(4, risk.percent))}%` }} />}</div></div>;
}) : <p className="text-[11px] italic text-muted-foreground">Nenhum dispositivo ativo</p>}{area("LPP e curativos", skinCare, setSkinCare, "Registro de LPP e curativos, uma linha por item")}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Recomendação</SectionTitle>{area("Pendência de laboratório", pendingLab, setPendingLab)}{area("Pendência de imagem", pendingImaging, setPendingImaging)}{area("Pendência de cultura", pendingCultures, setPendingCultures)}{area("Cuidados", nursingCare, setNursingCare, "Um cuidado por linha")}<div><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Laboratório</p>{editing ? <textarea rows={3} className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[11px] font-bold" value={laboratory} onChange={(event) => setLaboratory(event.target.value)} placeholder="Um exame por linha" /> : (patient.exams?.length ? <div className="space-y-1">{patient.exams.map((exam, index) => { const insight = examInsight(exam, identity.sex); const badge = insight.bucket ? bucketBadge(insight.bucket) : null; return <div key={`${exam.code ?? exam.label}-${index}`} className={`rounded border px-2 py-1 text-[11px] font-bold ${labAppearance(insight.bucket, exam.critical)}`} title={badge?.label ?? "Sem faixa de referência"}><span>{exam.label}</span><span className="ml-1">{exam.value}{exam.unit ? ` ${exam.unit}` : ""}</span></div>; })}</div> : <p className="text-[11px] italic text-muted-foreground">Não informado</p>)}</div><div><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Imagem</p>{editing ? <textarea rows={3} className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[11px] font-bold" value={imaging} onChange={(event) => setImaging(event.target.value)} placeholder="Um exame por linha" /> : resultItems((patient.imaging ?? []).map((exam) => ({ text: [exam.modality, exam.region, exam.summary ?? exam.conclusion ?? exam.status ?? ""].filter(Boolean).join(" · "), state: exam.status === "solicitado" || exam.conclusion === "pendente" ? "pending" as const : exam.conclusion === "alterado" || exam.conclusion === "critico" ? "changed" as const : "normal" as const })), "Não informado")}</div><div><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Culturas</p>{editing ? <textarea rows={3} className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[11px] font-bold" value={cultures} onChange={(event) => setCultures(event.target.value)} placeholder="Uma cultura por linha" /> : resultItems((patient.cultures ?? []).map((culture) => { const text = [culture.source, culture.organism, culture.result].filter(Boolean).join(" · "); const normalized = text.toLowerCase(); const state: ResultState = /pendente|aguardando|solicitad|em andamento/.test(normalized) ? "pending" : /positivo|crescimento|isolad|resistent|multirresistent/.test(normalized) ? "changed" : "normal"; return { text, state }; }), "Não informado")}</div></section>
        </div>
      </section>
    </div>
  );
}

function PatientActivityCalendar({ patient, onClose, onAdd, onRemove }: { patient: Patient; onClose: () => void; onAdd: (activity: WorkflowActivity) => void; onRemove: (activityId: string) => void }) {
  const today = localIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("08:00");
  const [dueAt, setDueAt] = useState("");
  const [type, setType] = useState<WorkflowActivity["type"]>("care");
  const activities = ((patient.nursingWorkflow?.activities ?? []) as WorkflowActivity[])
    .filter((activity) => activity.scheduledDate === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    const chosen = new Date(`${date}T12:00:00`);
    setMonthDate(new Date(chosen.getFullYear(), chosen.getMonth(), 1));
  };

  const addActivity = () => {
    if (!label.trim()) return;
    onAdd({
      id: `calendar-${Date.now()}`,
      label: label.trim(),
      time,
      dueAt: dueAt || undefined,
      type,
      source: "custom",
      scheduledDate: selectedDate,
    });
    setLabel("");
    setTime("08:00");
    setDueAt("");
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Agenda de ${patient.name}`} onClick={onClose}>
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-soft-blue-gradient shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="neto-glass sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 text-neto-foreground backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neto-muted">Agenda do paciente</p>
            <h2 className="mt-1 text-base font-bold text-neto-foreground">{patient.name} · Leito {patient.bed || "—"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Fechar</button>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="ios-card rounded-lg p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))} className="rounded border border-border px-2 py-1 text-xs font-bold" aria-label="Mês anterior">‹</button>
              <h3 className="text-sm font-bold capitalize text-foreground">{monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
              <button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))} className="rounded border border-border px-2 py-1 text-xs font-bold" aria-label="Próximo mês">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted-foreground">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day} className="py-1">{day}</span>)}
              {days.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} />;
                const date = localIsoDate(new Date(year, month, day));
                const hasActivities = ((patient.nursingWorkflow?.activities ?? []) as WorkflowActivity[]).some((activity) => activity.scheduledDate === date);
                return (
                  <button key={date} type="button" onClick={() => chooseDate(date)} className={`relative min-h-10 rounded text-xs font-bold transition-colors ${selectedDate === date ? "bg-primary text-primary-foreground" : date === today ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                    {day}
                    {hasActivities && <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selectedDate === date ? "bg-white" : "bg-clinical-attention"}`} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ios-card rounded-lg p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Atividades em {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR")}</p>
            <div className="mt-3 space-y-2">
              {activities.length ? activities.map((activity) => (
                <div key={activity.id} className="ios-inset flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-foreground">{activity.time} · {activity.label}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{activityMeta[activity.type].label}</p>
                  </div>
                  <button type="button" onClick={() => activity.id && onRemove(activity.id)} className="rounded border border-clinical-critical/35 px-2 py-1 text-[10px] font-bold text-clinical-critical hover:bg-clinical-critical/10">Remover</button>
                </div>
              )) : <p className="py-4 text-center text-xs italic text-muted-foreground">Nenhuma atividade agendada nesta data.</p>}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[11px] font-bold text-foreground">Agendar atividade</p>
              <div className="mt-2 space-y-2">
                <input className="w-full rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" placeholder="Descrição da atividade" value={label} onChange={(event) => setLabel(event.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <input type="time" aria-label="Horário da atividade" className="rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" value={time} onChange={(event) => setTime(event.target.value)} />
                  <input type="time" aria-label="Prazo da atividade" title="Prazo para conclusão" className="rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                  <select className="rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" value={type} onChange={(event) => setType(event.target.value as WorkflowActivity["type"])}>
                    {Object.entries(activityMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                </div>
                <button type="button" onClick={addActivity} className="w-full rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Agendar para esta data</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function FastHugPanel({ patient, onClose, onSave }: { patient: Patient; onClose: () => void; onSave: (criteria: Record<string, FastHugCriterion>) => void }) {
  const existing = (patient.nursingWorkflow as NursingWorkflowWithFastHug | undefined)?.fastHugReview?.criteria;
  const [criteria, setCriteria] = useState<Record<string, FastHugCriterion>>(() =>
    fastHugCriteria.reduce<Record<string, FastHugCriterion>>((items, [letter, label], index) => {
      const key = `${letter}-${index}`;
      items[key] = existing?.[key] ?? { status: "adequado", note: "" };
      return items;
    }, {}),
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Revisão FASTHUG de ${patient.name}`} onClick={onClose}>
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-soft-blue-gradient shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="neto-glass sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 text-neto-foreground backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neto-muted">Revisão diária · 17:00</p>
            <h2 className="mt-1 text-base font-bold text-neto-foreground">FASTHUG-MAIDENS · {patient.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Fechar</button>
        </header>
        <div className="p-5">
          <p className="mb-4 text-xs font-semibold text-muted-foreground">Registre a situação de cada critério e, quando necessário, a observação ou conduta.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {fastHugCriteria.map(([letter, label], index) => {
              const key = `${letter}-${index}`;
              const item = criteria[key];
              return (
                <article key={key} className="ios-card rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">{letter}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-foreground">{label}</p>
                      <select className="mt-2 w-full rounded border border-input bg-background px-2 py-1.5 text-[11px] font-bold" value={item.status} onChange={(event) => setCriteria({ ...criteria, [key]: { ...item, status: event.target.value as FastHugStatus } })}>
                        <option value="adequado">Adequado</option>
                        <option value="atencao">Atenção / requer conduta</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                      </select>
                      <textarea rows={2} className="mt-2 w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" value={item.note} onChange={(event) => setCriteria({ ...criteria, [key]: { ...item, note: event.target.value } })} placeholder="Observação ou conduta" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-xs font-semibold">Cancelar</button>
            <button type="button" onClick={() => onSave(criteria)} className="rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Registrar revisão</button>
          </div>
        </div>
      </section>
    </div>
  );
}

type RdcIndicator = { id: string; label: string; formula?: "quedas" };
type RdcTable = { id: string; label: string; title: string; indicators: RdcIndicator[] };

const rdcTables: RdcTable[] = [
  {
    id: "geral",
    label: "Indicadores gerais",
    title: "Levantamento de dados para indicadores RDC 36 e protocolos",
    indicators: [
      { id: "internados", label: "Nº de pacientes internados" },
      { id: "perda-cvc", label: "Perda de CVC" },
      { id: "acidente-puncao", label: "Acidente de punção" },
      { id: "sne", label: "Desposicionamento de SNE" },
      { id: "broncoaspiracao", label: "Broncoaspiração" },
      { id: "alta", label: "Alta" },
      { id: "obito", label: "Óbito" },
      { id: "extubacao", label: "Extubação" },
    ],
  },
  {
    id: "queda",
    label: "Protocolo de queda",
    title: "Levantamento de dados para indicadores RDC 36 · protocolo de queda do paciente",
    indicators: [
      { id: "atendidos", label: "Nº de pacientes atendidos" },
      { id: "avaliacao-risco", label: "Nº de pacientes com avaliação do risco de queda realizada na admissão" },
      { id: "risco-quedas", label: "Nº de pacientes classificados em risco de queda" },
      { id: "quedas-com-dano", label: "Nº de quedas com danos" },
      { id: "quedas-sem-dano", label: "Nº de quedas sem danos" },
      { id: "indice-quedas", label: "Índice de quedas = [(nº de eventos / nº de pacientes)] × 1000", formula: "quedas" },
    ],
  },
  {
    id: "upp",
    label: "Protocolo de UPP",
    title: "Levantamento de dados para indicadores RDC 36 · protocolo de úlcera por pressão",
    indicators: [
      { id: "admitidos", label: "Nº de pacientes admitidos" },
      { id: "internados", label: "Nº de pacientes internados" },
      { id: "avaliacao-risco-upp", label: "Nº de pacientes submetidos à avaliação de riscos de UPP na admissão" },
      { id: "risco-upp", label: "Nº de pacientes total com riscos de UPP" },
      { id: "preventivo-upp", label: "Nº de pacientes de risco de UPP recebendo cuidado preventivo apropriado" },
      { id: "avaliacao-diaria-upp", label: "Nº de pacientes recebendo avaliação diária para risco de UPP" },
      { id: "upp-propria", label: "Incidência de UPP de origem no próprio setor" },
      { id: "upp-alas", label: "Incidência de UPP de origem alas" },
      { id: "upp-externa", label: "Incidência de UPP de origem externa" },
    ],
  },
];

type RdcData = { local: string; responsavel: string; month: number; year: number; values: Record<string, string> };
const rdcStorageKey = "axon:rdc36-indicadores";

function Rdc36Panel({ onBack }: { onBack: () => void }) {
  const now = new Date();
  const [activeTable, setActiveTable] = useState("geral");
  const [data, setData] = useState<RdcData>(() => ({ local: "UTI NEUROVASCULAR", responsavel: "", month: now.getMonth(), year: now.getFullYear(), values: {} }));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(rdcStorageKey);
      if (saved) setData((current) => ({ ...current, ...JSON.parse(saved), values: JSON.parse(saved).values ?? {} }));
    } catch {
      // Mantém a planilha vazia se um registro antigo estiver inválido.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(rdcStorageKey, JSON.stringify(data));
  }, [data]);

  const table = rdcTables.find((item) => item.id === activeTable) ?? rdcTables[0];
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const keyFor = (tableId: string, indicatorId: string, day: number) => `${data.year}-${data.month}-${tableId}-${indicatorId}-${day}`;
  const numberValue = (value?: string) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const calculated = (indicator: RdcIndicator, day: number) => {
    if (indicator.formula !== "quedas") return undefined;
    const numerator = numberValue(data.values[keyFor("queda", "quedas-com-dano", day)]) + numberValue(data.values[keyFor("queda", "quedas-sem-dano", day)]);
    const denominator = numberValue(data.values[keyFor("queda", "atendidos", day)]);
    return denominator ? ((numerator / denominator) * 1000).toFixed(1).replace(".", ",") : "0";
  };
  const cellValue = (indicator: RdcIndicator, day: number) => calculated(indicator, day) ?? data.values[keyFor(table.id, indicator.id, day)] ?? "";
  const total = (indicator: RdcIndicator) => {
    if (indicator.formula) {
      const numerator = days.reduce((sum, day) => sum + numberValue(data.values[keyFor("queda", "quedas-com-dano", day)]) + numberValue(data.values[keyFor("queda", "quedas-sem-dano", day)]), 0);
      const denominator = days.reduce((sum, day) => sum + numberValue(data.values[keyFor("queda", "atendidos", day)]), 0);
      return denominator ? ((numerator / denominator) * 1000).toFixed(1).replace(".", ",") : "0";
    }
    return days.reduce((sum, day) => sum + numberValue(data.values[keyFor(table.id, indicator.id, day)]), 0).toLocaleString("pt-BR");
  };
  const monthName = new Date(data.year, data.month, 1).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
      <div className="ios-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="title-box !text-[12px]">RDC 36 · Segurança do paciente</h2></div><p className={timelineZoom === "grade24" ? "hidden" : "mt-1 text-xs text-muted-foreground"}>Indicadores mensais de enfermagem. Os totais são calculados automaticamente.</p></div>
        <button type="button" onClick={onBack} className="rounded border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted">Voltar ao workflow</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rdcTables.map((item) => <button key={item.id} type="button" onClick={() => setActiveTable(item.id)} className={`rounded px-3 py-2 text-xs font-bold ${activeTable === item.id ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground hover:bg-muted"}`}>{item.label}</button>)}
      </div>
      <section className="ios-card mt-4 rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
          <div className="min-w-60 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Anexo 05</p><h3 className="mt-1 text-sm font-bold uppercase text-foreground">{table.title}</h3></div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Local<input className="mt-1 block w-44 rounded border border-input bg-background px-2 py-1.5 text-xs font-bold text-foreground" value={data.local} onChange={(event) => setData({ ...data, local: event.target.value })}/></label>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Responsável<input className="mt-1 block w-44 rounded border border-input bg-background px-2 py-1.5 text-xs font-bold text-foreground" value={data.responsavel} onChange={(event) => setData({ ...data, responsavel: event.target.value })}/></label>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Mês<select className="mt-1 block rounded border border-input bg-background px-2 py-1.5 text-xs font-bold text-foreground" value={data.month} onChange={(event) => setData({ ...data, month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(2026, index, 1).toLocaleDateString("pt-BR", { month: "long" })}</option>)}</select></label>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Ano<input type="number" min="2020" max="2100" className="mt-1 block w-24 rounded border border-input bg-background px-2 py-1.5 text-xs font-bold text-foreground" value={data.year} onChange={(event) => setData({ ...data, year: Number(event.target.value) || now.getFullYear() })}/></label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1800px] border-collapse text-[10px]">
            <thead><tr className="bg-primary text-primary-foreground"><th className="sticky left-0 z-10 w-80 border border-primary/45 bg-primary px-3 py-2 text-left text-[11px]">Indicadores</th>{days.map((day) => <th key={day} className="border border-primary/45 px-1 py-2">{String(day).padStart(2, "0")}</th>)}<th className="border border-primary/45 px-3 py-2">Total</th></tr></thead>
            <tbody>{table.indicators.map((indicator, rowIndex) => <tr key={indicator.id} className={rowIndex % 2 ? "bg-muted/20" : "bg-background"}><th className="sticky left-0 z-10 border border-border bg-inherit px-3 py-2 text-left font-bold text-foreground">{indicator.label}</th>{days.map((day) => <td key={day} className="border border-border p-0.5"><input readOnly={!!indicator.formula} inputMode="decimal" aria-label={`${indicator.label}, dia ${day}`} className={`h-7 w-full min-w-10 rounded border-0 bg-transparent px-1 text-center text-[11px] font-semibold outline-none focus:bg-primary/10 ${indicator.formula ? "text-muted-foreground" : "text-foreground"}`} value={cellValue(indicator, day)} onChange={(event) => setData({ ...data, values: { ...data.values, [keyFor(table.id, indicator.id, day)]: event.target.value } })}/></td>)}<td className="border border-border bg-primary/5 px-2 text-center text-[11px] font-bold text-primary">{total(indicator)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] font-semibold text-muted-foreground">Referência selecionada: {monthName} de {data.year}. Os registros ficam salvos neste navegador.</p>
      </section>
    </main>
  );
}

export function NursingDashboard({ patients, onOpenMedicalPanel, onSignOut, onUpdatePatient }: Props) {
  const now = new Date();
  const nowMinute = shiftMinuteFor(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const currentTimeMarker = Math.max(0, Math.min(100, (nowMinute / (24 * 60)) * 100));
  const workflowActivities = patients.flatMap((patient) => workflowActivitiesForToday(patient));
  const dayShiftActivities = workflowActivities.filter((activity) => {
    const [hour] = activity.time.split(":").map(Number);
    return Number.isFinite(hour) && hour >= 7 && hour < 19;
  });
  const nightShiftActivities = workflowActivities.filter((activity) => {
    const [hour] = activity.time.split(":").map(Number);
    return Number.isFinite(hour) && (hour >= 19 || hour < 7);
  });
  const dayShiftCompleted = dayShiftActivities.filter((activity) => activity.completed).length;
  const nightShiftCompleted = nightShiftActivities.filter((activity) => activity.completed).length;
  const dayShiftProgress = dayShiftActivities.length ? Math.round((dayShiftCompleted / dayShiftActivities.length) * 100) : 0;
  const nightShiftProgress = nightShiftActivities.length ? Math.round((nightShiftCompleted / nightShiftActivities.length) * 100) : 0;
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activityDraft, setActivityDraft] = useState<{ patientId: string; label: string; time: string; dueAt: string; type: WorkflowActivity["type"]; repeatEveryHours: number } | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [fastHugActivity, setFastHugActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [calendarPatientId, setCalendarPatientId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nursingView, setNursingView] = useState<"workflow" | "rdc36">("workflow");
  const [timelineZoom, setTimelineZoom] = useState<"normal" | "grade24">("normal");
  const [patientFilter, setPatientFilter] = useState<"all" | "overdue">("all");
  const timelineScrollRefs = useRef<Array<HTMLDivElement | null>>([]);
  const timelineScrollLock = useRef(false);
  const overduePatientCount = patients.filter((patient) => workflowActivitiesForToday(patient).some(isActivityOverdue)).length;
  const visiblePatients = patientFilter === "overdue"
    ? patients.filter((patient) => workflowActivitiesForToday(patient).some(isActivityOverdue))
    : patients;
  const syncTimelineScroll = (origin: HTMLDivElement) => {
    if (timelineScrollLock.current) return;
    timelineScrollLock.current = true;
    timelineScrollRefs.current.forEach((node) => {
      if (node && node !== origin) node.scrollLeft = origin.scrollLeft;
    });
    window.setTimeout(() => { timelineScrollLock.current = false; }, 0);
  };
  const timelineCellWidth = 60;
  const timelineCardHeight = 106;
  const timelineCardSpan = 3;

  const addActivity = (patient: Patient) => {
    if (!activityDraft?.label.trim()) return;
    const existing = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...patient.nursingWorkflow,
        activities: [...existing, { id: `custom-${Date.now()}`, label: activityDraft.label.trim(), time: activityDraft.time || "12:00", dueAt: activityDraft.dueAt || undefined, type: activityDraft.type, repeatEveryHours: activityDraft.repeatEveryHours || undefined, source: "custom" }],
      },
    });
    setActivityDraft(null);
  };

  const saveActivity = (patientId: string, activity: WorkflowActivity) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient || !activity.id) return;
    const current = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    const record = { ...activity, source: activity.source ?? "default" };
    const activities = current.some((item) => item.id === record.id)
      ? current.map((item) => item.id === record.id ? { ...item, ...record } : item)
      : [...current, record];
    onUpdatePatient({ ...patient, nursingWorkflow: { ...patient.nursingWorkflow, activities } });
    setEditingActivity(null);
  };

  const removeWorkflowActivity = (patientId: string, activity: WorkflowActivity) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient || !activity.id) return;
    const current = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    const inferredParentId = activity.id.replace(/-repeat-\d+$/, "");
    const targetId = activity.repeatParentId
      ?? (inferredParentId !== activity.id && current.some((item) => item.id === inferredParentId) ? inferredParentId : activity.id);
    const targetActivity = targetId === activity.id ? activity : { ...activity, id: targetId, repeatParentId: undefined };
    const isStoredCustom = targetActivity.source === "custom" && current.some((item) => item.id === targetId);
    const activities = isStoredCustom
      ? current.filter((item) => item.id !== targetId && item.id !== activity.id)
      : current.some((item) => item.id === targetId)
        ? current.map((item) => item.id === targetId ? { ...item, hidden: true } : item)
        : [...current, { ...targetActivity, hidden: true, source: targetActivity.source ?? "default" }];
    onUpdatePatient({ ...patient, nursingWorkflow: { ...patient.nursingWorkflow, activities } });
    setEditingActivity(null);
  };

  const saveFastHugReview = (patientId: string, activity: WorkflowActivity, criteria: Record<string, FastHugCriterion>) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient || !activity.id) return;
    const workflow = patient.nursingWorkflow as NursingWorkflowWithFastHug | undefined;
    const currentActivities = Array.isArray(workflow?.activities) ? workflow.activities : [];
    const now = new Date();
    const reviewedAt = now.toISOString();
    const record: WorkflowActivity = {
      ...activity,
      completed: true,
      source: "fasthug",
      note: `Revisão registrada às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    };
    const activities = currentActivities.some((item) => item.id === record.id)
      ? currentActivities.map((item) => item.id === record.id ? { ...item, ...record } : item)
      : [...currentActivities, record];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...workflow,
        activities,
        fastHugReview: { criteria, reviewedAt },
      } as Patient["nursingWorkflow"],
    });
    setFastHugActivity(null);
  };

  const addScheduledActivity = (patientId: string, activity: WorkflowActivity) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;
    const current = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...patient.nursingWorkflow,
        activities: [...current, activity],
      } as Patient["nursingWorkflow"],
    });
  };

  const removeScheduledActivity = (patientId: string, activityId: string) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;
    const current = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...patient.nursingWorkflow,
        activities: current.filter((activity) => activity.id !== activityId),
      } as Patient["nursingWorkflow"],
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-slate-100 text-foreground">
      <header className="neto-glass border-b-0 px-4 py-4 text-neto-foreground shadow-sm sm:px-6">
        <div className="mx-auto grid max-w-[1800px] grid-cols-1 items-center gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)_minmax(0,1fr)]">
          <div className="flex items-center gap-3">
            <img
              src={mainLogo}
              alt="Axon Critical Care Intelligence"
              className="h-auto w-36 max-w-[42vw] object-contain"
              style={{ filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.36))" }}
            />
            <div className="border-l border-white/25 pl-3">
              <h1 className="text-sm font-black uppercase tracking-[0.14em] text-neto-foreground drop-shadow-sm">Enfermagem</h1>
              <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.65)]">
                UTI Neurovascular HSJA
              </p>

            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 justify-self-center">
            <section className="rounded-xl border border-amber-100/80 bg-gradient-to-br from-white/90 via-amber-50/85 to-orange-100/75 px-3 py-2.5 shadow-[0_8px_18px_rgba(180,83,9,0.16)] backdrop-blur-md" title="Atividades previstas entre 07:00 e 19:00">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-800">Plantão dia</p>
                  <p className="mt-0.5 text-[9px] font-bold text-amber-700/80">07:00 — 19:00</p>
                </div>
                <p className="text-2xl font-black leading-none text-amber-800">{dayShiftCompleted}<span className="text-sm text-amber-700/70">/{dayShiftActivities.length}</span></p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-950/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${dayShiftProgress}%` }} /></div>
            </section>
            <section className="rounded-xl border border-indigo-100/80 bg-gradient-to-br from-white/90 via-indigo-50/85 to-violet-100/75 px-3 py-2.5 shadow-[0_8px_18px_rgba(79,70,229,0.16)] backdrop-blur-md" title="Atividades previstas entre 19:00 e 07:00">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-indigo-800">Plantão noite</p>
                  <p className="mt-0.5 text-[9px] font-bold text-indigo-700/80">19:00 — 07:00</p>
                </div>
                <p className="text-2xl font-black leading-none text-indigo-800">{nightShiftCompleted}<span className="text-sm text-indigo-700/70">/{nightShiftActivities.length}</span></p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-950/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all" style={{ width: `${nightShiftProgress}%` }} /></div>
            </section>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-emerald-200/55 bg-emerald-500/30 px-3 py-2 text-xs font-bold text-white shadow-[0_5px_14px_rgba(16,185,129,0.25)] backdrop-blur-xl">
              <span className="uppercase tracking-wide text-[10px] text-white">Zoom</span>
              <select value={timelineZoom} onChange={(event) => setTimelineZoom(event.target.value as "normal" | "grade24")} className="bg-transparent text-xs font-black text-white outline-none">
                <option value="normal" className="text-slate-900">Normal</option>
                <option value="grade24" className="text-slate-900">Grade 24 h</option>
              </select>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="inline-flex items-center gap-2 rounded-md border border-neto-line bg-white/10 px-3 py-2 text-xs font-semibold text-neto-foreground transition-colors hover:bg-white/20" aria-label="Abrir menu da enfermagem">
                <Menu className="h-4 w-4" /> Menu
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-border bg-background p-1 shadow-xl">
                  <button type="button" onClick={() => { setNursingView("workflow"); setMenuOpen(false); }} className="w-full rounded px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted">Workflow de enfermagem</button>
                  <button type="button" onClick={() => { setNursingView("rdc36"); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted"><ShieldCheck className="h-4 w-4 text-primary" /> RDC 36</button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenMedicalPanel}
              className="inline-flex items-center gap-2 rounded-md border border-neto-line bg-white/10 px-3 py-2 text-xs font-semibold text-neto-foreground transition-colors hover:bg-white/20"
            >
              <Stethoscope className="h-4 w-4" />
              Painel médico
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-md border border-neto-line bg-white/10 px-3 py-2 text-xs font-semibold text-neto-foreground transition-colors hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {nursingView === "rdc36" ? <Rdc36Panel onBack={() => setNursingView("workflow")} /> : (
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
        <div className="ios-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
          <div>
            <h2 className="title-box !text-[11px]">Pacientes ativos</h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe as atividades previstas para o período de 07:00 a 07:00.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Filtros</span>
            <button type="button" onClick={() => setPatientFilter("all")} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${patientFilter === "all" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background/70 text-foreground hover:bg-muted"}`}>
              Todos pacientes ({patients.length})
            </button>
            <button type="button" onClick={() => setPatientFilter("overdue")} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${patientFilter === "overdue" ? "border-clinical-critical bg-clinical-critical text-white shadow-sm" : "border-clinical-critical/35 bg-clinical-critical/5 text-clinical-critical hover:bg-clinical-critical/10"}`}>
              Pacientes atrasados ({overduePatientCount})
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-muted-foreground">
            {Object.entries(activityMeta).map(([type, meta]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full border ${meta.className}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        {visiblePatients.length === 0 ? (
          <div className="ios-card rounded-lg border-dashed px-5 py-14 text-center">
            <UserRoundCog className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">{patients.length ? "Nenhum paciente com atividade atrasada" : "Nenhum paciente ativo"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {patients.length ? "Altere o filtro para visualizar todos os pacientes." : "Os pacientes cadastrados aparecerão aqui como barras de workflow."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="min-w-[980px] space-y-3">
              {visiblePatients.map((patient, patientIndex) => {
                const severity = severityMeta[patient.severity];
                const activities = workflowActivitiesForToday(patient);
                const patientDayActivities = activities.filter((activity) => {
                  const [hour] = activity.time.split(":").map(Number);
                  return Number.isFinite(hour) && hour >= 7 && hour < 19;
                });
                const patientNightActivities = activities.filter((activity) => {
                  const [hour] = activity.time.split(":").map(Number);
                  return Number.isFinite(hour) && (hour >= 19 || hour < 7);
                });
                const patientDayCompleted = patientDayActivities.filter((activity) => activity.completed).length;
                const patientNightCompleted = patientNightActivities.filter((activity) => activity.completed).length;
                const patientDayProgress = patientDayActivities.length ? Math.round((patientDayCompleted / patientDayActivities.length) * 100) : 0;
                const patientNightProgress = patientNightActivities.length ? Math.round((patientNightCompleted / patientNightActivities.length) * 100) : 0;
                const consciousness = patient.nursingWorkflow?.consciousnessState ?? "Não informado";
                const daysInIcu = icuDays(patient);
                return (
                  <article
                    key={patient.id}
                    className={`ios-card overflow-hidden rounded-lg ${timelineZoom === "grade24" ? "shadow-sm" : ""}`}
                  >
                    <div className={`flex ${timelineZoom === "grade24" ? "min-h-[42px]" : "min-h-[138px]"}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(patient)}
                        className={`flex flex-col border-r border-border bg-soft-blue-gradient text-left transition-colors hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 ${timelineZoom === "grade24" ? "w-[180px] min-w-[180px] justify-center p-1" : "w-1/5 min-w-[196px] justify-between p-4"}`}
                        title="Abrir resumo SBAR do paciente"
                      >
                        {timelineZoom === "grade24" ? (
                          <div>
                            <div className="flex items-center gap-1.5 border-clinical-stable/70 font-bold uppercase tracking-wide text-foreground">
                              <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-black text-primary-foreground shadow-sm">{patient.bed || "—"}</span>
                              <span className="truncate text-[10px]">{patient.name || "Sem identificação"}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide">
                              <span className="rounded-sm bg-amber-100 px-1 py-0.5 text-amber-800">D {patientDayCompleted}/{patientDayActivities.length}</span>
                              <span className="rounded-sm bg-indigo-100 px-1 py-0.5 text-indigo-800">N {patientNightCompleted}/{patientNightActivities.length}</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-primary px-2 py-1 text-xs font-black text-primary-foreground shadow-sm">LEITO {patient.bed || "—"}</span>
                              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-extrabold text-cyan-800 shadow-sm">{consciousness}</span>
                            </div>
                            <div className="mt-3 text-sm font-black uppercase tracking-wide text-foreground">{patient.name || "Sem identificação"}</div>
                            <div className="mt-1 text-xs font-semibold text-muted-foreground">{patient.age} anos · {patient.sex === "M" ? "Masculino" : "Feminino"}</div>
                            <div className="mt-1 text-xs font-bold text-primary">{daysInIcu ? `${daysInIcu}º dia de UTI` : "Dias de UTI não informados"}</div>
                            <div className="mt-3 border-t border-border/70 pt-2">
                              <div className="text-[8px] font-extrabold uppercase tracking-wide text-muted-foreground">Observação</div>
                              <div className="mt-1 min-h-12 whitespace-pre-wrap rounded-sm border border-white/70 bg-white/45 px-2 py-1.5 text-[12px] font-bold leading-snug text-slate-800 drop-shadow-[0_1px_1px_rgba(15,23,42,0.2)]">{patient.nursingWorkflow?.situationObservation}</div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-1.5">
                              <div className="rounded-xl border border-amber-100/80 bg-gradient-to-br from-white/90 via-amber-50/85 to-orange-100/75 p-2 shadow-[0_6px_14px_rgba(180,83,9,0.14)] backdrop-blur-md">
                                <div className="flex items-end justify-between gap-1"><span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-800">Dia</span><span className="text-[15px] font-black text-amber-800">{patientDayCompleted}<span className="text-[10px] text-amber-700/70">/{patientDayActivities.length}</span></span></div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-950/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${patientDayProgress}%` }} /></div>
                              </div>
                              <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-br from-white/90 via-indigo-50/85 to-violet-100/75 p-2 shadow-[0_6px_14px_rgba(79,70,229,0.14)] backdrop-blur-md">
                                <div className="flex items-end justify-between gap-1"><span className="text-[9px] font-extrabold uppercase tracking-wide text-indigo-800">Noite</span><span className="text-[15px] font-black text-indigo-800">{patientNightCompleted}<span className="text-[10px] text-indigo-700/70">/{patientNightActivities.length}</span></span></div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-indigo-950/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500" style={{ width: `${patientNightProgress}%` }} /></div>
                              </div>
                            </div>
                          </>
                        )}
                      </button>

                      <section className={`w-4/5 bg-surface/55 ${timelineZoom === "grade24" ? "p-0.5" : "p-4"}`}>
                        <div className={timelineZoom === "grade24" ? "hidden" : "mb-2 flex items-center justify-between gap-2"}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Linha do tempo do plantão
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" onClick={() => setCalendarPatientId(patient.id)} className="inline-flex items-center gap-1 rounded border border-border bg-background/75 px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted">
                              <CalendarDays className="h-4 w-4" /> Agenda
                            </button>
                            <button type="button" onClick={() => setActivityDraft({ patientId: patient.id, label: "", time: "12:00", dueAt: "", type: "care", repeatEveryHours: 0 })} className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20">+ Atividade</button>
                          </div>
                        </div>
                        {timelineZoom === "grade24" ? (
                          <div className="rounded-sm border border-white/70 bg-white/35 p-0.5 shadow-inner backdrop-blur-md" aria-label="Grade de atividades do período de 24 horas">
                            <div className="mb-0 grid text-center text-[7px] font-bold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: "repeat(25, minmax(18px, 1fr))" }}>
                              {[["07", 1], ["10", 4], ["13", 7], ["16", 10], ["19", 13], ["22", 16], ["01", 19], ["04", 22], ["07", 25]].map(([label, column], index) => (
                                <span key={`${label}-${index}`} style={{ gridColumn: String(column) }}>{label}</span>
                              ))}
                            </div>
                            <div className="relative grid min-h-[14px] auto-rows-[14px] grid-flow-row-dense gap-px rounded-sm border border-white/60 bg-slate-50/45 p-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(18px, 1fr))" }}>
                              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.9)]" style={{ left: `${currentTimeMarker}%` }} />
                              {activities.map((activity, index) => {
                                const meta = activityMeta[activity.type];
                                const overdue = isActivityOverdue(activity);
                                const column = activityStartColumn(activityTimelineTime(activity));
                                return (
                                  <button
                                    type="button"
                                    key={`${patient.id}-grid-${activity.id ?? activity.label}-${index}`}
                                    onClick={() => activity.source === "fasthug" ? setFastHugActivity({ patientId: patient.id, activity }) : setEditingActivity({ patientId: patient.id, activity })}
                                    style={{ gridColumnStart: column }}
                                    className={`z-20 flex h-3 w-3 items-center justify-center rounded-full border text-[7px] font-black leading-none shadow-sm transition-transform hover:scale-150 ${meta.className} ${activity.completed ? "ring-1 ring-emerald-500 ring-offset-1" : ""} ${overdue ? "!border-clinical-critical !bg-clinical-critical ring-1 ring-clinical-critical/70" : ""}`}
                                    title={`${activity.time} · ${activity.label}${activity.dueAt ? ` · Prazo ${activity.dueAt}` : ""}${overdue ? " · Atrasada" : ""}${activity.completed ? " · Concluída" : ""}`}
                                  >
                                    {activity.completed ? "✓" : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div ref={(node) => { timelineScrollRefs.current[patientIndex] = node; }} onScroll={(event) => syncTimelineScroll(event.currentTarget)} className="nursing-timeline-scroll overflow-x-auto pb-3" aria-label="Linha do tempo de atividades com rolagem horizontal sincronizada">
                            <div style={{ minWidth: `${timelineCellWidth * 24}px` }}>
                              <div className="mb-1 grid text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: `repeat(25, minmax(${timelineCellWidth}px, 1fr))` }}>
                                {Array.from({ length: 25 }, (_, index) => {
                                  const hour = (7 + index) % 24;
                                  return <span key={index} style={{ gridColumn: String(index + 1) }}>{String(hour).padStart(2, "0")}</span>;
                                })}
                              </div>
                              <div className="relative grid min-h-[182px] auto-rows-[170px] grid-flow-row-dense gap-2 rounded-sm border border-white/70 bg-white/35 p-2.5 shadow-inner backdrop-blur-md" style={{ gridTemplateColumns: `repeat(24, minmax(${timelineCellWidth}px, 1fr))`, gridAutoRows: `${timelineCardHeight}px`, minHeight: `${timelineCardHeight + 12}px` }}>
                                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500/85 shadow-[0_0_7px_rgba(239,68,68,0.75)]" style={{ left: `${currentTimeMarker}%` }} />
                                {activities.map((activity, index) => {
                                  const meta = activityMeta[activity.type];
                                  const overdue = isActivityOverdue(activity);
                                  const column = activity.dueAt
                                    ? deadlineActivityColumn(activity.dueAt, timelineCardSpan)
                                    : centeredActivityColumn(activity.time, timelineCardSpan);
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => activity.source === "fasthug" ? setFastHugActivity({ patientId: patient.id, activity }) : setEditingActivity({ patientId: patient.id, activity })}
                                      key={`${patient.id}-${activity.id ?? activity.label}-${index}`}
                                      style={{ gridColumnStart: column, gridColumnEnd: `span ${timelineCardSpan}`, minHeight: `${timelineCardHeight}px` }}
                                      className={`relative min-w-0 text-left transition-all hover:-translate-y-0.5 ${timelineZoom === "normal" ? "overflow-hidden rounded-xl border-2 bg-white/80 px-2 py-1.5 shadow-[0_4px_11px_rgba(15,23,42,0.1)] hover:shadow-[0_7px_16px_rgba(15,23,42,0.16)]" : "overflow-hidden rounded-md border-4 bg-white/10 px-1 py-0.5 shadow-[0_6px_13px_rgba(15,23,42,0.14)] backdrop-blur-2xl ring-1 ring-white/65 hover:ring-white/90 hover:shadow-[0_10px_18px_rgba(15,23,42,0.2)]"} [&>div]:relative [&>div]:z-10 ${meta.className} ${activity.completed ? "opacity-60" : ""} ${overdue ? "!border-clinical-critical !bg-red-50/95 ring-2 ring-clinical-critical/75 shadow-[0_5px_18px_rgba(220,38,38,0.24)]" : ""}`}
                                      title={`${activity.time} · ${activity.label}${activity.dueAt ? ` · Prazo ${activity.dueAt}` : ""}${overdue ? " · Atrasada" : ""}${activity.repeatEveryHours ? ` · repetir a cada ${activity.repeatEveryHours} h` : ""}`}
                                    >
                                      {timelineZoom !== "normal" && <span aria-hidden="true" className="pointer-events-none absolute -top-6 left-4 right-4 h-14 rounded-full bg-white/35 blur-xl" />}
                                      {timelineZoom !== "normal" && activity.completed && <span aria-label="Atividade concluída" className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-600 bg-emerald-500 text-[13px] font-black leading-none text-white shadow-sm">✓</span>}
                                      {timelineZoom === "normal" ? (
                                        <>
                                          <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-wide">
                                            <span className="truncate">{meta.label}</span>
                                            <span className="shrink-0 rounded-md bg-white/80 px-1.5 py-0.5 shadow-sm">{activityTimelineTime(activity)}</span>
                                          </div>
                                          {overdue ? <div className="mt-0.5 text-[9px] font-black uppercase text-clinical-critical">{overdueElapsedLabel(activity)}</div> : activity.dueAt ? <div className="mt-0.5 text-[9px] font-black uppercase opacity-70">Prazo · {activity.dueAt}</div> : null}
                                          <div className={`mt-1.5 line-clamp-2 text-[12px] font-extrabold leading-[1.15] ${activity.completed ? "line-through" : ""}`}>
                                            {activity.label}
                                          </div>
                                          {activity.note && <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[10px] font-semibold leading-snug opacity-85">{activity.note}</div>}
                                          {activity.repeatEveryHours && <div className="mt-1 text-[9px] font-bold opacity-75">A CADA {activity.repeatEveryHours} H</div>}
                                        </>
                                      ) : (
                                        <>
                                          <div className="text-[11px] font-extrabold uppercase leading-tight tracking-wide opacity-85">
                                            {activityTimelineTime(activity)} · {meta.label}
                                          </div>
                                          <div className={`mt-1 break-words text-[13px] font-extrabold leading-[1.15] ${activity.completed ? "line-through" : ""}`}>
                                            {activity.label}
                                          </div>
                                          {activity.repeatEveryHours && <div className="mt-1 text-[10px] font-bold opacity-70">REPETIR /{activity.repeatEveryHours} H</div>}
                                          {activity.note && <div className="mt-1 break-words text-[10px] font-semibold leading-snug">{activity.note}</div>}
                                        </>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {activityDraft?.patientId === patient.id && (
                          <div className="mt-2 grid grid-cols-[minmax(150px,1fr)_86px_86px_120px_112px_auto_auto] gap-1.5">
                            <input className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" placeholder="Nova atividade" value={activityDraft.label} onChange={(event) => setActivityDraft({ ...activityDraft, label: event.target.value })} />
                            <input type="time" aria-label="Horário da atividade" className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" value={activityDraft.time} onChange={(event) => setActivityDraft({ ...activityDraft, time: event.target.value })} />
                            <input type="time" aria-label="Prazo da atividade" title="Prazo para conclusão" className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" value={activityDraft.dueAt} onChange={(event) => setActivityDraft({ ...activityDraft, dueAt: event.target.value })} />
                            <select className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" value={activityDraft.type} onChange={(event) => setActivityDraft({ ...activityDraft, type: event.target.value as WorkflowActivity["type"] })}>
                              {Object.entries(activityMeta).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
                            </select>
                            <input type="number" min="1" max="23" className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" placeholder="Repetir (h)" aria-label="Repetir atividade a cada quantas horas" value={activityDraft.repeatEveryHours || ""} onChange={(event) => setActivityDraft({ ...activityDraft, repeatEveryHours: Math.max(0, Math.min(23, Number(event.target.value) || 0)) })} />
                            <button type="button" onClick={() => addActivity(patient)} className="rounded bg-primary px-2 py-1.5 text-[12px] font-bold text-primary-foreground shadow-sm">Adicionar</button>
                            <button type="button" onClick={() => setActivityDraft(null)} className="rounded border border-border bg-white/70 px-2 py-1.5 text-[12px] font-semibold shadow-sm">Cancelar</button>
                          </div>
                        )}
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
      )}
      {selectedPatient && <SbarPanel patient={selectedPatient} onUpdatePatient={onUpdatePatient} onClose={() => setSelectedPatient(null)} />}

      {calendarPatientId && (() => {
        const patient = patients.find((item) => item.id === calendarPatientId);
        return patient ? (
          <PatientActivityCalendar
            patient={patient}
            onClose={() => setCalendarPatientId(null)}
            onAdd={(activity) => addScheduledActivity(patient.id, activity)}
            onRemove={(activityId) => removeScheduledActivity(patient.id, activityId)}
          />
        ) : null;
      })()}
      {fastHugActivity && (() => {
        const patient = patients.find((item) => item.id === fastHugActivity.patientId);
        return patient ? (
          <FastHugPanel
            patient={patient}
            onClose={() => setFastHugActivity(null)}
            onSave={(criteria) => saveFastHugReview(fastHugActivity.patientId, fastHugActivity.activity, criteria)}
          />
        ) : null;
      })()}
      {editingActivity && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => saveActivity(editingActivity.patientId, editingActivity.activity)}>
          <section className="w-full max-w-md rounded-xl border border-border bg-soft-blue-gradient p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveActivity(editingActivity.patientId, editingActivity.activity); } }}>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Atividade do workflow</p><h2 className="mt-1 text-sm font-bold">{editingActivity.activity.label}</h2></div>
              <button type="button" onClick={() => saveActivity(editingActivity.patientId, editingActivity.activity)} className="rounded border border-border px-2 py-1 text-xs font-semibold">Fechar</button>
            </div>
            <label className="mt-5 flex items-center gap-2 text-[12px] font-bold">
              <input type="checkbox" checked={!!editingActivity.activity.completed} onChange={(event) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity, completed: event.target.checked } })} />
              Marcar como concluída
            </label>
            <label className="mt-4 block text-[11px] font-bold">Prazo para conclusão
              <input type="time" className="mt-1 w-full rounded border border-input bg-background px-2 py-2 text-[12px] font-semibold" value={editingActivity.activity.dueAt ?? ""} onChange={(event) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity, dueAt: event.target.value || undefined } })} />
            </label>
            <label className="mt-4 block text-[11px] font-bold">Observações
              <textarea rows={4} className="mt-1 w-full resize-y rounded border border-input bg-background px-2 py-2 text-[12px] font-semibold" value={editingActivity.activity.note ?? ""} onChange={(event) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity, note: event.target.value } })} placeholder="Registrar observações da atividade" />
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => removeWorkflowActivity(editingActivity.patientId, editingActivity.activity)} className="rounded border border-clinical-critical/45 px-3 py-2 text-xs font-bold text-clinical-critical hover:bg-clinical-critical/10">Remover atividade</button>
              <button type="button" onClick={() => saveActivity(editingActivity.patientId, { ...editingActivity.activity, completed: true })} className="rounded bg-clinical-stable px-3 py-2 text-xs font-bold text-white shadow-sm hover:brightness-95">Concluir atividade</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
