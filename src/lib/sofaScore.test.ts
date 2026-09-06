import { describe, expect, it } from "vitest";
import {
  calculateCardiovascularSOFA,
  calculateCoagulationSOFA,
  calculateLiverSOFA,
  calculateNeurologicalSOFA,
  calculateRenalSOFA,
  calculateRespiratorySOFA,
  calculateTotalSOFA,
  compareAssessments,
  detectRound,
  emptySofaInputs,
  validateSofaInputs,
  type SofaAssessment,
} from "./sofaScore";

const resp = (pao2: number, fio2: number, sup: boolean) =>
  calculateRespiratorySOFA(pao2, fio2, sup).score;

describe("respiratório", () => {
  it("limites com suporte respiratório", () => {
    expect(resp(100, 100, true)).toBe(4); // ratio 100
    expect(resp(99, 100, true)).toBe(4);
    expect(resp(199, 100, true)).toBe(3);
    expect(resp(200, 100, true)).toBe(2);
    expect(resp(299, 100, true)).toBe(2);
    expect(resp(300, 100, true)).toBe(1);
    expect(resp(399, 100, true)).toBe(1);
    expect(resp(400, 100, true)).toBe(0);
  });
  it("sem suporte respiratório limita em 2", () => {
    expect(resp(99, 100, false)).toBe(2);
    expect(resp(150, 100, false)).toBe(2);
    expect(resp(350, 100, false)).toBe(1);
  });
  it("aceita FiO2 em decimal e exige ambos os dados", () => {
    expect(calculateRespiratorySOFA(90, 0.9, true).score).toBe(3); // 100
    expect(calculateRespiratorySOFA(null, 50, true).score).toBeNull();
    expect(calculateRespiratorySOFA(90, null, true).score).toBeNull();
  });
});

describe("coagulação", () => {
  it("limites de plaquetas", () => {
    expect(calculateCoagulationSOFA(19).score).toBe(4);
    expect(calculateCoagulationSOFA(20).score).toBe(3);
    expect(calculateCoagulationSOFA(49).score).toBe(3);
    expect(calculateCoagulationSOFA(50).score).toBe(2);
    expect(calculateCoagulationSOFA(99).score).toBe(2);
    expect(calculateCoagulationSOFA(100).score).toBe(1);
    expect(calculateCoagulationSOFA(149).score).toBe(1);
    expect(calculateCoagulationSOFA(150).score).toBe(0);
    expect(calculateCoagulationSOFA(null).score).toBeNull();
  });
  it("normaliza valor absoluto", () => {
    expect(calculateCoagulationSOFA(85000).score).toBe(2);
  });
});

describe("fígado", () => {
  it("limites de bilirrubina", () => {
    expect(calculateLiverSOFA(1.19).score).toBe(0);
    expect(calculateLiverSOFA(1.2).score).toBe(1);
    expect(calculateLiverSOFA(1.9).score).toBe(1);
    expect(calculateLiverSOFA(2.0).score).toBe(2);
    expect(calculateLiverSOFA(5.9).score).toBe(2);
    expect(calculateLiverSOFA(6.0).score).toBe(3);
    expect(calculateLiverSOFA(11.9).score).toBe(3);
    expect(calculateLiverSOFA(12.0).score).toBe(4);
    expect(calculateLiverSOFA(null).score).toBeNull();
  });
});

describe("cardiovascular", () => {
  it("PAM isolada", () => {
    expect(calculateCardiovascularSOFA(70, "none", null).score).toBe(0);
    expect(calculateCardiovascularSOFA(69, "none", null).score).toBe(1);
    expect(calculateCardiovascularSOFA(null, "none", null).score).toBeNull();
  });
  it("dopamina e dobutamina", () => {
    expect(calculateCardiovascularSOFA(80, "dobutamina", null).score).toBe(2);
    expect(calculateCardiovascularSOFA(80, "dopamina", 5).score).toBe(2);
    expect(calculateCardiovascularSOFA(80, "dopamina", 5.1).score).toBe(3);
    expect(calculateCardiovascularSOFA(80, "dopamina", 15).score).toBe(3);
    expect(calculateCardiovascularSOFA(80, "dopamina", 15.1).score).toBe(4);
  });
  it("noradrenalina e adrenalina", () => {
    expect(calculateCardiovascularSOFA(80, "noradrenalina", 0.1).score).toBe(3);
    expect(calculateCardiovascularSOFA(80, "noradrenalina", 0.11).score).toBe(4);
    expect(calculateCardiovascularSOFA(80, "adrenalina", 0.05).score).toBe(3);
    expect(calculateCardiovascularSOFA(80, "adrenalina", 0.2).score).toBe(4);
  });
  it("usa o maior critério e exige dose", () => {
    expect(calculateCardiovascularSOFA(50, "noradrenalina", 0.3).score).toBe(4);
    expect(calculateCardiovascularSOFA(50, "noradrenalina", null).score).toBeNull();
  });
});

