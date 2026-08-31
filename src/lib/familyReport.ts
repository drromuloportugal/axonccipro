import jsPDF from "jspdf";
import type { Patient } from "@/data/patients";
import { deviceTypeByCode } from "@/data/devices";
import { stripEmoji } from "@/lib/text";

/* ---------- paleta (tons do sistema) ---------- */
const INK = [31, 41, 55] as const;         // grafite
const SOFT = [107, 114, 128] as const;     // cinza texto
const LINE = [209, 213, 219] as const;     // borda
const BG = [244, 246, 248] as const;       // fundo caixa
const GREEN = [22, 132, 90] as const;      // verde Unimed
const GREEN_SOFT = [214, 236, 226] as const;
const AMBER = [180, 120, 20] as const;
const RED = [176, 58, 52] as const;

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

function box(doc: Doc, x: number, y: number, w: number, h: number, fill: readonly number[] = BG, stroke: readonly number[] = LINE) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");
}

function sectionTitle(doc: Doc, label: string, y: number) {
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(M, y, CW, 8, "F");
  txt(doc, label.toUpperCase(), M + 3, y + 5.4, { size: 10, bold: true, color: [255, 255, 255] });
  return y + 13;
}

function bullet(doc: Doc, s: string, y: number, color: readonly number[] = INK) {
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.circle(M + 1.6, y - 1.2, 1.1, "F");
  return txt(doc, s, M + 5.5, y, { size: 10, color, maxWidth: CW - 6 }) + 1.2;
}

function progressBar(doc: Doc, x: number, y: number, w: number, pct: number, color: readonly number[]) {
  doc.setFillColor(LINE[0], LINE[1], LINE[2]);
  doc.roundedRect(x, y, w, 4, 2, 2, "F");
  const filled = Math.max(0, Math.min(1, pct)) * w;
  if (filled > 0.5) {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x, y, filled, 4, 2, 2, "F");
  }
}

/* ---------- ilustrações vetoriais ---------- */

function drawTimeline(doc: Doc, y: number, steps: { title: string; sub: string; done: boolean }[]) {
  const n = steps.length;
  const gap = CW / n;
  const cy = y + 10;
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(1);
  doc.line(M + gap / 2, cy, M + gap * (n - 0.5), cy);
  steps.forEach((s, i) => {
    const cx = M + gap * (i + 0.5);
    if (s.done) {
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(cx, cy, 3.4, "F");
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(cx, cy, 3.4, "FD");
    }
    txt(doc, String(i + 1), cx, cy + 1.4, { size: 8, bold: true, color: s.done ? [255, 255, 255] : GREEN, align: "center" });
    txt(doc, s.title, cx, cy + 9, { size: 9, bold: true, align: "center", maxWidth: gap - 3 });
    txt(doc, s.sub, cx, cy + 13.5, { size: 8, color: SOFT, align: "center", maxWidth: gap - 3 });
  });
  return cy + 22;
}

/** Figura humana simplificada com marcações de dispositivos/apoios. */
function drawBodyFigure(doc: Doc, x: number, y: number, marks: { label: string; level: number }[]) {
  const cx = x + 22;
  doc.setFillColor(GREEN_SOFT[0], GREEN_SOFT[1], GREEN_SOFT[2]);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.4);
  // cabeça
  doc.circle(cx, y + 8, 6, "FD");
  // tronco
  doc.roundedRect(cx - 9, y + 15, 18, 30, 4, 4, "FD");
  // braços
  doc.roundedRect(cx - 15, y + 17, 5, 24, 2.5, 2.5, "FD");
  doc.roundedRect(cx + 10, y + 17, 5, 24, 2.5, 2.5, "FD");
  // pernas
  doc.roundedRect(cx - 8, y + 46, 7, 28, 3, 3, "FD");
  doc.roundedRect(cx + 1, y + 46, 7, 28, 3, 3, "FD");

  // marcações à direita
  let ly = y + 6;
  marks.slice(0, 8).forEach((m) => {
    const py = y + 6 + m.level * 12;
    doc.setDrawColor(SOFT[0], SOFT[1], SOFT[2]);
    doc.setLineWidth(0.25);
    doc.line(cx + 16, py, x + 50, ly);
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.circle(cx + 16, py, 1.3, "F");
    txt(doc, m.label, x + 52, ly + 1.2, { size: 9, maxWidth: CW - 58 });
    ly += 11;
  });
  return Math.max(y + 78, ly + 4);
}

/* ---------- linguagem simples ---------- */

const PLAIN: Record<string, string> = {
  vm: "aparelho que ajuda a respirar (ventilador)",
  dva: "medicamento na veia para manter a pressão do sangue",
  svd: "sonda para medir a urina",
  cvc: "cateter em veia profunda para receber medicamentos",
  sne: "sonda para alimentação",
  pai: "cateter para medir a pressão do sangue continuamente",
  iot: "tubo na traqueia ligado ao ventilador",
};

