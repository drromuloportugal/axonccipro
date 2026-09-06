// Escala inteligente do próximo plantão — janelas fixas 07:00→19:00 (diurno) e
// 19:00→07:00 (noturno). Funções puras, tipadas e auditáveis.

export type ShiftKind = "diurno" | "noturno";

export interface ShiftWindow {
  kind: ShiftKind;
  /** ISO do início da janela */
  startISO: string;
  /** ISO do fim da janela */
  endISO: string;
  /** Rótulo "DD/MM/YYYY HH:MM → DD/MM/YYYY HH:MM" */
  label: string;
  /** Fuso horário usado no cálculo */
  timeZone: string;
}

export interface ShiftTask {
  id: string;
  text: string;
  priority: "alta" | "atencao" | "monitorar" | "info";
  time?: string;
  done?: boolean;
}

export interface ShiftScheduleRecord {
  id: string;
  /** Janela do plantão a que a escala se refere */
  window: ShiftWindow;
  /** Texto estruturado gerado pela análise (editável pelo médico) */
  content: string;
  /** Conteúdo original produzido pela IA, para auditoria */
  originalContent: string;
  generatedAt: string;
  /** Dados/fontes utilizadas (auditoria) */
  audit: {
    user?: string;
    patientId: string;
    contextChars: number;
    guidelines: string[];
  };
  tasks: ShiftTask[];
  validatedAt?: string;
  validatedBy?: string;
  version: number;
  edited?: boolean;
  /** Relatório de encerramento do plantão */
  closedAt?: string;
  closingReport?: string;
  status: "rascunho" | "validada" | "encerrada";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatShiftMoment(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function atHour(base: Date, hour: number, dayOffset = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Janela do plantão em curso: inicia no horário atual e termina no próximo
 * limite de 07:00 ou 19:00.
 * - 07:00–18:59 → plantão diurno, termina hoje às 19:00
 * - >= 19:00    → plantão noturno, termina amanhã às 07:00
 * - < 07:00     → plantão noturno, termina hoje às 07:00
 */
export function nextShiftWindow(now: Date = new Date()): ShiftWindow {
  const h = now.getHours();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";

  let end: Date;
  let kind: ShiftKind;

  if (h >= 7 && h < 19) {
    kind = "diurno";
    end = atHour(now, 19);
  } else if (h >= 19) {
    kind = "noturno";
    end = atHour(now, 7, 1);
  } else {
    kind = "noturno";
    end = atHour(now, 7);
  }

  const startISO = new Date(now).toISOString();
  const endISO = end.toISOString();
  return {
    kind,
    startISO,
    endISO,
    timeZone,
    label: `${formatShiftMoment(startISO)} → ${formatShiftMoment(endISO)}`,
  };
}

export function shiftHoursLabel(kind: ShiftKind): string {
  return kind === "diurno" ? "até 19:00" : "até 07:00";
}


/** Diretrizes institucionais priorizadas (SCCM) usadas na análise. */
export const SCCM_GUIDELINES: { name: string; year: string; url: string }[] = [
  { name: "ICU Liberation / ABCDEF Bundle (SCCM)", year: "vigente", url: "https://www.sccm.org/clinical-resources/iculiberation-home" },
  { name: "PADIS Guidelines e Focused Update (SCCM)", year: "vigente", url: "https://www.sccm.org/clinical-resources/guidelines" },
  { name: "Surviving Sepsis Campaign (SCCM/ESICM)", year: "vigente", url: "https://www.sccm.org/survivingsepsiscampaign/home" },
  { name: "Family-Centered Care in the ICU (SCCM)", year: "vigente", url: "https://www.sccm.org/clinical-resources/guidelines" },
  { name: "OpenEvidence (consulta complementar de evidência)", year: "consulta", url: "https://www.openevidence.com" },
];

/** Extrai itens acionáveis (pendências / não esquecer / agenda) do texto da escala. */
export function extractTasks(content: string): ShiftTask[] {
  const tasks: ShiftTask[] = [];
  const lines = content.split("\n");
  let inSection = false;
  const sectionStart = /^(?:\d+\.\s*)?(PEND[ÊE]NCIAS|N[ÃA]O ESQUECER|AGENDA)/i;
  const otherSection = /^(?:\d+\.\s*)?[A-ZÀ-Ú0-9]{3,}/;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (sectionStart.test(line)) {
      inSection = true;
      return;
    }
    if (inSection && otherSection.test(line) && !/^[-*•☐]/.test(line) && line === line.toUpperCase() && line.length < 80) {
      inSection = false;
      return;
    }
    if (!inSection) return;
    const text = line.replace(/^[-*•☐☑]\s*/, "").trim();
    if (text.length < 4) return;
    const priority: ShiftTask["priority"] = /ALTA PRIORIDADE/i.test(line)
      ? "alta"
      : /ATEN[ÇC][ÃA]O/i.test(line)
        ? "atencao"
        : /MONITOR/i.test(line)
          ? "monitorar"
          : "info";
    const time = /(\b[0-2]?\d:[0-5]\d\b)/.exec(text)?.[1];
    tasks.push({ id: `t${i}`, text, priority, ...(time ? { time } : {}) });
  });

  return tasks.slice(0, 20);
}

export const PRIORITY_META: Record<ShiftTask["priority"], { label: string; dotClass: string; cls: string }> = {
  alta: { label: "Alta prioridade", dotClass: "bg-red-500", cls: "border-red-300 bg-red-50" },
  atencao: { label: "Atenção", dotClass: "bg-orange-500", cls: "border-orange-300 bg-orange-50" },
  monitorar: { label: "Monitoramento", dotClass: "bg-yellow-500", cls: "border-yellow-300 bg-yellow-50" },
  info: { label: "Informação", dotClass: "bg-sky-500", cls: "border-sky-300 bg-sky-50" },
};
