import { useEffect, useMemo, useState } from "react";
import {
  DRUG_BANK, DILUTION_DISCLAIMER, DILUTION_SOURCE_NOTE,
  computeSolution, computeRate, computeDoseFromRate, formatConcentration, fmtNum,
  dilutionStore, mergedDrug, normalize, unitNeedsWeight, getDoseRange,
  type DrugDef, type DrugOverride, type DilutionPreset, type DoseUnit,
  type Diluent, type MassUnit, type PrepRecord, type AuditEntry,
} from "@/data/dilutions";
import {
  X, Search, Star, FlaskConical, Syringe, Calculator, History, Settings,
  AlertTriangle, Save, Copy, RotateCcw, Plus, Pill,
} from "lucide-react";
import type { Medication } from "@/data/patients";
import { toast } from "sonner";
import { AntimicrobialLibrary } from "@/components/AntimicrobialLibrary";

const inputCls =
 "h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring";

function Label({ children }: { children: React.ReactNode }) {
  return (
 <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"> {children}
 </div> );
}

const DILUENTS: Diluent[] = ["SF 0,9%", "SG 5%", "SF 0,9% ou SG 5%", "Sem diluente", "Outro"];

type Tab = "calc" | "atb" | "history" | "bank";

export interface DilutionPatient { id: string; name: string; bed: string; weight: number }

