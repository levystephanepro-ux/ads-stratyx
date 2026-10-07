// Devis : réglages (coordonnées, catalogue de prestations, packs) et devis par client.
// Tout est stocké dans app_settings (pas de migration).
// Structure inspirée des usages du métier : mise en place sur lignes séparées, honoraires mensuels
// au forfait et/ou en % du budget publicitaire, budget pub payé directement aux régies, engagement 3 mois.
import { getSetting, setSetting } from "@/lib/agent/store";
import type { Client } from "./store";

export type Unite = "forfait" | "mois" | "jour" | "heure" | "campagne" | "page" | "visuel" | "video" | "annonce" | "pct_budget";
export const UNITES: Record<Unite, string> = {
  forfait: "forfait", mois: "mois", jour: "jour", heure: "heure", campagne: "campagne", page: "page",
  visuel: "visuel", video: "vidéo", annonce: "annonce", pct_budget: "% du budget pub",
};
export const CATEGORIES = [
  "Audit et stratégie", "Tracking et données", "Google Ads", "Meta Ads", "Autres réseaux", "Créatives",
  "Landing page", "Pilotage et reporting", "Automatisation et CRM", "Accompagnement",
];

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
  offres: Offer[]; catalogue: CatalogItem[]; catalogueVersion?: number;
}
export interface Quote {
  numero: string; date: string; offreNom: string; lignes: QuoteLine[]; engagementMois: number;
  budgetPub: number | null; notes: string; garantie: boolean; statut: "brouillon" | "envoye" | "accepte" | "refuse";
  remiseGlobale?: number; ia?: { raisons: string[]; model: string; at: string };
}

// Catalogue de départ, multi-canal : prix indicatifs (freelance senior, TPE et PME), à ajuster dans les réglages.
// Variables utilisables dans les titres et détails : voir VARIABLES.
const I = (id: string, cat: string, titre: string, unite: Unite, prix: number, qte: number, type: "unique" | "mensuel", detail: string, quand: string): CatalogItem =>
  ({ id, cat, titre, unite, prix, qte, type, detail, quand });

