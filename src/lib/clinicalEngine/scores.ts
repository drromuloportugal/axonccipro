// Etapa 5 do pipeline: Score Engine.
// Reaproveita as calculadoras já existentes no projeto (SOFA, SAPS 3, NIHSS,
// Hunt-Hess, WFNS, Fisher, ICH, VASOGRADE, Glasgow) e calcula apenas os escores
// simples que ainda não existiam (qSOFA, NEWS2, MEWS, PaO2/FiO2).
// Nenhuma calculadora é duplicada: o motor consome os resultados registrados.

import type { Patient } from "@/data/patients";
import { calculateTotalSOFA, prefillFromPatient, SOFA_COMPONENTS } from "@/lib/sofaScore";
import type { Facts } from "./dataset";
import type { ScoreOutput } from "./types";

const NA = "DADO NÃO INFORMADO";

function unavailable(key: string, label: string, source: string, missing: string[]): ScoreOutput {
  return {
    key,
    label,
    value: null,
    interpretation: "Não é possível concluir — escore não preenchido no passômetro.",
    components: [],
    missing,
    available: false,
    source,
  };
}

/** SOFA: usa a avaliação salva mais recente; se não houver, calcula pelos dados do passômetro. */
function sofaScore(p: Patient): ScoreOutput {
  const saved = (p.sofaAssessments ?? [])
    .slice()
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  const inputs = saved?.inputs ?? prefillFromPatient(p);
  const result = calculateTotalSOFA(inputs);
  const total = saved?.total ?? result.total;
  const components = SOFA_COMPONENTS.map(({ key, label }) => {
    const c = result.components[key];
    return {
      label,
      value: c.score == null ? NA : `${c.score} — ${c.detail}`,
    };
  });
  const missing = SOFA_COMPONENTS.filter(({ key }) => result.components[key].score == null).map(
    ({ label }) => label,
  );
  return {
    key: "sofa",
    label: "SOFA",
    value: total,
    interpretation:
      total == null
        ? "Não é possível concluir — componentes essenciais ausentes."
        : `${
            total >= 12
              ? "Disfunção orgânica muito grave"
              : total >= 8
                ? "Disfunção orgânica grave"
                : total >= 4
                  ? "Disfunção orgânica moderada"
                  : "Disfunção orgânica leve"
          }${missing.length ? ` · escore parcial (${missing.length} componente(s) sem dado)` : ""}`,
    components,
    missing,
    available: total != null,
    source: saved ? "Avaliação SOFA salva na calculadora do projeto" : "Calculado com os dados do passômetro",
    at: saved?.at,
  };
}

/** qSOFA: calculado de forma determinística (FR ≥ 22, PAS ≤ 100, Glasgow < 15). */
function qsofaScore(f: Facts): ScoreOutput {
  const parts: { label: string; value: string; point: number | null }[] = [
    {
      label: "Frequência respiratória ≥ 22 ipm",
      value: f.fr == null ? NA : `${f.fr} ipm`,
      point: f.fr == null ? null : f.fr >= 22 ? 1 : 0,
    },
    {
      label: "Pressão sistólica ≤ 100 mmHg",
      value: f.pas == null ? NA : `${f.pas} mmHg`,
      point: f.pas == null ? null : f.pas <= 100 ? 1 : 0,
    },
    {
      label: "Glasgow < 15",
      value: f.gcs == null ? NA : `${f.gcs}`,
      point: f.gcs == null ? null : f.gcs < 15 ? 1 : 0,
    },
  ];
  const known = parts.filter((p) => p.point != null);
  const total = known.length ? known.reduce((a, b) => a + (b.point ?? 0), 0) : null;
  const missing = parts.filter((p) => p.point == null).map((p) => p.label);
  return {
    key: "qsofa",
    label: "qSOFA",
    value: total,
    interpretation:
      total == null
        ? "Não é possível concluir — nenhum componente informado."
        : total >= 2
          ? "≥ 2 pontos: maior risco de desfecho desfavorável em infecção suspeita — reavaliar sepse."
          : "< 2 pontos: não afasta sepse; usar em conjunto com a triagem sistemática.",
    components: parts.map((p) => ({ label: p.label, value: p.value })),
    missing,
    available: total != null,
    source: "Calculado pelo Motor Clínico com os dados do passômetro",
  };
}

