import { useState } from "react";
import type { Patient, Severity } from "@/data/patients";
import { ClipboardList, Clock3, LogOut, Stethoscope, UserRoundCog } from "lucide-react";

type Props = {
  patients: Patient[];
  onOpenMedicalPanel: () => void;
  onSignOut: () => void;
};

type WorkflowActivity = {
  label: string;
  time: string;
  type: "monitoring" | "medication" | "device" | "care";
};

const severityMeta: Record<Severity, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-clinical-critical text-white" },
  attention: { label: "Atenção", className: "bg-clinical-attention text-white" },
  stable: { label: "Estável", className: "bg-clinical-stable text-white" },
};

const activityMeta: Record<WorkflowActivity["type"], { label: string; className: string }> = {
  monitoring: {
    label: "Monitorização",
    className: "border-sky-300 bg-sky-100 text-sky-950",
  },
  medication: {
    label: "Medicação",
    className: "border-emerald-300 bg-emerald-100 text-emerald-950",
  },
  device: {
    label: "Dispositivos",
    className: "border-amber-300 bg-amber-100 text-amber-950",
  },
  care: {
    label: "Cuidados",
    className: "border-violet-300 bg-violet-100 text-violet-950",
  },
};

const activityPositions = [
  "col-span-3",
  "col-span-3",
  "col-span-3",
  "col-span-3",
] as const;

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

  activities.push(
    ...(nurseConducts.length
      ? nurseConducts.map((label, index) => ({
          label,
          time: index === 0 ? "23:00" : "03:00",
          type: "care" as const,
        }))
      : [{ label: "Balanço hídrico e reavaliação", time: "23:00", type: "care" as const }]),
  );

  return activities.slice(0, 4);
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
        <li key={`${item}-${index}`} className="border-l-2 border-primary/40 pl-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{children}</h3>;
}

