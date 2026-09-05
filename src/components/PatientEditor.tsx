import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Calculator, Undo2, Redo2, CircleCheck, CirclePause, ChevronDown } from "lucide-react";
import { ANTIMICROBIAL_LIBRARY, findAntimicrobial, awareMeta } from "@/data/antimicrobials";
import { StewardshipPanel } from "@/components/StewardshipPanel";
import type {
  Patient,
  Severity,
  
  TimelineEvent,
  Medication,
  ExamRow,
  Conduct,
  Goal,
  InvasiveDevice,
  PatientOrigin,
  LPPLesion,
  DiluentSolution,
  PastMedication,
  Culture,
  AntibiogramEntry,
  AntibiogramResult,
  ImagingExam,
  ImagingModality,
  InfectionFocus,
  InfectionSite,
  InfectionStatus,
  ConductSystem,
  ConductSubItem,
  MedicationClass,
  ImagingImage,
  FluidEntry,
  DrainEntry,
  DerivationEntry,
  EegRecord,
  Hemotransfusion,
} from "@/data/patients";
import { SITE_META } from "@/lib/infection";
import {
  LABS, DRUGS, PROCEDURES,
  labByCode, drugByName, computeInfusion, classifyLab, bucketBadge,
  detectAntibiotic, antibioticDefaultDays, computeBMI, computeAge, computeCrCl,
  CONDUCT_SYSTEM_META, CONDUCT_SYSTEM_ORDER,
  MEDICATION_CLASS_META, MEDICATION_CLASS_ORDER, medClassOf,
  BRISTOL, computeFluidBalance,
  ANNOTATION_COLOR_META, ANNOTATION_COLOR_ORDER,
} from "@/lib/clinical";

import {
  CULTURE_SOURCES, ALL_ORGANISMS, ORGANISM_LIBRARY, ABX_PANEL,
  cultureResultBadge, detectCultureAlerts, abxResultBadge, sourceToFocus,
  COLLECTION_METHODS,
} from "@/lib/cultures";
import {
  DEVICE_CATEGORIES, DEVICE_TYPES, deviceTypesByCategory, deviceTypeByCode,
  type DeviceCategory,
} from "@/data/devices";
import { PressureInjuryMap } from "@/components/PressureInjuryMap";
import { DRUG_BANK, dilutionStore, mergedDrug, normalize, type DrugOverride } from "@/data/dilutions";


import { SerialMatrix } from "@/components/SerialMatrix";

type Props = {
  open: boolean;
  initial: Patient | null;
  initialTab?: string;
  onClose: () => void;
  onSave: (p: Patient) => void;
};

const emptyPatient = (): Patient => ({
  id: `p_${Date.now()}`,
  name: "",
  bed: "",
  age: 0,
  sex: "M",
  weight: 70,
  height: undefined,
  birthDate: undefined,
  origin: undefined,
  admissionHosp: "",
  admissionICU: "",
  daysHosp: 0,
  daysICU: 0,
  attending: "",
  team: "",
  severity: "stable",
  diagnoses: [],
  social: {},
  allergies: [],
  procedures: [],
  medications: [],
  exams: [],
  devices: [],
  conducts: [],
  goals: [],
  state: {
    glasgow: 15, rass: 0, pam: 80, dva: null,
    vent: "Ar ambiente", fio2: 21, diurese: 1, temp: 36.5, dieta: "VO",
  },
});

const inputCls =
 "w-full rounded-md border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-primary";
const lblCls =
 "block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1";

function L({ children }: { children: React.ReactNode }) {
  return <label className={lblCls}>{children}</label>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
 <section className="rounded-md border border-border p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground"> {title}
 </div> {children}
 </section> );
}

const todayShort = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const nowShort = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const nowISO = () => new Date().toISOString();
const isoToLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localInputToISO = (s: string) => (s ? new Date(s).toISOString() : "");

export function PatientEditor({ open, initial, initialTab, onClose, onSave }: Props) {
  const [p, setP] = useState<Patient>(initial ?? emptyPatient());
  const [allergiesTxt, setAllergiesTxt] = useState("");
  const [tab, setTab] = useState(initialTab ?? "id");

  const pRef = useRef<Patient>(p);
  const pastRef = useRef<Patient[]>([]);
  const futureRef = useRef<Patient[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const base = initial ?? emptyPatient();
    setP(base);
    pRef.current = base;
    pastRef.current = [];
    futureRef.current = [];
    setTick((t) => t + 1);
    setAllergiesTxt(base.allergies.join(", "));
    setTab(initialTab ?? "id");
  }, [initial, open, initialTab]);

  const commit = (next: Patient) => {
    pastRef.current = [...pastRef.current.slice(-99), pRef.current];
    futureRef.current = [];
    pRef.current = next;
    setP(next);
    setTick((t) => t + 1);
  };
  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current = [...futureRef.current, pRef.current];
    pRef.current = prev;
    setP(prev);
    setTick((t) => t + 1);
  };
  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current, pRef.current];
    pRef.current = next;
    setP(next);
    setTick((t) => t + 1);
  };

  const upd = <K extends keyof Patient>(k: K, v: Patient[K]) => commit({ ...pRef.current, [k]: v });
  const updState = <K extends keyof Patient["state"]>(k: K, v: Patient["state"][K]) => commit({ ...pRef.current, state: { ...pRef.current.state, [k]: v } });
  const updOrigin = (patch: Partial<PatientOrigin>) => commit({ ...pRef.current, origin: { ...(pRef.current.origin ?? { type: "Hospital" }), ...patch } });

  const bmi = computeBMI(p.weight, p.height);
  const computedAge = computeAge(p.birthDate);

  const save = () => {
    onSave({
      ...p,
      age: computedAge ?? p.age,
      allergies: allergiesTxt.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
 <Dialog open={open} onOpenChange={(o) => { if (!o) save(); }}>
 <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto bg-soft-blue-gradient">

 <DialogHeader>
 <DialogTitle>{initial ? "Editar paciente" : "Novo paciente · assistente"}</DialogTitle>
 </DialogHeader>

 <Tabs value={tab} onValueChange={setTab} className="w-full">
 <TabsList className="grid w-full grid-cols-9">
 <TabsTrigger value="id">1 · Identif.</TabsTrigger>
 <TabsTrigger value="hist">2 · História</TabsTrigger>
 <TabsTrigger value="proc">3 · Invasões</TabsTrigger>
 <TabsTrigger value="med">4 · Medicações</TabsTrigger>
 <TabsTrigger value="exam">5a · Imagem</TabsTrigger>
 <TabsTrigger value="cult">5b · Culturas</TabsTrigger>
 <TabsTrigger value="sup">6 · Estado atual</TabsTrigger>
 <TabsTrigger value="plan">7 · Plano</TabsTrigger>
 <TabsTrigger value="lpp">+ LPP</TabsTrigger>
 </TabsList> {/* 1 — Identificação */}
 <TabsContent value="id">
 <Section title="Identificação do paciente">
 <div className="grid grid-cols-4 gap-3">
 <div className="col-span-2">
 <L>Nome</L>
 <input className={inputCls} value={p.name} onChange={(e) => upd("name", e.target.value)} />
 </div>
 <div>
 <L>Leito</L>
 <input className={inputCls} value={p.bed} onChange={(e) => upd("bed", e.target.value)} />
 </div>
 <div>
 <L>Severidade</L>
 <select className={inputCls} value={p.severity}
                    onChange={(e) => upd("severity", e.target.value as Severity)}>
 <option value="stable">Estável</option>
 <option value="attention">Atenção</option>
 <option value="critical">Crítico</option>
 </select>
 </div>
 <div>
 <L>Data de nascimento</L>
 <input type="date" className={inputCls} value={p.birthDate ?? ""}
                    onChange={(e) => upd("birthDate", e.target.value || undefined)} />
 </div>
 <div>
 <L>Idade {computedAge !== null && <span className="text-clinical-stable">({computedAge}a calc.)</span>}</L>
 <input type="number" className={inputCls} value={computedAge ?? p.age}
                    onChange={(e) => upd("age", Number(e.target.value))} />
 </div>
 <div>
 <L>Sexo</L>
 <select className={inputCls} value={p.sex}
                    onChange={(e) => upd("sex", e.target.value as "M" | "F")}>
 <option value="M">M</option>
 <option value="F">F</option>
 </select>
 </div>
 <div>
 <L>Peso (kg)</L>
 <input type="number" className={inputCls} value={p.weight}
                    onChange={(e) => upd("weight", Number(e.target.value))} />
 </div>
 <div>
 <L>Altura (cm)</L>
 <input type="number" className={inputCls} value={p.height ?? ""}
                    onChange={(e) => upd("height", e.target.value ? Number(e.target.value) : undefined)} />
 </div>
 <div>
 <L>IMC (auto)</L>
 <div className={`${inputCls} ${bmi?.className ?? "text-muted-foreground"}`}> {bmi ? `${bmi.value} · ${bmi.label}` : "—"}
 </div>
 </div>
 <div>
 <L>Equipe</L>
 <input className={inputCls} value={p.team} onChange={(e) => upd("team", e.target.value)} />
 </div>
 <div>
 <L>Médico</L>
 <input className={inputCls} value={p.attending} onChange={(e) => upd("attending", e.target.value)} />
 </div>
 <div>
 <L>Adm Hospital</L>
 <input className={inputCls} value={p.admissionHosp}
                    onChange={(e) => upd("admissionHosp", e.target.value)} />
 </div>
 <div>
 <L>Adm UTI</L>
 <input className={inputCls} value={p.admissionICU}
                    onChange={(e) => upd("admissionICU", e.target.value)} />
 </div>
 <div>
 <L>Dias Hosp</L>
 <input type="number" className={inputCls} value={p.daysHosp}
                    onChange={(e) => upd("daysHosp", Number(e.target.value))} />
 </div>
 <div>
 <L>Dias UTI</L>
 <input type="number" className={inputCls} value={p.daysICU}
                    onChange={(e) => upd("daysICU", Number(e.target.value))} />
 </div>
 <div className="col-span-4">
 <L>Alergias (separadas por vírgula)</L>
 <input className={inputCls} value={allergiesTxt}
                    onChange={(e) => setAllergiesTxt(e.target.value)} />
 </div>
 </div>
 </Section>

 <div className="mt-3">
 <Section title="Representante legal & diretivas antecipadas">
 <div className="grid grid-cols-4 gap-3">
 <div className="col-span-2">
 <L>Representante legal</L>
 <input className={inputCls} value={p.legalRepresentative?.name ?? ""}
                      onChange={(e) => upd("legalRepresentative", { ...p.legalRepresentative, name: e.target.value || undefined })} />
 </div>
 <div>
 <L>Parentesco</L>
 <input className={inputCls} value={p.legalRepresentative?.relation ?? ""}
                      onChange={(e) => upd("legalRepresentative", { ...p.legalRepresentative, relation: e.target.value || undefined })}
                      placeholder="Cônjuge, filho(a)..." />
 </div>
 <div>
 <L>Contato</L>
 <input className={inputCls} value={p.legalRepresentative?.phone ?? ""}
                      onChange={(e) => upd("legalRepresentative", { ...p.legalRepresentative, phone: e.target.value || undefined })}
                      placeholder="(00) 00000-0000" />
 </div>

 <div className="col-span-2">
 <L>Representante legal 2</L>
 <input className={inputCls} value={p.legalRepresentative2?.name ?? ""}
                      onChange={(e) => upd("legalRepresentative2", { ...p.legalRepresentative2, name: e.target.value || undefined })} />
 </div>
 <div>
 <L>Parentesco 2</L>
 <input className={inputCls} value={p.legalRepresentative2?.relation ?? ""}
                      onChange={(e) => upd("legalRepresentative2", { ...p.legalRepresentative2, relation: e.target.value || undefined })}
                      placeholder="Cônjuge, filho(a)..." />
 </div>
 <div>
 <L>Contato 2</L>
 <input className={inputCls} value={p.legalRepresentative2?.phone ?? ""}
                      onChange={(e) => upd("legalRepresentative2", { ...p.legalRepresentative2, phone: e.target.value || undefined })}
                      placeholder="(00) 00000-0000" />
 </div>

 <div>
 <L>Diretriz — Entubar</L>
 <select className={inputCls} value={p.advanceDirective?.intubation ?? "unknown"}
                      onChange={(e) => upd("advanceDirective", { ...p.advanceDirective, intubation: e.target.value as "allow" | "refuse" | "unknown" })}>
 <option value="unknown">Não informado</option>
 <option value="allow">Autoriza entubação</option>
 <option value="refuse">Não entubar</option>
 </select>
 </div>
 <div>
 <L>Diretriz — Reanimar</L>
 <select className={inputCls} value={p.advanceDirective?.resuscitation ?? "unknown"}
                      onChange={(e) => upd("advanceDirective", { ...p.advanceDirective, resuscitation: e.target.value as "allow" | "refuse" | "unknown" })}>
 <option value="unknown">Não informado</option>
 <option value="allow">Autoriza RCP</option>
 <option value="refuse">Não reanimar (DNR)</option>
 </select>
 </div>
 <div>
 <L>Doação de órgãos</L>
 <select className={inputCls} value={p.organDonation ?? "unknown"}
                      onChange={(e) => upd("organDonation", e.target.value as "yes" | "no" | "family" | "unknown")}>
 <option value="unknown">Não informado</option>
 <option value="yes">Doador</option>
 <option value="no">Não doador</option>
 <option value="family">A decidir com a família</option>
 </select>
 </div>
 <div className="col-span-4">
 <L>Observações das diretivas</L>
 <input className={inputCls} value={p.advanceDirective?.notes ?? ""}
                      onChange={(e) => upd("advanceDirective", { ...p.advanceDirective, notes: e.target.value || undefined })}
                      placeholder="Ex.: DAV registrada em cartório, sem QT paliativa..." />
 </div>
 </div>
 </Section>
 </div>

 <div className="mt-3">
 <Section title="Origem do paciente">
 <div className="grid grid-cols-4 gap-3">
 <div>
 <L>Tipo de origem</L>
 <select className={inputCls}
                      value={p.origin?.type ?? "Hospital"}
                      onChange={(e) => updOrigin({ type: e.target.value as PatientOrigin["type"] })}> {(["Hospital", "UPA", "Enfermaria", "Centro Cirúrgico", "Pronto-Socorro", "Domicílio", "Outro"] as const)
                        .map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div>
 <L>Nome da unidade</L>
 <input className={inputCls} value={p.origin?.name ?? ""}
                      onChange={(e) => updOrigin({ name: e.target.value || undefined })}
                      placeholder="Hospital São José" />
 </div>
 <div>
 <L>Unidade interna</L>
 <input className={inputCls} value={p.origin?.unit ?? ""}
                      onChange={(e) => updOrigin({ unit: e.target.value || undefined })}
                      placeholder="Ala B / Sala 2" />
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <L>Cidade</L>
 <input className={inputCls} value={p.origin?.city ?? ""}
                        onChange={(e) => updOrigin({ city: e.target.value || undefined })} />
 </div>
 <div>
 <L>UF</L>
 <input className={inputCls} value={p.origin?.state ?? ""} maxLength={2}
                        onChange={(e) => updOrigin({ state: e.target.value.toUpperCase() || undefined })} />
 </div>
 </div>
 </div>
 </Section>
 </div>
 </TabsContent> {/* 2 — História */}
 <TabsContent value="hist">
 <Section title="Diagnósticos / antecedentes">
 <DiagnosesList items={p.diagnoses} onChange={(v) => upd("diagnoses", v)} />
 </Section>
 <div className="mt-3">
 <Section title="Social / funcional">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <L>Tabagismo</L>
 <input className={inputCls} value={p.social.tabagismo ?? ""}
                      onChange={(e) => upd("social", { ...p.social, tabagismo: e.target.value || undefined })} />
 </div>
 <div>
 <L>Etilismo</L>
 <input className={inputCls} value={p.social.etilismo ?? ""}
                      onChange={(e) => upd("social", { ...p.social, etilismo: e.target.value || undefined })} />
 </div>
 <div>
 <L>Ocupação</L>
 <input className={inputCls} value={p.social.ocupacao ?? ""}
                      onChange={(e) => upd("social", { ...p.social, ocupacao: e.target.value || undefined })} />
 </div>
 <div>
 <L>Funcional prévio</L>
 <input className={inputCls} value={p.social.dependencia ?? ""}
                      onChange={(e) => upd("social", { ...p.social, dependencia: e.target.value || undefined })} />
 </div>
 </div>
 </Section>
 </div>
 <div className="mt-3">
 <Section title="Histórico medicamentoso (uso prévio / domiciliar)">
 <PastMedicationsList
                  items={p.pastMedications ?? []}
                  onChange={(v) => upd("pastMedications", v)}
                />
 </Section>
 </div>
 </TabsContent> {/* 3 — Procedimentos e Dispositivos */}
 <TabsContent value="proc">
 <Section title="Dispositivos invasivos">
 <DevicesList items={p.devices ?? []} onChange={(v) => upd("devices", v)} />
 </Section>
 <div className="mt-3">
 <Section title="Procedimentos / eventos">
 <ProceduresList items={p.procedures} onChange={(v) => upd("procedures", v)} />
 </Section>
 </div>
 </TabsContent> {/* 4 — Suporte / Assistente inteligente */}
 <TabsContent value="sup">
 <Section title="Preenchimento seriado (itens em linhas · datas em colunas)">
 <SerialMatrix
                patient={p}
                onChangeState={(k, v) => updState(k, v as never)}
                onChangeExams={(v) => upd("exams", v)}
              />
 </Section>



 <div className="mt-3">
 <Section title="Balanço hídrico (entradas · saídas · drenos · derivações)">
 <FluidBalanceEditor
                  value={p.state.fluidBalance}
                  onChange={(v) => updState("fluidBalance", v)}
                />
 </Section>
 </div>
 </TabsContent> {/* 5 — Medicações */}
 <TabsContent value="med">
 <Section title="Medicações em uso"> {(() => {
                const crcl = computeCrCl(p);
                return (
 <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"> {crcl ? (
 <>
 <span className="font-semibold uppercase tracking-wider">Clearance de creatinina (Cockcroft-Gault):</span>
 <span className="font-mono font-bold text-foreground">{crcl.value} mL/min</span>
 <span className="text-[10px]">· Cr {crcl.creat} mg/dL · {crcl.ageYears}a · {crcl.weightKg} kg</span>
 </> ) : (
 <span className="italic">Clearance de creatinina indisponível — registre creatinina, peso, idade e sexo.</span> )}
 </div> );
              })()}
 <div className="mb-3"><StewardshipPanel patient={p} /></div>
 <MedicationsList items={p.medications} weightKg={p.weight}
                onChange={(v) => upd("medications", v)} />
 </Section>
 </TabsContent> {/* 6 — Exames */}
 <TabsContent value="exam">
 <Section title="Exames de imagem">
 <ImagingList items={p.imaging ?? []} onChange={(v) => upd("imaging", v)} />
 </Section>
 <Section title="Eletroencefalograma · parecer">
 <EegList items={p.eeg ?? []} onChange={(v) => upd("eeg", v)} />
 </Section>
 <Section title="Hemotransfusão">
 <HemotransfusionList items={p.hemotransfusions ?? []} onChange={(v) => upd("hemotransfusions", v)} />
 </Section>
 <p className="mt-2 text-[11px] italic text-muted-foreground">
              Os resultados de exames laboratoriais agora são preenchidos na aba “6 · Estado atual”, em formato de tabela seriada.
 </p>
 </TabsContent> {/* 7 — Culturas microbiológicas */}
 <TabsContent value="cult">
 <Section title="Exames laboratoriais de cultura">
 <CulturesList
                items={p.cultures ?? []}
                devices={p.devices ?? []}
                onChange={(v) => upd("cultures", v)}
              />
 </Section>
 </TabsContent> {/* 7 — Plano */}
 <TabsContent value="plan">
 <Section title="Condutas pendentes / concluídas (por sistema orgânico)">
 <ConductsList items={p.conducts} onChange={(v) => upd("conducts", v)} />
 </Section>
 <div className="mt-3">
 <Section title="Metas clínicas">
 <GoalsList items={p.goals} onChange={(v) => upd("goals", v)} />
 </Section>
 </div>
 </TabsContent> {/* 8 — Lesões por Pressão */}
 <TabsContent value="lpp">
 <Section title="Mapa de lesões por pressão (escaras)">
 <PressureInjuryMap
                lesions={p.lpp ?? []}
                onChange={(v) => upd("lpp", v as LPPLesion[])}
              />
 </Section>
 </TabsContent>
 </Tabs>

 <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
 <div className="flex items-center gap-2">
 <Button variant="outline" size="icon" onClick={undo} disabled={pastRef.current.length === 0}
     title="Desfazer alteração" aria-label="Desfazer alteração">
 <Undo2 className="h-4 w-4" />
 </Button>
 <Button variant="outline" size="icon" onClick={redo} disabled={futureRef.current.length === 0}
     title="Refazer alteração" aria-label="Refazer alteração">
 <Redo2 className="h-4 w-4" />
 </Button>
 <Button variant="ghost" onClick={onClose}>Descartar</Button>
 </div>
 <div className="flex gap-2">
 <StepNav tab={tab} setTab={setTab} />
 <Button onClick={save}>Salvar e fechar</Button>
 </div>
 </DialogFooter>

 </DialogContent>
 </Dialog> );
}

