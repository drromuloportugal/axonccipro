import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runClinicalEngine } from "@/lib/clinicalEngine";
import { findPatient } from "../patients";

export default defineTool({
  name: "patient_scores",
  title: "Escores do paciente",
  description:
    "Retorna os escores disponíveis do paciente (SOFA, qSOFA, NEWS2, P/F e escores neurocríticos registrados) com os componentes usados e o que falta para calcular os indisponíveis.",
  inputSchema: { patient: z.string().describe("Id, leito ou parte do nome do paciente.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patient }, ctx) => {
    const record = await findPatient(ctx, patient);
    const { scores, patientLabel } = runClinicalEngine(record, { intent: "scores" });
    const text = [
      `# Escores — ${patientLabel}`,
      ...scores.map((s) =>
        s.available
          ? `- ${s.label}: ${s.value ?? "—"} — ${s.interpretation} (${s.source})\n  componentes: ${s.components.map((c) => `${c.label}=${c.value}`).join(", ")}`
          : `- ${s.label}: DADO NÃO INFORMADO — falta ${s.missing.join(", ")}`,
      ),
    ].join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: JSON.parse(JSON.stringify({ scores })) as Record<string, never>,
    };
  },
});