function SbarPanel({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const baseConditions = patient.diagnoses
    .filter((diagnosis) => diagnosis.category === "previous" || diagnosis.category === "inactive")
    .map((diagnosis) => diagnosis.label);
  const surgeries = patient.procedures.map((procedure) => procedure.label);
  const chronicMeds = (patient.pastMedications ?? []).map((medication) =>
    [medication.name, medication.dose, medication.route].filter(Boolean).join(" · "),
  );
  const devices = (patient.devices ?? [])
    .filter((device) => !device.removedAt)
    .map((device) =>
      [device.typeCode, device.site, device.size ? `nº ${device.size}` : ""].filter(Boolean).join(" · "),
    );
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
  const laboratory = patient.exams
    .slice(0, 8)
    .map((exam) => `${exam.label}: ${exam.value}${exam.unit ? ` ${exam.unit}` : ""}`);
  const imaging = (patient.imaging ?? [])
    .slice(0, 5)
    .map((exam) => [exam.modality, exam.region, exam.summary ?? exam.status].filter(Boolean).join(" · "));
  const cultures = (patient.cultures ?? [])
    .slice(0, 5)
    .map((culture) =>
      [culture.source, culture.organism, culture.result].filter(Boolean).join(" · "),
    );
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
        className="max-h-[92vh] w-full max-w-[1600px] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">SBAR · Enfermagem</p>
            <h2 className="mt-1 text-base font-bold">{patient.name} · Leito {patient.bed || "—"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-surface-3"
          >
            Fechar
          </button>
        </header>

        <div className="grid gap-3 p-4 xl:grid-cols-5">
          <section className="rounded-xl border border-border bg-surface/45 p-4">
            <SectionTitle>Identificação</SectionTitle>
            <dl className="space-y-2 text-[11px]">
              <div><dt className="text-muted-foreground">Paciente</dt><dd className="font-semibold">{patient.name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Leito</dt><dd>{patient.bed || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Nº do atendimento</dt><dd className="font-mono">{patient.id}</dd></div>
              <div><dt className="text-muted-foreground">Admissão UTI</dt><dd>{patient.admissionICU || "Não informada"}</dd></div>
              <div><dt className="text-muted-foreground">Previsão de alta</dt><dd>{expectedDischarge}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface/45 p-4">
            <SectionTitle>Situação</SectionTitle>
            <p className="text-[11px] text-muted-foreground">Diagnóstico principal</p>
            <p className="mt-1 text-sm font-bold text-foreground">{currentDiagnosis(patient)}</p>
            <p className="mt-4 text-[11px] text-muted-foreground">Estado atual</p>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground">
              {[`Ventilação: ${patient.state.vent}`, `FiO₂: ${patient.state.fio2}%`, `PAM: ${patient.state.pam} mmHg`, patient.state.dva ? `DVA: ${patient.state.dva}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface/45 p-4">
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

          <section className="rounded-xl border border-border bg-surface/45 p-4">
            <SectionTitle>Avaliação</SectionTitle>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dieta</p>
            <p className="mt-1 text-[11px] font-semibold text-foreground">{patient.state.dieta || "Não informada"}</p>
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Dispositivos invasivos</p>
            {listItems(devices, "Nenhum dispositivo ativo")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">LPP e curativos</p>
            {listItems([...activeLpp, ...dressingCare], "Sem LPP ou curativo registrado")}
          </section>

          <section className="rounded-xl border border-border bg-surface/45 p-4">
            <SectionTitle>Recomendação</SectionTitle>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Pendências</p>
            {listItems(pendingItems, "Sem pendências registradas")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Cuidados</p>
            {listItems(nursingCare, "Sem cuidados específicos registrados")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Laboratório</p>
            {listItems(laboratory, "Sem exames laboratoriais")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Imagem</p>
            {listItems(imaging, "Sem exames de imagem")}
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-muted-foreground">Culturas</p>
            {listItems(cultures, "Sem culturas registradas")}
          </section>
        </div>
      </section>
    </div>
  );
}

export function NursingDashboard({ patients, onOpenMedicalPanel, onSignOut }: Props) {
  const shift = shiftPeriod();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/80 px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h1 className="text-base font-bold uppercase tracking-wide">Painel de enfermagem</h1>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Workflow do plantão: {shift}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenMedicalPanel}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Stethoscope className="h-4 w-4" />
              Painel médico
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-3"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Pacientes ativos</h2>
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
          <div className="rounded-xl border border-dashed border-border px-5 py-14 text-center">
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
                const activities = activitiesFor(patient);
                return (
                  <article
                    key={patient.id}
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                  >
                    <div className="flex min-h-[138px]">
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(patient)}
                        className="flex w-1/5 min-w-[196px] flex-col justify-between border-r border-border bg-surface/70 p-4 text-left transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        title="Abrir resumo SBAR do paciente"
                      >
                        <div>
                          <div className="text-sm font-bold uppercase tracking-wide text-foreground">
                            {patient.name || "Sem identificação"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {patient.age} anos · {patient.sex === "M" ? "Masculino" : "Feminino"}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold">
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

                      <section className="w-4/5 p-4">
                        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>07:00</span>
                          <span>11:00</span>
                          <span>15:00</span>
                          <span>19:00</span>
                          <span>23:00</span>
                          <span>03:00</span>
                          <span>07:00</span>
                        </div>
                        <div className="grid min-h-[78px] grid-cols-12 gap-2 rounded-lg border border-dashed border-border bg-background/50 p-2">
                          {activities.map((activity, index) => {
                            const meta = activityMeta[activity.type];
                            return (
                              <div
                                key={`${patient.id}-${activity.label}-${index}`}
                                className={`min-w-0 rounded-md border px-2 py-2 ${meta.className} ${activityPositions[index]}`}
                                title={activity.label}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                                  {activity.time} · {meta.label}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] font-semibold">
                                  {activity.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
      {selectedPatient && <SbarPanel patient={selectedPatient} onClose={() => setSelectedPatient(null)} />}
    </div>
  );
}