const ORDER = ["id", "hist", "proc", "sup", "med", "exam", "cult", "plan", "lpp"];
function StepNav({ tab, setTab }: { tab: string; setTab: (v: string) => void }) {
  const i = ORDER.indexOf(tab);
  return (
 <>
 <Button variant="outline" disabled={i <= 0} onClick={() => setTab(ORDER[i - 1])}>Voltar</Button>
 <Button variant="outline" disabled={i >= ORDER.length - 1} onClick={() => setTab(ORDER[i + 1])}>Próximo</Button>
 </> );
}

// ============================================================================
// Sub-form: Diagnoses
// ============================================================================



const DIAGNOSIS_CATEGORIES: { value: NonNullable<TimelineEvent["category"]>; label: string }[] = [
  { value: "current", label: "Atual" },
  { value: "inactive", label: "Inativo" },
  { value: "previous", label: "Pregresso" },
  { value: "complication", label: "Complicação" },
];

function DiagnosesList({ items, onChange }: { items: TimelineEvent[]; onChange: (v: TimelineEvent[]) => void }) {
  const add = () => onChange([...items, { date: String(new Date().getFullYear()), label: "", kind: "neutral", category: "current" }]);
  const updItem = (i: number, patch: Partial<TimelineEvent>) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
 <div className="space-y-2"> {items.map((d, i) => (
 <div key={i} className="grid grid-cols-[34px_90px_1fr_130px_36px] gap-2">
 <div className="flex flex-col justify-center gap-0.5">
 <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              title="Mover para cima"
              className="rounded border border-border px-1 text-[9px] leading-4 hover:bg-surface-2 disabled:opacity-30">▲</button>
 <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
              title="Mover para baixo"
              className="rounded border border-border px-1 text-[9px] leading-4 hover:bg-surface-2 disabled:opacity-30">▼</button>
 </div>
 <input className={inputCls} placeholder="Ano/Data" value={d.date}
            onChange={(e) => updItem(i, { date: e.target.value })} />
 <input className={inputCls} placeholder="Diagnóstico"
            value={d.label} onChange={(e) => updItem(i, { label: e.target.value })} />
 <select className={inputCls} value={d.category ?? ""}
            onChange={(e) => updItem(i, { category: (e.target.value || undefined) as TimelineEvent["category"] })}>
 <option value="">— classificação —</option> {DIAGNOSIS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
 </select>
 <button onClick={() => del(i)} className="rounded-md border border-border p-1.5 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div> ))}

 <Button variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar diagnóstico</Button>
 </div> );
}

// ============================================================================
// Sub-form: Past medications (medication history)
// ============================================================================

const PAST_MED_STATUS: PastMedication["status"][] = [
 "em uso domiciliar",
 "suspenso",
 "alergia/reação",
 "uso prévio",
];

function PastMedicationsList({
  items,
  onChange,
}: {
  items: PastMedication[];
  onChange: (v: PastMedication[]) => void;
}) {
  const add = () => onChange([
      ...items,
      {
        id: `pmed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: "",
        status: "uso prévio",
      },
    ]);
  const updItem = (i: number, patch: Partial<PastMedication>) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
 <div className="space-y-2"> {items.length === 0 && (
 <div className="text-[11px] text-muted-foreground"> Nenhuma medicação prévia registrada. Use para listar uso domiciliar, tratamentos anteriores ou suspensos.
 </div> )}
      {items.map((m, i) => (
 <div key={m.id} className="rounded-md border border-border bg-surface-2/30 p-2">
 <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr_0.7fr_0.9fr_36px] gap-2">
 <input
              className={inputCls}
              placeholder="Medicamento"
              value={m.name}
              onChange={(e) => updItem(i, { name: e.target.value })}
            />
 <input
              className={inputCls}
              placeholder="Dose (ex.: 50 mg)"
              value={m.dose ?? ""}
              onChange={(e) => updItem(i, { dose: e.target.value || undefined })}
            />
 <input
              className={inputCls}
              placeholder="Via"
              value={m.route ?? ""}
              onChange={(e) => updItem(i, { route: e.target.value || undefined })}
            />
 <input
              className={inputCls}
              placeholder="Freq."
              value={m.freq ?? ""}
              onChange={(e) => updItem(i, { freq: e.target.value || undefined })}
            />
 <select
              className={inputCls}
              value={m.status ?? "uso prévio"}
              onChange={(e) => updItem(i, { status: e.target.value as PastMedication["status"] })
              }
            > {PAST_MED_STATUS.map((s) => (
 <option key={s} value={s}> {s}
 </option> ))}
 </select>
 <button
              onClick={() => del(i)}
              className="rounded-md border border-border p-1.5 hover:bg-destructive/10 hover:text-destructive"
            >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 <div className="mt-2 grid grid-cols-[0.8fr_1.2fr_2fr] gap-2">
 <input
              className={inputCls}
              placeholder="Período (ex.: 2020-2024)"
              value={m.period ?? ""}
              onChange={(e) => updItem(i, { period: e.target.value || undefined })}
            />
 <input
              className={inputCls}
              placeholder="Indicação / motivo"
              value={m.reason ?? ""}
              onChange={(e) => updItem(i, { reason: e.target.value || undefined })}
            />
 <input
              className={inputCls}
              placeholder="Observações"
              value={m.notes ?? ""}
              onChange={(e) => updItem(i, { notes: e.target.value || undefined })}
            />
 </div>
 </div> ))}
 <Button variant="outline" size="sm" onClick={add}>
 <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar medicação prévia
 </Button>
 </div> );
}

// ============================================================================
// Sub-form: Devices
// ============================================================================


function DevicesList({ items, onChange }: { items: InvasiveDevice[]; onChange: (v: InvasiveDevice[]) => void }) {
  const [category, setCategory] = useState<DeviceCategory>("venous_central");
  const types = deviceTypesByCategory(category);
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? "");
  const def = deviceTypeByCode(typeCode);
  const [site, setSite] = useState(def?.sites[0] ?? "");
  const [lumens, setLumens] = useState<1 | 2 | 3 | 4>(3);
  const [size, setSize] = useState("");
  const [insertedAt, setInsertedAt] = useState(isoToLocalInput(nowISO()));
  const [endsAt, setEndsAt] = useState("");
  const [insertedBy, setInsertedBy] = useState("");
  const [indication, setIndication] = useState("");
  const [attempts, setAttempts] = useState<number | "">(1);
  const [technique, setTechnique] = useState("");
  const [notes, setNotes] = useState("");

  // sync when category / type changes
  const onCat = (c: DeviceCategory) => {
    setCategory(c);
    const t = deviceTypesByCategory(c)[0];
    if (t) {
      setTypeCode(t.code);
      setSite(t.sites[0] ?? "");
    }
  };
  const onType = (code: string) => {
    setTypeCode(code);
    const t = deviceTypeByCode(code);
    setSite(t?.sites[0] ?? "");
    setSize("");
  };

  const add = () => {
    if (!def) return;
    const dev: InvasiveDevice = {
      id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      typeCode,
      site: site || undefined,
      lumens: def.needsLumens ? lumens : undefined,
      size: def.needsSize ? size || undefined : undefined,
      side: def.needsSide && site ? (site.endsWith("E") ? "E" : "D") : undefined,
      insertedAt: localInputToISO(insertedAt) || nowISO(),
      nextChangeAt: localInputToISO(endsAt) || undefined,
      insertedBy: insertedBy.trim() || undefined,
      indication: indication.trim() || undefined,
      attempts: typeof attempts === "number" ? attempts : undefined,
      technique: technique.trim() || undefined,
      notes: notes || undefined,
      recommendedMaxDays: def.recommendedMaxDays,
    };
    onChange([...items, dev]);
    setNotes(""); setSize(""); setInsertedBy("");
    setIndication(""); setTechnique(""); setAttempts(1);
    setInsertedAt(isoToLocalInput(nowISO()));
    setEndsAt("");
  };

  const del = (id: string) => onChange(items.filter((x) => x.id !== id));
  const remove = (id: string) => onChange(items.map((x) => (x.id === id ? { ...x, removedAt: nowISO() } : x)));

  const active = items.filter((x) => !x.removedAt);
  const removed = items.filter((x) => x.removedAt);

  return (
 <div className="space-y-3">
 <div className="rounded-md border border-dashed border-clinical-device/40 bg-clinical-device/5 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-clinical-device"> Adicionar dispositivo
 </div>
 <div className="grid grid-cols-3 gap-2">
 <div>
 <L>Categoria *</L>
 <select className={inputCls} value={category}
              onChange={(e) => onCat(e.target.value as DeviceCategory)}> {DEVICE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
 </select>
 </div>
 <div>
 <L>Tipo *</L>
 <select className={inputCls} value={typeCode} onChange={(e) => onType(e.target.value)}> {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
 </select>
 </div>
 <div>
 <L>Sítio anatômico</L>
 <select className={inputCls} value={site} onChange={(e) => setSite(e.target.value)}> {def?.sites.map((s) => <option key={s} value={s}>{s}</option>)}
 </select>
 </div> {def?.needsLumens && (
 <div>
 <L>Lúmens</L>
 <select className={inputCls} value={lumens}
                onChange={(e) => setLumens(Number(e.target.value) as 1 | 2 | 3 | 4)}> {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} lúmen{n > 1 ? "s" : ""}</option>)}
 </select>
 </div> )}
          {def?.needsSize && (
 <div>
 <L>{def.sizeLabel ?? "Tamanho"}</L>
 <input className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} />
 </div> )}
 <div>
 <L>Data e hora da inserção</L>
 <input type="datetime-local" className={inputCls} value={insertedAt}
              onChange={(e) => setInsertedAt(e.target.value)} />
 </div>
 <div>
 <L>Data final programada</L>
 <input type="datetime-local" className={inputCls} value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)} />
 </div>
 <div>
 <L>Profissional responsável</L>
 <input className={inputCls} value={insertedBy} onChange={(e) => setInsertedBy(e.target.value)} />
 </div>
 <div>
 <L>Indicação clínica</L>
 <input className={inputCls} value={indication} onChange={(e) => setIndication(e.target.value)}
              placeholder="Ex.: instabilidade hemodinâmica" />
 </div>
 <div>
 <L>Nº de tentativas</L>
 <input type="number" min={1} className={inputCls} value={attempts}
              onChange={(e) => setAttempts(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))} />
 </div>
 <div>
 <L>Técnica utilizada</L>
 <input className={inputCls} value={technique} onChange={(e) => setTechnique(e.target.value)}
              placeholder="Ex.: Seldinger guiado por USG" />
 </div>
 <div className="col-span-3">
 <L>{def?.notesLabel ? `${def.notesLabel} / Observações` : "Observações"}</L>
 <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
 </div>
 <div className="col-span-3 flex items-end justify-end">
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar dispositivo</Button>
 </div>
 </div> {def && (
 <div className="mt-2 text-[10px] text-muted-foreground"> Tempo máximo recomendado: <b>{def.recommendedMaxDays} dias</b> · Risco intrínseco: <b>{def.riskWeight}/4</b>.
 </div> )}
 </div>


 <ul className="space-y-1"> {active.map((d) => (
 <DeviceEditCard
            key={d.id}
            d={d}
            onPatch={(patch) => onChange(items.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))}
            onRemove={() => remove(d.id)}
            onDelete={() => del(d.id)}
          /> ))}
        {active.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhum dispositivo ativo.</li>}
 </ul> {removed.length > 0 && (
 <details className="text-[11px]" open>
 <summary className="cursor-pointer text-muted-foreground">Histórico de invasões realizadas ({removed.length})</summary>
 <ul className="mt-2 space-y-1"> {removed.map((d) => (
 <DeviceEditCard
                key={d.id}
                d={d}
                historic
                onPatch={(patch) => onChange(items.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))}
                onRemove={() => onChange(items.map((x) => (x.id === d.id ? { ...x, removedAt: undefined } : x)))}
                onDelete={() => del(d.id)}
              /> ))}
 </ul>
 </details> )}

 </div> );
}

// ============================================================================
// Sub-form: edição de um dispositivo (ativo ou histórico)
// ============================================================================

function DeviceEditCard({
  d, historic, onPatch, onRemove, onDelete,
}: {
  d: InvasiveDevice;
  historic?: boolean;
  onPatch: (patch: Partial<InvasiveDevice>) => void;
  onRemove: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = deviceTypeByCode(d.typeCode);
  const isTracheo = d.typeCode === "TQT";

  const changeCannula = () => {
    const at = nowISO();
    onPatch({
      lastCannulaChangeAt: at,
      cannulaChanges: [...(d.cannulaChanges ?? []), { at, type: d.cannulaType }],
    });
  };

  return (
 <li className={`rounded-md border ${historic ? "border-border/60 bg-surface-2/40" : "border-border bg-surface"} px-3 py-2 text-[12px]`}>
 <div className="flex items-center gap-2">
 <span className="text-[14px]">{t?.icon}</span>
 <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 text-left">
 <div className="font-semibold text-foreground"> {t?.label} {d.site ? `· ${d.site}` : ""} {d.lumens ? `· ${d.lumens}L` : ""} {d.size ? `· ${d.size}` : ""}
            {d.cannulaType ? ` · cânula ${d.cannulaType}` : ""}
 </div>
 <div className="text-[10px] text-muted-foreground"> Inserido {new Date(d.insertedAt).toLocaleString("pt-BR")}
            {d.insertedBy ? ` por ${d.insertedBy}` : ""}
            {d.lastCannulaChangeAt ? ` · última troca ${new Date(d.lastCannulaChangeAt).toLocaleString("pt-BR")}` : ""}
            {d.removedAt ? ` · retirado ${new Date(d.removedAt).toLocaleString("pt-BR")}` : ""}
            {d.notes ? ` — ${d.notes}` : ""}
 </div>
 </button>
 <button type="button" onClick={() => setOpen((v) => !v)}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-2"> {open ? "Fechar" : "Editar"}
 </button>
 <button onClick={onRemove}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-clinical-attention/10 hover:text-clinical-attention"
          title={historic ? "Reativar dispositivo" : "Marcar como retirado"}> {historic ? "Reativar" : "Retirar"}
 </button>
 <button onClick={onDelete} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div> {open && (
 <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2">
 <div>
 <L>Sítio anatômico</L>
 <input className={inputCls} value={d.site ?? ""} onChange={(e) => onPatch({ site: e.target.value || undefined })} />
 </div>
 <div>
 <L>Lado</L>
 <select className={inputCls} value={d.side ?? ""}
              onChange={(e) => onPatch({ side: (e.target.value || undefined) as InvasiveDevice["side"] })}>
 <option value="">—</option>
 <option value="D">D</option>
 <option value="E">E</option>
 </select>
 </div>
 <div>
 <L>Lúmens</L>
 <select className={inputCls} value={d.lumens ?? ""}
              onChange={(e) => onPatch({ lumens: (e.target.value ? Number(e.target.value) : undefined) as InvasiveDevice["lumens"] })}>
 <option value="">—</option> {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
 </select>
 </div>
 <div>
 <L>{t?.sizeLabel ?? "Tamanho"}</L>
 <input className={inputCls} value={d.size ?? ""} onChange={(e) => onPatch({ size: e.target.value || undefined })} />
 </div>
 <div>
 <L>Inserção</L>
 <input type="datetime-local" className={inputCls} value={isoToLocalInput(d.insertedAt)}
              onChange={(e) => onPatch({ insertedAt: localInputToISO(e.target.value) || d.insertedAt })} />
 </div>
 <div>
 <L>Data final programada</L>
 <input type="datetime-local" className={inputCls} value={d.nextChangeAt ? isoToLocalInput(d.nextChangeAt) : ""}
              onChange={(e) => onPatch({ nextChangeAt: localInputToISO(e.target.value) || undefined })} />
 </div>
 <div>
 <L>Profissional responsável</L>
 <input className={inputCls} value={d.insertedBy ?? ""} onChange={(e) => onPatch({ insertedBy: e.target.value || undefined })} />
 </div>
 <div>
 <L>Indicação clínica</L>
 <input className={inputCls} value={d.indication ?? ""} onChange={(e) => onPatch({ indication: e.target.value || undefined })} />
 </div>
 <div>
 <L>Técnica</L>
 <input className={inputCls} value={d.technique ?? ""} onChange={(e) => onPatch({ technique: e.target.value || undefined })} />
 </div>
 <div>
 <L>Nº de tentativas</L>
 <input type="number" min={1} className={inputCls} value={d.attempts ?? ""}
              onChange={(e) => onPatch({ attempts: e.target.value ? Number(e.target.value) : undefined })} />
 </div>
 <div>
 <L>Retirado em</L>
 <input type="datetime-local" className={inputCls} value={d.removedAt ? isoToLocalInput(d.removedAt) : ""}
              onChange={(e) => onPatch({ removedAt: localInputToISO(e.target.value) || undefined })} />
 </div>
 <div>
 <L>Prazo máx. (dias)</L>
 <input type="number" min={1} className={inputCls} value={d.recommendedMaxDays ?? ""}
              onChange={(e) => onPatch({ recommendedMaxDays: e.target.value ? Number(e.target.value) : undefined })} />
 </div>
 <div className="col-span-3">
 <L>Observações</L>
 <input className={inputCls} value={d.notes ?? ""} onChange={(e) => onPatch({ notes: e.target.value || undefined })} />
 </div> {isTracheo && (
 <div className="col-span-3 rounded-md border border-dashed border-clinical-resp/50 bg-clinical-resp/5 p-2">
 <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-clinical-resp"> Traqueostomia · troca de cânula
 </div>
 <div className="grid grid-cols-3 gap-2">
 <div>
 <L>Tipo de cânula</L>
 <select className={inputCls} value={d.cannulaType ?? ""}
                    onChange={(e) => onPatch({ cannulaType: (e.target.value || undefined) as InvasiveDevice["cannulaType"] })}>
 <option value="">— selecionar —</option>
 <option value="plástica">Plástica</option>
 <option value="metálica">Metálica</option>
 </select>
 </div>
 <div>
 <L>Última troca</L>
 <input type="datetime-local" className={inputCls}
                    value={d.lastCannulaChangeAt ? isoToLocalInput(d.lastCannulaChangeAt) : ""}
                    onChange={(e) => onPatch({ lastCannulaChangeAt: localInputToISO(e.target.value) || undefined })} />
 </div>
 <div className="flex items-end">
 <Button size="sm" variant="outline" onClick={changeCannula}> Registrar troca agora (renova prazo)
 </Button>
 </div>
 </div> {(d.cannulaChanges?.length ?? 0) > 0 && (
 <ul className="mt-2 space-y-0.5 text-[10px] text-muted-foreground"> {d.cannulaChanges!.map((c, i) => (
 <li key={i} className="flex items-center gap-2">
 <span> {new Date(c.at).toLocaleString("pt-BR")}{c.type ? ` · ${c.type}` : ""}</span>
 <button
                        onClick={() => onPatch({ cannulaChanges: (d.cannulaChanges ?? []).filter((_, idx) => idx !== i) })}
                        className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3 w-3" />
 </button>
 </li> ))}
 </ul> )}
 </div> )}
 </div> )}
 </li> );
}



// ============================================================================
// Sub-form: Procedures (catalog-driven)
// ============================================================================

function ProceduresList({ items, onChange }: { items: TimelineEvent[]; onChange: (v: TimelineEvent[]) => void }) {
  const [code, setCode] = useState(PROCEDURES[0].code);
  const [date, setDate] = useState(nowShort());
  const [detail, setDetail] = useState("");

  const add = () => {
    const def = PROCEDURES.find((p) => p.code === code);
    if (!def) return;
    onChange([
      ...items,
      { date, label: def.label, detail: detail || undefined, kind: def.kind },
    ]);
    setDetail("");
    setDate(nowShort());
  };
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
 <div className="space-y-3">
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar procedimento</div>
 <div className="grid grid-cols-[1.4fr_140px_1.6fr_auto] gap-2">
            <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}> {PROCEDURES.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option> ))}
            </select>
 <input className={inputCls} placeholder="DD/MM HH:mm"
            value={date} onChange={(e) => setDate(e.target.value)} />
 <input className={inputCls} placeholder="Detalhe (opcional)"
            value={detail} onChange={(e) => setDetail(e.target.value)} />
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div>
 </div>

 <ul className="space-y-1"> {items.map((e, i) => (
 <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
 <span className="font-mono text-[11px] text-muted-foreground">{e.date}</span>
 <span className="flex-1 text-foreground">{e.label}{e.detail ? ` — ${e.detail}` : ""}</span>
 <button onClick={() => del(i)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </li> ))}
        {items.length === 0 && (
 <li className="text-[11px] text-muted-foreground">Nenhum procedimento registrado.</li> )}
 </ul>
 </div> );
}

// ============================================================================
// Barra de faixa de dose (dois pontos: dose mínima e dose máxima)
// ============================================================================

const thumbCls =
 "pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent " +
 "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
 "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
 "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary " +
 "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
 "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary";

function DoseRangeBar({
  min, max, unit, valueMin, valueMax, onChange,
}: {
  min: number; max: number; unit: string;
  valueMin: number; valueMax: number;
  onChange: (lo: number, hi: number) => void;
}) {
  const span = Math.max(max - min, 0.0001);
  const step = Number((span / 100).toPrecision(2));
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  const round = (v: number) => Number(v.toFixed(3));

  return (
 <div>
 <div className="mb-1 flex items-center justify-between text-[10px] font-semibold">
 <span className="text-clinical-stable">Mín {valueMin} {unit}</span>
 <span className="text-clinical-critical">Máx {valueMax} {unit}</span>
 </div>
 <div className="relative h-6">
 <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-surface-3" />
 <div
          className="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-primary/60"
          style={{ left: `${pct(valueMin)}%`, width: `${Math.max(0, pct(valueMax) - pct(valueMin))}%` }}
        />
 <input
          type="range" min={min} max={max} step={step} value={valueMin}
          onChange={(e) => onChange(Math.min(round(Number(e.target.value)), valueMax), valueMax)}
          className={thumbCls} aria-label="Dose mínima"
        />
 <input
          type="range" min={min} max={max} step={step} value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(round(Number(e.target.value)), valueMin))}
          className={thumbCls} aria-label="Dose máxima"
        />
 </div>
 <div className="mt-1 flex items-center gap-2">
 <input type="number" step={step} className={`${inputCls} h-7 text-[11px]`} value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)} />
 <span className="text-[10px] text-muted-foreground">até</span>
 <input type="number" step={step} className={`${inputCls} h-7 text-[11px]`} value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))} />
 </div>
 </div> );
}


// ============================================================================
// Sub-form: Medications (calculator + ATB tracking)
// ============================================================================

function MedicationsList({
  items, weightKg, onChange,
}: { items: Medication[]; weightKg: number; onChange: (v: Medication[]) => void }) {
  const [drugName, setDrugName] = useState(DRUGS[0].name);
  const protocol = "Geral";
  const [dose, setDose] = useState<number>(DRUGS[0].usual);
  const [doseMin, setDoseMin] = useState<number>(DRUGS[0].min);
  const [doseMax, setDoseMax] = useState<number>(DRUGS[0].max);

  // Banco de diluições (aba Diluições) — inclui diluições personalizadas
  const [dilOverrides, setDilOverrides] = useState<Record<string, DrugOverride>>({});
  useEffect(() => { setDilOverrides(dilutionStore.loadOverrides()); }, []);
  const bankDrugs = useMemo(
    () => DRUG_BANK.map((d) => {
        const ov = dilOverrides[d.code];
        const merged = mergedDrug(d, ov);
        return { ...merged, hasCustom: (ov?.customDilutions?.length ?? 0) > 0 };
      }),
    [dilOverrides],
  );
  const bankByName = useMemo(
    () => new Map(bankDrugs.map((d) => [d.name, d])),
    [bankDrugs],
  );
  /** casa um fármaco do banco de diluições com o catálogo de cálculo clínico */
  const matchClinical = (bankName: string) => {
    const first = normalize(bankName).split(/[^a-z0-9]+/)[0];
    return DRUGS.find((d) => normalize(d.name).startsWith(first));
  };



  const [otherName, setOtherName] = useState("");
  const [otherDose, setOtherDose] = useState("");
  const [otherFreq, setOtherFreq] = useState("8/8h");
  
  const [otherClass, setOtherClass] = useState<MedicationClass>("iv");
  const [otherIsAtb, setOtherIsAtb] = useState(false);
  const [otherCourseDays, setOtherCourseDays] = useState(7);
  const [otherDiluent, setOtherDiluent] = useState<DiluentSolution | "">("");
  const [otherVolumeMl, setOtherVolumeMl] = useState<number | "">("");


  const bankSel = bankByName.get(drugName);
  const drug = drugByName(drugName) ?? (bankSel ? matchClinical(drugName) : undefined);

  const calc = useMemo(() => {
    if (!drug || !weightKg) return null;
    return computeInfusion({ drug, protocol, dose, weightKg });
  }, [drug, protocol, dose, weightKg]);
  const calcMin = useMemo(() => {
    if (!drug || !weightKg) return null;
    return computeInfusion({ drug, protocol, dose: doseMin, weightKg });
  }, [drug, protocol, doseMin, weightKg]);
  const calcMax = useMemo(() => {
    if (!drug || !weightKg) return null;
    return computeInfusion({ drug, protocol, dose: doseMax, weightKg });
  }, [drug, protocol, doseMax, weightKg]);


  // autosuggest course days when ATB name changes
  const otherIsAtbAuto = useMemo(() => detectAntibiotic(otherName), [otherName]);
  useEffect(() => {
    if (otherIsAtbAuto) {
      setOtherIsAtb(true);
      setOtherCourseDays(antibioticDefaultDays(otherName));
    }
  }, [otherName, otherIsAtbAuto]);

  const addCalc = () => {
    if (!drug || !calc) {
      if (!drugName) return;
      onChange([...items, {
        name: drugName, dose: "", route: "EV", freq: "BIC",
        start: todayShort(), kind: "attention", active: true, class: "pump",
      }]);
      return;
    }
    const med: Medication = {
      name: bankSel?.name ?? drug.name,

      dose: `${doseMin}–${doseMax} ${drug.doseUnit}`,
      route: "EV", freq: "BIC",
      start: todayShort(),
      kind: drug.category === "vasoativa" ? "critical" : drug.category === "sedativo" ? "neuro" : "attention",
      active: true, protocol,
      concentrationMgPerMl: calc.concentrationMgPerMl,
      mlPerHour: calc.mlPerHour,
      doseMinValue: doseMin,
      doseMaxValue: doseMax,
      doseRangeUnit: drug.doseUnit,
      mlPerHourMin: calcMin?.mlPerHour,
      mlPerHourMax: calcMax?.mlPerHour,
      class: "pump",

    };
    onChange([...items, med]);
  };

  const routeFromClass = (c: MedicationClass): string => {
    switch (c) {
      case "antibiotic": return "EV";
      case "pump": return "EV";
      case "hydration": return "EV";
      case "iv": return "EV";
      case "im": return "IM";
      case "sc": return "SC";
      case "oral": return "VO";
      case "inhaled": return "INAL";
      case "topical": return "TOP";
      default: return "EV";
    }
  };

  const addOther = () => {
    if (!otherName.trim()) return;
    const start = new Date();
    const chosen: MedicationClass = otherIsAtb ? "antibiotic" : otherClass;
    const med: Medication = {
      name: otherName.trim(),
      dose: otherDose,
      route: routeFromClass(chosen),
      freq: otherFreq,
      start: todayShort(),
      kind: "attention",
      class: chosen,
      active: true,
    };
    if (otherDiluent && typeof otherVolumeMl === "number" && otherVolumeMl > 0) {
      med.diluent = { solution: otherDiluent, volumeMl: Math.min(1000, Math.max(1, otherVolumeMl)) };
    }
    if (otherIsAtb) {
      med.isAntibiotic = true;
      med.startISO = start.toISOString();
      const end = new Date(start.getTime() + otherCourseDays * 86400000);
      med.plannedEndISO = end.toISOString();
    }
    onChange([...items, med]);
    setOtherName(""); setOtherDose(""); setOtherIsAtb(false);
    setOtherDiluent(""); setOtherVolumeMl("");
  };


  const updItem = (i: number, patch: Partial<Medication>) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  // ---- Fluxo de inclusão: escolher o tipo primeiro ----
  type EntryType = "pump" | "antibiotic" | "hydration" | "other";
  const [entryType, setEntryType] = useState<EntryType | null>(null);

  const HYDRATION_SOLUTIONS = [
 "Soro fisiológico 0,9%",
 "Ringer lactato",
 "Soro fisiológico 0,45%",
 "Soro fisiológico 0,225%",
 "Salina 3%",
 "Solução balanceada",
  ];
  const [hydName, setHydName] = useState(HYDRATION_SOLUTIONS[0]);
  const [hydVolume, setHydVolume] = useState<number | "">(500);
  const [hydRate, setHydRate] = useState("");
  const [hydFreq, setHydFreq] = useState("Contínuo");

  const addHydration = () => {
    const med: Medication = {
      name: hydName,
      dose: hydVolume ? `${hydVolume} mL` : "",
      route: "EV",
      freq: hydRate ? `${hydRate} mL/h` : hydFreq,
      start: todayShort(),
      kind: "resp",
      class: "hydration",
      active: true,
    };
    onChange([...items, med]);
    setEntryType(null);
  };

  const ENTRY_TYPES: { id: EntryType; label: string; icon: string; cls: string }[] = [
    { id: "pump", label: "Medicação em bomba", icon: "", cls: "border-clinical-critical/50 hover:bg-clinical-critical/10" },
    { id: "antibiotic", label: "Antimicrobiano", icon: "", cls: "border-clinical-attention/50 hover:bg-clinical-attention/10" },
    { id: "hydration", label: "Hidratação", icon: "", cls: "border-clinical-resp/50 hover:bg-clinical-resp/10" },
    { id: "other", label: "Outros medicamentos", icon: "", cls: "border-border hover:bg-surface-2" },
  ];

  const grouped = MEDICATION_CLASS_ORDER
    .map((c) => ({ c, rows: items.map((m, i) => ({ m, i })).filter(({ m }) => medClassOf(m) === c) }))
    .filter((g) => g.rows.length > 0);

  const renderRow = (m: Medication, i: number) => {
    const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
    const active = m.active !== false;
    return (
 <li key={i} className="rounded-md border border-border bg-surface p-3 text-[12px]">
 <div className="grid grid-cols-[auto_1.4fr_0.8fr_1fr_0.8fr_auto_auto] items-center gap-2">
 <span className="text-[14px]">{MEDICATION_CLASS_META[medClassOf(m)].icon}</span>
 <input className={inputCls} value={m.name}
            onChange={(e) => updItem(i, { name: e.target.value })} placeholder="Nome" />
 <input className={inputCls} value={m.dose}
            onChange={(e) => updItem(i, { dose: e.target.value })} placeholder="Dose" />
 <select
            className={inputCls}
            value={medClassOf(m)}
            onChange={(e) => {
              const cls = e.target.value as MedicationClass;
              updItem(i, { class: cls, route: routeFromClass(cls) });
            }}
            title="Classe / via"
          > {MEDICATION_CLASS_ORDER.map((c) => (
 <option key={c} value={c}>{MEDICATION_CLASS_META[c].icon} {MEDICATION_CLASS_META[c].label}</option> ))}
 </select>
 <input className={inputCls} value={m.freq}
            onChange={(e) => updItem(i, { freq: e.target.value })} placeholder="Freq" />
  <button
    type="button"
    onClick={() => updItem(i, { active: !active })}
    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${active ? "border-clinical-stable/50 bg-clinical-stable/10 text-clinical-stable" : "border-clinical-neutral/50 bg-clinical-neutral/10 text-clinical-neutral"}`}
    title={active ? "Ativo — clique para suspender" : "Suspenso — clique para ativar"}
    aria-label={active ? "Medicação ativa" : "Medicação suspensa"}
  >
    {active ? <CircleCheck className="h-4 w-4" /> : <CirclePause className="h-4 w-4" />}
  </button>

 <button onClick={() => del(i)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>

 <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]"> {!isAtb && (
 <div className="text-muted-foreground">Início <input className={inputCls} value={m.start}
              onChange={(e) => updItem(i, { start: e.target.value })} /></div> )}
          {m.mlPerHour !== undefined && (
 <div className="font-mono text-clinical-resp">BIC {m.mlPerHour.toFixed(1)} mL/h · {m.concentrationMgPerMl?.toFixed(2)} mg/mL</div> )}
 </div> {isAtb && (
 <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-2">
 <div className="min-w-0">
 <L>Início</L>
 <input type="datetime-local" className={`${inputCls} min-w-0`}
                value={isoToLocalInput(m.startISO)}
                onChange={(e) => updItem(i, { startISO: localInputToISO(e.target.value), isAntibiotic: true })} />
 </div>
 <div className="min-w-0">
 <L>Término previsto</L>
 <input type="datetime-local" className={`${inputCls} min-w-0`}
                value={isoToLocalInput(m.plannedEndISO)}
                onChange={(e) => updItem(i, { plannedEndISO: localInputToISO(e.target.value), isAntibiotic: true })} />
 </div>
 <div className="min-w-0">
 <L>Doses adm.</L>
 <input type="number" className={`${inputCls} min-w-0`} value={m.dosesGiven ?? ""}
                onChange={(e) => updItem(i, { dosesGiven: Number(e.target.value) || undefined, isAntibiotic: true })} />
 </div>
 <div className="min-w-0">
 <L>Doses previstas</L>
 <input type="number" className={`${inputCls} min-w-0`} value={m.plannedDoses ?? ""}
                onChange={(e) => updItem(i, { plannedDoses: Number(e.target.value) || undefined, isAntibiotic: true })} />
 </div>
 </div> )}
 </li> );
  };

  return (
 <div className="space-y-4"> {/* ETAPA 1 — escolher o tipo */}
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"> Adicionar medicação — selecione o tipo
 </div>
 <div className="grid grid-cols-2 gap-2 md:grid-cols-4"> {ENTRY_TYPES.map((t) => (
 <button
              key={t.id}
              type="button"
              onClick={() => {
                setEntryType(entryType === t.id ? null : t.id);
                if (t.id === "antibiotic") setOtherIsAtb(true);
                if (t.id === "other") setOtherIsAtb(false);
                if (t.id === "other") setOtherClass("iv");
              }}
              className={`rounded-md border px-2 py-3 text-[11px] font-semibold transition ${t.cls} ${
                entryType === t.id ? "ring-2 ring-ring bg-surface-2" : "bg-background"
              }`}
            >
 <div className="text-[16px]">{t.icon}</div> {t.label}
 </button> ))}
 </div>
 </div> {/* ETAPA 2 — formulário do tipo escolhido */}
      {entryType === "pump" && (
 <div className="rounded-md border border-dashed border-clinical-critical/40 bg-clinical-critical/5 p-3">
 <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-clinical-critical">
 <Calculator className="h-3.5 w-3.5" /> Calculadora de infusão (BIC)
 </div>
 <div className="grid grid-cols-[1.6fr_2.4fr_auto] items-center gap-3">
 <select className={inputCls} value={drugName}
              onChange={(e) => {
                setDrugName(e.target.value);
                const d = drugByName(e.target.value) ?? matchClinical(e.target.value);
                if (d) { setDose(d.usual); setDoseMin(d.min); setDoseMax(d.max); }
              }}>
 <optgroup label="Catálogo BIC"> {DRUGS.filter((d) => d.bic).map((d) => (
 <option key={d.name} value={d.name}>{d.name}</option> ))}
 </optgroup>
 <optgroup label="Banco de diluições"> {bankDrugs.map((d) => (
 <option key={d.code} value={d.name}> {d.hasCustom ? " " : ""}{d.name}{d.hasCustom ? " (diluição personalizada)" : ""}
 </option> ))}
 </optgroup>
 </select> {drug && (
 <DoseRangeBar
                min={drug.min}
                max={drug.max}
                unit={drug.doseUnit}
                valueMin={doseMin}
                valueMax={doseMax}
                onChange={(lo, hi) => { setDoseMin(lo); setDoseMax(hi); setDose(hi); }}
              /> )}

 <Button size="sm" onClick={() => { addCalc(); setEntryType(null); }}>
 <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
 </Button>
 </div> {bankSel && (
 <div className="mt-2 rounded-md border border-border bg-background/60 p-2 text-[10px]">
 <div className="font-semibold">Diluições cadastradas ({bankSel.presentation.label})</div>
 <ul className="mt-1 space-y-0.5"> {bankSel.dilutions.map((dl) => (
 <li key={dl.id} className={dl.custom ? "text-clinical-attention" : "text-muted-foreground"}> {dl.custom ? " " : "• "}{dl.label}
 </li> ))}
 </ul>
 </div> )}

 <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground"> {drug
              ? <span>Referência: mín {drug.min} · usual {drug.usual} · máx {drug.max} {drug.doseUnit}</span> : <span className="text-clinical-attention">Sem cálculo automático para este fármaco — use a aba Diluições.</span>}
            {drug?.notes && <span className="text-clinical-attention">{drug.notes}</span>}
 </div> {calc && drug && (
 <div className="mt-3 rounded-md border border-border bg-background p-2 font-mono text-[11px]">
 <div>Peso <b>{weightKg} kg</b> · Diluição <b>{calc.protocolLabel}</b> ({calc.concentrationMgPerMl.toFixed(2)} {drug.doseUnit === "UI/h" ? "UI" : "mg"}/mL)</div>
 <div>Faixa prescrita: <b>{doseMin} – {doseMax} {drug.doseUnit}</b></div>
 <div className="text-clinical-resp"> Velocidade BIC: <b>{calcMin ? calcMin.mlPerHour.toFixed(1) : "—"} → {calcMax ? calcMax.mlPerHour.toFixed(1) : "—"} mL/h</b>
 </div> {calc.warning && <div className="text-clinical-critical"> {calc.warning}</div>}
 </div> )}
 </div> )}

      {entryType === "hydration" && (
 <div className="rounded-md border border-dashed border-clinical-resp/40 bg-clinical-resp/5 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-clinical-resp"> Hidratação
 </div>
 <div className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_auto] items-center gap-2">
 <select className={inputCls} value={hydName} onChange={(e) => setHydName(e.target.value)}> {HYDRATION_SOLUTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
 </select>
 <input className={inputCls} type="number" min={1} placeholder="Volume mL"
              value={hydVolume} onChange={(e) => setHydVolume(e.target.value ? Number(e.target.value) : "")} />
 <input className={inputCls} placeholder="mL/h" value={hydRate}
              onChange={(e) => setHydRate(e.target.value)} />
 <input className={inputCls} placeholder="Frequência" value={hydFreq}
              onChange={(e) => setHydFreq(e.target.value)} />
 <Button size="sm" onClick={addHydration}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div>
 </div> )}

      {(entryType === "antibiotic" || entryType === "other") && (
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"> {entryType === "antibiotic" ? " Antimicrobiano" : " Outro medicamento"}
 </div> {entryType === "antibiotic" && (
 <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2">
 <select
                className={inputCls}
                value={otherName}
                onChange={(e) => {
                  const v = e.target.value;
                  setOtherName(v);
                  const cat = findAntimicrobial(v);
                  if (cat) { setOtherDose(cat.dose); setOtherFreq(cat.freq); setOtherCourseDays(cat.days); }
                }}
              >
 <option value="">— selecionar do catálogo de antimicrobianos —</option> {ANTIMICROBIAL_LIBRARY.map((g) => g.classes.map((c) => (
 <optgroup key={g.id + c.id} label={`${g.label} · ${c.label}`}> {c.drugs.map((dr) => (
 <option key={g.id + c.id + dr.name} value={dr.name}> {dr.name} — {dr.dose} {dr.freq} · {dr.days}d [{dr.aware}]
 </option> ))}
 </optgroup> )),
                )}
 </select> {(() => {
                const cat = findAntimicrobial(otherName);
                if (!cat) return <span className="text-[10px] text-muted-foreground">AWaRe —</span>;
                const a = awareMeta(cat.aware);
                return <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${a.className}`}>{a.label}</span>;
              })()}
 </div> )}
 <div className="grid grid-cols-[1.5fr_0.8fr_1fr_0.8fr_auto] gap-2">
 <input className={inputCls} placeholder="Nome (ex.: Meropenem)"
              value={otherName} onChange={(e) => setOtherName(e.target.value)} />
 <input className={inputCls} placeholder="Dose" value={otherDose} onChange={(e) => setOtherDose(e.target.value)} />
 <select className={inputCls} value={otherClass} onChange={(e) => setOtherClass(e.target.value as MedicationClass)} title="Via de administração"> {MEDICATION_CLASS_ORDER.filter((c) => c !== "antibiotic" && c !== "pump" && c !== "hydration").map((c) => (
 <option key={c} value={c}>{MEDICATION_CLASS_META[c].icon} {MEDICATION_CLASS_META[c].label}</option> ))}
 </select>
 <input className={inputCls} placeholder="Freq" value={otherFreq} onChange={(e) => setOtherFreq(e.target.value)} />
 <Button size="sm" onClick={() => { addOther(); setEntryType(null); }}>
 <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
 </Button>
 </div>

 <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]"> {entryType === "antibiotic" ? (
 <label className="flex items-center gap-1">
 <span className="text-muted-foreground">Duração prevista:</span>
 <input type="number" min={1} max={60} className="w-16 rounded border border-input bg-background px-2 py-1"
                  value={otherCourseDays} onChange={(e) => setOtherCourseDays(Number(e.target.value))} />
 <span className="text-muted-foreground">dias</span>
 </label> ) : (
 <label className="flex items-center gap-1">
 <input type="checkbox" checked={otherIsAtb} onChange={(e) => setOtherIsAtb(e.target.checked)} />
 <span>É antimicrobiano</span>
 </label> )}
 <span className="ml-2 text-muted-foreground">Soro:</span>
 <select className="rounded border border-input bg-background px-2 py-1"
              value={otherDiluent} onChange={(e) => setOtherDiluent(e.target.value as DiluentSolution | "")}>
 <option value="">— sem soro —</option> {(["SF 0,9%", "SG 5%", "SG 10%", "Ringer Lactato", "Ringer Simples", "Água destilada (ABD)", "Outra"] as DiluentSolution[]).map((s) => (
 <option key={s} value={s}>{s}</option> ))}
 </select> {otherDiluent && (
 <label className="flex items-center gap-1">
 <input type="number" min={1} max={1000} placeholder="mL"
                  className="w-20 rounded border border-input bg-background px-2 py-1"
                  value={otherVolumeMl}
                  onChange={(e) => setOtherVolumeMl(e.target.value ? Number(e.target.value) : "")} />
 <span className="text-muted-foreground">mL</span>
 </label> )}
 </div>
 </div> )}

      {/* Lista agrupada por classe */}
 <div className="space-y-3">
 <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"> Medicações cadastradas
 </div> {grouped.length === 0 && (
 <div className="text-[11px] text-muted-foreground">Nenhuma medicação cadastrada.</div> )}
        {grouped.map(({ c, rows }) => {
          const meta = MEDICATION_CLASS_META[c];
          return (
 <div key={c} className={`rounded-md border ${meta.borderClass} ${meta.bgClass} p-2`}>
 <div className={`mb-2 text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}> {meta.icon} {meta.label} · {rows.length}
 </div>
 <ul className="space-y-2">{rows.map(({ m, i }) => renderRow(m, i))}</ul>
 </div> );
        })}
 </div>
 </div> );
}

// ============================================================================
// Sub-form: Exams
// ============================================================================

function ExamsList({
  items, sex, onChange,
}: { items: ExamRow[]; sex: "M" | "F"; onChange: (v: ExamRow[]) => void }) {
  const [code, setCode] = useState(LABS[0].code);
  const [value, setValue] = useState<string>("");
  const [takenAt, setTakenAt] = useState(nowShort());
  const def = labByCode(code);

  const preview = useMemo(() => {
    const v = parseFloat(value.replace(",", "."));
    if (!def || !Number.isFinite(v)) return null;
    const bucket = classifyLab(code, v, sex);
    return bucketBadge(bucket);
  }, [code, value, sex, def]);

  const add = () => {
    if (!def) return;
    const v = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(v)) return;
    const existing = items.find((e) => (e.code ?? e.label) === code);
    if (existing) {
      const prevHist = existing.history ?? [];
      const newHist = [{ takenAt: existing.takenAt ?? takenAt, value: existing.valueNum ?? v }, ...prevHist].slice(0, 8);
      const next = items.map((e) => (e.code ?? e.label) === code
          ? { ...e, value: String(v).replace(".", ","), valueNum: v, takenAt, history: newHist, unit: def.unit, label: def.code, code }
          : e,
      );
      onChange(next);
    } else {
      onChange([
        ...items,
        { code, label: def.code, value: String(v).replace(".", ","), valueNum: v, unit: def.unit, takenAt, trend: "flat", history: [] },
      ]);
    }
    setValue("");
    setTakenAt(nowShort());
  };

  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
 <div className="space-y-3">
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar exame</div>
 <div className="grid grid-cols-[1.4fr_1fr_0.6fr_1fr_1fr_auto] gap-2">
 <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}> {LABS.map((l) => <option key={l.code} value={l.code}>{l.code} — {l.label}</option>)}
 </select>
 <input className={inputCls} placeholder="Resultado" value={value} onChange={(e) => setValue(e.target.value)} />
 <div className="grid place-items-center rounded-md border border-input bg-muted px-2 text-[12px] text-muted-foreground">{def?.unit || "—"}</div>
 <input className={inputCls} placeholder="DD/MM HH:mm" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
 <div className="grid place-items-center text-[12px]"> {preview ? <span className={preview.className}>{preview.icon} {preview.label}</span> : <span className="text-muted-foreground">—</span>}
 </div>
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div> {def && (
 <div className="mt-2 text-[10px] text-muted-foreground"> Ref: {(sex === "F" && def.refF ? def.refF : def.ref).low}–{(sex === "F" && def.refF ? def.refF : def.ref).high} {def.unit}
 </div> )}
 </div>

 <ul className="space-y-1"> {items.map((e, i) => {
          const v = e.valueNum ?? parseFloat(e.value.replace(",", "."));
          const bucket = e.code && Number.isFinite(v) ? classifyLab(e.code, v, sex) : null;
          const b = bucket ? bucketBadge(bucket) : null;
          return (
 <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
 <span className="w-16 font-semibold">{e.label}</span>
 <span className={`font-mono ${b?.className ?? "text-foreground"}`}>{e.value} {e.unit ?? ""}</span> {b && <span className={`text-[11px] ${b.className}`}>{b.icon} {b.label}</span>}
 <span className="ml-auto text-[10px] text-muted-foreground">{e.takenAt}</span> {e.history && e.history.length > 0 && (
 <span className="text-[10px] text-muted-foreground">({e.history.length} prévio)</span> )}
 <button onClick={() => del(i)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </li> );
        })}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhum exame cadastrado.</li>}
 </ul>
 </div> );
}

