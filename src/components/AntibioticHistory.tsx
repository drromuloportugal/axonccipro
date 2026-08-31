import { useMemo } from "react";
import type { Patient, Medication } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { detectAntibiotic } from "@/lib/clinical";

const inputCls =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring";

function isoToInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function inputToISO(v: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Histórico de antimicrobianos administrados, com edição das datas. */
export function AntibioticHistory({
  open, onOpenChange, patient, onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  onUpdate?: (p: Patient) => void;
}) {
  const rows = useMemo(
    () =>
      patient.medications
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.isAntibiotic ?? detectAntibiotic(m.name)),
    [patient.medications],
  );

  const patch = (index: number, p: Partial<Medication>) => {
    if (!onUpdate) return;
    onUpdate({
      ...patient,
      medications: patient.medications.map((x, idx) => (idx === index ? { ...x, ...p } : x)),
    });
  };

  const inUse = rows.filter(({ m }) => m.active !== false);
  const past = rows.filter(({ m }) => m.active === false);

  const Row = ({ m, i }: { m: Medication; i: number }) => (
    <li className="rounded-md border border-border bg-surface p-2 text-[12px]">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex-1 font-semibold text-foreground">
          💉 {m.name} {m.dose ? `· ${m.dose}` : ""} {m.freq ? `· ${m.freq}` : ""}
        </span>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={m.active !== false}
            onChange={(e) => patch(i, { active: e.target.checked })}
          />
          Em uso
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Início</div>
          <input
            type="datetime-local"
            className={inputCls}
            value={isoToInput(m.startISO)}
            onChange={(e) => patch(i, { startISO: inputToISO(e.target.value) })}
          />
        </div>
        <div>
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Término previsto</div>
          <input
            type="datetime-local"
            className={inputCls}
            value={isoToInput(m.plannedEndISO)}
            onChange={(e) => patch(i, { plannedEndISO: inputToISO(e.target.value) })}
          />
        </div>
        <div>
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Doses administradas</div>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={m.dosesGiven ?? 0}
            onChange={(e) => patch(i, { dosesGiven: Number(e.target.value) })}
          />
        </div>
      </div>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de antimicrobianos · {patient.name}</DialogTitle>
        </DialogHeader>

        {rows.length === 0 && (
          <div className="text-[12px] text-muted-foreground">Nenhum antimicrobiano registrado para este paciente.</div>
        )}

        {inUse.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-clinical-attention">Em curso</div>
            <ul className="space-y-2">{inUse.map(({ m, i }) => <Row key={i} m={m} i={i} />)}</ul>
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Já administrados
            </div>
            <ul className="space-y-2">{past.map(({ m, i }) => <Row key={i} m={m} i={i} />)}</ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
