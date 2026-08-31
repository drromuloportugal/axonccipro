import { useEffect, useMemo, useState } from "react";
import type { Patient, DischargeCheck, DischargeBlockerId, DischargeDeviceRow } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DischargeReportModal } from "@/components/DischargeReport";
import {
  Activity, Brain, Stethoscope, Pill, Utensils, Cable, Footprints,
  ClipboardList, Users, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, FileText,
} from "lucide-react";

// ---------- Blockers ----------
const BLOCKER_META: { id: DischargeBlockerId; label: string }[] = [
  { id: "gcs_drop", label: "Deterioração neurológica / Glasgow em queda" },
  { id: "seizure", label: "Convulsão não controlada" },
  { id: "dva", label: "Droga vasoativa em uso" },
  { id: "hemo_instability", label: "Instabilidade hemodinâmica" },
  { id: "resp_failure", label: "Insuficiência respiratória" },
  { id: "airway_unprotected", label: "Via aérea não protegida" },
  { id: "metab_severe", label: "Distúrbio metabólico grave" },
  { id: "active_bleeding", label: "Sangramento ativo" },
  { id: "urgent_procedure", label: "Procedimento emergencial pendente" },
  { id: "incompatible_device", label: "Dispositivo incompatível com enfermaria" },
  { id: "no_ward_structure", label: "Estrutura inadequada na unidade receptora" },
];

// Auto-detect blockers from patient state
function detectAutoBlockers(p: Patient): DischargeBlockerId[] {
  const auto: DischargeBlockerId[] = [];
  if (p.state?.dva && String(p.state.dva).trim().length > 0) auto.push("dva");
  const vent = (p.state?.vent ?? "").toLowerCase();
  if (vent.includes("vm") || vent.includes("iot") || vent.includes("ecmo")) {
    auto.push("vent_invasive" as DischargeBlockerId);
    auto.push("airway_unprotected");
  }
  if (typeof p.state?.glasgow === "number" && p.state.glasgow <= 8) auto.push("gcs_drop");
  return auto;
}

// ---------- Progress ----------
function computeProgress(dc: DischargeCheck): number {
  let total = 0, done = 0;
  const bools = [
    dc.stability?.neuro, dc.stability?.hemo, dc.stability?.resp, dc.stability?.metab,
    dc.meds?.conciliation, dc.meds?.anticoag, dc.meds?.antiplt,
    dc.meds?.anticonv, dc.meds?.abx, dc.meds?.critical,
    dc.nutrition?.oral, dc.nutrition?.sne, dc.nutrition?.gtt, dc.nutrition?.fono, dc.nutrition?.aspRisk,
    dc.functionality?.mobility, dc.functionality?.physio, dc.functionality?.fallRisk,
    dc.functionality?.lpp, dc.functionality?.needsHelp,
    dc.communication?.medSummary, dc.communication?.medHandoff, dc.communication?.nurseHandoff,
    dc.communication?.family, dc.communication?.receivingTeam, dc.communication?.rxReviewed,
  ];
  for (const b of bools) { total++; if (b !== undefined) done++; }
  const strs = [
    dc.neuro?.pupils, dc.neuro?.deficits,
    dc.diagnosis?.dx, dc.diagnosis?.procedures, dc.diagnosis?.lastImaging,
    dc.pendencies?.lab, dc.pendencies?.imaging, dc.pendencies?.consults,
  ];
  for (const s of strs) { total++; if (s && s.trim().length > 0) done++; }
  const nums = [dc.neuro?.glasgow];
  for (const n of nums) { total++; if (typeof n === "number") done++; }
  if (dc.finalization?.fit) { done += 2; total += 2; } else { total += 2; }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export type DischargeStatus = "none" | "progress" | "ready" | "blocked";

export function dischargeStatus(p: Patient): { status: DischargeStatus; pct: number; blockers: DischargeBlockerId[] } {
  const dc = p.dischargeCheck;
  const autoBlockers = detectAutoBlockers(p);
  const stabilityFail: DischargeBlockerId[] = [];
  if (dc?.stability) {
    if (dc.stability.neuro === false) stabilityFail.push("gcs_drop");
    if (dc.stability.hemo === false) stabilityFail.push("hemo_instability");
    if (dc.stability.resp === false) stabilityFail.push("resp_failure");
    if (dc.stability.metab === false) stabilityFail.push("metab_severe");
  }
  const blockers = Array.from(new Set([...(dc?.blockers ?? []), ...autoBlockers, ...stabilityFail]));
  if (!dc || Object.keys(dc).length === 0) {
    return { status: blockers.length ? "blocked" : "none", pct: 0, blockers };
  }
  const pct = computeProgress(dc);
  if (blockers.length > 0) return { status: "blocked", pct, blockers };
  if (dc.finalization?.fit === "sim" && pct >= 85) return { status: "ready", pct, blockers };
  return { status: "progress", pct, blockers };
}

// ---------- UI primitives ----------
function CheckRow({
  label, value, onChange, danger,
}: { label: string; value?: boolean; onChange: (v: boolean | undefined) => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-surface px-2.5 py-1.5">
      <span className={`text-[12px] ${danger && value === false ? "text-clinical-critical font-semibold" : "text-foreground"}`}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(value === true ? undefined : true)}
          className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            value === true ? "bg-clinical-stable/25 text-clinical-stable" : "text-muted-foreground hover:bg-surface-3"
          }`}
        >Sim</button>
        <button
          type="button"
          onClick={() => onChange(value === false ? undefined : false)}
          className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            value === false ? "bg-clinical-critical/25 text-clinical-critical" : "text-muted-foreground hover:bg-surface-3"
          }`}
        >Não</button>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, area, placeholder,
}: { label: string; value?: string; onChange: (v: string) => void; area?: boolean; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {area ? (
        <textarea
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          rows={2}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary"
        />
      ) : (
        <input
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-primary"
        />
      )}
    </label>
  );
}

