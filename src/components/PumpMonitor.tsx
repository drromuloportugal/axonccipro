import { useEffect, useMemo, useState } from "react";
import type { Patient, Medication, PumpStatus, PumpInfusion, InvasiveDevice } from "@/data/patients";
import {
  computeBagRemaining, bagAlertBadge, pumpCategoryOf,
  PUMP_CATEGORY_META, computeConcentrationMcgPerMl,
} from "@/lib/clinical";
import {
  PUMP_STATUS_META, PUMP_STATUSES,
  COMMON_PUMP_DRUGS, COMPAT_META,
  compatibilityOf, scanCompatibility, groupPumpsByAccess,
} from "@/lib/pumpCompat";
import { deviceTypeByCode } from "@/data/devices";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, AlertTriangle, Activity } from "lucide-react";

function fmtClock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtRemaining(min: number) {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function nowISO() { return new Date().toISOString(); }

function deriveStatus(med: Medication, nowMs: number): PumpStatus {
  if (med.pump?.status) return med.pump.status;
  if (med.active === false) return "stopped";
  if (med.pump) {
    const bag = computeBagRemaining(med.pump, nowMs);
    if (bag) {
      if (bag.alert === "empty") return "needs_change";
      if (bag.alert === "low_30min" || bag.alert === "low_1h") return "ending_soon";
    }
  }
  return "running";
}

function accessLabel(devices: InvasiveDevice[], id?: string): string {
  if (!id) return "Sem acesso vinculado";
  const d = devices.find((x) => x.id === id);
  if (!d) return "Acesso removido";
  const def = deviceTypeByCode(d.typeCode);
  return `${def?.label ?? d.typeCode}${d.site ? ` · ${d.site}` : ""}`;
}

// ============================================================================
// CARD
// ============================================================================

export function PumpCard({
  med, compact = false, onClick, devices = [],
}: {
  med: Medication;
  compact?: boolean;
  onClick?: () => void;
  devices?: InvasiveDevice[];
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const cat = pumpCategoryOf(med);
  const meta = PUMP_CATEGORY_META[cat];
  const pump = med.pump;
  const bag = nowMs != null && pump ? computeBagRemaining(pump, nowMs) : null;
  const alert = bag ? bagAlertBadge(bag.alert) : null;

  const status = nowMs != null ? deriveStatus(med, nowMs) : "running";
  const stMeta = PUMP_STATUS_META[status];

  const rate = pump?.rateMlPerHour ?? med.mlPerHour;
  const doseLabel =
    pump?.targetDoseValue != null && pump.targetDoseUnit
      ? `${pump.targetDoseValue} ${pump.targetDoseUnit}`
      : med.dose;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border bg-surface px-3 py-2 text-left transition-colors ${stMeta.borderClass} hover:bg-surface-2 ${compact ? "text-[11px]" : "text-[12px]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span>{meta.icon}</span>
          <span className="truncate font-semibold text-foreground">{med.name}</span>
        </div>
        <span className={`flex items-center gap-1 font-mono text-[10px] uppercase ${stMeta.className}`}>
          <span>{stMeta.icon}</span>{stMeta.label}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
        {doseLabel}{rate != null ? ` · ${rate.toFixed(1)} mL/h` : ""}
      </div>
      {pump?.pumpDrugName && (
        <div className="mt-0.5 truncate text-[11px] italic text-foreground/80" title={pump.pumpDrugName}>
          {pump.pumpDrugName}
        </div>
      )}
      {pump && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {pump.drugAmountMg} {cat === "insulina" ? "UI" : "mg"} / {pump.finalVolumeMl} mL {pump.solvent}
          {pump.concentrationMcgPerMl ? ` · ${pump.concentrationMcgPerMl.toFixed(0)} ${cat === "insulina" ? "UI" : "mcg"}/mL` : ""}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <LinkIcon className="h-2.5 w-2.5" />
        <span className="truncate">
          {accessLabel(devices, pump?.accessDeviceId)}
          {pump?.accessLumen ? ` · L${pump.accessLumen}` : ""}
        </span>
      </div>
      {bag && (
        <>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full ${
                bag.alert === "empty" || bag.alert === "low_30min" ? "bg-clinical-critical"
                : bag.alert === "low_1h" ? "bg-clinical-device"
                : bag.alert === "low_2h" ? "bg-clinical-attention"
                : "bg-clinical-stable"
              }`}
              style={{ width: `${bag.percent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className={alert?.className}>
              {alert?.icon} {bag.remainingMl.toFixed(0)} mL · {fmtRemaining(bag.remainingMin)}
            </span>
            <span className="font-mono text-muted-foreground">
              {bag.endsAt ? `troca ${fmtClock(bag.endsAt)}` : "—"}
            </span>
          </div>
        </>
      )}
    </button>
  );
}

// ============================================================================
// DASHBOARD chip (entry point)
// ============================================================================

export function PumpDashboard({ patient, onOpen }: { patient: Patient; onOpen: () => void }) {
  const active = patient.medications.filter((m) => m.active !== false && m.pump);
  if (!active.length) return null;
  const buckets: Record<string, number> = {};
  for (const m of active) {
    const c = pumpCategoryOf(m);
    buckets[c] = (buckets[c] ?? 0) + 1;
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[10px] transition-colors hover:bg-surface-3"
      title="Abrir monitor de bombas"
    >
      <span className="font-mono font-semibold text-foreground">💉 {active.length} bombas</span>
      {Object.entries(buckets).map(([k, n]) => {
        const meta = PUMP_CATEGORY_META[k as keyof typeof PUMP_CATEGORY_META];
        return (
          <span key={k} className={`flex items-center gap-0.5 ${meta.className}`}>
            <span>{meta.icon}</span><span>{n}</span>
          </span>
        );
      })}
    </button>
  );
}

// ============================================================================
// MONITOR (panel inside dialog)
// ============================================================================

export function PumpMonitor({
  patient,
  onChange,
}: {
  patient: Patient;
  onChange?: (p: Patient) => void;
}) {
  const pumps = patient.medications.filter((m) => m.pump);
  const devices = (patient.devices ?? []).filter((d) => !d.removedAt);

  const [editIdx, setEditIdx] = useState<number | null>(null);

  if (!pumps.length) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Sem bombas ativas.</div>;
  }

  const editing = editIdx != null ? pumps[editIdx] : null;
  const editingIdxInPatient = editing
    ? patient.medications.findIndex((m) => m === editing)
    : -1;

  const applyMed = (idx: number, patch: Partial<Medication>) => {
    if (!onChange) return;
    const next = {
      ...patient,
      medications: patient.medications.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    };
    onChange(next);
  };

  // Compatibility scan grouped by access/lumen
  const groups = useMemo(() => groupPumpsByAccess(pumps), [pumps]);

  return (
    <div className="space-y-4">
      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {PUMP_STATUSES.map((s) => {
          const m = PUMP_STATUS_META[s];
          return (
            <span key={s} className={`flex items-center gap-1 rounded border border-border px-1.5 py-0.5 ${m.className}`}>
              {m.icon} {m.label}
            </span>
          );
        })}
      </div>

      {/* Compatibility alerts per access */}
      {Array.from(groups.entries()).map(([key, meds]) => {
        if (key === "__unassigned__" || meds.length < 2) return null;
        const issues = scanCompatibility(meds);
        if (!issues.length) return null;
        const first = meds[0];
        const accLabel = accessLabel(devices, first.pump?.accessDeviceId);
        return (
          <div key={key} className="rounded-md border border-clinical-critical/40 bg-clinical-critical/5 p-2 text-[11px]">
            <div className="mb-1 flex items-center gap-1 font-semibold text-clinical-critical">
              <AlertTriangle className="h-3.5 w-3.5" />
              Compartilhamento de lúmen — {accLabel}{first.pump?.accessLumen ? ` · L${first.pump.accessLumen}` : ""}
            </div>
            <ul className="space-y-0.5">
              {issues.map((iss, i) => {
                const cm = COMPAT_META[iss.level];
                return (
                  <li key={i} className={`flex items-center gap-1 ${cm.className}`}>
                    <span>{cm.icon}</span>
                    <span>{iss.a}  ⇄  {iss.b}</span>
                    <span className="text-muted-foreground">— {cm.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pumps.map((m, i) => (
          <PumpCard key={i} med={m} devices={devices} onClick={() => setEditIdx(i)} />
        ))}
      </div>

      {/* Side editor */}
      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditIdx(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {editing && editingIdxInPatient >= 0 && (
            <PumpEditor
              med={editing}
              devices={devices}
              weight={patient.weight}
              onChange={(patch) => applyMed(editingIdxInPatient, patch)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// EDITOR (side panel)
// ============================================================================

function PumpEditor({
  med, devices, weight, onChange,
}: {
  med: Medication;
  devices: InvasiveDevice[];
  weight: number;
  onChange: (patch: Partial<Medication>) => void;
}) {
  const pump = med.pump!;
  const cat = pumpCategoryOf(med);
  const isInsulin = cat === "insulina";

  const setPump = (patch: Partial<PumpInfusion>) => {
    const next = { ...pump, ...patch };
    // Auto recalc concentration
    next.concentrationMcgPerMl = computeConcentrationMcgPerMl(next.drugAmountMg, next.finalVolumeMl);
    // Auto recalc mL/h if continuous + dose + weight available
    if (next.targetDoseValue != null && next.concentrationMcgPerMl > 0) {
      const wt = weight || 0;
      let mlh: number | undefined;
      switch (next.targetDoseUnit) {
        case "mcg/kg/min":
          mlh = (next.targetDoseValue * wt * 60) / next.concentrationMcgPerMl;
          break;
        case "mcg/min":
          mlh = (next.targetDoseValue * 60) / next.concentrationMcgPerMl;
          break;
        case "mg/h":
          mlh = (next.targetDoseValue * 1000) / next.concentrationMcgPerMl;
          break;
        case "mg/kg/h":
          mlh = (next.targetDoseValue * wt * 1000) / next.concentrationMcgPerMl;
          break;
        case "UI/h":
          // for insulin, drugAmountMg holds UI; concentration is UI/mL*1000 in our calc, treat differently
          mlh = next.drugAmountMg && next.finalVolumeMl
            ? next.targetDoseValue / (next.drugAmountMg / next.finalVolumeMl)
            : undefined;
          break;
        case "mL/h":
          mlh = next.targetDoseValue;
          break;
      }
      if (mlh != null && Number.isFinite(mlh)) next.rateMlPerHour = +mlh.toFixed(2);
    }
    onChange({ pump: next });
  };

  const setName = (name: string) => onChange({ name });

  const inputCls =
    "h-8 w-full rounded border border-input bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring";

  // Compatibility hint against any other pump on same access/lumen
  const lumenLabel = pump.accessLumen ? `L${pump.accessLumen}` : "L?";
  const sameAccess = devices.find((d) => d.id === pump.accessDeviceId);

  return (
    <div className="space-y-3">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-clinical-resp" />
          Editar bomba
        </SheetTitle>
        <SheetDescription>Recalcula automaticamente mL/h, dose e concentração.</SheetDescription>
      </SheetHeader>

      {/* Medication name */}
      <div>
        <Label>Medicação</Label>
        <div className="flex gap-2">
          <select
            className={inputCls}
            value={COMMON_PUMP_DRUGS.includes(med.name) ? med.name : "__other__"}
            onChange={(e) => e.target.value !== "__other__" && setName(e.target.value)}
          >
            {COMMON_PUMP_DRUGS.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="__other__">Outra…</option>
          </select>
          <input className={inputCls} value={med.name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      {/* Status */}
      <div>
        <Label>Status operacional</Label>
        <div className="grid grid-cols-3 gap-1">
          {PUMP_STATUSES.map((s) => {
            const m = PUMP_STATUS_META[s];
            const active = (pump.status ?? "running") === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setPump({ status: s })}
                className={`rounded border px-1.5 py-1 text-[10px] ${m.className} ${active ? `${m.borderClass} bg-surface-2 font-semibold` : "border-border"}`}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Infusion data */}
      <fieldset className="rounded-md border border-border p-2">
        <legend className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">Dados da infusão</legend>
        <div className="mb-2">
          <Label>Nome do medicamento (livre)</Label>
          <input
            type="text"
            className={inputCls}
            placeholder="Ex.: Noradrenalina 4mg/4mL — bolsa nº 12"
            value={pump.pumpDrugName ?? ""}
            onChange={(e) => setPump({ pumpDrugName: e.target.value || undefined })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label={isInsulin ? "Quantidade (UI)" : "Quantidade (mg)"} value={pump.drugAmountMg}
            onChange={(v) => setPump({ drugAmountMg: v })} />
          <NumField label="Volume final (mL)" value={pump.finalVolumeMl}
            onChange={(v) => setPump({ finalVolumeMl: v })} />
          <NumField label="Bolsa atual (mL)" value={pump.bagVolumeMl ?? pump.finalVolumeMl}
            onChange={(v) => setPump({ bagVolumeMl: v })} />
          <div>
            <Label>Início da bolsa</Label>
            <input type="datetime-local" className={inputCls}
              value={pump.bagStartedAt ? new Date(pump.bagStartedAt).toISOString().slice(0, 16) : ""}
              onChange={(e) => setPump({ bagStartedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </div>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Concentração: <b>{(pump.concentrationMcgPerMl ?? computeConcentrationMcgPerMl(pump.drugAmountMg, pump.finalVolumeMl)).toFixed(1)}</b> {isInsulin ? "UI" : "mcg"}/mL
        </div>
      </fieldset>

      {/* Programming */}
      <fieldset className="rounded-md border border-border p-2">
        <legend className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">Programação</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Dose alvo</Label>
            <input type="number" step="0.01" className={inputCls}
              value={pump.targetDoseValue ?? ""}
              onChange={(e) => setPump({ targetDoseValue: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </div>
          <div>
            <Label>Unidade</Label>
            <select className={inputCls} value={pump.targetDoseUnit ?? "mcg/kg/min"}
              onChange={(e) => setPump({ targetDoseUnit: e.target.value as PumpInfusion["targetDoseUnit"] })}>
              {(["mcg/kg/min", "mcg/min", "mg/h", "mg/kg/h", "UI/h", "mL/h"] as const).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <NumField label="Velocidade (mL/h)" value={pump.rateMlPerHour ?? 0}
            onChange={(v) => setPump({ rateMlPerHour: v })} />
          <div className="text-[10px] text-muted-foreground self-end">
            Peso paciente: <b>{weight} kg</b>
          </div>
        </div>
      </fieldset>

      {/* Linked access */}
      <fieldset className="rounded-md border border-border p-2">
        <legend className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">Acesso vascular</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label>Dispositivo</Label>
            <select className={inputCls} value={pump.accessDeviceId ?? ""}
              onChange={(e) => setPump({ accessDeviceId: e.target.value || undefined })}>
              <option value="">— sem acesso vinculado —</option>
              {devices.map((d) => {
                const def = deviceTypeByCode(d.typeCode);
                return (
                  <option key={d.id} value={d.id}>
                    {def?.label ?? d.typeCode}{d.site ? ` · ${d.site}` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          {sameAccess?.lumens && sameAccess.lumens > 1 && (
            <div>
              <Label>Lúmen ({sameAccess.lumens} disponíveis)</Label>
              <select className={inputCls} value={pump.accessLumen ?? ""}
                onChange={(e) => setPump({ accessLumen: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">—</option>
                {Array.from({ length: sameAccess.lumens }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>L{i + 1}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </fieldset>

      {/* History */}
      <div>
        <Label>Observações / histórico de alterações</Label>
        <textarea
          className="min-h-[60px] w-full rounded border border-input bg-background p-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
          value={pump.pumpNotes ?? ""}
          onChange={(e) => setPump({ pumpNotes: e.target.value })}
          placeholder="Ex.: 14:30 — titulação de 0,2 para 0,3 mcg/kg/min."
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => {
          setPump({ bagStartedAt: nowISO(), bagVolumeMl: pump.finalVolumeMl, status: "running" });
        }}>Trocar bolsa agora</Button>
        <Button size="sm" variant="ghost" onClick={() => onChange({ active: false })}>
          Suspender
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number" step="0.01"
        className="h-8 w-full rounded border border-input bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
