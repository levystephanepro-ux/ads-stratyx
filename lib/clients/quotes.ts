// Devis : réglages (coordonnées, catalogue de prestations, packs) et devis par client.
// Tout est stocké dans app_settings (pas de migration).
// Structure inspirée des usages du métier : mise en place sur lignes séparées, honoraires mensuels
// au forfait et/ou en % du budget publicitaire, budget pub payé directement aux régies, engagement 3 mois.
import { getSetting, setSetting } from "@/lib/agent/store";
import type { Client } from "./store";

export type Unite = "forfait" | "mois" | "jour" | "heure" | "campagne" | "page" | "annonce" | "pct_budget";
export const UNITES: Record<Unite, string> = {
  forfait: "forfait", mois: "mois", jour: "jour", heure: "heure", campagne: "campagne", page: "page", annonce: "annonce", pct_budget: "% du budget pub",
};
export const CATEGORIES = ["Audit et stratégie", "Suivi des conversions", "Création des campagnes", "Page d'atterrissage", "Pilotage mensuel", "Meta Ads", "Accompagnement"];

export interface QuoteLine {
  libelle: string; type: "unique" | "mensuel"; montant: number;
  section?: string; detail?: string; unite?: Unite; qte?: number; pu?: number; remise?: number; option?: boolean;
}
export interface CatalogItem {
  id: string; cat: string; titre: string; detail: string; unite: Unite; prix: number; qte: number; type: "unique" | "mensuel";
  quand: string; // indication pour l'IA : dans quel cas proposer cette prestation
}
export interface Offer { nom: string; lignes: QuoteLine[]; engagementMois: number; notes: string; items?: string[] }
export interface QuoteSettings {
  raisonSociale: string; adresse: string; email: string; telephone: string; siret: string;
  mentionTva: string; validiteJours: number; conditionsPaiement: string; garantie: string;
  offres: Offer[]; catalogue: CatalogItem[];
}
export interface Quote {
  numero: string; date: string; offreNom: string; lignes: QuoteLine[]; engagementMois: number;
  budgetPub: number | null; notes: string; garantie: boolean; statut: "brouillon" | "envoye" | "accepte" | "refuse";
  remiseGlobale?: number; ia?: { raisons: string[]; model: string; at: string };
}

