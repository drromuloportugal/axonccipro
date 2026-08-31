import jsPDF from "jspdf";
import type { Patient } from "@/data/patients";
import { CONDUCT_SYSTEM_META } from "@/lib/clinical";
import { stripEmoji } from "@/lib/text";

/* ---------- paleta (tons do sistema) ---------- */
const INK = [31, 41, 55] as const;         // grafite
const SOFT = [107, 114, 128] as const;     // cinza texto
const LINE = [209, 213, 219] as const;     // borda
const BG = [244, 246, 248] as const;       // fundo caixa
const GREEN = [22, 132, 90] as const;      // verde Unimed
const GREEN_SOFT = [214, 236, 226] as const;
const AMBER = [180, 120, 20] as const;

const M = 16;                 // margem
const W = 210;                // A4 largura mm
const CW = W - M * 2;         // largura útil

type Doc = jsPDF;

function txt(doc: Doc, s: string, x: number, y: number, opts?: { size?: number; bold?: boolean; color?: readonly number[]; align?: "left" | "center" | "right"; maxWidth?: number }) {
  const { size = 10, bold = false, color = INK, align = "left", maxWidth } = opts ?? {};
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const clean = stripEmoji(s ?? "");
  if (maxWidth) {
    const lines = doc.splitTextToSize(clean, maxWidth) as string[];
    doc.text(lines, x, y, { align });
    return y + lines.length * (size * 0.42 + 1.1);
  }
  doc.text(clean, x, y, { align });
  return y + size * 0.42 + 1.1;
}

/** Parágrafo dissertativo justificado, com recuo de primeira linha. */
function para(doc: Doc, s: string, yIn: number, opts?: { size?: number; color?: readonly number[] }) {
  const { size = 10.5, color = INK } = opts ?? {};
  const clean = stripEmoji(s ?? "");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(clean, CW - 5) as string[];
  const lh = size * 0.46 + 1.2;
  let y = ensure(doc, yIn, lh * 2);
  lines.forEach((ln, i) => {
    if (y + lh > 272) { doc.addPage(); y = 22; }
    doc.text(ln, M + 2 + (i === 0 ? 6 : 0), y, { align: "justify", maxWidth: CW - 5 - (i === 0 ? 6 : 0) });
    y += lh;
  });
  return y + 2.5;
}

function box(doc: Doc, x: number, y: number, w: number, h: number, fill: readonly number[] = BG, stroke: readonly number[] = LINE) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");
}

function sectionTitle(doc: Doc, label: string, yIn: number) {
  const y = ensure(doc, yIn, 26);
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(M, y, CW, 8, "F");
  txt(doc, label.toUpperCase(), M + 3, y + 5.4, { size: 10, bold: true, color: [255, 255, 255] });
  return y + 14;
}

function ensure(doc: Doc, y: number, needed = 14) {
  if (y + needed > 272) {
    doc.addPage();
    return 22;
  }
  return y;
}

function severityText(p: Patient) {
  if (p.severity === "critical") return { label: "Cuidado intensivo contínuo", color: AMBER };
  if (p.severity === "attention") return { label: "Em observação atenta", color: AMBER };
  return { label: "Estável no momento", color: GREEN };
}

/* ---------- documento ---------- */

