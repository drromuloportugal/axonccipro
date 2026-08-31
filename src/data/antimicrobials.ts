// Biblioteca de antimicrobianos (FARMÁCIA · aba Antimicrobianos)
// Organizada em: grupo → classe → fármacos, com dose e duração recomendadas
// (editáveis pelo usuário) e classificação AWaRe da OMS.

export type AwareClass = "Access" | "Watch" | "Reserve";

export interface AntimicrobialDrug {
  /** Nome comercial/genérico exibido */
  name: string;
  /** Dose usual adulto (função renal normal) */
  dose: string;
  /** Intervalo/frequência usual */
  freq: string;
  /** Duração recomendada (dias) para a indicação típica */
  days: number;
  /** Classificação AWaRe (OMS 2023) */
  aware: AwareClass;
  /** Via preferencial */
  route?: string;
  /** Requer ajuste por função renal */
  renal?: boolean;
  /** Espectro simplificado, usado no motor de duplicidade */
  spectrum?: Array<"gram+" | "gram-" | "mrsa" | "pseudomonas" | "anaerobio" | "atipico" | "fungo" | "virus" | "parasita">;
}

export interface AntimicrobialClass {
  id: string;
  label: string;
  drugs: AntimicrobialDrug[];
}

export interface AntimicrobialGroup {
  id: string;
  label: string;
  icon: string;
  classes: AntimicrobialClass[];
}

const d = (
  name: string,
  dose: string,
  freq: string,
  days: number,
  aware: AwareClass,
  extra: Partial<AntimicrobialDrug> = {},
): AntimicrobialDrug => ({ name, dose, freq, days, aware, ...extra });

