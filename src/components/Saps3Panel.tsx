import { useMemo, useState } from "react";
import type { Patient, Saps3Snapshot } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  computeSaps3, saps3Mortality, SAPS3_GROUP_LABEL, SAPS3_OFFSET,
  PRE_ICU_LOCATION, ADMISSION_PLANNING, SURGICAL_STATUS, ACUTE_INFECTION,
  COMORBIDITIES, ADMISSION_REASONS,
  type Saps3Item, type Saps3Group,
} from "@/lib/saps3";
import {
  Calculator, AlertTriangle, Table2, History, FileText, RefreshCw, CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------- status chip

export function saps3Status(p: Patient) {
  const r = computeSaps3(p);
  const saved = p.saps3?.history?.length ? p.saps3.history[p.saps3.history.length - 1] : null;
  const status: "none" | "partial" | "done" = r.complete && saved
    ? "done"
    : r.filled > 0 ? "partial" : "none";
  return { ...r, saved, status };
}

const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

// ------------------------------------------------------------------- botão

export function Saps3Button({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const s = useMemo(() => saps3Status(patient), [patient]);
  const cls =
    s.status === "done" ? "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : s.status === "partial" ? "bg-clinical-attention/15 text-clinical-attention hover:bg-clinical-attention/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="SAPS 3 — escore prognóstico de admissão na UTI"
    >
      <span className="inline-flex items-center gap-1">
        <Calculator className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> SAPS 3
        {s.status === "done" && <span className="font-mono">{s.score} pts</span>}
        {s.status === "partial" && <span>{s.filled}/{s.total}</span>}
      </span> {s.status === "done" && s.mortality !== null && (
        <span className="font-mono text-[9px] font-semibold opacity-90"> Mortalidade {fmtPct(s.mortality)}
        </span> )}
      {s.status === "partial" && <span className="text-[9px] opacity-90">Em preenchimento</span>}
      {s.status === "none" && <span className="text-[9px] opacity-90">Não calculado</span>}
    </button> );
}

// ------------------------------------------------------------------- helpers

function SourceTag({ item }: { item: Saps3Item }) {
  if (item.missing) return <span className="rounded bg-clinical-critical/15 px-1 text-[9px] text-clinical-critical">Ausente</span>;
  return (
    <span
      className={`rounded px-1 text-[9px] ${item.manual ? "bg-clinical-attention/15 text-clinical-attention" : "bg-clinical-stable/15 text-clinical-stable"}`}
      title={`Fonte: ${item.source}${item.at ? ` · ${new Date(item.at).toLocaleString("pt-BR")}` : ""}`}
    > {item.manual ? "Manual" : "Automático"} · {item.source}
    </span> );
}

function NumField({
  item, value, onChange,
}: { item: Saps3Item; value: number | string | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      step="any"
      value={value === undefined || value === null ? "" : String(value)}
      placeholder={item.raw !== null && item.raw !== undefined && typeof item.raw !== "object" ? String(item.raw) : "—"}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="w-24 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono text-[11px] outline-none focus:border-primary"
    /> );
}

function SelectField({
  options, value, onChange,
}: { options: { v: string; label: string; pts: number }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] outline-none focus:border-primary"
    >
      <option value="">— selecionar —</option> {options.map((o) => (
        <option key={o.v} value={o.v}>{o.label} ({o.pts >= 0 ? "+" : ""}{o.pts})</option> ))}
    </select> );
}

function MultiField({
  options, value, onChange,
}: { options: { v: string; label: string; pts: number }[]; value: string[] | null; onChange: (v: string[]) => void }) {
  const sel = value ?? [];
  return (
    <div className="grid gap-0.5"> {options.map((o) => (
        <label key={o.v} className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={sel.includes(o.v)}
            onChange={(e) => onChange(e.target.checked ? [...sel, o.v] : sel.filter((x) => x !== o.v))
            }
          />
          <span>{o.label}</span>
          <span className="font-mono text-muted-foreground">{o.pts >= 0 ? "+" : ""}{o.pts}</span>
        </label> ))}
      <button
        type="button"
        onClick={() => onChange([])}
        className="mt-0.5 self-start rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
      > Marcar “nenhum”
      </button>
    </div> );
}