// Catalogue de départ : prix indicatifs (freelance senior, TPE et artisans), à ajuster dans les réglages.
// Variables utilisables dans les titres et détails : voir VARIABLES.
export const DEFAULT_CATALOGUE: CatalogItem[] = [
  { id: "strategie", cat: "Audit et stratégie", titre: "Étude et plan d'acquisition", unite: "forfait", prix: 300, qte: 1, type: "unique",
    detail: "Étude des recherches et de la concurrence sur {zone}\nChoix des cibles, des campagnes et du budget\nObjectif de coût par demande et plan d'action sur 90 jours",
    quand: "Toujours pour un nouveau client." },
  { id: "audit_compte", cat: "Audit et stratégie", titre: "Audit du compte Google Ads existant", unite: "forfait", prix: 350, qte: 1, type: "unique",
    detail: "Structure, mots-clés, termes de recherche et budget gaspillé\nContrôle du suivi des conversions\nRapport écrit et corrections prioritaires",
    quand: "Le client a déjà un compte Google Ads ou a déjà fait de la publicité Google." },
  { id: "tracking", cat: "Suivi des conversions", titre: "Mise en place du suivi des conversions", unite: "forfait", prix: 450, qte: 1, type: "unique",
    detail: "Installation de Google Tag Manager et de Google Analytics 4\nSuivi des formulaires, des appels et des clics sur le numéro\nLiaison avec Google Ads, tests et recette",
    quand: "Google Tag Manager, Google Analytics ou le suivi des conversions ne sont pas en place ou pas fiables." },
  { id: "consentement", cat: "Suivi des conversions", titre: "Bannière cookies et mode consentement", unite: "forfait", prix: 150, qte: 1, type: "unique",
    detail: "Bannière de consentement conforme RGPD\nMode consentement Google v2 pour garder des mesures fiables",
    quand: "Le suivi est à installer et le site n'a pas de bannière de consentement." },
  { id: "hors_ligne", cat: "Suivi des conversions", titre: "Suivi des ventes signées dans Google Ads", unite: "forfait", prix: 350, qte: 1, type: "unique",
    detail: "Remontée des devis signés (conversions hors ligne)\nGoogle optimise sur les vrais clients, pas seulement sur les demandes",
    quand: "Cycle de vente de plusieurs semaines, panier élevé, ou client équipé d'un CRM." },
  { id: "search", cat: "Création des campagnes", titre: "Création de campagne Search", unite: "campagne", prix: 250, qte: 2, type: "unique",
    detail: "Mots-clés, mots-clés négatifs et ciblage sur {zone}\nAnnonces responsives rédigées pour {entreprise}\nLiens annexes, accroches, extension d'appel et de lieu",
    quand: "Toujours en Google Ads. Quantité = nombre de campagnes Search prévues." },
  { id: "pmax", cat: "Création des campagnes", titre: "Création de campagne Performance Max", unite: "campagne", prix: 350, qte: 1, type: "unique",
    detail: "Groupes d'assets : textes, images, vidéos\nSignaux d'audience et exclusions de marque",
    quand: "Seulement si le suivi des conversions est fiable et le budget le permet (souvent après 2 ou 3 mois)." },
  { id: "gbp", cat: "Création des campagnes", titre: "Optimisation de la fiche Google Business Profile", unite: "forfait", prix: 200, qte: 1, type: "unique",
    detail: "Catégories, services, zone desservie et photos\nLiaison avec Google Ads (extension de lieu)\nMéthode pour obtenir plus d'avis",
    quand: "Activité locale avec peu d'avis Google ou fiche incomplète." },
  { id: "landing", cat: "Page d'atterrissage", titre: "Page d'atterrissage dédiée", unite: "page", prix: 900, qte: 1, type: "unique",
    detail: "Page orientée demande de devis pour {entreprise}\nTextes, formulaire court, bouton d'appel, avis et réalisations\nPensée pour le mobile et rapide à charger",
    quand: "Pas de page dédiée, site lent, peu clair ou sans formulaire visible." },
  { id: "landing_variante", cat: "Page d'atterrissage", titre: "Variante de page pour test A/B", unite: "page", prix: 300, qte: 1, type: "unique",
    detail: "Seconde version de la page pour comparer les taux de demande",
    quand: "En option, quand une page dédiée est prévue et le volume de clics suffisant." },
  { id: "pilotage", cat: "Pilotage mensuel", titre: "Pilotage mensuel Google Ads", unite: "mois", prix: 600, qte: 1, type: "mensuel",
    detail: "Optimisation des enchères, mots-clés et annonces\nMots-clés négatifs chaque semaine\nSurveillance quotidienne automatisée et alertes",
    quand: "Toujours en Google Ads." },
  { id: "reporting", cat: "Pilotage mensuel", titre: "Rapport mensuel et point de 30 minutes", unite: "mois", prix: 100, qte: 1, type: "mensuel",
    detail: "Résultats en clair : demandes, coût par demande, actions du mois\nPoint téléphonique ou visio",
    quand: "Toujours." },
  { id: "pct_budget", cat: "Pilotage mensuel", titre: "Honoraires variables sur le budget publicitaire", unite: "pct_budget", prix: 10, qte: 1, type: "mensuel",
    detail: "Appliqués au budget publicitaire mensuel, en complément du forfait",
    quand: "Budget publicitaire supérieur à 3 000 € par mois." },
  { id: "annonces", cat: "Pilotage mensuel", titre: "Annonces ou visuels supplémentaires", unite: "annonce", prix: 40, qte: 5, type: "unique",
    detail: "Nouvelles annonces pour tester d'autres messages",
    quand: "En option." },
  { id: "meta_setup", cat: "Meta Ads", titre: "Création de campagne Meta Ads (Facebook, Instagram)", unite: "campagne", prix: 450, qte: 1, type: "unique",
    detail: "Pixel Meta et API de conversions\nAudiences sur {zone} et formulaire de contact\nMise en ligne des visuels fournis",
    quand: "Le client veut Meta, a des photos ou vidéos de réalisations, ou une offre visuelle." },
  { id: "meta_pilotage", cat: "Meta Ads", titre: "Pilotage mensuel Meta Ads", unite: "mois", prix: 400, qte: 1, type: "mensuel",
    detail: "Optimisation des audiences, des budgets et des visuels\nRenouvellement des créations",
    quand: "Si une campagne Meta est créée." },
  { id: "formation", cat: "Accompagnement", titre: "Formation au traitement des demandes", unite: "heure", prix: 80, qte: 2, type: "unique",
    detail: "Rappeler vite, qualifier, relancer\nSuivi simple des demandes et des ventes",
    quand: "Délai de rappel long, pas de suivi des demandes, ou personne dédiée au téléphone." },
  { id: "conseil", cat: "Accompagnement", titre: "Journée de conseil", unite: "jour", prix: 450, qte: 1, type: "unique",
    detail: "Atelier stratégie, formation de l'équipe ou chantier spécifique",
    quand: "Besoin ponctuel exprimé par le client." },
];

