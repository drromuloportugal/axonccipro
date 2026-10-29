import { useEffect, useMemo, useState } from "react";
import type {
  FastHugCheck,
  NursingWorkflowActivity,
  NursingWorkflowActivityType,
  Patient,
} from "@/data/patients";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Pencil, Plus, Trash2, X } from "lucide-react";

type Props = {
  patient: Patient;
  onUpdatePatient: (patient: Patient) => void;
};

const workflowMeta: Record<NursingWorkflowActivityType, { label: string; className: string }> = {
  monitoring: { label: "Monitorização", className: "border-clinical-resp/40 bg-clinical-resp/10 text-ink" },
  medication: { label: "Medicação", className: "border-clinical-stable/40 bg-clinical-stable/10 text-ink" },
  device: { label: "Dispositivos", className: "border-clinical-device/40 bg-clinical-device/10 text-ink" },
  care: { label: "Cuidados", className: "border-clinical-neuro/40 bg-clinical-neuro/10 text-ink" },
};

const FASTHUG_CRITERIA = [
  ["feeding", "F — Feeding", "Dieta e via de administração"],
  ["analgesia", "A — Analgesia", "Dor e analgesia"],
  ["sedation", "S — Sedation", "Sedação e meta de RASS"],
  ["thromboprophylaxis", "T — Thromboprophylaxis", "Profilaxia de TEV"],
  ["head", "H — Head up", "Cabeceira elevada quando indicada"],
  ["ulcer", "U — Ulcer prophylaxis", "Profilaxia de úlcera de estresse"],
  ["glucose", "G — Glucose", "Controle glicêmico"],
  ["medications", "M — Medications", "Reconciliação medicamentosa"],
  ["antibiotics", "A — Antibiotics", "Antimicrobianos: indicação e duração"],
  ["indications", "I — Indications", "Indicações das terapias em curso"],
  ["dosing", "D — Drug dosing", "Dose e ajustes de medicamentos"],
  ["electrolytes", "E — Electrolytes", "Eletrólitos e reposições"],
  ["nutrition", "N — Nutrition", "Metas nutricionais"],
  ["stopDates", "S — Stop dates", "Datas de suspensão e revisão"],
] as const;

function activityId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function defaultActivities(patient: Patient): NursingWorkflowActivity[] {
  const meds = patient.medications
    .filter((medication) => medication.active !== false)
    .slice(0, 2)
    .map((medication, index) => ({
      id: "med-" + activityId(medication.name),
      label: `Administrar ${medication.name}`,
      time: index === 0 ? "09:00" : "15:00",
      type: "medication" as const,
      source: "default" as const,
    }));
  const devices = (patient.devices ?? []).filter((device) => !device.removedAt);
  const nurseCare = patient.conducts
    .filter((conduct) => conduct.team === "Enfermagem")
    .flatMap((conduct) => [
      ...(conduct.text ? [conduct.text] : []),
      ...(conduct.subItems ?? []).filter((item) => !item.hidden).map((item) => item.text),
    ])
    .filter(Boolean)
    .slice(0, 1);

  return [
    {
      id: "monitoring",
      label: "Sinais vitais e avaliação",
      time: "07:00",
      type: "monitoring",
      source: "default",
    },
    ...meds,
    ...(devices.length
      ? [{
          id: "devices",
          label: `Checar ${devices.length} invasão(ões)`,
          time: "19:00",
          type: "device" as const,
          source: "default" as const,
        }]
      : []),
    ...(nurseCare.length
      ? [{
          id: "nursing-care",
          label: nurseCare[0],
          time: "23:00",
          type: "care" as const,
          source: "default" as const,
        }]
      : [{
          id: "balance",
          label: "Balanço hídrico e reavaliação",
          time: "23:00",
          type: "care" as const,
          source: "default" as const,
        }]),
    {
      id: "fasthug-maidens",
      label: "FASTHUG MAIDENS",
      time: "17:00",
      type: "care",
      source: "fasthug",
    },
  ];
}

