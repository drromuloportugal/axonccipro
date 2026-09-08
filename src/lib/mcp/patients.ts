// Acesso aos pacientes do passômetro para as ferramentas MCP.
import type { ToolContext } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
import type { Patient } from "@/data/patients";
import { supabaseForUser } from "./supabase";

export async function fetchPatients(ctx: ToolContext): Promise<Patient[]> {
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("patients")
    .select("data, position")
    .order("position", { ascending: true });
  if (error) throw new ToolError(error.message);
  return (data ?? []).map((r) => r.data as unknown as Patient);
}

/** Resolve um paciente por id, leito ou parte do nome. */
export async function findPatient(ctx: ToolContext, query: string): Promise<Patient> {
  const patients = await fetchPatients(ctx);
  const q = query.trim().toLowerCase();
  const match =
    patients.find((p) => p.id?.toLowerCase() === q) ??
    patients.find((p) => String(p.bed ?? "").toLowerCase() === q) ??
    patients.find((p) => (p.name ?? "").toLowerCase().includes(q));
  if (!match) {
    throw new ToolError(
      `Nenhum paciente encontrado para "${query}". Use list_patients para ver os leitos disponíveis.`,
    );
  }
  return match;
}
