import type { TabagismoDetalhes } from "@/data/patients";

export type ClassificacaoCargaTabagica = "Leve" | "Moderada" | "Elevada / Alto Risco";

export interface ResultadoCargaTabagica {
  anosMaco: number;
  classificacao: ClassificacaoCargaTabagica;
}

export interface ContextoCargaTabagica {
  idade?: number;
  detalhes?: TabagismoDetalhes;
}

const positiveNumber = (value?: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function normalizarResposta(value?: string) {
  return value
    ?.trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function respostaSimNao(value?: string): "sim" | "não" | "" {
  const normalized = normalizarResposta(value);
  if (!normalized) return "";
  if (["nao", "no", "false"].includes(normalized)) return "não";
  return "sim";
}

export function calcularCargaTabagica(detalhes?: TabagismoDetalhes): ResultadoCargaTabagica | null {
  const quantidadeDia = detalhes?.quantidadeDia;
  const anosAtivos = detalhes?.anosAtivos;
  if (!positiveNumber(quantidadeDia) || !positiveNumber(anosAtivos)) {
    return null;
  }

  const cigarrosDia = detalhes?.unidadeConsumo === "macos" ? quantidadeDia * 20 : quantidadeDia;
  const anosMaco = (cigarrosDia / 20) * anosAtivos;
  const classificacao: ClassificacaoCargaTabagica =
    anosMaco < 10 ? "Leve" : anosMaco < 20 ? "Moderada" : "Elevada / Alto Risco";

  return { anosMaco, classificacao };
}

export function formatarAnosMaco(anosMaco: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(anosMaco);
}

export function rotuloStatusTabagico(detalhes?: TabagismoDetalhes) {
  if (detalhes?.status === "ativo") return "Fumante Ativo";
  if (detalhes?.status === "ex-fumante") {
    return positiveNumber(detalhes.anosCessacao)
      ? `Ex-fumante há ${formatarAnosMaco(detalhes.anosCessacao)} anos`
      : "Ex-fumante (tempo de cessação não informado)";
  }
  return "Status não informado";
}

export function consumoTabagicoInformado(detalhes: TabagismoDetalhes) {
  const quantidade = formatarAnosMaco(detalhes.quantidadeDia!);
  if (detalhes.unidadeConsumo === "macos") {
    return `${quantidade} ${detalhes.quantidadeDia === 1 ? "maço/dia" : "maços/dia"}`;
  }
  return `${quantidade} cigarros/dia`;
}

/** Resumo curto para painel, impressão e análise clínica. */
export function resumirTabagismo(tabagismo?: string, detalhes?: TabagismoDetalhes) {
  const resposta = respostaSimNao(tabagismo);
  if (!resposta) return "";
  if (resposta === "não") return "Não";

  const normalized = normalizarResposta(tabagismo);
  const respostaExplicita = ["sim", "yes", "true"].includes(normalized ?? "");
  if (!respostaExplicita && !detalhes) return tabagismo ?? "";

  const resultado = calcularCargaTabagica(detalhes);
  if (!resultado) return "Sim";
  return `Sim · ${formatarAnosMaco(resultado.anosMaco)} anos-maço · ${resultado.classificacao}`;
}

export function alertaCargaTabagica({ idade, detalhes }: ContextoCargaTabagica) {
  const resultado = calcularCargaTabagica(detalhes);
  if (!resultado) {
    return "Informe a média de cigarros por dia e os anos de tabagismo ativo para calcular a carga tabágica.";
  }

  const fumanteAtivo = detalhes?.status === "ativo";
  const exFumanteRecente =
    detalhes?.status === "ex-fumante" &&
    positiveNumber(detalhes.anosCessacao) &&
    (detalhes.anosCessacao ?? Infinity) < 15;
  const idadeElegivel = typeof idade === "number" && idade >= 50 && idade <= 80;
  const possivelRastreio =
    resultado.anosMaco >= 20 && idadeElegivel && (fumanteAtivo || exFumanteRecente);

  if (possivelRastreio) {
    return "Possível elegibilidade para rastreio anual de câncer de pulmão com TCBD, sujeita a decisão compartilhada, avaliação clínica individual e protocolo local.";
  }

  if (resultado.anosMaco >= 20) {
    const complemento = fumanteAtivo
      ? " Considere também intervenção breve e apoio para cessação."
      : "";
    return (
      "Carga elevada. Confirme idade, status atual e tempo de cessação para avaliar possível rastreio por TCBD conforme protocolo local." +
      complemento
    );
  }

  if (fumanteAtivo) {
    return "Registre o padrão de uso e considere intervenção breve e apoio para cessação do tabagismo.";
  }

  return "Registre a exposição tabágica; na presença de sintomas respiratórios, indique avaliação clínica diagnóstica em vez de rastreio.";
}

/** Gera o texto padronizado para revisão e colagem no prontuário. */
export function textoProntuarioCargaTabagica(contexto: ContextoCargaTabagica) {
  const { detalhes } = contexto;
  const resultado = calcularCargaTabagica(detalhes);
  if (!resultado || !detalhes) return null;

  const status = rotuloStatusTabagico(detalhes);
  const consumo = `${consumoTabagicoInformado(detalhes)} durante ${formatarAnosMaco(detalhes.anosAtivos!)} anos`;
  const alerta = alertaCargaTabagica(contexto);
  const outrosProdutos = detalhes.outrosProdutos?.trim();
  const complementoOutros = outrosProdutos
    ? `\n- **Outros produtos:** ${outrosProdutos} (não incluídos no cálculo clássico de anos-maço)`
    : "";
  const prontuario = `Tabagismo: ${status}, ${consumo}. Carga tabágica calculada: ${formatarAnosMaco(resultado.anosMaco)} anos-maço (${resultado.classificacao}). ${alerta}`;

  return `### 📊 Avaliação de Carga Tabágica\n\n- **Status Tabágico:** ${status}\n- **Consumo Informado:** ${consumo}\n- **Carga Tabágica:** ${formatarAnosMaco(resultado.anosMaco)} anos-maço (maços-ano)\n- **Classificação:** ${resultado.classificacao}\n${complementoOutros}\n\n**Implicação Clínica / Alerta:**\n\n- ${alerta}\n\n**Texto para Colagem no Prontuário:**\n\n> "${prontuario}"`;
}