export function DilutionCenter({
  open, onClose, defaultWeight, patients = [], onAddToPatient,
}: {
  open: boolean;
  onClose: () => void;
  defaultWeight?: number;
  patients?: DilutionPatient[];
  onAddToPatient?: (patientId: string, med: Medication) => void;
}) {
  const [tab, setTab] = useState<Tab>("calc");
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, DrugOverride>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<PrepRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [drugCode, setDrugCode] = useState<string>("NORA");
  const [user, setUser] = useState("");

  useEffect(() => {
    setOverrides(dilutionStore.loadOverrides());
    setFavorites(dilutionStore.loadFavorites());
    setHistory(dilutionStore.loadHistory());
    setAudit(dilutionStore.loadAudit());
  }, []);

  const drugs = useMemo(
    () => DRUG_BANK.map((d) => mergedDrug(d, overrides[d.code])),
    [overrides],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return drugs;
    return drugs.filter((d) => normalize(d.name).includes(q) || normalize(d.code).includes(q));
  }, [drugs, query]);

  const drug = drugs.find((d) => d.code === drugCode) ?? drugs[0];

  const persistOverrides = (next: Record<string, DrugOverride>) => {
    setOverrides(next);
    dilutionStore.saveOverrides(next);
  };
  const toggleFav = (code: string) => {
    const next = favorites.includes(code) ? favorites.filter((c) => c !== code) : [...favorites, code];
    setFavorites(next);
    dilutionStore.saveFavorites(next);
  };
  const pushHistory = (rec: PrepRecord) => {
    const next = [rec, ...history].slice(0, 100);
    setHistory(next);
    dilutionStore.saveHistory(next);
  };
  const pushAudit = (e: AuditEntry) => {
    const next = [e, ...audit].slice(0, 200);
    setAudit(next);
    dilutionStore.saveAudit(next);
  };

  if (!open) return null;

  return (
 <div className="fixed inset-0 z-50 flex flex-col bg-background"> {/* Header */}
 <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
 <FlaskConical className="h-4 w-4 text-clinical-resp" />
 <div className="text-[13px] font-semibold text-foreground">FARMÁCIA</div>
 <div className="ml-2 flex items-center gap-1"> {([
            { v: "calc", label: "Bomba de infusão", icon: Calculator },
            { v: "atb", label: "Antimicrobianos", icon: Pill },
            { v: "history", label: "Histórico", icon: History },
            { v: "bank", label: "Banco de diluições", icon: Settings },
          ] as const).map((t) => (
 <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] ${
                tab === t.v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-2"
              }`}
            >
 <t.icon className="h-3 w-3" /> {t.label}
 </button> ))}
 </div>
 <input
          className="ml-auto h-8 w-44 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
          placeholder="Responsável"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
 <button onClick={onClose} className="rounded-md border border-border p-1.5 hover:bg-surface-2" title="Fechar">
 <X className="h-4 w-4" />
 </button>
 </div>

 <div className="flex items-center gap-2 border-b border-clinical-attention/40 bg-clinical-attention/10 px-4 py-1.5 text-[10px] text-foreground">
 <AlertTriangle className="h-3 w-3 shrink-0 text-clinical-attention" /> {DILUTION_DISCLAIMER}
 </div>

 <div className="flex min-h-0 flex-1"> {/* Sidebar */}
        {tab !== "atb" && (
 <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-2/50">
 <div className="relative p-2">
 <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
 <input
              className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
              placeholder="Pesquisar medicamento"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
 </div>
 <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"> {favorites.length > 0 && !query && (
 <>
 <div className="px-1 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> Favoritos
 </div> {drugs.filter((d) => favorites.includes(d.code)).map((d) => (
 <DrugItem key={`f-${d.code}`} d={d} active={d.code === drug?.code} fav
                    onSelect={() => setDrugCode(d.code)} onFav={() => toggleFav(d.code)} /> ))}
 </> )}
 <div className="px-1 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> Vasoativos · diuréticos · antiarrítmicos
 </div> {filtered.filter((d) => d.group === "vaso").map((d) => (
 <DrugItem key={d.code} d={d} active={d.code === drug?.code} fav={favorites.includes(d.code)}
                onSelect={() => setDrugCode(d.code)} onFav={() => toggleFav(d.code)} /> ))}
 <div className="px-1 py-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> Analgésicos · sedativos · BNM
 </div> {filtered.filter((d) => d.group === "sedo").map((d) => (
 <DrugItem key={d.code} d={d} active={d.code === drug?.code} fav={favorites.includes(d.code)}
                onSelect={() => setDrugCode(d.code)} onFav={() => toggleFav(d.code)} /> ))}
 </div>
 </aside> )}

        {tab === "atb" ? (
 <AntimicrobialLibrary
            patients={patients.map((p) => ({ id: p.id, name: p.name, bed: p.bed }))}
            onAddToPatient={onAddToPatient}
          /> ) : (
 <main className="min-h-0 flex-1 overflow-y-auto p-4"> {tab === "calc" && drug && (
 <DrugCalculator
              key={drug.code}
              drug={drug}
              defaultWeight={defaultWeight}
              patients={patients}
              user={user}
              onSaveCustom={(preset) => {
                const ov = overrides[drug.code] ?? {};
                const next = {
                  ...overrides,
                  [drug.code]: { ...ov, customDilutions: [...(ov.customDilutions ?? []), preset] },
                };
                persistOverrides(next);
                pushAudit({
                  at: new Date().toISOString(), user, drugCode: drug.code,
                  field: "Nova diluição personalizada", before: "—", after: preset.label,
                });
                toast.success("Diluição personalizada salva");
              }}
              onSavePresentation={(p) => {
                const ov = overrides[drug.code] ?? {};
                pushAudit({
                  at: new Date().toISOString(), user, drugCode: drug.code, field: "Apresentação",
                  before: drug.presentation.label, after: p.label,
                });
                persistOverrides({ ...overrides, [drug.code]: { ...ov, presentation: p } });
              }}
              onRegister={pushHistory}
              onAddToPatient={onAddToPatient}
            /> )}

          {tab === "history" && (
 <HistoryPanel
              history={history}
              onClear={() => { setHistory([]); dilutionStore.saveHistory([]); }}
              onDuplicate={(rec) => { setDrugCode(rec.drugCode); setTab("calc"); }}
            /> )}

          {tab === "bank" && (
 <BankPanel
              drugs={drugs}
              overrides={overrides}
              audit={audit}
              onEditDilution={(code, base, next) => {
                const ov = overrides[code] ?? {};
                const label = `${base.label.split(" — ")[0]} — ${next.drugVolumeMl} mL + ${next.diluentMl} mL${
                  next.diluent !== "Sem diluente" ? ` de ${next.diluent}` : ""
                }`;
                const edited: DilutionPreset = {
                  ...base, ...next,
                  id: base.custom ? base.id : `${base.id}__edit`,
                  custom: true,
                  label,
                };
                const customs = (ov.customDilutions ?? []).filter((c) => c.id !== edited.id);
                const disabled = new Set(ov.disabled ?? []);
                if (!base.custom) disabled.add(base.id);
                disabled.delete(edited.id);
                persistOverrides({
                  ...overrides,
                  [code]: { ...ov, customDilutions: [...customs, edited], disabled: Array.from(disabled) },
                });
                pushAudit({
                  at: new Date().toISOString(), user, drugCode: code,
                  field: "Diluição editada", before: base.label, after: label,
                });
                toast.success("Diluição atualizada");
              }}
              onToggleDilution={(code, id, disable) => {

                const ov = overrides[code] ?? {};
                const disabled = new Set(ov.disabled ?? []);
                if (disable) disabled.add(id); else disabled.delete(id);
                persistOverrides({ ...overrides, [code]: { ...ov, disabled: Array.from(disabled) } });
                pushAudit({
                  at: new Date().toISOString(), user, drugCode: code,
                  field: `Diluição ${id}`, before: disable ? "ativa" : "inativa", after: disable ? "inativa" : "ativa",
                });
              }}
              onRestore={(code) => {
                const next = { ...overrides };
                delete next[code];
                persistOverrides(next);
                pushAudit({
                  at: new Date().toISOString(), user, drugCode: code,
                  field: "Restaurar padrão", before: "personalizado", after: "padrão de fábrica",
                });
                toast.success("Padrão restaurado");
              }}
            /> )}
 </main> )}
 </div>
 </div> );
}

function DrugItem({
  d, active, fav, onSelect, onFav,
}: { d: DrugDef; active: boolean; fav?: boolean; onSelect: () => void; onFav: () => void }) {
  return (
 <div className={`group flex items-center gap-1 rounded-md px-1 ${active ? "bg-primary/10" : "hover:bg-surface-3"}`}>
 <button onClick={onSelect} className="min-w-0 flex-1 py-1.5 text-left">
 <div className="truncate text-[12px] text-foreground">{d.name}</div>
 <div className="truncate font-mono text-[9px] text-muted-foreground">{d.presentation.label}</div>
 </button>
 <button onClick={onFav} title="Favoritar" className="p-1">
 <Star className={`h-3 w-3 ${fav ? "fill-clinical-attention text-clinical-attention" : "text-muted-foreground"}`} />
 </button>
 </div> );
}

// ============================================================================
// Calculadora principal
// ============================================================================

function DoseSlider({
  code, unit, value, onChange,
}: { code: string; unit: DoseUnit; value: string; onChange: (v: string) => void }) {
  const range = getDoseRange(code, unit);
  if (!range) {
    return (
 <>
 <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
 <div className="mt-1 text-[10px] text-muted-foreground"> Sem faixa de referência cadastrada para {unit}.
 </div>
 </> );
  }
  const span = range.max - range.min;
  const step = span / 200;
  const current = value.trim() === "" ? range.usual : Number(value.replace(",", "."));
  const safe = Number.isFinite(current) ? Math.min(range.max, Math.max(range.min, current)) : range.usual;
  const pct = (v: number) => ((v - range.min) / span) * 100;
  const decimals = span < 1 ? 3 : span < 10 ? 2 : 1;
  const fmt = (v: number) => String(Number(v.toFixed(decimals)));

  return (
 <div>
 <div className="flex items-center gap-2">
 <input
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring"
          inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        />
 <input
          type="range"
          className="h-9 flex-1 accent-primary"
          min={range.min} max={range.max} step={step || 0.01}
          value={safe}
          onChange={(e) => onChange(fmt(Number(e.target.value)))}
        />
 </div>
 <div className="relative mt-1 h-4"> {([
          { v: range.min, l: "mín" },
          { v: range.usual, l: "usual" },
          { v: range.max, l: "máx" },
        ] as const).map((t) => (
 <button
            key={t.l}
            type="button"
            onClick={() => onChange(fmt(t.v))}
            style={{ left: `${pct(t.v)}%` }}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
          > {t.l} {fmt(t.v)}
 </button> ))}
 </div>
 </div> );
}

/** Barra horizontal com dois pontos: dose mínima e dose máxima. */
function DoseRangeSlider({
  code, unit, minValue, maxValue, onChangeMin, onChangeMax,
}: {
  code: string;
  unit: DoseUnit;
  minValue: string;
  maxValue: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}) {
  const range = getDoseRange(code, unit);
  const lo = range?.min ?? 0;
  const hi = range?.max ?? 100;
  const span = hi - lo || 1;
  const step = span / 200;
  const decimals = span < 1 ? 3 : span < 10 ? 2 : 1;
  const fmt = (v: number) => String(Number(v.toFixed(decimals)));
  const parse = (s: string, fallback: number) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const vMin = parse(minValue, range?.min ?? lo);
  const vMax = parse(maxValue, range?.usual ?? hi);
  const pct = (v: number) => ((v - lo) / span) * 100;

  return (
 <div>
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1">
 <span className="text-[9px] font-semibold uppercase text-muted-foreground">Mín</span>
 <input
            className="h-9 w-20 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring"
            inputMode="decimal" value={minValue} onChange={(e) => onChangeMin(e.target.value)}
          />
 </div>
 <div className="relative h-9 flex-1">
 <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
 <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/70"
            style={{ left: `${pct(Math.min(vMin, vMax))}%`, width: `${Math.abs(pct(vMax) - pct(vMin))}%` }}
          />
 <input
            type="range" min={lo} max={hi} step={step || 0.01} value={vMin}
            onChange={(e) => onChangeMin(fmt(Math.min(Number(e.target.value), vMax)))}
            className="pointer-events-none absolute inset-0 h-9 w-full appearance-none bg-transparent accent-primary [&::-webkit-slider-thumb]:pointer-events-auto"
          />
 <input
            type="range" min={lo} max={hi} step={step || 0.01} value={vMax}
            onChange={(e) => onChangeMax(fmt(Math.max(Number(e.target.value), vMin)))}
            className="pointer-events-none absolute inset-0 h-9 w-full appearance-none bg-transparent accent-clinical-attention [&::-webkit-slider-thumb]:pointer-events-auto"
          />
 </div>
 <div className="flex items-center gap-1">
 <span className="text-[9px] font-semibold uppercase text-muted-foreground">Máx</span>
 <input
            className="h-9 w-20 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring"
            inputMode="decimal" value={maxValue} onChange={(e) => onChangeMax(e.target.value)}
          />
 </div>
 </div>
 <div className="mt-0.5 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"> {range ? (
 <>
 <button type="button" onClick={() => onChangeMin(fmt(range.min))}>mín {fmt(range.min)}</button>
 <button type="button" onClick={() => onChangeMax(fmt(range.usual))}>usual {fmt(range.usual)}</button>
 <button type="button" onClick={() => onChangeMax(fmt(range.max))}>máx {fmt(range.max)}</button>
 </> ) : (
 <span>Sem faixa de referência cadastrada para {unit}.</span> )}
 </div>
 </div> );
}



function DrugCalculator({
  drug, defaultWeight, patients = [], user, onSaveCustom, onSavePresentation, onRegister, onAddToPatient,
}: {
  drug: DrugDef;
  defaultWeight?: number;
  patients?: DilutionPatient[];
  user: string;
  onAddToPatient?: (patientId: string, med: Medication) => void;
  onSaveCustom: (p: DilutionPreset) => void;
  onSavePresentation: (p: DrugDef["presentation"]) => void;
  onRegister: (r: PrepRecord) => void;
}) {
  const [patientId, setPatientId] = useState<string>("");
  const [dilutionId, setDilutionId] = useState<string>(drug.dilutions[0]?.id ?? "custom");
  const [isCustom, setIsCustom] = useState(false);

  const preset = drug.dilutions.find((d) => d.id === dilutionId);

  const [drugVolumeMl, setDrugVolumeMl] = useState<string>(String(preset?.drugVolumeMl ?? ""));
  const [diluentMl, setDiluentMl] = useState<string>(String(preset?.diluentMl ?? ""));
  const [diluent, setDiluent] = useState<Diluent>(preset?.diluent ?? "SF 0,9%");

  const [ampAmount, setAmpAmount] = useState<string>(String(drug.presentation.amount));
  const [ampUnit, setAmpUnit] = useState<MassUnit>(drug.presentation.unit);
  const [ampVolumeMl, setAmpVolumeMl] = useState<string>(String(drug.presentation.volumeMl));

  const [weight, setWeight] = useState<string>(defaultWeight ? String(defaultWeight) : "");
  const [dose, setDose] = useState<string>("");
  const [doseMin, setDoseMin] = useState<string>("");
  const [doseMax, setDoseMax] = useState<string>("");
  const [doseUnit, setDoseUnit] = useState<DoseUnit>(drug.allowedDoseUnits[0]);
  const [reverseRate, setReverseRate] = useState<string>("");

  const applyPreset = (id: string) => {
    setDilutionId(id);
    if (id === "__custom__") { setIsCustom(true); return; }
    const p = drug.dilutions.find((d) => d.id === id);
    if (!p) return;
    setIsCustom(!!p.custom);
    setDrugVolumeMl(String(p.drugVolumeMl));
    setDiluentMl(String(p.diluentMl));
    setDiluent(p.diluent);
  };

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

  const sol = computeSolution({
    ampAmount: num(ampAmount), ampUnit, ampVolumeMl: num(ampVolumeMl),
    drugVolumeMl: num(drugVolumeMl), diluentMl: num(diluentMl),
  });

  const conc = sol.concBasePerMl != null ? formatConcentration(sol.concBasePerMl, drug.baseUnit) : null;
  const total = sol.totalBase != null
    ? formatConcentration(sol.totalBase, drug.baseUnit)
    : null;

  const rate = computeRate({
    dose: num(dose), unit: doseUnit, weightKg: num(weight), concBasePerMl: sol.concBasePerMl,
  });
  const rateMin = computeRate({
    dose: num(doseMin), unit: doseUnit, weightKg: num(weight), concBasePerMl: sol.concBasePerMl,
  });
  const rateMax = computeRate({
    dose: num(doseMax), unit: doseUnit, weightKg: num(weight), concBasePerMl: sol.concBasePerMl,
  });
  const reverse = computeDoseFromRate({
    rateMlPerHour: num(reverseRate), unit: doseUnit, weightKg: num(weight), concBasePerMl: sol.concBasePerMl,
  });

  const dilLabel = isCustom ? "Personalizada" : preset?.label ?? "—";

  return (
 <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]"> {/* ---------------- Coluna 1 — identificação + diluição ---------------- */}
 <div className="space-y-4">
 <div className="rounded-lg border border-border bg-surface p-4">
 <div className="flex items-center gap-2">
 <Syringe className="h-4 w-4 text-clinical-resp" />
 <h2 className="text-[16px] font-bold text-foreground">{drug.name}</h2>
 <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              isCustom
                ? "border-clinical-attention/50 bg-clinical-attention/10 text-clinical-attention"
                : "border-clinical-stable/50 bg-clinical-stable/10 text-clinical-stable"
            }`}> {isCustom ? "Diluição personalizada" : "Padrão cadastrado"}
 </span>
 </div>
 <div className="mt-1 text-[10px] text-muted-foreground">Fonte do padrão: {DILUTION_SOURCE_NOTE}</div>

 <div className="mt-3">
 <Label>Diluição selecionada</Label>
 <select className={inputCls} value={dilutionId} onChange={(e) => applyPreset(e.target.value)}> {drug.dilutions.map((d) => (
 <option key={d.id} value={d.id}>{d.custom ? "★ " : ""}{d.label}</option> ))}
 <option value="__custom__">➕ Diluição personalizada</option>
 </select> {preset?.note && <div className="mt-1 text-[10px] italic text-muted-foreground">{preset.note}</div>}
 </div>

 <fieldset className="mt-3 rounded-md border border-border p-2">
 <legend className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">Apresentação (ampola/frasco)</legend>
 <div className="grid grid-cols-3 gap-2">
 <div>
 <Label>Quantidade</Label>
 <input className={inputCls} inputMode="decimal" value={ampAmount}
                  onChange={(e) => setAmpAmount(e.target.value)} />
 </div>
 <div>
 <Label>Unidade</Label>
 <select className={inputCls} value={ampUnit} onChange={(e) => setAmpUnit(e.target.value as MassUnit)}> {(["mg", "mcg", "g", "U"] as MassUnit[]).map((u) => <option key={u} value={u}>{u}</option>)}
 </select>
 </div>
 <div>
 <Label>Volume (mL)</Label>
 <input className={inputCls} inputMode="decimal" value={ampVolumeMl}
                  onChange={(e) => setAmpVolumeMl(e.target.value)} />
 </div>
 </div>
 <button
              className="mt-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2"
              onClick={() => {
                const a = num(ampAmount), v = num(ampVolumeMl);
                if (!a || !v) { toast.error("Informe quantidade e volume da apresentação"); return; }
                onSavePresentation({ amount: a, unit: ampUnit, volumeMl: v, label: `${a} ${ampUnit} / ${v} mL` });
                toast.success("Apresentação salva no banco");
              }}
            >
 <Save className="h-3 w-3" /> Salvar apresentação
 </button>
 </fieldset>

 <fieldset className="mt-3 rounded-md border border-border p-2">
 <legend className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">Calculadora de diluição</legend>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <Label>Volume do medicamento (mL)</Label>
 <input className={inputCls} inputMode="decimal" value={drugVolumeMl}
                  onChange={(e) => { setDrugVolumeMl(e.target.value); setIsCustom(true); }} />
 </div>
 <div>
 <Label>Volume do diluente (mL)</Label>
 <input className={inputCls} inputMode="decimal" value={diluentMl}
                  onChange={(e) => { setDiluentMl(e.target.value); setIsCustom(true); }} />
 </div>
 <div className="col-span-2">
 <Label>Diluente</Label>
 <select className={inputCls} value={diluent}
                  onChange={(e) => { setDiluent(e.target.value as Diluent); setIsCustom(true); }}> {DILUENTS.map((d) => <option key={d} value={d}>{d}</option>)}
 </select>
 </div>
 </div>

 <div className="mt-2 flex gap-2">
 <button
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2"
                onClick={() => {
                  const dv = num(drugVolumeMl), di = num(diluentMl);
                  if (dv == null || di == null) { toast.error("Preencha os volumes"); return; }
                  const id = `custom_${Date.now()}`;
                  onSaveCustom({
                    id, custom: true, drugVolumeMl: dv, diluentMl: di, diluent,
                    label: `Personalizada — ${dv} mL + ${di} mL${diluent !== "Sem diluente" ? ` de ${diluent}` : ""}`,
                  });
                  setDilutionId(id);
                }}
              >
 <Plus className="h-3 w-3" /> Salvar como nova diluição
 </button> {preset && (
 <button
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2"
                  onClick={() => applyPreset(preset.id)}
                >
 <RotateCcw className="h-3 w-3" /> Restaurar padrão selecionado
 </button> )}
 </div>
 </fieldset>
 </div> {/* Resultado solução */}
 <div className="grid grid-cols-3 gap-2">
 <Metric label="Volume final" value={sol.finalVolumeMl != null ? `${fmtNum(sol.finalVolumeMl, 0)} mL` : "—"} />
 <Metric label="Quantidade total"
            value={total ? `${fmtNum(total.value)} ${total.unit.replace("/mL", "")}` : "—"} />
 <Metric
            label="Concentração final"
            value={conc ? `${fmtNum(conc.value)} ${conc.unit}` : "—"}
            big
          />
 </div> {sol.missing.length > 0 && <Warn items={sol.missing} />}
 </div> {/* ---------------- Coluna 2 — bomba ---------------- */}
 <div className="space-y-4">
 <div className="rounded-lg border border-border bg-surface p-4">
 <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"> Programação da bomba
 </div>
 <div className="mt-2 grid grid-cols-2 gap-2">
 <div>
 <Label>Paciente internado</Label>
 <select
                className={inputCls}
                value={patientId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPatientId(id);
                  const p = patients.find((x) => x.id === id);
                  if (p?.weight) setWeight(String(p.weight));
                }}
              >
 <option value="">Selecionar paciente…</option> {patients.map((p) => (
 <option key={p.id} value={p.id}> {p.bed} · {p.name}{p.weight ? ` · ${p.weight} kg` : ""}
 </option> ))}
 </select>
 <div className="mt-1 flex items-center gap-1">
 <span className="text-[10px] text-muted-foreground">Peso (kg)</span>
 <input
                  className="h-7 w-20 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
                  inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)}
                />
 </div>
 </div>
 <div>
 <Label>Unidade da prescrição</Label>
 <select className={inputCls} value={doseUnit} onChange={(e) => setDoseUnit(e.target.value as DoseUnit)}> {drug.allowedDoseUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                {(["mcg/h", "mcg/min", "mg/h", "mg/min", "U/h", "U/min", "mL/h"] as DoseUnit[])
                  .filter((u) => !drug.allowedDoseUnits.includes(u))
                  .map((u) => <option key={u} value={u}>{u}</option>)}
 </select>
 </div>
 <div className="col-span-2">
 <Label>Dose prescrita ({doseUnit}) — faixa mín/máx</Label>
 <DoseRangeSlider
                code={drug.code}
                unit={doseUnit}
                minValue={doseMin}
                maxValue={doseMax}
                onChangeMin={(v) => { setDoseMin(v); setDose(v); }}
                onChangeMax={setDoseMax}
              />
 <div className="mt-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-center font-mono text-[11px] text-foreground"> {rateMin.rateMlPerHour != null && rateMax.rateMlPerHour != null
                  ? `${fmtNum(rateMin.rateMlPerHour)} → ${fmtNum(rateMax.rateMlPerHour)} mL/h`
                  : "Faixa de bomba indisponível"}
 </div>
 </div>

 </div>


 <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-4 text-center">
 <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Velocidade da bomba</div> {rate.rateMlPerHour != null ? (
 <div className="font-mono text-4xl font-bold text-primary">{fmtNum(rate.rateMlPerHour)} <span className="text-lg">mL/h</span></div> ) : (
 <div className="text-[12px] font-semibold text-clinical-attention"> Dados insuficientes para calcular a velocidade da bomba.</div> )}
 </div> {rate.missing.length > 0 && <Warn items={rate.missing} />}

 <div className="mt-3 text-[10px] text-muted-foreground"> Confira a sequência: medicamento → apresentação → concentração → diluição → volume final → dose → peso → unidade → velocidade.
 </div>

 <button
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={sol.finalVolumeMl == null || conc == null}
            onClick={() => {
              onRegister({
                id: `p_${Date.now()}`,
                at: new Date().toISOString(),
                user: user || undefined,
                drugCode: drug.code, drugName: drug.name,
                dilutionLabel: dilLabel, custom: isCustom, diluent,
                drugVolumeMl: num(drugVolumeMl) ?? 0,
                diluentMl: num(diluentMl) ?? 0,
                finalVolumeMl: sol.finalVolumeMl!,
                concLabel: `${fmtNum(conc!.value)} ${conc!.unit}`,
                doseLabel: dose ? `${dose} ${doseUnit}` : undefined,
                rateLabel: rate.rateMlPerHour != null ? `${fmtNum(rate.rateMlPerHour)} mL/h` : undefined,
              });
              toast.success("Preparo registrado no histórico");
            }}
          >
 <Save className="h-3 w-3" /> Registrar preparo
 </button>

 <button
            className="ml-2 mt-3 inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
            disabled={!patientId || sol.finalVolumeMl == null || conc == null}
            onClick={() => {
              if (!patientId) { toast.error("Selecione o paciente"); return; }
              const concMcgPerMl = sol.concBasePerMl ?? undefined;
              const totalBase = sol.totalBase ?? 0;
              onAddToPatient?.(patientId, {
                name: drug.name,
                dose: doseMin || doseMax
                  ? `${doseMin || "—"} – ${doseMax || "—"} ${doseUnit}`
                  : `${dose || "—"} ${doseUnit}`,
                route: "EV (BIC)",
                freq: "contínuo",
                start: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                kind: "resp",
                active: true,
                class: "pump",
                mlPerHour: rate.rateMlPerHour ?? undefined,
                doseMinValue: num(doseMin),
                doseMaxValue: num(doseMax),
                doseRangeUnit: doseUnit,
                mlPerHourMin: rateMin.rateMlPerHour ?? undefined,
                mlPerHourMax: rateMax.rateMlPerHour ?? undefined,
                pump: {
                  mode: "continua",
                  solvent: diluent === "SG 5%" ? "SG 5%" : "SF 0,9%",
                  pumpDrugName: `${drug.name} — ${dilLabel}`,
                  drugAmountMg: drug.baseUnit === "U" ? totalBase : totalBase / 1000,
                  finalVolumeMl: sol.finalVolumeMl!,
                  concentrationMcgPerMl: concMcgPerMl,
                  targetDoseValue: num(doseMin) ?? num(dose),
                  rateMlPerHour: rate.rateMlPerHour ?? undefined,
                  bagVolumeMl: sol.finalVolumeMl!,
                  bagStartedAt: new Date().toISOString(),
                  status: "running",
                },
              });
              toast.success("Medicamento adicionado ao paciente");
            }}
          >
 <Plus className="h-3 w-3" /> Adicionar ao paciente
 </button>
 </div> {/* Cálculo reverso */}
 <div className="rounded-lg border border-border bg-surface p-4">
 <div className="text-[13px] font-semibold text-foreground"> Qual dose o paciente está recebendo?</div>
 <div className="mt-2 grid grid-cols-2 gap-2">
 <div>
 <Label>Velocidade da bomba (mL/h)</Label>
 <input className={inputCls} inputMode="decimal" value={reverseRate}
                onChange={(e) => setReverseRate(e.target.value)} />
 </div>
 <div>
 <Label>Peso (kg)</Label>
 <input className={inputCls} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
 </div>
 </div>
 <div className="mt-2 rounded-md border border-border bg-surface-2 p-3 text-center"> {reverse.dose != null ? (
 <div className="font-mono text-2xl font-bold text-foreground"> {fmtNum(reverse.dose, 3)} <span className="text-sm">{doseUnit}</span>
 </div> ) : (
 <div className="text-[11px] text-clinical-attention"> Dados insuficientes para calcular a dose.</div> )}
 </div> {reverse.missing.length > 0 && <Warn items={reverse.missing} />}
 </div>
 </div>
 </div> );
}

