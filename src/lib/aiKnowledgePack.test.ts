import { describe, expect, it } from "vitest";
import type { Patient } from "@/data/patients";
import { buildKnowledgePack } from "./aiKnowledgePack";

const patient = {
  id: "patient-column-data",
  name: "Paciente Teste",
  bed: "UTI-05",
  conducts: [
    {
      team: "MED",
      text: "",
      system: "infection",
      subItems: [
        { text: "Resultado favorável", color: "green" },
        { text: "Nova conduta definida", color: "purple" },
      ],
    },
  ],
  cultures: [
    {
      id: "culture-1",
      source: "Hemocultura",
      collectedAt: "2025-01-01T10:00:00.000Z",
      result: "positiva",
      organism: "Klebsiella pneumoniae",
      sensitivities: ["meropenem"],
      resistances: ["ceftriaxona"],
    },
  ],
  imaging: [
    {
      id: "image-1",
      modality: "TC",
      region: "Crânio",
      performedAt: "2025-01-01T11:00:00.000Z",
      summary: "Sem nova hemorragia",
      conclusion: "Estável",
      outcome: "bom",
      status: "realizado",
    },
  ],
} as Patient;

describe("Call Axon — colunas 5 e 7", () => {
  it("mantém culturas e imagens antigas no pacote inteligente e as vincula ao paciente", () => {
    const { pack } = buildKnowledgePack([patient], { scope: "smart", anonymize: true });
    const profile = pack.patients[0];

    expect(pack.microbiology).toHaveLength(1);
    expect(pack.imaging).toHaveLength(1);
    expect(profile.COLUMN_5_RECORDS.MICROBIOLOGY_RECORDS).toEqual(pack.microbiology);
    expect(profile.COLUMN_5_RECORDS.IMAGING_RECORDS).toEqual(pack.imaging);
    expect(pack.microbiology[0]).toMatchObject({
      PATIENT_ID: profile.PATIENT_ID,
      ORGANISM: "Klebsiella pneumoniae",
    });
    expect(pack.imaging[0]).toMatchObject({
      PATIENT_ID: profile.PATIENT_ID,
      SUMMARY: "Sem nova hemorragia",
      EXPECTED_OUTCOME: "bom",
    });
  });

  it("exporta condutas coloridas e ensina a IA a interpretar as cores", () => {
    const { pack } = buildKnowledgePack([patient], { scope: "complete", anonymize: true });
    const annotations = pack.clinical_conducts[0].ANNOTATIONS;

    expect(annotations[0]).toMatchObject({ COLOR_CODE: "green", COLOR_MEANING: "Bom resultado." });
    expect(annotations[1]).toMatchObject({ COLOR_CODE: "purple", COLOR_MEANING: "Conduta nova." });
    expect(pack.ai_instructions.CONDUCT_COLOR_TUTORIAL.COLOR_MEANINGS).toMatchObject({
      yellow: "Atenção.",
      orange: "Mantém conduta.",
      red: "Sinal de alerta.",
    });
  });
});