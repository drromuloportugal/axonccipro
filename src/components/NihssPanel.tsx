import { useMemo, useState } from "react";
import type { Patient } from "@/data/patients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, AlertTriangle, RotateCcw, Calculator, RefreshCw } from "lucide-react";

export type NihssValue = number | "UN";

export type NihssRecord = {
  mode?: "guided" | "quick";
  items?: Partial<Record<NihssItemId, NihssValue>>;
  total?: number | null;
  at?: string;
};

export type NihssItemId =
  | "1a" | "1b" | "1c" | "2" | "3" | "4"
  | "5a" | "5b" | "6a" | "6b"
  | "7" | "8" | "9" | "10" | "11";

type ItemDef = {
  id: NihssItemId;
  title: string;
  instruction: string;
  options: { v: NihssValue; label: string }[];
};

const UN_OPT = { v: "UN" as NihssValue, label: "UN — Não testável (amputação, fusão articular ou barreira física)" };

export const NIHSS_ITEMS: ItemDef[] = [
  {
    id: "1a",
    title: "Nível de consciência",
    instruction: "Avaliar a responsividade global do paciente, mesmo na presença de barreiras (tubo orotraqueal, trauma, curativos).",
    options: [
      { v: 0, label: "0 — Alerta" },
      { v: 1, label: "1 — Não totalmente alerta, mas desperta ao mínimo estímulo" },
      { v: 2, label: "2 — Necessita estímulos repetidos para despertar ou está obnubilado" },
      { v: 3, label: "3 — Coma / não responde" },
    ],
  },
  {
    id: "1b",
    title: "Perguntas de nível de consciência",
    instruction: "Perguntar: “Qual é o mês atual?” e “Qual é a sua idade?”. Não considerar respostas aproximadas como corretas.",
    options: [
      { v: 0, label: "0 — Responde corretamente às duas perguntas" },
      { v: 1, label: "1 — Responde corretamente a uma" },
      { v: 2, label: "2 — Não responde corretamente a nenhuma" },
    ],
  },
  {
    id: "1c",
    title: "Comandos de nível de consciência",
    instruction: "Solicitar: “Abra e feche os olhos” e “Abra e feche a mão não parética”.",
    options: [
      { v: 0, label: "0 — Executa ambos os comandos corretamente" },
      { v: 1, label: "1 — Executa apenas um comando corretamente" },
      { v: 2, label: "2 — Não executa nenhum comando" },
    ],
  },
  {
    id: "2",
    title: "Olhar",
    instruction: "Avaliar apenas movimentos oculares horizontais, voluntários ou pela manobra oculocefálica.",
    options: [
      { v: 0, label: "0 — Normal" },
      { v: 1, label: "1 — Paralisia parcial do olhar" },
      { v: 2, label: "2 — Desvio forçado ou paralisia total não corrigível pela manobra oculocefálica" },
    ],
  },
  {
    id: "3",
    title: "Campo visual",
    instruction: "Avaliar os campos visuais por confrontação, quadrantes superiores e inferiores.",
    options: [
      { v: 0, label: "0 — Normal" },
      { v: 1, label: "1 — Hemianopsia parcial" },
      { v: 2, label: "2 — Hemianopsia completa" },
      { v: 3, label: "3 — Hemianopsia bilateral / cegueira cortical" },
    ],
  },
  {
    id: "4",
    title: "Paralisia facial",
    instruction: "Solicitar sorriso, mostrar os dentes, elevar as sobrancelhas e fechar os olhos com força.",
    options: [
      { v: 0, label: "0 — Normal" },
      { v: 1, label: "1 — Paralisia facial menor" },
      { v: 2, label: "2 — Paralisia facial parcial" },
      { v: 3, label: "3 — Paralisia facial completa de um ou ambos os lados" },
    ],
  },
  {
    id: "5a",
    title: "Motor — braço direito",
    instruction: "Braço estendido a 90° (sentado) ou 45° (deitado) por 10 segundos.",
    options: [
      { v: 0, label: "0 — Sem queda; mantém o braço por 10 segundos" },
      { v: 1, label: "1 — Queda antes de 10 segundos, mas não toca a cama/superfície" },
      { v: 2, label: "2 — Algum esforço contra a gravidade, mas não consegue manter" },
      { v: 3, label: "3 — Não há esforço contra a gravidade" },
      { v: 4, label: "4 — Nenhum movimento" },
      UN_OPT,
    ],
  },
  {
    id: "5b",
    title: "Motor — braço esquerdo",
    instruction: "Braço estendido a 90° (sentado) ou 45° (deitado) por 10 segundos.",
    options: [
      { v: 0, label: "0 — Sem queda; mantém o braço por 10 segundos" },
      { v: 1, label: "1 — Queda antes de 10 segundos, sem tocar a cama" },
      { v: 2, label: "2 — Algum esforço contra a gravidade, mas não consegue manter" },
      { v: 3, label: "3 — Não há esforço contra a gravidade" },
      { v: 4, label: "4 — Nenhum movimento" },
      UN_OPT,
    ],
  },
  {
    id: "6a",
    title: "Motor — perna direita",
    instruction: "Perna elevada a 30°, em decúbito dorsal, por 5 segundos.",
    options: [
      { v: 0, label: "0 — Sem queda; mantém a posição por 5 segundos" },
      { v: 1, label: "1 — Queda antes de 5 segundos, sem tocar a cama" },
      { v: 2, label: "2 — Algum esforço contra a gravidade, mas não consegue manter" },
      { v: 3, label: "3 — Não há esforço contra a gravidade" },
      { v: 4, label: "4 — Nenhum movimento" },
      UN_OPT,
    ],
  },
  {
    id: "6b",
    title: "Motor — perna esquerda",
    instruction: "Perna elevada a 30°, em decúbito dorsal, por 5 segundos.",
    options: [
      { v: 0, label: "0 — Sem queda; mantém a posição por 5 segundos" },
      { v: 1, label: "1 — Queda antes de 5 segundos, sem tocar a cama" },
      { v: 2, label: "2 — Algum esforço contra a gravidade, mas não consegue manter" },
      { v: 3, label: "3 — Não há esforço contra a gravidade" },
      { v: 4, label: "4 — Nenhum movimento" },
      UN_OPT,
    ],
  },
  {
    id: "7",
    title: "Ataxia de membros",
    instruction: "Dedo-nariz-dedo e calcanhar-joelho bilateralmente. Pontuar somente se presente e desproporcional à fraqueza.",
    options: [
      { v: 0, label: "0 — Ausente" },
      { v: 1, label: "1 — Presente em um membro" },
      { v: 2, label: "2 — Presente em dois membros" },
      UN_OPT,
    ],
  },
  {
    id: "8",
    title: "Sensibilidade",
    instruction: "Avaliar sensibilidade à picada em face, braços, tronco e pernas.",
    options: [
      { v: 0, label: "0 — Normal" },
      { v: 1, label: "1 — Perda sensitiva leve a moderada" },
      { v: 2, label: "2 — Perda sensitiva grave ou total" },
    ],
  },
  {
    id: "9",
    title: "Linguagem",
    instruction: "Avaliar compreensão, nomeação, leitura e produção da linguagem.",
    options: [
      { v: 0, label: "0 — Sem afasia" },
      { v: 1, label: "1 — Afasia leve a moderada" },
      { v: 2, label: "2 — Afasia grave" },
      { v: 3, label: "3 — Mudo / afasia global / ausência de compreensão" },
    ],
  },
  {
    id: "10",
    title: "Disartria",
    instruction: "Avaliar clareza da fala com leitura ou repetição de palavras.",
    options: [
      { v: 0, label: "0 — Normal" },
      { v: 1, label: "1 — Disartria leve a moderada" },
      { v: 2, label: "2 — Disartria grave / fala ininteligível ou anartria" },
      { v: "UN", label: "UN — Intubação ou outra barreira física à fala" },
    ],
  },
  {
    id: "11",
    title: "Extinção / negligência",
    instruction: "Avaliar negligência ou extinção visual, tátil, auditiva ou espacial com estimulação simultânea bilateral.",
    options: [
      { v: 0, label: "0 — Ausente" },
      { v: 1, label: "1 — Negligência/extinção em uma modalidade" },
      { v: 2, label: "2 — Negligência profunda ou hemi-inatenção em mais de uma modalidade" },
    ],
  },
];