export const DEFAULT_CATALOGUE: CatalogItem[] = [
  // Audit et stratégie
  I("strategie", "Audit et stratégie", "Étude et plan média", "forfait", 300, 1, "unique",
    "Analyse de l'offre, des cibles et de la concurrence sur {zone}\nChoix des canaux (Google, Meta, autres) et répartition du budget\nObjectifs de coût par demande et plan d'action sur 90 jours",
    "Toujours pour un nouveau client."),
  I("audit_compte", "Audit et stratégie", "Audit des comptes publicitaires existants", "forfait", 350, 1, "unique",
    "Google Ads et Meta Ads : structure, ciblages, budget gaspillé\nContrôle du suivi des conversions\nRapport écrit et corrections prioritaires",
    "Le client a déjà fait de la publicité (Google, Meta) ou a un compte existant."),
  I("audit_cro", "Audit et stratégie", "Audit de conversion du site", "forfait", 300, 1, "unique",
    "Parcours, formulaires, vitesse, preuves de confiance\nCorrections classées par impact",
    "Le site existant sert de page de destination et convertit mal ou n'a pas été audité."),
  I("persona", "Audit et stratégie", "Personas et messages clés", "forfait", 250, 1, "unique",
    "2 à 3 profils de clients idéaux\nAngles de message, bénéfices et objections par profil",
    "Cible floue, plusieurs cibles, ou besoin de nouveaux angles créatifs."),
  // Tracking et données
  I("tracking", "Tracking et données", "Mise en place du suivi des conversions", "forfait", 450, 1, "unique",
    "Installation de Google Tag Manager et de Google Analytics 4\nSuivi des formulaires, des appels et des clics sur le numéro\nLiaison avec Google Ads, tests et recette",
    "Tag Manager, Analytics ou le suivi des conversions ne sont pas en place ou pas fiables."),
  I("meta_capi", "Tracking et données", "Pixel Meta et API de conversions", "forfait", 300, 1, "unique",
    "Installation du pixel et des événements clés\nAPI de conversions pour fiabiliser la mesure\nVérification du domaine et des événements",
    "Une campagne Meta est prévue et le pixel n'est pas installé ou pas fiable."),
  I("consentement", "Tracking et données", "Bannière cookies et mode consentement", "forfait", 150, 1, "unique",
    "Bannière de consentement conforme RGPD\nMode consentement Google v2 pour garder des mesures fiables",
    "Le suivi est à installer et le site n'a pas de bannière de consentement."),
  I("hors_ligne", "Tracking et données", "Remontée des ventes signées dans les régies", "forfait", 350, 1, "unique",
    "Import des devis signés dans Google Ads et Meta\nLes algorithmes optimisent sur les vrais clients, pas seulement sur les demandes",
    "Cycle de vente de plusieurs semaines, panier élevé, ou client équipé d'un CRM."),
  I("dashboard", "Tracking et données", "Tableau de bord en ligne", "forfait", 300, 1, "unique",
    "Google Ads, Meta et Analytics réunis dans un tableau Looker Studio\nAccès en ligne pour suivre les résultats à tout moment",
    "Plusieurs canaux pilotés, ou client qui veut suivre ses chiffres en direct."),
  // Google Ads
  I("search", "Google Ads", "Création de campagne Search", "campagne", 250, 2, "unique",
    "Mots-clés, mots-clés négatifs et ciblage sur {zone}\nAnnonces responsives rédigées pour {entreprise}\nLiens annexes, accroches, extension d'appel et de lieu",
    "Demande existante sur Google (les clients cherchent le service). Quantité = nombre de campagnes Search."),
  I("pmax", "Google Ads", "Création de campagne Performance Max", "campagne", 350, 1, "unique",
    "Groupes d'assets : textes, images, vidéos\nSignaux d'audience et exclusions de marque",
    "Suivi des conversions fiable et budget suffisant, souvent après 2 ou 3 mois."),
  I("display_youtube", "Google Ads", "Création de campagne Display ou YouTube", "campagne", 300, 1, "unique",
    "Ciblage par audiences et reciblage des visiteurs\nMise en ligne des visuels et vidéos",
    "Besoin de notoriété locale ou de reciblage, avec des visuels ou vidéos disponibles."),
  I("shopping", "Google Ads", "Campagne Shopping et flux produits", "campagne", 400, 1, "unique",
    "Configuration de Merchant Center et du flux produits\nCampagne Shopping ou Performance Max dédiée",
    "Site e-commerce avec catalogue produits."),
  I("gbp", "Google Ads", "Optimisation de la fiche Google Business Profile", "forfait", 200, 1, "unique",
    "Catégories, services, zone desservie et photos\nLiaison avec Google Ads (extension de lieu)\nMéthode pour obtenir plus d'avis",
    "Activité locale avec peu d'avis Google ou fiche incomplète."),
  // Meta Ads
  I("meta_setup", "Meta Ads", "Création de campagne Meta Ads (Facebook, Instagram)", "campagne", 450, 1, "unique",
    "Audiences sur {zone}, centres d'intérêt et audiences similaires\nFormulaire instantané ou envoi vers la page\nMise en ligne et tests de plusieurs créations",
    "Offre visuelle, besoin à susciter (pas seulement recherché sur Google), ou client qui veut Meta."),
  I("meta_retargeting", "Meta Ads", "Campagne de reciblage Meta", "campagne", 200, 1, "unique",
    "Relance des visiteurs du site et des personnes ayant interagi\nMessages de preuve : avis, réalisations, garanties",
    "Trafic suffisant sur le site (Google ou Meta) et cycle de décision de plusieurs jours."),
  // Autres réseaux
  I("linkedin_setup", "Autres réseaux", "Création de campagne LinkedIn Ads", "campagne", 500, 1, "unique",
    "Ciblage par fonction, secteur et taille d'entreprise\nFormulaires LinkedIn ou envoi vers la page",
    "Cible B2B (entreprises, décideurs)."),
  I("tiktok_setup", "Autres réseaux", "Création de campagne TikTok Ads", "campagne", 450, 1, "unique",
    "Ciblage par âge, intérêts et zone\nMise en ligne des vidéos au format vertical",
    "Cible de moins de 40 ans et produit ou service qui se montre en vidéo."),
  I("microsoft", "Autres réseaux", "Duplication sur Microsoft Ads (Bing)", "campagne", 150, 1, "unique",
    "Import et adaptation des campagnes Search existantes\nAudience complémentaire, souvent moins chère",
    "Les campagnes Search Google fonctionnent ; cible plutôt âgée ou B2B."),
  // Créatives
  I("redaction", "Créatives", "Rédaction des annonces et angles de message", "forfait", 150, 1, "unique",
    "Titres, descriptions et textes principaux par canal\n3 angles de message à tester pour {entreprise}",
    "Toujours, sauf si le client fournit ses textes."),
  I("visuels", "Créatives", "Visuels publicitaires (images et carrousels)", "visuel", 60, 6, "unique",
    "Conception aux formats des réseaux : carré, vertical, story\nAccroche et appel à l'action sur chaque visuel\nDéclinaisons pour les tests",
    "Toute campagne Meta, Display, Performance Max, LinkedIn ou TikTok."),
  I("videos", "Créatives", "Vidéos courtes publicitaires", "video", 150, 3, "unique",
    "Montage à partir de vos vidéos ou photos de réalisations\nSous-titres, formats Reels, Stories, TikTok et YouTube Shorts",
    "Campagnes Meta, TikTok ou YouTube, et client qui a des rushs ou photos."),
  I("brief_tournage", "Créatives", "Brief de tournage au smartphone", "forfait", 120, 1, "unique",
    "Liste des plans et photos à réaliser sur vos chantiers ou en boutique\nConseils de cadrage et de son",
    "Pas assez de photos ou vidéos exploitables."),
  I("creas_renouvellement", "Créatives", "Renouvellement mensuel des créations", "visuel", 50, 4, "mensuel",
    "Nouveaux visuels ou vidéos chaque mois pour éviter l'usure des publicités",
    "Campagnes Meta ou TikTok pilotées dans la durée."),
  // Landing page
  I("landing", "Landing page", "Landing page dédiée", "page", 900, 1, "unique",
    "Page orientée demande pour {entreprise} : textes, formulaire court, bouton d'appel\nAvis, réalisations et garanties mis en avant\nPensée pour le mobile et rapide à charger",
    "Pas de page dédiée, site lent, peu clair ou sans formulaire visible."),
  I("landing_variante", "Landing page", "Variante de page pour test A/B", "page", 300, 1, "unique",
    "Seconde version de la page pour comparer les taux de demande",
    "En option, quand une landing page est prévue et le volume de clics suffisant."),
  I("landing_optim", "Landing page", "Optimisation d'une page existante", "page", 450, 1, "unique",
    "Réécriture des titres et des appels à l'action\nFormulaire simplifié, preuves de confiance, vitesse",
    "Le site existant est correct mais convertit mal ; alternative moins chère à une nouvelle page."),
  I("formulaire", "Landing page", "Formulaire de qualification en plusieurs étapes", "forfait", 200, 1, "unique",
    "Questions courtes pour trier les demandes (projet, budget, délai, zone)\nMoins de demandes inutiles, meilleures demandes",
    "Beaucoup de demandes hors cible ou non qualifiées."),
  I("hebergement", "Landing page", "Hébergement et maintenance de la landing page", "mois", 25, 1, "mensuel",
    "Hébergement, nom de domaine ou sous-domaine, sauvegardes et petites modifications",
    "Quand une landing page est créée par STRATYXMEDIA."),
  // Pilotage et reporting
  I("pilotage", "Pilotage et reporting", "Pilotage mensuel Google Ads", "mois", 600, 1, "mensuel",
    "Optimisation des enchères, mots-clés et annonces\nMots-clés négatifs chaque semaine\nSurveillance quotidienne automatisée et alertes",
    "Si des campagnes Google Ads sont créées."),
  I("meta_pilotage", "Pilotage et reporting", "Pilotage mensuel Meta Ads", "mois", 400, 1, "mensuel",
    "Optimisation des audiences, des budgets et des créations\nTests de nouveaux angles chaque mois",
    "Si une campagne Meta est créée."),
  I("social_pilotage", "Pilotage et reporting", "Pilotage mensuel LinkedIn ou TikTok Ads", "mois", 350, 1, "mensuel",
    "Optimisation des ciblages, budgets et créations",
    "Si une campagne LinkedIn ou TikTok est créée."),
  I("pct_budget", "Pilotage et reporting", "Honoraires variables sur le budget publicitaire", "pct_budget", 10, 1, "mensuel",
    "Appliqués au budget publicitaire mensuel total, en complément du forfait",
    "Budget publicitaire total supérieur à 3 000 € par mois."),
  I("reporting", "Pilotage et reporting", "Rapport mensuel et point de 30 minutes", "mois", 100, 1, "mensuel",
    "Résultats en clair, tous canaux : demandes, coût par demande, actions du mois\nPoint téléphonique ou visio",
    "Toujours."),
  // Automatisation et CRM
  I("crm_leads", "Automatisation et CRM", "Centralisation des demandes", "forfait", 300, 1, "unique",
    "Demandes Google, Meta et site réunies dans un tableau ou un CRM\nNotification immédiate par email ou SMS",
    "Demandes dispersées, suivi papier ou absent, ou plusieurs canaux."),
  I("relance_auto", "Automatisation et CRM", "Réponse et relance automatiques", "forfait", 250, 1, "unique",
    "SMS ou email envoyé dès la demande\nRelance automatique des devis sans réponse",
    "Délai de rappel long ou personne pour répondre en journée."),
  // Accompagnement
  I("formation", "Accompagnement", "Formation au traitement des demandes", "heure", 80, 2, "unique",
    "Rappeler vite, qualifier, relancer\nSuivi simple des demandes et des ventes",
    "Délai de rappel long, pas de suivi des demandes, ou personne dédiée au téléphone."),
  I("conseil", "Accompagnement", "Journée de conseil", "jour", 450, 1, "unique",
    "Atelier stratégie, formation de l'équipe ou chantier spécifique",
    "Besoin ponctuel exprimé par le client."),
];

