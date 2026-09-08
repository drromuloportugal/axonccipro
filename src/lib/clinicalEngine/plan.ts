// Etapa 11: plano das próximas 12 h em janelas de plantão.
// As entradas são tarefas de monitorização e reavaliação, nunca ordens executadas.

import type { Facts } from "./dataset";
import type { Finding, PlanTask, Priority } from "./types";

const PRIORITY_TIME: Record<Priority, string[]> = {
  critical: ["+1 h", "+3 h", "+6 h"],
  attention: ["+2 h", "+6 h"],
  pending: ["no round"],
  adequate: ["no round"],
};

export function currentWindow(now = new Date()): PlanTask["window"] {
  const h = now.getHours();
  return h >= 7 && h < 19 ? "07:00→19:00" : "19:00→07:00";
}

export function buildPlan(f: Facts, findings: Finding[], now = new Date()): PlanTask[] {
  const window = currentWindow(now);
  const tasks: PlanTask[] = [];

  for (const finding of findings) {
    const times = PRIORITY_TIME[finding.priority];
    finding.recommendations.forEach((r, i) => {
      tasks.push({
        window,
        time: times[Math.min(i, times.length - 1)] ?? "no round",
        domain: finding.domain,
        priority: finding.priority,
        text: `${finding.title}: ${r.monitoring}`,
      });
    });
  }

  // Tarefas fixas de segurança da janela.
  tasks.push({
    window,
    time: "no round",
    domain: "seguranca",
    priority: "pending",
    text: "Revisar pendências, reconciliação medicamentosa e necessidade de dispositivos.",
  });
  if (f.invasiveVent) {
    tasks.push({
      window,
      time: "+4 h",
      domain: "ventilacao",
      priority: "attention",
      text: "Registrar volume corrente por peso predito, platô e driving pressure.",
    });
  }

  const rank: Record<Priority, number> = { critical: 0, attention: 1, pending: 2, adequate: 3 };
  return tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
