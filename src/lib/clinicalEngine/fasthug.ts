// FASTHUG-MAIDENS executado automaticamente pelo motor.
// Cada item recebe status OK / PENDENTE / ATENÇÃO / CONTRAINDICADO / SEM DADO,
// com justificativa e fonte quando aplicável.

import type { Facts } from "./dataset";
import { evidence } from "./evidence";
import type { FasthugItem, FasthugStatus } from "./types";

export const FASTHUG_STATUS_META: Record<FasthugStatus, { badge: string; label: string }> = {
  ok: { badge: "🟢", label: "OK" },
  pending: { badge: "🟡", label: "PENDENTE" },
  attention: { badge: "🟠", label: "ATENÇÃO" },
  contraindicated: { badge: "🔴", label: "CONTRAINDICADO" },
  nodata: { badge: "⚪", label: "SEM DADO" },
};

export function runFasthug(f: Facts): FasthugItem[] {
  const items: FasthugItem[] = [];
  const add = (
    key: string,
    letter: string,
    title: string,
    system: string,
    domain: FasthugItem["domain"],
    status: FasthugStatus,
    assessment: string,
    suggestions: string[],
    evidenceCode?: string,
  ) =>
    items.push({
      key,
      letter,
      title,
      system,
      domain,
      status,
      assessment,
      suggestions,
      evidence: evidenceCode ? evidence(evidenceCode) : undefined,
    });

  // ---------------- FASTHUG ----------------
  add(
    "feeding",
    "F",
    "Feeding — nutrição",
    "FASTHUG",
    "nutricao",
    !f.diet ? "nodata" : f.dietSuspended ? "attention" : "ok",
    !f.diet
      ? "Dieta não informada no passômetro."
      : f.dietSuspended
        ? `Dieta registrada como ${f.diet}.`
        : `Dieta em curso: ${f.diet}.`,
    !f.diet || f.dietSuspended
      ? [
          "Definir via nutricional e meta calórico-proteica.",
          "Reavaliar contraindicação para via enteral e progredir conforme tolerância.",
        ]
      : ["Reavaliar tolerância e meta nutricional a cada 12 h."],
    "NUT-EN",
  );

  add(
    "analgesia",
    "A",
    "Analgesia",
    "FASTHUG",
    "dor_sedacao_delirium",
    f.painAssessed ? "ok" : "pending",
    f.painAssessed
      ? "Avaliação de dor registrada nos registros da equipe."
      : "Nenhuma escala de dor (CPOT/BPS) registrada.",
    f.painAssessed
      ? ["Manter avaliação de dor por turno."]
      : ["Aplicar CPOT ou BPS por turno e titular analgesia pelo resultado."],
    "PADIS18-PAIN",
  );

  add(
    "sedation",
    "S",
    "Sedação",
    "FASTHUG",
    "dor_sedacao_delirium",
    f.rass == null ? "nodata" : f.rass <= -3 ? "attention" : "ok",
    f.rass == null
      ? "RASS não informado."
      : `RASS ${f.rass}${f.sedatives.length ? ` com ${f.sedatives.map((m) => m.name).join(" · ")}` : ""}.`,
    f.rass == null
      ? ["Registrar RASS a cada 4 h."]
      : f.rass <= -3
        ? [
            "Definir meta de sedação leve quando não houver indicação de sedação profunda.",
            "Titular sedativo pelo RASS.",
          ]
        : ["Manter meta de sedação leve e registro por turno."],
    "PADIS18-SED",
  );

  add(
    "thrombo",
    "T",
    "Tromboprofilaxia",
    "FASTHUG",
    "trombose",
    f.vteProphylaxis ? "ok" : "attention",
    f.vteProphylaxis
      ? "Tromboprofilaxia identificada nas medicações ou condutas."
      : "Nenhuma tromboprofilaxia identificada.",
    f.vteProphylaxis
      ? ["Reavaliar diariamente e após procedimentos."]
      : [
          "Avaliar tromboprofilaxia farmacológica ou mecânica e registrar contraindicação quando houver.",
        ],
    "VTE-PROPH",
  );

  add(
    "delirium",
    "H",
    "Delirium — hiperatividade ou hipoatividade",
    "FASTHUG",
    "dor_sedacao_delirium",
    f.deliriumAssessed ? "ok" : "pending",
    f.deliriumAssessed
      ? "Rastreio de delirium mencionado nos registros."
      : "Nenhum rastreio de delirium (CAM-ICU/ICDSC) registrado.",
    f.deliriumAssessed
      ? ["Manter rastreio por turno e tratar causas reversíveis."]
      : [
          "Aplicar CAM-ICU ou ICDSC por turno.",
          "Reduzir benzodiazepínico, corrigir dor, sono e mobilização como medidas não farmacológicas.",
        ],
    "PADIS18-DEL",
  );

  add(
    "ulcer",
    "U",
    "Úlcera de estresse / profilaxia gástrica",
    "FASTHUG",
    "medicacoes",
    f.activeMeds.some((m) =>
      /omeprazol|pantoprazol|esomeprazol|ranitidina|famotidina/i.test(m.name),
    )
      ? "ok"
      : "pending",
    f.activeMeds.some((m) =>
      /omeprazol|pantoprazol|esomeprazol|ranitidina|famotidina/i.test(m.name),
    )
      ? "Profilaxia de úlcera de estresse identificada."
      : "Nenhuma profilaxia gástrica identificada.",
    ["Reavaliar indicação conforme fatores de risco e suspender quando não houver mais indicação."],
    "SSC26-MEDREC",
  );

  add(
    "glucose",
    "G",
    "Glicemia",
    "FASTHUG",
    "endocrino",
    f.glicemia == null
      ? "nodata"
      : f.glicemia < 70 || f.glicemia > 250
        ? "contraindicated"
        : f.glicemia > 180
          ? "attention"
          : "ok",
    f.glicemia == null ? "Glicemia não informada." : `Glicemia ${f.glicemia} mg/dL.`,
    f.glicemia == null
      ? ["Registrar glicemia capilar conforme protocolo."]
      : ["Ajustar protocolo de insulina para a faixa-alvo evitando hipoglicemia."],
    "GLY-TARGET",
  );

  // ---------------- MAIDENS ----------------
  add(
    "medication",
    "M",
    "Medicações — reconciliação",
    "MAIDENS",
    "medicacoes",
    f.activeMeds.length ? "pending" : "nodata",
    f.activeMeds.length
      ? `${f.activeMeds.length} medicação(ões) ativa(s).`
      : "Nenhuma medicação ativa registrada.",
    ["Revisar duplicidades, interações relevantes e ajuste renal de cada item."],
    "SSC26-MEDREC",
  );

  add(
    "antibiotics",
    "A",
    "Antimicrobianos",
    "MAIDENS",
    "infeccao",
    !f.antimicrobials.length
      ? f.hasInfectionFocus
        ? "attention"
        : "nodata"
      : (f.maxAtbDays ?? 0) >= 7
        ? "attention"
        : "pending",
    !f.antimicrobials.length
      ? f.hasInfectionFocus
        ? "Foco infeccioso registrado sem antimicrobiano ativo."
        : "Nenhum antimicrobiano ativo."
      : `${f.antimicrobials.map((m) => m.name).join(" · ")}${
          f.maxAtbDays != null ? ` · ${f.maxAtbDays} dia(s) de uso` : ""
        }${f.crcl != null ? ` · depuração ${f.crcl} mL/min` : ""}.`,
    ["Revisar indicação, espectro, dose por função renal, duração e descalonamento."],
    "SSC26-STEW",
  );

  add(
    "iv",
    "I",
    "Acessos e fluidos intravenosos",
    "MAIDENS",
    "dispositivos",
    f.devices.length ? ((f.balanco ?? 0) >= 2000 ? "attention" : "pending") : "nodata",
    f.devices.length
      ? `${f.devices.map((d) => `${d.device.typeCode}${d.days != null ? ` ${d.days} d` : ""}`).join(" · ")}${
          f.balanco != null ? ` · balanço ${f.balanco} mL` : ""
        }.`
      : "Nenhum dispositivo registrado.",
    ["Checar necessidade de cada acesso e reavaliar volume infundido."],
    "DEV-REVIEW",
  );

  add(
    "diet",
    "D",
    "Dieta e via de administração",
    "MAIDENS",
    "nutricao",
    f.diet ? "ok" : "nodata",
    f.diet ? `Dieta: ${f.diet}.` : "Dieta não informada.",
    ["Confirmar via, volume e compatibilidade com medicações."],
    "NUT-EN",
  );

  add(
    "electrolytes",
    "E",
    "Eletrólitos e função renal",
    "MAIDENS",
    "renal",
    f.creat.value == null && f.sodio.value == null
      ? "nodata"
      : (f.sodio.value != null && (f.sodio.value < 135 || f.sodio.value > 145)) ||
          (f.potassio.value != null && (f.potassio.value < 3.5 || f.potassio.value > 5.5))
        ? "attention"
        : "ok",
    [
      f.creat.value != null ? `Creatinina ${f.creat.value} mg/dL` : "Creatinina não informada",
      f.sodio.value != null ? `sódio ${f.sodio.value} mEq/L` : "sódio não informado",
      f.potassio.value != null ? `potássio ${f.potassio.value} mEq/L` : "potássio não informado",
    ].join(" · ") + ".",
    ["Corrigir distúrbios com velocidade segura e revisar ajuste renal de medicações."],
    "AKI-STAGE",
  );

  add(
    "no_pain",
    "N",
    "Náusea, sono e conforto",
    "MAIDENS",
    "dor_sedacao_delirium",
    "pending",
    "Conforto, sono e náusea não têm campo estruturado no passômetro.",
    ["Registrar medidas de higiene do sono e controle de náusea."],
    "PADIS18-SLEEP",
  );

  add(
    "sedation_plan",
    "S",
    "Sedação, desmame e mobilização",
    "MAIDENS",
    "ventilacao",
    !f.invasiveVent ? "ok" : f.sbtAssessed ? "ok" : "pending",
    !f.invasiveVent
      ? `Sem ventilação invasiva registrada${f.ventText ? ` (${f.ventText})` : ""}.`
      : f.sbtAssessed
        ? "Avaliação de desmame registrada."
        : "Ventilação invasiva sem registro de despertar/teste de respiração espontânea.",
    f.invasiveVent && !f.sbtAssessed
      ? ["Aplicar despertar diário e teste de respiração espontânea quando elegível."]
      : ["Manter reavaliação diária de aptidão ao desmame e mobilização."],
    "ARDS-WEAN",
  );

  return items;
}
