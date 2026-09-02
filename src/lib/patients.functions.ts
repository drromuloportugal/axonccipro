import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Patient } from "@/data/patients";

/** Lista todos os pacientes salvos no banco, na ordem definida pela equipe. */
export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("data, position")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    return { patients: (data ?? []).map((r) => r.data as unknown as Patient) };
  });

/** Substitui a lista completa de pacientes (upsert + remoção dos ausentes). */
export const savePatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { patients: Patient[] }) => {
    if (!data || !Array.isArray(data.patients)) throw new Error("Lista inválida");
    return { patients: data.patients.filter((p) => p && typeof p.id === "string") };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;

    const rows = data.patients.map((p, i) => ({
      id: p.id,
      data: p as unknown as never,
      position: i,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await db.from("patients").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    const keep = rows.map((r) => r.id);
    const del = db.from("patients").delete();
    const { error: delError } = keep.length
      ? await del.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`)
      : await del.neq("id", "");
    if (delError) throw new Error(delError.message);

    return { ok: true as const, count: rows.length };
  });
