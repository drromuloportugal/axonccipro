import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { patients as seedPatients } from "@/data/patients";
import type { Patient, Severity } from "@/data/patients";
import { PatientRow } from "@/components/PatientRow";
import { PatientEditor } from "@/components/PatientEditor";
import { PatientPrintView } from "@/components/PatientPrintView";
import { ExamsMatrix } from "@/components/ExamsMatrix";
import { DilutionCenter } from "@/components/DilutionCenter";
import { Search, Plus, Upload, Download, Type, FlaskConical, Minus, Syringe, Menu, X, Archive, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import unimedLogo from "@/assets/unimed-logo.png.asset.json";
import { exportPatients, readPatientsFromFile } from "@/lib/patientIO";
import { listPatients, savePatients } from "@/lib/patients.functions";

import { toast } from "sonner";
import { useRef } from "react";

export const Route = createFileRoute("/")({

  head: () => ({
    meta: [
      { title: "PASSÔMETRO — Painel UTI" },
      { name: "description", content: "Painel clínico de passagem de plantão para pacientes críticos em UTI." },
      { property: "og:title", content: "PASSÔMETRO — Painel UTI" },
      { property: "og:description", content: "Centro de comando clínico para acompanhamento de pacientes críticos." },
    ],
  }),
  component: Passometro,
});

type Filter = "all" | Severity;

function Passometro() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [patientsLoaded, setPatientsLoaded] = useState(false);

  const [fontScale, setFontScale] = useState<number>(1);
  const [examsOpen, setExamsOpen] = useState(false);
  const [dilutionOpen, setDilutionOpen] = useState(false);

  // Header auto-hide on scroll down / show on scroll up
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    const id = window.setInterval(measure, 500); // guard against dynamic content height changes
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (y < 60) {
        setHeaderHidden(false);
      } else if (delta > 8) {
        setHeaderHidden(true);
      } else if (delta < -8) {
        setHeaderHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const FONT_MIN = 0.7;
  const FONT_MAX = 2.0;
  const FONT_STEP = 0.1;

  // Force light mode and clear any previously stored dark preference.
  useEffect(() => {
    try {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("passometro:theme", "light");
      const f = localStorage.getItem("passometro:fontScale");
      if (f) {
        const n = Number(f);
        if (Number.isFinite(n) && n >= FONT_MIN && n <= FONT_MAX) setFontScale(n);
      }
    } catch { /* ignore */ }
  }, []);

  // Carrega os pacientes do banco (compartilhado pela equipe).
  // Na primeira execução, migra o que estiver salvo localmente.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: Patient[] = [];
      try {
        const raw = localStorage.getItem("passometro:patients");
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) local = parsed as Patient[];
      } catch { /* ignore */ }

      try {
        const { patients: remote } = await listPatients();
        if (cancelled) return;
        if (remote.length) {
          setPatients(remote);
        } else if (local.length) {
          setPatients(local);
          await savePatients({ data: { patients: local } });
          toast.success("Pacientes migrados para o banco de dados");
        } else {
          setPatients(seedPatients);
        }
      } catch {
        if (cancelled) return;
        if (local.length) setPatients(local);
        toast.error("Não foi possível carregar os pacientes do banco");
      } finally {
        if (!cancelled) setPatientsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Salva no banco a cada alteração (com debounce) e mantém cópia local de segurança.
  useEffect(() => {
    if (!patientsLoaded) return;
    try {
      localStorage.setItem("passometro:patients", JSON.stringify(patients));
    } catch { /* ignore */ }
    const id = window.setTimeout(() => {
      savePatients({ data: { patients } }).catch(() => {
        toast.error("Falha ao salvar no banco de dados");
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [patients, patientsLoaded]);


  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-scale", String(fontScale));
    try { localStorage.setItem("passometro:fontScale", String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  const bumpFont = (delta: number) => {
    setFontScale((s) => {
      const next = Math.round((s + delta) * 100) / 100;
      return Math.min(FONT_MAX, Math.max(FONT_MIN, next));
    });
  };



  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [editingTab, setEditingTab] = useState<string | undefined>(undefined);
  const [printing, setPrinting] = useState<Patient | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const bedNumber = (bed: string) => {
    const m = String(bed).match(/(\d+)/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };

  const active = useMemo(
    () => patients.filter((p) => !p.archived).sort((a, b) => bedNumber(a.bed) - bedNumber(b.bed) || a.bed.localeCompare(b.bed)),
    [patients],
  );

  const archived = useMemo(
    () =>
      patients
        .filter((p) => p.archived)
        .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")),
    [patients],
  );

  const filtered = useMemo(() => {
    return active.filter((p) => {
      if (filter !== "all" && p.severity !== filter) return false;
      if (query && !`${p.name} ${p.bed}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [query, filter, active]);

  // Deck horizontal de pacientes — desliza lado a lado
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(0);

  const goTo = (i: number) => {
    const el = deckRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(filtered.length - 1, i));
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setCurrent(idx);
  };

  const handleDeckScroll = () => {
    const el = deckRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCurrent((prev) => (prev === idx ? prev : idx));
  };

  useEffect(() => {
    setCurrent(0);
    deckRef.current?.scrollTo({ left: 0 });
  }, [query, filter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") goTo(current + 1);
      if (e.key === "ArrowLeft") goTo(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, filtered.length]);

  const counts = useMemo(() => {
    const patients = active;
    const critical = patients.filter((p) => p.severity === "critical").length;
    const attention = patients.filter((p) => p.severity === "attention").length;
    const stable = patients.filter((p) => p.severity === "stable").length;
    const vm = patients.filter((p) => p.state.vent.toLowerCase().includes("vm")).length;
    const dva = patients.filter((p) => p.state.dva).length;
    const infect = patients.filter((p) => p.state.infection).length;
    let devicesActive = 0;
    let devicesCritical = 0;
    for (const p of patients) {
      for (const d of p.devices ?? []) {
        if (d.removedAt) continue;
        devicesActive++;
        const max = d.recommendedMaxDays ?? 7;
        const days = (Date.now() - new Date(d.insertedAt).getTime()) / 86400000;
        if (days / max >= 1) devicesCritical++;
      }
    }
    return { critical, attention, stable, vm, dva, infect, devicesActive, devicesCritical, total: patients.length };
  }, [patients]);


  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let added = 0;
    let updated = 0;
    let failed = 0;
    const next: Patient[] = [];
    for (const file of Array.from(files)) {
      try {
        const list = await readPatientsFromFile(file);
        next.push(...list);
      } catch (e) {
        failed++;
        console.error("Falha ao ler", file.name, e);
      }
    }
    if (next.length) {
      setPatients((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const p of next) {
          if (byId.has(p.id)) updated++;
          else added++;
          byId.set(p.id, p);
        }
        return Array.from(byId.values());
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (added || updated) {
      toast.success(`Importação concluída`, {
        description: `${added} novo(s), ${updated} atualizado(s)${failed ? `, ${failed} falha(s)` : ""}.`,
      });
    } else if (failed) {
      toast.error("Falha ao importar", { description: `${failed} arquivo(s) inválido(s).` });
    }
  };

  const openNew = () => {
    setEditing(null);
    setEditingTab(undefined);
    setEditorOpen(true);
  };
  const openEdit = (p: Patient, tab?: string) => {
    setEditing(p);
    setEditingTab(tab);
    setEditorOpen(true);
  };
  const handleSave = (p: Patient) => {
    setPatients((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
    setEditorOpen(false);
    setEditing(null);
  };

  // Print: render hidden #print-area then trigger window.print(); clean up after.
  useEffect(() => {
    if (!printing) return;
    const prevTitle = document.title;
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    document.title = `${printing.name} ${dateStr}`;
    const after = () => {
      document.title = prevTitle;
      setPrinting(null);
    };
    window.addEventListener("afterprint", after);
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", after);
      document.title = prevTitle;
    };
  }, [printing]);

  return (
 <div className="min-h-screen bg-background text-foreground">
      {/* Header — centered Unimed logo, tools tucked inside a circular hamburger menu */}
 <header
        ref={headerRef}
        className={`no-print fixed left-0 right-0 top-0 z-20 border-b border-black/40 transition-transform duration-300 ease-out ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{
          background: "oklch(0.21 0.008 260)",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.25)",
        }}
      >
 <div className="relative flex items-center justify-center px-6 py-4">
          {/* Logo — centered, spans the header width */}
 <div className="flex min-w-0 flex-1 items-center justify-center">
 <img
              src={unimedLogo.url}
              alt="Unimed"
              className="h-auto w-auto max-w-full object-contain"
              style={{
                maxHeight: "3.5rem",
                filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45))",
              }}
            />
 </div>

          {/* Circular hamburger — tools drawer */}
 <div className="absolute right-4 top-1/2 z-30 -translate-y-1/2">
 <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/90 text-foreground shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
              style={{
                boxShadow:
 "0 10px 30px -8px color-mix(in oklab, var(--clinical-resp) 40%, transparent), 0 8px 22px -10px color-mix(in oklab, var(--clinical-stable) 35%, transparent)",
              }}
              aria-label="Ferramentas"
              aria-expanded={toolsOpen}
            >
              {toolsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
 </button>

            {toolsOpen && (
 <div
                className="absolute right-0 top-full mt-3 flex w-72 flex-col gap-2 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-2xl backdrop-blur-xl"
                style={{
                  boxShadow:
 "0 24px 60px -16px color-mix(in oklab, var(--clinical-resp) 35%, transparent), 0 18px 44px -18px color-mix(in oklab, var(--clinical-stable) 30%, transparent)",
                }}
              >
                {/* Busca */}
 <div className="relative">
 <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
 <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar paciente ou leito"
                    className="w-full rounded-md border border-border bg-white/90 py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
 </div>

 <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImportFiles(e.target.files)}
                />

                {/* Ferramentas clínicas */}
 <button
                  onClick={() => {
                    setExamsOpen(true);
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md border border-clinical-resp/40 bg-clinical-resp/10 px-3 py-2 text-[12px] font-semibold text-clinical-resp transition-colors hover:bg-clinical-resp/20"
                  title="Central de exames — todos os leitos"
                >
 <FlaskConical className="h-3.5 w-3.5" />
                  Exames
 </button>
 <button
                  onClick={() => {
                    setDilutionOpen(true);
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/20"
                  title="Farmácia — bombas de infusão e antimicrobianos"
                >
 <Syringe className="h-3.5 w-3.5" />
                  Farmácia
 </button>
 <button
                  onClick={() => {
                    setHistoryOpen(true);
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md border border-border bg-white/90 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-3"
                  title="Pacientes arquivados"
                >
 <Archive className="h-3.5 w-3.5" />
                  Histórico
 <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{archived.length}</span>
 </button>
 <button
                  onClick={() => {
                    openNew();
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
 <Plus className="h-3.5 w-3.5" />
                  Novo paciente
 </button>

                {/* Dados + Sistema */}
 <button
                  onClick={() => {
                    handleImportClick();
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md border border-border bg-white/90 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3"
                  title="Importar pacientes (JSON)"
                >
 <Upload className="h-3.5 w-3.5" />
                  Importar
 </button>
 <button
                  onClick={() => {
                    exportPatients(patients);
                    setToolsOpen(false);
                  }}
                  className="inline-flex w-full items-center gap-2 rounded-md border border-border bg-white/90 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3"
                  title="Exportar todos os pacientes (JSON)"
                >
 <Download className="h-3.5 w-3.5" />
                  Exportar
 </button>

                {/* Font scale */}
 <div className="flex items-center justify-between rounded-md border border-border bg-white/90 px-2 py-1.5" title="Tamanho da fonte">
 <div className="flex items-center gap-1.5">
 <Type className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="text-[11px] font-semibold text-foreground">FONTE</span>
 </div>
 <div className="flex items-center gap-0.5">
 <button
                      type="button"
                      onClick={() => bumpFont(-FONT_STEP)}
                      disabled={fontScale <= FONT_MIN + 0.001}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
                      title="Diminuir fonte"
                    >
 <Minus className="h-3 w-3" />
 </button>
 <span className="min-w-[2.4rem] text-center font-mono text-[11px] tabular-nums text-foreground">
                      {Math.round(fontScale * 100)}%
 </span>
 <button
                      type="button"
                      onClick={() => bumpFont(+FONT_STEP)}
                      disabled={fontScale >= FONT_MAX - 0.001}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
                      title="Aumentar fonte"
                    >
 <Plus className="h-3 w-3" />
 </button>
 <button
                      type="button"
                      onClick={() => setFontScale(1)}
                      className="ml-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                      title="Restaurar tamanho padrão"
                    >
                      A
 </button>
 </div>
 </div>
 </div>
            )}
 </div>
 </div>

        {/* Filters strip with counts inline */}
 <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-surface/50 px-6 py-2">
          {(
            [
              { v: "all", label: "Todos", count: counts.total, c: "text-foreground" },
              { v: "critical", label: "Críticos", count: counts.critical, c: "text-clinical-critical" },
              { v: "attention", label: "Atenção", count: counts.attention, c: "text-clinical-attention" },
              { v: "stable", label: "Estáveis", count: counts.stable, c: "text-clinical-stable" },
            ] as { v: Filter; label: string; count: number; c: string }[]
          ).map((f) => (
 <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
                filter === f.v
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:bg-surface-3/60 hover:text-foreground"
              }`}
            >
 <span>{f.label}</span>
 <span className={`font-mono tabular-nums ${filter === f.v ? "text-foreground" : f.c}`}>
                {f.count}
 </span>
 </button>
          ))}
 </div>
 </header>

      {/* Patient deck — one patient per screen, slide sideways to walk between them */}
      <main className="no-print" style={{ paddingTop: headerHeight || undefined }}>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</div>
        ) : (
          <>
            {/* Navegação lateral */}
            <div className="sticky z-20 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-2 backdrop-blur" style={{ top: headerHeight || 0 }}>
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current <= 0}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-3 disabled:opacity-40"
                aria-label="Paciente anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {filtered.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
                      i === current
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                    title={p.name}
                  >
                    {p.bed}
                  </button>
                ))}
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {current + 1}/{filtered.length}
              </span>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current >= filtered.length - 1}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-3 disabled:opacity-40"
                aria-label="Próximo paciente"
              >
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              ref={deckRef}
              onScroll={handleDeckScroll}
              className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
            >
              {filtered.map((p) => (
                <section key={p.id} className="w-full min-w-0 shrink-0 snap-start overflow-hidden">
                  <PatientRow
                    patient={p}
                    defaultOpen
                    onEdit={openEdit}
                    onPrint={setPrinting}
                    onUpdate={handleSave}
                    onArchive={(pt) => {
                      setPatients((prev) => prev.map((x) => (x.id === pt.id ? { ...x, archived: true, archivedAt: new Date().toISOString() } : x)));
                      toast.success("Paciente arquivado", { description: `${pt.name} (${pt.bed}) foi movido para o histórico.` });
                    }}
                    onDelete={(pt) => {
                      setPatients((prev) => prev.filter((x) => x.id !== pt.id));
                      toast.success("Paciente removido", { description: `${pt.name} (${pt.bed}) foi removido do sistema.` });
                    }}
                  />
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Legend */}
 <footer className="no-print border-t border-border bg-surface/40 px-6 py-3">
 <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
 <span className="font-semibold text-foreground">Legenda clínica</span>
          {[
            { c: "bg-clinical-neutral", l: "Neutro" },
            { c: "bg-clinical-resp", l: "Respiratório" },
            { c: "bg-clinical-stable", l: "Estável" },
            { c: "bg-clinical-attention", l: "Atenção" },
            { c: "bg-clinical-device", l: "Dispositivos" },
            { c: "bg-clinical-critical", l: "Crítico" },
            { c: "bg-clinical-neuro", l: "Neurologia" },
            { c: "bg-clinical-nutri", l: "Nutrição" },
          ].map((x) => (
 <span key={x.l} className="flex items-center gap-1.5">
 <span className={`h-2 w-2 rounded-full ${x.c}`} />
              {x.l}
 </span>
          ))}
 </div>
 </footer>

      {/* Print mount — visible only via @media print rules in styles.css */}
 <div id="print-area">{printing && <PatientPrintView patient={printing} />}</div>

 <PatientEditor
        open={editorOpen}
        initial={editing}
        initialTab={editingTab}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          setEditingTab(undefined);
        }}
        onSave={handleSave}
      />

 <DilutionCenter
        open={dilutionOpen}
        onClose={() => setDilutionOpen(false)}
        patients={active.map((p) => ({ id: p.id, name: p.name, bed: p.bed, weight: p.weight }))}
        onAddToPatient={(patientId, med) =>
          setPatients((prev) =>
            prev.map((p) => (p.id === patientId ? { ...p, medications: [...p.medications, med] } : p)),
          )
        }
      />

 <ExamsMatrix open={examsOpen} onClose={() => setExamsOpen(false)} patients={active} />

      {historyOpen && (
 <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
 <div className="mt-12 w-full max-w-[95vw] rounded-2xl border border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
 <div className="mb-4 flex items-center justify-between">
 <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
 <Archive className="h-4 w-4" /> Histórico — pacientes arquivados
 </h2>
 <button type="button" onClick={() => setHistoryOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground" aria-label="Fechar">
 <X className="h-4 w-4" />
 </button>
 </div>

            {archived.length === 0 ? (
 <p className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente arquivado.</p>
            ) : (
 <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                {archived.map((p) => (
 <li key={p.id} className="rounded-lg border border-border bg-surface/60">
 <div className="flex items-center gap-3 px-3 py-2">
 <div className="min-w-0 flex-1">
 <div className="truncate text-[13px] font-semibold text-foreground">{p.name}</div>
 <div className="font-mono text-[11px] text-muted-foreground">
                        {p.bed}
                        {p.archivedAt ? ` · arquivado em ${new Date(p.archivedAt).toLocaleDateString("pt-BR")}` : ""}
 </div>
 </div>
 <button
                      type="button"
                      onClick={() => {
                        setPatients((prev) => prev.map((x) => (x.id === p.id ? { ...x, archived: false, archivedAt: undefined } : x)));
                        toast.success("Paciente desarquivado", { description: `${p.name} voltou para o leito ${p.bed}.` });
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
 <RotateCcw className="h-3.5 w-3.5" />
                      Desarquivar
 </button>
 <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remover ${p.name} (${p.bed}) definitivamente?`)) {
                          setPatients((prev) => prev.filter((x) => x.id !== p.id));
                        }
                      }}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-clinical-critical/15 hover:text-clinical-critical"
                      title="Excluir definitivamente"
                    >
 <X className="h-3.5 w-3.5" />
 </button>
 </div>
 <div className="border-t border-border bg-background">
 <PatientRow
                       patient={p}
                       onEdit={openEdit}
                       onPrint={setPrinting}
                       onUpdate={handleSave}
                     />
 </div>
 </li>
                ))}
 </ul>
            )}
 </div>
 </div>
      )}
 </div>
  );
}