function Metric({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
 <div className="rounded-lg border border-border bg-surface p-3 text-center">
 <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
 <div className={`font-mono font-bold text-foreground ${big ? "text-2xl" : "text-lg"}`}>{value}</div>
 </div> );
}

function Warn({ items }: { items: string[] }) {
  return (
 <div className="rounded-md border border-clinical-attention/40 bg-clinical-attention/10 p-2 text-[11px]">
 <div className="flex items-center gap-1 font-semibold text-clinical-attention">
 <AlertTriangle className="h-3 w-3" /> Verifique os dados
 </div>
 <ul className="mt-1 list-disc pl-5 text-foreground"> {items.map((m) => <li key={m}>{m}</li>)}
 </ul>
 </div> );
}

// ============================================================================
// Histórico
// ============================================================================

function HistoryPanel({
  history, onClear, onDuplicate,
}: { history: PrepRecord[]; onClear: () => void; onDuplicate: (r: PrepRecord) => void }) {
  if (!history.length) {
    return <div className="p-8 text-center text-[12px] text-muted-foreground">Nenhum preparo registrado.</div>;
  }
  return (
 <div className="space-y-2">
 <div className="flex justify-end">
 <button onClick={onClear} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2"> Limpar histórico
 </button>
 </div>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-[11px]">
 <thead className="bg-surface-2 text-left">
 <tr> {["Data/hora", "Medicamento", "Diluição", "Tipo", "Diluente", "Vol. final", "Concentração", "Dose", "Bomba", "Responsável", ""].map((h) => (
 <th key={h} className="px-2 py-1.5 font-semibold text-muted-foreground">{h}</th> ))}
 </tr>
 </thead>
 <tbody> {history.map((r) => (
 <tr key={r.id} className="border-t border-border">
 <td className="px-2 py-1 font-mono">{new Date(r.at).toLocaleString("pt-BR")}</td>
 <td className="px-2 py-1 font-semibold">{r.drugName}</td>
 <td className="px-2 py-1">{r.drugVolumeMl} mL + {r.diluentMl} mL</td>
 <td className="px-2 py-1">{r.custom ? "Personalizada" : "Padrão"}</td>
 <td className="px-2 py-1">{r.diluent}</td>
 <td className="px-2 py-1 font-mono">{r.finalVolumeMl} mL</td>
 <td className="px-2 py-1 font-mono">{r.concLabel}</td>
 <td className="px-2 py-1 font-mono">{r.doseLabel ?? "—"}</td>
 <td className="px-2 py-1 font-mono font-bold">{r.rateLabel ?? "—"}</td>
 <td className="px-2 py-1">{r.user ?? "—"}</td>
 <td className="px-2 py-1">
 <button onClick={() => onDuplicate(r)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-surface-2">
 <Copy className="h-3 w-3" /> Duplicar
 </button>
 </td>
 </tr> ))}
 </tbody>
 </table>
 </div>
 </div> );
}

// ============================================================================
// Banco administrativo
// ============================================================================

function BankPanel({
  drugs, overrides, audit, onToggleDilution, onRestore, onEditDilution,
}: {
  drugs: DrugDef[];
  overrides: Record<string, DrugOverride>;
  audit: AuditEntry[];
  onToggleDilution: (code: string, id: string, disable: boolean) => void;
  onRestore: (code: string) => void;
  onEditDilution: (code: string, base: DilutionPreset, next: { drugVolumeMl: number; diluentMl: number; diluent: Diluent }) => void;
}) {
  return (
 <div className="space-y-4">
 <div className="text-[11px] text-muted-foreground"> ⚙ Banco de diluições — {DILUTION_SOURCE_NOTE}
 </div> {drugs.map((d) => {
        const disabled = new Set(overrides[d.code]?.disabled ?? []);
        return (
 <div key={d.code} className="rounded-lg border border-border bg-surface p-3">
 <div className="flex items-center gap-2">
 <div className="text-[13px] font-semibold text-foreground">{d.name}</div>
 <div className="font-mono text-[11px] text-muted-foreground">Apresentação: {d.presentation.label}</div>
 <button
                onClick={() => onRestore(d.code)}
                className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2"
              >
 <RotateCcw className="h-3 w-3" /> Restaurar padrão
 </button>
 </div>
 <ul className="mt-2 space-y-1"> {[...d.dilutions, ...(overrides[d.code]?.customDilutions ?? []).filter((c) => disabled.has(c.id))]
                .map((p) => (
 <BankDilutionRow
                    key={p.id}
                    preset={p}
                    disabled={disabled.has(p.id)}
                    onToggle={(disable) => onToggleDilution(d.code, p.id, disable)}
                    onSave={(next) => onEditDilution(d.code, p, next)}
                  /> ))}
 </ul>
 </div> );
      })}


 <div className="rounded-lg border border-border bg-surface p-3">
 <div className="text-[12px] font-semibold text-foreground">Registro de alterações</div> {!audit.length ? (
 <div className="mt-1 text-[11px] text-muted-foreground">Nenhuma alteração registrada.</div> ) : (
 <ul className="mt-1 space-y-0.5 text-[11px]"> {audit.map((a, i) => (
 <li key={i} className="font-mono text-muted-foreground"> {new Date(a.at).toLocaleString("pt-BR")} · {a.drugCode} · {a.field}: {a.before} → {a.after}
                {a.user ? ` · ${a.user}` : ""}
 </li> ))}
 </ul> )}
 </div>
 </div> );
}

function BankDilutionRow({
  preset, disabled, onToggle, onSave,
}: {
  preset: DilutionPreset;
  disabled: boolean;
  onToggle: (disable: boolean) => void;
  onSave: (next: { drugVolumeMl: number; diluentMl: number; diluent: Diluent }) => void;
}) {
  const [drugVol, setDrugVol] = useState(String(preset.drugVolumeMl));
  const [dilVol, setDilVol] = useState(String(preset.diluentMl));
  const [diluent, setDiluent] = useState<Diluent>(preset.diluent);

  const dirty =
    Number(drugVol.replace(",", ".")) !== preset.drugVolumeMl ||
    Number(dilVol.replace(",", ".")) !== preset.diluentMl ||
    diluent !== preset.diluent;

  const smallInput =
 "h-7 w-16 rounded border border-input bg-background px-1 text-center font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring";

  return (
 <li className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-surface-2/40 px-2 py-1 text-[11px]">
 <input type="checkbox" checked={!disabled} onChange={(e) => onToggle(!e.target.checked)} />
 <span className={`min-w-[9rem] flex-1 ${disabled ? "text-muted-foreground line-through" : "text-foreground"}`}> {preset.label}
 </span>
 <input className={smallInput} inputMode="decimal" value={drugVol}
        onChange={(e) => setDrugVol(e.target.value)} title="Volume do medicamento (mL)" />
 <span className="text-muted-foreground">mL +</span>
 <input className={smallInput} inputMode="decimal" value={dilVol}
        onChange={(e) => setDilVol(e.target.value)} title="Volume do diluente (mL)" />
 <span className="text-muted-foreground">mL de</span>
 <select
        className="h-7 rounded border border-input bg-background px-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
        value={diluent}
        onChange={(e) => setDiluent(e.target.value as Diluent)}
      > {DILUENTS.map((d) => <option key={d} value={d}>{d}</option>)}
 </select>
 <button
        disabled={!dirty}
        onClick={() => {
          const dv = Number(drugVol.replace(",", ".")), di = Number(dilVol.replace(",", "."));
          if (!Number.isFinite(dv) || dv <= 0 || !Number.isFinite(di) || di < 0) {
            toast.error("Volumes inválidos");
            return;
          }
          onSave({ drugVolumeMl: dv, diluentMl: di, diluent });
        }}
        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-surface-2 disabled:opacity-40"
      >
 <Save className="h-3 w-3" /> Salvar
 </button> {preset.custom && <span className="rounded bg-clinical-attention/10 px-1 text-[9px] text-clinical-attention">personalizada</span>}
 </li> );
}
