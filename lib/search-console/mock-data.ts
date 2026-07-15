export const MOCK_SITES = [
  { siteUrl: "https://www.example-menuiserie.fr/", permissionLevel: "siteOwner" },
  { siteUrl: "https://www.boulangerie-dupain.com/", permissionLevel: "siteFullUser" },
];

const QUERIES_MENUISERIE = [
  { query: "menuisier lyon",             clicks: 142, impressions: 3200, ctr: 0.044, position: 3.2 },
  { query: "menuiserie sur mesure",      clicks: 98,  impressions: 2800, ctr: 0.035, position: 5.1 },
  { query: "pose fenêtre pvc lyon",      clicks: 76,  impressions: 4100, ctr: 0.019, position: 8.4 },
  { query: "devis menuiserie",           clicks: 61,  impressions: 1900, ctr: 0.032, position: 4.7 },
  { query: "rénovation fenêtre",         clicks: 54,  impressions: 3600, ctr: 0.015, position: 11.2 },
  { query: "fenêtre double vitrage",     clicks: 47,  impressions: 5200, ctr: 0.009, position: 14.6 },
  { query: "volet roulant lyon",         clicks: 43,  impressions: 2100, ctr: 0.020, position: 7.3 },
  { query: "artisan menuisier",          clicks: 38,  impressions: 1400, ctr: 0.027, position: 6.8 },
  { query: "porte d'entrée sur mesure",  clicks: 35,  impressions: 1700, ctr: 0.021, position: 9.1 },
  { query: "menuisier rhône alpes",      clicks: 29,  impressions: 980,  ctr: 0.030, position: 5.5 },
  { query: "prix fenêtre pvc",           clicks: 22,  impressions: 6800, ctr: 0.003, position: 17.3 },
  { query: "isolation fenêtre",          clicks: 18,  impressions: 4200, ctr: 0.004, position: 15.8 },
  { query: "remplacement volet",         clicks: 15,  impressions: 890,  ctr: 0.017, position: 12.4 },
  { query: "menuiserie bois lyon",       clicks: 14,  impressions: 760,  ctr: 0.018, position: 6.2 },
  { query: "fenêtre alu sur mesure",     clicks: 11,  impressions: 2100, ctr: 0.005, position: 18.9 },
  { query: "vitrier urgence lyon",       clicks: 9,   impressions: 430,  ctr: 0.021, position: 13.1 },
  { query: "store banne terrasse",       clicks: 7,   impressions: 1200, ctr: 0.006, position: 19.4 },
  { query: "porte coulissante",          clicks: 5,   impressions: 3100, ctr: 0.002, position: 22.7 },
];

const PAGES_MENUISERIE = [
  { page: "/",                         clicks: 198, impressions: 5400, ctr: 0.037, position: 4.1 },
  { page: "/fenetre-pvc/",             clicks: 134, impressions: 7200, ctr: 0.019, position: 9.3 },
  { page: "/volets-roulants/",         clicks: 87,  impressions: 3100, ctr: 0.028, position: 6.7 },
  { page: "/contact/",                 clicks: 65,  impressions: 1200, ctr: 0.054, position: 3.8 },
  { page: "/porte-entree/",            clicks: 54,  impressions: 2800, ctr: 0.019, position: 11.2 },
  { page: "/devis-gratuit/",           clicks: 43,  impressions: 980,  ctr: 0.044, position: 5.4 },
  { page: "/blog/renovation-fenetre/", clicks: 32,  impressions: 4100, ctr: 0.008, position: 14.6 },
  { page: "/menuiserie-bois/",         clicks: 24,  impressions: 1600, ctr: 0.015, position: 8.9 },
  { page: "/isolation/",               clicks: 17,  impressions: 3200, ctr: 0.005, position: 16.3 },
  { page: "/blog/prix-fenetre-2024/",  clicks: 11,  impressions: 5700, ctr: 0.002, position: 21.4 },
];

const QUERIES_BOULANGERIE = [
  { query: "boulangerie paris 11",          clicks: 210, impressions: 2900, ctr: 0.072, position: 2.1 },
  { query: "pain au levain artisanal",      clicks: 87,  impressions: 4100, ctr: 0.021, position: 6.4 },
  { query: "boulangerie artisanale",        clicks: 74,  impressions: 5600, ctr: 0.013, position: 9.8 },
  { query: "croissant paris",               clicks: 61,  impressions: 8200, ctr: 0.007, position: 14.2 },
  { query: "commande pain en ligne",        clicks: 48,  impressions: 1800, ctr: 0.027, position: 5.7 },
  { query: "pain bio paris",                clicks: 39,  impressions: 3400, ctr: 0.011, position: 11.3 },
  { query: "viennoiserie maison",           clicks: 33,  impressions: 2700, ctr: 0.012, position: 8.1 },
  { query: "boulangerie ouverte dimanche",  clicks: 28,  impressions: 1200, ctr: 0.023, position: 4.9 },
  { query: "pain tradition",                clicks: 24,  impressions: 6100, ctr: 0.004, position: 16.7 },
  { query: "meilleure boulangerie paris",   clicks: 21,  impressions: 9400, ctr: 0.002, position: 18.3 },
  { query: "livraison pain à domicile",     clicks: 18,  impressions: 2300, ctr: 0.008, position: 12.5 },
  { query: "pain sans gluten paris",        clicks: 14,  impressions: 1700, ctr: 0.008, position: 7.4 },
  { query: "galette des rois artisanale",   clicks: 11,  impressions: 3800, ctr: 0.003, position: 19.1 },
  { query: "boulangerie réservation",       clicks: 9,   impressions: 640,  ctr: 0.014, position: 13.6 },
  { query: "pain campagne",                 clicks: 7,   impressions: 4200, ctr: 0.002, position: 20.4 },
];

const PAGES_BOULANGERIE = [
  { page: "/",                          clicks: 287, impressions: 6100, ctr: 0.047, position: 2.8 },
  { page: "/nos-pains/",                clicks: 142, impressions: 8300, ctr: 0.017, position: 8.4 },
  { page: "/viennoiseries/",            clicks: 98,  impressions: 4200, ctr: 0.023, position: 6.1 },
  { page: "/commande-en-ligne/",        clicks: 76,  impressions: 2100, ctr: 0.036, position: 4.5 },
  { page: "/nous-trouver/",             clicks: 54,  impressions: 1400, ctr: 0.039, position: 3.2 },
  { page: "/blog/pain-au-levain/",      clicks: 38,  impressions: 5600, ctr: 0.007, position: 13.9 },
  { page: "/patisseries/",              clicks: 27,  impressions: 3700, ctr: 0.007, position: 15.2 },
  { page: "/blog/croissant-maison/",    clicks: 19,  impressions: 7100, ctr: 0.003, position: 18.6 },
];

type MockEntry = { query?: string; page?: string; clicks: number; impressions: number; ctr: number; position: number };

const MOCK_DB: Record<string, { queries: MockEntry[]; pages: MockEntry[] }> = {
  "https://www.example-menuiserie.fr/": { queries: QUERIES_MENUISERIE, pages: PAGES_MENUISERIE },
  "https://www.boulangerie-dupain.com/": { queries: QUERIES_BOULANGERIE, pages: PAGES_BOULANGERIE },
};

const FALLBACK = { queries: QUERIES_MENUISERIE, pages: PAGES_MENUISERIE };

export function getMockData(siteUrl: string, dim: "query" | "page", limit: number): MockEntry[] {
  const db = MOCK_DB[siteUrl] ?? FALLBACK;
  return (dim === "page" ? db.pages : db.queries).slice(0, limit);
}
