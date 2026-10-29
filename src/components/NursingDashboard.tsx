import { useState } from "react";
import type { Patient, Severity } from "@/data/patients";
import { CalendarDays, ClipboardList, Clock3, LogOut, Stethoscope, UserRoundCog } from "lucide-react";

type Props = {
  patients: Patient[];
  onOpenMedicalPanel: () => void;
  onSignOut: () => void;
  onUpdatePatient: (patient: Patient) => void;
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
    className: "border-clinical-resp/40 bg-clinical-resp/10 text-ink",
  },
  medication: {
    label: "Medicação",
    className: "border-clinical-stable/40 bg-clinical-stable/10 text-ink",
  },
  device: {
    label: "Dispositivos",
    className: "border-clinical-device/40 bg-clinical-device/10 text-ink",
  },
  care: {
    label: "Cuidados",
    className: "border-clinical-neuro/40 bg-clinical-neuro/10 text-ink",
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

function SbarPanel({ patient, onClose, onUpdatePatient }: { patient: Patient; onClose: () => void; onUpdatePatient: (patient: Patient) => void }) {
  const [editing, setEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(() => currentDiagnosis(patient));
  const [diet, setDiet] = useState(() => patient.state.dieta ?? "");
  const [severity, setSeverity] = useState<Severity>(() => patient.severity);
  const [pendingLab, setPendingLab] = useState(() => patient.dischargeCheck?.pendencies?.lab ?? "");
  const [pendingImaging, setPendingImaging] = useState(() => patient.dischargeCheck?.pendencies?.imaging ?? "");
  const [pendingCultures, setPendingCultures] = useState(() => patient.dischargeCheck?.pendencies?.cultures ?? "");

  const saveSbar = () => {
    const diagnoses = [...patient.diagnoses];
    let index = -1;
    for (let i = diagnoses.length - 1; i >= 0; i--) {
      if (diagnoses[i].category === "current") { index = i; break; }
    }
    if (index >= 0) diagnoses[index] = { ...diagnoses[index], label: diagnosis.trim() || diagnoses[index].label };
    else if (diagnosis.trim()) diagnoses.push({ date: "", label: diagnosis.trim(), kind: "neutral", category: "current" });
    onUpdatePatient({
      ...patient,
      diagnoses,
      severity,
      state: { ...patient.state, dieta: diet },
      dischargeCheck: {
        ...patient.dischargeCheck,
        pendencies: {
          ...patient.dischargeCheck?.pendencies,
          lab: pendingLab,
          imaging: pendingImaging,
          cultures: pendingCultures,
        },
      },
    });
    setEditing(false);
  };

  const baseConditions = patient.diagnoses
    .filter((diagnosis) => diagnosis.category === "previous" || diagnosis.category === "inactive")
    .map((diagnosis) => diagnosis.label);
  const surgeries = patient.procedures.map((procedure) => procedure.label);
  const chronicMeds = (patient.pastMedications ?? []).map((medication) =>
    [medication.name, medication.dose, medication.route].filter(Boolean).join(" · "),
  );
  const devices = (patient.devices ?? [])
    .filter((device) => !device.removedAt)
    .map((device) => ({
      code: device.typeCode,
      detail: [device.site, device.size ? `nº ${device.size}` : "", device.lumens ? `${device.lumens} lúmen${device.lumens === 1 ? "" : "s"}` : "", device.insertedAt ? `Inserido: ${new Date(device.insertedAt).toLocaleDateString("pt-BR")}` : ""]
        .filter(Boolean)
        .join(" · "),
    }));
  const activeLpp = (patient.lpp ?? [])
    .filter((lesion) => !lesion.resolvedAt)
    .map((lesion) => `LPP ${lesion.siteLabel ?? lesion.site} · estágio ${lesion.stage}`);
  const dressingCare = patient.conducts
    .filter((conduct) => conduct.system === "skin")
    .flatMap((conduct) => [
      ...(conduct.text ? [conduct.text] : []),
      ...(conduct.subItems ?? []).filter((item) => !item.hidden).map((item) => item.text),
    ]);
  const nursingCare = patient.conducts
    .filter((conduct) => conduct.team === "Enfermagem")
    .flatMap((conduct) => [
      ...(conduct.text ? [conduct.text] : []),
      ...(conduct.subItems ?? []).filter((item) => !item.hidden).map((item) => item.text),
    ]);
  const pendencies = patient.dischargeCheck?.pendencies;
  const pendingItems = [
    pendencies?.lab ? `Laboratório: ${pendencies.lab}` : "",
    pendencies?.imaging ? `Imagem: ${pendencies.imaging}` : "",
    pendencies?.cultures ? `Culturas: ${pendencies.cultures}` : "",
    pendencies?.consults ? `Interconsultas: ${pendencies.consults}` : "",
  ].filter(Boolean);
  const laboratory = (patient.exams ?? []).slice(0, 8).map((exam) => ({
    text: `${exam.label}: ${exam.value}${exam.unit ? ` ${exam.unit}` : ""}`,
    state: !String(exam.value ?? "").trim() ? "pending" : exam.critical || exam.trend !== "flat" ? "changed" : "normal",
  }) as { text: string; state: ResultState });
  const imaging = (patient.imaging ?? []).slice(0, 5).map((exam) => ({
    text: [exam.modality, exam.region, exam.summary ?? exam.status].filter(Boolean).join(" · "),
    state: exam.status === "solicitado" ? "pending" : exam.conclusion === "alterado" || exam.conclusion === "critico" ? "changed" : "normal",
  }) as { text: string; state: ResultState });
  const cultures = (patient.cultures ?? []).slice(0, 5).map((culture) => ({
    text: [culture.source, culture.organism, culture.result].filter(Boolean).join(" · "),
    state: culture.result === "andamento" ? "pending" : culture.result === "positiva" ? "changed" : "normal",
  }) as { text: string; state: ResultState });
  const expectedDischarge = patient.dischargeCheck?.expectedTransfer || "Não informada";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Resumo SBAR de ${patient.name}`}
      onClick={onClose}
    >
      <section
        className="max-h-[92vh] w-full max-w-[1600px] overflow-y-auto rounded-xl border border-border bg-soft-blue-gradient shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="neto-glass sticky top-0 z-10 flex items-center justify-between px-5 py-4 text-neto-foreground backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neto-muted">SBAR · Enfermagem</p>
            <h2 className="mt-1 text-base font-bold text-neto-foreground">{patient.name} · Leito {patient.bed || "—"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Cancelar</button>
                <button type="button" onClick={saveSbar} className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-primary">Salvar</button>
              </>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground hover:bg-white/20">Editar</button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neto-line bg-white/10 px-3 py-1.5 text-xs font-semibold text-neto-foreground transition-colors hover:bg-white/20"
            >
              Fechar
            </button>
          </div>
        </header>

        <div className="grid gap-3 p-4 text-[13px] font-bold xl:grid-cols-5">
          <section className="ios-card rounded-lg p-4">
            <SectionTitle>Identificação</SectionTitle>
            <dl className="space-y-2 text-[11px]">
              <div><dt className="text-muted-foreground">Paciente</dt><dd className="font-semibold">{patient.name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Leito</dt><dd>{patient.bed || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Nº do atendimento</dt><dd className="font-mono">{patient.id}</dd></div>
              <div><dt className="text-muted-foreground">Admissão UTI</dt><dd>{patient.admissionICU || "Não informada"}</dd></div>
              <div><dt className="text-muted-foreground">Previsão de alta</dt><dd>{expectedDischarge}</dd></div>
            </dl>
          </section>

          <section className="ios-card rounded-lg p-4">
            <SectionTitle>Situação</SectionTitle>
            <p className="text-[11px] text-muted-foreground">Diagnóstico principal</p>
            {editing ? (
              <input className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
            ) : (
              <p className="mt-1 text-sm font-bold text-foreground">{currentDiagnosis(patient)}</p>
            )}
            <p className="mt-4 text-[11px] text-muted-foreground">Estado atual</p>
            {editing ? (
              <select className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
                <option value="stable">Estável</option>
                <option value="attention">Atenção</option>
                <option value="critical">Crítico</option>
              </select>
            ) : (
              <span className={`mt-1 inline-flex rounded px-2 py-1 text-[12px] font-bold ${severityMeta[patient.severity].className}`}>
                {severityMeta[patient.severity].label}
              </span>
            )}
          </section>

          <section className="ios-card rounded-lg p-4">
            <SectionTitle>Background</SectionTitle>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Doenças de base</p>
            {listItems(baseConditions)}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Cirurgias / procedimentos prévios</p>
            {listItems(surgeries)}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Alergias</p>
            {listItems(patient.allergies)}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Uso contínuo</p>
            {listItems(chronicMeds)}
          </section>

          <section className="ios-card rounded-lg p-4">
            <SectionTitle>Avaliação</SectionTitle>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dieta</p>
            {editing ? (
              <input className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[12px] font-bold" value={diet} onChange={(event) => setDiet(event.target.value)} />
            ) : (
              <p className="mt-1 text-[11px] font-semibold text-foreground">{patient.state.dieta || "Não informada"}</p>
            )}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Dispositivos invasivos</p>
            {devices.length ? (
              <ul className="space-y-1">
                {devices.map((device, index) => (
                  <li key={`${device.code}-${index}`} className="ios-inset px-2 py-1.5">
                    <div className="text-[11px] font-bold text-foreground">{device.code}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-muted-foreground">{device.detail || "Sem detalhe adicional"}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[11px] font-bold italic text-muted-foreground">Nenhum dispositivo ativo</p>}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">LPP e curativos</p>
            {listItems([...activeLpp, ...dressingCare], "Sem LPP ou curativo registrado")}
          </section>

          <section className="ios-card rounded-lg p-4">
            <SectionTitle>Recomendação</SectionTitle>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Pendências</p>
            {editing ? (
              <div className="space-y-1">
                <input className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold" value={pendingLab} onChange={(event) => setPendingLab(event.target.value)} placeholder="Pendência de laboratório" />
                <input className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold" value={pendingImaging} onChange={(event) => setPendingImaging(event.target.value)} placeholder="Pendência de imagem" />
                <input className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] font-bold" value={pendingCultures} onChange={(event) => setPendingCultures(event.target.value)} placeholder="Pendência de cultura" />
              </div>
            ) : listItems(pendingItems, "Sem pendências registradas")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Cuidados</p>
            {listItems(nursingCare, "Sem cuidados específicos registrados")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Laboratório</p>
            {resultItems(laboratory, "Sem exames laboratoriais")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Imagem</p>
            {resultItems(imaging, "Sem exames de imagem")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Culturas</p>
            {resultItems(cultures, "Sem culturas registradas")}
          </section>
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

export function NursingDashboard({ patients, onOpenMedicalPanel, onSignOut, onUpdatePatient }: Props) {
  const shift = shiftPeriod();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activityDraft, setActivityDraft] = useState<{ patientId: string; label: string; time: string; type: WorkflowActivity["type"] } | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [fastHugActivity, setFastHugActivity] = useState<{ patientId: string; activity: WorkflowActivity } | null>(null);
  const [calendarPatientId, setCalendarPatientId] = useState<string | null>(null);

  const addActivity = (patient: Patient) => {
    if (!activityDraft?.label.trim()) return;
    const existing = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
    onUpdatePatient({
      ...patient,
      nursingWorkflow: {
        ...patient.nursingWorkflow,
        activities: [...existing, { id: `custom-${Date.now()}`, label: activityDraft.label.trim(), time: activityDraft.time || "12:00", type: activityDraft.type, source: "custom" }],
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
    <div className="min-h-screen bg-soft-blue-gradient text-foreground">
      <header className="neto-glass border-b-0 px-4 py-4 text-neto-foreground shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-neto-foreground" />
              <h1 className="text-base font-bold uppercase tracking-wide text-neto-foreground">Painel de enfermagem</h1>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-neto-muted">
              <Clock3 className="h-3.5 w-3.5" />
              Workflow do plantão: {shift}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                const storedActivities = Array.isArray(patient.nursingWorkflow?.activities) ? patient.nursingWorkflow.activities : [];
                const baseActivities = activitiesFor(patient).map((activity, index) => ({ ...activity, id: `base-${index}`, source: activity.source ?? "default" as const }));
                const activities: WorkflowActivity[] = [
                  ...baseActivities
                    .map((activity) => ({ ...activity, ...(storedActivities.find((item) => item.id === activity.id) ?? {}) }))
                    .filter((activity) => !activity.hidden),
                  ...storedActivities.filter((activity) => !baseActivities.some((base) => base.id === activity.id) && !activity.hidden && (!activity.scheduledDate || activity.scheduledDate === currentShiftDate())),
                ];
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
                          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Diagnóstico atual
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">
                            {currentDiagnosis(patient)}
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
                            <button type="button" onClick={() => setActivityDraft({ patientId: patient.id, label: "", time: "12:00", type: "care" })} className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20">+ Atividade</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto pb-2" aria-label="Linha do tempo de atividades com rolagem horizontal">
                          <div className="min-w-[1440px]">
                            <div className="mb-1 grid text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: "repeat(25, minmax(56px, 1fr))" }}>
                              {[["07:00", 1], ["11:00", 5], ["15:00", 9], ["19:00", 13], ["23:00", 17], ["03:00", 21], ["07:00", 25]].map(([label, column], index) => (
                                <span key={`${label}-${index}`} style={{ gridColumn: String(column) }}>{label}</span>
                              ))}
                            </div>
                            <div className="ios-inset grid min-h-[78px] gap-2 p-2" style={{ gridTemplateColumns: "repeat(24, minmax(56px, 1fr))" }}>
                              {activities.map((activity, index) => {
                                const meta = activityMeta[activity.type];
                                const column = activityStartColumn(activity.time);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => activity.source === "fasthug" ? setFastHugActivity({ patientId: patient.id, activity }) : setEditingActivity({ patientId: patient.id, activity })}
                                    key={`${patient.id}-${activity.id ?? activity.label}-${index}`}
                                    style={{ gridColumnStart: column, gridColumnEnd: "span 3" }}
                                    className={`min-w-0 rounded-md border px-2 py-2 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${meta.className} ${activity.completed ? "opacity-60" : ""}`}
                                    title="Clique para concluir ou registrar observação"
                                  >
                                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                                      {activity.time} · {meta.label} {activity.completed ? "· Concluída" : ""}
                                    </div>
                                    <div className={`mt-0.5 truncate text-[11px] font-semibold ${activity.completed ? "line-through" : ""}`}>
                                      {activity.label}
                                    </div>
                                    {activity.note && <div className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug">{activity.note}</div>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {activityDraft?.patientId === patient.id && (
                          <div className="mt-2 grid grid-cols-[1fr_86px_120px_auto_auto] gap-1.5">
                            <input className="rounded border border-input bg-background px-2 py-1 text-[11px] font-semibold" placeholder="Nova atividade" value={activityDraft.label} onChange={(event) => setActivityDraft({ ...activityDraft, label: event.target.value })} />
                            <input type="time" className="rounded border border-input bg-background px-2 py-1 text-[11px] font-semibold" value={activityDraft.time} onChange={(event) => setActivityDraft({ ...activityDraft, time: event.target.value })} />
                            <select className="rounded border border-input bg-background px-2 py-1 text-[11px] font-semibold" value={activityDraft.type} onChange={(event) => setActivityDraft({ ...activityDraft, type: event.target.value as WorkflowActivity["type"] })}>
                              {Object.entries(activityMeta).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
                            </select>
                            <button type="button" onClick={() => addActivity(patient)} className="rounded bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">Adicionar</button>
                            <button type="button" onClick={() => setActivityDraft(null)} className="rounded border border-border px-2 py-1 text-[11px] font-semibold">Cancelar</button>
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
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingActivity(null)} className="rounded border border-border px-3 py-2 text-xs font-semibold">Cancelar</button>
              <button type="button" onClick={() => saveActivity(editingActivity.patientId, editingActivity.activity)} className="rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Salvar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