// ============================================================================
// Sub-form: Conducts and Goals
// ============================================================================

const TEAMS: Conduct["team"][] = ["Médica", "Enfermagem", "Fisioterapia", "Nutrição", "Fono", "Psicologia"];

function ConductsList({ items, onChange }: { items: Conduct[]; onChange: (v: Conduct[]) => void }) {
  const [team, setTeam] = useState<Conduct["team"]>("Médica");
  const [system, setSystem] = useState<ConductSystem>("gi");
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  const add = () => {
    // O tópico é o próprio sistema orgânico — não há mais nome de conduta.
    const newConduct: Conduct = {
      team, system,
      text: CONDUCT_SYSTEM_META[system].label,
      done: false,
      startedAt,
      subItems: [{ text: "", done: false, color: "default" as const, date: new Date().toISOString().slice(0, 10) }],
    };
    const next = [...items, newConduct];
    onChange(next);
    setExpanded((prev) => ({ ...prev, [next.length - 1]: true }));
  };
  const upd = (i: number, patch: Partial<Conduct>) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    setExpanded((prev) => {
      const copy = { ...prev };
      delete copy[i];
      return copy;
    });
  };

  const addSub = (i: number) => {
    const cur = items[i];
    const subs = [...(cur.subItems ?? []), { text: "", done: false, color: "default" as const, date: new Date().toISOString().slice(0, 10) }];
    upd(i, { subItems: subs });
  };
  const updSub = (i: number, si: number, patch: Partial<ConductSubItem>) => {
    const cur = items[i];
    const subs = (cur.subItems ?? []).map((s, k) => (k === si ? { ...s, ...patch } : s));
    upd(i, { subItems: subs });
  };
  const delSub = (i: number, si: number) => {
    const cur = items[i];
    upd(i, { subItems: (cur.subItems ?? []).filter((_, k) => k !== si) });
  };

  return (
 <div className="space-y-2">
 <div className="grid grid-cols-[140px_1fr_140px_auto] gap-2">
 <select className={inputCls} value={team} onChange={(e) => setTeam(e.target.value as Conduct["team"])}> {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 <select className={inputCls} value={system} onChange={(e) => setSystem(e.target.value as ConductSystem)}> {CONDUCT_SYSTEM_ORDER.map((s) => (
 <option key={s} value={s}>{CONDUCT_SYSTEM_META[s].icon} {CONDUCT_SYSTEM_META[s].label}</option> ))}
 </select>
 <input
                 type="date"
                 className={inputCls}
                 value={startedAt}
                 onChange={(e) => setStartedAt(e.target.value)}
                 title="Data de início da conduta"
               />
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar sistema</Button>
 </div>

 <ul className="space-y-2"> {items.map((c, i) => {
          const meta = c.system ? CONDUCT_SYSTEM_META[c.system] : CONDUCT_SYSTEM_META.other;
          return (
 <li key={i} className={`rounded-md border px-2 py-2 text-[12px] ${meta.borderClass} ${meta.bgClass}`}>
 <div className="mb-1.5 flex flex-wrap items-center gap-2">
 <input type="checkbox" checked={c.done} onChange={(e) => upd(i, { done: e.target.checked })}
                  title="Marcar sistema como resolvido" />
 <select className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                  value={c.team} onChange={(e) => upd(i, { team: e.target.value as Conduct["team"] })}> {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 <input
                  type="date"
                  className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                  value={c.startedAt ? c.startedAt.slice(0, 10) : ""}
                  onChange={(e) => upd(i, { startedAt: e.target.value || undefined })}
                  title="Data de início da conduta"
                />
 <span className={`ml-1 text-[11px] font-bold uppercase tracking-wider ${meta.className}`}> {meta.icon} {meta.label}
 </span>
 <div className="ml-auto flex items-center gap-1">
 <button onClick={() => addSub(i)} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold hover:bg-surface-3"> + anotação
 </button>
 <button onClick={() => del(i)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 </div>

  <ul className="space-y-1.5"> {(c.subItems ?? []).map((sub, si) => {
                  const colMeta = ANNOTATION_COLOR_META[sub.color ?? "default"];
                  return (
  <li key={si} className="flex items-start gap-2 text-[11px]">
  <input type="checkbox" checked={!!sub.done} className="mt-1.5"
                         onChange={(e) => updSub(i, si, { done: e.target.checked })} />
  <div className="flex flex-1 flex-col gap-1">
  <input
                           type="date"
                           className="w-32 rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                           value={sub.date ?? ""}
                           onChange={(e) => updSub(i, si, { date: e.target.value || undefined })}
                           title="Data da conduta específica"
                         />
  <textarea
                           className={`flex-1 rounded border border-border/60 bg-background px-2 py-1 text-[12px] leading-snug outline-none focus:border-primary ${colMeta.textClass}`}
                           placeholder="Anotação — escreva livremente (múltiplas linhas)"
                           rows={Math.max(2, Math.min(8, (sub.text.match(/\n/g)?.length ?? 0) + 2))}
                           value={sub.text}
                           onChange={(e) => updSub(i, si, { text: e.target.value })}
                         />
  </div>
  <select
                         className="mt-6 rounded border border-border bg-background px-1 py-1 text-[10px]"
                         value={sub.color ?? "default"}
                         onChange={(e) => updSub(i, si, { color: e.target.value as ConductSubItem["color"] })}
                         title="Cor da fonte"
                       > {ANNOTATION_COLOR_ORDER.map((col) => (
  <option key={col} value={col}>{ANNOTATION_COLOR_META[col].label}</option> ))}
  </select>
  <span className="mt-6 inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: colMeta.swatch }} />
  <button onClick={() => delSub(i, si)} className="mt-5 rounded p-1 hover:bg-destructive/10 hover:text-destructive">
  <Trash2 className="h-3 w-3" />
  </button>
  </li> );
                })}
                {(c.subItems ?? []).length === 0 && (
 <li className="text-[10px] italic text-muted-foreground">Sem anotações. Use “+ anotação”.</li> )}
 </ul>
 </li> );
        })}
        {items.length === 0 && (
 <li className="text-[11px] text-muted-foreground">Nenhum sistema orgânico adicionado ao plano.</li> )}
 </ul>
 </div> );
}



function GoalsList({ items, onChange }: { items: Goal[]; onChange: (v: Goal[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...items, { text: text.trim(), met: false }]);
    setText("");
  };
  const upd = (i: number, patch: Partial<Goal>) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
 <div className="space-y-2">
 <div className="grid grid-cols-[1fr_auto] gap-2">
 <input className={inputCls} placeholder="Meta (ex.: PAM > 65)"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div>
 <ul className="space-y-1"> {items.map((g, i) => (
 <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12px]">
 <input type="checkbox" checked={g.met} onChange={(e) => upd(i, { met: e.target.checked })} />
 <input className="flex-1 bg-transparent outline-none"
              value={g.text} onChange={(e) => upd(i, { text: e.target.value })} />
 <button onClick={() => del(i)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </li> ))}
 </ul>
 </div> );
}

// keep unused list-types referenced (avoid TS warnings)
void DEVICE_TYPES;

// ============================================================================
// Sub-form: Culturas microbiológicas
// ============================================================================

function CulturesList({
  items,
  devices,
  onChange,
}: {
  items: Culture[];
  devices: InvasiveDevice[];
  onChange: (v: Culture[]) => void;
}) {
  const add = () => {
    const next: Culture = {
      id: `cult_${Date.now()}`,
      source: "Hemocultura periférica",
      sourceCode: "hemo_perif",
      collectedAt: nowISO(),
      result: "andamento",
      resistanceProfile: "pendente",
      sampleCount: 1,
    };
    onChange([...items, next]);
  };
  const upd = (i: number, patch: Partial<Culture>) => onChange(items.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="text-[11px] text-muted-foreground"> {items.length} cultura(s) cadastrada(s) · biblioteca com{" "}
          {ORGANISM_LIBRARY.gramPos.length + ORGANISM_LIBRARY.gramNeg.length + ORGANISM_LIBRARY.fungos.length} microrganismos
 </div>
 <Button size="sm" onClick={add}>
 <Plus className="mr-1 h-3.5 w-3.5" /> Nova cultura
 </Button>
 </div> {items.length === 0 && (
 <div className="rounded-md border border-dashed border-border bg-surface px-3 py-6 text-center text-[12px] text-muted-foreground"> Nenhuma cultura registrada. Clique em "Nova cultura" para iniciar.
 </div> )}

 <datalist id="cult-organism-master"> {ORGANISM_LIBRARY.gramPos.map((o) => <option key={o} value={o} />)}
        {ORGANISM_LIBRARY.gramNeg.map((o) => <option key={o} value={o} />)}
        {ORGANISM_LIBRARY.fungos.map((o) => <option key={o} value={o} />)}
 </datalist>

 <ul className="space-y-3"> {items.map((c, i) => {
          const badge = cultureResultBadge(c);
          const alerts = detectCultureAlerts(c);
          const focus = sourceToFocus(c);
          const methods = COLLECTION_METHODS[c.sourceCode ?? ""] ?? [];
          return (
 <li key={c.id} className="rounded-md border border-border bg-surface p-3">
 <div className="mb-2 flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="text-[14px]">{badge.icon}</span>
 <span className={`text-[11px] font-semibold uppercase tracking-wider ${badge.className}`}> {badge.label}
 </span> {focus && (
 <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"> {focus}
 </span> )}
 </div>
 <button
                  onClick={() => del(i)}
                  className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                  title="Remover cultura"
                >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>

 <div className="grid grid-cols-4 gap-2 text-[12px]">
 <div>
 <L>Material</L>
 <select
                    className={inputCls}
                    value={c.sourceCode ?? ""}
                    onChange={(e) => {
                      const code = e.target.value;
                      const def = CULTURE_SOURCES.find((s) => s.code === code);
                      upd(i, { sourceCode: code, source: def?.label ?? c.source });
                    }}
                  >
 <option value="">— selecionar —</option> {CULTURE_SOURCES.map((s) => (
 <option key={s.code} value={s.code}>{s.label}</option> ))}
 </select>
 </div>
 <div>
 <L>Data/hora coleta</L>
 <input
                    type="datetime-local"
                    className={inputCls}
                    value={isoToLocalInput(c.collectedAt)}
                    onChange={(e) => upd(i, { collectedAt: localInputToISO(e.target.value) })}
                  />
 </div>
 <div>
 <L>Local da coleta</L>
 <input
                    className={inputCls}
                    placeholder="ex.: CVC jugular D"
                    value={c.collectionSite ?? ""}
                    onChange={(e) => upd(i, { collectionSite: e.target.value || undefined })}
                  />
 </div>
 <div>
 <L>Método</L>
 <input
                    list={`method-${c.id}`}
                    className={inputCls}
                    placeholder={methods[0] ?? "técnica"}
                    value={c.method ?? ""}
                    onChange={(e) => upd(i, { method: e.target.value || undefined })}
                  /> {methods.length > 0 && (
 <datalist id={`method-${c.id}`}> {methods.map((m) => <option key={m} value={m} />)}
 </datalist> )}
 </div>

 <div>
 <L>Nº amostras</L>
 <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={c.sampleCount ?? ""}
                    onChange={(e) => upd(i, { sampleCount: e.target.value ? Number(e.target.value) : undefined })}
                  />
 </div>
 <div>
 <L>Resultado</L>
 <select
                    className={inputCls}
                    value={c.result ?? "andamento"}
                    onChange={(e) => upd(i, { result: e.target.value as Culture["result"] })}
                  >
 <option value="andamento"> Em andamento</option>
 <option value="negativa"> Negativa</option>
 <option value="positiva"> Positiva</option>
 </select>
 </div>
 <div className="col-span-2">
 <L>Microrganismo isolado</L>
 <input
                    list="cult-organism-master"
                    className={inputCls}
                    placeholder="digite ou selecione da biblioteca"
                    value={c.organism ?? ""}
                    onChange={(e) => upd(i, { organism: e.target.value || undefined })}
                  />
 </div>

 <div>
 <L>Perfil de resistência</L>
 <select
                    className={inputCls}
                    value={c.resistanceProfile ?? ""}
                    onChange={(e) => upd(i, { resistanceProfile: (e.target.value || undefined) as Culture["resistanceProfile"] })
                    }
                  >
 <option value="">—</option>
 <option value="sensivel">Sensível</option>
 <option value="MDR">MDR</option>
 <option value="XDR">XDR</option>
 <option value="PDR">PDR</option>
 <option value="pendente">Pendente</option>
 </select>
 </div>
 <div>
 <L>Contagem bacteriana</L>
 <input
                    className={inputCls}
                    placeholder=">100.000 UFC/mL"
                    value={c.bacterialCount ?? ""}
                    onChange={(e) => upd(i, { bacterialCount: e.target.value || undefined })}
                  />
 </div>
 <div>
 <L>Aspecto / amostra</L>
 <input
                    className={inputCls}
                    placeholder="ex.: purulenta"
                    value={c.aspect ?? ""}
                    onChange={(e) => upd(i, { aspect: e.target.value || undefined })}
                  />
 </div>
 <div>
 <L>Dispositivo relacionado</L>
 <select
                    className={inputCls}
                    value={c.linkedDeviceId ?? ""}
                    onChange={(e) => upd(i, { linkedDeviceId: e.target.value || undefined })}
                  >
 <option value="">—</option> {devices.filter((d) => !d.removedAt).map((d) => (
 <option key={d.id} value={d.id}> {d.typeCode}{d.site ? ` · ${d.site}` : ""}
 </option> ))}
 </select>
 </div>

 <div className="col-span-4">
 <L>Observações</L>
 <input
                    className={inputCls}
                    value={c.notes ?? ""}
                    onChange={(e) => upd(i, { notes: e.target.value || undefined })}
                  />
 </div>
 </div> {alerts.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-1"> {alerts.map((a) => (
 <span
                      key={a.code}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        a.severity === "critical"
                          ? "bg-clinical-critical/15 text-clinical-critical"
                          : "bg-clinical-attention/15 text-clinical-attention"
                      }`}
                    > {a.label}
 </span> ))}
 </div> )}

              {/* Antibiograma */}
 <div className="mt-3 border-t border-border/60 pt-2">
 <div className="mb-1 flex items-center justify-between">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> Antibiograma · S / I / R
 </div>
 <Button
                    size="sm"
                    variant="outline"
                    onClick={() => upd(i, {
                        antibiogram: [
                          ...(c.antibiogram ?? []),
                          { drug: ABX_PANEL[0], result: "S" as AntibiogramResult },
                        ],
                      })
                    }
                  >
 <Plus className="mr-1 h-3 w-3" /> Antibiótico
 </Button>
 </div> {(c.antibiogram ?? []).length === 0 && (
 <div className="text-[11px] italic text-muted-foreground">Sem antibiograma cadastrado.</div> )}
 <ul className="space-y-1"> {(c.antibiogram ?? []).map((a, ai) => {
                    const b = abxResultBadge(a.result);
                    return (
 <li key={ai} className="flex items-center gap-2">
 <select
                          className={`${inputCls} flex-1`}
                          value={a.drug}
                          onChange={(e) => {
                            const next = [...(c.antibiogram ?? [])];
                            next[ai] = { ...next[ai], drug: e.target.value };
                            upd(i, { antibiogram: next });
                          }}
                        > {ABX_PANEL.map((d) => <option key={d} value={d}>{d}</option>)}
 </select>
 <select
                          className={`${inputCls} w-28`}
                          value={a.result}
                          onChange={(e) => {
                            const next = [...(c.antibiogram ?? [])];
                            next[ai] = { ...next[ai], result: e.target.value as AntibiogramResult };
                            upd(i, { antibiogram: next });
                          }}
                        >
 <option value="S"> Sensível</option>
 <option value="I"> Intermediária</option>
 <option value="R"> Resistente</option>
 </select>
 <input
                          className={`${inputCls} w-20`}
                          placeholder="MIC"
                          value={a.mic ?? ""}
                          onChange={(e) => {
                            const next = [...(c.antibiogram ?? [])];
                            next[ai] = { ...next[ai], mic: e.target.value || undefined };
                            upd(i, { antibiogram: next });
                          }}
                        />
 <span className={`shrink-0 text-[10px] font-semibold ${b.className}`} title={b.label}>{b.icon}</span>
 <button
                          onClick={() => {
                            const next = (c.antibiogram ?? []).filter((_, x) => x !== ai);
                            upd(i, { antibiogram: next });
                          }}
                          className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                        >
 <Trash2 className="h-3 w-3" />
 </button>
 </li> );
                  })}
 </ul>
 </div>
 </li> );
        })}
 </ul>
 </div> );
}

// ============================================================================
// Sub-form: Imaging exams
// ============================================================================

const IMAGING_MODALITIES: { code: ImagingModality; label: string }[] = [
  { code: "RX", label: "Radiografia (RX)" },
  { code: "USG", label: "Ultrassonografia (USG)" },
  { code: "TC", label: "Tomografia (TC)" },
  { code: "RM", label: "Ressonância (RM)" },
  { code: "ECO", label: "Ecocardiograma" },
  { code: "ECODOPPLER", label: "Ecodoppler" },
  { code: "ANGIO", label: "Angiografia" },
  { code: "MAMO", label: "Mamografia" },
  { code: "PET", label: "PET-CT" },
  { code: "CINTILO", label: "Cintilografia" },
  { code: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS: { code: NonNullable<ImagingExam["status"]>; label: string; icon: string }[] = [
  { code: "solicitado", label: "Solicitado", icon: "" },
  { code: "concluido", label: "Concluído", icon: "" },
];


const CONCLUSION_OPTIONS: { code: NonNullable<ImagingExam["conclusion"]>; label: string; icon: string }[] = [
  { code: "normal", label: "Normal", icon: "" },
  { code: "alterado", label: "Alterado", icon: "" },
  { code: "critico", label: "Crítico", icon: "" },
  { code: "pendente", label: "Pendente", icon: "" },
];

const OUTCOME_OPTIONS: { code: NonNullable<ImagingExam["outcome"]> | ""; label: string }[] = [
  { code: "", label: "Resultado: não classificado" },
  { code: "bom", label: "Bom resultado esperado" },
  { code: "mau", label: "Mau resultado esperado" },
];

function EegList({ items, onChange }: { items: EegRecord[]; onChange: (v: EegRecord[]) => void }) {
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const updItem = (id: string, patch: Partial<EegRecord>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => {
    if (!report.trim()) return;
    onChange([...items, { id: `eeg_${Date.now()}`, performedAt, report: report.trim(), reportedBy: reportedBy.trim() || undefined }]);
    setReport(""); setReportedBy("");
  };
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar EEG</div>
      <div className="grid grid-cols-2 gap-1.5">
        <input type="date" className={inputCls} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
        <input className={inputCls} placeholder="Laudado por (opcional)" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
        <textarea className={`${inputCls} col-span-2 min-h-[56px]`} placeholder="Parecer / laudo descritivo do EEG" value={report} onChange={(e) => setReport(e.target.value)} />
      </div>
      <button type="button" onClick={add} className="mt-1.5 rounded border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-3">+ Adicionar</button>
      <ul className="mt-2 space-y-1.5">
        {items.map((eeg) => (
          <li key={eeg.id} className="rounded border border-border bg-surface px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <input type="date" className={inputCls} value={eeg.performedAt} onChange={(e) => updItem(eeg.id, { performedAt: e.target.value })} />
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== eeg.id))} className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-3">Remover</button>
            </div>
            <textarea className={`${inputCls} mt-1 min-h-[48px] w-full`} value={eeg.report} onChange={(e) => updItem(eeg.id, { report: e.target.value })} />
          </li>
        ))}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhum EEG registrado.</li>}
      </ul>
    </div>
  );
}

function HemotransfusionList({ items, onChange }: { items: Hemotransfusion[]; onChange: (v: Hemotransfusion[]) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [component, setComponent] = useState("");
  const [volume, setVolume] = useState("");
  const [note, setNote] = useState("");
  const updItem = (id: string, patch: Partial<Hemotransfusion>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => {
    if (!component.trim()) return;
    onChange([...items, { id: `hemo_${Date.now()}`, date, component: component.trim(), volume: volume.trim() || undefined, note: note.trim() || undefined }]);
    setComponent(""); setVolume(""); setNote("");
  };
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar hemotransfusão</div>
      <div className="grid grid-cols-2 gap-1.5">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={inputCls} placeholder="Hemocomponente (ex.: CH, plasma, plaquetas)" value={component} onChange={(e) => setComponent(e.target.value)} />
        <input className={inputCls} placeholder="Volume (ex.: 1 bolsa · 250 mL)" value={volume} onChange={(e) => setVolume(e.target.value)} />
        <input className={inputCls} placeholder="Indicação / observação" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="button" onClick={add} className="mt-1.5 rounded border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-3">+ Adicionar</button>
      <ul className="mt-2 space-y-1.5">
        {items.map((h) => (
          <li key={h.id} className="rounded border border-border bg-surface px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <input type="date" className={inputCls} value={h.date} onChange={(e) => updItem(h.id, { date: e.target.value })} />
              <input className={inputCls} value={h.component} onChange={(e) => updItem(h.id, { component: e.target.value })} />
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== h.id))} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-3">Remover</button>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <input className={inputCls} placeholder="Volume" value={h.volume ?? ""} onChange={(e) => updItem(h.id, { volume: e.target.value || undefined })} />
              <input className={inputCls} placeholder="Observação" value={h.note ?? ""} onChange={(e) => updItem(h.id, { note: e.target.value || undefined })} />
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhuma hemotransfusão registrada.</li>}
      </ul>
    </div>
  );
}

function ImagingList({ items, onChange }: { items: ImagingExam[]; onChange: (v: ImagingExam[]) => void }) {
  const [modality, setModality] = useState<ImagingModality>("RX");
  const [region, setRegion] = useState("");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [conclusion, setConclusion] = useState<ImagingExam["conclusion"]>("alterado");
  const [status, setStatus] = useState<NonNullable<ImagingExam["status"]>>("solicitado");
  const [outcome, setOutcome] = useState<ImagingExam["outcome"] | "">("");
  const [reportedBy, setReportedBy] = useState("");

  const add = () => {
    if (!region.trim()) return;
    onChange([
      ...items,
      {
        id: `img_${Date.now()}`,
        modality, region: region.trim(),
        performedAt, summary: summary.trim() || undefined,
        conclusion, status,
        outcome: outcome || undefined,
        reportedBy: reportedBy.trim() || undefined,
      },
    ]);
    setRegion(""); setSummary(""); setReportedBy("");
  };
  const del = (id: string) => onChange(items.filter((x) => x.id !== id));
  const updItem = (id: string, patch: Partial<ImagingExam>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
 <div className="space-y-3">
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar exame de imagem</div>
 <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1.2fr_auto] gap-2">
 <select className={inputCls} value={modality} onChange={(e) => setModality(e.target.value as ImagingModality)}> {IMAGING_MODALITIES.map((m) => <option key={m.code} value={m.code}>{m.code} — {m.label}</option>)}
 </select>
 <input className={inputCls} placeholder="Região (ex.: Tórax, Crânio, Abdome)" value={region} onChange={(e) => setRegion(e.target.value)} />
 <input className={inputCls} type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
 <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as NonNullable<ImagingExam["status"]>)}> {STATUS_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.icon} {s.label}</option>)}
 </select>
 <select className={inputCls} value={conclusion} onChange={(e) => setConclusion(e.target.value as ImagingExam["conclusion"])}> {CONCLUSION_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
 </select>
 <select className={inputCls} value={outcome ?? ""} onChange={(e) => setOutcome(e.target.value as ImagingExam["outcome"] | "")}> {OUTCOME_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
 </select>
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div>
 <div className="mt-2 grid grid-cols-[1fr_240px] gap-2">
 <input className={inputCls} placeholder="Resumo do resultado / impressão diagnóstica" value={summary} onChange={(e) => setSummary(e.target.value)} />
 <input className={inputCls} placeholder="Laudista (opcional)" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
 </div>
 </div>

 <ul className="space-y-2"> {items.slice().reverse().map((im) => {
          const attachImages = async (files: FileList | null) => {
            if (!files || !files.length) return;
            const readers = Array.from(files).map((file) => new Promise<ImagingImage>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve({ id: `imgf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, dataUrl: String(r.result), caption: file.name });
              r.onerror = () => reject(r.error);
              r.readAsDataURL(file);
            }));
            const next = await Promise.all(readers);
            onChange(items.map((x) => x.id === im.id ? { ...x, images: [...(x.images ?? []), ...next] } : x));
          };
          const removeImg = (imgId: string) => {
            onChange(items.map((x) => x.id === im.id ? { ...x, images: (x.images ?? []).filter((i) => i.id !== imgId) } : x));
          };
          return (
 <li key={im.id} className="rounded-md border border-border bg-surface p-2 text-[12px]">
 <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1.2fr_auto] gap-2">
 <select className={inputCls} value={im.modality}
                  onChange={(e) => updItem(im.id, { modality: e.target.value as ImagingModality })}> {IMAGING_MODALITIES.map((m) => <option key={m.code} value={m.code}>{m.code}</option>)}
 </select>
 <input className={inputCls} value={im.region}
                  onChange={(e) => updItem(im.id, { region: e.target.value })} />
 <input className={inputCls} type="date" value={im.performedAt.length >= 10 ? im.performedAt.slice(0, 10) : im.performedAt}
                  onChange={(e) => updItem(im.id, { performedAt: e.target.value })} />
 <select className={inputCls} value={im.status ?? "solicitado"}
                  onChange={(e) => updItem(im.id, { status: e.target.value as NonNullable<ImagingExam["status"]> })}> {STATUS_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.icon} {s.label}</option>)}
 </select>
 <select className={inputCls} value={im.conclusion ?? "pendente"}
                  onChange={(e) => updItem(im.id, { conclusion: e.target.value as ImagingExam["conclusion"] })}> {CONCLUSION_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
 </select>
 <select className={inputCls} value={im.outcome ?? ""}
                  onChange={(e) => updItem(im.id, { outcome: (e.target.value || undefined) as ImagingExam["outcome"] })}> {OUTCOME_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
 </select>
 <div className="flex items-center gap-1">
 <label className="cursor-pointer rounded border border-border bg-surface px-1.5 py-1 text-[10px] font-semibold hover:bg-surface-3" title="Anexar imagem">
                    
 <input type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { attachImages(e.target.files); e.currentTarget.value = ""; }} />
 </label>
 <button onClick={() => del(im.id)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 </div>
 <div className="mt-1 grid grid-cols-[1fr_240px] gap-2">
 <input className={inputCls} placeholder="Resumo / impressão diagnóstica" value={im.summary ?? ""}
                  onChange={(e) => updItem(im.id, { summary: e.target.value || undefined })} />
 <input className={inputCls} placeholder="Laudista" value={im.reportedBy ?? ""}
                  onChange={(e) => updItem(im.id, { reportedBy: e.target.value || undefined })} />
 </div> {im.images && im.images.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-2"> {im.images.map((img) => (
 <div key={img.id} className="group relative">
 <img src={img.dataUrl} alt={img.caption ?? "imagem"} className="h-16 w-16 rounded border border-border object-cover" />
 <button onClick={() => removeImg(img.id)}
                        className="absolute -top-1 -right-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block">
 <Trash2 className="h-2.5 w-2.5" />
 </button>
 </div> ))}
 </div> )}
 </li> );
        })}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhum exame de imagem cadastrado.</li>}
 </ul>

 </div> );
}


