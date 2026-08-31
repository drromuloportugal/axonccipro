import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill, Copy, Printer, Download, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { Patient, Medication } from "@/data/patients";
import { computeAge, computeBMI, medClassOf } from "@/lib/clinical";
import { analyzeMedications } from "@/lib/api/medication-analysis.functions";

// ------- Types matching server JSON schema -------
type Gravity = "sem" | "leve" | "moderada" | "grave" | "contraindicada";
type RiskLevel = "baixo" | "moderado" | "alto" | "muito_alto";

interface Analysis {
  resumo?: {
    totalMedicamentos?: number;
    classesTerapeuticas?: string[];
    altoRisco?: string[];
    potencialmenteInapropriados?: string[];
    polifarmacia?: boolean;
    observacoes?: string;
  };
  interacoes?: Array<{
    medicamentos: string[];
    mecanismo: string; relevancia: string; frequencia: string;
    consequencias: string; conduta: string; gravidade: Gravity;
  }>;
  interacoesCondicoes?: Array<{
    medicamento: string; condicao: string; risco: string; conduta: string;
    gravidade: "leve" | "moderada" | "grave";
  }>;
  ajusteDose?: Array<{
    medicamento: string; doseAtual: string; doseSugerida: string;
    justificativa: string; fator: string;
  }>;
  eventosAdversos?: Array<{
    evento: string; medicamentosEnvolvidos: string[]; risco: RiskLevel;
    justificativa: string; monitorizacao: string;
  }>;
  compatibilidade?: Array<{
    medicamentos: string[]; problema: string; conduta: string; gravidade: Gravity;
  }>;
  duplicidade?: Array<{ medicamentos: string[]; tipo: string; conduta: string }>;
  desnecessarios?: Array<{ medicamento: string; motivo: string; conduta: string }>;
  otimizacoes?: Array<{
    recomendacao: string; justificativa: string; prioridade: "baixa" | "media" | "alta";
  }>;
  resumoExecutivo?: {
    interacoesLeves?: number; interacoesModeradas?: number;
    interacoesGraves?: number; interacoesContraindicadas?: number;
    riscosPrioritarios?: Array<{ descricao: string; gravidade: "moderada" | "grave" | "contraindicada" }>;
    recomendacoesPriorizadas?: string[];
  };
  referencias?: Array<{
    titulo: string; autores: string; ano: string; recomendacao: string; nivelEvidencia: string;
  }>;
  dataAnalise?: string;
  observacaoConsenso?: string;
}

// ------- Color mapping -------
const GRAVITY_META: Record<Gravity, { icon: string; label: string; cls: string; bg: string }> = {
  sem: { icon: "", label: "Sem relevância", cls: "text-clinical-stable", bg: "bg-clinical-stable/10 border-clinical-stable/40" },
  leve: { icon: "", label: "Leve", cls: "text-clinical-attention", bg: "bg-clinical-attention/10 border-clinical-attention/40" },
  moderada: { icon: "", label: "Moderada", cls: "text-clinical-device", bg: "bg-clinical-device/10 border-clinical-device/40" },
  grave: { icon: "", label: "Grave", cls: "text-clinical-critical", bg: "bg-clinical-critical/10 border-clinical-critical/40" },
  contraindicada: { icon: "", label: "Contraindicada", cls: "text-foreground", bg: "bg-foreground/10 border-foreground/50" },
};
const gravityOrder: Record<Gravity, number> = { contraindicada: 4, grave: 3, moderada: 2, leve: 1, sem: 0 };

const RISK_META: Record<RiskLevel, { label: string; cls: string }> = {
  baixo: { label: "Baixo", cls: "text-clinical-stable" },
  moderado: { label: "Moderado", cls: "text-clinical-attention" },
  alto: { label: "Alto", cls: "text-clinical-device" },
  muito_alto: { label: "Muito Alto", cls: "text-clinical-critical" },
};