export const DEFAULT_PACKS: Offer[] = [
  { nom: "Pilote Google Ads 90 jours", engagementMois: 3, lignes: [], items: ["strategie", "tracking", "search", "pilotage", "reporting"],
    notes: "Le budget publicitaire est payé directement à Google, il n'est pas inclus dans ce devis." },
  { nom: "Lancement complet avec page dédiée", engagementMois: 3, lignes: [], items: ["strategie", "tracking", "consentement", "search", "landing", "pilotage", "reporting"],
    notes: "Le budget publicitaire est payé directement à Google, il n'est pas inclus dans ce devis." },
  { nom: "Audit et plan d'action", engagementMois: 0, lignes: [], items: ["audit_compte", "strategie"], notes: "" },
  { nom: "Google Ads et Meta Ads", engagementMois: 3, lignes: [], items: ["strategie", "tracking", "search", "meta_setup", "pilotage", "meta_pilotage", "reporting"],
    notes: "Les budgets publicitaires sont payés directement à Google et à Meta, ils ne sont pas inclus dans ce devis." },
];

export const DEFAULT_SETTINGS: QuoteSettings = {
  raisonSociale: "STRATYXMEDIA", adresse: "1, avenue des Anglais, 06400 Cannes", email: "contact@stratyxmedia.fr", telephone: "", siret: "",
  mentionTva: "TVA non applicable, art. 293 B du CGI", validiteJours: 30,
  conditionsPaiement: "Frais de mise en place payables à la signature. Honoraires mensuels payables d'avance, le 1er de chaque mois, par virement.",
  garantie: "Clause de vérité : si l'objectif de coût par demande fixé ensemble n'est pas atteint à 90 jours, le mois suivant est offert ou vous pouvez arrêter sans pénalité.",
  offres: DEFAULT_PACKS, catalogue: DEFAULT_CATALOGUE,
};

const SETTINGS_KEY = "quote_settings";
const COUNTER_KEY = "quote_counter";
const quoteKey = (clientId: string) => `quote:${clientId}`;

export async function getQuoteSettings(): Promise<QuoteSettings> {
  const v = await getSetting(SETTINGS_KEY, null);
  if (!v) return DEFAULT_SETTINGS;
  try {
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(v) as Partial<QuoteSettings>) };
    if (!Array.isArray(s.catalogue) || s.catalogue.length === 0) s.catalogue = DEFAULT_CATALOGUE;
    // Anciennes offres sans prestations du catalogue et sans prix : on passe aux packs par défaut.
    if (!s.offres?.length || s.offres.every((o) => !o.items?.length && o.lignes.every((l) => !l.montant))) s.offres = DEFAULT_PACKS;
    return s;
  } catch { return DEFAULT_SETTINGS; }
}
export async function saveQuoteSettings(s: QuoteSettings) { await setSetting(SETTINGS_KEY, JSON.stringify(s), null); }

export async function getQuote(clientId: string): Promise<Quote | null> {
  const v = await getSetting(quoteKey(clientId), null);
  if (!v) return null;
  try { return JSON.parse(v) as Quote; } catch { return null; }
}
export async function saveQuote(clientId: string, q: Quote) { await setSetting(quoteKey(clientId), JSON.stringify(q), null); }

/** Numéro DEV-AAAA-NNN, compteur global. */
export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const raw = await getSetting(COUNTER_KEY, null);
  let { y, n } = (() => { try { return raw ? JSON.parse(raw) as { y: number; n: number } : { y: year, n: 0 }; } catch { return { y: year, n: 0 }; } })();
  if (y !== year) { y = year; n = 0; }
  n += 1;
  await setSetting(COUNTER_KEY, JSON.stringify({ y, n }), null);
  return `DEV-${y}-${String(n).padStart(3, "0")}`;
}

// ---------------- Variables ----------------
export const VARIABLES: { v: string; desc: string }[] = [
  { v: "{entreprise}", desc: "nom du client" }, { v: "{contact}", desc: "nom du contact" }, { v: "{zone}", desc: "zone desservie" },
  { v: "{activite}", desc: "activité" }, { v: "{services}", desc: "services principaux" }, { v: "{objectif}", desc: "objectif de la publicité" },
  { v: "{budget}", desc: "budget pub mensuel" }, { v: "{site}", desc: "site du client" }, { v: "{nb_campagnes}", desc: "nombre de campagnes prévues" },
];

const short = (s: string, max = 90) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max).replace(/[ ,;.]+\S*$/, "") + "…" : t; };

export interface VarContext { entreprise: string; contact: string; zone: string; activite: string; services: string; objectif: string; budget: string; site: string; nb_campagnes: string }