// ============================================================================
// Sub-form: Infection foci (allow multiple)
// ============================================================================

const INFECTION_STATUS_OPTIONS: { code: InfectionStatus; label: string; icon: string }[] = [
  { code: "suspeito", label: "Suspeito", icon: "" },
  { code: "provavel", label: "Provável", icon: "" },
  { code: "confirmado", label: "Confirmado", icon: "" },
  { code: "resolvido", label: "Resolvido", icon: "" },
];

function InfectionFociList({ items, onChange }: { items: InfectionFocus[]; onChange: (v: InfectionFocus[]) => void }) {
  const siteEntries = Object.entries(SITE_META) as [InfectionSite, typeof SITE_META[InfectionSite]][];
  const [site, setSite] = useState<InfectionSite>(siteEntries[0][0]);
  const [status, setStatus] = useState<InfectionStatus>("suspeito");
  const [unstable, setUnstable] = useState(false);
  const [notes, setNotes] = useState("");

  const add = () => {
    onChange([
      ...items,
      {
        id: `inf_${Date.now()}`,
        site, status, unstable,
        startedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      },
    ]);
    setNotes(""); setUnstable(false);
  };
  const upd = (id: string, patch: Partial<InfectionFocus>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => onChange(items.filter((x) => x.id !== id));

  return (
 <div className="space-y-3">
 <div className="rounded-md border border-dashed border-border bg-surface-2/40 p-3">
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adicionar foco de infecção</div>
 <div className="grid grid-cols-[1.4fr_1fr_auto_auto] gap-2">
 <select className={inputCls} value={site} onChange={(e) => setSite(e.target.value as InfectionSite)}> {siteEntries.map(([code, meta]) => (
 <option key={code} value={code}>{meta.icon} {meta.label}</option> ))}
 </select>
 <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as InfectionStatus)}> {INFECTION_STATUS_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.icon} {s.label}</option>)}
 </select>
 <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
 <input type="checkbox" checked={unstable} onChange={(e) => setUnstable(e.target.checked)} /> Instável
 </label>
 <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
 </div>
 <input className={`${inputCls} mt-2`} placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
 </div>

 <ul className="space-y-1"> {items.map((f) => {
          const meta = SITE_META[f.site];
          return (
 <li key={f.id} className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-semibold text-foreground">{meta?.icon} {meta?.label ?? f.site}</span>
 <select
                  className={`${inputCls} h-7 max-w-[160px] text-[11px]`}
                  value={f.status}
                  onChange={(e) => upd(f.id, { status: e.target.value as InfectionStatus })}
                > {INFECTION_STATUS_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.icon} {s.label}</option>)}
 </select>
 <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
 <input type="checkbox" checked={!!f.unstable} onChange={(e) => upd(f.id, { unstable: e.target.checked })} /> Instável
 </label>
 <span className="ml-auto font-mono text-[10px] text-muted-foreground"> {new Date(f.startedAt).toLocaleDateString("pt-BR")}
 </span>
 <button onClick={() => del(f.id)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div> {f.notes && <div className="mt-1 text-[11px] text-muted-foreground">{f.notes}</div>}
 </li> );
        })}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">Nenhum foco cadastrado.</li>}
 </ul>
 </div> );
}


