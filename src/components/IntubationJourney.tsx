import { useEffect, useMemo, useRef, useState } from "react";
import type { Patient, IntubationRecord, IntubationMode } from "@/data/patients";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  X, Minus, Save, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Pill, Wind, Stethoscope, ClipboardList,
  Activity, Syringe, Timer, Zap, PlayCircle, PauseCircle, Plus, Trash2,
} from "lucide-react";

// ============================================================================
// Doses de referência (mg/kg) + concentrações padrão (mg/mL)
// ============================================================================

type DrugDef = {
  name: string;
  group: "Sedativo" | "Analgesia" | "BNM";
  dosePerKg: number;
  minDose?: number;
  maxDose?: number;
  concMgMl: number;
  ampMg?: number;
  contra?: string[];
  effects?: string[];
  alt?: string;
  highlightIf?: (ctx: { hypotension?: boolean; contraSux?: boolean }) => boolean;
};

const DRUGS: DrugDef[] = [
  { name: "Etomidato", group: "Sedativo", dosePerKg: 0.3, concMgMl: 2, ampMg: 20,
    contra: ["Insuf. adrenal grave"], effects: ["Mioclonias", "Supressão adrenal"], alt: "Cetamina",
    highlightIf: (c) => !!c.hypotension },
  { name: "Cetamina", group: "Sedativo", dosePerKg: 1.5, concMgMl: 50, ampMg: 500,
    contra: ["HIC descompensada (relativa)"], effects: ["Taquicardia", "Sialorréia"], alt: "Etomidato",
    highlightIf: (c) => !!c.hypotension },
  { name: "Propofol", group: "Sedativo", dosePerKg: 1.5, concMgMl: 10, ampMg: 200,
    contra: ["Hipotensão", "Choque"], effects: ["Hipotensão", "Depressão miocárdica"], alt: "Etomidato" },
  { name: "Midazolam", group: "Sedativo", dosePerKg: 0.2, concMgMl: 5, ampMg: 15,
    contra: ["Hipotensão grave"], effects: ["Hipotensão", "Depressão respiratória"], alt: "Etomidato" },
  { name: "Fentanil", group: "Analgesia", dosePerKg: 0.003, concMgMl: 0.05, ampMg: 0.25,
    effects: ["Rigidez torácica", "Bradicardia"], alt: "Remifentanil" },
  { name: "Remifentanil", group: "Analgesia", dosePerKg: 0.001, concMgMl: 0.05,
    effects: ["Bradicardia", "Hipotensão"], alt: "Fentanil" },
  { name: "Succinilcolina", group: "BNM", dosePerKg: 1.5, concMgMl: 20, ampMg: 100,
    contra: ["Hipercalemia", "Queimadura >24h", "Rabdomiólise", "Doença neuromuscular"],
    effects: ["Hipercalemia", "Bradicardia", "Hipertermia maligna"], alt: "Rocurônio",
    highlightIf: (c) => !!c.contraSux },
  { name: "Rocurônio", group: "BNM", dosePerKg: 1.2, concMgMl: 10, ampMg: 50,
    effects: ["BNM prolongado (~45 min)"], alt: "Succinilcolina",
    highlightIf: (c) => !!c.contraSux },
];

const EQUIPMENT = [
 "Monitor multiparamétrico", "Capnógrafo", "Fonte de oxigênio", "Aspirador funcionando",
 "Bolsa-válvula-máscara (Ambu)", "Videolaringoscópio", "Laringoscópio", "Bougie",
 "Guia metálico", "Tubos orotraqueais", "Seringa para cuff", "Material para cricotireoidostomia",
];

const TEAM_ROLES = ["Intubador", "Auxiliar", "Responsável pelas drogas", "Responsável pela ventilação"];

const PHYSIO_CONDITIONS = [
 "Choque", "Hipovolemia", "Hipercalemia", "Acidose", "HIC",
 "Insuf. cardíaca", "Asma", "DPOC", "Obesidade", "Gestação",
];

const PREOX_METHODS = [
 "Máscara com reservatório", "Cateter nasal", "Cânula nasal alto fluxo",
 "CPAP", "VNI", "BVM",
];

const CONFIRM_ITEMS = [
 "Capnografia (ETCO₂)", "Expansão torácica", "Ausculta bilateral",
 "SpO₂ estável", "Condensação no tubo", "Radiografia", "Ultrassom pulmonar",
];