export const ANTIMICROBIAL_LIBRARY: AntimicrobialGroup[] = [
  {
    id: "antibact",
    label: "Antibacterianos",
    icon: "🦠",
    classes: [
      {
        id: "pen-nat",
        label: "β-lactâmicos · Penicilinas naturais",
        drugs: [
          d("Penicilina G cristalina", "2–4 milhões UI", "4/4h EV", 10, "Access", { renal: true, spectrum: ["gram+"] }),
          d("Penicilina V", "500 mg", "6/6h VO", 10, "Access", { spectrum: ["gram+"] }),
        ],
      },
      {
        id: "aminopen",
        label: "β-lactâmicos · Aminopenicilinas",
        drugs: [
          d("Amoxicilina", "500–1000 mg", "8/8h VO", 7, "Access", { spectrum: ["gram+", "gram-"] }),
          d("Ampicilina", "2 g", "4/4–6/6h EV", 10, "Access", { renal: true, spectrum: ["gram+", "gram-"] }),
        ],
      },
      {
        id: "pen-res",
        label: "β-lactâmicos · Penicilinas antiestafilocócicas",
        drugs: [
          d("Oxacilina", "2 g", "4/4h EV", 14, "Access", { spectrum: ["gram+"] }),
          d("Nafcilina", "2 g", "4/4h EV", 14, "Access", { spectrum: ["gram+"] }),
          d("Cloxacilina", "500–1000 mg", "6/6h", 10, "Access", { spectrum: ["gram+"] }),
        ],
      },
      {
        id: "ureido",
        label: "β-lactâmicos · Ureido/Carboxipenicilinas",
        drugs: [
          d("Piperacilina", "4 g", "6/6h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Ticarcilina", "3 g", "4/4–6/6h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
        ],
      },
      {
        id: "cef1",
        label: "Cefalosporinas · 1ª geração",
        drugs: [
          d("Cefazolina", "1–2 g", "8/8h EV", 7, "Access", { renal: true, spectrum: ["gram+"] }),
          d("Cefalexina", "500 mg", "6/6h VO", 7, "Access", { spectrum: ["gram+"] }),
        ],
      },
      {
        id: "cef2",
        label: "Cefalosporinas · 2ª geração",
        drugs: [
          d("Cefuroxima", "750–1500 mg", "8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-"] }),
          d("Cefaclor", "500 mg", "8/8h VO", 7, "Watch", { spectrum: ["gram+", "gram-"] }),
        ],
      },
      {
        id: "cef3",
        label: "Cefalosporinas · 3ª geração",
        drugs: [
          d("Ceftriaxona", "1–2 g", "12/12–24/24h EV", 7, "Watch", { spectrum: ["gram+", "gram-"] }),
          d("Cefotaxima", "1–2 g", "6/6–8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-"] }),
          d("Ceftazidima", "2 g", "8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
        ],
      },
      {
        id: "cef4",
        label: "Cefalosporinas · 4ª geração",
        drugs: [d("Cefepima", "2 g", "8/8–12/12h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-", "pseudomonas"] })],
      },
      {
        id: "cef5",
        label: "Cefalosporinas · 5ª geração / anti-MRSA",
        drugs: [
          d("Ceftarolina", "600 mg", "12/12h EV", 7, "Reserve", { renal: true, spectrum: ["gram+", "mrsa"] }),
          d("Ceftobiprole", "500 mg", "8/8h EV", 7, "Reserve", { renal: true, spectrum: ["gram+", "mrsa"] }),
        ],
      },
      {
        id: "carba",
        label: "Carbapenêmicos",
        drugs: [
          d("Meropenem", "1–2 g", "8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-", "pseudomonas", "anaerobio"] }),
          d("Imipenem", "500 mg", "6/6h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-", "pseudomonas", "anaerobio"] }),
          d("Ertapenem", "1 g", "24/24h EV", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-", "anaerobio"] }),
          d("Doripenem", "500 mg", "8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
        ],
      },
      {
        id: "mono",
        label: "Monobactâmicos",
        drugs: [d("Aztreonam", "2 g", "8/8h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] })],
      },
      {
        id: "blbli",
        label: "Inibidores de β-lactamase e combinações",
        drugs: [
          d("Amoxicilina/clavulanato", "875/125 mg", "12/12h VO", 7, "Access", { spectrum: ["gram+", "gram-", "anaerobio"] }),
          d("Ampicilina/sulbactam", "3 g", "6/6h EV", 7, "Access", { renal: true, spectrum: ["gram+", "gram-", "anaerobio"] }),
          d("Piperacilina/tazobactam", "4,5 g", "6/6h EV (EI 4h)", 7, "Watch", { renal: true, spectrum: ["gram+", "gram-", "pseudomonas", "anaerobio"] }),
          d("Ceftazidima/avibactam", "2,5 g", "8/8h EV", 7, "Reserve", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Ceftolozana/tazobactam", "1,5–3 g", "8/8h EV", 7, "Reserve", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Meropenem/vaborbactam", "4 g", "8/8h EV", 7, "Reserve", { renal: true, spectrum: ["gram-"] }),
          d("Imipenem/cilastatina/relebactam", "1,25 g", "6/6h EV", 7, "Reserve", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
        ],
      },
      {
        id: "glico",
        label: "Glicopeptídeos",
        drugs: [
          d("Vancomicina", "15–20 mg/kg", "12/12h EV (alvo AUC 400–600)", 10, "Watch", { renal: true, spectrum: ["gram+", "mrsa"] }),
          d("Teicoplanina", "400 mg", "24/24h EV (após ataque)", 10, "Watch", { renal: true, spectrum: ["gram+", "mrsa"] }),
        ],
      },
      {
        id: "lipoglico",
        label: "Lipoglicopeptídeos",
        drugs: [
          d("Dalbavancina", "1500 mg", "dose única", 1, "Reserve", { spectrum: ["gram+", "mrsa"] }),
          d("Oritavancina", "1200 mg", "dose única", 1, "Reserve", { spectrum: ["gram+", "mrsa"] }),
          d("Telavancina", "10 mg/kg", "24/24h EV", 7, "Reserve", { renal: true, spectrum: ["gram+", "mrsa"] }),
        ],
      },
      {
        id: "amino",
        label: "Aminoglicosídeos",
        drugs: [
          d("Gentamicina", "5–7 mg/kg", "24/24h EV", 5, "Access", { renal: true, spectrum: ["gram-"] }),
          d("Amicacina", "15–20 mg/kg", "24/24h EV", 5, "Access", { renal: true, spectrum: ["gram-"] }),
          d("Tobramicina", "5–7 mg/kg", "24/24h EV", 5, "Access", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Estreptomicina", "15 mg/kg", "24/24h IM", 14, "Watch", { renal: true, spectrum: ["gram-"] }),
          d("Plazomicina", "15 mg/kg", "24/24h EV", 5, "Reserve", { renal: true, spectrum: ["gram-"] }),
        ],
      },
      {
        id: "macro",
        label: "Macrolídeos",
        drugs: [
          d("Azitromicina", "500 mg", "24/24h", 5, "Watch", { spectrum: ["atipico", "gram+"] }),
          d("Claritromicina", "500 mg", "12/12h", 7, "Watch", { spectrum: ["atipico", "gram+"] }),
          d("Eritromicina", "500 mg", "6/6h", 7, "Watch", { spectrum: ["atipico", "gram+"] }),
        ],
      },
      {
        id: "tetra",
        label: "Tetraciclinas",
        drugs: [
          d("Doxiciclina", "100 mg", "12/12h", 7, "Access", { spectrum: ["atipico", "gram+"] }),
          d("Tetraciclina", "500 mg", "6/6h VO", 7, "Access", { spectrum: ["atipico"] }),
          d("Minociclina", "100 mg", "12/12h", 7, "Watch", { spectrum: ["gram+", "mrsa"] }),
          d("Tigeciclina", "50 mg (ataque 100 mg)", "12/12h EV", 7, "Reserve", { spectrum: ["gram+", "gram-", "mrsa", "anaerobio"] }),
          d("Omadaciclina", "100 mg", "24/24h EV", 7, "Reserve", { spectrum: ["gram+", "mrsa"] }),
          d("Eravaciclina", "1 mg/kg", "12/12h EV", 7, "Reserve", { spectrum: ["gram-", "anaerobio"] }),
        ],
      },
      {
        id: "fq",
        label: "Fluoroquinolonas",
        drugs: [
          d("Ciprofloxacino", "400 mg", "8/8–12/12h EV", 7, "Watch", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Levofloxacino", "750 mg", "24/24h", 7, "Watch", { renal: true, spectrum: ["gram-", "atipico", "gram+"] }),
          d("Moxifloxacino", "400 mg", "24/24h", 7, "Watch", { spectrum: ["gram+", "atipico", "anaerobio"] }),
          d("Ofloxacino", "400 mg", "12/12h", 7, "Watch", { renal: true, spectrum: ["gram-"] }),
          d("Norfloxacino", "400 mg", "12/12h VO", 5, "Watch", { renal: true, spectrum: ["gram-"] }),
          d("Delafloxacino", "300 mg", "12/12h EV", 7, "Reserve", { spectrum: ["gram+", "mrsa", "gram-"] }),
        ],
      },
      {
        id: "linco",
        label: "Lincosamidas",
        drugs: [
          d("Clindamicina", "600–900 mg", "8/8h EV", 7, "Access", { spectrum: ["gram+", "anaerobio"] }),
          d("Lincomicina", "600 mg", "12/12h", 7, "Watch", { spectrum: ["gram+"] }),
        ],
      },
      {
        id: "oxa",
        label: "Oxazolidinonas",
        drugs: [
          d("Linezolida", "600 mg", "12/12h", 10, "Reserve", { spectrum: ["gram+", "mrsa"] }),
          d("Tedizolida", "200 mg", "24/24h", 6, "Reserve", { spectrum: ["gram+", "mrsa"] }),
        ],
      },
      {
        id: "poli",
        label: "Polimixinas",
        drugs: [
          d("Colistina", "9 MUI ataque → 4,5 MUI", "12/12h EV", 10, "Reserve", { renal: true, spectrum: ["gram-", "pseudomonas"] }),
          d("Polimixina B", "2,5 mg/kg ataque → 1,25 mg/kg", "12/12h EV", 10, "Reserve", { spectrum: ["gram-", "pseudomonas"] }),
        ],
      },
      {
        id: "rifa",
        label: "Rifamicinas",
        drugs: [
          d("Rifampicina", "600 mg", "24/24h", 14, "Watch", { spectrum: ["gram+"] }),
          d("Rifabutina", "300 mg", "24/24h VO", 14, "Watch"),
          d("Rifapentina", "600 mg", "1×/semana VO", 84, "Watch"),
          d("Rifaximina", "550 mg", "12/12h VO", 14, "Watch"),
        ],
      },
      {
        id: "sulfa",
        label: "Sulfonamidas / antifolatos",
        drugs: [
          d("Sulfametoxazol + trimetoprima", "15–20 mg/kg/dia (TMP)", "6/6–8/8h", 14, "Access", { renal: true, spectrum: ["gram+", "gram-"] }),
          d("Sulfadiazina", "1–1,5 g", "6/6h VO", 21, "Access", { renal: true }),
          d("Sulfadoxina", "1500 mg", "dose única", 1, "Access", { spectrum: ["parasita"] }),
          d("Pirimetamina", "50–75 mg", "24/24h VO", 21, "Access", { spectrum: ["parasita"] }),
        ],
      },
      {
        id: "nitroimid",
        label: "Nitroimidazóis",
        drugs: [
          d("Metronidazol", "500 mg", "8/8h", 7, "Access", { spectrum: ["anaerobio", "parasita"] }),
          d("Tinidazol", "2 g", "24/24h VO", 3, "Access", { spectrum: ["anaerobio", "parasita"] }),
          d("Secnidazol", "2 g", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
        ],
      },
      { id: "fosfo", label: "Fosfomicina", drugs: [d("Fosfomicina", "3 g", "dose única VO / 4 g 8/8h EV", 3, "Watch", { spectrum: ["gram-"] })] },
      { id: "clora", label: "Cloranfenicóis", drugs: [d("Cloranfenicol", "12,5 mg/kg", "6/6h EV", 10, "Access", { spectrum: ["gram+", "gram-", "anaerobio"] })] },
      { id: "lipopep", label: "Lipopeptídeos", drugs: [d("Daptomicina", "6–10 mg/kg", "24/24h EV", 10, "Reserve", { renal: true, spectrum: ["gram+", "mrsa"] })] },
      {
        id: "pleuro",
        label: "Pleuromutilinas",
        drugs: [d("Lefamulina", "150 mg", "12/12h EV", 5, "Reserve", { spectrum: ["atipico", "gram+"] }), d("Retapamulina", "1% tópico", "12/12h", 5, "Access")],
      },
      {
        id: "nitrofur",
        label: "Nitrofuranos",
        drugs: [d("Nitrofurantoína", "100 mg", "6/6h VO", 5, "Access", { renal: true, spectrum: ["gram-"] }), d("Furazolidona", "100 mg", "6/6h VO", 5, "Access")],
      },
      {
        id: "outros-ab",
        label: "Outros antibacterianos",
        drugs: [
          d("Ácido fusídico", "500 mg", "8/8h", 7, "Watch", { spectrum: ["gram+"] }),
          d("Mupirocina", "2% tópico", "8/8h", 5, "Access", { spectrum: ["gram+", "mrsa"] }),
          d("Fidaxomicina", "200 mg", "12/12h VO", 10, "Watch", { spectrum: ["anaerobio"] }),
          d("Bacitracina", "tópico", "8/8h", 7, "Access"),
        ],
      },
    ],
  },
  {
    id: "antifung",
    label: "Antifúngicos",
    icon: "🍄",
    classes: [
      {
        id: "polienos",
        label: "Polienos",
        drugs: [
          d("Anfotericina B (lipossomal)", "3–5 mg/kg", "24/24h EV", 14, "Watch", { renal: true, spectrum: ["fungo"] }),
          d("Nistatina", "500.000 UI", "6/6h VO", 7, "Access", { spectrum: ["fungo"] }),
        ],
      },
      {
        id: "azois",
        label: "Azóis",
        drugs: [
          d("Fluconazol", "800 mg ataque → 400 mg", "24/24h", 14, "Watch", { renal: true, spectrum: ["fungo"] }),
          d("Itraconazol", "200 mg", "12/12h", 14, "Watch", { spectrum: ["fungo"] }),
          d("Voriconazol", "6 mg/kg 12/12h ataque → 4 mg/kg", "12/12h", 14, "Watch", { spectrum: ["fungo"] }),
          d("Posaconazol", "300 mg", "24/24h (após ataque)", 14, "Watch", { spectrum: ["fungo"] }),
          d("Isavuconazol", "200 mg", "8/8h ataque → 24/24h", 14, "Reserve", { spectrum: ["fungo"] }),
          d("Cetoconazol", "200–400 mg", "24/24h VO", 14, "Watch", { spectrum: ["fungo"] }),
        ],
      },
      {
        id: "equino",
        label: "Equinocandinas",
        drugs: [
          d("Micafungina", "100 mg", "24/24h EV", 14, "Watch", { spectrum: ["fungo"] }),
          d("Anidulafungina", "200 mg ataque → 100 mg", "24/24h EV", 14, "Watch", { spectrum: ["fungo"] }),
          d("Caspofungina", "70 mg ataque → 50 mg", "24/24h EV", 14, "Watch", { spectrum: ["fungo"] }),
          d("Rezafungina", "400 mg → 200 mg", "1×/semana EV", 14, "Reserve", { spectrum: ["fungo"] }),
        ],
      },
      { id: "alil", label: "Alilaminas", drugs: [d("Terbinafina", "250 mg", "24/24h VO", 14, "Access", { spectrum: ["fungo"] })] },
      { id: "antimetab", label: "Antimetabólitos", drugs: [d("Flucitosina", "25 mg/kg", "6/6h VO", 14, "Reserve", { renal: true, spectrum: ["fungo"] })] },
      {
        id: "outros-af",
        label: "Outros antifúngicos",
        drugs: [
          d("Griseofulvina", "500 mg", "24/24h VO", 28, "Access", { spectrum: ["fungo"] }),
          d("Ciclopirox", "tópico", "12/12h", 14, "Access"),
          d("Amorolfina", "tópico (esmalte)", "1×/semana", 30, "Access"),
        ],
      },
    ],
  },
  {
    id: "antiviral",
    label: "Antivirais",
    icon: "🧬",
    classes: [
      {
        id: "herpes",
        label: "Anti-herpesvírus",
        drugs: [
          d("Aciclovir", "10 mg/kg", "8/8h EV", 14, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Valaciclovir", "1 g", "8/8h VO", 7, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Ganciclovir", "5 mg/kg", "12/12h EV", 14, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Valganciclovir", "900 mg", "12/12h VO", 21, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Foscarnet", "60 mg/kg", "8/8h EV", 14, "Reserve", { renal: true, spectrum: ["virus"] }),
          d("Cidofovir", "5 mg/kg", "1×/semana EV", 14, "Reserve", { renal: true, spectrum: ["virus"] }),
          d("Brincidofovir", "200 mg", "1×/semana VO", 14, "Reserve", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "influenza",
        label: "Influenza",
        drugs: [
          d("Oseltamivir", "75 mg", "12/12h VO", 5, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Zanamivir", "10 mg inalatório", "12/12h", 5, "Watch", { spectrum: ["virus"] }),
          d("Peramivir", "600 mg", "dose única EV", 1, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Baloxavir", "40–80 mg", "dose única VO", 1, "Watch", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "hbv",
        label: "Hepatite B",
        drugs: [
          d("Tenofovir", "300 mg", "24/24h VO", 90, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Entecavir", "0,5 mg", "24/24h VO", 90, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Adefovir", "10 mg", "24/24h VO", 90, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Lamivudina", "100 mg", "24/24h VO", 90, "Watch", { renal: true, spectrum: ["virus"] }),
        ],
      },
      {
        id: "hcv",
        label: "Hepatite C · antivirais de ação direta",
        drugs: [
          d("Sofosbuvir", "400 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Ledipasvir", "90 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Velpatasvir", "100 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Daclatasvir", "60 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Glecaprevir", "300 mg", "24/24h VO", 56, "Watch", { spectrum: ["virus"] }),
          d("Pibrentasvir", "120 mg", "24/24h VO", 56, "Watch", { spectrum: ["virus"] }),
          d("Grazoprevir", "100 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Elbasvir", "50 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
          d("Voxilaprevir", "100 mg", "24/24h VO", 84, "Watch", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "hiv-nrti",
        label: "HIV · NRTI",
        drugs: [
          d("Tenofovir (TDF/TAF)", "300 mg / 25 mg", "24/24h VO", 365, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Emtricitabina", "200 mg", "24/24h VO", 365, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Lamivudina", "300 mg", "24/24h VO", 365, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Abacavir", "600 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Zidovudina", "300 mg", "12/12h VO", 365, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Didanosina", "400 mg", "24/24h VO", 365, "Watch", { renal: true, spectrum: ["virus"] }),
        ],
      },
      {
        id: "hiv-nnrti",
        label: "HIV · NNRTI",
        drugs: [
          d("Efavirenz", "600 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Nevirapina", "200 mg", "12/12h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Etravirina", "200 mg", "12/12h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Rilpivirina", "25 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Doravirina", "100 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "hiv-pi",
        label: "HIV · Inibidores de protease",
        drugs: [
          d("Darunavir", "800 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Atazanavir", "300 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Lopinavir", "400 mg", "12/12h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Ritonavir", "100 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Fosamprenavir", "700 mg", "12/12h VO", 365, "Watch", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "hiv-ini",
        label: "HIV · Inibidores de integrase",
        drugs: [
          d("Dolutegravir", "50 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Bictegravir", "50 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Raltegravir", "400 mg", "12/12h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Elvitegravir", "150 mg", "24/24h VO", 365, "Watch", { spectrum: ["virus"] }),
          d("Cabotegravir", "600 mg IM", "1×/2 meses", 365, "Watch", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "hiv-outros",
        label: "HIV · Outros antirretrovirais",
        drugs: [
          d("Maraviroque", "300 mg", "12/12h VO", 365, "Reserve", { spectrum: ["virus"] }),
          d("Enfuvirtida", "90 mg SC", "12/12h", 365, "Reserve", { spectrum: ["virus"] }),
          d("Fostemsavir", "600 mg", "12/12h VO", 365, "Reserve", { spectrum: ["virus"] }),
          d("Lenacapavir", "927 mg SC", "1×/6 meses", 365, "Reserve", { spectrum: ["virus"] }),
        ],
      },
      {
        id: "covid",
        label: "COVID-19",
        drugs: [
          d("Nirmatrelvir/ritonavir", "300/100 mg", "12/12h VO", 5, "Watch", { renal: true, spectrum: ["virus"] }),
          d("Remdesivir", "200 mg ataque → 100 mg", "24/24h EV", 5, "Watch", { spectrum: ["virus"] }),
          d("Molnupiravir", "800 mg", "12/12h VO", 5, "Watch", { spectrum: ["virus"] }),
        ],
      },
    ],
  },
  {
    id: "antiparas",
    label: "Antiparasitários",
    icon: "🪳",
    classes: [
      {
        id: "malaria",
        label: "Antimaláricos",
        drugs: [
          d("Cloroquina", "600 mg → 450 mg", "24/24h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Hidroxicloroquina", "400 mg", "24/24h VO", 5, "Access", { spectrum: ["parasita"] }),
          d("Primaquina", "30 mg", "24/24h VO", 14, "Access", { spectrum: ["parasita"] }),
          d("Tafenoquina", "300 mg", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Arteméter", "80 mg", "12/12h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Artesunato", "2,4 mg/kg", "0-12-24h EV", 3, "Access", { spectrum: ["parasita"] }),
          d("Mefloquina", "750 mg → 500 mg", "12/12h VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Quinina", "600 mg", "8/8h VO", 7, "Access", { spectrum: ["parasita"] }),
          d("Pirimetamina", "25 mg", "24/24h VO", 21, "Access", { spectrum: ["parasita"] }),
          d("Sulfadoxina", "1500 mg", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
        ],
      },
      {
        id: "helmintos",
        label: "Anti-helmínticos",
        drugs: [
          d("Albendazol", "400 mg", "24/24h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Mebendazol", "100 mg", "12/12h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Ivermectina", "200 µg/kg", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Praziquantel", "40–60 mg/kg", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Pamoato de pirantel", "11 mg/kg", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Niclosamida", "2 g", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Dietilcarbamazina", "6 mg/kg/dia", "8/8h VO", 12, "Access", { spectrum: ["parasita"] }),
        ],
      },
      {
        id: "protozoarios",
        label: "Antiprotozoários",
        drugs: [
          d("Metronidazol", "500–750 mg", "8/8h", 7, "Access", { spectrum: ["parasita", "anaerobio"] }),
          d("Tinidazol", "2 g", "24/24h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Secnidazol", "2 g", "dose única VO", 1, "Access", { spectrum: ["parasita"] }),
          d("Nitazoxanida", "500 mg", "12/12h VO", 3, "Access", { spectrum: ["parasita"] }),
          d("Benznidazol", "5–7 mg/kg/dia", "12/12h VO", 60, "Access", { spectrum: ["parasita"] }),
          d("Nifurtimox", "8–10 mg/kg/dia", "8/8h VO", 60, "Access", { spectrum: ["parasita"] }),
          d("Pentamidina", "4 mg/kg", "24/24h EV", 14, "Watch", { renal: true, spectrum: ["parasita"] }),
          d("Miltefosina", "50 mg", "8/8h VO", 28, "Watch", { spectrum: ["parasita"] }),
          d("Atovaquona", "750 mg", "12/12h VO", 21, "Watch", { spectrum: ["parasita"] }),
        ],
      },
    ],
  },
];

export const ALL_ANTIMICROBIALS: AntimicrobialDrug[] = ANTIMICROBIAL_LIBRARY.flatMap((g) =>
  g.classes.flatMap((c) => c.drugs),
);

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Procura no catálogo pelo nome (tolerante a acentos/sufixos). */
export function findAntimicrobial(name: string): AntimicrobialDrug | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return (
    ALL_ANTIMICROBIALS.find((x) => norm(x.name) === n) ??
    ALL_ANTIMICROBIALS.find((x) => n.includes(norm(x.name).split(" ")[0]) && norm(x.name).split(" ")[0].length > 4)
  );
}

export function awareMeta(a: AwareClass) {
  if (a === "Access") return { label: "ACCESS", className: "text-clinical-stable border-clinical-stable/40 bg-clinical-stable/10" };
  if (a === "Watch") return { label: "WATCH", className: "text-clinical-attention border-clinical-attention/40 bg-clinical-attention/10" };
  return { label: "RESERVE", className: "text-clinical-critical border-clinical-critical/40 bg-clinical-critical/10" };
}

export function classPathOf(name: string): { group: string; klass: string } | null {
  const n = norm(name);
  for (const g of ANTIMICROBIAL_LIBRARY)
    for (const c of g.classes)
      if (c.drugs.some((x) => norm(x.name) === n)) return { group: g.label, klass: c.label };
  return null;
}