const NOTE_GOOGLE = "Le budget publicitaire est payé directement à Google, il n'est pas inclus dans ce devis.";
const NOTE_MULTI = "Les budgets publicitaires sont payés directement aux régies (Google, Meta, etc.), ils ne sont pas inclus dans ce devis.";
export const DEFAULT_PACKS: Offer[] = [
  { nom: "Pilote Google Ads 90 jours", engagementMois: 3, lignes: [], notes: NOTE_GOOGLE,
    items: ["strategie", "tracking", "search", "redaction", "pilotage", "reporting"] },
  { nom: "Lancement complet avec landing page", engagementMois: 3, lignes: [], notes: NOTE_GOOGLE,
    items: ["strategie", "tracking", "consentement", "search", "redaction", "landing", "hebergement", "pilotage", "reporting"] },
  { nom: "Meta Ads et créatives", engagementMois: 3, lignes: [], notes: NOTE_MULTI,
    items: ["strategie", "meta_capi", "meta_setup", "meta_retargeting", "redaction", "visuels", "videos", "meta_pilotage", "creas_renouvellement", "reporting"] },
  { nom: "Paid media complet (Google, Meta, créatives, landing)", engagementMois: 3, lignes: [], notes: NOTE_MULTI,
    items: ["strategie", "tracking", "meta_capi", "consentement", "search", "meta_setup", "redaction", "visuels", "landing", "hebergement", "pilotage", "meta_pilotage", "reporting", "dashboard"] },
  { nom: "Audit et plan d'action", engagementMois: 0, lignes: [], notes: "", items: ["audit_compte", "audit_cro", "strategie"] },
];