export type NihssResult = {
  total: number | null;
  filled: number;
  missing: NihssItemId[];
  untestable: NihssItemId[];
  incomplete: boolean;
};

/** Lógica pura da NIHSS (0–42). Itens UN não somam pontos e são sinalizados. */
export function computeNihss(rec: NihssRecord | undefined): NihssResult {
  const items = rec?.items ?? {};
  const missing: NihssItemId[] = [];
  const untestable: NihssItemId[] = [];
  let total = 0;

  for (const def of NIHSS_ITEMS) {
    const v = items[def.id];
    if (v === undefined || v === null) { missing.push(def.id); continue; }
    if (v === "UN") { untestable.push(def.id); continue; }
    total += v;
  }

  const filled = NIHSS_ITEMS.length - missing.length;
  return {
    total: missing.length === 0 ? total : null,
    filled,
    missing,
    untestable,
    incomplete: missing.length > 0,
  };
}

export function nihssSeverity(total: number): string {
  if (total === 0) return "Sem déficit mensurável";
  if (total <= 4) return "AVC menor";
  if (total <= 15) return "AVC moderado";
  if (total <= 20) return "AVC moderado a grave";
  return "AVC grave";
}

export function NihssButton({
  patient, onClick, compact = false,
}: { patient: Patient; onClick: () => void; compact?: boolean }) {
  const rec = (patient as Patient & { nihss?: NihssRecord }).nihss;
  const total = useMemo(() => computeNihss(rec).total, [rec]);
  const cls = total != null
    ? total >= 16
      ? "bg-clinical-critical/15 text-clinical-critical hover:bg-clinical-critical/25"
      : "bg-clinical-neuro/15 text-clinical-neuro hover:bg-clinical-neuro/25"
    : "border border-border text-muted-foreground hover:bg-surface-3";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left text-[10px] font-semibold transition-colors ${cls}`}
      title="NIHSS — National Institutes of Health Stroke Scale"
    >
      <span className="inline-flex items-center gap-1">
        <Brain className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> NIHSS
        {total != null && <span className="font-mono">{total}/42</span>}
      </span>
      <span className="text-[9px] opacity-90">
        {total != null ? nihssSeverity(total) : "Não avaliado"}
      </span>
    </button>
  );
}

function OptionRow({
  name, options, value, onChange,
}: { name: string; options: { v: NihssValue; label: string }[]; value: NihssValue | undefined; onChange: (v: NihssValue) => void }) {
  return (
    <div className="grid gap-1">
      {options.map((o) => (
        <label
          key={String(o.v)}
          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
            value === o.v ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-surface-3"
          }`}
        >
          <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} className="mt-0.5 accent-current" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function QuickRow({
  def, value, onChange,
}: { def: ItemDef; value: NihssValue | undefined; onChange: (v: NihssValue) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border py-1.5">
      <span className="w-40 shrink-0 text-[11px] font-semibold text-foreground">
        <span className="font-mono">{def.id}</span> · {def.title}
      </span>
      {def.options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`min-w-8 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
            value === o.v ? "border-primary bg-primary/15" : "border-border hover:bg-surface-3"
          }`}
        >
          {o.v}
        </button>
      ))}
    </div>
  );
}

