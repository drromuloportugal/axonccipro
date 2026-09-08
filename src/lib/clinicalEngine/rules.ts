// Etapa 6, 7, 8, 9 e 10 do pipeline: regras determinísticas, cruzamento com
// diretrizes versionadas e protocolos institucionais, detecção de conflitos e
// classificação de prioridade. Nenhum limiar aqui depende do modelo de linguagem.

import type { Facts } from "./dataset";
import { DEFAULT_PROTOCOLS, evidence } from "./evidence";
import type {
  Domain,
  EngineRecommendation,
  Finding,
  GuidelineConflict,
  MissingData,
  Priority,
  ScoreOutput,
} from "./types";

interface RuleContext {
  f: Facts;
  scores: ScoreOutput[];
}

interface RuleDef {
  code: string;
  domain: Domain;
  title: string;
  /** Retorna null quando a regra não se aplica ou faltam dados para disparar. */
  run: (ctx: RuleContext) => {
    priority: Priority;
    why: string[];
    recommendations: EngineRecommendation[];
    missing?: MissingData[];
    title?: string;
  } | null;
}

const protocol = (code: string) => {
  const p = DEFAULT_PROTOCOLS.find((x) => x.code === code);
  return p
    ? { code: p.code, name: p.name, statement: p.statement, precedence: p.precedence }
    : undefined;
};

const rec = (
  text: string,
  monitoring: string,
  evidenceCode?: string,
  protocolCode?: string,
): EngineRecommendation => ({
  text,
  monitoring,
  evidence: evidenceCode ? evidence(evidenceCode) : undefined,
  institutional: protocolCode ? protocol(protocolCode) : undefined,
});

const score = (scores: ScoreOutput[], key: string) => scores.find((s) => s.key === key);

