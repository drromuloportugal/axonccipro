import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runClinicalEngine } from "@/lib/clinicalEngine";
import { findPatient } from "../patients";

export default defineTool({
  name: "fasthug_maidens",
  title: "Checklist FASTHUG-MAIDENS",
  description:
    "Executa o checklist FASTHUG-MAIDENS do paciente com status (OK / PENDENTE / ATENÇÃO / CONTRAINDICADO / SEM DADO), justificativa e sugestões.",
  inputSchema: { patient: z.string().describe("Id, leito ou parte do nome do paciente.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ patient }, ctx) => {
    const record = await findPatient(ctx, patient);
    const { fasthug, patientLabel } = runClinicalEngine(record, { intent: "fasthug" });
    const text = [
      `# FASTHUG-MAIDENS — ${patientLabel}`,
      ...fasthug.map((i) => `- ${i.letter} ${i.title} [${i.status.toUpperCase()}]`),
    ].join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: JSON.parse(JSON.stringify({ fasthug })) as Record<string, never>,
    };
  },
});
