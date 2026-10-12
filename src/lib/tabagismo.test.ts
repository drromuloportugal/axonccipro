import { describe, expect, it } from "vitest";
import {
  alertaCargaTabagica,
  calcularCargaTabagica,
  resumirTabagismo,
  textoProntuarioCargaTabagica,
} from "./tabagismo";

describe("carga tabágica", () => {
  it("calcula anos-maço pela fórmula padrão", () => {
    expect(calcularCargaTabagica({ quantidadeDia: 20, anosAtivos: 10 })).toEqual({
      anosMaco: 10,
      classificacao: "Moderada",
    });
  });

  it("respeita os limites de classificação", () => {
    expect(calcularCargaTabagica({ quantidadeDia: 10, anosAtivos: 10 })?.classificacao).toBe(
      "Leve",
    );
    expect(calcularCargaTabagica({ quantidadeDia: 20, anosAtivos: 19 })?.classificacao).toBe(
      "Moderada",
    );
    expect(calcularCargaTabagica({ quantidadeDia: 20, anosAtivos: 20 })?.classificacao).toBe(
      "Elevada / Alto Risco",
    );
  });

  it("não assume zero quando faltam dados essenciais", () => {
    expect(calcularCargaTabagica({ quantidadeDia: 20 })).toBeNull();
    expect(calcularCargaTabagica({ anosAtivos: 20 })).toBeNull();
    expect(calcularCargaTabagica({ quantidadeDia: 0, anosAtivos: 20 })).toBeNull();
  });

  it("identifica possível rastreio somente com os critérios completos", () => {
    const detalhes = {
      status: "ex-fumante" as const,
      quantidadeDia: 20,
      anosAtivos: 25,
      anosCessacao: 8,
    };
    expect(alertaCargaTabagica({ idade: 65, detalhes })).toContain("Possível elegibilidade");
    expect(
      alertaCargaTabagica({ idade: 65, detalhes: { ...detalhes, anosCessacao: 15 } }),
    ).toContain("Confirme idade");
  });

  it("gera resumo e texto pronto para prontuário", () => {
    const detalhes = { status: "ativo" as const, quantidadeDia: 40, anosAtivos: 12 };
    expect(resumirTabagismo("sim", detalhes)).toContain("24 anos-maço");
    const texto = textoProntuarioCargaTabagica({ idade: 52, detalhes });
    expect(texto).toContain("### 📊 Avaliação de Carga Tabágica");
    expect(texto).toContain("Fumante Ativo");
    expect(texto).toContain("Elevada / Alto Risco");
  });

  it("aceita consumo informado em maços por dia", () => {
    expect(
      calcularCargaTabagica({ quantidadeDia: 1, unidadeConsumo: "macos", anosAtivos: 20 }),
    ).toEqual({
      anosMaco: 20,
      classificacao: "Elevada / Alto Risco",
    });
  });
});
