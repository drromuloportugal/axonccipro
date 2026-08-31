// Biblioteca inteligente de culturas microbiológicas.
// - catálogo de fontes (hemo/uro/trach/bal/feridas/líquidos estéreis)
// - biblioteca de microrganismos (Gram +, Gram -, Fungos)
// - painel padrão de antibióticos para antibiograma
// - alertas automáticos (MRSA, KPC, NDM, ESBL, VRE, MDR/XDR/PDR,
//   Pseudomonas, Acinetobacter, Fungemia, hemocultura positiva)
// - correlação automática fonte → foco anatômico
import type { Culture, AntibiogramResult } from "@/data/patients";

// ----- Fontes -----------------------------------------------------------------

export const CULTURE_SOURCES = [
  { code: "hemo_perif",  label: "Hemocultura periférica",         group: "Hemoculturas" },
  { code: "hemo_cvc",    label: "Hemocultura CVC",                 group: "Hemoculturas" },
  { code: "hemo_pai",    label: "Hemocultura cateter arterial",    group: "Hemoculturas" },
  { code: "uro",         label: "Urocultura",                      group: "Urocultura" },
  { code: "trach",       label: "Aspirado traqueal",               group: "Vias aéreas" },
  { code: "bal",         label: "Lavado broncoalveolar (BAL)",     group: "Vias aéreas" },
  { code: "escovado",    label: "Escovado protegido (PSB)",        group: "Vias aéreas" },
  { code: "ferida",      label: "Cultura de ferida",               group: "Pele e partes moles" },
  { code: "liquor",      label: "Líquor (LCR)",                    group: "Líquidos estéreis" },
  { code: "pleural",     label: "Líquido pleural",                 group: "Líquidos estéreis" },
  { code: "peritoneal",  label: "Líquido peritoneal",              group: "Líquidos estéreis" },
  { code: "pericardico", label: "Líquido pericárdico",             group: "Líquidos estéreis" },
  { code: "sinovial",    label: "Líquido sinovial",                group: "Líquidos estéreis" },
  { code: "outro",       label: "Outro material",                  group: "Outros" },
] as const;

export type CultureSourceCode = (typeof CULTURE_SOURCES)[number]["code"];

export const COLLECTION_METHODS: Record<string, string[]> = {
  uro:   ["Jato médio", "Sonda vesical", "Punção suprapúbica", "Cateterização"],
  hemo_perif: ["Punção periférica"],
  hemo_cvc:   ["Coleta por CVC"],
  hemo_pai:   ["Coleta por cateter arterial"],
  bal:      ["Broncoscopia", "BAL às cegas"],
  escovado: ["Broncoscopia (escovado protegido)", "PSB às cegas"],
  trach:    ["Aspirado endotraqueal"],
};

// ----- Biblioteca de microrganismos -------------------------------------------

export const ORGANISM_LIBRARY = {
  gramPos: [
 "Staphylococcus aureus",
 "Staphylococcus aureus (MRSA)",
 "Staphylococcus epidermidis",
 "Streptococcus pneumoniae",
 "Streptococcus pyogenes",
 "Enterococcus faecalis",
 "Enterococcus faecium",
 "Enterococcus faecium (VRE)",
  ],
  gramNeg: [
 "Klebsiella pneumoniae",
 "Klebsiella pneumoniae (ESBL)",
 "Klebsiella pneumoniae (KPC)",
 "Klebsiella pneumoniae (NDM)",
 "Escherichia coli",
 "Escherichia coli (ESBL)",
 "Pseudomonas aeruginosa",
 "Acinetobacter baumannii",
 "Enterobacter cloacae",
 "Serratia marcescens",
 "Proteus mirabilis",
 "Stenotrophomonas maltophilia",
  ],
  fungos: [
 "Candida albicans",
 "Candida glabrata",
 "Candida tropicalis",
 "Candida auris",
 "Aspergillus fumigatus",
 "Cryptococcus neoformans",
  ],
};

export const ALL_ORGANISMS = [
  ...ORGANISM_LIBRARY.gramPos,
  ...ORGANISM_LIBRARY.gramNeg,
  ...ORGANISM_LIBRARY.fungos,
];

// ----- Painel padrão de antibiograma ------------------------------------------

