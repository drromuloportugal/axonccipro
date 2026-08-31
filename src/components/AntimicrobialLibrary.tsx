import { useMemo, useState } from "react";
import { Plus, Search, ShieldAlert } from "lucide-react";
import {
  ANTIMICROBIAL_LIBRARY, awareMeta, type AntimicrobialDrug,
} from "@/data/antimicrobials";
import type { Medication } from "@/data/patients";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const inputCls =
 "h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export interface AntimicrobialPatient { id: string; name: string; bed: string }

/** Aba "Antimicrobianos" da FARMÁCIA — catálogo por classe, dose e duração editáveis. */
export function AntimicrobialLibrary({
  patients = [],
  onAddToPatient,
}: {
  patients?: AntimicrobialPatient[];
  onAddToPatient?: (patientId: string, med: Medication) => void;
}) {
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState(ANTIMICROBIAL_LIBRARY[0].id);
  const [sel, setSel] = useState<AntimicrobialDrug | null>(null);
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState("");
  const [days, setDays] = useState(7);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");

  const group = ANTIMICROBIAL_LIBRARY.find((g) => g.id === groupId)!;

  const classes = useMemo(() => {
    const q = norm(query.trim());
    const src = q
      ? ANTIMICROBIAL_LIBRARY.flatMap((g) => g.classes)
      : group.classes;
    if (!q) return src;
    return src
      .map((c) => ({ ...c, drugs: c.drugs.filter((d) => norm(d.name).includes(q)) }))
      .filter((c) => c.drugs.length > 0);
  }, [query, group]);

  const pick = (d: AntimicrobialDrug) => {
    setSel(d);
    setDose(d.dose);
    setFreq(d.freq);
    setDays(d.days);
  };

  const add = () => {
    if (!sel || !patientId || !onAddToPatient) return;
    const start = new Date();
    const end = new Date(start.getTime() + days * 86400000);
    const med: Medication = {
      name: sel.name,
      dose,
      route: sel.route ?? "EV",
      freq,
      start: start.toLocaleDateString("pt-BR"),
      kind: "attention",
      active: true,
      class: "antibiotic",
      isAntibiotic: true,
      startISO: start.toISOString(),
      plannedEndISO: end.toISOString(),
    } as Medication;
    onAddToPatient(patientId, med);
    toast.success(`${sel.name} adicionado ao paciente`);
  };

  return (
 <div className="flex min-h-0 flex-1 flex-col">
 <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
 <div className="relative">
 <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
 <input
            className="h-8 w-56 rounded-md border border-input bg-background pl-7 pr-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
            placeholder="Buscar antimicrobiano"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
 </div>
        {ANTIMICROBIAL_LIBRARY.map((g) => (
 <button
            key={g.id}
            onClick={() => { setGroupId(g.id); setQuery(""); }}
            className={`rounded-md border px-2.5 py-1 text-[11px] ${
              groupId === g.id && !query
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-2"
            }`}
          >
            {g.icon} {g.label}
 </button>
        ))}
 </div>

 <div className="flex min-h-0 flex-1">
 <div className="min-h-0 flex-1 overflow-y-auto p-4">
 <div className="space-y-4">
            {classes.map((c) => (
 <div key={c.id} className="rounded-md border border-border bg-surface">
 <div className="border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.label}
 </div>
 <ul className="divide-y divide-border">
                  {c.drugs.map((dr) => {
                    const a = awareMeta(dr.aware);
                    return (
 <li key={dr.name + c.id}>
 <button
                          onClick={() => pick(dr)}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface-2 ${
                            sel?.name === dr.name ? "bg-primary/5" : ""
                          }`}
                        >
 <span className="flex-1 font-semibold text-foreground">{dr.name}</span>
 <span className="text-[11px] text-muted-foreground">{dr.dose} · {dr.freq} · {dr.days}d</span>
 <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${a.className}`}>{a.label}</span>
 </button>
 </li>
                    );
                  })}
 </ul>
 </div>
            ))}
            {classes.length === 0 && (
 <div className="text-[12px] text-muted-foreground">Nenhum antimicrobiano encontrado.</div>
            )}
 </div>
 </div>

 <aside className="w-80 shrink-0 space-y-3 overflow-y-auto border-l border-border bg-surface-2/40 p-3">
 <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prescrição
 </div>
          {!sel && <div className="text-[12px] text-muted-foreground">Selecione um antimicrobiano na lista.</div>}
          {sel && (
 <>
 <div className="rounded-md border border-border bg-background p-2">
 <div className="text-[13px] font-semibold">{sel.name}</div>
 <div className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${awareMeta(sel.aware).className}`}>
                  AWaRe {awareMeta(sel.aware).label}
 </div>
                {sel.renal && (
 <div className="mt-1 flex items-center gap-1 text-[10px] text-clinical-attention">
 <ShieldAlert className="h-3 w-3" /> Requer ajuste por função renal
 </div>
                )}
 </div>
 <div>
 <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Dose</div>
 <input className={inputCls} value={dose} onChange={(e) => setDose(e.target.value)} />
 </div>
 <div>
 <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Intervalo</div>
 <input className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value)} />
 </div>
 <div>
 <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Duração (dias)</div>
 <input type="number" min={1} max={365} className={inputCls} value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 1)} />
 </div>
 <div>
 <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Paciente</div>
 <select className={inputCls} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
 <option value="">— selecione —</option>
                  {patients.map((p) => (
 <option key={p.id} value={p.id}>{p.bed} · {p.name}</option>
                  ))}
 </select>
 </div>
 <Button size="sm" className="w-full" disabled={!patientId} onClick={add}>
 <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar ao paciente
 </Button>
 <div className="text-[10px] text-muted-foreground">
                Doses de referência para adulto com função renal normal — revisar sempre antes da prescrição.
 </div>
 </>
          )}
 </aside>
 </div>
 </div>
  );
}
