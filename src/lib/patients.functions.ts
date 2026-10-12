import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/data/patients";

const PATIENT_SNAPSHOTS_TABLE = "passometro_patient_snapshots" as const;

/** Lista todos os pacientes salvos no Supabase. */
export async function listPatients(): Promise<{ patients: Patient[] }> {
  const { data, error } = await supabase
    .from(PATIENT_SNAPSHOTS_TABLE)
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

/**
 * Persiste os pacientes informados sem reconciliar a tabela inteira.
 *
 * Exclusões precisam passar por deletePatient: uma falha de leitura nunca pode
 * transformar uma lista vazia temporária em uma exclusão em massa.
 */
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
    patient_id: patient.id,
    data: patient as unknown as never,
    position,
    updated_at: new Date().toISOString(),
  }));

  // Salva/atualiza os pacientes no Supabase. Não remove registros ausentes
  // desta lista: a remoção é sempre uma ação explícita e individual.
  if (rows.length > 0) {
    const { error } = await supabase
      .from(PATIENT_SNAPSHOTS_TABLE)
      .upsert(rows, { onConflict: "patient_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    ok: true,
    count: rows.length,
  };
}

/** Remove somente o paciente escolhido pelo usuário. */
export async function deletePatient(patientId: string): Promise<void> {
  const normalizedId = patientId.trim();

  if (!normalizedId) {
    throw new Error("Identificador do paciente inválido");
  }

  const { error } = await supabase
    .from(PATIENT_SNAPSHOTS_TABLE)
    .delete()
    .eq("patient_id", normalizedId);

  if (error) {
    throw new Error(error.message);
  }
}

