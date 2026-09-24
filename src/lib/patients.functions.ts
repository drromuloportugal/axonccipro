import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Patient } from "@/data/patients";

/** Lista a cópia central de pacientes compartilhada pela equipe autenticada. */
export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("passometro_patient_snapshots")
      .select("data, position")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    return { patients: (data ?? []).map((r) => r.data as unknown as Patient) };
  });

/** Substitui a cópia central de pacientes compartilhada pela equipe autenticada. */
export const savePatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { patients: Patient[] }) => {
    if (!data || !Array.isArray(data.patients)) throw new Error("Lista inválida");
    return { patients: data.patients.filter((p) => p && typeof p.id === "string") };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;

    const rows = data.patients.map((p, i) => ({
      patient_id: p.id,
      data: p as unknown as never,
      position: i,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await db
        .from("passometro_patient_snapshots")
        .upsert(rows, { onConflict: "patient_id" });
      if (error) throw new Error(error.message);
    }

    const keep = rows.map((r) => r.patient_id);
    const del = db.from("passometro_patient_snapshots").delete();
    const { error: delError } = keep.length
      ? await del.not("patient_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`)
      : await del;
    if (delError) throw new Error(delError.message);

    return { ok: true as const, count: rows.length };
  });