// ------------------------------------------------------------------- modal

export function Saps3Modal({
  open, onClose, patient, onSave,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onSave: (p: Patient) => void;
}) {
  const [tab, setTab] = useState<"form" | "composition" | "history">("form");
  const r = useMemo(() => computeSaps3(patient), [patient]);
  const manual = (patient.saps3?.manual ?? {}) as Record<string, number | string | string[] | null>;

  const setManual = (key: string, v: number | string | string[] | null) => {
    const next = { ...manual };
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0 && key !== "comorbidities" && key !== "reasons")) {
      delete next[key];
    } else next[key] = v;
    const meta = { ...(patient.saps3?.meta ?? {}) };
    meta[key] = { at: new Date().toISOString(), by: patient.attending };
    onSave({ ...patient, saps3: { ...(patient.saps3 ?? {}), manual: next, meta } });
  };

  const item = (k: string) => r.items.find((i) => i.key === k)!;

  const control = (i: Saps3Item) => {
    switch (i.key) {
      case "preIcuLocation": return <SelectField options={PRE_ICU_LOCATION} value={(manual.preIcuLocation as string) ?? null} onChange={(v) => setManual("preIcuLocation", v)} />;
      case "planning": return <SelectField options={ADMISSION_PLANNING} value={(manual.planning as string) ?? null} onChange={(v) => setManual("planning", v)} />;
      case "surgical": return <SelectField options={SURGICAL_STATUS} value={(manual.surgical as string) ?? null} onChange={(v) => setManual("surgical", v)} />;
      case "infection": return <SelectField options={ACUTE_INFECTION} value={(manual.infection as string) ?? null} onChange={(v) => setManual("infection", v)} />;
      case "vasoactivePre": return (
        <SelectField
          options={[{ v: "nao", label: "Não", pts: 0 }, { v: "sim", label: "Sim", pts: 3 }]}
          value={(manual.vasoactivePre as string) ?? null}
          onChange={(v) => setManual("vasoactivePre", v)}
        /> );
      case "comorbidities": return <MultiField options={COMORBIDITIES} value={(manual.comorbidities as string[]) ?? null} onChange={(v) => setManual("comorbidities", v)} />;
      case "reasons": return <MultiField options={ADMISSION_REASONS} value={(manual.reasons as string[]) ?? null} onChange={(v) => setManual("reasons", v)} />;
      case "oxygenation": return (
        <div className="flex items-center gap-1">
          <NumField item={i} value={manual.pao2 as number} onChange={(v) => setManual("pao2", v)} />
          <span className="text-[10px] text-muted-foreground">PaO₂</span>
          <NumField item={i} value={manual.fio2 as number} onChange={(v) => setManual("fio2", v)} />
          <span className="text-[10px] text-muted-foreground">FiO₂ %</span>
        </div> );
      default: return <NumField item={i} value={manual[i.key] as number} onChange={(v) => setManual(i.key, v)} />;
    }
  };

  const recalc = () => {
    const snap: Saps3Snapshot = {
      at: new Date().toISOString(),
      score: r.score,
      mortality: r.mortality,
      by: patient.attending,
      icuAdmission: patient.admissionICU,
      items: r.items.map((i) => ({
        key: i.key, label: i.label, value: i.value, category: i.category,
        points: i.points, source: i.source, at: i.at,
      })),
    };
    onSave({
      ...patient,
      saps3: {
        ...(patient.saps3 ?? {}),
        computedAt: snap.at,
        icuAdmission: patient.admissionICU,
        history: [...(patient.saps3?.history ?? []), snap],
      },
    });
    setTab("composition");
  };

  const report = () => {
    const rows = r.items.map((i) => `<tr><td>${i.label}</td><td>${i.value ?? "—"}</td><td>${i.category ?? "—"}</td><td style="text-align:right">${i.points ?? "—"}</td><td>${i.source}</td></tr>`,
    ).join("");
    const d = new Date();
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>SAPS 3 ${patient.name} ${d.toLocaleDateString("pt-BR")}</title>
<style>body{font-family:system-ui,sans-serif;font-size:12px;padding:24px}h1{font-size:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #999;padding:4px 6px;font-size:11px;text-align:left}
.tot{margin-top:12px;font-size:14px;font-weight:700}.obs{margin-top:16px;font-size:10px;color:#444;border-top:1px solid #999;padding-top:8px}</style></head><body>
<h1>Relatório SAPS 3</h1>
<div><b>Paciente:</b> ${patient.name} · <b>Leito:</b> ${patient.bed} · <b>Idade:</b> ${patient.age} anos</div>
<div><b>Admissão UTI:</b> ${patient.admissionICU} · <b>Janela:</b> admissão na UTI</div>
<div><b>Cálculo em:</b> ${d.toLocaleString("pt-BR")}</div>
<table><thead><tr><th>Variável</th><th>Valor</th><th>Categoria</th><th>Pontos</th><th>Fonte</th></tr></thead><tbody>${rows}
<tr><td colspan="3"><b>Offset SAPS 3</b></td><td style="text-align:right"><b>+${SAPS3_OFFSET}</b></td><td>Modelo</td></tr>
</tbody></table>
<div class="tot">SAPS 3 = ${r.score} pontos${r.mortality !== null ? ` · Mortalidade hospitalar estimada = ${fmtPct(r.mortality)}` : " · INCOMPLETO"}</div>
<div>Fórmula: Logit = −32,6659 + [ln(SAPS 3 + 20,5958) × 7,3068]; P = e^Logit / (1 + e^Logit)</div>
<div class="obs">O SAPS 3 é uma ferramenta prognóstica e não deve ser utilizado isoladamente para decisões clínicas. A estimativa deve ser interpretada em conjunto com o quadro clínico e o julgamento médico.</div>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const groups: Saps3Group[] = [1, 2, 3];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Calculator className="h-4 w-4 text-clinical-neuro" /> SAPS 3 — {patient.name} ({patient.bed})
          </DialogTitle>
        </DialogHeader> {/* Resumo */}
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-4">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">SAPS 3</div>
            <div className="font-mono text-2xl font-bold text-foreground">{r.score} <span className="text-xs">pts</span></div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Mortalidade hospitalar estimada</div>
            <div className={`font-mono text-2xl font-bold ${r.complete ? "text-clinical-critical" : "text-muted-foreground"}`}> {r.mortality !== null ? fmtPct(r.mortality) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Dados</div>
            <div className="text-[12px]">{r.filled}/{r.total} variáveis preenchidas</div>
            <div className="text-[10px] text-muted-foreground"> Automáticos {r.autoCount}/{r.total} · Manuais {r.manualCount}/{r.total}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Composição</div>
            <div className="text-[10px] text-muted-foreground"> G1 {r.groupPoints.g1} · G2 {r.groupPoints.g2} · G3 {r.groupPoints.g3} · Offset +{r.groupPoints.offset}
            </div>
            <div className="text-[10px] text-muted-foreground">Janela SAPS 3: admissão na UTI</div>
          </div>
        </div> {!r.complete && (
          <div className="rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[11px] text-clinical-attention">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> SAPS 3 incompleto — {r.filled}/{r.total} variáveis preenchidas
            </div>
            <div className="mt-1"> Dados necessários: {r.missing.map((m) => m.label).join(", ")}</div>
          </div> )}
        {r.items.filter((i) => i.warning).map((i) => (
          <div key={i.key} className="rounded-md border border-clinical-critical/40 bg-clinical-critical/10 px-3 py-1.5 text-[11px] text-clinical-critical"> {i.warning}
          </div> ))}

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2"> {([["form", "Editar dados", Calculator], ["composition", "Ver composição", Table2], ["history", "Histórico", History]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3 w-3" />{l}
            </button> ))}
          <button type="button" onClick={recalc}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-3">
            <RefreshCw className="h-3 w-3" />Recalcular e salvar
          </button>
          <button type="button" onClick={report}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-3">
            <FileText className="h-3 w-3" />Gerar relatório SAPS 3
          </button>
        </div> {tab === "form" && (
          <div className="space-y-4"> {groups.map((g) => (
              <div key={g}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"> {SAPS3_GROUP_LABEL[g]}
                </div>
                <div className="divide-y divide-border rounded-md border border-border"> {r.items.filter((i) => i.group === g).map((i) => (
                    <div key={i.key} className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[1.1fr_1.2fr_1.4fr_auto] md:items-start">
                      <div>
                        <div className="text-[12px] font-semibold text-foreground">{i.label}</div>
                        <SourceTag item={i} />
                      </div>
                      <div className="text-[11px]">
                        <div className="text-foreground">{i.value ?? "—"}</div>
                        <div className="text-muted-foreground">{i.category ?? "—"}</div> {i.at && <div className="text-[9px] text-muted-foreground">{new Date(i.at).toLocaleString("pt-BR")}</div>}
                      </div>
                      <div>{control(i)}</div>
                      <div className="text-right font-mono text-[13px] font-bold text-foreground"> {i.points === null ? "—" : `${i.points >= 0 ? "+" : ""}${i.points}`}
                      </div>
                    </div> ))}
                </div>
              </div> ))}
          </div> )}

        {tab === "composition" && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[11px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-2 text-left">Variável</th><th className="p-2 text-left">Valor</th><th className="p-2 text-left">Categoria</th><th className="p-2 text-right">Pontos</th><th className="p-2 text-left">Fonte</th></tr>
              </thead>
              <tbody className="divide-y divide-border"> {r.items.map((i) => (
                  <tr key={i.key}>
                    <td className="p-2">{i.label}</td>
                    <td className="p-2">{i.value ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{i.category ?? "—"}</td>
                    <td className="p-2 text-right font-mono">{i.points === null ? "—" : i.points}</td>
                    <td className="p-2 text-muted-foreground">{i.manual ? "Manual" : i.source}</td>
                  </tr> ))}
                <tr className="bg-surface-2"><td className="p-2 font-semibold" colSpan={3}>Offset do modelo</td><td className="p-2 text-right font-mono font-bold">+{SAPS3_OFFSET}</td><td className="p-2" /></tr>
              </tbody>
            </table>
            <div className="border-t border-border bg-surface p-2 text-[12px] font-bold"> SAPS 3 = {r.score} pontos · Mortalidade estimada = {r.mortality !== null ? fmtPct(r.mortality) : "incompleto"}
            </div>
          </div> )}

        {tab === "history" && (
          <div className="space-y-2"> {(patient.saps3?.history ?? []).length === 0 && (
              <div className="rounded-md border border-border p-3 text-[11px] text-muted-foreground"> Nenhum cálculo salvo. Use “Recalcular e salvar”.
              </div> )}
            {[...(patient.saps3?.history ?? [])].reverse().map((h, idx) => (
              <div key={idx} className="rounded-md border border-border p-2 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    <CheckCircle2 className="mr-1 inline h-3 w-3 text-clinical-stable" /> {new Date(h.at).toLocaleString("pt-BR")}
                  </span>
                  <span className="font-mono"> {h.score} pts · {h.mortality !== null ? fmtPct(h.mortality) : "—"}
                  </span>
                  <span className="text-muted-foreground">Adm UTI {h.icuAdmission ?? "—"} · {h.by ?? "—"}</span>
                </div>
              </div> ))}
          </div> )}

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground"> Fórmula: Logit = −32,6659 + [ln(SAPS 3 + 20,5958) × 7,3068] · P = e^Logit / (1 + e^Logit).
          O SAPS 3 é ferramenta prognóstica e não deve ser usado isoladamente para decisões clínicas.
        </div>
      </DialogContent>
    </Dialog> );
}

void saps3Mortality;