// ============================================================================
// Sub-form: Fluid Balance (intake, output, drains)
// ============================================================================

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function FluidBalanceEditor({
  value,
  onChange,
}: {
  value?: { intake?: FluidEntry[]; output?: FluidEntry[]; drains?: DrainEntry[]; derivations?: DerivationEntry[] };
  onChange: (v: { intake?: FluidEntry[]; output?: FluidEntry[]; drains?: DrainEntry[]; derivations?: DerivationEntry[] }) => void;
}) {
  const fb = value ?? {};
  const intake = fb.intake ?? [];
  const output = fb.output ?? [];
  const drains = fb.drains ?? [];
  const derivations = fb.derivations ?? [];
  const summary = computeFluidBalance(fb);

  const setIntake = (v: FluidEntry[]) => onChange({ ...fb, intake: v });
  const setOutput = (v: FluidEntry[]) => onChange({ ...fb, output: v });
  const setDrains = (v: DrainEntry[]) => onChange({ ...fb, drains: v });
  const setDerivations = (v: DerivationEntry[]) => onChange({ ...fb, derivations: v });

  const rowCls = "grid grid-cols-[1fr_100px_36px] gap-1 mb-1";

  return (
 <div className="space-y-3">
 <div className="grid grid-cols-4 gap-2">
 <div className="rounded border border-clinical-resp/40 bg-clinical-resp/10 p-1.5 text-center">
 <div className="text-[9px] font-bold uppercase text-clinical-resp">Entradas</div>
 <div className="font-mono text-[14px] font-bold">+{summary.totalIntake}</div>
 </div>
 <div className="rounded border border-clinical-attention/40 bg-clinical-attention/10 p-1.5 text-center">
 <div className="text-[9px] font-bold uppercase text-clinical-attention">Saídas</div>
 <div className="font-mono text-[14px] font-bold">−{summary.totalOutput}</div>
 </div>
 <div className="rounded border border-clinical-device/40 bg-clinical-device/10 p-1.5 text-center">
 <div className="text-[9px] font-bold uppercase text-clinical-device">Drenos</div>
 <div className="font-mono text-[14px] font-bold">−{summary.totalDrains}</div>
 </div>
 <div className="rounded border border-clinical-neuro/40 bg-clinical-neuro/10 p-1.5 text-center">
 <div className="text-[9px] font-bold uppercase text-clinical-neuro">Derivações</div>
 <div className="font-mono text-[14px] font-bold">−{summary.totalDerivations}</div>
 </div>
 </div>
 <div className={`rounded border px-2 py-1.5 text-center font-mono text-[14px] font-bold ${
        summary.balance > 500 ? "border-clinical-attention/50 bg-clinical-attention/15 text-clinical-attention"
        : summary.balance < -500 ? "border-clinical-critical/50 bg-clinical-critical/15 text-clinical-critical"
        : "border-clinical-stable/50 bg-clinical-stable/15 text-clinical-stable"
      }`}> BH: {summary.balance >= 0 ? "+" : ""}{summary.balance} mL
 </div>

 <div className="grid grid-cols-2 gap-3"> {/* Intake */}
 <div className="rounded border border-clinical-resp/30 bg-clinical-resp/5 p-2">
 <div className="mb-1 text-[10px] font-bold uppercase text-clinical-resp">Entradas</div> {intake.map((e, i) => (
 <div key={e.id} className={rowCls}>
 <input className={inputCls} placeholder="Nome (ex.: SF 0,9%)" value={e.name}
                onChange={(ev) => setIntake(intake.map((x, k) => k === i ? { ...x, name: ev.target.value } : x))} />
 <input type="number" className={inputCls} placeholder="mL" value={e.volumeMl}
                onChange={(ev) => setIntake(intake.map((x, k) => k === i ? { ...x, volumeMl: Number(ev.target.value) || 0 } : x))} />
 <button onClick={() => setIntake(intake.filter((_, k) => k !== i))} className="rounded border border-border p-1 hover:bg-destructive/10">
 <Trash2 className="h-3 w-3" />
 </button>
 </div> ))}
 <Button size="sm" variant="outline" onClick={() => setIntake([...intake, { id: uid("in"), name: "", volumeMl: 0, type: "hidratacao" }])}>
 <Plus className="mr-1 h-3 w-3" /> Entrada
 </Button>
 </div> {/* Output */}
 <div className="rounded border border-clinical-attention/30 bg-clinical-attention/5 p-2">
 <div className="mb-1 text-[10px] font-bold uppercase text-clinical-attention">Saídas (diurese, perdas)</div> {output.map((e, i) => (
 <div key={e.id} className={rowCls}>
 <input className={inputCls} placeholder="Nome (ex.: Diurese)" value={e.name}
                onChange={(ev) => setOutput(output.map((x, k) => k === i ? { ...x, name: ev.target.value } : x))} />
 <input type="number" className={inputCls} placeholder="mL" value={e.volumeMl}
                onChange={(ev) => setOutput(output.map((x, k) => k === i ? { ...x, volumeMl: Number(ev.target.value) || 0 } : x))} />
 <button onClick={() => setOutput(output.filter((_, k) => k !== i))} className="rounded border border-border p-1 hover:bg-destructive/10">
 <Trash2 className="h-3 w-3" />
 </button>
 </div> ))}
 <Button size="sm" variant="outline" onClick={() => setOutput([...output, { id: uid("out"), name: "Diurese", volumeMl: 0, type: "diurese" }])}>
 <Plus className="mr-1 h-3 w-3" /> Saída
 </Button>
 </div>
 </div> {/* Drains */}
 <div className="rounded border border-clinical-device/30 bg-clinical-device/5 p-2">
 <div className="mb-1 text-[10px] font-bold uppercase text-clinical-device">Drenos</div> {drains.map((d, i) => (
 <div key={d.id} className="mb-1 grid grid-cols-[1.4fr_1fr_100px_1fr_36px] gap-1">
 <input className={inputCls} placeholder="Nome (ex.: Blake)" value={d.name}
              onChange={(ev) => setDrains(drains.map((x, k) => k === i ? { ...x, name: ev.target.value } : x))} />
 <input className={inputCls} placeholder="Sítio" value={d.site ?? ""}
              onChange={(ev) => setDrains(drains.map((x, k) => k === i ? { ...x, site: ev.target.value } : x))} />
 <input type="number" className={inputCls} placeholder="mL"
              value={d.volumeMl}
              onChange={(ev) => setDrains(drains.map((x, k) => k === i ? { ...x, volumeMl: Number(ev.target.value) || 0 } : x))} />
 <input className={inputCls} placeholder="Aspecto" value={d.aspect ?? ""}
              onChange={(ev) => setDrains(drains.map((x, k) => k === i ? { ...x, aspect: ev.target.value } : x))} />
 <button onClick={() => setDrains(drains.filter((_, k) => k !== i))} className="rounded border border-border p-1 hover:bg-destructive/10">
 <Trash2 className="h-3 w-3" />
 </button>
 </div> ))}
 <Button size="sm" variant="outline" onClick={() => setDrains([...drains, { id: uid("dr"), name: "", volumeMl: 0 }])}>
 <Plus className="mr-1 h-3 w-3" /> Dreno
 </Button>
 </div> {/* Derivations */}
 <div className="rounded border border-clinical-neuro/30 bg-clinical-neuro/5 p-2">
 <div className="mb-1 text-[10px] font-bold uppercase text-clinical-neuro">Derivações (DVE, gastrostomia, nefrostomia…)</div> {derivations.map((d, i) => (
 <div key={d.id} className="mb-1 grid grid-cols-[1.4fr_1fr_100px_1fr_36px] gap-1">
 <input className={inputCls} placeholder="Nome (ex.: DVE)" value={d.name}
              onChange={(ev) => setDerivations(derivations.map((x, k) => k === i ? { ...x, name: ev.target.value } : x))} />
 <input className={inputCls} placeholder="Sítio" value={d.site ?? ""}
              onChange={(ev) => setDerivations(derivations.map((x, k) => k === i ? { ...x, site: ev.target.value } : x))} />
 <input type="number" className={inputCls} placeholder="mL"
              value={d.volumeMl}
              onChange={(ev) => setDerivations(derivations.map((x, k) => k === i ? { ...x, volumeMl: Number(ev.target.value) || 0 } : x))} />
 <input className={inputCls} placeholder="Aspecto" value={d.aspect ?? ""}
              onChange={(ev) => setDerivations(derivations.map((x, k) => k === i ? { ...x, aspect: ev.target.value } : x))} />
 <button onClick={() => setDerivations(derivations.filter((_, k) => k !== i))} className="rounded border border-border p-1 hover:bg-destructive/10">
 <Trash2 className="h-3 w-3" />
 </button>
 </div> ))}
 <Button size="sm" variant="outline" onClick={() => setDerivations([...derivations, { id: uid("dv"), name: "", volumeMl: 0 }])}>
 <Plus className="mr-1 h-3 w-3" /> Derivação
 </Button>
 </div>
 </div> );
}