function timelinePercent(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const value = (Number.isFinite(hours) ? hours : 7) + (Number.isFinite(minutes) ? minutes / 60 : 0);
  const shifted = value < 7 ? value + 24 : value;
  return Math.max(0, Math.min(100, ((shifted - 7) / 24) * 100));
}

function currentPercent(now: Date) {
  return timelinePercent(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
}

function TaskDialog({
  activity,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  activity: NursingWorkflowActivity;
  isNew: boolean;
  onClose: () => void;
  onSave: (activity: NursingWorkflowActivity) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(activity);
  useEffect(() => setDraft(activity), [activity]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <section className="w-full max-w-lg rounded-xl border border-border bg-soft-blue-gradient p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Workflow de enfermagem</p>
            <h2 className="mt-1 text-base font-bold">{isNew ? "Nova atividade" : "Editar atividade"}</h2>
          </div>
          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-surface-3" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="text-[11px] font-semibold">Atividade
            <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold">Horário
              <input type="time" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
            </label>
            <label className="text-[11px] font-semibold">Tipo
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as NursingWorkflowActivityType })}>
                {Object.entries(workflowMeta).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input type="checkbox" checked={!!draft.important} onChange={(event) => setDraft({ ...draft, important: event.target.checked })} />
            Marcar como IMPORTANTE
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input type="checkbox" checked={!!draft.completed} onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} />
            Atividade concluída
          </label>
          <label className="text-[11px] font-semibold">Observações
            <textarea rows={3} className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.note ?? ""} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Registrar observações da atividade" />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          {onDelete ? <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-2 text-xs font-semibold text-clinical-critical"><Trash2 className="h-3.5 w-3.5" />Remover</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold">Cancelar</button>
            <button type="button" disabled={!draft.label.trim() || !draft.time} onClick={() => onSave({ ...draft, label: draft.label.trim() })} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Salvar</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FastHugDialog({ patient, onClose, onSave }: { patient: Patient; onClose: () => void; onSave: (checks: Record<string, FastHugCheck>) => void }) {
  const [checks, setChecks] = useState<Record<string, FastHugCheck>>(patient.nursingWorkflow?.fastHug?.checks ?? {});
  const setCheck = (key: string, patch: Partial<FastHugCheck>) => setChecks((current) => ({ ...current, [key]: { status: "pendente", ...current[key], ...patch } }));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-soft-blue-gradient shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="neto-glass sticky top-0 flex items-center justify-between px-5 py-4 text-neto-foreground">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neto-muted">Reavaliação de segurança</p><h2 className="mt-1 text-base font-bold">FASTHUG MAIDENS · {patient.name}</h2></div>
          <button type="button" className="rounded border border-neto-line bg-white/10 p-1.5 hover:bg-white/20" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {FASTHUG_CRITERIA.map(([key, label, description]) => {
            const check = checks[key] ?? { status: "pendente", note: "" };
            return (
              <section key={key} className="ios-card rounded-lg p-3">
                <div className="text-[11px] font-bold">{label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{description}</div>
                <div className="mt-3 grid grid-cols-[140px_1fr] gap-2">
                  <select className="rounded border border-input bg-background px-2 py-1.5 text-[11px]" value={check.status} onChange={(event) => setCheck(key, { status: event.target.value as FastHugCheck["status"] })}>
                    <option value="pendente">Pendente</option>
                    <option value="adequado">Adequado</option>
                    <option value="reavaliar">Reavaliar</option>
                  </select>
                  <input className="rounded border border-input bg-background px-2 py-1.5 text-[11px]" value={check.note ?? ""} onChange={(event) => setCheck(key, { note: event.target.value })} placeholder="Observação" />
                </div>
              </section>
            );
          })}
        </div>
        <footer className="flex justify-end border-t border-border px-5 py-4"><button type="button" onClick={() => { onSave(checks); onClose(); }} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Salvar avaliação</button></footer>
      </section>
    </div>
  );
}

