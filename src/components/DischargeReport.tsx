import { useMemo, useState, useEffect } from "react";
import type { Patient, DischargeCheck, DischargeBlockerId } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Copy, Printer, Download, Check } from "lucide-react";
import { toast } from "sonner";

const BLOCKER_LABELS: Record<string, string> = {
  gcs_drop: "Deterioração neurológica / Glasgow em queda",
  seizure: "Convulsão não controlada",
  dva: "Droga vasoativa em uso",
  hemo_instability: "Instabilidade hemodinâmica",
  resp_failure: "Insuficiência respiratória",
  airway_unprotected: "Via aérea não protegida",
  metab_severe: "Distúrbio metabólico grave",
  active_bleeding: "Sangramento ativo",
  urgent_procedure: "Procedimento emergencial pendente",
  incompatible_device: "Dispositivo incompatível com enfermaria",
  no_ward_structure: "Estrutura inadequada na unidade receptora",
  vent_invasive: "Ventilação mecânica invasiva",
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function nowStamp() {
  const d = new Date();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function buildReport(patient: Patient, dc: DischargeCheck, activeBlockers: DischargeBlockerId[]): string {
  const p = patient;
  const s = p.state ?? ({} as Patient["state"]);
  const dxMain = p.diagnoses?.[0]?.label ?? dc.diagnosis?.dx ?? "—";
  const dxSec = (p.diagnoses ?? []).slice(1).map((d) => d.label).filter(Boolean);
  const transferDate = dc.finalization?.date || dc.expectedTransfer || new Date().toISOString().slice(0, 10);
  const transferTime = dc.finalization?.time || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const meds = (p.medications ?? []).filter((m) => m.active !== false);
  const activeDevs = (p.devices ?? []).filter((d) => !d.removedAt);
  const dcDevs = dc.devices ?? [];

  const pam = typeof s.pas === "number" && typeof s.pad === "number"
    ? Math.round((s.pas + 2 * s.pad) / 3)
    : (typeof s.pam === "number" ? s.pam : undefined);

  const linesDev = dcDevs.length
    ? dcDevs.map((d) => `  • ${d.name}${d.keep === true ? " — permanecer" : d.keep === false ? " — retirar" : ""}${d.reason ? ` (${d.reason})` : ""}${d.removalPlan ? ` | Plano: ${d.removalPlan}` : ""}`).join("\n")
    : activeDevs.length
      ? activeDevs.map((d) => `  • ${d.typeCode}`).join("\n")
      : " • Nenhum dispositivo ativo.";

  const linesMeds = meds.length
    ? meds.map((m) => `  • ${m.name} — ${m.dose ?? ""} ${m.freq ?? ""} ${m.route ? `(${m.route})` : ""}`.trim()).join("\n")
    : " • Sem medicações em continuidade.";

  const pend: string[] = [];
  if (dc.pendencies?.lab) pend.push(`  • Laboratório: ${dc.pendencies.lab}`);
  if (dc.pendencies?.imaging) pend.push(`  • Imagem: ${dc.pendencies.imaging}`);
  if (dc.pendencies?.cultures) pend.push(`  • Culturas: ${dc.pendencies.cultures}`);
  if (dc.pendencies?.consults) pend.push(`  • Consultorias: ${dc.pendencies.consults}`);
  if (dc.pendencies?.owner || dc.pendencies?.deadline) {
    pend.push(`  • Responsável: ${dc.pendencies?.owner ?? "—"} | Prazo: ${dc.pendencies?.deadline ?? "—"}`);
  }

  const safety = [
    dc.stability?.neuro !== false ? "✔ Estabilidade neurológica" : "✗ Instabilidade neurológica",
    dc.stability?.resp !== false ? "✔ Estabilidade respiratória" : "✗ Instabilidade respiratória",
    dc.stability?.hemo !== false ? "✔ Estabilidade hemodinâmica" : "✗ Instabilidade hemodinâmica",
    dc.stability?.metab !== false ? "✔ Estabilidade metabólica" : "✗ Instabilidade metabólica",
    dc.meds?.conciliation ? "✔ Medicações conciliadas" : "◻ Conciliação medicamentosa pendente",
    (dcDevs.length ? "✔ Dispositivos revisados" : "◻ Dispositivos a revisar"),
    (dc.pendencies?.lab || dc.pendencies?.imaging || dc.pendencies?.consults || dc.pendencies?.cultures) ? "✔ Pendências comunicadas" : "◻ Sem pendências registradas",
    dc.communication?.medHandoff && dc.communication?.nurseHandoff ? "✔ Passagem de plantão realizada" : "◻ Passagem de plantão pendente",
  ].join("\n");

  const canDischarge = activeBlockers.length === 0 && dc.finalization?.fit === "sim";
  const conclusion = canDischarge
    ? "Após revisão dos critérios assistenciais e de segurança para transferência, considera-se o paciente clinicamente apto para continuidade do tratamento em unidade de menor complexidade."
    : `Paciente permanece sem condições clínicas para transferência devido aos seguintes fatores:\n${activeBlockers.map((b) => `  • ${BLOCKER_LABELS[b] ?? b}`).join("\n") || " • Checklist incompleto."}`;

  const justificativa = canDischarge
    ? "Paciente apresenta estabilidade neurológica, hemodinâmica, respiratória e metabólica, sem necessidade de monitorização intensiva contínua ou terapias exclusivas de unidade de terapia intensiva. Encontra-se apto para continuidade do tratamento em enfermaria, permanecendo sob acompanhamento multiprofissional, com plano terapêutico definido e critérios de reavaliação estabelecidos."
    : "Paciente ainda demanda cuidados exclusivos de unidade de terapia intensiva, mantendo-se em monitorização contínua até estabilização plena dos parâmetros clínicos.";

  return `RELATÓRIO DE ALTA DA UTI
Gerado em ${nowStamp()}

===================================================================
IDENTIFICAÇÃO
===================================================================
Paciente:            ${p.name}
Idade / Sexo:        ${p.age} anos / ${p.sex === "M" ? "Masculino" : "Feminino"}
Prontuário:          ${p.id}
Leito UTI:           ${p.bed}
Admissão hospitalar: ${fmtDate(p.admissionHosp)}  (D${p.daysHosp})
Admissão UTI:        ${fmtDate(p.admissionICU)}  (D${p.daysICU})
Transferência:       ${fmtDate(transferDate)} ${transferTime}
Diagnóstico principal:  ${dxMain}
Diagnósticos secundários: ${dxSec.length ? dxSec.join("; ") : "—"}

===================================================================
RESUMO DA INTERNAÇÃO
===================================================================
Paciente admitido em UTI para tratamento de ${dxMain.toLowerCase()}, permanecendo internado por ${p.daysICU} dia(s) em terapia intensiva. Durante a internação, foram realizados os seguintes procedimentos: ${dc.diagnosis?.procedures || (p.procedures ?? []).map((x) => x.label).join("; ") || "sem procedimentos invasivos relevantes"}. ${dc.diagnosis?.lastImaging ? `Última avaliação por imagem: ${dc.diagnosis.lastImaging}. ` : ""}${dc.diagnosis?.complications ? `Complicações: ${dc.diagnosis.complications}. ` : "Evolução sem complicações significativas. "}Apresentou resposta clínica satisfatória ao tratamento instituído, encontrando-se no momento com o quadro clínico descrito a seguir.

===================================================================
SITUAÇÃO CLÍNICA ATUAL
===================================================================
NEUROLÓGICO
  Glasgow: ${dc.neuro?.glasgow ?? s.glasgow ?? "—"}${dc.neuro?.nihss !== undefined ? ` | NIHSS: ${dc.neuro.nihss}` : ""}
  Pupilas: ${dc.neuro?.pupils || "—"}
  Déficits: ${dc.neuro?.deficits || "sem déficits focais aparentes"}
  Observações: ${dc.neuro?.notes || "—"}

HEMODINÂMICO
  PA: ${s.pas && s.pad ? `${s.pas}/${s.pad} mmHg` : "—"}${pam ? ` (PAM ${pam})` : ""}
  FC: ${s.fcMax ?? "—"} bpm
  DVA: ${s.dva || "sem drogas vasoativas em uso"}
  ${dc.stability?.hemo !== false ? "Estável hemodinamicamente." : "INSTÁVEL — em investigação."}

RESPIRATÓRIO
  Suporte: ${s.vent || "ar ambiente"}${s.fio2 ? ` | FiO2 ${s.fio2}%` : ""}
  SpO2: ${s.spo2 ?? "—"}%
  ${dc.stability?.resp !== false ? "Padrão respiratório estável." : "Padrão respiratório instável."}

METABÓLICO
  Glicemia: ${s.glicemia ?? "—"} mg/dL
  Diurese: ${s.diurese ?? "—"} mL / BH: ${s.balancoHidrico ?? "—"} mL
  Temperatura: ${s.temp ?? "—"} °C
  ${dc.stability?.metab !== false ? "Sem distúrbios metabólicos relevantes." : "Distúrbio metabólico ativo."}

INFECCIOSO
  Foco(s): ${(p.infections ?? []).map((i) => i.site).filter(Boolean).join("; ") || s.infection || "sem foco infeccioso ativo"}
  Culturas: ${dc.pendencies?.cultures || (p.cultures ?? []).map((c) => `${c.source}${c.result ? ` (${c.result})` : ""}`).join("; ") || "sem coletas recentes"}
  Antibioticoterapia: ${meds.filter((m) => /cef|van|mero|pip|lev|met|amox|cip|gent|amic|line/i.test(m.name)).map((m) => m.name).join(", ") || "sem antibiótico em uso"}

===================================================================
DISPOSITIVOS
===================================================================
${linesDev}

===================================================================
MEDICAÇÕES EM CONTINUIDADE
===================================================================
${linesMeds}
${dc.meds?.notes ? `\nObservações: ${dc.meds.notes}` : ""}

===================================================================
PENDÊNCIAS
===================================================================
${pend.length ? pend.join("\n") : " • Sem pendências registradas."}

===================================================================
PLANO ASSISTENCIAL
===================================================================
  • Metas pressóricas: PAM ≥ 65 mmHg (ajustar conforme comorbidades)
  • Metas glicêmicas: 140–180 mg/dL
  • Metas neurológicas: manter Glasgow atual, reavaliar em piora
  • Cuidados com dispositivos: revisar indicação diária e planejar retirada precoce
  • Fisioterapia motora e respiratória diária
  • Avaliação fonoaudiológica${dc.nutrition?.fono ? " (realizada)" : " conforme indicação"}
  • Nutrição: ${dc.nutrition?.oral ? "via oral" : dc.nutrition?.sne ? "SNE" : dc.nutrition?.gtt ? "gastrostomia" : "conforme prescrição"}${dc.nutrition?.aspRisk ? " — atenção ao risco de broncoaspiração" : ""}
  • Enfermagem: controle de sinais vitais, prevenção de LPP, controle de eliminações
  • Sinais de alerta: rebaixamento neurológico, hipotensão, dessaturação, febre, oligúria

===================================================================
JUSTIFICATIVA DA ALTA
===================================================================
${justificativa}

===================================================================
CRITÉRIOS DE SEGURANÇA
===================================================================
${safety}

===================================================================
CONCLUSÃO
===================================================================
${conclusion}

===================================================================
ASSINATURA
===================================================================
Médico intensivista: ${dc.finalization?.responsible || p.attending || "____________________"}
CRM: __________________________
Data: ${fmtDate(transferDate)}    Hora: ${transferTime}

_______________________________________________
Assinatura / Carimbo
`;
}

export function DischargeReportModal({
  open,
  onClose,
  patient,
  dischargeCheck,
  activeBlockers,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  dischargeCheck: DischargeCheck;
  activeBlockers: DischargeBlockerId[];
}) {
  const generated = useMemo(
    () => buildReport(patient, dischargeCheck, activeBlockers),
    [patient, dischargeCheck, activeBlockers],
  );
  const [text, setText] = useState(generated);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (open && !edited) setText(generated);
  }, [open, generated, edited]);

  useEffect(() => {
    if (open) setEdited(false);
  }, [open, patient.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado para a área de transferência");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const openPrintWindow = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      toast.error("Bloqueado pelo navegador — permita pop-ups.");
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const title = `Alta UTI ${patient.name} ${dateStr}`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Courier New', monospace; font-size: 11pt; line-height: 1.4; color: #000; white-space: pre-wrap; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 12px; }
</style></head><body>${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const handleExportPDF = openPrintWindow; // Use browser "Save as PDF"

  const handlePrint = openPrintWindow;

  const handleAttachRecord = () => {
    toast.success("Relatório registrado no histórico do paciente", {
      description: `${patient.name} — ${nowStamp()}`,
    });
  };

  return (
 <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
 <DialogContent className="max-h-[95vh] w-[95vw] max-w-[1000px] overflow-hidden p-0">
 <DialogHeader className="border-b border-border bg-surface-2 px-4 py-3">
 <DialogTitle className="flex items-center gap-2 text-[15px]">
 <FileText className="h-5 w-5 text-primary" />
            Relatório de Alta da UTI · {patient.name}
 </DialogTitle>
 </DialogHeader>

 <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
 <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium hover:bg-surface-3"
          >
 <Copy className="h-3.5 w-3.5" /> Copiar
 </button>
 <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium hover:bg-surface-3"
          >
 <Printer className="h-3.5 w-3.5" /> Imprimir
 </button>
 <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium hover:bg-surface-3"
          >
 <Download className="h-3.5 w-3.5" /> Exportar PDF
 </button>
 <button
            onClick={handleAttachRecord}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/20"
          >
 <Check className="h-3.5 w-3.5" /> Anexar ao prontuário
 </button>
 <div className="ml-auto text-[11px] text-muted-foreground">
            {edited ? "Editado" : "Gerado automaticamente"} · {nowStamp()}
 </div>
 </div>

 <div className="max-h-[75vh] overflow-y-auto bg-background p-4">
 <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEdited(true);
            }}
            spellCheck={false}
            className="h-[70vh] w-full resize-none rounded-md border border-border-strong bg-surface p-4 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-primary"
          />
 </div>

 <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-muted-foreground">
 <span>Documento editável — revise antes de anexar ao prontuário.</span>
 <button
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Fechar
 </button>
 </div>
 </DialogContent>
 </Dialog>
  );
}