function NumField({
  label, value, onChange, min, max, placeholder,
}: { label: string; value?: number; onChange: (v: number | undefined) => void; min?: number; max?: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <input
        type="number" min={min} max={max} value={value ?? ""} placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value === "" ? undefined : Number(e.target.value);
          onChange(Number.isFinite(v as number) ? (v as number) : undefined);
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-primary"
      />
    </label>
  );
}

function Card({
  n, title, icon: Icon, done, children, defaultOpen,
}: {
  n: number; title: string; icon: React.ComponentType<{ className?: string }>;
  done?: boolean; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <section className="rounded-lg border border-border-strong bg-surface-2 shadow-sm">
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-t-lg border-b border-border px-3 py-2 hover:bg-surface-3"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="grid h-5 w-5 place-items-center rounded bg-surface-3 font-mono text-[10px] font-bold text-muted-foreground">{n}</span>
        <Icon className="h-4 w-4 text-clinical-resp" />
        <span className="flex-1 text-left text-[13px] font-semibold text-foreground">{title}</span>
        {done && <CheckCircle2 className="h-4 w-4 text-clinical-stable" />}
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}

// ---------- Main component ----------
export function DischargeCheckModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const [dc, setDc] = useState<DischargeCheck>(patient.dischargeCheck ?? {});

  useEffect(() => {
    if (open) setDc(patient.dischargeCheck ?? {});
  }, [open, patient.id, patient.dischargeCheck]);

  // Autofill from patient chart on first open
  useEffect(() => {
    if (!open) return;
    setDc((prev) => {
      const next: DischargeCheck = { ...prev };
      next.neuro = { ...(next.neuro ?? {}) };
      if (next.neuro.glasgow === undefined && typeof patient.state?.glasgow === "number") {
        next.neuro.glasgow = patient.state.glasgow;
      }
      next.diagnosis = { ...(next.diagnosis ?? {}) };
      if (!next.diagnosis.dx && patient.diagnoses?.length) {
        next.diagnosis.dx = patient.diagnoses.map((d) => d.label).join("; ");
      }
      if (!next.devices) {
        next.devices = (patient.devices ?? [])
          .filter((d) => !d.removedAt)
          .map<DischargeDeviceRow>((d) => ({ id: d.id ?? crypto.randomUUID(), name: d.typeCode }));
      }
      if (!next.startedAt) next.startedAt = new Date().toISOString();
      return next;
    });
  }, [open, patient]);

  // Autosave (debounced light)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSave({ ...patient, dischargeCheck: { ...dc, updatedAt: new Date().toISOString() } });
    }, 400);
    return () => clearTimeout(t);
     
  }, [dc, open]);

  const [reportOpen, setReportOpen] = useState(false);


  const autoBlockers = useMemo(() => detectAutoBlockers(patient), [patient]);
  const stabilityFail: DischargeBlockerId[] = [];
  if (dc.stability?.neuro === false) stabilityFail.push("gcs_drop");
  if (dc.stability?.hemo === false) stabilityFail.push("hemo_instability");
  if (dc.stability?.resp === false) stabilityFail.push("resp_failure");
  if (dc.stability?.metab === false) stabilityFail.push("metab_severe");
  const activeBlockerIds = Array.from(new Set([...(dc.blockers ?? []), ...autoBlockers, ...stabilityFail]));
  const pct = computeProgress(dc);
  const canDischarge = activeBlockerIds.length === 0 && dc.finalization?.fit === "sim";

  const set = <K extends keyof DischargeCheck>(k: K, v: DischargeCheck[K]) => setDc((d) => ({ ...d, [k]: v }));
  const setStab = (k: keyof NonNullable<DischargeCheck["stability"]>, v: boolean | undefined) =>
    setDc((d) => ({ ...d, stability: { ...(d.stability ?? {}), [k]: v } }));
  const setMeds = (k: keyof NonNullable<DischargeCheck["meds"]>, v: unknown) =>
    setDc((d) => ({ ...d, meds: { ...(d.meds ?? {}), [k]: v as never } }));
  const setNutr = (k: keyof NonNullable<DischargeCheck["nutrition"]>, v: boolean | undefined) =>
    setDc((d) => ({ ...d, nutrition: { ...(d.nutrition ?? {}), [k]: v } }));
  const setFunc = (k: keyof NonNullable<DischargeCheck["functionality"]>, v: boolean | undefined) =>
    setDc((d) => ({ ...d, functionality: { ...(d.functionality ?? {}), [k]: v } }));
  const setComm = (k: keyof NonNullable<DischargeCheck["communication"]>, v: boolean | undefined) =>
    setDc((d) => ({ ...d, communication: { ...(d.communication ?? {}), [k]: v } }));

  const toggleBlocker = (id: DischargeBlockerId) => {
    setDc((d) => {
      const cur = new Set(d.blockers ?? []);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...d, blockers: Array.from(cur) };
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] w-[98vw] max-w-[1400px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-surface-2 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <CheckCircle2 className="h-5 w-5 text-clinical-stable" />
            Checar Alta · {patient.name} <span className="text-muted-foreground">· {patient.bed}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Header info */}
        <div className="border-b border-border bg-surface px-4 py-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Diagnóstico</div>
              <div className="truncate text-[12px] text-foreground" title={patient.diagnoses?.[0]?.label}>
                {patient.diagnoses?.[0]?.label ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tempo UTI</div>
              <div className="font-mono text-[12px] text-foreground">D{patient.daysICU}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Glasgow</div>
              <div className="font-mono text-[12px] text-foreground">{patient.state?.glasgow ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">DVA</div>
              <div className="text-[12px] text-foreground">{patient.state?.dva ?? "—"}</div>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Transferência prevista</span>
              <input
                type="date"
                value={dc.expectedTransfer ?? ""}
                onChange={(e) => set("expectedTransfer", e.target.value)}
                className="rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] outline-none focus:border-primary"
              />
            </label>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progresso do checklist</span>
              <span className="font-mono font-semibold text-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full transition-all ${
                  activeBlockerIds.length > 0 ? "bg-clinical-critical"
                    : pct >= 85 ? "bg-clinical-stable" : "bg-clinical-attention"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Verdict banner */}
          <div className={`mt-3 rounded-md border px-3 py-2 text-[13px] font-semibold ${
            activeBlockerIds.length > 0
              ? "border-clinical-critical/50 bg-clinical-critical/10 text-clinical-critical"
              : canDischarge
                ? "border-clinical-stable/50 bg-clinical-stable/10 text-clinical-stable"
                : "border-clinical-attention/50 bg-clinical-attention/10 text-clinical-attention"
          }`}>
            {activeBlockerIds.length > 0 ? (
              <>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Paciente NÃO apto para alta da UTI</div>
                <ul className="mt-1 list-disc pl-6 text-[12px] font-normal">
                  {activeBlockerIds.map((b) => (
                    <li key={b}>{BLOCKER_META.find((x) => x.id === b)?.label ?? b}</li>
                  ))}
                </ul>
              </>
            ) : canDischarge ? (
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Paciente apto para transferência da UTI</div>
            ) : (
              <div>Checklist em andamento — conclua os itens para liberar a alta.</div>
            )}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto bg-background p-4 md:grid-cols-2">
          <Card n={1} title="Estabilidade Clínica" icon={Activity}>
            <div className="grid gap-2">
              <CheckRow label="Estabilidade neurológica" value={dc.stability?.neuro} onChange={(v) => setStab("neuro", v)} danger />
              <CheckRow label="Estabilidade hemodinâmica" value={dc.stability?.hemo} onChange={(v) => setStab("hemo", v)} danger />
              <CheckRow label="Estabilidade respiratória" value={dc.stability?.resp} onChange={(v) => setStab("resp", v)} danger />
              <CheckRow label="Estabilidade metabólica" value={dc.stability?.metab} onChange={(v) => setStab("metab", v)} danger />
            </div>
            <div className="mt-3 rounded-md border border-clinical-critical/30 bg-clinical-critical/5 p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-clinical-critical">
                <AlertTriangle className="h-3.5 w-3.5" /> Bloqueadores de alta
              </div>
              <div className="grid gap-1 md:grid-cols-2">
                {BLOCKER_META.map((b) => {
                  const auto = autoBlockers.includes(b.id);
                  const checked = auto || (dc.blockers ?? []).includes(b.id);
                  return (
                    <label key={b.id} className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] ${
                      checked ? "bg-clinical-critical/15 text-clinical-critical font-semibold" : "text-foreground hover:bg-surface-3"
                    }`}>
                      <input
                        type="checkbox" checked={checked} disabled={auto}
                        onChange={() => toggleBlocker(b.id)}
                      />
                      <span>{b.label}{auto && " (auto)"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card n={2} title="Exame Neurológico" icon={Brain}>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Glasgow" value={dc.neuro?.glasgow} min={3} max={15}
                onChange={(v) => setDc((d) => ({ ...d, neuro: { ...(d.neuro ?? {}), glasgow: v } }))} />
              <NumField label="NIHSS" value={dc.neuro?.nihss} min={0} max={42}
                onChange={(v) => setDc((d) => ({ ...d, neuro: { ...(d.neuro ?? {}), nihss: v } }))} />
              <TextField label="Pupilas" value={dc.neuro?.pupils}
                onChange={(v) => setDc((d) => ({ ...d, neuro: { ...(d.neuro ?? {}), pupils: v } }))} />
              <TextField label="Déficits" value={dc.neuro?.deficits}
                onChange={(v) => setDc((d) => ({ ...d, neuro: { ...(d.neuro ?? {}), deficits: v } }))} />
            </div>
            <div className="mt-2">
              <TextField area label="Observações" value={dc.neuro?.notes}
                onChange={(v) => setDc((d) => ({ ...d, neuro: { ...(d.neuro ?? {}), notes: v } }))} />
            </div>
          </Card>

          <Card n={3} title="Diagnóstico e Tratamento" icon={Stethoscope}>
            <div className="grid gap-2">
              <TextField area label="Diagnóstico" value={dc.diagnosis?.dx}
                onChange={(v) => setDc((d) => ({ ...d, diagnosis: { ...(d.diagnosis ?? {}), dx: v } }))} />
              <TextField area label="Procedimentos realizados" value={dc.diagnosis?.procedures}
                onChange={(v) => setDc((d) => ({ ...d, diagnosis: { ...(d.diagnosis ?? {}), procedures: v } }))} />
              <TextField label="Última neuroimagem" value={dc.diagnosis?.lastImaging}
                onChange={(v) => setDc((d) => ({ ...d, diagnosis: { ...(d.diagnosis ?? {}), lastImaging: v } }))} />
              <TextField area label="Complicações" value={dc.diagnosis?.complications}
                onChange={(v) => setDc((d) => ({ ...d, diagnosis: { ...(d.diagnosis ?? {}), complications: v } }))} />
            </div>
          </Card>

          <Card n={4} title="Medicações" icon={Pill}>
            <div className="grid gap-2">
              <CheckRow label="Conciliação medicamentosa" value={dc.meds?.conciliation} onChange={(v) => setMeds("conciliation", v)} />
              <CheckRow label="Anticoagulação revisada" value={dc.meds?.anticoag} onChange={(v) => setMeds("anticoag", v)} />
              <CheckRow label="Antiagregação revisada" value={dc.meds?.antiplt} onChange={(v) => setMeds("antiplt", v)} />
              <CheckRow label="Anticonvulsivantes" value={dc.meds?.anticonv} onChange={(v) => setMeds("anticonv", v)} />
              <CheckRow label="Antibióticos" value={dc.meds?.abx} onChange={(v) => setMeds("abx", v)} />
              <CheckRow label="Medicações críticas revisadas" value={dc.meds?.critical} onChange={(v) => setMeds("critical", v)} />
              <TextField area label="Observações" value={dc.meds?.notes} onChange={(v) => setMeds("notes", v)} />
            </div>
          </Card>

          <Card n={5} title="Nutrição" icon={Utensils}>
            <div className="grid gap-2">
              <CheckRow label="Via oral" value={dc.nutrition?.oral} onChange={(v) => setNutr("oral", v)} />
              <CheckRow label="SNE" value={dc.nutrition?.sne} onChange={(v) => setNutr("sne", v)} />
              <CheckRow label="Gastrostomia" value={dc.nutrition?.gtt} onChange={(v) => setNutr("gtt", v)} />
              <CheckRow label="Avaliação da Fono" value={dc.nutrition?.fono} onChange={(v) => setNutr("fono", v)} />
              <CheckRow label="Risco de broncoaspiração comunicado" value={dc.nutrition?.aspRisk} onChange={(v) => setNutr("aspRisk", v)} />
            </div>
          </Card>

          <Card n={6} title="Dispositivos" icon={Cable}>
            <div className="grid gap-2">
              {(dc.devices ?? []).length === 0 && (
                <div className="text-[12px] text-muted-foreground">Nenhum dispositivo ativo registrado.</div>
              )}
              {(dc.devices ?? []).map((d, i) => (
                <div key={d.id} className="rounded-md border border-border bg-surface p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <input
                      value={d.name}
                      onChange={(e) => setDc((s) => ({
                        ...s,
                        devices: (s.devices ?? []).map((x, j) => j === i ? { ...x, name: e.target.value } : x),
                      }))}
                      className="flex-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] font-semibold outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDc((s) => ({
                          ...s,
                          devices: (s.devices ?? []).map((x, j) => j === i ? { ...x, keep: x.keep === true ? undefined : true } : x),
                        }))}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${d.keep === true ? "bg-clinical-attention/25 text-clinical-attention" : "text-muted-foreground hover:bg-surface-3"}`}
                      >Manter</button>
                      <button
                        type="button"
                        onClick={() => setDc((s) => ({
                          ...s,
                          devices: (s.devices ?? []).map((x, j) => j === i ? { ...x, keep: x.keep === false ? undefined : false } : x),
                        }))}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${d.keep === false ? "bg-clinical-stable/25 text-clinical-stable" : "text-muted-foreground hover:bg-surface-3"}`}
                      >Retirar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <TextField label="Justificativa" value={d.reason}
                      onChange={(v) => setDc((s) => ({
                        ...s,
                        devices: (s.devices ?? []).map((x, j) => j === i ? { ...x, reason: v } : x),
                      }))} />
                    <TextField label="Plano de retirada" value={d.removalPlan}
                      onChange={(v) => setDc((s) => ({
                        ...s,
                        devices: (s.devices ?? []).map((x, j) => j === i ? { ...x, removalPlan: v } : x),
                      }))} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDc((s) => ({
                  ...s,
                  devices: [...(s.devices ?? []), { id: crypto.randomUUID(), name: "" }],
                }))}
                className="rounded border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface-3"
              >+ Adicionar dispositivo</button>
            </div>
          </Card>

          <Card n={7} title="Funcionalidade" icon={Footprints}>
            <div className="grid gap-2">
              <CheckRow label="Mobilidade avaliada" value={dc.functionality?.mobility} onChange={(v) => setFunc("mobility", v)} />
              <CheckRow label="Plano de fisioterapia" value={dc.functionality?.physio} onChange={(v) => setFunc("physio", v)} />
              <CheckRow label="Risco de queda" value={dc.functionality?.fallRisk} onChange={(v) => setFunc("fallRisk", v)} />
              <CheckRow label="Lesão por pressão" value={dc.functionality?.lpp} onChange={(v) => setFunc("lpp", v)} />
              <CheckRow label="Necessidade de ajuda para mobilização" value={dc.functionality?.needsHelp} onChange={(v) => setFunc("needsHelp", v)} />
            </div>
          </Card>

          <Card n={8} title="Pendências" icon={ClipboardList}>
            <div className="grid gap-2">
              <TextField area label="Exames laboratoriais" value={dc.pendencies?.lab}
                onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), lab: v } }))} />
              <TextField area label="Exames de imagem" value={dc.pendencies?.imaging}
                onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), imaging: v } }))} />
              <TextField area label="Consultorias" value={dc.pendencies?.consults}
                onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), consults: v } }))} />
              <TextField area label="Culturas" value={dc.pendencies?.cultures}
                onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), cultures: v } }))} />
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Responsável" value={dc.pendencies?.owner}
                  onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), owner: v } }))} />
                <TextField label="Prazo" value={dc.pendencies?.deadline}
                  onChange={(v) => setDc((d) => ({ ...d, pendencies: { ...(d.pendencies ?? {}), deadline: v } }))} />
              </div>
            </div>
          </Card>

          <Card n={9} title="Comunicação" icon={Users}>
            <div className="grid gap-2">
              <CheckRow label="Resumo médico realizado" value={dc.communication?.medSummary} onChange={(v) => setComm("medSummary", v)} />
              <CheckRow label="Passagem médica realizada" value={dc.communication?.medHandoff} onChange={(v) => setComm("medHandoff", v)} />
              <CheckRow label="Passagem enfermagem realizada" value={dc.communication?.nurseHandoff} onChange={(v) => setComm("nurseHandoff", v)} />
              <CheckRow label="Família comunicada" value={dc.communication?.family} onChange={(v) => setComm("family", v)} />
              <CheckRow label="Equipe receptora comunicada" value={dc.communication?.receivingTeam} onChange={(v) => setComm("receivingTeam", v)} />
              <CheckRow label="Prescrição revisada" value={dc.communication?.rxReviewed} onChange={(v) => setComm("rxReviewed", v)} />
            </div>
          </Card>

          <div className="flex items-center justify-center border-y border-primary/30 bg-primary/5 py-3">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              title="Gerar Relatório de Alta da UTI a partir dos dados registrados"
            >
              <FileText className="h-4 w-4" />
              Gerar Relatório de Alta
            </button>
          </div>



          <Card n={10} title="Liberação Final" icon={CheckCircle2} defaultOpen>
            <div className="rounded-md border border-border-strong bg-surface p-3">
              <div className="mb-2 text-[13px] font-semibold text-foreground">Paciente apto para alta?</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={activeBlockerIds.length > 0}
                  onClick={() => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), fit: "sim" } }))}
                  className={`rounded-md px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                    dc.finalization?.fit === "sim"
                      ? "bg-clinical-stable/25 text-clinical-stable"
                      : "border border-border text-foreground hover:bg-surface-3"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >Sim</button>
                <button
                  type="button"
                  onClick={() => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), fit: "nao" } }))}
                  className={`rounded-md px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                    dc.finalization?.fit === "nao"
                      ? "bg-clinical-critical/25 text-clinical-critical"
                      : "border border-border text-foreground hover:bg-surface-3"
                  }`}
                >Não</button>
                {activeBlockerIds.length > 0 && (
                  <span className="text-[11px] text-clinical-critical">
                    Bloqueado por {activeBlockerIds.length} impedimento(s).
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-2">
                <TextField area label="Observações finais" value={dc.finalization?.notes}
                  onChange={(v) => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), notes: v } }))} />
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Responsável" value={dc.finalization?.responsible}
                    onChange={(v) => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), responsible: v } }))} />
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Data</span>
                    <input type="date" value={dc.finalization?.date ?? ""}
                      onChange={(e) => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), date: e.target.value } }))}
                      className="rounded border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-primary" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hora</span>
                    <input type="time" value={dc.finalization?.time ?? ""}
                      onChange={(e) => setDc((d) => ({ ...d, finalization: { ...(d.finalization ?? {}), time: e.target.value } }))}
                      className="rounded border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-primary" />
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-muted-foreground">
          <span>Salvamento automático ativo.</span>
          <button
            type="button" onClick={onClose}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
          >Fechar</button>
        </div>
      </DialogContent>
      <DischargeReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        patient={patient}
        dischargeCheck={dc}
        activeBlockers={activeBlockerIds}
      />
    </Dialog>
  );
}