export function buildFamilyReport(patient: Patient): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("pt-BR");
  const sev = severityText(patient);

  /* cabeçalho */
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.rect(0, 0, W, 24, "F");
  txt(doc, "Informações para a família", M, 11, { size: 14, bold: true, color: [255, 255, 255] });
  txt(doc, "Um relato acolhedor sobre o cuidado que vem sendo dedicado ao seu familiar", M, 17.5, { size: 9.5, color: [214, 222, 228] });
  txt(doc, `Emitido em ${today}`, W - M, 17.5, { size: 9, color: [214, 222, 228], align: "right" });

  let y = 32;
  box(doc, M, y, CW, 20);
  txt(doc, patient.name, M + 4, y + 7.5, { size: 13, bold: true });
  txt(doc, `Leito ${patient.bed} · ${patient.age} anos · Equipe ${patient.team} · Médico(a) ${patient.attending}`, M + 4, y + 13.5, { size: 9, color: SOFT, maxWidth: CW - 60 });
  doc.setFillColor(sev.color[0], sev.color[1], sev.color[2]);
  doc.roundedRect(W - M - 54, y + 4, 50, 12, 2, 2, "F");
  txt(doc, sev.label, W - M - 29, y + 8.6, { size: 7.5, bold: true, color: [255, 255, 255], align: "center", maxWidth: 44 });
  y += 27;

  /* saudação */
  y = para(doc,
    `Preparamos este documento para que a família compreenda, com tranquilidade, como vem sendo conduzido o cuidado de ${patient.name}. Sabemos que a internação em uma UTI traz preocupação e muitas dúvidas; por isso, relatamos aqui, em linguagem simples, o caminho percorrido desde a chegada ao hospital, o propósito de cada iniciativa da equipe e a perspectiva de evolução. Cada decisão descrita a seguir tem um único objetivo: a recuperação completa do paciente, com segurança e dignidade.`,
    y);

  /* 1. como tudo começou */
  y = sectionTitle(doc, "1. Como tudo começou", y);
  y = para(doc,
    `${patient.name} chegou ao hospital em ${patient.admissionHosp} e, diante da necessidade de um acompanhamento mais próximo, foi acolhido(a) na UTI em ${patient.admissionICU}, onde permanece sob observação contínua há ${patient.daysICU} dia(s). A UTI é o ambiente mais preparado do hospital: aqui, uma equipe de médicos, enfermeiros, fisioterapeutas e outros profissionais acompanha o paciente vinte e quatro horas por dia, reavaliando o tratamento a cada turno e ajustando cada detalhe conforme a resposta do organismo.`,
    y);

  const current = patient.diagnoses.filter((d) => d.category !== "previous" && d.category !== "inactive");
  if (current.length) {
    y = para(doc,
      `O motivo que trouxe o paciente até nós está relacionado a ${current.slice(0, 4).map((d) => d.label.toLowerCase()).join(", ")}. Compreender essa condição é o primeiro passo do tratamento, e é sobre ela que concentramos nossos esforços diários.`,
      y);
  }
  const previous = patient.diagnoses.filter((d) => d.category === "previous");
  if (previous.length) {
    y = para(doc,
      `Também consideramos, em todas as decisões, as condições de saúde que já existiam antes desta internação — como ${previous.slice(0, 5).map((d) => d.label.toLowerCase()).join(", ")} — porque o cuidado em UTI é sempre pensado para a pessoa como um todo, e não apenas para o problema do momento.`,
      y);
  }

  /* 2. como o cuidado vem sendo conduzido */
  y = sectionTitle(doc, "2. Como o cuidado vem sendo conduzido", y);

  const procs = (patient.procedures ?? []).slice(0, 6);
  if (procs.length) {
    y = para(doc,
      `Desde a chegada, algumas etapas importantes já foram vencidas. ${procs.map((p) => `Em ${p.date}, foi realizado(a) ${p.label.toLowerCase()}${p.detail ? ` (${p.detail.toLowerCase()})` : ""}`).join("; ")}. Cada um desses passos foi planejado pela equipe para dar ao paciente as melhores condições de recuperação.`,
      y);
  } else {
    y = para(doc,
      `Até o momento, o cuidado tem sido conduzido de forma clínica e contínua, sem necessidade de procedimentos invasivos — o que, por si só, já é um sinal favorável de evolução.`,
      y);
  }

  const meds = (patient.medications ?? []).filter((m) => m.active !== false && !m.end).slice(0, 8);
  if (meds.length) {
    y = para(doc,
      `Os medicamentos em uso foram escolhidos criteriosamente e são reavaliados todos os dias. Entre eles estão ${meds.slice(0, 5).map((m) => m.name.toLowerCase()).join(", ")}${meds.length > 5 ? ", entre outros" : ""}. Cada medicação tem uma finalidade precisa: controlar a infecção, manter a pressão e os batimentos estáveis, aliviar a dor, garantir o conforto e proteger os órgãos enquanto o corpo se recupera.`,
      y);
  }

  const hemos = patient.hemotransfusions ?? [];
  if (hemos.length) {
    const h = hemos[hemos.length - 1];
    y = para(doc,
      `Quando necessário, o paciente também recebeu suporte com hemocomponentes (${h.component.toLowerCase()}${h.volume ? `, ${h.volume}` : ""} em ${h.date}), uma medida segura e habitual em UTI, realizada para repor elementos do sangue e melhorar a oxigenação dos tecidos.`,
      y);
  }

  const eegs = patient.eeg ?? [];
  if (eegs.length) {
    const e = eegs[eegs.length - 1];
    y = para(doc,
      `A atividade cerebral também é acompanhada de perto. O eletroencefalograma realizado em ${e.performedAt} mostrou: ${e.report} Esse tipo de exame ajuda a equipe a ajustar a sedação e a proteger o sistema nervoso durante a recuperação.`,
      y);
  }

  /* 3. o cuidado de cada dia */
  y = sectionTitle(doc, "3. O cuidado de cada dia", y);

  if (patient.state.vent || patient.state.dva || patient.state.dieta) {
    const supports: string[] = [];
    if (patient.state.vent) supports.push(`a respiração está sendo auxiliada (${patient.state.vent}), para que os pulmões descansem e se recuperem`);
    if (patient.state.dva) supports.push(`a pressão do sangue recebe apoio de medicação (${patient.state.dva}), garantindo que todos os órgãos sejam bem irrigados`);
    if (patient.state.dieta) supports.push(`a alimentação é feita por ${patient.state.dieta}, assegurando a nutrição necessária para a cicatrização e a força muscular`);
    y = para(doc,
      `Neste momento, ${supports.join("; ")}. Esses apoios são temporários e representam a forma que a medicina encontrou de sustentar o organismo enquanto ele próprio reconstrói seu equilíbrio.`,
      y);
  }

  const done = patient.conducts.filter((c) => c.done).length;
  if (patient.conducts.length) {
    const sysLabels = Array.from(new Set(patient.conducts.map((c) => (c.system ? CONDUCT_SYSTEM_META[c.system]?.label : undefined)).filter(Boolean))) as string[];
    y = para(doc,
      `O plano de cuidados do dia é organizado em metas concretas, pensadas por sistema do organismo${sysLabels.length ? ` — hoje com atenção especial a ${sysLabels.slice(0, 5).map((s) => s.toLowerCase()).join(", ")}` : ""}. Das ${patient.conducts.length} tarefas de cuidado previstas para hoje, ${done} já foram concluídas. Essa rotina disciplinada, repetida dia após dia, é o que transforma pequenas melhoras em uma recuperação sólida.`,
      y);
  }

  if (patient.goals?.length) {
    const met = patient.goals.filter((g) => g.met);
    const open = patient.goals.filter((g) => !g.met);
    const parts: string[] = [];
    if (met.length) parts.push(`já foram alcançadas metas importantes, como ${met.slice(0, 3).map((g) => g.text.toLowerCase()).join("; ")}`);
    if (open.length) parts.push(`seguimos trabalhando em direção a ${open.slice(0, 3).map((g) => g.text.toLowerCase()).join("; ")}`);
    y = para(doc, `As metas do tratamento orientam toda a equipe: ${parts.join(", e ")}.`, y);
  }

  /* 4. perspectiva de evolução */
  y = sectionTitle(doc, "4. Perspectiva de evolução", y);
  y = para(doc,
    `A evolução em UTI costuma acontecer em dias, e não em horas — e cada pequena melhora é um passo real em direção à recuperação. O horizonte que guia toda a equipe é claro: a saída da UTI, a continuidade da reabilitação no quarto e, por fim, a alta hospitalar com recuperação completa. Para isso, o caminho passa por estabilizar os sinais vitais, reduzir gradualmente os apoios, retomar a alimentação e os movimentos e fortalecer o paciente a cada dia.`,
    y);
  y = para(doc,
    `A família faz parte desse processo. A presença, as palavras de carinho e a confiança na equipe têm efeito concreto na recuperação. A equipe atualiza a família em horário combinado e sempre que houver qualquer mudança relevante — e perguntas simples são sempre bem-vindas: o que melhorou hoje, qual é o próximo passo, o que a família pode fazer para ajudar.`,
    y);

  /* mensagem final */
  y = ensure(doc, y + 4, 34);
  box(doc, M, y, CW, 30, GREEN_SOFT, GREEN);
  txt(doc, "Mensagem da equipe", M + 4, y + 7, { size: 10, bold: true, color: GREEN });
  txt(doc, "Este documento é um resumo em linguagem simples e não substitui a conversa com o médico responsável. Traga suas dúvidas na próxima visita: estaremos à disposição para conversar com calma e transparência.", M + 4, y + 13, { size: 9.5, color: INK, maxWidth: CW - 8 });
  if (patient.legalRepresentative?.name) {
    txt(doc, `Contato de referência da família: ${patient.legalRepresentative.name}${patient.legalRepresentative.relation ? ` (${patient.legalRepresentative.relation})` : ""}${patient.legalRepresentative.phone ? ` · ${patient.legalRepresentative.phone}` : ""}`, M + 4, y + 26, { size: 9, color: SOFT, maxWidth: CW - 8 });
  }

  /* rodapé em todas as páginas */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(M, 284, W - M, 284);
    txt(doc, `${patient.name} · Leito ${patient.bed} · Documento para a família`, M, 289, { size: 8, color: SOFT });
    txt(doc, `Página ${i} de ${pages}`, W - M, 289, { size: 8, color: SOFT, align: "right" });
  }

  return doc;
}

export function generateFamilyReport(patient: Patient) {
  const doc = buildFamilyReport(patient);
  const safe = stripEmoji(patient.name).replace(/[^\p{L}\p{N}]+/gu, "_");
  doc.save(`familia_${safe}_${patient.bed}.pdf`);
}
