import type { Patient } from "@/data/patients";

function slugName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "paciente";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return [first, last].filter(Boolean).join(" ");
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function patientFileName(p: Patient): string {
  return `${slugName(p.name)} ${todayISO()}.json`;
}

function download(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportPatient(p: Patient) {
  const payload = { kind: "passometro.patient", version: 1, exportedAt: new Date().toISOString(), patient: p };
  download(patientFileName(p), JSON.stringify(payload, null, 2));
}

export function exportPatients(list: Patient[]) {
  const payload = {
    kind: "passometro.patients",
    version: 1,
    exportedAt: new Date().toISOString(),
    patients: list,
  };
  const name = `passometro-uti ${todayISO()}.json`;
  download(name, JSON.stringify(payload, null, 2));
}

export async function readPatientsFromFile(file: File): Promise<Patient[]> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (Array.isArray(data?.patients)) return data.patients as Patient[];
  if (data?.patient) return [data.patient as Patient];
  if (Array.isArray(data)) return data as Patient[];
  if (data && typeof data === "object" && "id" in data && "name" in data) return [data as Patient];
  throw new Error("Formato de arquivo não reconhecido");
}