const RULES: RuleDef[] = [
  // ---------------- SEPSE / CHOQUE ----------------
  {
    code: "SEP-01",
    domain: "sepse",
    title: "Suspeita de sepse com sinais de gravidade",
    run: ({ f, scores }) => {
      if (!f.sepsisSuspected) return null;
      const q = score(scores, "qsofa");
      const why: string[] = [];
      if (f.infectionLabels.length) why.push(`Foco infeccioso registrado: ${f.infectionLabels.join(" · ")}.`);
      if (q?.available) why.push(`qSOFA ${q.value} ponto(s).`);
      if (f.lactate.value != null) why.push(`Lactato ${f.lactate.value} mmol/L.`);
      if (f.vasopressors.length) why.push(`Vasopressor em uso: ${f.vasopressors.join(" · ")}.`);
      if (!why.length) return null;
      const severe =
        f.vasopressors.length > 0 || (f.lactate.value != null && f.lactate.value >= 2) || (q?.value as number) >= 2;
      return {
        priority: severe ? "critical" : "attention",
        why,
        recommendations: [
          rec(
            "Confirmar triagem sistemática de sepse e reavaliar o foco a cada plantão.",
            "Reavaliar triagem e foco em até 6 h.",
            "SSC26-SCREEN",
            "PROT-SEPSE",
          ),
          rec(
            "Checar coleta de culturas antes do antimicrobiano e lactato seriado.",
            "Repetir lactato em 2 a 4 h enquanto houver hipoperfusão.",
            "SSC26-LACT",
          ),
          rec(
            "Revisar ressuscitação volêmica guiada por perfusão e resposta a fluidos, evitando sobrecarga.",
            "Avaliar perfusão, lactato e balanço a cada 6 h.",
            "SSC26-FLUID",
          ),
        ],
        missing: [
          ...(f.lactate.value == null
            ? [
                {
                  key: "lactato",
                  label: "Lactato",
                  impact: "Sem lactato a hipoperfusão não pode ser quantificada.",
                  domain: "sepse" as Domain,
                },
              ]
            : []),
          ...(f.culturesCount === 0
            ? [
                {
                  key: "culturas",
                  label: "Culturas",
                  impact: "Sem culturas o descalonamento fica inviável.",
                  domain: "infeccao" as Domain,
                },
              ]
            : []),
        ],
      };
    },
  },
  {
    code: "SEP-02",
    domain: "hemodinamica",
    title: "Pressão arterial média abaixo da meta",
    run: ({ f }) => {
      if (f.pam == null) return null;
      if (f.pam >= 65) return null;
      return {
        priority: "critical",
        why: [
          `PAM ${f.pam} mmHg, abaixo da meta inicial habitual de 65 mmHg.`,
          f.vasopressors.length
            ? `Vasopressor em uso: ${f.vasopressors.join(" · ")}.`
            : "Nenhum vasopressor registrado.",
        ],
        recommendations: [
          rec(
            "Reavaliar meta de PAM individualizada, volemia e necessidade/titulação de vasopressor.",
            "Monitorização contínua de PAM e reavaliação em 1 h.",
            "SSC26-HEMO",
            "PROT-CHOQUE",
          ),
        ],
      };
    },
  },
  {
    code: "SEP-03",
    domain: "sepse",
    title: "Lactato sem clareamento",
    run: ({ f }) => {
      const { value, previous } = f.lactate;
      if (value == null || previous == null) return null;
      if (value < 2) return null;
      const clearing = value < previous;
      if (clearing) return null;
      return {
        priority: "critical",
        why: [`Lactato atual ${value} mmol/L versus anterior ${previous} mmol/L, sem queda.`],
        recommendations: [
          rec(
            "Reavaliar perfusão, débito cardíaco, foco não controlado e adequação do antimicrobiano.",
            "Repetir lactato em 2 h e reavaliar perfusão periférica.",
            "SSC26-LACT",
          ),
        ],
      };
    },
  },
  {
    code: "INF-01",
    domain: "infeccao",
    title: "Revisão de antimicrobianos e stewardship",
    run: ({ f }) => {
      if (!f.antimicrobials.length) return null;
      const why = [
        `Antimicrobianos ativos: ${f.antimicrobials.map((m) => m.name).join(" · ")}.`,
        f.maxAtbDays != null ? `Maior tempo de uso: ${f.maxAtbDays} dia(s).` : "Tempo de uso não informado.",
        f.culturesCount
          ? `${f.culturesCount} cultura(s) registrada(s), ${f.positiveCultures} com crescimento.`
          : "Nenhuma cultura registrada.",
        f.crcl != null ? `Depuração de creatinina ${f.crcl} mL/min.` : "Depuração de creatinina não calculável.",
      ];
      const longCourse = (f.maxAtbDays ?? 0) >= 7;
      return {
        priority: longCourse ? "attention" : "pending",
        why,
        recommendations: [
          rec(
            "Reavaliar diariamente indicação, espectro, dose por função renal e data prevista de suspensão.",
            "Registrar dia de tratamento e plano de duração a cada round.",
            "SSC26-STEW",
            "PROT-ATB",
          ),
          rec(
            "Descalonar conforme culturas e evolução clínica; usar a menor duração eficaz.",
            "Reavaliar descalonamento em 24 h.",
            "SSC26-ATB",
          ),
        ],
        missing:
          f.crcl == null
            ? [
                {
                  key: "crcl",
                  label: "Peso, idade ou creatinina para depuração",
                  impact: "Sem depuração estimada o ajuste renal da dose não pode ser conferido.",
                  domain: "renal",
                },
              ]
            : [],
      };
    },
  },

  // ---------------- VENTILAÇÃO / SDRA ----------------
  {
    code: "VENT-01",
    domain: "ventilacao",
    title: "Volume corrente acima da faixa protetora",
    run: ({ f }) => {
      if (!f.invasiveVent || f.vtPerKg == null) return null;
      if (f.vtPerKg <= 8) return null;
      return {
        priority: "critical",
        why: [
          `Volume corrente ${f.vt} mL para peso predito ${f.predictedWeight} kg = ${f.vtPerKg} mL/kg.`,
          "Faixa protetora habitual: 4 a 8 mL/kg de peso predito.",
        ],
        recommendations: [
          rec(
            "Reavaliar volume corrente para 4 a 8 mL/kg de peso predito com controle de platô.",
            "Reavaliar Vt, platô e driving pressure a cada 4 h e após mudança de parâmetro.",
            "ARDS-VT",
            "PROT-VM",
          ),
        ],
      };
    },
  },
  {
    code: "VENT-02",
    domain: "ventilacao",
    title: "Mecânica ventilatória fora da faixa de segurança",
    run: ({ f }) => {
      if (!f.invasiveVent) return null;
      const why: string[] = [];
      if (f.plateau != null && f.plateau > 30) why.push(`Pressão de platô ${f.plateau} cmH2O (> 30).`);
      if (f.drivingPressure != null && f.drivingPressure > 15)
        why.push(`Driving pressure ${f.drivingPressure} cmH2O (> 15).`);
      if (!why.length) return null;
      return {
        priority: "critical",
        why,
        recommendations: [
          rec(
            "Reduzir pressões alveolares ajustando volume corrente e PEEP, reavaliando complacência.",
            "Medir platô e driving pressure a cada 4 h.",
            "ARDS-DP",
            "PROT-VM",
          ),
        ],
      };
    },
  },
  {
    code: "VENT-03",
    domain: "ventilacao",
    title: "Hipoxemia compatível com SDRA",
    run: ({ f, scores }) => {
      const pf = score(scores, "pf");
      if (!pf?.available || typeof pf.value !== "number") return null;
      if (pf.value >= 300) return null;
      const severe = pf.value < 150;
      return {
        priority: severe ? "critical" : "attention",
        why: [`Relação PaO2/FiO2 ${pf.value}.`, pf.interpretation],
        recommendations: [
          ...(severe
            ? [
                rec(
                  "Avaliar indicação de posição prona prolongada e otimização de PEEP.",
                  "Reavaliar PaO2/FiO2 e tolerância à prona a cada 12 h.",
                  "ARDS-PRONE",
                  "PROT-VM",
                ),
              ]
            : []),
          rec(
            "Manter ventilação protetora com titulação de PEEP e FiO2 pela meta de oxigenação.",
            "Gasometria e reavaliação de parâmetros em 6 h.",
            "SSC26-VENT",
          ),
        ],
      };
    },
  },
  {
    code: "VENT-04",
    domain: "ventilacao",
    title: "Avaliação de desmame não registrada",
    run: ({ f }) => {
      if (!f.invasiveVent || f.sbtAssessed) return null;
      return {
        priority: "pending",
        why: ["Paciente em ventilação invasiva sem registro de despertar diário ou teste de respiração espontânea."],
        recommendations: [
          rec(
            "Aplicar avaliação diária de aptidão ao desmame e teste de respiração espontânea quando elegível.",
            "Reavaliar critérios de desmame no round da manhã.",
            "ARDS-WEAN",
            "PROT-LIBERATION",
          ),
        ],
      };
    },
  },

  // ---------------- RENAL ----------------
  {
    code: "REN-01",
    domain: "renal",
    title: "Sinais de lesão renal aguda",
    run: ({ f }) => {
      const why: string[] = [];
      if (f.creat.value != null && f.creat.previous != null && f.creat.value - f.creat.previous >= 0.3)
        why.push(`Creatinina subiu de ${f.creat.previous} para ${f.creat.value} mg/dL.`);
      if (f.creat.value != null && f.creat.value >= 1.5) why.push(`Creatinina atual ${f.creat.value} mg/dL.`);
      if (f.diureseHoraria != null && f.weightKg && f.diureseHoraria / f.weightKg < 0.5)
        why.push(
          `Diurese ${f.diureseHoraria} mL/h para ${f.weightKg} kg = ${(f.diureseHoraria / f.weightKg).toFixed(2)} mL/kg/h (< 0,5).`,
        );
      if (!why.length) return null;
      return {
        priority: "attention",
        why,
        recommendations: [
          rec(
            "Estadiar lesão renal aguda, revisar nefrotóxicos, perfusão e indicação de terapia renal substitutiva.",
            "Creatinina, diurese e eletrólitos a cada 12 h.",
            "AKI-STAGE",
            "PROT-RENAL",
          ),
          rec(
            "Conferir ajuste renal de todas as medicações, especialmente antimicrobianos.",
            "Rever prescrição a cada nova creatinina.",
            "AKI-NEPHRO",
          ),
        ],
        missing:
          f.diureseHoraria == null
            ? [
                {
                  key: "diurese",
                  label: "Diurese horária",
                  impact: "Sem débito urinário o estadiamento por diurese fica incompleto.",
                  domain: "renal",
                },
              ]
            : [],
      };
    },
  },
  {
    code: "REN-02",
    domain: "renal",
    title: "Balanço hídrico cumulativo elevado",
    run: ({ f }) => {
      if (f.balanco == null || f.balanco < 2000) return null;
      return {
        priority: "attention",
        why: [`Balanço hídrico ${f.balanco} mL positivo.`],
        recommendations: [
          rec(
            "Reavaliar necessidade de fluidos, considerar desressuscitação conforme perfusão.",
            "Balanço e peso diários.",
            "SSC26-FLUID",
          ),
        ],
      };
    },
  },
  {
    code: "MET-01",
    domain: "renal",
    title: "Distúrbio eletrolítico relevante",
    run: ({ f }) => {
      const why: string[] = [];
      if (f.sodio.value != null && (f.sodio.value < 135 || f.sodio.value > 145))
        why.push(`Sódio ${f.sodio.value} mEq/L.`);
      if (f.potassio.value != null && (f.potassio.value < 3.5 || f.potassio.value > 5.5))
        why.push(`Potássio ${f.potassio.value} mEq/L.`);
      if (!why.length) return null;
      const critical =
        (f.sodio.value != null && (f.sodio.value < 125 || f.sodio.value > 155)) ||
        (f.potassio.value != null && (f.potassio.value < 3 || f.potassio.value > 6));
      return {
        priority: critical ? "critical" : "attention",
        why,
        recommendations: [
          rec(
            "Definir causa e velocidade de correção; em lesão cerebral evitar variação rápida de sódio.",
            "Repetir eletrólitos conforme velocidade de correção pactuada.",
            "AKI-STAGE",
          ),
        ],
      };
    },
  },

  // ---------------- NEURO ----------------
  {
    code: "NEU-01",
    domain: "neurocritico",
    title: "Piora do nível de consciência",
    run: ({ f }) => {
      if (f.gcs == null) return null;
      const dropped = f.gcsPrevious != null && f.gcs <= f.gcsPrevious - 2;
      if (f.gcs > 8 && !dropped) return null;
      return {
        priority: "critical",
        why: [
          `Glasgow atual ${f.gcs}${f.gcsPrevious != null ? ` (anterior ${f.gcsPrevious})` : ""}.`,
          f.gcs <= 8 ? "Glasgow ≤ 8: risco de perda de proteção de via aérea." : "Queda ≥ 2 pontos.",
        ],
        recommendations: [
          rec(
            "Reavaliar exame neurológico, pupilas e necessidade de imagem/monitorização intracraniana.",
            "Exame neurológico seriado a cada 1 a 2 h.",
            "TBI-ICP",
            "PROT-NEURO",
          ),
        ],
        missing: [
          {
            key: "pupilas",
            label: "Avaliação pupilar estruturada",
            impact: "Sem pupilas registradas a deterioração neurológica pode passar despercebida.",
            domain: "neurocritico",
          },
        ],
      };
    },
  },
  {
    code: "NEU-02",
    domain: "neurocritico",
    title: "Risco de isquemia cerebral tardia após hemorragia subaracnóidea",
    run: ({ f, scores }) => {
      if (!f.sahCase) return null;
      const vaso = score(scores, "vasograde");
      const fisher = score(scores, "fisher");
      const wfns = score(scores, "wfns");
      const why = [
        "Hemorragia subaracnóidea nos diagnósticos.",
        vaso?.available ? `VASOGRADE ${vaso.value}.` : "VASOGRADE não preenchido.",
        fisher?.available ? `Fisher modificada ${fisher.value}.` : "Fisher modificada não preenchida.",
        wfns?.available ? `WFNS ${wfns.value}.` : "WFNS não preenchido.",
      ];
      const highRisk = vaso?.value === "VERMELHO" || (typeof fisher?.value === "number" && fisher.value >= 3);
      return {
        priority: highRisk ? "critical" : "attention",
        why,
        recommendations: [
          rec(
            "Manter nimodipino conforme protocolo, euvolemia e vigilância neurológica para isquemia tardia.",
            "Exame neurológico e doppler transcraniano conforme protocolo local.",
            "SAH-VASO",
            "PROT-NEURO",
          ),
        ],
        missing: vaso?.available
          ? []
          : [
              {
                key: "vasograde",
                label: "VASOGRADE",
                impact: "Sem VASOGRADE o risco de isquemia tardia não é estratificado.",
                domain: "neurocritico",
              },
            ],
      };
    },
  },
  {
    code: "NEU-03",
    domain: "neurocritico",
    title: "Pressão intracraniana elevada",
    run: ({ f }) => {
      if (f.pic == null || f.pic <= 22) return null;
      return {
        priority: "critical",
        why: [`Pressão intracraniana ${f.pic} mmHg (> 22).`],
        recommendations: [
          rec(
            "Aplicar medidas escalonadas de controle de hipertensão intracraniana e reavaliar causa.",
            "Monitorização contínua de PIC e pressão de perfusão cerebral.",
            "TBI-ICP",
            "PROT-NEURO",
          ),
        ],
      };
    },
  },

  // ---------------- SEDAÇÃO / DELIRIUM ----------------
  {
    code: "PAD-01",
    domain: "dor_sedacao_delirium",
    title: "Sedação profunda sem indicação registrada",
    run: ({ f }) => {
      if (f.rass == null || f.rass > -3) return null;
      return {
        priority: "attention",
        why: [
          `RASS ${f.rass}.`,
          f.sedatives.length ? `Sedativos ativos: ${f.sedatives.map((m) => m.name).join(" · ")}.` : "Sedativo não registrado.",
        ],
        recommendations: [
          rec(
            "Definir meta de sedação leve quando não houver indicação de sedação profunda e titular por escala.",
            "Registrar RASS a cada 4 h e no despertar diário.",
            "PADIS18-SED",
            "PROT-LIBERATION",
          ),
        ],
      };
    },
  },
  {
    code: "PAD-02",
    domain: "dor_sedacao_delirium",
    title: "Benzodiazepínico em uso contínuo",
    run: ({ f }) => {
      if (!f.benzodiazepines.length) return null;
      return {
        priority: "attention",
        why: [`Benzodiazepínico ativo: ${f.benzodiazepines.map((m) => m.name).join(" · ")}.`],
        recommendations: [
          rec(
            "Reavaliar necessidade do benzodiazepínico e considerar estratégia poupadora pelo risco de delirium.",
            "Rever indicação diariamente e monitorar delirium.",
            "PADIS18-DEL",
          ),
        ],
      };
    },
  },
  {
    code: "PAD-03",
    domain: "dor_sedacao_delirium",
    title: "Rastreio de dor e delirium ausente",
    run: ({ f }) => {
      const missingItems: string[] = [];
      if (!f.painAssessed) missingItems.push("escala de dor (CPOT/BPS)");
      if (!f.deliriumAssessed) missingItems.push("rastreio de delirium (CAM-ICU/ICDSC)");
      if (!missingItems.length) return null;
      return {
        priority: "pending",
        why: [`Sem registro de ${missingItems.join(" e ")}.`],
        recommendations: [
          rec(
            "Aplicar escalas validadas de dor e delirium em cada turno.",
            "Registrar resultado por turno.",
            "PADIS18-DEL",
            "PROT-LIBERATION",
          ),
        ],
        missing: [
          ...(f.painAssessed
            ? []
            : [
                {
                  key: "dor",
                  label: "CPOT/BPS",
                  impact: "Sem escala a analgesia não é titulada.",
                  domain: "dor_sedacao_delirium" as Domain,
                },
              ]),
          ...(f.deliriumAssessed
            ? []
            : [
                {
                  key: "delirium",
                  label: "CAM-ICU/ICDSC",
                  impact: "Sem rastreio o delirium fica subdiagnosticado.",
                  domain: "dor_sedacao_delirium" as Domain,
                },
              ]),
        ],
      };
    },
  },
  {
    code: "PAD-04",
    domain: "dor_sedacao_delirium",
    title: "Mobilização precoce não registrada",
    run: ({ f }) => {
      if (f.mobilityAssessed) return null;
      return {
        priority: "pending",
        why: ["Nenhum registro de mobilização, fisioterapia ou reabilitação nas condutas."],
        recommendations: [
          rec(
            "Definir plano de mobilização progressiva conforme estabilidade.",
            "Registrar nível de mobilização diariamente.",
            "PADIS18-MOB",
            "PROT-LIBERATION",
          ),
        ],
      };
    },
  },

  // ---------------- TROMBOSE / NUTRIÇÃO / GLICEMIA / TRANSFUSÃO ----------------
  {
    code: "VTE-01",
    domain: "trombose",
    title: "Tromboprofilaxia não identificada",
    run: ({ f }) => {
      if (f.vteProphylaxis) return null;
      return {
        priority: "attention",
        why: ["Nenhuma tromboprofilaxia farmacológica ou mecânica identificada nas medicações e condutas."],
        recommendations: [
          rec(
            "Avaliar tromboprofilaxia farmacológica ou mecânica e registrar contraindicação quando houver.",
            "Reavaliar diariamente e após procedimentos.",
            "VTE-PROPH",
            "PROT-TEV",
          ),
        ],
      };
    },
  },
  {
    code: "NUT-01",
    domain: "nutricao",
    title: "Nutrição suspensa ou não definida",
    run: ({ f }) => {
      if (f.diet && !f.dietSuspended) return null;
      return {
        priority: "pending",
        why: [f.diet ? `Dieta registrada: ${f.diet}.` : "Nenhuma dieta registrada."],
        recommendations: [
          rec(
            "Definir via e meta nutricional; priorizar via enteral precoce quando não houver contraindicação.",
            "Reavaliar tolerância e progressão a cada 12 h.",
            "NUT-EN",
            "PROT-NUT",
          ),
        ],
      };
    },
  },
  {
    code: "GLY-01",
    domain: "endocrino",
    title: "Controle glicêmico fora da faixa",
    run: ({ f }) => {
      if (f.glicemia == null) return null;
      if (f.glicemia >= 80 && f.glicemia <= 180) return null;
      return {
        priority: f.glicemia < 70 || f.glicemia > 250 ? "critical" : "attention",
        why: [`Glicemia ${f.glicemia} mg/dL.`, f.insulin ? "Insulina em uso." : "Insulina não registrada."],
        recommendations: [
          rec(
            "Ajustar protocolo de insulina para faixa-alvo evitando hipoglicemia.",
            "Glicemia capilar conforme protocolo, no mínimo a cada 4 a 6 h.",
            "GLY-TARGET",
            "PROT-GLIC",
          ),
        ],
      };
    },
  },
  {
    code: "TRF-01",
    domain: "transfusao",
    title: "Anemia com gatilho transfusional a discutir",
    run: ({ f }) => {
      if (f.hb.value == null || f.hb.value >= 7) return null;
      return {
        priority: "attention",
        why: [`Hemoglobina ${f.hb.value} g/dL.`],
        recommendations: [
          rec(
            "Discutir estratégia transfusional restritiva e investigar causa da anemia.",
            "Hemoglobina seriada e avaliação de sangramento.",
            "TRF-RESTR",
          ),
        ],
      };
    },
  },
  {
    code: "TRF-02",
    domain: "transfusao",
    title: "Plaquetopenia relevante",
    run: ({ f }) => {
      const v = f.plaq.value;
      if (v == null) return null;
      const k = v > 2000 ? v / 1000 : v;
      if (k >= 50) return null;
      return {
        priority: k < 20 ? "critical" : "attention",
        why: [`Plaquetas ${k} ×10³/µL.`],
        recommendations: [
          rec(
            "Investigar causa, revisar anticoagulação e definir gatilho transfusional conforme procedimento previsto.",
            "Plaquetas seriadas e vigilância de sangramento.",
            "TRF-RESTR",
          ),
        ],
      };
    },
  },

  // ---------------- MEDICAÇÕES / DISPOSITIVOS / METAS ----------------
  {
    code: "MED-01",
    domain: "medicacoes",
    title: "Reconciliação medicamentosa e duplicidades",
    run: ({ f }) => {
      const byName = new Map<string, number>();
      for (const m of f.activeMeds) {
        const k = m.name.trim().toLowerCase();
        byName.set(k, (byName.get(k) ?? 0) + 1);
      }
      const dup = [...byName.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      const why = [
        `${f.activeMeds.length} medicação(ões) ativa(s).`,
        dup.length ? `Possível duplicidade: ${dup.join(" · ")}.` : "Nenhuma duplicidade exata detectada.",
      ];
      return {
        priority: dup.length ? "attention" : "pending",
        why,
        recommendations: [
          rec(
            "Fazer reconciliação medicamentosa, checar duplicidades, interações e ajuste renal.",
            "Revisar prescrição a cada round e nas transições de cuidado.",
            "SSC26-MEDREC",
            "PROT-SEG",
          ),
        ],
      };
    },
  },
  {
    code: "DEV-01",
    domain: "dispositivos",
    title: "Dispositivos invasivos com permanência prolongada",
    run: ({ f }) => {
      if (!f.devices.length) return null;
      const long = f.devices.filter((d) => (d.days ?? 0) >= 7);
      const noIndication = f.devices.filter((d) => !d.hasIndication);
      const why = [
        `Dispositivos em uso: ${f.devices
          .map((d) => `${d.device.typeCode}${d.days != null ? ` ${d.days} d` : ""}`)
          .join(" · ")}.`,
        ...(long.length ? [`Permanência ≥ 7 dias: ${long.map((d) => d.device.typeCode).join(" · ")}.`] : []),
        ...(noIndication.length
          ? [`Sem indicação registrada: ${noIndication.map((d) => d.device.typeCode).join(" · ")}.`]
          : []),
      ];
      if (!long.length && !noIndication.length)
        return {
          priority: "adequate",
          why,
          recommendations: [
            rec(
              "Manter checagem diária de necessidade e cuidados de prevenção de infecção.",
              "Revisar necessidade de cada dispositivo no round.",
              "DEV-REVIEW",
              "PROT-DISP",
            ),
          ],
        };
      return {
        priority: "attention",
        why,
        recommendations: [
          rec(
            "Reavaliar necessidade de cada dispositivo e planejar retirada precoce quando possível.",
            "Registrar indicação e data de reavaliação diariamente.",
            "DEV-REVIEW",
            "PROT-DISP",
          ),
        ],
      };
    },
  },
  {
    code: "PAL-01",
    domain: "paliativo",
    title: "Metas de cuidado não registradas",
    run: ({ f }) => {
      if (f.goalsOfCareRegistered) return null;
      return {
        priority: "pending",
        why: ["Nenhuma meta de cuidado, diretiva antecipada ou comunicação familiar registrada."],
        recommendations: [
          rec(
            "Registrar metas de cuidado e alinhar expectativas com paciente e família.",
            "Reavaliar metas a cada mudança relevante de estado.",
            "PAL-GOALS",
          ),
        ],
      };
    },
  },
  {
    code: "SAFE-01",
    domain: "seguranca",
    title: "Passagem de plantão e transição de cuidado",
    run: ({ f }) => ({
      priority: "pending",
      why: [
        `Paciente ${f.patient.name ?? f.patient.id} com ${f.activeMeds.length} medicação(ões) ativa(s) e ${f.devices.length} dispositivo(s).`,
        "Transições de cuidado são momento de maior risco de perda de informação.",
      ],
      recommendations: [
        rec(
          "Usar estrutura padronizada de passagem de plantão com pendências explícitas.",
          "Revisar pendências no início e no fim de cada turno.",
          "SSC26-TRANS",
          "PROT-SEG",
        ),
      ],
    }),
  },
];

export function runRules(f: Facts, scores: ScoreOutput[]): Finding[] {
  const out: Finding[] = [];
  for (const rule of RULES) {
    let result: ReturnType<RuleDef["run"]> = null;
    try {
      result = rule.run({ f, scores });
    } catch {
      result = null;
    }
    if (!result) continue;
    out.push({
      code: rule.code,
      domain: rule.domain,
      priority: result.priority,
      title: result.title ?? rule.title,
      why: result.why,
      recommendations: result.recommendations,
      missing: result.missing ?? [],
    });
  }
  return out;
}

/** Etapa 9: conflitos entre diretriz e protocolo institucional ativo. */
export function detectConflicts(findings: Finding[]): GuidelineConflict[] {
  const out: GuidelineConflict[] = [];
  for (const finding of findings) {
    for (const r of finding.recommendations) {
      if (!r.evidence || !r.institutional) continue;
      if (!r.institutional.precedence) continue;
      out.push({
        topic: r.evidence.topic,
        domain: finding.domain,
        guideline: `${r.evidence.society} ${r.evidence.document} ${r.evidence.version}: ${r.evidence.statement}`,
        institutional: `${r.institutional.name}: ${r.institutional.statement}`,
        resolution:
          "Protocolo institucional tem precedência declarada; a divergência com a diretriz fica registrada de forma explícita para revisão médica.",
      });
    }
  }
  return out;
}
