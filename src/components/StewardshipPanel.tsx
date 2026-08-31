import { useMemo, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import type { Patient } from "@/data/patients";
import { runStewardship, severityMeta, STEWARDSHIP_DISCLAIMER } from "@/lib/stewardship";

/** Motor inteligente de stewardship antimicrobiano — apoio à decisão clínica. */
export function StewardshipPanel({ patient }: { patient: Patient }) {
  const alerts = useMemo(() => runStewardship(patient), [patient]);
  const [open, setOpen] = useState<string | null>(alerts[0]?.id ?? null);

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Motor inteligente · Stewardship antimicrobiano
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">{alerts.length} alerta(s)</span>
      </div>

      {alerts.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          Nenhuma oportunidade de otimização identificada com os dados atuais.
        </div>
      )}

      <ul className="space-y-1.5">
        {alerts.map((a) => {
          const s = severityMeta(a.severity);
          const isOpen = open === a.id;
          return (
            <li key={a.id} className={`rounded-md border ${s.className.replace(/text-\S+/, "")} bg-background/60`}>
              <button
                onClick={() => setOpen(isOpen ? null : a.id)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px]"
              >
                <span>{s.icon}</span>
                <span className={`flex-1 font-semibold ${s.className.split(" ").find((c) => c.startsWith("text-")) ?? ""}`}>
                  {a.title}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <dl className="space-y-1 border-t border-border px-3 py-2 text-[11px]">
                  <Row k="Dado observado" v={a.data} />
                  <Row k="Motivo do alerta" v={a.reason} />
                  <Row k="Tendência" v={a.trend} />
                  <Row k="Possível implicação" v={a.implication} />
                  <Row k="Recomendação" v={a.recommendation} />
                  <Row k="Fonte / protocolo" v={a.source} />
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 text-[9px] text-muted-foreground">{STEWARDSHIP_DISCLAIMER}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