const COMPLICATIONS = [
 "Hipotensão", "Hipoxemia", "PCR", "Broncoespasmo",
 "Intubação seletiva", "Intubação esofágica", "Pneumotórax", "Via aérea impossível",
];

const CORMACK: ("I"|"II"|"III"|"IV")[] = ["I","II","III","IV"];

// Recomendações por condição
const CONDITION_ADVICE: Record<string,string> = {
 "Choque": "Priorizar Cetamina/Etomidato. Otimizar volume/vasopressor ANTES.",
 "Hipovolemia": "Cristalóide 500 mL antes se possível. Evitar Propofol/Midazolam.",
 "Hipercalemia": "Contraindicação absoluta para Succinilcolina. Usar Rocurônio.",
 "Acidose": "Manter FR/VC próximos do basal pós-intubação. Evitar apneia prolongada.",
 "HIC": "Fentanil pré-indução. Evitar hipotensão/hipóxia. Cabeceira a 30°.",
 "Insuf. cardíaca": "Cetamina com cautela. Etomidato preferencial.",
 "Asma": "Cetamina (broncodilatador). Evitar Morfina. Considerar salbutamol.",
 "DPOC": "Pré-oxigenar com VNI. Cetamina útil.",
 "Obesidade": "Rampa/HELP position. Pré-oxigenar 5 min. Dose por peso ideal (BNM: peso real).",
 "Gestação": "Cabeceira elevada. Pressão cricóide. Tubo menor.",
};

// ============================================================================
// Helpers
// ============================================================================

const round = (n: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

const fmt = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? "—" : String(round(n, 2)));

function calcDose(drug: DrugDef, weight: number) {
  if (!weight || weight <= 0) return { mg: undefined, mL: undefined, amp: undefined };
  const mg = drug.dosePerKg * weight;
  const mL = mg / drug.concMgMl;
  const amp = drug.ampMg ? mg / drug.ampMg : undefined;
  return { mg, mL, amp };
}

// ============================================================================
// Storage helper (rascunhos por paciente)
// ============================================================================

const DRAFT_KEY = (patientId: string, id: string) => `passometro:intub:${patientId}:${id}`;

// ============================================================================
// Component
// ============================================================================

const MODE_META: Record<IntubationMode, { icon: string; label: string; color: string; sub: string }> = {
  ISR:          { icon: "", label: "Sequência Rápida (ISR)", color: "border-clinical-critical/40 bg-clinical-critical/10 text-clinical-critical", sub: "Pré-oxig → Sedação → BNM → Intubação" },
  DSI:          { icon: "", label: "Sequência Retardada (DSI)", color: "border-clinical-attention/40 bg-clinical-attention/10 text-clinical-attention", sub: "Sedação → Pré-oxig → BNM → Intubação" },
  Convencional: { icon: "", label: "Convencional", color: "border-clinical-resp/40 bg-clinical-resp/10 text-clinical-resp", sub: "Sedação titulada + analgesia" },
};

const STEP_TITLES = [
 "Tipo & Paciente",
 "1 · Preparação",
 "2 · Avaliação fisiológica",
 "3 · Pré-oxigenação",
 "4 · Medicações",
 "5 · Procedimento",
 "6 · Confirmação",
 "7 · Pós-intubação",
 "8 · Complicações",
];

