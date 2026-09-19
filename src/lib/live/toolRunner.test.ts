import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Patient } from "@/data/patients";
import { runNetoLiveTool, toolRequiresConfirmation } from "./toolRunner";
import { CONFIRMATION_REQUIRED, LIVE_TOOLS, LIVE_TOOL_NAMES } from "./tools";

const patient = {
  id: "p1",
  name: "Maria Teste",
  bed: "UTI-12",
  age: 68,
  sex: "F",
  weight: 70,
  height: 165,
  admissionHosp: "2026-09-01",
  admissionICU: "2026-09-02",
  daysHosp: 6,
  daysICU: 5,
  attending: "Dr. Teste",
  team: "Neuro",
  severity: "grave",
  diagnoses: [{ date: "2026-09-02", label: "HSA aneurismática", kind: "diagnostico" }],
  social: {},
  allergies: [],
  procedures: [{ date: "2026-09-02", label: "IOT", kind: "procedimento" }],
  medications: [
    {
      name: "MEROPENEM",
      dose: "1 g",
      route: "IV",
      freq: "8/8h",
      start: "2026-09-03",
      kind: "medicacao",
      active: true,
    },
  ],
  exams: [{ label: "Creatinina", value: "2,1", unit: "mg/dL", trend: "up", valueNum: 2.1 }],
  devices: [
    { id: "d1", category: "acesso", typeCode: "CVC", insertedAt: "2026-09-02T10:00:00.000Z" },
  ],
  conducts: [],
  goals: [],
  state: {
    glasgow: 8,
    rass: -3,
    pam: 65,
    dva: "NORADRENALINA",
    vent: "VCV",
    fio2: 45,
    diurese: 900,
    temp: 37.4,
    dieta: "enteral",
  },
} as unknown as Patient;

const bare = { ...patient, exams: [], medications: [], devices: [], procedures: [] } as Patient;

describe("ferramentas do NETO Live", () => {
  it("expõe todas as ferramentas declaradas", () => {
    expect(LIVE_TOOLS).toHaveLength(LIVE_TOOL_NAMES.length);
    expect(new Set(LIVE_TOOLS.map((t) => t.name))).toEqual(new Set(LIVE_TOOL_NAMES));
  });

  it("resume o paciente com o leito correto", () => {
    const out = runNetoLiveTool(patient, "get_patient_summary");
    expect(out.summary).toContain("UTI-12");
    expect(out.summary).toContain("HSA aneurismática");
  });

  it("reporta ausência de dados como não informado", () => {
    expect(runNetoLiveTool(bare, "get_medications").summary).toContain("Nenhuma medicação");
    expect(runNetoLiveTool(bare, "get_recent_labs").summary).toContain("Nenhum exame");
    expect(runNetoLiveTool(bare, "get_devices").summary).toContain("Nenhum dispositivo");
  });

  it("calcula escore pelo Motor Clínico e mostra componentes ou o que falta", () => {
    const out = runNetoLiveTool(patient, "calculate_score", { scoreName: "SOFA" });
    expect(out.summary.toUpperCase()).toContain("SOFA");
    expect(out.audit?.scores.length).toBeGreaterThan(0);
  });

  it("avisa quando o escore pedido não existe", () => {
    const out = runNetoLiveTool(patient, "calculate_score", { scoreName: "inexistente" });
    expect(out.summary).toContain("não disponível");
  });

  it("roda o FASTHUG-MAIDENS", () => {
    const out = runNetoLiveTool(patient, "run_fast_hug_maidens");
    expect(Array.isArray(out.data)).toBe(true);
    expect((out.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("roda o Motor Clínico completo com auditoria", () => {
    const out = runNetoLiveTool(patient, "run_clinical_engine", { scope: "full" });
    expect(out.summary).toContain("Prioridade:");
    expect(out.audit?.scope).toBe("full");
  });

  it("gera plano de 12 h da janela pedida", () => {
    const out = runNetoLiveTool(patient, "get_12h_plan", { shift: "noturno" });
    expect(out.summary).toContain("19:00→07:00");
  });

  it("exige confirmação explícita para gravar reavaliação", () => {
    const pending = runNetoLiveTool(patient, "create_reassessment_task", {
      task: "Reavaliar lactato",
      dueAt: "19:00",
    });
    expect(pending.requiresConfirmation).toBe(true);
    expect(toolRequiresConfirmation("create_reassessment_task")).toBe(true);
    expect(CONFIRMATION_REQUIRED).toContain("create_reassessment_task");

    const done = runNetoLiveTool(patient, "create_reassessment_task", {
      task: "Reavaliar lactato",
      dueAt: "19:00",
      confirmed: true,
    });
    expect(done.requiresConfirmation).toBeFalsy();
    expect(done.summary).toContain("Reavaliação registrada");
  });

  it("não expõe chave de IA nenhuma no código do cliente", () => {
    const client = [
      "src/lib/live/useNetoLive.ts",
      "src/lib/live/useNetoVoice.ts",
      "src/components/NetoLivePanel.tsx",
    ]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(client).not.toContain("sk-");
    expect(client).not.toContain("process.env");
    expect(client).not.toContain("api.openai.com/v1/audio");
    // O cliente só conhece funções de servidor e o token efêmero do WebRTC.
    expect(client).toContain("clientSecret");
    expect(client).toContain("useServerFn");
  });

  it("a voz por turnos usa o Gemini e mantém a confirmação de gravação", async () => {
    const voice = readFileSync("src/lib/live/voice.functions.ts", "utf8");
    expect(voice).toContain("google/gemini-3.5-transcribe");
    expect(voice).toContain("ai.gateway.lovable.dev");
    expect(voice).toContain("gemini/gemini-3.8-flash");
    expect(voice).toContain("google/gemini-2.5-pro");
    expect(voice).not.toContain("api.openai.com");
    // Pedido de registro por voz nunca grava direto: devolve confirmação.
    expect(voice).toContain("requiresConfirmation");
  });
});