export function NihssModal({
  open, onClose, patient, onSave,
}: { open: boolean; onClose: () => void; patient: Patient; onSave: (p: Patient) => void }) {
  const saved = (patient as Patient & { nihss?: NihssRecord }).nihss ?? {};
  const [mode, setMode] = useState<"guided" | "quick">(saved.mode ?? "guided");
  const [items, setItems] = useState<Partial<Record<NihssItemId, NihssValue>>>(saved.items ?? {});
  const [showResult, setShowResult] = useState<boolean>(saved.total != null);

  const res = useMemo(() => computeNihss({ items }), [items]);

  const set = (id: NihssItemId, v: NihssValue) => {
    setItems((prev) => ({ ...prev, [id]: v }));
    setShowResult(false);
  };

  const calc = () => {
    setShowResult(true);
    onSave({ ...patient, nihss: { mode, items, total: res.total, at: new Date().toISOString() } } as Patient);
  };

  const clear = () => {
    setItems({});
    setShowResult(false);
    onSave({ ...patient, nihss: undefined } as Patient);
  };

  const restart = () => {
    setItems({});
    setMode("guided");
    setShowResult(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-clinical-neuro" />
            Calculadora NIHSS — National Institutes of Health Stroke Scale
          </DialogTitle>
        </DialogHeader>

        {/* Barra fixa: progresso + total */}
        <div className="sticky top-0 z-10 -mx-1 mb-1 rounded-md border-2 border-border bg-surface px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Avaliação: {res.filled}/15 itens
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-primary transition-all" style={{ width: `${(res.filled / 15) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">NIHSS</div>
              <div className="font-mono text-xl font-black text-foreground">
                {res.total != null ? `${res.total}/42` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Modo */}
        <div className="flex gap-2">
          {(["guided", "quick"] as const).map((mo) => (
            <button
              key={mo}
              type="button"
              onClick={() => setMode(mo)}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                mode === mo ? "border-primary bg-primary/10" : "border-border hover:bg-surface-3"
              }`}
            >
              {mo === "guided" ? "Modo guiado" : "Modo rápido"}
            </button>
          ))}
        </div>

        {mode === "guided" ? (
          <div className="space-y-3">
            {NIHSS_ITEMS.map((def) => (
              <div key={def.id} className="rounded-md border border-border p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {def.id} · {def.title}
                </div>
                <p className="mb-1.5 mt-0.5 text-[11px] text-muted-foreground">{def.instruction}</p>
                <OptionRow name={`nihss-${def.id}`} options={def.options} value={items[def.id]} onChange={(v) => set(def.id, v)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border px-2.5 py-1">
            {NIHSS_ITEMS.map((def) => (
              <QuickRow key={def.id} def={def} value={items[def.id]} onChange={(v) => set(def.id, v)} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calc}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Calculator className="h-3.5 w-3.5" /> Calcular NIHSS
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-surface-3"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reiniciar avaliação
          </button>
        </div>

        {showResult && res.incomplete && (
          <div className="flex items-start gap-2 rounded-md border border-clinical-attention/50 bg-clinical-attention/10 px-3 py-2 text-[12px] font-semibold text-clinical-attention">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Avaliação incompleta — preencha todos os itens da NIHSS.
              <span className="block font-normal">Itens pendentes: {res.missing.join(", ")}</span>
            </span>
          </div>
        )}

        {res.untestable.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-clinical-attention" />
            <span>
              Itens marcados como UN (não testável): <strong>{res.untestable.join(", ")}</strong>. Estes itens não são
              somados automaticamente como zero. Confirme a aplicação conforme as regras oficiais da NIHSS e registre a
              justificativa clínica; o total apresentado desconsidera esses itens.
            </span>
          </div>
        )}

        {showResult && res.total != null && (
          <div className="rounded-md border-2 border-border bg-surface p-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">NIHSS</div>
              <div className="font-mono text-4xl font-black text-foreground">{res.total}/42</div>
              <div className="mt-1 text-[12px] font-semibold text-foreground">{nihssSeverity(res.total)}</div>
            </div>
            <div className="mx-auto mt-3 max-w-md text-[11px] text-muted-foreground">
              <div>0 — Sem déficit mensurável</div>
              <div>1–4 — AVC menor</div>
              <div>5–15 — AVC moderado</div>
              <div>16–20 — AVC moderado a grave</div>
              <div>21–42 — AVC grave</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-left">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {NIHSS_ITEMS.map((def) => (
                <tr key={def.id}>
                  <td className="p-2 font-mono">{def.id}</td>
                  <td className="p-2">{def.title}</td>
                  <td className="p-2 font-mono">{items[def.id] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
          <p>
            A NIHSS é uma escala padronizada de avaliação neurológica. Esta calculadora é uma ferramenta de apoio e não
            substitui treinamento formal na aplicação da NIHSS, avaliação médica, exame neurológico completo ou
            protocolos institucionais.
          </p>
          <p>
            A pontuação deve refletir o exame neurológico do paciente no momento da avaliação. Não utilize o resultado
            isoladamente para determinar diagnóstico, tratamento ou prognóstico.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
