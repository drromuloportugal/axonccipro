import { useEffect, useState } from "react";
import type { Patient, Severity } from "@/data/patients";
import mainLogo from "@/assets/axon-critical-care-logo-transparent.png";
import { CalendarDays, ClipboardList, Clock3, LogOut, Menu, ShieldCheck, Stethoscope, UserRoundCog } from "lucide-react";

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
  type: "monitoring" | "medication" | "device" | "care";
  completed?: boolean;
  note?: string;
  important?: boolean;
  hidden?: boolean;
  source?: "default" | "custom" | "fasthug";
  scheduledDate?: string;
  repeatEveryHours?: number;
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

function activityStartColumn(time: string) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 7;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const hourOnShift = hour < 7 ? hour + 24 : hour;
  const offset = Math.max(0, Math.min(23, hourOnShift - 7 + (minute >= 30 ? 0.5 : 0)));
  return Math.floor(offset) + 1;
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
              time: timeForShiftMinute(minute),
            },
      );
    }
    return occurrences;
  });
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
          <section className="ios-card rounded-lg p-4"><SectionTitle>Identificação</SectionTitle>{editing ? <div className="grid gap-2"><Field label="Paciente" value={identity.name} onChange={(value) => setIdentity({ ...identity, name: value })}/><Field label="Leito" value={identity.bed} onChange={(value) => setIdentity({ ...identity, bed: value })}/><Field label="Nº do atendimento" value={identity.id} onChange={(value) => setIdentity({ ...identity, id: value })}/><Field label="Idade" type="number" value={identity.age} onChange={(value) => setIdentity({ ...identity, age: value })}/><label className="text-[10px] font-bold uppercase text-muted-foreground">Sexo<select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold" value={identity.sex} onChange={(event) => setIdentity({ ...identity, sex: event.target.value as "M" | "F" })}><option value="M">Masculino</option><option value="F">Feminino</option></select></label><Field label="Admissão UTI" value={identity.admissionICU} onChange={(value) => setIdentity({ ...identity, admissionICU: value })}/><Field label="Previsão de alta" value={identity.expectedDischarge} onChange={(value) => setIdentity({ ...identity, expectedDischarge: value })}/></div> : <dl className="space-y-2 text-[11px]"><div><dt className="text-muted-foreground">Paciente</dt><dd>{identity.name || "—"}</dd></div><div><dt className="text-muted-foreground">Leito</dt><dd>{identity.bed || "—"}</dd></div><div><dt className="text-muted-foreground">Nº do atendimento</dt><dd className="font-mono">{identity.id}</dd></div><div><dt className="text-muted-foreground">Idade / sexo</dt><dd>{identity.age} anos · {identity.sex === "M" ? "Masculino" : "Feminino"}</dd></div><div><dt className="text-muted-foreground">Admissão UTI</dt><dd>{identity.admissionICU || "Não informada"}</dd></div><div><dt className="text-muted-foreground">Previsão de alta</dt><dd>{identity.expectedDischarge || "Não informada"}</dd></div></dl>}</section>
          <section className="ios-card rounded-lg p-4"><SectionTitle>Situação</SectionTitle><p className="text-[11px] text-muted-foreground">Diagnóstico principal</p>{editing ? <input className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)}/> : <p className="mt-1 text-sm font-bold text-foreground">{diagnosis || "Não informado"}</p>}<p className="mt-4 text-[11px] text-muted-foreground">Estado atual</p>{editing ? <select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}><option value="stable">Estável</option><option value="attention">Atenção</option><option value="critical">Crítico</option></select> : <span className={`mt-1 inline-flex rounded px-2 py-1 text-[12px] font-bold ${severityMeta[severity].className}`}>{severityMeta[severity].label}</span>}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Background</SectionTitle>{area("Doenças de base", baseConditions, setBaseConditions, "Uma condição por linha")}{area("Cirurgias / procedimentos prévios", surgeries, setSurgeries, "Um item por linha")}{area("Alergias", allergies, setAllergies, "Uma alergia por linha")}{area("Uso contínuo", chronicMeds, setChronicMeds, "Um medicamento por linha")}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Avaliação</SectionTitle><p className="text-[10px] font-semibold uppercase text-muted-foreground">Dieta</p>{editing ? <input className="w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diet} onChange={(event) => setDiet(event.target.value)}/> : <p className="text-[11px] font-semibold">{diet || "Não informada"}</p>}<p className="text-[10px] font-semibold uppercase text-muted-foreground">Dispositivos invasivos</p>{devices.length ? devices.map((device) => editing ? <div key={device.id} className="ios-inset grid gap-1 p-2"><Field label="Dispositivo" value={device.code} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, code: value } : item))}/><Field label="Sítio" value={device.site} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, site: value } : item))}/><div className="grid grid-cols-2 gap-1"><Field label="Calibre" value={device.size} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, size: value } : item))}/><Field label="Lúmens" value={device.lumens} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, lumens: value } : item))}/></div><Field label="Inserção" type="date" value={device.insertedAt} onChange={(value) => setDevices(devices.map((item) => item.id === device.id ? { ...item, insertedAt: value } : item))}/></div> : <div key={device.id} className="ios-inset px-2 py-1.5 text-[11px]"><b>{device.code}</b><br/><span className="text-muted-foreground">{[device.site, device.size ? `nº ${device.size}` : "", device.lumens ? `${device.lumens} lúmen(s)` : "", device.insertedAt].filter(Boolean).join(" · ")}</span></div>) : <p className="text-[11px] italic text-muted-foreground">Nenhum dispositivo ativo</p>}{area("LPP e curativos", skinCare, setSkinCare, "Registro de LPP e curativos, uma linha por item")}</section>
          <section className="ios-card space-y-3 rounded-lg p-4"><SectionTitle>Recomendação</SectionTitle>{area("Pendência de laboratório", pendingLab, setPendingLab)}{area("Pendência de imagem", pendingImaging, setPendingImaging)}{area("Pendência de cultura", pendingCultures, setPendingCultures)}{area("Cuidados", nursingCare, setNursingCare, "Um cuidado por linha")}{area("Laboratório", laboratory, setLaboratory, "Um exame por linha")}{area("Imagem", imaging, setImaging, "Um exame por linha")}{area("Culturas", cultures, setCultures, "Uma cultura por linha")}</section>
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
      type,
      source: "custom",
      scheduledDate: selectedDate,
    });
    setLabel("");
    setTime("08:00");
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
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" className="rounded border border-input bg-background px-2 py-1.5 text-[11px] font-semibold" value={time} onChange={(event) => setTime(event.target.value)} />
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
        <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="title-box !text-[12px]">RDC 36 · Segurança do paciente</h2></div><p className="mt-1 text-xs text-muted-foreground">Indicadores mensais de enfermagem. Os totais são calculados automaticamente.</p></div>
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
  const shift = shiftPeriod();
  const now = new Date();
  const nowMinute = shiftMinuteFor(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const currentTimeMarker = Math.max(0, Math.min(100, (nowMinute / (24 * 60)) * 100));
  const shiftProgress = patients.reduce(
    (total, patient) => {
      const activities = workflowActivitiesForToday(patient);
      return {
        completed: total.completed + activities.filter((activity) => activity.completed).length,
        total: total.total + activities.length,
        overdue: total.overdue + activities.filter((activity) => !activity.completed && shiftMinuteFor(activity.time) < nowMinute).length,
      };
    },
    { completed: 0, total: 0, overdue: 0 },
  );
  const shiftProgressPercent = shiftProgress.total ? Math.round((shiftProgress.completed / shiftProgress.total) * 100) : 0;
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activityDraft, setActivityDraft] = useState<{ patientId: string; label: string; time: string; type: WorkflowActivity["type"]; repeatEveryHours: number } | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [fastHugActivity, setFastHugActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [calendarPatientId, setCalendarPatientId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nursingView, setNursingView] = useState<"workflow" | "rdc36">("workflow");

  const addActivity = (patient: Patient) => {
    if (!activityDraft?.label.trim()) return;
    const existing = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...patient.nursingWorkflow,
        activities: [...existing, { id: `custom-${Date.now()}`, label: activityDraft.label.trim(), time: activityDraft.time || "12:00", type: activityDraft.type, repeatEveryHours: activityDraft.repeatEveryHours || undefined, source: "custom" }],
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
    const isStoredCustom = activity.source === "custom" && current.some((item) => item.id === activity.id);
    const activities = isStoredCustom
      ? current.filter((item) => item.id !== activity.id)
      : current.some((item) => item.id === activity.id)
        ? current.map((item) => item.id === activity.id ? { ...item, hidden: true } : item)
        : [...current, { ...activity, hidden: true, source: activity.source ?? "default" }];
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
              <p className="mt-1 flex items-center gap-1.5 text-xs text-neto-muted">
                <Clock3 className="h-3.5 w-3.5" />
                Workflow do plantão: {shift}
              </p>
            </div>
          </div>
          <div className="w-full justify-self-center rounded-2xl border border-cyan-100/80 bg-gradient-to-br from-white/90 via-cyan-50/85 to-teal-100/75 px-5 py-3 shadow-[0_10px_24px_rgba(14,116,144,0.2)] backdrop-blur-md" title="Atividades concluídas de todos os pacientes do plantão">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-800">Missão do plantão</p>
                <p className="mt-0.5 text-[11px] font-bold text-cyan-700/80">Progresso geral das atividades</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black leading-none text-cyan-800 drop-shadow-sm">{shiftProgress.completed}<span className="text-lg text-cyan-700/70">/{shiftProgress.total}</span></p>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-teal-700">{shiftProgressPercent}% concluído</p>
              </div>
            </div>
            <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-cyan-950/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 shadow-[0_0_10px_rgba(20,184,166,0.65)] transition-all" style={{ width: `${shiftProgressPercent}%` }} />
            </div>
            <div className="mt-2 flex justify-end">
              <span className="rounded-md border border-red-300/80 bg-red-50/90 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-red-700 shadow-sm">
                {shiftProgress.overdue} atrasada{shiftProgress.overdue === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-muted-foreground">
            {Object.entries(activityMeta).map(([type, meta]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full border ${meta.className}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        {patients.length === 0 ? (
          <div className="ios-card rounded-lg border-dashed px-5 py-14 text-center">
            <UserRoundCog className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Nenhum paciente ativo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Os pacientes cadastrados aparecerão aqui como barras de workflow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="min-w-[980px] space-y-3">
              {patients.map((patient) => {
                const severity = severityMeta[patient.severity];
                const activities = workflowActivitiesForToday(patient);
                const completedActivities = activities.filter((activity) => activity.completed).length;
                const patientProgressPercent = activities.length ? Math.round((completedActivities / activities.length) * 100) : 0;
                return (
                  <article
                    key={patient.id}
                    className="ios-card overflow-hidden rounded-lg"
                  >
                    <div className="flex min-h-[138px]">
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(patient)}
                        className="flex w-1/5 min-w-[196px] flex-col justify-between border-r border-border bg-soft-blue-gradient p-4 text-left transition-colors hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50"
                        title="Abrir resumo SBAR do paciente"
                      >
                        <div>
                          <div className="border-b-2 border-clinical-stable/70 pb-1 text-sm font-bold uppercase tracking-wide text-foreground">
                            {patient.name || "Sem identificação"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {patient.age} anos · {patient.sex === "M" ? "Masculino" : "Feminino"}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="ios-inset px-2 py-1 text-xs font-semibold">
                            Leito {patient.bed || "—"}
                          </span>
                          <span className={`rounded px-2 py-1 text-xs font-bold ${severity.className}`}>
                            {severity.label}
                          </span>
                        </div>
                        <div className="mt-3 border-t border-border/70 pt-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                            Diagnóstico atual
                          </div>
                          <div className="mt-1 rounded-sm border border-white/70 bg-white/45 px-2 py-1.5 text-[15px] font-extrabold leading-snug text-slate-800 drop-shadow-[0_1px_1px_rgba(15,23,42,0.28)]">
                            {currentDiagnosis(patient)}
                          </div>
                        </div>
                        <div className="mt-3 rounded-sm border border-cyan-100/80 bg-gradient-to-r from-cyan-50/90 to-teal-50/80 p-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-800">Missões do dia</span>
                            <span className="text-[15px] font-black text-cyan-800">{completedActivities}<span className="text-[11px] text-cyan-700/70">/{activities.length}</span></span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cyan-950/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all" style={{ width: `${patientProgressPercent}%` }} />
                          </div>
                        </div>
                      </button>

                      <section className="w-4/5 bg-surface/55 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Linha do tempo do plantão
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" onClick={() => setCalendarPatientId(patient.id)} className="inline-flex items-center gap-1 rounded border border-border bg-background/75 px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted">
                              <CalendarDays className="h-3 w-3" /> Agenda
                            </button>
                            <button type="button" onClick={() => setActivityDraft({ patientId: patient.id, label: "", time: "12:00", type: "care", repeatEveryHours: 0 })} className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20">+ Atividade</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto pb-3" aria-label="Linha do tempo de atividades com rolagem horizontal">
                          <div className="min-w-[2016px]">
                            <div className="mb-1 grid text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: "repeat(25, minmax(84px, 1fr))" }}>
                              {[["07:00", 1], ["11:00", 5], ["15:00", 9], ["19:00", 13], ["23:00", 17], ["03:00", 21], ["07:00", 25]].map(([label, column], index) => (
                                <span key={`${label}-${index}`} style={{ gridColumn: String(column) }}>{label}</span>
                              ))}
                            </div>
                            <div className="relative grid min-h-[182px] auto-rows-[170px] grid-flow-row-dense gap-2 rounded-sm border border-white/70 bg-white/35 p-2.5 shadow-inner backdrop-blur-md" style={{ gridTemplateColumns: "repeat(24, minmax(84px, 1fr))" }}>
                              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500/85 shadow-[0_0_7px_rgba(239,68,68,0.75)]" style={{ left: `${currentTimeMarker}%` }} />
                              {activities.map((activity, index) => {
                                const meta = activityMeta[activity.type];
                                const column = activityStartColumn(activity.time);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => activity.source === "fasthug" ? setFastHugActivity({ patientId: patient.id, activity }) : setEditingActivity({ patientId: patient.id, activity })}
                                    key={`${patient.id}-${activity.id ?? activity.label}-${index}`}
                                    style={{ gridColumnStart: column, gridColumnEnd: "span 3" }}
                                    className={`relative min-h-[128px] min-w-0 overflow-hidden rounded-md border-4 bg-white/10 px-3 py-2.5 text-left shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-2xl ring-1 ring-white/65 transition-all hover:-translate-y-0.5 hover:ring-white/90 hover:shadow-[0_14px_26px_rgba(15,23,42,0.24)] [&>div]:relative [&>div]:z-10 ${meta.className} ${activity.completed ? "opacity-60" : ""}`}
                                    title={`${activity.time} · ${activity.label}${activity.repeatEveryHours ? ` · repetir a cada ${activity.repeatEveryHours} h` : ""}`}
                                  >
                                    <span aria-hidden="true" className="pointer-events-none absolute -top-6 left-4 right-4 h-14 rounded-full bg-white/35 blur-xl" />
                                    <div className="text-[11px] font-extrabold uppercase leading-tight tracking-wide opacity-85">
                                      {activity.time} · {meta.label}
                                    </div>
                                    <div className={`mt-1 break-words text-[13px] font-extrabold leading-[1.15] ${activity.completed ? "line-through" : ""}`}>
                                      {activity.label}
                                    </div>
                                    {activity.repeatEveryHours && <div className="mt-1 text-[10px] font-bold opacity-70">REPETIR /{activity.repeatEveryHours} H</div>}
                                    {activity.note && <div className="mt-1 break-words text-[10px] font-semibold leading-snug">{activity.note}</div>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {activityDraft?.patientId === patient.id && (
                          <div className="mt-2 grid grid-cols-[minmax(160px,1fr)_86px_120px_112px_auto_auto] gap-1.5">
                            <input className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" placeholder="Nova atividade" value={activityDraft.label} onChange={(event) => setActivityDraft({ ...activityDraft, label: event.target.value })} />
                            <input type="time" className="rounded border border-input bg-white/80 px-2 py-1.5 text-[12px] font-bold shadow-sm" value={activityDraft.time} onChange={(event) => setActivityDraft({ ...activityDraft, time: event.target.value })} />
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setEditingActivity(null)}>
          <section className="w-full max-w-md rounded-xl border border-border bg-soft-blue-gradient p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Atividade do workflow</p><h2 className="mt-1 text-sm font-bold">{editingActivity.activity.label}</h2></div>
              <button type="button" onClick={() => setEditingActivity(null)} className="rounded border border-border px-2 py-1 text-xs font-semibold">Fechar</button>
            </div>
            <label className="mt-5 flex items-center gap-2 text-[12px] font-bold">
              <input type="checkbox" checked={!!editingActivity.activity.completed} onChange={(event) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity, completed: event.target.checked } })} />
              Marcar como concluída
            </label>
            <label className="mt-4 block text-[11px] font-bold">Observações
              <textarea rows={4} className="mt-1 w-full resize-y rounded border border-input bg-background px-2 py-2 text-[12px] font-semibold" value={editingActivity.activity.note ?? ""} onChange={(event) => setEditingActivity({ ...editingActivity, activity: { ...editingActivity.activity, note: event.target.value } })} placeholder="Registrar observações da atividade" />
            </label>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={() => removeWorkflowActivity(editingActivity.patientId, editingActivity.activity)} className="rounded border border-clinical-critical/45 px-3 py-2 text-xs font-bold text-clinical-critical hover:bg-clinical-critical/10">Remover atividade</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingActivity(null)} className="rounded border border-border px-3 py-2 text-xs font-semibold">Cancelar</button>
                <button type="button" onClick={() => saveActivity(editingActivity.patientId, editingActivity.activity)} className="rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Salvar</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
