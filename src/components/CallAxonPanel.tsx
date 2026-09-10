import { useMemo, useState } from "react";
import { X, Download, Copy, ShieldCheck, Sparkles, Database, Check } from "lucide-react";
import { toast } from "sonner";
import type { Patient } from "@/data/patients";
import {
  buildKnowledgePack,
  downloadKnowledgePack,
  knowledgePackFileName,
  readLastPackRecord,
  writeLastPackRecord,
  type PackScope,
} from "@/lib/aiKnowledgePack";

interface Props {
  patients: Patient[];
  onClose: () => void;
}

/** CALL AXON — gera o pacote de conhecimento clínico estruturado para IA. */
export function CallAxonPanel({ patients, onClose }: Props) {
  const [scope, setScope] = useState<PackScope>("smart");
  const [anonymize, setAnonymize] = useState(true);
  const [hospital, setHospital] = useState("");
  const [unit, setUnit] = useState("UTI");
  const [built, setBuilt] = useState<{ pack: unknown; fileName: string; report: string } | null>(
    null,
  );

  const active = useMemo(() => patients.filter((p) => !p.archived), [patients]);

  function generate() {
    const previous = readLastPackRecord();
    const { pack, record } = buildKnowledgePack(active, {
      scope,
      anonymize,
      hospital: hospital.trim() || undefined,
      unit: unit.trim() || undefined,
      previous,
    });
    writeLastPackRecord(record);
    const fileName = knowledgePackFileName(pack);
    const q = pack.data_quality_report;
    const report = [
      `Packet ID: ${pack.package.PACKET_ID}`,
      `Versão: ${pack.package.VERSION} · ${pack.package.SCOPE}`,
      `Pacientes: ${pack.package.NUMBER_OF_PATIENTS}`,
      `Período analisado: ${pack.package.DATA_START} → ${pack.package.DATA_END}`,
      `Registros analisados: ${q.registros_analisados}`,
      `Conflitos: ${q.conflitos.length} · Dados incompletos: ${q.dados_incompletos.length} · Duplicidades: ${q.duplicidades.length}`,
      `Eventos: ${pack.events.length} · Exames: ${pack.labs.length} · Problemas ativos: ${pack.problems.length} · Pendências: ${pack.pending_tasks.length}`,
      `Exames de imagem: ${pack.imaging.length} · Culturas / microbiologia: ${pack.microbiology.length} · Focos infecciosos: ${pack.infection_foci.length}`,
      `Condutas da coluna 7: ${pack.clinical_conducts.length} · Tutorial de cores: incluído`,
      `Identificação: ${anonymize ? "anonimizada (A01, A02…)" : "institucional identificada"}`,
    ].join("\n");
    setBuilt({ pack, fileName, report });
    toast.success("Pacote clínico gerado", { description: fileName });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/30 shadow-2xl"
        style={{
          background:
            "linear-gradient(140deg, oklch(0.42 0.14 155), oklch(0.30 0.05 240) 45%, oklch(0.42 0.14 235))",
        }}
      >
        <div className="flex items-center justify-between border-b border-white/20 px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5" />
            <div>
              <h2 className="text-sm font-bold tracking-wide">CALL AXON</h2>
              <p className="text-[11px] text-white/70">
                Pacote de conhecimento clínico para leitura por IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-white">
          {/* Escopo */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                {
                  v: "smart" as PackScope,
                  t: "Pacote clínico inteligente",
                  d: "Estado atual, últimas 48h, eventos principais, tendências, problemas, pendências e escores.",
                },
                {
                  v: "complete" as PackScope,
                  t: "Pacote clínico completo",
                  d: "Todo o histórico disponível de cada paciente, sem recorte temporal.",
                },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setScope(o.v)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  scope === o.v
                    ? "border-white/80 bg-white/20"
                    : "border-white/25 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[12px] font-bold">
                  {scope === o.v && <Check className="h-3.5 w-3.5" />}
                  {o.t}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-white/75">{o.d}</p>
              </button>
            ))}
          </div>

          {/* Identificação */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold">
              Hospital
              <input
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Nome da instituição"
                className="mt-1 w-full rounded-md border border-white/30 bg-white/10 px-2 py-1.5 text-[12px] text-white outline-none placeholder:text-white/50 focus:border-white/70"
              />
            </label>
            <label className="text-[11px] font-semibold">
              Unidade
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/30 bg-white/10 px-2 py-1.5 text-[12px] text-white outline-none placeholder:text-white/50 focus:border-white/70"
              />
            </label>
          </div>

          <button
            onClick={() => setAnonymize((a) => !a)}
            className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
              anonymize ? "border-white/80 bg-white/20" : "border-white/25 bg-white/5"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[12px] font-bold">
              {anonymize ? "Exportação anonimizada (recomendada)" : "Exportação identificada"}
            </span>
            <span className="ml-auto text-[11px] text-white/70">
              {anonymize ? "nomes → A01, A02…" : "uso interno"}
            </span>
          </button>

          <div className="rounded-xl border border-white/20 bg-white/5 p-3 text-[11px] leading-relaxed text-white/80">
            O pacote inclui identidade, índice clínico, índice semântico, índice temporal, perfis,
            resumo de uma página, linha do tempo, culturas, antibiogramas, exames de imagem,
            condutas da coluna 7 com tutorial de cores, tendências, problemas ativos, pendências,
            escores, comparação entre pacientes, mapa de origem e instruções para a IA. Cada
            cultura, imagem e conduta fica vinculada ao paciente. Dados ausentes são marcados como
            MISSING — nada é inventado.
          </div>

          <button
            onClick={generate}
            disabled={active.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-slate-800 shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            Gerar pacote clínico ({active.length} paciente{active.length === 1 ? "" : "s"})
          </button>

          {built && (
            <div className="space-y-3 rounded-xl border border-white/25 bg-white/10 p-3">
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white">
                {built.report}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadKnowledgePack(built.pack, built.fileName)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar {built.fileName}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(built.pack));
                      toast.success("Pacote copiado — cole no ChatGPT/NETO");
                    } catch {
                      toast.error("Não foi possível copiar; use o download do arquivo");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
