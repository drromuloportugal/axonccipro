import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { LPPLesion, LPPStage, LPPView, LPPSide, LPPEvolution } from "@/data/patients";
import { LPP_SITES, LPP_SITE_BY_KEY, STAGE_META } from "@/lib/lpp";

const STAGES: LPPStage[] = ["1", "2", "3", "4", "NC", "LTP"];

const inputCls =
 "w-full rounded-md border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-primary";
const lblCls =
 "block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1";

const PROF_LS_KEY = "lpp.lastProfessional";

interface Seed {
  view: LPPView; site: string; siteLabel: string; x?: number; y?: number;
}

interface Props {
  open: boolean;
  editing: LPPLesion | null;
  seed: Seed | null;
  onClose: () => void;
  onSave: (l: LPPLesion) => void;
  onDelete?: (id: string) => void;
}

const nowParts = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
const toISO = (date: string, time: string) => new Date(`${date}T${time || "00:00"}:00`).toISOString();
const splitISO = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

export function PressureInjuryForm({ open, editing, seed, onClose, onSave, onDelete }: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [professional, setProfessional] = useState("");
  const [site, setSite] = useState("sacro");
  const [count, setCount] = useState(1);
  const [stage, setStage] = useState<LPPStage>("2");
  const [notes, setNotes] = useState("");
  const [resolved, setResolved] = useState(false);
  const [evolutions, setEvolutions] = useState<LPPEvolution[]>([]);
  const [showEvo, setShowEvo] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const p = splitISO(editing.identifiedAt);
      setDate(p.date); setTime(p.time);
      setProfessional(editing.professional);
      setSite(editing.site);
      setCount(editing.count);
      setStage(editing.stage);
      setNotes(editing.notes ?? "");
      setResolved(!!editing.resolvedAt);
      setEvolutions(editing.evolutions ?? []);
      setShowEvo(true);
    } else {
      const n = nowParts();
      setDate(n.date); setTime(n.time);
      const remembered = typeof window !== "undefined" ? window.localStorage.getItem(PROF_LS_KEY) ?? "" : "";
      setProfessional(remembered);
      setSite(seed?.site && seed.site !== "livre" ? seed.site : "sacro");
      setCount(1); setStage("2"); setNotes(""); setResolved(false);
      setEvolutions([]); setShowEvo(false);
    }
  }, [open, editing, seed]);

  const siteDef = LPP_SITE_BY_KEY[site];
  const resolvedSiteLabel = siteDef?.label ?? "Livre";
  const resolvedView: LPPView = siteDef?.view ?? "posterior";
  const resolvedSide: LPPSide = siteDef?.side ?? "central";

  const grouped = useMemo(() => {
    const m: Record<string, typeof LPP_SITES> = {};
    for (const s of LPP_SITES) (m[s.region] ??= []).push(s);
    return m;
  }, []);

  const canSave = !!professional.trim() && !!date && !!site;

  const save = () => {
    if (!canSave) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROF_LS_KEY, professional.trim());
    }
    const lesion: LPPLesion = {
      id: editing?.id ?? `lpp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      identifiedAt: toISO(date, time),
      professional: professional.trim(),
      site,
      siteLabel: resolvedSiteLabel,
      view: resolvedView,
      side: resolvedSide,
      count: Math.max(1, count),
      stage,
      x: editing?.x ?? seed?.x,
      y: editing?.y ?? seed?.y,
      notes: notes.trim() || undefined,
      evolutions: evolutions.length ? evolutions : undefined,
      resolvedAt: resolved ? (editing?.resolvedAt ?? new Date().toISOString()) : undefined,
    };
    onSave(lesion);
  };

  return (
 <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
 <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"> {editing ? "Editar lesão por pressão" : "Nova lesão por pressão"}
 </DialogTitle>
 </DialogHeader> {/* Stage — biggest, primary control */}
 <div>
 <label className={lblCls}>Estágio</label>
 <div className="grid grid-cols-6 gap-1.5"> {STAGES.map((s) => {
              const meta = STAGE_META[s];
              const active = stage === s;
              return (
 <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={`rounded-md border-2 px-1 py-2 text-center text-[13px] font-bold transition-all ${active ? "scale-[1.02] shadow-md" : "border-border opacity-70 hover:opacity-100"}`}
                  style={{
                    borderColor: active ? meta.color : undefined,
                    background: active ? `${meta.color}22` : undefined,
                    color: meta.color,
                  }}
                  title={meta.label}
                > {meta.short}
 </button> );
            })}
 </div>
 <div className="mt-1 text-[10px] text-muted-foreground">{STAGE_META[stage].label}</div>
 </div> {/* Site + count */}
 <div className="mt-2 grid grid-cols-[1fr_90px] gap-3">
 <div>
 <label className={lblCls}>Local anatômico</label>
 <select className={inputCls} value={site} onChange={(e) => setSite(e.target.value)}> {(["Pelve", "Tronco", "MMII", "Cabeça", "MMSS"] as const).map((reg) => (
 <optgroup key={reg} label={reg}> {(grouped[reg] ?? []).map((s) => (
 <option key={s.key} value={s.key}> {s.label}
 </option> ))}
 </optgroup> ))}
 </select>
 <div className="mt-1 text-[10px] text-muted-foreground"> {resolvedView === "posterior" ? "Vista posterior"
                : resolvedView === "anterior" ? "Vista anterior"
                : resolvedView === "lateral_d" ? "Vista lateral D" : "Vista lateral E"}
              {resolvedSide && resolvedSide !== "central" && ` · ${resolvedSide === "D" ? "Direita" : "Esquerda"}`}
 </div>
 </div>
 <div>
 <label className={lblCls}>Qtd.</label>
 <input type="number" min={1} max={20} className={inputCls}
              value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
 </div>
 </div> {/* Date + time + professional */}
 <div className="mt-2 grid grid-cols-[110px_90px_1fr] gap-2">
 <div>
 <label className={lblCls}>Data</label>
 <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
 </div>
 <div>
 <label className={lblCls}>Hora</label>
 <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
 </div>
 <div>
 <label className={lblCls}>Profissional*</label>
 <input className={inputCls} value={professional}
              onChange={(e) => setProfessional(e.target.value)} placeholder="Ex.: Enf. Paula" />
 </div>
 </div> {/* Notes */}
 <div className="mt-2">
 <label className={lblCls}>Observações <span className="text-muted-foreground/60 normal-case">(opcional)</span></label>
 <textarea className={inputCls} rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aspecto, conduta de curativo, etc." />
 </div>

 <label className="mt-1 flex items-center gap-2 text-[12px]">
 <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> Lesão resolvida
 </label> {/* Evolutions — collapsed by default; visible on edit */}
 <button
          type="button"
          onClick={() => setShowEvo((v) => !v)}
          className="mt-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        > {showEvo ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Evoluções {evolutions.length > 0 && <span className="text-foreground">({evolutions.length})</span>}
 </button> {showEvo && (
 <div className="rounded-md border border-border bg-surface-2/40 p-2">
 <ul className="space-y-1"> {evolutions.length === 0 && (
 <li className="text-[11px] text-muted-foreground">Sem evoluções registradas.</li> )}
              {evolutions.map((ev, i) => (
 <li key={i} className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1 text-[11px]">
 <span style={{ color: STAGE_META[ev.stage].color }} className="font-semibold">{STAGE_META[ev.stage].short}</span>
 <span className="text-muted-foreground">{new Date(ev.at).toLocaleDateString("pt-BR")}</span>
 <span className="flex-1 truncate">{ev.professional}{ev.notes ? ` — ${ev.notes}` : ""}</span>
 <button onClick={() => setEvolutions(evolutions.filter((_, k) => k !== i))}
                    className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive">
 <Trash2 className="h-3 w-3" />
 </button>
 </li> ))}
 </ul>
 <EvolutionAdder defaultStage={stage} defaultProf={professional} onAdd={(ev) => setEvolutions([...evolutions, ev])} />
 </div> )}

 <DialogFooter className="mt-3 flex-row items-center justify-between gap-2 sm:justify-between">
 <div> {editing && onDelete && (
 <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                onClick={() => { onDelete(editing.id); onClose(); }}>
 <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
 </Button> )}
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={onClose}>Cancelar</Button>
 <Button onClick={save} disabled={!canSave}> {editing ? "Salvar" : "Registrar"}
 </Button>
 </div>
 </DialogFooter>
 </DialogContent>
 </Dialog> );
}

function EvolutionAdder({ defaultStage, defaultProf, onAdd }: {
  defaultStage: LPPStage; defaultProf: string;
  onAdd: (ev: LPPEvolution) => void;
}) {
  const [s, setS] = useState<LPPStage>(defaultStage);
  const [prof, setProf] = useState(defaultProf);
  const [n, setN] = useState("");
  useEffect(() => { setS(defaultStage); }, [defaultStage]);
  useEffect(() => { setProf(defaultProf); }, [defaultProf]);
  return (
 <div className="mt-2 grid grid-cols-[80px_1fr_1fr_auto] gap-1.5">
 <select className={inputCls} value={s} onChange={(e) => setS(e.target.value as LPPStage)}> {STAGES.map((x) => <option key={x} value={x}>{STAGE_META[x].short}</option>)}
 </select>
 <input className={inputCls} placeholder="Profissional" value={prof} onChange={(e) => setProf(e.target.value)} />
 <input className={inputCls} placeholder="Notas" value={n} onChange={(e) => setN(e.target.value)} />
 <Button size="sm" variant="outline" onClick={() => {
        if (!prof.trim()) return;
        onAdd({ at: new Date().toISOString(), stage: s, professional: prof.trim(), notes: n.trim() || undefined });
        setN("");
      }}>
 <Plus className="mr-1 h-3 w-3" />Add
 </Button>
 </div> );
}