// ------- Patient → prompt context -------
function buildContext(p: Patient): string {
  const meds: Medication[] = (p.medications ?? []).filter((m) => m.active !== false);
  const alergias = (p.allergies ?? []).join("; ") || "nenhuma registrada";
  const diags = (p.diagnoses ?? []).map((d) => d.label).join("; ") || "não informado";
  const idade = p.age ?? computeAge(p.birthDate);
  const bmi = computeBMI(p.weight, p.height);
  const findExam = (rx: RegExp) => p.exams?.find((e) => rx.test(`${e.code ?? ""} ${e.label ?? ""}`));
  const cr = findExam(/creat/i);
  const clcr = findExam(/clcr|clearance|tfg|egfr/i);
  const k = findExam(/pot[aá]ssio|^K$/i);
  const na = findExam(/s[oó]dio|^Na$/i);
  const tgo = findExam(/TGO|AST/i);
  const tgp = findExam(/TGP|ALT/i);
  const bili = findExam(/bilirr/i);

  const medsText = meds.map((m) => {
    const cls = medClassOf(m);
    const parts = [
      `- ${m.name}`,
      m.dose ? `dose: ${m.dose}` : null,
      m.route ? `via: ${m.route}` : null,
      m.freq ? `freq: ${m.freq}` : null,
      m.start ? `início: ${m.start}` : null,
      cls ? `classe: ${cls}` : null,
      m.isAntibiotic ? "ANTIBIÓTICO" : null,
      m.pump ? `bomba: ${m.mlPerHour ?? "?"} mL/h` : null,
    ].filter(Boolean).join(" · ");
    return parts;
  }).join("\n");

  const state = p.state ?? ({} as Patient["state"]);
  const intakeTotal = state.fluidBalance?.intake?.reduce((s, x) => s + (x.volumeMl ?? 0), 0) ?? 0;
  const outputTotal = state.fluidBalance?.output?.reduce((s, x) => s + (x.volumeMl ?? 0), 0) ?? 0;

  return `# PACIENTE
Nome: ${p.name} · Leito: ${p.bed}
Idade: ${idade ?? "?"} anos · Sexo: ${p.sex ?? "?"} · Peso: ${p.weight ?? "?"} kg · Altura: ${p.height ?? "?"} cm · IMC: ${bmi?.value ?? "?"}
Dias UTI: ${p.daysICU ?? "?"} · Dias Hosp: ${p.daysHosp ?? "?"}
Gravidade: ${p.severity ?? "?"}

# DIAGNÓSTICOS ATIVOS
${diags}

# ALERGIAS
${alergias}

# MEDICAÇÕES ATIVAS (${meds.length})
${medsText || "nenhuma"}

# LABORATÓRIO RELEVANTE
Creatinina: ${cr?.value ?? "?"} ${cr?.unit ?? ""}
Clearance/TFG: ${clcr?.value ?? "?"} ${clcr?.unit ?? ""}
Potássio: ${k?.value ?? "?"} ${k?.unit ?? ""}
Sódio: ${na?.value ?? "?"} ${na?.unit ?? ""}
TGO/AST: ${tgo?.value ?? "?"} · TGP/ALT: ${tgp?.value ?? "?"} · Bilirrubina: ${bili?.value ?? "?"}

# ESTADO ATUAL
Glasgow: ${state.glasgow ?? "?"} · RASS: ${state.rass ?? "?"} · FC: ${state.fcMax ?? "?"} · PA: ${state.pas ?? "?"}/${state.pad ?? "?"} (PAM ${state.pam ?? "?"}) · SpO2: ${state.spo2 ?? "?"}%
Temp: ${state.temp ?? "?"} °C · Diurese 24h: ${state.diurese24 ?? state.diurese ?? "?"} mL · Glicemia: ${state.glicemia ?? "?"}
DVA: ${state.dva ?? "não"} · Ventilação: ${state.vent ?? "?"} · FiO2: ${state.fio2 ?? "?"}
Balanço hídrico: entradas ${intakeTotal} mL / saídas ${outputTotal} mL
Dieta: ${state.dieta ?? "?"} · Resíduo gástrico: ${state.residuoGastrico ?? "?"} mL

Realize a análise medicamentosa completa conforme o schema JSON solicitado.`;
}