/** NEWS2 simplificado com os parâmetros disponíveis no passômetro. */
function news2Score(f: Facts): ScoreOutput {
  const parts: { label: string; value: string; point: number | null }[] = [];
  const band = (v: number | null, ranges: [number, number, number][], label: string, unit: string) => {
    if (v == null) {
      parts.push({ label, value: NA, point: null });
      return;
    }
    const hit = ranges.find(([lo, hi]) => v >= lo && v <= hi);
    parts.push({ label, value: `${v} ${unit}`, point: hit ? hit[2] : 3 });
  };

  band(f.fr, [[12, 20, 0], [9, 11, 1], [21, 24, 2]], "Frequência respiratória", "ipm");
  band(f.spo2, [[96, 100, 0], [94, 95, 1], [92, 93, 2]], "Saturação de oxigênio", "%");
  band(f.pas, [[111, 219, 0], [101, 110, 1], [91, 100, 2]], "Pressão sistólica", "mmHg");
  band(f.fcMax, [[51, 90, 0], [91, 110, 1], [111, 130, 2]], "Frequência cardíaca", "bpm");
  band(f.tempMax, [[36.1, 38, 0], [38.1, 39, 1], [35.1, 36, 1]], "Temperatura", "°C");
  parts.push({
    label: "Nível de consciência",
    value: f.gcs == null ? NA : `Glasgow ${f.gcs}`,
    point: f.gcs == null ? null : f.gcs < 15 ? 3 : 0,
  });
  if (f.fio2 != null || f.ventText) {
    parts.push({
      label: "Oxigênio suplementar",
      value: f.fio2 != null ? `FiO2 ${f.fio2}%` : f.ventText,
      point: f.fio2 != null && f.fio2 > 21 ? 2 : 0,
    });
  }

  const known = parts.filter((p) => p.point != null);
  const total = known.length >= 3 ? known.reduce((a, b) => a + (b.point ?? 0), 0) : null;
  return {
    key: "news2",
    label: "NEWS2 (parcial, conforme dados disponíveis)",
    value: total,
    interpretation:
      total == null
        ? "Não é possível concluir — menos de três parâmetros informados."
        : total >= 7
          ? "≥ 7: risco alto de deterioração — resposta imediata da equipe."
          : total >= 5
            ? "5 a 6: risco intermediário — reavaliação urgente."
            : "≤ 4: risco baixo — manter monitorização de rotina.",
    components: parts.map((p) => ({ label: p.label, value: p.value })),
    missing: parts.filter((p) => p.point == null).map((p) => p.label),
    available: total != null,
    source: "Calculado pelo Motor Clínico com os dados do passômetro",
  };
}

/** PaO2/FiO2 e classificação de gravidade da SDRA (Berlim). */
function pfScore(f: Facts): ScoreOutput {
  const v = f.pfRatio;
  return {
    key: "pf",
    label: "Relação PaO2/FiO2",
    value: v,
    interpretation:
      v == null
        ? "Não é possível concluir — falta PaO2 ou FiO2."
        : v < 100
          ? "SDRA grave (< 100) segundo a definição de Berlim, se houver contexto compatível."
          : v < 200
            ? "SDRA moderada (100–199), se houver contexto compatível."
            : v < 300
              ? "SDRA leve (200–299), se houver contexto compatível."
              : "≥ 300: sem critério de SDRA por oxigenação.",
    components: [
      { label: "PaO2", value: f.pao2.value == null ? NA : `${f.pao2.value} mmHg` },
      { label: "FiO2", value: f.fio2 == null ? NA : `${f.fio2}%` },
    ],
    missing: [
      ...(f.pao2.value == null ? ["PaO2"] : []),
      ...(f.fio2 == null ? ["FiO2"] : []),
    ],
    available: v != null,
    source: "Calculado pelo Motor Clínico",
  };
}

