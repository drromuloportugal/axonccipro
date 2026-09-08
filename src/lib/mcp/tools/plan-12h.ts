import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runClinicalEngine } from "@/lib/clinicalEngine";
import { findPatient } from "../patients";

export default defineTool({
  name: "plan_next_12h",
  title: "Plano das próximas 12 h",
  description:
    "Gera o plano de monitorização e reavaliação das próximas 12 h (janela 07:00→19:00 ou 19:00→07:00) para o paciente. Não prescreve nem executa condutas.",
  inputSchema: { patient: z.string().describe("Id, leito ou parte do nome do paciente.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ patient }, ctx) => {
    const record = await findPatient(ctx, patient);
    const { plan, patientLabel, missing } = runClinicalEngine(record, { intent: "plan" });
    const text = [
      `# Plano ${plan[0]?.window ?? "12 h"} — ${patientLabel}`,
      ...plan.map((t) => `- [${t.time}] ${t.priority.toUpperCase()} · ${t.text}`),
      "",
      "## Dados faltantes",
      ...(missing.length ? missing.map((m) => `- ${m.label}: ${m.impact}`) : ["- Nenhum"]),
    ].join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: JSON.parse(JSON.stringify({ plan, missing })) as Record<string, never>,
    };
  },
});