function plainDevice(typeCode: string, fallback: string) {
  const key = typeCode.toLowerCase();
  for (const k of Object.keys(PLAIN)) if (key.includes(k)) return `${fallback} — ${PLAIN[k]}`;
  return fallback;
}

function severityText(p: Patient) {
  if (p.severity === "critical") return { label: "Estado grave, em cuidado intensivo constante", color: RED };
  if (p.severity === "attention") return { label: "Estado que exige atenção, com melhora em observação", color: AMBER };
  return { label: "Estado estável no momento", color: GREEN };
}

/* ---------- documento ---------- */

export function generateFamilyReport(patient: Patient) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("pt-BR");
  const sev = severityText(patient);

  /* cabeçalho */
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.rect(0, 0, W, 24, "F");
  txt(doc, "Informações para a família", M, 11, { size: 14, bold: true, color: [255, 255, 255] });
  txt(doc, "Como foi a evolução dos cuidados desde a chegada até hoje", M, 17.5, { size: 9.5, color: [214, 222, 228] });
  txt(doc, `Emitido em ${today}`, W - M, 17.5, { size: 9, color: [214, 222, 228], align: "right" });

  let y = 32;
  box(doc, M, y, CW, 20);
  txt(doc, patient.name, M + 4, y + 7.5, { size: 13, bold: true });
  txt(doc, `Leito ${patient.bed} · ${patient.age} anos · Equipe ${patient.team} · Médico(a) ${patient.attending}`, M + 4, y + 13.5, { size: 9, color: SOFT, maxWidth: CW - 60 });
  doc.setFillColor(sev.color[0], sev.color[1], sev.color[2]);
  doc.roundedRect(W - M - 52, y + 5.5, 48, 9, 2, 2, "F");
  txt(doc, sev.label, W - M - 28, y + 11.2, { size: 7.5, bold: true, color: [255, 255, 255], align: "center", maxWidth: 44 });
  y += 27;

  /* 1. linha do tempo */
  y = sectionTitle(doc, "1. A jornada até agora", y);
  y = drawTimeline(doc, y, [
    { title: "Chegada ao hospital", sub: `${patient.admissionHosp} · ${patient.daysHosp} dia(s)`, done: true },
    { title: "Entrada na UTI", sub: `${patient.admissionICU} · ${patient.daysICU} dia(s)`, done: true },
    { title: "Tratamento intensivo", sub: "em andamento", done: true },
    { title: "Hoje", sub: today, done: true },
    { title: "Próximo passo", sub: "recuperação e saída da UTI", done: false },
  ]);

  y = txt(doc, `O paciente chegou ao hospital em ${patient.admissionHosp} e precisou de cuidados na UTI a partir de ${patient.admissionICU}. Desde então, a equipe acompanha os sinais vitais 24 horas por dia e ajusta o tratamento todos os dias.`, M, y, { size: 10, color: SOFT, maxWidth: CW }) + 4;

  /* 2. motivos da internação */
  y = sectionTitle(doc, "2. Por que ele(a) está internado(a)", y);
  const current = patient.diagnoses.filter((d) => d.category !== "previous" && d.category !== "inactive");
  const previous = patient.diagnoses.filter((d) => d.category === "previous");
  if (current.length === 0) y = bullet(doc, "Motivo principal registrado pela equipe assistente.", y);
  current.slice(0, 6).forEach((d) => { y = bullet(doc, `${d.label}${d.detail ? ` — ${d.detail}` : ""}`, y); });
  if (previous.length) {
    y += 1;
    y = txt(doc, "Problemas de saúde que já existiam antes:", M, y, { size: 9.5, bold: true }) + 1;
    y = txt(doc, previous.slice(0, 8).map((d) => d.label).join(" · "), M, y, { size: 9.5, color: SOFT, maxWidth: CW }) + 3;
  }

  /* 3. o que já foi feito */
  y = sectionTitle(doc, "3. O que já foi feito", y);
  const procs = (patient.procedures ?? []).slice(0, 8);
  if (!procs.length) y = bullet(doc, "Cuidados clínicos contínuos, sem procedimentos invasivos registrados.", y);
  procs.forEach((p) => { y = bullet(doc, `${p.date} — ${p.label}${p.detail ? `: ${p.detail}` : ""}`, y); });

  /* página 2 */
  doc.addPage();
  y = 20;
  txt(doc, "Cuidados e apoios em uso hoje", M, y, { size: 13, bold: true });
  y += 6;

  const active = (patient.devices ?? []).filter((d) => !d.removedAt);
  const marks: { label: string; level: number }[] = active.slice(0, 8).map((d, i) => {
    const t = deviceTypeByCode(d.typeCode);
    const name = t?.label ?? d.typeCode;
    return { label: plainDevice(d.typeCode, name), level: i % 6 };
  });
  if (patient.state.vent) marks.unshift({ label: `Respiração: ${patient.state.vent} — ${PLAIN.vm}`, level: 0 });
  if (patient.state.dva) marks.push({ label: `Pressão do sangue apoiada por medicação (${patient.state.dva})`, level: 3 });
  if (patient.state.dieta) marks.push({ label: `Alimentação: ${patient.state.dieta}`, level: 4 });
  if (!marks.length) marks.push({ label: "Nenhum aparelho invasivo em uso neste momento.", level: 2 });

  y = drawBodyFigure(doc, M, y, marks) + 4;

  y = sectionTitle(doc, "Medicamentos em uso", y);
  const meds = (patient.medications ?? []).filter((m) => m.active !== false && !m.end).slice(0, 10);
  if (!meds.length) y = bullet(doc, "Sem medicamentos contínuos registrados.", y);
  meds.forEach((m) => { y = bullet(doc, `${m.name} — ${m.dose} (${m.route}, ${m.freq})`, y); });
  y += 2;

  y = sectionTitle(doc, "Plano de cuidados do dia", y);
  const done = patient.conducts.filter((c) => c.done).length;
  const total = Math.max(1, patient.conducts.length);
  txt(doc, `Tarefas de cuidado concluídas hoje: ${done} de ${patient.conducts.length}`, M, y, { size: 10, bold: true });
  progressBar(doc, M, y + 2.5, CW, done / total, GREEN);
  y += 12;
  patient.conducts.slice(0, 8).forEach((c) => {
    y = bullet(doc, `${c.done ? "Concluído" : "Em andamento"} — equipe ${c.team}${c.subItems?.[0]?.text ? `: ${c.subItems[0].text}` : ""}`, y, c.done ? INK : AMBER);
  });

  if (patient.goals?.length) {
    y += 2;
    y = sectionTitle(doc, "Metas do tratamento", y);
    patient.goals.slice(0, 8).forEach((g) => { y = bullet(doc, `${g.met ? "Alcançada" : "Em busca"} — ${g.text}`, y, g.met ? INK : AMBER); });
  }

  /* página 3 */
  doc.addPage();
  y = 20;
  txt(doc, "Entendendo os termos e os próximos passos", M, y, { size: 13, bold: true });
  y += 8;

  y = sectionTitle(doc, "Palavras que você vai ouvir", y);
  const glossary: [string, string][] = [
    ["UTI", "unidade onde o paciente é observado o tempo todo por médicos e enfermeiros."],
    ["Ventilador", "aparelho que respira junto com o paciente enquanto o pulmão se recupera."],
    ["Sedação", "medicamento que deixa o paciente calmo e sem dor durante o tratamento."],
    ["Cateter", "tubo fino colocado na veia para dar medicamentos com segurança."],
    ["Sonda", "tubo usado para alimentar ou para medir a urina."],
    ["Exames de sangue", "medidas repetidas para acompanhar rim, fígado, infecção e coagulação."],
    ["Cultura", "exame que procura bactérias para escolher o antibiótico certo."],
  ];
  glossary.forEach(([term, meaning]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(`${term}:`, M, y);
    const off = doc.getTextWidth(`${term}: `);
    y = txt(doc, meaning, M + off, y, { size: 10, color: SOFT, maxWidth: CW - off }) + 1.5;
  });
  y += 3;

  y = sectionTitle(doc, "Como acompanhar", y);
  y = bullet(doc, "A evolução na UTI acontece em dias, não em horas: pequenas melhoras já são importantes.", y);
  y = bullet(doc, "A equipe atualiza a família em horário combinado e sempre que houver mudança relevante.", y);
  y = bullet(doc, "Perguntas simples são bem-vindas: o que melhorou hoje, o que preocupa, qual o próximo passo.", y);
  if (patient.legalRepresentative?.name) {
    y = bullet(doc, `Contato de referência da família: ${patient.legalRepresentative.name}${patient.legalRepresentative.relation ? ` (${patient.legalRepresentative.relation})` : ""}${patient.legalRepresentative.phone ? ` · ${patient.legalRepresentative.phone}` : ""}`, y);
  }
  y += 4;

  box(doc, M, y, CW, 22, GREEN_SOFT, GREEN);
  txt(doc, "Mensagem da equipe", M + 4, y + 7, { size: 10, bold: true, color: GREEN });
  txt(doc, "Este documento é um resumo em linguagem simples e não substitui a conversa com o médico responsável. Traga suas dúvidas na próxima visita.", M + 4, y + 13, { size: 9.5, color: INK, maxWidth: CW - 8 });

  /* rodapé em todas as páginas */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(M, 284, W - M, 284);
    txt(doc, `${patient.name} · Leito ${patient.bed} · Documento para a família`, M, 289, { size: 8, color: SOFT });
    txt(doc, `Página ${i} de ${pages}`, W - M, 289, { size: 8, color: SOFT, align: "right" });
  }

  const safe = stripEmoji(patient.name).replace(/[^\p{L}\p{N}]+/gu, "_");
  doc.save(`familia_${safe}_${patient.bed}.pdf`);
}
