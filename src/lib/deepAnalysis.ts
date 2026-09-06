// Serialização completa do PASSÔMETRO de um paciente para leitura por IA
// (relato de caso neurointensivo e chat clínico). Funções puras, client-safe.

import type { Patient } from "@/data/patients";

const fmt = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

function date(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR");
}

function block(title: string, body: string) {
  return `\n## ${title}\n${body.trim() || "[sem registro]"}\n`;
}

function series(label: string, readings?: { value?: number; min?: number; at?: string }[]) {
  if (!readings?.length) return "";
  const items = readings
    .slice()
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    .map((r) => `${r.at ? date(r.at) : "s/ data"}: ${fmt(r.value)}${r.min !== undefined ? ` (mín ${r.min})` : ""}`)
    .join(" | ");
  return `- ${label}: ${items}\n`;
}

export function buildPassometroContext(p: Patient): string {
  const s = p.state ?? ({} as Patient["state"]);

  const identificacao = [
    `Leito: ${fmt(p.bed)}`,
    `Idade: ${fmt(p.age)} anos · Sexo: ${p.sex === "M" ? "masculino" : p.sex === "F" ? "feminino" : "—"}`,
    `Peso: ${fmt(p.weight)} kg · Altura: ${fmt(p.height)} cm`,
    `Admissão hospitalar: ${fmt(p.admissionHosp)} · Admissão UTI: ${fmt(p.admissionICU)}`,
    `Dias de internação hospitalar: ${fmt(p.daysHosp)} · Dias de UTI: ${fmt(p.daysICU)}`,
    `Gravidade registrada: ${fmt(p.severity)}`,
    `Origem: ${p.origin ? [p.origin.type, p.origin.name, p.origin.unit, p.origin.city, p.origin.state].filter(Boolean).join(" · ") : "—"}`,
    `Equipe: ${fmt(p.team)} · Assistente: ${fmt(p.attending)}`,
    p.discharged ? `ALTA DA UTI em ${date(p.dischargedAt)}` : "",
  ].filter(Boolean).join("\n");

  const diagnosticos = (p.diagnoses ?? [])
    .map((d) => `- [${fmt(d.category)}] ${d.date ? date(d.date) : "s/ data"} — ${d.label}${d.detail ? ` (${d.detail})` : ""}`)
    .join("\n");

  const antecedentes = [
    `Tabagismo: ${fmt(p.social?.tabagismo)} · Etilismo: ${fmt(p.social?.etilismo)}`,
    `Ocupação: ${fmt(p.social?.ocupacao)} · Dependência funcional basal: ${fmt(p.social?.dependencia)}`,
    `Alergias: ${(p.allergies ?? []).join("; ") || "nenhuma registrada"}`,
    (p.pastMedications ?? []).length
      ? "Medicações prévias / uso habitual:\n" +
        (p.pastMedications ?? [])
          .map((m) => `- ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.route ? ` ${m.route}` : ""}${m.freq ? ` ${m.freq}` : ""}${m.status ? ` · ${m.status}` : ""}${m.reason ? ` · indicação: ${m.reason}` : ""}${m.period ? ` · período: ${m.period}` : ""}`)
          .join("\n")
      : "Medicações prévias: [sem registro]",
    p.advanceDirective
      ? `Diretivas antecipadas: IOT ${fmt(p.advanceDirective.intubation)} · RCP ${fmt(p.advanceDirective.resuscitation)}${p.advanceDirective.notes ? ` · ${p.advanceDirective.notes}` : ""}`
      : "",
  ].filter(Boolean).join("\n");

  const procedimentos = (p.procedures ?? [])
    .slice()
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((e) => `- ${e.date ? date(e.date) : "s/ data"} — ${e.label}${e.detail ? `: ${e.detail}` : ""}`)
    .join("\n");

  // Só entram no payload os escores efetivamente preenchidos/calculados na
  // aba Gestão. Registros parciais (sem resultado final) são ignorados.
  const scores = [
    (p.saps3?.history?.length ?? 0) > 0 ? `SAPS 3: ${JSON.stringify(p.saps3)}` : "",
    p.nihss?.total != null ? `NIHSS: ${JSON.stringify(p.nihss)}` : "",
    p.huntHess?.grade != null ? `Hunt-Hess: ${JSON.stringify(p.huntHess)}` : "",
    p.wfns?.grade != null ? `WFNS: ${JSON.stringify(p.wfns)}` : "",
    p.fisher?.grade != null ? `Fisher modificada: ${JSON.stringify(p.fisher)}` : "",
    p.classicFisher?.grade != null ? `Fisher clássica: ${JSON.stringify(p.classicFisher)}` : "",
    p.ichScore?.score != null ? `ICH Score: ${JSON.stringify(p.ichScore)}` : "",
    p.vasograde?.color ? `VASOGRADE: ${JSON.stringify(p.vasograde)}` : "",
  ].filter(Boolean).join("\n");

  const medicacoes = (p.medications ?? [])
    .map((m) => {
      const status = m.active === false ? "SUSPENSA/FINALIZADA" : "ATIVA";
      return `- ${m.name} · ${status}${m.dose ? ` · dose ${m.dose}` : ""}${m.route ? ` · via ${m.route}` : ""}${m.freq ? ` · ${m.freq}` : ""}${m.start ? ` · início ${m.start}` : ""}${m.end ? ` · término ${m.end}` : ""}${m.isAntibiotic ? " · ANTIMICROBIANO" : ""}${m.pump ? ` · bomba ${m.mlPerHour ?? "?"} mL/h${m.pump.targetDoseValue ? ` (${m.pump.targetDoseValue} ${m.pump.targetDoseUnit ?? ""})` : ""}` : ""}${(m.changes ?? []).length ? ` · alterações: ${(m.changes ?? []).map((c) => `${c.kind} em ${date(c.date)} (${c.note})`).join("; ")}` : ""}`;
    })
    .join("\n");

  const laboratorio = (p.exams ?? [])
    .map((e) => {
      const hist = (e.history ?? [])
        .slice()
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
        .map((h) => `${date(h.takenAt)}: ${h.value}`)
        .join(" | ");
      return `- ${e.label}${e.code ? ` (${e.code})` : ""}: atual ${fmt(e.value)} ${e.unit ?? ""} · tendência ${e.trend}${e.critical ? " · CRÍTICO" : ""}${e.takenAt ? ` · coletado ${date(e.takenAt)}` : ""}${hist ? `\n    série: ${hist}` : ""}`;
    })
    .join("\n");

  const imagem = (p.imaging ?? [])
    .slice()
    .sort((a, b) => (a.performedAt ?? "").localeCompare(b.performedAt ?? ""))
    .map((i) => `- ${date(i.performedAt)} — ${i.modality} de ${i.region} · status ${fmt(i.status)} · conclusão ${fmt(i.conclusion)}${i.summary ? `\n    achado: ${i.summary}` : ""}${i.reportedBy ? ` · laudo por ${i.reportedBy}` : ""}`)
    .join("\n");

  const eeg = (p.eeg ?? [])
    .map((e) => `- ${date(e.performedAt)} — ${e.report}${e.reportedBy ? ` (${e.reportedBy})` : ""}`)
    .join("\n");

  const hemo = (p.hemotransfusions ?? [])
    .map((h) => `- ${date(h.date)} — ${h.component}${h.volume ? ` · ${h.volume}` : ""}${h.note ? ` · ${h.note}` : ""}`)
    .join("\n");

  const dispositivos = (p.devices ?? [])
    .map((d) => `- ${d.typeCode} (${d.category})${d.site ? ` · ${d.site}` : ""}${d.side ? ` ${d.side}` : ""}${d.size ? ` · ${d.size}` : ""} · inserido em ${date(d.insertedAt)}${d.removedAt ? ` · retirado em ${date(d.removedAt)}` : " · EM USO"}${d.indication ? ` · indicação: ${d.indication}` : ""}${d.notes ? ` · ${d.notes}` : ""}`)
    .join("\n");

  const infeccoes = (p.infections ?? [])
    .map((f) => `- foco ${f.site} · ${f.status}${f.unstable ? " · INSTÁVEL" : ""} · início ${date(f.startedAt)}${f.resolvedAt ? ` · resolvido ${date(f.resolvedAt)}` : ""}${(f.antimicrobials ?? []).length ? ` · antimicrobianos: ${(f.antimicrobials ?? []).join(", ")}` : ""}${f.notes ? ` · ${f.notes}` : ""}`)
    .join("\n");

  const culturas = (p.cultures ?? [])
    .slice()
    .sort((a, b) => (a.collectedAt ?? "").localeCompare(b.collectedAt ?? ""))
    .map((c) => `- ${date(c.collectedAt)} — ${c.source}${c.collectionSite ? ` (${c.collectionSite})` : ""}: ${fmt(c.result)}${c.organism ? ` · ${c.organism}` : ""}${c.resistanceProfile ? ` · perfil ${c.resistanceProfile}` : ""}${(c.resistances ?? []).length ? ` · R: ${(c.resistances ?? []).join(", ")}` : ""}${(c.sensitivities ?? []).length ? ` · S: ${(c.sensitivities ?? []).join(", ")}` : ""}${c.notes ? ` · ${c.notes}` : ""}`)
    .join("\n");

  const infTimeline = (p.infectionTimeline ?? [])
    .slice()
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    .map((e) => `- ${date(e.at)} — [${e.kind}] ${e.label}`)
    .join("\n");

  const lpp = (p.lpp ?? [])
    .map((l) => `- ${l.siteLabel ?? l.site} · estágio ${l.stage}${l.side ? ` · ${l.side}` : ""} · identificada em ${date(l.identifiedAt)}${l.resolvedAt ? ` · resolvida ${date(l.resolvedAt)}` : ""}${(l.evolutions ?? []).length ? ` · evoluções: ${(l.evolutions ?? []).map((e) => `${date(e.at)} estágio ${e.stage}${e.notes ? ` (${e.notes})` : ""}`).join("; ")}` : ""}`)
    .join("\n");

  const intub = (p.intubations ?? [])
    .map((i) => `- ${date(i.createdAt)} — IOT modo ${i.mode} · ${i.status}${i.procedure?.cormack ? ` · Cormack ${i.procedure.cormack}` : ""}${i.procedure?.attempt ? ` · ${i.procedure.attempt} tentativa(s)` : ""}${(i.complications ?? []).length ? ` · complicações: ${(i.complications ?? []).join(", ")}` : ""}${i.postVent ? ` · pós-IOT: ${JSON.stringify(i.postVent)}` : ""}${i.notes ? ` · ${i.notes}` : ""}`)
    .join("\n");

  const vs = s.vitalSeries ?? {};
  const seriados =
    series("Temperatura (°C)", vs.temp) +
    series("SpO2 (%)", vs.spo2) +
    series("FC (bpm)", vs.fc) +
    series("PAM (mmHg)", vs.pam) +
    series("PAS (mmHg)", vs.pas) +
    series("PAD (mmHg)", vs.pad) +
    series("FR (ipm)", vs.fr) +
    series("Glicemia (mg/dL)", vs.glicemia) +
    series("Balanço hídrico (mL)", vs.bh) +
    series("Bristol", vs.bristol) +
    (s.customSeries ?? []).map((c) => series(`${c.label}${c.unit ? ` (${c.unit})` : ""}`, c.readings)).join("");

  const intake = s.fluidBalance?.intake?.reduce((a, x) => a + (x.volumeMl ?? 0), 0) ?? 0;
  const output = s.fluidBalance?.output?.reduce((a, x) => a + (x.volumeMl ?? 0), 0) ?? 0;
  const drains = (s.fluidBalance?.drains ?? [])
    .map((d) => `- dreno ${d.name}${d.site ? ` (${d.site})` : ""}: ${d.volumeMl} mL${d.aspect ? ` · ${d.aspect}` : ""}${d.at ? ` · ${date(d.at)}` : ""}`)
    .join("\n");
  const derivations = (s.fluidBalance?.derivations ?? [])
    .map((d) => `- derivação ${d.name}${d.site ? ` (${d.site})` : ""}: ${d.volumeMl} mL${d.aspect ? ` · ${d.aspect}` : ""}${d.at ? ` · ${date(d.at)}` : ""}`)
    .join("\n");

  const estadoAtual = [
    `Glasgow: ${fmt(s.glasgow)} · RASS: ${fmt(s.rass)}`,
    `PA: ${fmt(s.pas)}/${fmt(s.pad)} mmHg (PAM ${fmt(s.pam)}) · FC: ${fmt(s.fcMax)}${s.fcMin ? `–${s.fcMin}` : ""} bpm`,
    `Ventilação: ${fmt(s.vent)} · FiO2: ${fmt(s.fio2)} · FR: ${fmt(s.fr)} · SpO2: ${fmt(s.spo2)}%`,
    `Drogas vasoativas: ${s.dva ?? "não"}`,
    `Temperatura: ${fmt(s.temp)} °C (máx ${fmt(s.tempMax)})`,
    `Diurese: ${fmt(s.diurese24 ?? s.diurese)} mL/24h · horária ${fmt(s.diureseHoraria)} mL/h`,
    `Glicemia: ${fmt(s.glicemia)} mg/dL`,
    `Dieta: ${fmt(s.dieta)} · Resíduo gástrico: ${fmt(s.residuoGastrico)} mL`,
    `Balanço hídrico acumulado registrado: entradas ${intake} mL / saídas ${output} mL (líquido ${intake - output} mL)`,
    `Infecção em curso (campo livre): ${fmt(s.infection)}`,
    `Observações do estado: ${fmt(s.notes)}`,
  ].join("\n");

  const condutas = (p.conducts ?? [])
    .map((c) => {
      const subs = (c.subItems ?? [])
        .map((x) => `    · ${x.date ? `${date(x.date)} — ` : ""}${x.text}`)
        .join("\n");
      return `- Sistema ${fmt(c.system)} · equipe ${c.team}${c.startedAt ? ` · início ${date(c.startedAt)}` : ""}${subs ? `\n${subs}` : ""}`;
    })
    .join("\n");

  const metas = (p.goals ?? []).map((g) => `- ${g.text}${g.met ? " (atingida)" : ""}`).join("\n");

  return [
    `# PASSÔMETRO — PACIENTE ${p.name} (leito ${p.bed})`,
    `Data/hora desta leitura: ${new Date().toLocaleString("pt-BR")}`,
    block("IDENTIFICAÇÃO E ADMISSÃO", identificacao),
    block("DIAGNÓSTICOS (pregressos, atuais, complicações)", diagnosticos),
    block("CONDIÇÃO BASAL, ANTECEDENTES E MEDICAÇÕES PRÉVIAS", antecedentes),
    block("ESCORES DE GRAVIDADE E ESCALAS NEUROLÓGICAS", scores),
    block("PROCEDIMENTOS E EVENTOS (cronológico)", procedimentos),
    block("INTUBAÇÃO / VIA AÉREA", intub),
    block("MEDICAÇÕES", medicacoes),
    block("EXAMES LABORATORIAIS (com séries temporais)", laboratorio),
    block("EXAMES DE IMAGEM (cronológico)", imagem),
    block("ELETROENCEFALOGRAMA", eeg),
    block("HEMOTRANSFUSÕES", hemo),
    block("DISPOSITIVOS INVASIVOS", dispositivos),
    block("FOCOS INFECCIOSOS", infeccoes),
    block("CULTURAS E ANTIBIOGRAMAS", culturas),
    block("LINHA DO TEMPO INFECCIOSA", infTimeline),
    block("LESÕES POR PRESSÃO", lpp),
    block("SINAIS VITAIS E ÍNDICES SERIADOS", seriados),
    block("DRENOS E DERIVAÇÕES", [drains, derivations].filter(Boolean).join("\n")),
    block("ESTADO CLÍNICO ATUAL", estadoAtual),
    block("CONDUTAS ATUAIS POR SISTEMA", condutas),
    block("METAS CLÍNICAS", metas),
  ].join("\n");
}
