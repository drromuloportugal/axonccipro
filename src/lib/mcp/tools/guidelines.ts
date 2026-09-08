import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { DOMAIN_LABEL, type Domain } from "@/lib/clinicalEngine";
import { evidenceByDomain } from "@/lib/clinicalEngine/evidence";

const DOMAINS = Object.keys(DOMAIN_LABEL) as Domain[];

export default defineTool({
  name: "search_guidelines",
  title: "Consultar biblioteca de diretrizes",
  description:
    "Consulta a biblioteca de evidências versionada do app (SSC 2026, PADIS 2018/2025, diretrizes neurocríticas, renais, ventilatórias e outras) por domínio ou termo, com sociedade, versão, ano e força/certeza.",
  inputSchema: {
    domain: z
      .string()
      .optional()
      .describe(`Domínio clínico. Valores: ${DOMAINS.join(", ")}.`),
    query: z.string().optional().describe("Termo livre para filtrar tópico ou statement."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ domain, query }) => {
    const domains = domain && DOMAINS.includes(domain as Domain) ? [domain as Domain] : DOMAINS;
    const q = query?.trim().toLowerCase();
    const refs = domains
      .flatMap((d) => evidenceByDomain(d))
      .filter(
        (e) =>
          !q ||
          e.topic.toLowerCase().includes(q) ||
          e.statement.toLowerCase().includes(q) ||
          e.document.toLowerCase().includes(q),
      );
    const unique = [...new Map(refs.map((e) => [e.code, e])).values()];
    const text = unique.length
      ? unique
          .map(
            (e) =>
              `- ${e.society} · ${e.document} ${e.version} (${e.year}) · ${e.topic}\n  ${e.statement}${e.strength ? `\n  força: ${e.strength}` : ""}${e.certainty ? ` · certeza: ${e.certainty}` : ""}\n  ${e.url}`,
          )
          .join("\n")
      : "Nenhuma recomendação encontrada com esses filtros.";
    return {
      content: [{ type: "text", text }],
      structuredContent: JSON.parse(JSON.stringify({ guidelines: unique })) as Record<
        string,
        never
      >,
    };
  },
});