export function varContext(c: Client, extra?: { budget?: number | null; nbCampagnes?: number | null }): VarContext {
  const a = c.answers ?? {};
  const budget = extra?.budget ?? (Number(String(a.budget ?? "").replace(/\s/g, "").replace(",", ".")) || null);
  return {
    entreprise: c.name, contact: c.contact_name ?? "", zone: short(a.zone ?? ""), activite: short(a.activite ?? ""),
    services: short((a.services ?? "").split(/\n|;/)[0] ?? ""), objectif: (a.objectif ?? "").toLowerCase(),
    budget: budget ? `${Math.round(budget).toLocaleString("fr-FR")} €` : "", site: c.website || a.site || "",
    nb_campagnes: extra?.nbCampagnes ? String(extra.nbCampagnes) : "",
  };
}

/** Remplace les variables connues ; une variable sans valeur reste visible entre crochets pour être complétée. */
export function fillVars(text: string, ctx: VarContext): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = (ctx as unknown as Record<string, string>)[k];
    if (v === undefined) return m;
    return v ? v : `[${k.replace("_", " ")}]`;
  });
}

/** Ligne de devis à partir d'une prestation du catalogue (variables remplies). */
export function lineFromCatalog(it: CatalogItem, ctx: VarContext, over?: { qte?: number; option?: boolean }): QuoteLine {
  const l: QuoteLine = {
    section: it.cat, libelle: fillVars(it.titre, ctx), detail: fillVars(it.detail, ctx), unite: it.unite,
    qte: over?.qte && over.qte > 0 ? over.qte : it.qte, pu: it.prix, remise: 0, option: !!over?.option, type: it.type, montant: 0,
  };
  return l;
}

// ---------------- Calculs ----------------
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Montant HT d'une ligne (ancien format : montant seul). */
export function lineAmount(l: QuoteLine, budgetPub: number | null): number {
  if (l.pu === undefined) return l.montant;
  if (l.unite === "pct_budget") return r2((budgetPub ?? 0) * (l.pu / 100) * (1 - (l.remise ?? 0) / 100));
  return r2((l.qte ?? 1) * l.pu * (1 - (l.remise ?? 0) / 100));
}

export function totals(q: Pick<Quote, "lignes" | "engagementMois" | "budgetPub" | "remiseGlobale">) {
  const inc = q.lignes.filter((l) => !l.option);
  const k = 1 - Math.min(100, Math.max(0, q.remiseGlobale ?? 0)) / 100;
  const brutU = inc.filter((l) => l.type === "unique").reduce((s, l) => s + lineAmount(l, q.budgetPub), 0);
  const brutM = inc.filter((l) => l.type === "mensuel").reduce((s, l) => s + lineAmount(l, q.budgetPub), 0);
  const unique = r2(brutU * k), mensuel = r2(brutM * k);
  return { brutU: r2(brutU), brutM: r2(brutM), unique, mensuel, remise: r2(brutU + brutM - unique - mensuel), engagement: r2(unique + mensuel * Math.max(0, q.engagementMois)) };
}

const numOf = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : d; };
const isUnite = (v: string): v is Unite => v in UNITES;

/** Lit les lignes d'un formulaire de devis (l0_libelle, l0_detail, l0_qte, l0_pu…). */
export function linesFromForm(form: FormData, max = 40): QuoteLine[] {
  const out: QuoteLine[] = [];
  for (let i = 0; i < max; i++) {
    const libelle = String(form.get(`l${i}_libelle`) ?? "").trim();
    if (!libelle || form.get(`l${i}_suppr`) === "on") continue;
    const u = String(form.get(`l${i}_unite`) ?? "forfait");
    const hasPu = form.get(`l${i}_pu`) !== null;
    const pu = hasPu ? numOf(form.get(`l${i}_pu`)) : undefined;
    const l: QuoteLine = {
      section: String(form.get(`l${i}_section`) ?? "").trim().slice(0, 60) || undefined,
      libelle: libelle.slice(0, 200), detail: String(form.get(`l${i}_detail`) ?? "").trim().slice(0, 1200) || undefined,
      unite: isUnite(u) ? u : "forfait", qte: numOf(form.get(`l${i}_qte`), 1) || 1, pu, remise: Math.min(100, numOf(form.get(`l${i}_remise`))),
      option: form.get(`l${i}_option`) === "on", type: form.get(`l${i}_type`) === "mensuel" ? "mensuel" : "unique",
      montant: hasPu ? 0 : numOf(form.get(`l${i}_montant`)),
    };
    out.push(l);
  }
  return out;
}

/** Fige les montants (utile pour l'affichage et les exports). */
export function withAmounts(lines: QuoteLine[], budgetPub: number | null): QuoteLine[] {
  return lines.map((l) => ({ ...l, montant: lineAmount(l, budgetPub) }));
}