export function NursingWorkflow({ patient, onUpdatePatient }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState<NursingWorkflowActivity | null>(null);
  const [adding, setAdding] = useState(false);
  const [fastHugOpen, setFastHugOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const activities = useMemo(() => {
    const saved = patient.nursingWorkflow?.activities ?? [];
    const base = defaultActivities(patient);
    const merged = base.map((activity) => ({ ...activity, ...(saved.find((item) => item.id === activity.id) ?? {}) })).filter((activity) => !activity.hidden);
    const custom = saved.filter((activity) => !base.some((item) => item.id === activity.id) && !activity.hidden);
    return [...merged, ...custom].sort((a, b) => timelinePercent(a.time) - timelinePercent(b.time));
  }, [patient]);

  const saveActivity = (activity: NursingWorkflowActivity) => {
    const current = patient.nursingWorkflow?.activities ?? [];
    const next = current.some((item) => item.id === activity.id)
      ? current.map((item) => item.id === activity.id ? activity : item)
      : [...current, activity];
    onUpdatePatient({ ...patient, nursingWorkflow: { ...patient.nursingWorkflow, activities: next } });
  };

  const deleteActivity = (activity: NursingWorkflowActivity) => {
    if (activity.source === "fasthug") return;
    const current = patient.nursingWorkflow?.activities ?? [];
    const next = activity.source === "custom"
      ? current.filter((item) => item.id !== activity.id)
      : current.some((item) => item.id === activity.id)
        ? current.map((item) => item.id === activity.id ? { ...item, hidden: true } : item)
        : [...current, { ...activity, hidden: true }];
    onUpdatePatient({ ...patient, nursingWorkflow: { ...patient.nursingWorkflow, activities: next } });
    setEditing(null);
  };

  const newActivity: NursingWorkflowActivity = {
    id: "custom-" + Date.now(),
    label: "",
    time: "12:00",
    type: "care",
    source: "custom",
  };

  return (
    <section className="w-4/5 bg-surface/55 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>07:00</span><span>11:00</span><span>15:00</span><span>19:00</span><span>23:00</span><span>03:00</span><span>07:00</span>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20"><Plus className="h-3 w-3" />Atividade</button>
      </div>
      <div className="ios-inset relative min-h-[112px] overflow-hidden p-2">
        <div className="absolute bottom-2 top-2 z-20 w-px bg-clinical-critical" style={{ left: `calc(${currentPercent(now)}% - 1px)` }} title="Horário atual">
          <span className="absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-clinical-critical" />
        </div>
        {activities.map((activity, index) => {
          const meta = workflowMeta[activity.type];
          const top = index % 2 === 0 ? 10 : 58;
          const left = timelinePercent(activity.time);
          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => activity.source === "fasthug" ? setFastHugOpen(true) : setEditing(activity)}
              className={`absolute z-10 min-w-0 rounded-md border px-2 py-1.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${meta.className} ${activity.completed ? "opacity-55" : ""} ${activity.important ? "alert-outline" : ""}`}
              style={{ left: `calc(${left}% + 3px)`, top, width: "22%" }}
              title={activity.note || activity.label}
            >
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold uppercase opacity-75">{activity.time}</span>
                {activity.important && <AlertTriangle className="h-3 w-3 text-clinical-critical" />}
                {activity.completed && <CheckCircle2 className="h-3 w-3 text-clinical-stable" />}
              </div>
              <div className={`truncate text-[10px] font-bold ${activity.completed ? "line-through" : ""}`}>{activity.label}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-px bg-clinical-critical" />Linha vermelha: horário atual. Clique em uma atividade para registrar conclusão, prioridade ou observações.</p>

      {editing && <TaskDialog activity={editing} isNew={false} onClose={() => setEditing(null)} onSave={(activity) => { saveActivity(activity); setEditing(null); }} onDelete={editing.source === "fasthug" ? undefined : () => deleteActivity(editing)} />}
      {adding && <TaskDialog activity={newActivity} isNew onClose={() => setAdding(false)} onSave={(activity) => { saveActivity({ ...activity, source: "custom" }); setAdding(false); }} />}
      {fastHugOpen && <FastHugDialog patient={patient} onClose={() => setFastHugOpen(false)} onSave={(checks) => onUpdatePatient({ ...patient, nursingWorkflow: { ...patient.nursingWorkflow, fastHug: { date: new Date().toISOString(), checks } } })} />}
    </section>
  );
}
