import { defineTool } from "@lovable.dev/mcp-js";
import { fetchPatients } from "../patients";

export default defineTool({
  name: "list_patients",
  title: "Listar pacientes",
  description:
    "Lista os pacientes do passômetro visíveis para o usuário autenticado (id, leito, nome, diagnóstico).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const patients = await fetchPatients(ctx);
    const rows = patients.map((p) => ({
      id: p.id,
      bed: p.bed ?? null,
      name: p.name ?? null,
      diagnosis: p.diagnosis ?? null,
    }));
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? rows.map((r) => `${r.bed ?? "—"} · ${r.name ?? r.id} · ${r.diagnosis ?? "—"}`).join("\n")
            : "Nenhum paciente cadastrado.",
        },
      ],
      structuredContent: { patients: rows },
    };
  },
});