export const ABX_PANEL = [
 "Oxacilina", "Cefazolina", "Ceftriaxona", "Ceftazidima", "Cefepime",
 "Piperacilina-tazobactam", "Ampicilina-sulbactam",
 "Ertapenem", "Imipenem", "Meropenem",
 "Amicacina", "Gentamicina",
 "Ciprofloxacino", "Levofloxacino",
 "Vancomicina", "Linezolida", "Daptomicina", "Teicoplanina",
 "Polimixina B", "Colistina", "Tigeciclina", "Fosfomicina",
 "Sulfametoxazol-trimetoprim",
 "Fluconazol", "Voriconazol", "Anfotericina B", "Caspofungina", "Micafungina",
];

// ----- Resultado / classificação ----------------------------------------------

export interface CultureResultBadge {
  label: string;
  className: string;
  icon: string;
}

export function cultureResultBadge(c: Culture): CultureResultBadge {
  if (c.result === "negativa")
    return { label: "Negativa", className: "text-clinical-stable", icon: "" };
  if (
    c.result === "andamento" ||
    c.resistanceProfile === "pendente" ||
    (!c.organism && !c.result)
  )
    return { label: "Em andamento", className: "text-clinical-attention", icon: "" };
  return { label: "Positiva", className: "text-clinical-critical", icon: "" };
}

export function abxResultBadge(r: AntibiogramResult) {
  if (r === "S") return { label: "Sensível",       icon: "", className: "text-clinical-stable" };
  if (r === "I") return { label: "Intermediária",  icon: "", className: "text-clinical-attention" };
  return            { label: "Resistente",         icon: "", className: "text-clinical-critical" };
}

// ----- Alertas inteligentes ---------------------------------------------------

export type AlertSeverity = "critical" | "attention";
export interface CultureAlert {
  code: string;
  label: string;
  severity: AlertSeverity;
}

export function detectCultureAlerts(c: Culture): CultureAlert[] {
  const out: CultureAlert[] = [];
  if (c.result === "negativa") return out;
  const org = (c.organism ?? "").toLowerCase();
  const src = (c.source ?? "").toLowerCase();
  const code = (c.sourceCode ?? "").toLowerCase();
  if (!org) return out;

  const push = (a: CultureAlert) => {
    if (!out.some((x) => x.code === a.code)) out.push(a);
  };

  if (/mrsa/.test(org)) push({ code: "MRSA", label: "MRSA", severity: "critical" });
  if (/vre|vanco?-?res/.test(org)) push({ code: "VRE", label: "VRE", severity: "critical" });
  if (/kpc/.test(org)) push({ code: "KPC", label: "KPC", severity: "critical" });
  if (/ndm/.test(org)) push({ code: "NDM", label: "NDM", severity: "critical" });
  if (/esbl/.test(org)) push({ code: "ESBL", label: "ESBL", severity: "critical" });
  if (/acinetobacter/.test(org))
    push({ code: "ACINETO", label: "Acinetobacter", severity: "critical" });
  if (/pseudomonas/.test(org))
    push({ code: "PSEUDO", label: "Pseudomonas", severity: "attention" });
  if (/candida|aspergillus|cryptococcus/.test(org)) {
    push({ code: "FUNGO", label: "Crescimento fúngico", severity: "critical" });
    if (src.includes("hemo") || code.startsWith("hemo"))
      push({ code: "FUNGEMIA", label: "Fungemia", severity: "critical" });
  }
  if (src.includes("hemo") || code.startsWith("hemo"))
    push({ code: "HEMOPOS", label: "Hemocultura positiva", severity: "critical" });
  if (c.resistanceProfile && ["MDR", "XDR", "PDR"].includes(c.resistanceProfile))
    push({ code: c.resistanceProfile, label: c.resistanceProfile, severity: "critical" });

  return out;
}

// ----- Correlação fonte → foco -------------------------------------------------

export function sourceToFocus(c: Culture): string | null {
  const s = (c.sourceCode ?? c.source ?? "").toLowerCase();
  if (/hemo/.test(s)) return "Corrente sanguínea";
  if (/uro/.test(s)) return "Foco urinário";
  if (/trach|aspirado/.test(s)) return "Foco pulmonar (vias aéreas)";
  if (/bal|broncoalveolar/.test(s)) return "Foco pulmonar (BAL)";
  if (/escovado|psb/.test(s)) return "Foco pulmonar (escovado protegido)";
  if (/ferida/.test(s)) return "Pele / partes moles / ferida";
  if (/liquor|lcr/.test(s)) return "SNC";
  if (/pleural/.test(s)) return "Cavidade pleural";
  if (/peritoneal/.test(s)) return "Cavidade peritoneal";
  if (/pericard/.test(s)) return "Cavidade pericárdica";
  if (/sinovial/.test(s)) return "Articular";
  return null;
}
