import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runClinicalEngine, type EngineIntent } from "@/lib/clinicalEngine";
import { findPatient } from "../patients";

const INTENTS = [
  "full",
  "fasthug",
  "scores",
  "guidelines",
  "plan",
  "pending",
  "medications",
  "ventilation",
  "hemodynamics",
  "renal",
  "neuro",
  "infection",
  "devices",
  "timeline",
] as const;

export default defineTool({
  name: "analyze_patient",
  title: "Analisar paciente (Motor Clínico)",
  description:
    "Executa o Motor Clínico determinístico do passômetro para um paciente: problemas, escores, achados priorizados, dados faltantes, conflitos, diretrizes e plano das próximas 12 h.",
  inputSchema: {
    patient: z.string().describe("Id, leito ou parte do nome do paciente."),
    focus: z
      .enum(INTENTS)
      .optional()
      .describe("Foco da análise. Padrão: full (pipeline completo)."),
    question: z.string().optional().describe("Pergunta clínica em linguagem natural."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ patient, focus, question }, ctx) => {
    const record = await findPatient(ctx, patient);
    const result = runClinicalEngine(record, {
      intent: focus as EngineIntent | undefined,
      question,
    });

    const lines = [
      `# ${result.patientLabel}`,
      result.summary,
      "",
      "## Problemas",
      ...result.problems.map((p) => `- ${p}`),
      "",
      "## Escores",
      ...result.scores.map((s) =>
        s.available
          ? `- ${s.label}: ${s.value ?? "—"} ${s.interpretation ?? ""}`.trim()
          : `- ${s.label}: DADO NÃO INFORMADO (${s.missing.join(", ")})`,
      ),
      "",
      "## Achados priorizados",
      ...result.findings.map(
        (f) =>
          [
            `- ${f.priority.toUpperCase()} · ${f.title}`,
            `  POR QUE: ${f.why.join("; ")}`,
            ...f.recommendations.map(
              (r) =>
                `  RECOMENDAÇÃO: ${r.text} — monitorizar: ${r.monitoring}${
                  r.evidence
                    ? ` (FONTE: ${r.evidence.society} ${r.evidence.document} ${r.evidence.version}${r.evidence.strength ? `, ${r.evidence.strength}` : ""})`
                    : ""
                }`,
            ),
          ].join("\n"),
      ),
      "",
      "## Dados faltantes",
      ...result.missing.map((m) => `- ${m.label}: ${m.impact}`),
      "",
      "## Conflitos entre diretrizes",
      ...(result.conflicts.length
        ? result.conflicts.map((c) => `- ${c.topic}: ${c.guideline} vs ${c.institutional}`)
        : ["- Nenhum"]),
      "",
      "## Não é possível concluir",
      ...(result.inconclusive.length ? result.inconclusive.map((i) => `- ${i}`) : ["- Nada"]),
      "",
      `## Plano ${result.plan[0]?.window ?? ""}`,
      ...result.plan.map((t) => `- [${t.time}] ${t.text}`),
    ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: JSON.parse(JSON.stringify({ result })) as Record<string, never>,
    };
  },
});
