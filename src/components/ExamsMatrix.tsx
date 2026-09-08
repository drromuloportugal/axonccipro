import { useEffect, useMemo, useState, Fragment } from "react";
import type { Patient } from "@/data/patients";
import { X, Search, FlaskConical, RefreshCw, Printer, Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Catálogo de exames — agrupados por categoria (para cores e filtros)
// ============================================================================

export type ExamCategory =
  | "lab_hemato"
  | "lab_bio"
  | "lab_hepat"
  | "lab_marc"
  | "lab_lip"
  | "lab_endo"
  | "lab_panc"
  | "lab_urina"
  | "microbio"
  | "gaso"
  | "img_rx"
  | "img_usg"
  | "img_tc"
  | "img_rm"
  | "img_eco"
  | "img_hemod"
  | "img_nuclear";

export type ExamGroup = "lab" | "img" | "micro" | "gaso";

export interface ExamCatalogItem {
  code: string;
  label: string;
  category: ExamCategory;
  group: ExamGroup;
  section: string;
}

const CAT: Record<ExamCategory, { section: string; group: ExamGroup }> = {
  lab_hemato: { section: "Hematologia", group: "lab" },
  lab_bio: { section: "Bioquímica", group: "lab" },
  lab_hepat: { section: "Função hepática", group: "lab" },
  lab_marc: { section: "Marcadores", group: "lab" },
  lab_lip: { section: "Perfil lipídico", group: "lab" },
  lab_endo: { section: "Endócrinos", group: "lab" },
  lab_panc: { section: "Pancreáticos", group: "lab" },
  lab_urina: { section: "Urina", group: "lab" },
  microbio: { section: "Microbiologia", group: "micro" },
  gaso: { section: "Gasometrias", group: "gaso" },
  img_rx: { section: "Radiografia", group: "img" },
  img_usg: { section: "Ultrassonografia", group: "img" },
  img_tc: { section: "Tomografia", group: "img" },
  img_rm: { section: "Ressonância", group: "img" },
  img_eco: { section: "Ecocardiografia", group: "img" },
  img_hemod: { section: "Hemodinâmica", group: "img" },
  img_nuclear: { section: "Medicina nuclear", group: "img" },
};

const raw: [ExamCategory, string[]][] = [
  [
    "lab_hemato",
    ["Hemograma", "Plaquetas", "Reticulócitos", "TAP", "INR", "TTPA", "Fibrinogênio", "Dímero D"],
  ],
  [
    "lab_bio",
    [
      "Glicemia",
      "Ureia",
      "Creatinina",
      "Sódio",
      "Potássio",
      "Magnésio",
      "Cálcio total",
      "Cálcio iônico",
      "Cloro",
      "Fósforo",
      "Ácido úrico",
    ],
  ],
  ["lab_hepat", ["TGO", "TGP", "FA", "GGT", "Bilirrubinas", "Albumina", "Proteínas totais"]],
  [
    "lab_marc",
    ["PCR", "Procalcitonina", "Ferritina", "Troponina", "CK", "CK-MB", "BNP", "Lactato"],
  ],
  ["lab_lip", ["Colesterol total", "HDL", "LDL", "Triglicerídeos"]],
  ["lab_endo", ["TSH", "T4 livre", "Cortisol"]],
  ["lab_panc", ["Amilase", "Lipase"]],
  ["lab_urina", ["EAS", "Urocultura", "Urina 24h"]],
  [
    "microbio",
    [
      "Hemocultura",
      "Cultura traqueal",
      "Cultura de ferida",
      "Cultura de cateter",
      "Escovado protegido",
      "Pesquisa de fungos",
      "Antibiograma",
    ],
  ],
  ["gaso", ["Gasometria arterial", "Gasometria venosa", "Lactato arterial", "Lactato venoso"]],
  ["img_rx", ["RX Tórax", "RX Abdome", "RX Pelve", "RX Coluna", "RX Crânio", "RX Membros"]],
  [
    "img_usg",
    [
      "USG Abdome",
      "USG Renal",
      "USG Hepática",
      "USG Vias biliares",
      "USG Doppler venoso",
      "USG Doppler arterial",
      "Ecografia pulmonar",
    ],
  ],
  ["img_tc", ["TC Crânio", "TC Face", "TC Tórax", "TC Abdome", "TC Pelve", "TC Coluna", "AngioTC"]],
  ["img_rm", ["RM Encéfalo", "RM Coluna", "RM Abdome", "RM Pelve", "RM Articulações", "AngioRM"]],
  ["img_eco", ["Ecocardiograma transtorácico", "Ecocardiograma transesofágico"]],
  ["img_hemod", ["Coronariografia", "Arteriografia", "Angiografia", "Venografia"]],
  ["img_nuclear", ["PET CT", "Cintilografia"]],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const EXAM_CATALOG: ExamCatalogItem[] = raw.flatMap(([cat, items]) =>
  items.map((label) => ({
    code: `${cat}__${slug(label)}`,
    label,
    category: cat,
    group: CAT[cat].group,
    section: CAT[cat].section,
  })),
);

const SECTION_ORDER: string[] = Array.from(new Set(EXAM_CATALOG.map((e) => e.section)));

// Exames pré-selecionados por padrão em cada leito
const DEFAULT_PRESELECTED: string[] = [
  "lab_hemato__hemograma",
  "lab_hemato__plaquetas",
  "lab_marc__pcr",
  "lab_bio__ureia",
  "lab_bio__creatinina",
  "lab_bio__sodio",
  "lab_bio__potassio",
  "lab_bio__magnesio",
  "lab_bio__calcio_ionico",
  "gaso__gasometria_arterial",
  "gaso__lactato_arterial",
  "img_rx__rx_torax",
];

const GROUP_META: Record<ExamGroup, { label: string; ring: string; chip: string; dot: string }> = {
  lab: {
    label: "Laboratório",
    ring: "border-l-clinical-resp",
    chip: "bg-clinical-resp/10 text-clinical-resp",
    dot: "bg-clinical-resp",
  },
  img: {
    label: "Imagem",
    ring: "border-l-clinical-stable",
    chip: "bg-clinical-stable/10 text-clinical-stable",
    dot: "bg-clinical-stable",
  },
  micro: {
    label: "Microbiologia",
    ring: "border-l-clinical-neuro",
    chip: "bg-clinical-neuro/10 text-clinical-neuro",
    dot: "bg-clinical-neuro",
  },
  gaso: {
    label: "Gasometrias",
    ring: "border-l-clinical-device",
    chip: "bg-clinical-device/10 text-clinical-device",
    dot: "bg-clinical-device",
  },
};

// ============================================================================
// Storage model — três estados para permitir controle de exames de imagem
// ============================================================================

type ExamStatus = "none" | "aguardando" | "bom";

type Store = {
  requested: Record<string, ExamStatus>; // key = `${examCode}::${bed}`
  preseededBeds: Record<string, boolean>; // bed → true quando já semeamos os padrões
};

const STORAGE_KEY = "passometro:exams-matrix:v3";

function normalizeStatus(v: unknown): ExamStatus {
  if (v === "aguardando" || v === "bom") return v;
  if (v === true || v === "true") return "aguardando";
  return "none";
}

function loadStore(): Store {
  if (typeof window === "undefined") return { requested: {}, preseededBeds: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { requested: {}, preseededBeds: {} };
    const parsed = JSON.parse(raw);
    const migrated: Record<string, ExamStatus> = {};
    if (parsed.requested && typeof parsed.requested === "object") {
      for (const [k, v] of Object.entries(parsed.requested)) {
        migrated[k] = normalizeStatus(v);
      }
    }
    return {
      requested: migrated,
      preseededBeds: parsed.preseededBeds ?? {},
    };
  } catch {
    return { requested: {}, preseededBeds: {} };
  }
}

function saveStore(s: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function isRequested(status: ExamStatus | undefined) {
  return status === "aguardando" || status === "bom";
}

// ============================================================================
// Component
// ============================================================================

type CatFilter = "all" | ExamGroup;

export function ExamsMatrix({
  open,
  onClose,
  patients,
}: {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
}) {
  const [store, setStore] = useState<Store>({ requested: {}, preseededBeds: {} });
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CatFilter>("all");
  const [onlyRequested, setOnlyRequested] = useState(false);

  const beds = useMemo(
    () =>
      patients
        .map((p) => ({ bed: p.bed, name: p.name, id: p.id }))
        .sort((a, b) => a.bed.localeCompare(b.bed)),
    [patients],
  );

  // Load persisted state whenever opened + semear padrões para leitos novos.
  useEffect(() => {
    if (!open) return;
    const loaded = loadStore();
    let changed = false;
    for (const b of beds) {
      if (!loaded.preseededBeds[b.bed]) {
        for (const code of DEFAULT_PRESELECTED) {
          loaded.requested[`${code}::${b.bed}`] = "aguardando";
        }
        loaded.preseededBeds[b.bed] = true;
        changed = true;
      }
    }
    if (changed) saveStore(loaded);
    setStore(loaded);
  }, [open, beds]);

  // Persist on any change.
  useEffect(() => {
    if (open) saveStore(store);
  }, [store, open]);

  const filteredExams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXAM_CATALOG.filter((e) => {
      if (cat !== "all" && e.group !== cat) return false;
      if (onlyRequested) {
        const any = beds.some((b) => isRequested(store.requested[`${e.code}::${b.bed}`]));
        if (!any) return false;
      }
      if (q && !e.label.toLowerCase().includes(q) && !e.section.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [query, cat, onlyRequested, beds, store]);

  const examsBySection = useMemo(() => {
    const map = new Map<string, ExamCatalogItem[]>();
    for (const e of filteredExams) {
      if (!map.has(e.section)) map.set(e.section, []);
      map.get(e.section)!.push(e);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => [s, map.get(s)!] as const);
  }, [filteredExams]);

  const totalRequested = useMemo(
    () => Object.values(store.requested).filter(isRequested).length,
    [store.requested],
  );

  const cellKey = (code: string, bed: string) => `${code}::${bed}`;

  const statusCycle = (status: ExamStatus | undefined): ExamStatus => {
    if (!status || status === "none") return "aguardando";
    if (status === "aguardando") return "bom";
    return "none";
  };

  const toggle = (code: string, bed: string) => {
    setStore((prev) => {
      const key = cellKey(code, bed);
      const next = { ...prev.requested };
      const current = next[key] ?? "none";
      const updated = statusCycle(current);
      if (updated === "none") delete next[key];
      else next[key] = updated;
      return { ...prev, requested: next };
    });
  };

  const printPDF = () => {
    const rows = EXAM_CATALOG.map((e) => {
      const bedsRequested = beds.filter((b) =>
        isRequested(store.requested[cellKey(e.code, b.bed)]),
      );
      return { exam: e, bedsRequested };
    }).filter((r) => r.bedsRequested.length > 0);

    const patientsWithSelection = beds.filter((b) =>
      EXAM_CATALOG.some((e) => isRequested(store.requested[cellKey(e.code, b.bed)])),
    );

    if (rows.length === 0) {
      toast.error("Nenhum exame selecionado para imprimir");
      return;
    }

    const sectionsMap = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = sectionsMap.get(r.exam.section) ?? [];
      arr.push(r);
      sectionsMap.set(r.exam.section, arr);
    }
    const sections = SECTION_ORDER.filter((s) => sectionsMap.has(s));

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const today = new Date().toLocaleDateString("pt-BR");

    const headerCells = patientsWithSelection
      .map(
        (b) =>
          `<th><div class="bed">${esc(b.bed)}</div><div class="pt">${esc(b.name.split(" ")[0])}</div></th>`,
      )
      .join("");

    const bodyHTML = sections
      .map((section) => {
        const items = sectionsMap.get(section)!;
        const secRow = `<tr class="sec"><td colspan="${1 + patientsWithSelection.length}">${esc(section)}</td></tr>`;
        const itemRows = items
          .map((r) => {
            const cells = patientsWithSelection
              .map((b) =>
                isRequested(store.requested[cellKey(r.exam.code, b.bed)])
                  ? `<td class="mk">${store.requested[cellKey(r.exam.code, b.bed)] === "bom" ? "Bom" : "Aguardando"}</td>`
                  : `<td></td>`,
              )
              .join("");
            return `<tr><td class="ex">${esc(r.exam.label)}</td>${cells}</tr>`;
          })
          .join("");
        return secRow + itemRows;
      })
      .join("");

    const totalRequests = rows.reduce((acc, r) => acc + r.bedsRequested.length, 0);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Exames da UTI — ${today}</title>
<style> @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #111; margin: 0; padding: 12px; font-size: 10px; }
  h1 { font-size: 14px; margin: 0 0 4px; letter-spacing: 0.14em; text-transform: uppercase; }
  .meta { font-size: 9px; color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #333; padding: 3px 4px; text-align: center; vertical-align: middle; font-size: 9px; }
  th { background: #eee; }
  th:first-child, td.ex { text-align: left; width: 180px; }
  td.ex { font-weight: 500; }
  tr.sec td { background: #d9d9d9; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px; text-align: left; }
  td.mk { font-weight: 700; }
  .bed { font-family: ui-monospace, monospace; font-weight: 700; font-size: 10px; }
  .pt { font-size: 8px; color: #333; font-weight: 400; }
  .foot { margin-top: 8px; font-size: 8px; color: #666; }
</style></head><body>
 <h1> Exames da UTI</h1>
 <div class="meta">Data: ${today} · ${patientsWithSelection.length} paciente(s) · ${rows.length} exame(s) · ${totalRequests} solicitação(ões)</div>
 <table>
 <thead><tr><th>Exame</th>${headerCells}</tr></thead>
 <tbody>${bodyHTML}</tbody>
 </table>
 <div class="foot">Passômetro UTI — impressão gerada automaticamente.</div>
 <script>window.onload = () => { setTimeout(() => { window.print(); }, 200); };</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur">
      {" "}
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-clinical-resp/15 text-clinical-resp">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-[0.18em] text-foreground"> EXAMES DA UTI</h2>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {" "}
              {beds.length} leito(s) · {EXAM_CATALOG.length} exames catalogados · {totalRequested}{" "}
              solicitação(ões)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>{" "}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-5 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar exame"
            className="w-64 rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5">
          <Filter className="mr-0.5 h-3 w-3 text-muted-foreground" />{" "}
          {(["all", "lab", "img", "micro", "gaso"] as CatFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                cat === c
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {" "}
              {c === "all" ? "Todos" : GROUP_META[c as ExamGroup].label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={onlyRequested}
            onChange={(e) => setOnlyRequested(e.target.checked)}
          />{" "}
          Somente solicitados
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setStore(loadStore());
              toast.success("Painel atualizado");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-3"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={() => {
              if (
                !window.confirm(
                  "Redefinir todos os leitos para os exames pré-selecionados? As solicitações extras serão removidas.",
                )
              )
                return;
              const next: Store = { requested: {}, preseededBeds: {} };
              for (const b of beds) {
                for (const code of DEFAULT_PRESELECTED)
                  next.requested[`${code}::${b.bed}`] = "aguardando";
                next.preseededBeds[b.bed] = true;
              }
              setStore(next);
              saveStore(next);
              toast.success("Painel redefinido para os exames padrão");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            onClick={printPDF}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-3"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir PDF
          </button>
        </div>
      </div>{" "}
      {/* Matrix */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-[12px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="sticky left-0 z-20 min-w-[170px] max-w-[170px] border-b border-r-2 border-border-strong bg-surface px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                {" "}
                Exame
              </th>
              {beds.map((b) => (
                <th
                  key={b.id}
                  className="min-w-[76px] border-b border-l border-border bg-surface px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-foreground"
                  title={b.name}
                >
                  <div className="font-mono text-clinical-neutral">{b.bed}</div>
                  <div className="mt-0.5 truncate text-[9px] font-normal normal-case text-muted-foreground">
                    {b.name.split(" ")[0]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {examsBySection.map(([section, exams]) => (
              <Fragment key={section}>
                <tr key={`s-${section}`}>
                  <td
                    colSpan={1 + beds.length}
                    className="sticky left-0 border-b border-t border-border bg-surface-2 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${GROUP_META[exams[0].group].dot}`}
                    />{" "}
                    {section}
                  </td>
                </tr>
                {exams.map((e) => (
                  <tr key={e.code} className="group">
                    <td
                      className={`sticky left-0 z-[5] min-w-[170px] max-w-[170px] border-b border-r-2 border-border-strong border-l-4 bg-background px-2 py-1.5 text-left ${GROUP_META[e.group].ring}`}
                    >
                      <span className="truncate text-foreground" title={e.label}>
                        {e.label}
                      </span>
                    </td>
                    {beds.map((b) => {
                      const key = cellKey(e.code, b.bed);
                      const status = store.requested[key] ?? "none";
                      const checked = status !== "none";
                      const isImage = e.group === "img";
                      const statusClass = isImage
                        ? status === "bom"
                          ? "border-green-500 bg-green-500 text-white"
                          : status === "aguardando"
                            ? "border-yellow-500 bg-yellow-500 text-white"
                            : "border-border bg-background"
                        : checked
                          ? "border-clinical-resp bg-clinical-resp text-white"
                          : "border-border bg-background";
                      const title =
                        status === "bom"
                          ? "Bom — clique para desmarcar"
                          : status === "aguardando"
                            ? "Aguardando — clique para marcar como bom"
                            : "Clique para solicitar";
                      return (
                        <td
                          key={b.id}
                          className="border-b border-l border-border bg-background p-0 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => toggle(e.code, b.bed)}
                            className="flex h-8 w-full items-center justify-center transition-colors hover:bg-surface-2"
                            title={title}
                          >
                            <span
                              aria-checked={checked}
                              role="checkbox"
                              className={`grid h-4 w-4 place-items-center rounded border transition-colors ${statusClass}`}
                            >
                              {" "}
                              {checked && (
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path
                                    d="M2.5 6.5l2.5 2.5 4.5-5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
            {examsBySection.length === 0 && (
              <tr>
                <td
                  colSpan={1 + beds.length}
                  className="px-4 py-10 text-center text-[12px] text-muted-foreground"
                >
                  {" "}
                  Nenhum exame corresponde aos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