export function IntubationJourney({
  open, onClose, patient, onSave,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSave: (p: Patient) => void;
}) {
  const existing = (patient.intubations ?? []).find((r) => r.status === "em_andamento");

  const [record, setRecord] = useState<IntubationRecord>(() => existing ?? {
    id: `intub_${Date.now()}`,
    createdAt: new Date().toISOString(),
    mode: "ISR",
    status: "em_andamento",
    currentStep: 0,
    weightKg: patient.weight,
    heightCm: patient.height,
    sex: patient.sex,
    age: patient.age,
  });

  const [step, setStep] = useState<number>(record.currentStep ?? 0);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset when reopening for a different patient
    setRecord((r) => ({ ...r, weightKg: r.weightKg ?? patient.weight, heightCm: r.heightCm ?? patient.height, sex: r.sex ?? patient.sex, age: r.age ?? patient.age }));
  }, [open, patient.id]);

  const update = <K extends keyof IntubationRecord>(k: K, v: IntubationRecord[K]) => setRecord((r) => ({ ...r, [k]: v, updatedAt: new Date().toISOString() }));

  const progress = useMemo(() => Math.round(((step + 1) / STEP_TITLES.length) * 100), [step]);

  const weight = record.weightKg ?? 0;
  const hypotension = (record.physio?.pas ?? 999) < 90;
  const contraSux = (record.physio?.conditions ?? []).includes("Hipercalemia");

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY(patient.id, record.id), JSON.stringify(record));
    } catch { /* ignore */ }
    // Persist to patient.intubations
    const list = (patient.intubations ?? []).filter((r) => r.id !== record.id);
    onSave({ ...patient, intubations: [...list, { ...record, currentStep: step, progress }] });
  };

  const finalize = (status: "concluida" | "cancelada") => {
    const list = (patient.intubations ?? []).filter((r) => r.id !== record.id);
    const finalRec = { ...record, status, currentStep: step, progress, updatedAt: new Date().toISOString() };
    onSave({ ...patient, intubations: [...list, finalRec] });
    onClose();
  };

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    stepRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  if (minimized) {
    return (
 <div className="fixed bottom-4 right-4 z-[60] w-64 rounded-lg border-2 border-clinical-critical/60 bg-surface-2 p-3 shadow-2xl">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <Zap className="h-4 w-4 text-clinical-critical" />
 <span className="text-[11px] font-bold uppercase tracking-wider">Intubação</span>
 </div>
 <div className="flex gap-1">
 <button onClick={() => setMinimized(false)} className="rounded p-1 hover:bg-surface-3" title="Restaurar">
 <ChevronDown className="h-3 w-3 rotate-180" />
 </button>
 <button onClick={onClose} className="rounded p-1 hover:bg-surface-3" title="Fechar">
 <X className="h-3 w-3" />
 </button>
 </div>
 </div>
 <div className="mt-2 text-[10px] text-muted-foreground">{STEP_TITLES[step]}</div>
 <div className="mt-1 h-1 rounded-full bg-surface-3">
 <div className="h-1 rounded-full bg-clinical-critical" style={{ width: `${progress}%` }} />
 </div>
 </div> );
  }

  return (
 <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
 <DialogContent
        className="max-h-[90vh] w-[95vw] max-w-4xl overflow-hidden p-0 gap-0"
        style={{ height: "88vh" }}
      > {/* Sticky header */}
 <div className="sticky top-0 z-10 border-b-2 border-border-strong bg-surface-2 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div className="flex min-w-0 items-center gap-2">
 <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-clinical-critical/10 text-clinical-critical">
 <Zap className="h-4 w-4" />
 </div>
 <div className="min-w-0">
 <div className="truncate text-[13px] font-bold">Jornada da Intubação Orotraqueal</div>
 <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground"> {patient.name} · {patient.bed} · {STEP_TITLES[step]}
 </div>
 </div>
 </div>
 <div className="flex shrink-0 items-center gap-1">
 <button onClick={saveDraft} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold hover:bg-surface-3" title="Salvar e continuar depois">
 <Save className="h-3 w-3" /> Salvar
 </button>
 <button onClick={() => setMinimized(true)} className="rounded p-1.5 hover:bg-surface-3" title="Minimizar">
 <Minus className="h-3.5 w-3.5" />
 </button>
 <button onClick={onClose} className="rounded p-1.5 hover:bg-surface-3" title="Fechar">
 <X className="h-3.5 w-3.5" />
 </button>
 </div>
 </div>
 <div className="mt-2 flex items-center gap-2">
 <div className="h-1.5 flex-1 rounded-full bg-surface-3">
 <div className="h-1.5 rounded-full bg-clinical-critical transition-all" style={{ width: `${progress}%` }} />
 </div>
 <span className="font-mono text-[10px] font-semibold text-muted-foreground">{progress}%</span>
 </div>
 </div> {/* Body */}
 <div className="flex-1 overflow-y-auto px-4 py-4"> {/* Steps as stacked cards */}
 <div className="space-y-2"> {STEP_TITLES.map((title, i) => {
              const active = i === step;
              const done = i < step;
              return (
 <div
                  key={i}
                  ref={(el) => { stepRefs.current[i] = el; }}
                  className={`rounded-lg border-2 transition-all ${
                    active ? "border-clinical-critical/60 bg-surface" :
                    done ? "border-clinical-stable/40 bg-clinical-stable/5" :
 "border-border bg-surface-2/40"
                  }`}
                >
 <button
                    type="button"
                    onClick={() => setStep(i)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
 <div className="flex items-center gap-2"> {done ? <CheckCircle2 className="h-4 w-4 text-clinical-stable" /> :
                       active ? <PlayCircle className="h-4 w-4 text-clinical-critical" /> :
 <ChevronRight className="h-4 w-4 text-muted-foreground" />}
 <span className={`text-[12px] font-bold ${active ? "text-foreground" : done ? "text-clinical-stable" : "text-muted-foreground"}`}>{title}</span>
 </div>
 <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${active ? "rotate-180" : ""}`} />
 </button> {active && (
 <div className="border-t border-border px-3 py-3">
 <StepBody
                        step={i}
                        record={record}
                        weight={weight}
                        hypotension={hypotension}
                        contraSux={contraSux}
                        update={update}
                      />
 <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
 <button
                          onClick={() => setStep(Math.max(0, i - 1))}
                          disabled={i === 0}
                          className="rounded-md border border-border bg-surface px-3 py-1 text-[11px] font-semibold hover:bg-surface-3 disabled:opacity-40"
                        > ← Voltar
 </button> {i < STEP_TITLES.length - 1 ? (
 <button
                            onClick={() => setStep(i + 1)}
                            className="rounded-md bg-clinical-critical px-3 py-1 text-[11px] font-semibold text-white hover:bg-clinical-critical/90"
                          > Avançar →
 </button> ) : (
 <div className="flex gap-2">
 <button
                              onClick={() => finalize("cancelada")}
                              className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 px-3 py-1 text-[11px] font-semibold text-clinical-attention hover:bg-clinical-attention/20"
                            > Cancelar registro
 </button>
 <button
                              onClick={() => finalize("concluida")}
                              className="rounded-md bg-clinical-stable px-3 py-1 text-[11px] font-semibold text-white hover:bg-clinical-stable/90"
                            > Concluir jornada ✓
 </button>
 </div> )}
 </div>
 </div> )}
 </div> );
            })}
 </div>
 </div>
 </DialogContent>
 </Dialog> );
}

// ============================================================================
// Step bodies
// ============================================================================

function StepBody({
  step, record, weight, hypotension, contraSux, update,
}: {
  step: number;
  record: IntubationRecord;
  weight: number;
  hypotension: boolean;
  contraSux: boolean;
  update: <K extends keyof IntubationRecord>(k: K, v: IntubationRecord[K]) => void;
}) {
  switch (step) {
    case 0: return <StepInitial record={record} update={update} />;
    case 1: return <StepPreparation record={record} update={update} />;
    case 2: return <StepPhysio record={record} update={update} />;
    case 3: return <StepPreox record={record} update={update} />;
    case 4: return <StepDrugs record={record} weight={weight} hypotension={hypotension} contraSux={contraSux} update={update} />;
    case 5: return <StepProcedure record={record} update={update} />;
    case 6: return <StepConfirm record={record} update={update} />;
    case 7: return <StepPostVent record={record} update={update} />;
    case 8: return <StepComplications record={record} update={update} />;
    default: return null;
  }
}

// ---------- Step 0 — tipo + paciente ----------
function StepInitial({ record, update }: { record: IntubationRecord; update: any }) {
  return (
 <div className="space-y-3">
 <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de intubação</div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"> {(Object.keys(MODE_META) as IntubationMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = record.mode === m;
          return (
 <button
              key={m}
              onClick={() => update("mode", m)}
              className={`rounded-lg border-2 p-3 text-left transition-all ${active ? meta.color + " ring-2 ring-offset-1 ring-offset-background" : "border-border bg-surface hover:bg-surface-3"}`}
            >
 <div className="text-lg">{meta.icon}</div>
 <div className="text-[12px] font-bold">{meta.label}</div>
 <div className="text-[10px] text-muted-foreground">{meta.sub}</div>
 </button> );
        })}
 </div>

 <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dados do paciente</div>
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <NumField label="Peso (kg)" value={record.weightKg} onChange={(v) => update("weightKg", v)} step={0.5} />
 <NumField label="Altura (cm)" value={record.heightCm} onChange={(v) => update("heightCm", v)} />
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sexo</label>
 <select value={record.sex ?? ""} onChange={(e) => update("sex", e.target.value as "M"|"F")} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]">
 <option value="">—</option><option value="M">M</option><option value="F">F</option>
 </select>
 </div>
 <NumField label="Idade" value={record.age} onChange={(v) => update("age", v)} />
 </div> {record.weightKg ? (
 <div className="rounded-md border border-clinical-stable/40 bg-clinical-stable/10 px-3 py-2 text-[11px] font-semibold text-clinical-stable"> ✓ Peso {record.weightKg} kg registrado. Doses recalculadas automaticamente na etapa 4.
 </div> ) : (
 <div className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 px-3 py-2 text-[11px] font-semibold text-clinical-attention flex items-center gap-1">
 <AlertTriangle className="h-3 w-3" /> Informe o peso para habilitar o cálculo automático de doses.
 </div> )}
 </div> );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value?: number; onChange: (v: number|undefined) => void; step?: number }) {
  return (
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
 <input
        type="number" inputMode="decimal" step={step}
        value={value ?? ""}
        onChange={(e) => { const v = e.target.value; onChange(v === "" ? undefined : Number(v)); }}
        className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px] font-mono"
      />
 </div> );
}

// ---------- Step 1 — preparação ----------
function StepPreparation({ record, update }: { record: IntubationRecord; update: any }) {
  const eq = record.equipment ?? {};
  const tm = record.team ?? {};
  const toggle = (k: string) => update("equipment", { ...eq, [k]: !eq[k] });
  return (
 <div className="space-y-3">
 <div>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Equipamentos</div>
 <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"> {EQUIPMENT.map((e) => (
 <label key={e} className={`flex cursor-pointer items-center gap-2 rounded border-2 px-2 py-1.5 text-[11px] ${eq[e] ? "border-clinical-stable/40 bg-clinical-stable/10" : "border-border bg-surface"}`}>
 <input type="checkbox" checked={!!eq[e]} onChange={() => toggle(e)} className="h-4 w-4" />
 <span className={eq[e] ? "font-semibold text-clinical-stable" : ""}>{e}</span>
 </label> ))}
 </div>
 </div>
 <div>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Equipe</div>
 <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"> {TEAM_ROLES.map((r) => (
 <div key={r}>
 <label className="block text-[10px] font-semibold text-muted-foreground">{r}</label>
 <input value={tm[r] ?? ""} onChange={(e) => update("team", { ...tm, [r]: e.target.value })}
                className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" placeholder="Nome" />
 </div> ))}
 </div>
 </div>
 </div> );
}

// ---------- Step 2 — fisiologia ----------
function StepPhysio({ record, update }: { record: IntubationRecord; update: any }) {
  const p = record.physio ?? {};
  const setP = (patch: any) => update("physio", { ...p, ...patch });
  const conds = p.conditions ?? [];
  const toggleCond = (c: string) => setP({ conditions: conds.includes(c) ? conds.filter((x: string) => x !== c) : [...conds, c] });
  const advice = conds.map((c) => CONDITION_ADVICE[c]).filter(Boolean);
  return (
 <div className="space-y-3">
 <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
 <NumField label="PAS" value={p.pas} onChange={(v) => setP({ pas: v })} />
 <NumField label="PAD" value={p.pad} onChange={(v) => setP({ pad: v })} />
 <NumField label="FC" value={p.fc} onChange={(v) => setP({ fc: v })} />
 <NumField label="FR" value={p.fr} onChange={(v) => setP({ fr: v })} />
 <NumField label="SpO₂ %" value={p.spo2} onChange={(v) => setP({ spo2: v })} />
 <NumField label="Temp °C" value={p.temp} onChange={(v) => setP({ temp: v })} step={0.1} />
 <NumField label="Glasgow" value={p.glasgow} onChange={(v) => setP({ glasgow: v })} />
 </div>
 <div>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Condições associadas</div>
 <div className="flex flex-wrap gap-1.5"> {PHYSIO_CONDITIONS.map((c) => {
            const active = conds.includes(c);
            return (
 <button key={c} onClick={() => toggleCond(c)}
                className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold ${active ? "border-clinical-attention bg-clinical-attention/15 text-clinical-attention" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}> {c}
 </button> );
          })}
 </div>
 </div> {advice.length > 0 && (
 <div className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 p-2 text-[11px]">
 <div className="mb-1 font-bold text-clinical-attention"> Recomendações</div>
 <ul className="list-disc space-y-0.5 pl-4"> {advice.map((a, i) => <li key={i}>{a}</li>)}
 </ul>
 </div> )}
 </div> );
}

// ---------- Step 3 — pré-oxigenação ----------
function StepPreox({ record, update }: { record: IntubationRecord; update: any }) {
  const [remaining, setRemaining] = useState<number>(record.preoxSeconds ?? 180);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (remaining === 0) setRunning(false); }, [remaining]);
  const mm = String(Math.floor(remaining/60)).padStart(2,"0");
  const ss = String(remaining%60).padStart(2,"0");

  return (
 <div className="space-y-3">
 <div>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Método</div>
 <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"> {PREOX_METHODS.map((m) => (
 <button key={m} onClick={() => update("preoxMethod", m)}
              className={`rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold ${record.preoxMethod === m ? "border-clinical-resp bg-clinical-resp/10 text-clinical-resp" : "border-border bg-surface hover:bg-surface-3"}`}> {m}
 </button> ))}
 </div>
 </div>
 <div className="rounded-md border-2 border-clinical-resp/30 bg-clinical-resp/5 p-3 text-center">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cronômetro (3 min)</div>
 <div className="font-mono text-4xl font-bold text-clinical-resp">{mm}:{ss}</div>
 <div className="mt-2 flex justify-center gap-2">
 <button onClick={() => setRunning(!running)} className="inline-flex items-center gap-1 rounded-md bg-clinical-resp px-3 py-1 text-[11px] font-semibold text-white"> {running ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
            {running ? "Pausar" : "Iniciar"}
 </button>
 <button onClick={() => { setRemaining(180); setRunning(false); update("preoxSeconds", 180); }} className="rounded-md border border-border px-3 py-1 text-[11px] font-semibold hover:bg-surface-3"> Reiniciar
 </button>
 </div>
 </div> {record.mode === "DSI" && (
 <div className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 p-2 text-[11px] font-semibold text-clinical-attention"> DSI: administrar sedativo (Cetamina 1 mg/kg) para tolerar a pré-oxigenação antes do BNM.
 </div> )}
 </div> );
}

// ---------- Step 4 — medicações ----------
function StepDrugs({ record, weight, hypotension, contraSux, update }: { record: IntubationRecord; weight: number; hypotension: boolean; contraSux: boolean; update: any }) {
  const admin = record.drugs ?? [];
  const isAdmin = (name: string) => admin.some((a) => a.name === name);
  const toggleAdmin = (name: string, mg?: number, mL?: number) => {
    if (isAdmin(name)) update("drugs", admin.filter((a) => a.name !== name));
    else update("drugs", [...admin, { name, doseMg: mg, volumeMl: mL }]);
  };
  const groups: DrugDef["group"][] = ["Sedativo", "Analgesia", "BNM"];
  return (
 <div className="space-y-3"> {!weight && (
 <div className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 p-2 text-[11px] font-semibold text-clinical-critical flex items-center gap-1">
 <AlertTriangle className="h-3 w-3" /> Volte à etapa inicial e informe o peso para calcular doses.
 </div> )}
      {groups.map((g) => (
 <div key={g}>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"> {DRUGS.filter((d) => d.group === g).map((d) => {
              const { mg, mL, amp } = calcDose(d, weight);
              const highlighted = d.highlightIf?.({ hypotension, contraSux }) ?? false;
              const contraSuxNow = d.name === "Succinilcolina" && contraSux;
              const done = isAdmin(d.name);
              return (
 <div key={d.name}
                  className={`rounded-lg border-2 p-2 ${done ? "border-clinical-stable/50 bg-clinical-stable/5" : contraSuxNow ? "border-clinical-critical/60 bg-clinical-critical/5" : highlighted ? "border-clinical-attention/60 bg-clinical-attention/5" : "border-border bg-surface"}`}>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <Pill className="h-3.5 w-3.5 text-clinical-neuro" />
 <span className="text-[12px] font-bold">{d.name}</span> {highlighted && <span className="text-[9px] font-bold text-clinical-attention">★ INDICADO</span>}
                      {contraSuxNow && <span className="text-[9px] font-bold text-clinical-critical">✕ CONTRAINDICADO</span>}
 </div>
 <button onClick={() => toggleAdmin(d.name, mg, mL)}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${done ? "border-clinical-stable bg-clinical-stable/20 text-clinical-stable" : "border-border bg-surface-2 hover:bg-surface-3"}`}> {done ? "✓ Adm." : "+ Administrar"}
 </button>
 </div>
 <div className="mt-1.5 grid grid-cols-4 gap-1 rounded bg-surface-2/60 p-1.5 text-center font-mono text-[10px]">
 <div><div className="text-muted-foreground">mg/kg</div><div className="font-bold">{d.dosePerKg}</div></div>
 <div><div className="text-muted-foreground">mg</div><div className="font-bold">{fmt(mg)}</div></div>
 <div><div className="text-muted-foreground">mL</div><div className="font-bold">{fmt(mL)}</div></div>
 <div><div className="text-muted-foreground">amp</div><div className="font-bold">{fmt(amp)}</div></div>
 </div>
 <div className="mt-1 text-[10px] text-muted-foreground">
 <span className="font-semibold">Conc:</span> {d.concMgMl} mg/mL{d.ampMg ? ` · Amp ${d.ampMg} mg` : ""}
 </div> {d.contra && d.contra.length > 0 && (
 <div className="text-[10px]"><span className="font-semibold text-clinical-critical">Contra:</span> {d.contra.join(", ")}</div> )}
                  {d.effects && d.effects.length > 0 && (
 <div className="text-[10px]"><span className="font-semibold text-clinical-attention">Adverso:</span> {d.effects.join(", ")}</div> )}
                  {d.alt && <div className="text-[10px]"><span className="font-semibold text-muted-foreground">Alt:</span> {d.alt}</div>}
 </div> );
            })}
 </div>
 </div> ))}
 </div> );
}