export const DEFAULT_SETTINGS: QuoteSettings = {
  raisonSociale: "STRATYXMEDIA", adresse: "1, avenue des Anglais, 06400 Cannes", email: "contact@stratyxmedia.fr", telephone: "", siret: "",
  mentionTva: "TVA non applicable, art. 293 B du CGI", validiteJours: 30,
  conditionsPaiement: "Frais de mise en place payables à la signature. Honoraires mensuels payables d'avance, le 1er de chaque mois, par virement.",
  garantie: "Clause de vérité : si l'objectif de coût par demande fixé ensemble n'est pas atteint à 90 jours, le mois suivant est offert ou vous pouvez arrêter sans pénalité.",
  offres: DEFAULT_PACKS, catalogue: DEFAULT_CATALOGUE, catalogueVersion: 2,
};
export const CATALOGUE_VERSION = 2;

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
    // Catalogue enregistré avec une ancienne version : on ajoute les nouvelles prestations et packs, sans toucher aux tiens.
    if ((s.catalogueVersion ?? 1) < CATALOGUE_VERSION) {
      const have = new Set(s.catalogue.map((x) => x.id));
      s.catalogue = [...s.catalogue.filter((x) => x.id !== "annonces"), ...DEFAULT_CATALOGUE.filter((x) => !have.has(x.id))];
      const names = new Set(s.offres.map((o) => o.nom));
      s.offres = [...s.offres, ...DEFAULT_PACKS.filter((o) => !names.has(o.nom))];
      s.catalogueVersion = CATALOGUE_VERSION;
    }
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
