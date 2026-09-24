import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/data/patients";

/** Lista todos os pacientes salvos no Supabase. */
export async function listPatients(): Promise<{ patients: Patient[] }> {
  const { data, error } = await supabase
    .from("patients")
    .select("data, position")
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    patients: (data ?? [])
      .map((row) => row.data as unknown as Patient)
      .filter((patient) => Boolean(patient?.id)),
  };
}

/** Persiste a lista de pacientes no Supabase. */
export async function savePatients(
  input: { data: { patients: Patient[] } },
): Promise<{ ok: true; count: number }> {
  const patients = input?.data?.patients;

  if (!Array.isArray(patients)) {
    throw new Error("Lista de pacientes inválida");
  }

  const sanitized = patients.filter(
    (patient): patient is Patient =>
      Boolean(patient) &&
      typeof patient.id === "string" &&
      patient.id.trim().length > 0,
  );

  const rows = sanitized.map((patient, position) => ({
    id: patient.id,
    data: patient as unknown as never,
    position,
    updated_at: new Date().toISOString(),
  }));

  // Salva/atualiza os pacientes no Supabase
  if (rows.length > 0) {
    const { error } = await supabase
      .from("patients")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  // Remove do banco pacientes que não existem mais na lista atual
  const keepIds = rows.map((row) => row.id);

  const { error: deleteError } = keepIds.length
    ? await supabase
        .from("patients")
        .delete()
        .not(
          "id",
          "in",
          `(${keepIds
            .map((id) => `"${id.replace(/"/g, '""')}"`)
            .join(",")})`,
        )
    : await supabase
        .from("patients")
        .delete()
        .neq("id", "");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return {
    ok: true,
    count: rows.length,
  };
}