describe("SNC", () => {
  it("faixas de Glasgow", () => {
    expect(calculateNeurologicalSOFA(15).score).toBe(0);
    expect(calculateNeurologicalSOFA(14).score).toBe(1);
    expect(calculateNeurologicalSOFA(13).score).toBe(1);
    expect(calculateNeurologicalSOFA(12).score).toBe(2);
    expect(calculateNeurologicalSOFA(10).score).toBe(2);
    expect(calculateNeurologicalSOFA(9).score).toBe(3);
    expect(calculateNeurologicalSOFA(6).score).toBe(3);
    expect(calculateNeurologicalSOFA(5).score).toBe(4);
    expect(calculateNeurologicalSOFA(3).score).toBe(4);
  });
  it("valores fora da faixa não pontuam", () => {
    expect(calculateNeurologicalSOFA(16).score).toBeNull();
    expect(calculateNeurologicalSOFA(2).score).toBeNull();
    expect(calculateNeurologicalSOFA(null).score).toBeNull();
  });
});

describe("renal", () => {
  it("limites de creatinina", () => {
    expect(calculateRenalSOFA(1.19, null).score).toBe(0);
    expect(calculateRenalSOFA(1.2, null).score).toBe(1);
    expect(calculateRenalSOFA(1.9, null).score).toBe(1);
    expect(calculateRenalSOFA(2.0, null).score).toBe(2);
    expect(calculateRenalSOFA(3.4, null).score).toBe(2);
    expect(calculateRenalSOFA(3.5, null).score).toBe(3);
    expect(calculateRenalSOFA(4.9, null).score).toBe(3);
    expect(calculateRenalSOFA(5.0, null).score).toBe(4);
  });
  it("débito urinário e maior escore aplicável", () => {
    expect(calculateRenalSOFA(null, 199).score).toBe(4);
    expect(calculateRenalSOFA(null, 200).score).toBe(3);
    expect(calculateRenalSOFA(null, 499).score).toBe(3);
    expect(calculateRenalSOFA(null, 500).score).toBe(0);
    expect(calculateRenalSOFA(1.0, 150).score).toBe(4);
    expect(calculateRenalSOFA(5.5, 2000).score).toBe(4);
    expect(calculateRenalSOFA(null, null).score).toBeNull();
  });
});

describe("total", () => {
  it("dado ausente não vira zero", () => {
    const r = calculateTotalSOFA(emptySofaInputs());
    expect(r.total).toBeNull();
    expect(r.partial).toBe(true);
    expect(r.missing).toHaveLength(6);
  });
  it("soma apenas componentes calculáveis", () => {
    const inputs = {
      ...emptySofaInputs(),
      pao2: 180,
      fio2: 100,
      respSupport: true,
      platelets: 90,
      bilirubin: 2.5,
      map: 65,
      gcsTotal: 11,
    };
    const r = calculateTotalSOFA(inputs);
    expect(r.scores.resp).toBe(3);
    expect(r.scores.coag).toBe(2);
    expect(r.scores.liver).toBe(2);
    expect(r.scores.cardio).toBe(1);
    expect(r.scores.cns).toBe(2);
    expect(r.scores.renal).toBeNull();
    expect(r.total).toBe(10);
    expect(r.partial).toBe(true);
  });
  it("SOFA máximo é 24", () => {
    const r = calculateTotalSOFA({
      ...emptySofaInputs(),
      pao2: 50,
      fio2: 100,
      respSupport: true,
      platelets: 10,
      bilirubin: 20,
      map: 40,
      vasopressor: "noradrenalina",
      vasoDose: 0.5,
      gcsTotal: 3,
      creatinine: 6,
      urineOutput: 100,
    });
    expect(r.total).toBe(24);
    expect(r.partial).toBe(false);
  });
});

describe("validação", () => {
  it("sinaliza valores inválidos", () => {
    const issues = validateSofaInputs({
      ...emptySofaInputs(),
      fio2: 120,
      platelets: -1,
      creatinine: -2,
      urineOutput: -5,
      gcsTotal: 18,
      vasopressor: "noradrenalina",
    });
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("fio2");
    expect(fields).toContain("platelets");
    expect(fields).toContain("creatinine");
    expect(fields).toContain("urineOutput");
    expect(fields).toContain("gcsTotal");
    expect(fields).toContain("vasoDose");
  });
  it("entrada válida não gera alertas", () => {
    expect(
      validateSofaInputs({ ...emptySofaInputs(), fio2: 40, pao2: 90, gcsTotal: 15 }),
    ).toHaveLength(0);
  });
});

describe("rounds e comparação", () => {
  it("detecta rounds de 07:00 e 19:00", () => {
    expect(detectRound(new Date(2026, 8, 6, 7, 0))).toBe("07:00");
    expect(detectRound(new Date(2026, 8, 6, 8, 20))).toBe("07:00");
    expect(detectRound(new Date(2026, 8, 6, 19, 30))).toBe("19:00");
    expect(detectRound(new Date(2026, 8, 6, 13, 0))).toBeNull();
  });
  it("compara avaliações", () => {
    const mk = (at: string, total: number): SofaAssessment => ({
      id: at,
      at,
      round: null,
      inputs: emptySofaInputs(),
      scores: { resp: null, coag: null, liver: null, cardio: null, cns: null, renal: null },
      total,
      partial: false,
    });
    const c = compareAssessments([
      mk("2026-09-06T07:00:00.000Z", 10),
      mk("2026-09-06T19:00:00.000Z", 7),
    ]);
    expect(c.current?.total).toBe(7);
    expect(c.previous?.total).toBe(10);
    expect(c.delta).toBe(-3);
    expect(c.min?.total).toBe(7);
    expect(c.max?.total).toBe(10);
  });
});