/** Escores registrados nas calculadoras do projeto (nunca recalculados aqui). */
function registeredScores(p: Patient): ScoreOutput[] {
  const out: ScoreOutput[] = [];

  const saps = (p.saps3?.history ?? [])
    .slice()
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  out.push(
    saps
      ? {
          key: "saps3",
          label: "SAPS 3",
          value: saps.score,
          interpretation:
            saps.mortality != null
              ? `Mortalidade hospitalar estimada de ${saps.mortality}% pelo modelo SAPS 3.`
              : "Escore registrado; mortalidade estimada não calculada.",
          components: (saps.items ?? [])
            .slice(0, 12)
            .map((i) => ({ label: i.label, value: `${i.points} ponto(s) · ${i.source}` })),
          missing: [],
          available: true,
          source: "Calculadora SAPS 3 do projeto",
          at: saps.at,
        }
      : unavailable("saps3", "SAPS 3", "Calculadora SAPS 3 do projeto", ["preenchimento na aba Gestão"]),
  );

  out.push(
    p.gcs?.total != null || p.wfns?.gcs != null
      ? {
          key: "gcs",
          label: "Escala de coma de Glasgow",
          value: p.wfns?.gcs ?? p.gcs?.total ?? null,
          interpretation: "Valor definido pela escala WFNS registrada na aba Gestão.",
          components: [
            { label: "Abertura ocular (E)", value: `${p.wfns?.e ?? p.gcs?.e ?? NA}` },
            { label: "Resposta verbal (V)", value: `${p.wfns?.v ?? p.gcs?.v ?? NA}` },
            { label: "Resposta motora (M)", value: `${p.wfns?.m ?? p.gcs?.m ?? NA}` },
          ],
          missing: [],
          available: true,
          source: "Escala WFNS / Glasgow do projeto",
          at: p.wfns?.at ?? p.gcs?.at,
        }
      : unavailable("gcs", "Escala de coma de Glasgow", "Escala WFNS do projeto", ["Glasgow na WFNS"]),
  );

  out.push(
    p.nihss?.total != null
      ? {
          key: "nihss",
          label: "NIHSS",
          value: p.nihss.total,
          interpretation:
            p.nihss.total >= 21
              ? "Déficit neurológico muito grave."
              : p.nihss.total >= 16
                ? "Déficit grave."
                : p.nihss.total >= 5
                  ? "Déficit moderado."
                  : "Déficit leve.",
          components: Object.entries(p.nihss.items ?? {}).map(([k, v]) => ({
            label: `Item ${k}`,
            value: `${v}`,
          })),
          missing: [],
          available: true,
          source: "Calculadora NIHSS do projeto",
          at: p.nihss.at,
        }
      : unavailable("nihss", "NIHSS", "Calculadora NIHSS do projeto", ["preenchimento na aba Gestão"]),
  );

  const simple: [string, string, number | null | undefined, string, string | undefined][] = [
    ["hunt_hess", "Hunt-Hess", p.huntHess?.grade, "Calculadora Hunt-Hess do projeto", p.huntHess?.at],
    ["wfns", "WFNS", p.wfns?.grade, "Calculadora WFNS do projeto", p.wfns?.at],
    ["fisher", "Fisher modificada", p.fisher?.grade, "Calculadora Fisher do projeto", p.fisher?.at],
    [
      "classic_fisher",
      "Fisher clássica",
      p.classicFisher?.grade,
      "Calculadora Fisher clássica do projeto",
      p.classicFisher?.at,
    ],
    ["ich", "ICH Score", p.ichScore?.score, "Calculadora ICH Score do projeto", p.ichScore?.at],
  ];
  for (const [key, label, value, source, at] of simple) {
    out.push(
      value != null
        ? {
            key,
            label,
            value,
            interpretation: `Grau/escore ${value} registrado na aba Gestão.`,
            components: [],
            missing: [],
            available: true,
            source,
            at,
          }
        : unavailable(key, label, source, ["preenchimento na aba Gestão"]),
    );
  }

  out.push(
    p.vasograde?.color
      ? {
          key: "vasograde",
          label: "VASOGRADE",
          value: p.vasograde.color === "green" ? "VERDE" : p.vasograde.color === "yellow" ? "AMARELO" : "VERMELHO",
          interpretation: "Risco de isquemia cerebral tardia conforme WFNS e Fisher modificada.",
          components: [
            { label: "WFNS", value: `${p.vasograde.wfns ?? NA}` },
            { label: "Fisher modificada", value: `${p.vasograde.fisher ?? NA}` },
          ],
          missing: [],
          available: true,
          source: "Calculadora VASOGRADE do projeto",
          at: p.vasograde.at,
        }
      : unavailable("vasograde", "VASOGRADE", "Calculadora VASOGRADE do projeto", ["preenchimento na aba Gestão"]),
  );

  // Escalas de beira-leito registradas apenas como texto no passômetro.
  return out;
}

/** Escores clínicos disponíveis, sempre com componentes e dados faltantes. */
export function runScoreEngine(p: Patient, f: Facts): ScoreOutput[] {
  const list = [sofaScore(p), qsofaScore(f), news2Score(f), pfScore(f), ...registeredScores(p)];
  // RASS e rastreios de beira-leito entram como escala observacional.
  list.push({
    key: "rass",
    label: "RASS",
    value: f.rass,
    interpretation:
      f.rass == null
        ? "Não é possível concluir — RASS não informado."
        : f.rass <= -3
          ? "Sedação profunda — reavaliar meta de sedação leve."
          : f.rass >= 2
            ? "Agitação — avaliar dor, delirium e causas reversíveis."
            : "Faixa de sedação leve / paciente calmo.",
    components: [],
    missing: f.rass == null ? ["RASS"] : [],
    available: f.rass != null,
    source: "Registro do passômetro",
  });
  list.push({
    key: "cam_icu",
    label: "CAM-ICU / ICDSC",
    value: f.deliriumAssessed ? "registrado nos registros da equipe" : null,
    interpretation: f.deliriumAssessed
      ? "Rastreio de delirium mencionado nos registros — confirmar resultado formal."
      : "Não é possível concluir — rastreio de delirium não registrado.",
    components: [],
    missing: f.deliriumAssessed ? [] : ["CAM-ICU ou ICDSC"],
    available: f.deliriumAssessed,
    source: "Registros da equipe",
  });
  list.push({
    key: "cpot",
    label: "CPOT / BPS",
    value: f.painAssessed ? "registrado nos registros da equipe" : null,
    interpretation: f.painAssessed
      ? "Avaliação de dor mencionada nos registros — confirmar valor formal."
      : "Não é possível concluir — escala de dor não registrada.",
    components: [],
    missing: f.painAssessed ? [] : ["CPOT ou BPS"],
    available: f.painAssessed,
    source: "Registros da equipe",
  });
  return list;
}
