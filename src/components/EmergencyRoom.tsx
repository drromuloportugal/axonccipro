import { useMemo, useState } from "react";
import type { Conduct, Patient } from "@/data/patients";
import { AlertTriangle, CheckCircle2, HeartPulse, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

type Pathway = "acls" | "atls";
type Group = "conduta" | "exames" | "medicacoes";
type ChecklistItem = { id: string; title: string; detail: string; group: Group };

const PATHWAYS: Record<Pathway, { label: string; description: string; items: ChecklistItem[] }> = {
  acls: {
    label: "ACLS · emergência cardiovascular",
    description: "Suporte avançado de vida adulto — registrar avaliação, cronologia e checagens da equipe.",
    items: [
      { id: "acls-activation", group: "conduta", title: "Ativação e cronologia", detail: "Registrar início do evento, líder, ritmo inicial e tempos críticos." },
      { id: "acls-cpr", group: "conduta", title: "RCP, desfibrilação e monitorização", detail: "Checar qualidade da RCP, monitor/desfibrilador e pausas mínimas conforme protocolo local." },
      { id: "acls-airway", group: "conduta", title: "Via aérea, ventilação e capnografia", detail: "Documentar estratégia de via aérea e confirmação por capnografia quando disponível." },
      { id: "acls-access", group: "conduta", title: "Acesso IV/IO e causas reversíveis", detail: "Confirmar acesso e revisar causas reversíveis (Hs e Ts) com a equipe." },
      { id: "acls-rosc", group: "conduta", title: "Cuidados pós-ROSC e destino", detail: "Registrar retorno de circulação, estabilização, comunicação e destino assistencial." },
      { id: "acls-ecg", group: "exames", title: "ECG de 12 derivações", detail: "Solicitar/registrar quando clinicamente indicado após estabilização." },
      { id: "acls-labs", group: "exames", title: "Gasometria, eletrólitos, glicemia e lactato", detail: "Coletar conforme cenário clínico e disponibilidade; interpretar no contexto." },
      { id: "acls-pocus", group: "exames", title: "POCUS/ecocardiografia e imagem dirigida", detail: "Usar apenas quando não atrasar intervenções prioritárias." },
      { id: "acls-cart", group: "medicacoes", title: "Carrinho de emergência revisado", detail: "Conferir disponibilidade de adrenalina e apresentações locais; dose e via seguem protocolo institucional e prescrição." },
      { id: "acls-antiarrhythmic", group: "medicacoes", title: "Antiarritmia e correções específicas", detail: "Conferir amiodarona/lidocaína, magnésio, cálcio, bicarbonato e atropina quando indicados; validar algoritmo e contraindicações." },
    ],
  },
  atls: {
    label: "ATLS · trauma",
    description: "Avaliação inicial do trauma estruturada em ABCDE, sem substituir o protocolo local ou a decisão da equipe de trauma.",
    items: [
      { id: "atls-team", group: "conduta", title: "Ativação de trauma, EPI e cronologia", detail: "Registrar mecanismo, horário, equipe acionada, alergias e anticoagulantes quando conhecidos." },
      { id: "atls-abcde", group: "conduta", title: "Avaliação primária ABCDE", detail: "Registrar achados e intervenções imediatas de via aérea, ventilação, circulação, neurológico e exposição/temperatura." },
      { id: "atls-hemorrhage", group: "conduta", title: "Controle de hemorragia e aquecimento", detail: "Checar controle externo, protocolo transfusional local e prevenção de hipotermia quando aplicável." },
      { id: "atls-secondary", group: "conduta", title: "Avaliação secundária, reavaliação e destino", detail: "Registrar exame completo, reavaliações seriadas, comunicação e transferência/centro cirúrgico." },
      { id: "atls-efast", group: "exames", title: "eFAST/POCUS e radiografias iniciais", detail: "Registrar resultado e horário; não atrasar estabilização por exames." },
      { id: "atls-labs", group: "exames", title: "Hemograma, coagulação, gasometria/lactato e eletrólitos", detail: "Coletar conforme protocolo de trauma e necessidade clínica." },
      { id: "atls-blood", group: "exames", title: "Tipagem, pesquisa de anticorpos e reserva sanguínea", detail: "Acionar hemoterapia conforme gravidade e protocolo institucional." },
      { id: "atls-imaging", group: "exames", title: "Imagem dirigida/TC após estabilização", detail: "Definir com equipe de trauma conforme estabilidade e mecanismo." },
      { id: "atls-analgesia", group: "medicacoes", title: "Analgesia, sedação e anestesia", detail: "Checar analgésicos, agentes de indução e bloqueadores do protocolo de RSI; usar somente com prescrição e monitorização apropriadas." },
      { id: "atls-prophylaxis", group: "medicacoes", title: "Profilaxias e terapias específicas", detail: "Avaliar tétano, antimicrobianos, ácido tranexâmico, hemostasia e outras medidas conforme lesão, tempo e protocolo local." },
    ],
  },
};

const GROUPS: readonly [Group, string][] = [["conduta", "Condutas e segurança"], ["exames", "Exames e imagem"], ["medicacoes", "Medicamentos e preparo"]];

export function EmergencyRoom({ open, onClose, patients, initialPatientId, onPatientChange }: { open: boolean; onClose: () => void; patients: Patient[]; initialPatientId?: string; onPatientChange: (patient: Patient) => void }) {
  const [pathway, setPathway] = useState<Pathway>("acls");
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);
  const config = PATHWAYS[pathway];
  if (!open) return null;

  const register = () => {
    if (!patient) return toast.error("Selecione um paciente para registrar a checagem.");
    const selected = config.items.filter((item) => done[item.id]);
    if (!selected.length) return toast.error("Marque ao menos uma checagem concluída.");
    const date = new Date().toISOString();
    const conducts: Conduct[] = selected.map((item) => ({ team: "Médica", text: `Sala de Emergência · ${pathway.toUpperCase()} · ${item.title}`, system: "other", startedAt: date, subItems: [{ text: item.detail, date }] }));
    onPatientChange({ ...patient, conducts: [...(patient.conducts ?? []), ...conducts] });
    toast.success("Checagens registradas no plano do paciente", { description: "Revise e complemente a documentação assistencial." });
  };

  return <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
    <section className="mt-2 w-full max-w-6xl overflow-hidden rounded-2xl border border-red-200/60 bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 px-5 py-4 text-white">
        <div className="flex gap-3"><div className="mt-0.5 rounded-xl bg-red-500/20 p-2 text-red-200"><HeartPulse className="h-5 w-5" /></div><div><h2 className="text-lg font-bold">Sala de Emergência</h2><p className="text-xs text-slate-200">Substitui a antiga Sala de Hemodinâmica para organização de atendimentos ACLS e ATLS.</p></div></div>
        <button type="button" onClick={onClose} aria-label="Fechar Sala de Emergência" className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </header>
      <div className="max-h-[78vh] overflow-y-auto p-5">
        <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-[12px] text-amber-950"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Ferramenta de apoio e documentação</div><p className="mt-1">Não substitui atendimento imediato, liderança clínica, prescrição, treinamento certificado ou os protocolos institucionais vigentes. A equipe deve validar cada item antes de executar ou registrar.</p></div>
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr]"><label className="text-xs font-semibold text-foreground">Paciente na sala<select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"><option value="">— selecionar paciente —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.bed} — {p.name}</option>)}</select></label><div className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted-foreground"><div className="font-semibold text-foreground">Registro seguro</div>Itens confirmados serão inseridos como condutas no plano do paciente, sem prescrever dose, via ou intervenção automaticamente.</div></div>
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{(Object.keys(PATHWAYS) as Pathway[]).map((key) => <button key={key} type="button" onClick={() => { setPathway(key); setDone({}); }} className={`rounded-xl border p-3 text-left transition ${pathway === key ? "border-red-500 bg-red-50 ring-1 ring-red-300" : "border-border bg-surface/40 hover:bg-surface"}`}><div className="font-bold text-foreground">{PATHWAYS[key].label}</div><div className="mt-1 text-xs text-muted-foreground">{PATHWAYS[key].description}</div></button>)}</div>
        <div className="grid gap-4 lg:grid-cols-3">{GROUPS.map(([group, label]) => <div key={group} className="rounded-xl border border-border bg-surface/30 p-3"><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">{label}</h3><div className="space-y-2">{config.items.filter((item) => item.group === group).map((item) => <label key={item.id} className={`block cursor-pointer rounded-lg border p-2.5 transition ${done[item.id] ? "border-emerald-400 bg-emerald-50" : "border-border bg-background hover:border-primary/40"}`}><div className="flex gap-2"><input type="checkbox" checked={Boolean(done[item.id])} onChange={(e) => setDone((prev) => ({ ...prev, [item.id]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-emerald-600" /><div><div className="text-[12px] font-semibold text-foreground">{item.title}</div><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p></div></div></label>)}</div></div>)}</div>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Baseado em AHA ACLS 2025 e ACS ATLS 11; validar sempre o protocolo local.</span><button type="button" onClick={register} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"><CheckCircle2 className="h-4 w-4" /> Confirmar e registrar checagens</button></footer>
      </div>
    </section>
  </div>;
}
