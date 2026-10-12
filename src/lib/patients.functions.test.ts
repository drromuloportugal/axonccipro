import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Patient } from "@/data/patients";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

import { deletePatient, listPatients, savePatients } from "./patients.functions";

const patient = { id: "patient-1", name: "Paciente de teste" } as Patient;

describe("persistência de pacientes", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("lê snapshots ordenados da tabela de pacientes do painel", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ data: patient, position: 0 }, { data: {}, position: 1 }],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    from.mockReturnValue({ select });

    await expect(listPatients()).resolves.toEqual({ patients: [patient] });
    expect(from).toHaveBeenCalledWith("passometro_patient_snapshots");
    expect(select).toHaveBeenCalledWith("data, position");
    expect(order).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("faz upsert sem executar exclusão global", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn();
    from.mockReturnValue({ upsert, delete: remove });

    await expect(savePatients({ data: { patients: [patient] } })).resolves.toMatchObject({
      ok: true,
      count: 1,
    });

    expect(from).toHaveBeenCalledWith("passometro_patient_snapshots");
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          patient_id: "patient-1",
          data: patient,
          position: 0,
        }),
      ],
      { onConflict: "patient_id" },
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("não grava nem apaga nada quando a lista está vazia", async () => {
    await expect(savePatients({ data: { patients: [] } })).resolves.toMatchObject({
      ok: true,
      count: 0,
    });

    expect(from).not.toHaveBeenCalled();
  });

  it("remove somente o identificador explicitamente escolhido", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: remove });

    await expect(deletePatient(" patient-1 ")).resolves.toBeUndefined();

    expect(from).toHaveBeenCalledWith("passometro_patient_snapshots");
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("patient_id", "patient-1");
  });
});