// ---------- Step 5 — procedimento ----------
function StepProcedure({ record, update }: { record: IntubationRecord; update: any }) {
  const p = record.procedure ?? {};
  const setP = (patch: any) => update("procedure", { ...p, ...patch });
  const cx = p.complications ?? [];
  const toggleCx = (c: string) => setP({ complications: cx.includes(c) ? cx.filter((x: string) => x !== c) : [...cx, c] });
  return (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <NumField label="Tentativa Nº" value={p.attempt} onChange={(v) => setP({ attempt: v })} />
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dispositivo</label>
 <select value={p.device ?? ""} onChange={(e) => setP({ device: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]">
 <option value="">—</option> {["Laringoscópio", "Videolaringoscópio", "Fibrobroncoscópio", "Máscara laríngea", "Cricotireoidostomia"].map((d) => <option key={d}>{d}</option>)}
 </select>
 </div>
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cormack-Lehane</label>
 <div className="flex gap-1"> {CORMACK.map((c) => (
 <button key={c} onClick={() => setP({ cormack: c })}
                className={`flex-1 rounded border-2 px-2 py-1 text-[11px] font-bold ${p.cormack === c ? "border-clinical-critical bg-clinical-critical/10 text-clinical-critical" : "border-border"}`}>{c}</button> ))}
 </div>
 </div>
 <NumField label="Laring. (s)" value={p.laryngoscopySec} onChange={(v) => setP({ laryngoscopySec: v })} />
 </div>
 <div className="flex flex-wrap gap-1.5"> {[{k: "burp", label: "BURP"}, {k: "bougie", label: "Bougie"}].map((x) => (
 <label key={x.k} className={`flex cursor-pointer items-center gap-1.5 rounded-md border-2 px-2 py-1 text-[11px] font-semibold ${(p as any)[x.k] ? "border-clinical-resp bg-clinical-resp/10 text-clinical-resp" : "border-border bg-surface"}`}>
 <input type="checkbox" checked={!!(p as any)[x.k]} onChange={(e) => setP({ [x.k]: e.target.checked })} /> {x.label}
 </label> ))}
 </div>
 <div>
 <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Complicações durante o procedimento</div>
 <div className="flex flex-wrap gap-1.5"> {COMPLICATIONS.map((c) => (
 <button key={c} onClick={() => toggleCx(c)}
              className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold ${cx.includes(c) ? "border-clinical-critical bg-clinical-critical/15 text-clinical-critical" : "border-border bg-surface text-muted-foreground"}`}> {c}
 </button> ))}
 </div>
 </div>
 </div> );
}

// ---------- Step 6 — confirmação ----------
function StepConfirm({ record, update }: { record: IntubationRecord; update: any }) {
  const cf = record.confirmation ?? {};
  const toggle = (k: string) => update("confirmation", { ...cf, [k]: !cf[k] });
  const positive = CONFIRM_ITEMS.filter((k) => cf[k]).length;
  const negative = positive === 0 && Object.keys(cf).length > 0;
  return (
 <div className="space-y-3">
 <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"> {CONFIRM_ITEMS.map((c) => (
 <label key={c} className={`flex cursor-pointer items-center gap-2 rounded border-2 px-2 py-1.5 text-[11px] ${cf[c] ? "border-clinical-stable/50 bg-clinical-stable/10 text-clinical-stable font-semibold" : "border-border bg-surface"}`}>
 <input type="checkbox" checked={!!cf[c]} onChange={() => toggle(c)} className="h-4 w-4" /> {c}
 </label> ))}
 </div> {positive >= 3 ? (
 <div className="rounded-md border-2 border-clinical-stable/50 bg-clinical-stable/10 p-2 text-[11px] font-bold text-clinical-stable"> ✅ Intubação confirmada ({positive} sinais positivos)
 </div> ) : negative ? (
 <div className="rounded-md border-2 border-clinical-critical/60 bg-clinical-critical/10 p-2 text-[11px] font-bold text-clinical-critical"> Confirmação NEGATIVA — abrir algoritmo de via aérea difícil imediatamente!
 </div> ) : (
 <div className="rounded-md border border-clinical-attention/40 bg-clinical-attention/5 p-2 text-[11px] text-clinical-attention"> Marque pelo menos 3 sinais para confirmar posicionamento.
 </div> )}
 </div> );
}

// ---------- Step 7 — pós-intubação ----------
function StepPostVent({ record, update }: { record: IntubationRecord; update: any }) {
  const v = record.postVent ?? {};
  const set = (patch: any) => update("postVent", { ...v, ...patch });
  return (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modo</label>
 <select value={v.mode ?? ""} onChange={(e) => set({ mode: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]">
 <option value="">—</option>{["VCV","PCV","PSV","VC-SIMV","APRV"].map((m) => <option key={m}>{m}</option>)}
 </select>
 </div>
 <NumField label="FiO₂ %" value={v.fio2} onChange={(x) => set({ fio2: x })} />
 <NumField label="PEEP" value={v.peep} onChange={(x) => set({ peep: x })} />
 <NumField label="FR" value={v.fr} onChange={(x) => set({ fr: x })} />
 <NumField label="VC (mL)" value={v.vt} onChange={(x) => set({ vt: x })} />
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">I:E</label>
 <input value={v.ie ?? ""} onChange={(e) => set({ ie: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" placeholder="1:2" />
 </div>
 <NumField label="Platô" value={v.plateau} onChange={(x) => set({ plateau: x })} />
 <NumField label="Driving P." value={v.drivingPressure} onChange={(x) => set({ drivingPressure: x })} />
 </div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
 <div><label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sedação contínua</label>
 <input value={v.sedation ?? ""} onChange={(e) => set({ sedation: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" placeholder="Ex: Propofol 20 mL/h" /></div>
 <div><label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Analgesia</label>
 <input value={v.analgesia ?? ""} onChange={(e) => set({ analgesia: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" placeholder="Ex: Fentanil 3 mL/h" /></div>
 <div><label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BNM</label>
 <input value={v.nmb ?? ""} onChange={(e) => set({ nmb: e.target.value })} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" placeholder="Ex: Cisatracúrio" /></div>
 </div>
 </div> );
}

// ---------- Step 8 — complicações ----------
function StepComplications({ record, update }: { record: IntubationRecord; update: any }) {
  const cx = record.complications ?? [];
  const toggle = (c: string) => update("complications", cx.includes(c) ? cx.filter((x) => x !== c) : [...cx, c]);
  return (
 <div className="space-y-3">
 <div className="text-[11px] text-muted-foreground">Marque qualquer complicação ocorrida durante ou após o procedimento para abrir o algoritmo correspondente.</div>
 <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"> {COMPLICATIONS.map((c) => {
          const on = cx.includes(c);
          return (
 <button key={c} onClick={() => toggle(c)}
              className={`flex items-center justify-between gap-2 rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold ${on ? "border-clinical-critical bg-clinical-critical/10 text-clinical-critical" : "border-border bg-surface"}`}>
 <span>{c}</span>{on && <AlertTriangle className="h-3.5 w-3.5" />}
 </button> );
        })}
 </div>
 <div>
 <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notas</label>
 <textarea value={record.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3} className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px]" />
 </div>
 </div> );
}