// ------- Component -------
export function MedicationAnalysisModal({
  open, onClose, patient,
}: { open: boolean; onClose: () => void; patient: Patient }) {
  const analyze = useServerFn(analyzeMedications);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  const [sortBySeverity, setSortBySeverity] = useState(true);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);

  const run = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const context = buildContext(patient);
      const res = await analyze({ data: { context } });
      let parsed: Analysis = {};
      try { parsed = JSON.parse(res.analysisJson); } catch { throw new Error("Resposta da IA inválida."); }
      setData(parsed);
      setAnalyzedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao analisar.");
    } finally {
      setLoading(false);
    }
  };

  const interactions = useMemo(() => {
    const list = data?.interacoes ?? [];
    if (!sortBySeverity) return list;
    return [...list].sort((a, b) => (gravityOrder[b.gravidade] ?? 0) - (gravityOrder[a.gravidade] ?? 0));
  }, [data, sortBySeverity]);

  const reportText = useMemo(() => data ? renderReportText(patient, data, analyzedAt) : "", [patient, data, analyzedAt]);

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(reportText); } catch { /* ignore */ }
  };
  const doPrint = () => window.print();
  const doDownload = () => {
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `Analise Medicamentosa - ${patient.name} ${today}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
 <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
 <DialogContent className="max-h-[95vh] w-[95vw] max-w-6xl overflow-y-auto print:max-h-none print:overflow-visible">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Pill className="h-5 w-5 text-clinical-attention" /> Análise Medicamentosa · {patient.name}
 </DialogTitle>
 </DialogHeader> {/* Toolbar */}
 <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 print:hidden">
 <button
            type="button"
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1 rounded bg-clinical-attention px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-clinical-attention/90 disabled:opacity-60"
          > {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {data ? "Reanalisar" : "Iniciar análise"}
 </button> {data && (
 <>
 <button type="button" onClick={doCopy} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-hover">
 <Copy className="h-3 w-3" /> Copiar
 </button>
 <button type="button" onClick={doPrint} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-hover">
 <Printer className="h-3 w-3" /> Imprimir / PDF
 </button>
 <button type="button" onClick={doDownload} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-hover">
 <Download className="h-3 w-3" /> Exportar
 </button>
 <label className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
 <input type="checkbox" checked={sortBySeverity} onChange={(e) => setSortBySeverity(e.target.checked)} /> Ordenar interações por gravidade
 </label>
 </> )}
 </div> {/* Empty state */}
        {!data && !loading && !error && (
 <div className="py-8 text-center text-[13px] text-muted-foreground"> Clique em <b>Iniciar análise</b> para avaliar a prescrição atual do paciente.
 <div className="mt-2 text-[11px]"> A IA analisará interações, incompatibilidades, ajustes de dose, eventos adversos e oportunidades de otimização.
 </div>
 </div> )}

        {loading && (
 <div className="flex flex-col items-center justify-center gap-2 py-10">
 <Loader2 className="h-6 w-6 animate-spin text-clinical-attention" />
 <div className="text-[12px] text-muted-foreground">Analisando prescrição, condições clínicas e evidências…</div>
 </div> )}

        {error && (
 <div className="flex items-start gap-2 rounded border border-clinical-critical/50 bg-clinical-critical/10 p-3 text-[12px] text-clinical-critical">
 <AlertTriangle className="h-4 w-4 shrink-0" />
 <div>{error}</div>
 </div> )}

        {data && (
 <div className="space-y-4 py-2 text-[12px]"> {/* Executive summary */}
 <Section title=" Resumo Executivo">
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 <StatCard label=" Leves" value={data.resumoExecutivo?.interacoesLeves ?? 0} cls="text-clinical-attention" />
 <StatCard label=" Moderadas" value={data.resumoExecutivo?.interacoesModeradas ?? 0} cls="text-clinical-device" />
 <StatCard label=" Graves" value={data.resumoExecutivo?.interacoesGraves ?? 0} cls="text-clinical-critical" />
 <StatCard label=" Contraindicadas" value={data.resumoExecutivo?.interacoesContraindicadas ?? 0} cls="text-foreground" />
 </div> {(data.resumoExecutivo?.riscosPrioritarios ?? []).length > 0 && (
 <div className="mt-3">
 <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Riscos prioritários</div>
 <ul className="space-y-1"> {data.resumoExecutivo!.riscosPrioritarios!.map((r, i) => (
 <li key={i} className={`rounded border p-2 ${GRAVITY_META[r.gravidade].bg}`}>
 <span className={GRAVITY_META[r.gravidade].cls}>{GRAVITY_META[r.gravidade].icon} </span> {r.descricao}
 </li> ))}
 </ul>
 </div> )}
              {(data.resumoExecutivo?.recomendacoesPriorizadas ?? []).length > 0 && (
 <div className="mt-3">
 <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Recomendações priorizadas</div>
 <ol className="ml-4 list-decimal space-y-0.5"> {data.resumoExecutivo!.recomendacoesPriorizadas!.map((r, i) => <li key={i}>{r}</li>)}
 </ol>
 </div> )}
 </Section> {/* 1. Prescription summary */}
 <Section title="1 · Resumo da Prescrição">
 <div className="grid gap-1 sm:grid-cols-2">
 <KV k="Total de medicamentos" v={String(data.resumo?.totalMedicamentos ?? 0)} />
 <KV k="Polifarmácia" v={data.resumo?.polifarmacia ? "Sim" : "Não"} />
 </div> {data.resumo?.classesTerapeuticas?.length ? (
 <div className="mt-2"><b>Classes:</b> {data.resumo.classesTerapeuticas.join(", ")}</div> ) : null}
              {data.resumo?.altoRisco?.length ? (
 <div className="mt-1 text-clinical-critical"><b> Alto risco:</b> {data.resumo.altoRisco.join(", ")}</div> ) : null}
              {data.resumo?.potencialmenteInapropriados?.length ? (
 <div className="mt-1 text-clinical-device"><b>Potencialmente inapropriados:</b> {data.resumo.potencialmenteInapropriados.join(", ")}</div> ) : null}
              {data.resumo?.observacoes && <div className="mt-2 italic text-muted-foreground">{data.resumo.observacoes}</div>}
 </Section> {/* 2. Interactions */}
 <Section title={`2 · Interações Medicamentosas (${interactions.length})`}> {interactions.length === 0 ? <Empty /> : (
 <ul className="space-y-2"> {interactions.map((it, i) => {
                    const g = GRAVITY_META[it.gravidade];
                    return (
 <li key={i} className={`rounded border p-2 ${g.bg}`}>
 <div className="flex items-center justify-between gap-2">
 <div className="font-semibold">{it.medicamentos.join(" ⇄ ")}</div>
 <span className={`shrink-0 text-[10px] font-bold uppercase ${g.cls}`}>{g.icon} {g.label}</span>
 </div>
 <div className="mt-1 grid gap-1 text-[11px] sm:grid-cols-2">
 <div><b>Mecanismo:</b> {it.mecanismo}</div>
 <div><b>Frequência:</b> {it.frequencia}</div>
 <div><b>Relevância clínica:</b> {it.relevancia}</div>
 <div><b>Consequências:</b> {it.consequencias}</div>
 </div>
 <div className="mt-1 text-[11px]"><b>Conduta:</b> {it.conduta}</div>
 </li> );
                  })}
 </ul> )}
 </Section> {/* 3. Condition interactions */}
 <Section title={`3 · Interações com Condições Clínicas (${data.interacoesCondicoes?.length ?? 0})`}> {(data.interacoesCondicoes ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1.5"> {data.interacoesCondicoes!.map((c, i) => (
 <li key={i} className={`rounded border p-2 ${GRAVITY_META[c.gravidade].bg}`}>
 <b>{c.medicamento}</b> × <i>{c.condicao}</i>
 <div className="mt-0.5"><b>Risco:</b> {c.risco}</div>
 <div><b>Conduta:</b> {c.conduta}</div>
 </li> ))}
 </ul> )}
 </Section> {/* 4. Dose adjustment */}
 <Section title={`4 · Ajuste de Dose (${data.ajusteDose?.length ?? 0})`}> {(data.ajusteDose ?? []).length === 0 ? <Empty /> : (
 <div className="overflow-x-auto">
 <table className="w-full text-[11px]">
 <thead className="bg-surface-hover text-left uppercase text-muted-foreground">
 <tr><th className="p-1.5">Medicamento</th><th className="p-1.5">Dose atual</th><th className="p-1.5">Dose sugerida</th><th className="p-1.5">Fator</th><th className="p-1.5">Justificativa</th></tr>
 </thead>
 <tbody> {data.ajusteDose!.map((a, i) => (
 <tr key={i} className="border-t border-border">
 <td className="p-1.5 font-semibold">{a.medicamento}</td>
 <td className="p-1.5">{a.doseAtual}</td>
 <td className="p-1.5 text-clinical-attention">{a.doseSugerida}</td>
 <td className="p-1.5">{a.fator}</td>
 <td className="p-1.5">{a.justificativa}</td>
 </tr> ))}
 </tbody>
 </table>
 </div> )}
 </Section> {/* 5. Adverse events */}
 <Section title={`5 · Eventos Adversos Potenciais (${data.eventosAdversos?.length ?? 0})`}> {(data.eventosAdversos ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1.5"> {data.eventosAdversos!.map((e, i) => (
 <li key={i} className="rounded border border-border p-2">
 <div className="flex items-center justify-between">
 <b>{e.evento}</b>
 <span className={`text-[10px] font-bold uppercase ${RISK_META[e.risco].cls}`}>{RISK_META[e.risco].label}</span>
 </div>
 <div className="text-[11px]">Envolvidos: {e.medicamentosEnvolvidos.join(", ")}</div>
 <div className="text-[11px]"><b>Justificativa:</b> {e.justificativa}</div>
 <div className="text-[11px]"><b>Monitorização:</b> {e.monitorizacao}</div>
 </li> ))}
 </ul> )}
 </Section> {/* 6. Compatibility */}
 <Section title={`6 · Compatibilidade de Infusões (${data.compatibilidade?.length ?? 0})`}> {(data.compatibilidade ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1.5"> {data.compatibilidade!.map((c, i) => (
 <li key={i} className={`rounded border p-2 ${GRAVITY_META[c.gravidade].bg}`}>
 <b>{c.medicamentos.join(" + ")}</b>
 <div><b>Problema:</b> {c.problema}</div>
 <div><b>Conduta:</b> {c.conduta}</div>
 </li> ))}
 </ul> )}
 </Section> {/* 7. Duplication */}
 <Section title={`7 · Duplicidade Terapêutica (${data.duplicidade?.length ?? 0})`}> {(data.duplicidade ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1"> {data.duplicidade!.map((d, i) => (
 <li key={i} className="rounded border border-border p-2">
 <b>{d.medicamentos.join(" + ")}</b> — {d.tipo}
 <div><b>Conduta:</b> {d.conduta}</div>
 </li> ))}
 </ul> )}
 </Section> {/* 8. Unnecessary */}
 <Section title={`8 · Medicamentos Potencialmente Desnecessários (${data.desnecessarios?.length ?? 0})`}> {(data.desnecessarios ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1"> {data.desnecessarios!.map((d, i) => (
 <li key={i} className="rounded border border-border p-2">
 <b>{d.medicamento}</b> — {d.motivo}
 <div><b>Conduta:</b> {d.conduta}</div>
 </li> ))}
 </ul> )}
 </Section> {/* 9. Optimizations */}
 <Section title={`9 · Oportunidades de Otimização (${data.otimizacoes?.length ?? 0})`}> {(data.otimizacoes ?? []).length === 0 ? <Empty /> : (
 <ul className="space-y-1"> {data.otimizacoes!.map((o, i) => {
                    const cls = o.prioridade === "alta" ? "border-clinical-critical/40 bg-clinical-critical/5"
                      : o.prioridade === "media" ? "border-clinical-attention/40 bg-clinical-attention/5"
                      : "border-border";
                    return (
 <li key={i} className={`rounded border p-2 ${cls}`}>
 <b>{o.recomendacao}</b> <span className="text-[10px] uppercase text-muted-foreground">({o.prioridade})</span>
 <div>{o.justificativa}</div>
 </li> );
                  })}
 </ul> )}
 </Section> {/* References */}
 <Section title={` Referências (${data.referencias?.length ?? 0})`}> {(data.referencias ?? []).length === 0 ? <Empty /> : (
 <ol className="ml-4 list-decimal space-y-1"> {data.referencias!.map((r, i) => (
 <li key={i} className="text-[11px]">
 <b>{r.titulo}</b> — {r.autores} ({r.ano}) · <i>Nível: {r.nivelEvidencia}</i>
 <div className="text-muted-foreground">Aplicação: {r.recomendacao}</div>
 </li> ))}
 </ol> )}
              {data.observacaoConsenso && (
 <div className="mt-2 rounded bg-surface-hover p-2 text-[11px] italic text-muted-foreground"> {data.observacaoConsenso}
 </div> )}
 <div className="mt-2 text-[10px] text-muted-foreground"> Última atualização da análise: {(analyzedAt ?? new Date()).toLocaleString("pt-BR")}
 </div>
 </Section>

 <div className="rounded border border-clinical-attention/40 bg-clinical-attention/5 p-2 text-[10.5px] text-muted-foreground"> Ferramenta de apoio à decisão clínica. Não substitui o julgamento do profissional de saúde responsável.
 </div>
 </div> )}
 </DialogContent>
 </Dialog> );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
 <section className="rounded-md border border-border bg-surface p-3">
 <h3 className="mb-2 border-b border-border pb-1 text-[12px] font-bold uppercase tracking-wider text-foreground">{title}</h3> {children}
 </section> );
}
function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
 <div className="rounded border border-border p-2 text-center">
 <div className={`text-2xl font-bold ${cls}`}>{value}</div>
 <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
 </div> );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></div>;
}
function Empty() {
  return <div className="text-[11px] italic text-muted-foreground">Sem achados nesta categoria.</div>;
}

function renderReportText(p: Patient, d: Analysis, at: Date | null): string {
  const L: string[] = [];
  L.push(`ANÁLISE MEDICAMENTOSA — ${p.name}`);
  L.push(`Data: ${(at ?? new Date()).toLocaleString("pt-BR")}`);
  L.push("=".repeat(70));
  L.push("\nRESUMO EXECUTIVO");
  L.push(`- Leves: ${d.resumoExecutivo?.interacoesLeves ?? 0} · Moderadas: ${d.resumoExecutivo?.interacoesModeradas ?? 0} · Graves: ${d.resumoExecutivo?.interacoesGraves ?? 0} · Contraindicadas: ${d.resumoExecutivo?.interacoesContraindicadas ?? 0}`);
  (d.resumoExecutivo?.riscosPrioritarios ?? []).forEach((r) => L.push(`  ! ${r.gravidade.toUpperCase()}: ${r.descricao}`));
  L.push("\nINTERAÇÕES");
  (d.interacoes ?? []).forEach((i) => L.push(`- [${i.gravidade}] ${i.medicamentos.join(" x ")} — ${i.conduta}`));
  L.push("\nAJUSTE DE DOSE");
  (d.ajusteDose ?? []).forEach((a) => L.push(`- ${a.medicamento}: ${a.doseAtual} → ${a.doseSugerida} (${a.justificativa})`));
  L.push("\nEVENTOS ADVERSOS");
  (d.eventosAdversos ?? []).forEach((e) => L.push(`- [${e.risco}] ${e.evento} — ${e.monitorizacao}`));
  L.push("\nOTIMIZAÇÕES");
  (d.otimizacoes ?? []).forEach((o) => L.push(`- (${o.prioridade}) ${o.recomendacao}`));
  L.push("\nREFERÊNCIAS");
  (d.referencias ?? []).forEach((r, i) => L.push(`${i + 1}. ${r.titulo} — ${r.autores} (${r.ano}) [${r.nivelEvidencia}]`));
  L.push("\n— Ferramenta de apoio à decisão clínica. Não substitui julgamento médico.");
  return L.join("\n");
}
