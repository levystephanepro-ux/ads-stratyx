// Grille d'audit Google Ads de référence : critères, seuils, sévérité et type de compte.
// Inspirée des pratiques des media buyers professionnels (relevée le 13/10/2026).
// Sert au Copilote (outil get_audit_grid) pour raisonner avec des seuils de pro,
// et servira de base à l'audit automatique noté sur 100.
//
// sev : haut = très strict (bloquant), moyen = à corriger, bas = confort.
// tags : à quels comptes le critère s'applique (absent = tous).
// ia : jugement qualitatif (au plus « à vérifier », jamais « incorrect » sans validation humaine).

export type Severity = "haut" | "moyen" | "bas";
export type AccountTag = "ecommerce" | "leads" | "local";

export interface Criterion {
  label: string;
  rule: string;
  sev: Severity;
  tags?: AccountTag[];
  ia?: boolean;
}

export interface CriteriaCategory {
  key: string;
  title: string;
  intro: string;
  items: Criterion[];
}

export const AUDIT_GRID: CriteriaCategory[] = [
  {
    key: "compte", title: "Compte et réglages", intro: "Les réglages du compte qui conditionnent tout le reste.",
    items: [
      { label: "Le compte dépense", rule: "Incorrect si 0 € hier alors que la moyenne des 7 jours d'avant est positive.", sev: "haut" },
      { label: "Recommandations auto-appliquées désactivées", rule: "Incorrect si au moins un type de recommandation s'applique tout seul.", sev: "moyen" },
      { label: "Auto-tagging activé", rule: "Incorrect si désactivé.", sev: "haut" },
      { label: "Nombre de campagnes adapté au volume", rule: "Conversions par campagne sur 30 j : parfait ≥ 30, incorrect < 15, à vérifier entre les deux. Trop de campagnes pour peu de conversions = données éparpillées.", sev: "haut" },
      { label: "Répartition du budget par type de campagne", rule: "Part du budget sur Shopping et PMax : parfait ≥ 70 %, sinon à vérifier.", sev: "haut", tags: ["ecommerce"] },
      { label: "Modifications récentes", rule: "Jours depuis la dernière modification : parfait < 14, incorrect > 30.", sev: "moyen" },
      { label: "Liste de clients importée récemment", rule: "Jours depuis le dernier import : parfait < 30, incorrect > 90.", sev: "moyen", tags: ["ecommerce", "leads"] },
      { label: "Aucune campagne en « tous pays et territoires »", rule: "Incorrect si au moins une campagne sans ciblage géographique, sauf exception déclarée.", sev: "moyen" },
      { label: "Vérification annonceur, nom et logo", rule: "Incorrect si le nom ou le logo d'entreprise est absent des composants.", sev: "bas" },
      { label: "Score d'optimisation Google", rule: "Parfait ≥ 80 %, incorrect < 60 %. Indicatif : ne jamais appliquer les recommandations à l'aveugle.", sev: "bas" },
    ],
  },
  {
    key: "suivi", title: "Tracking et conversions", intro: "Ce que Google compte comme conversion, donc ce qu'il cherche à obtenir.",
    items: [
      { label: "Les conversions remontent", rule: "Incorrect si 0 conversion sur 7 j alors que les 4 semaines d'avant en avaient. Sur un petit compte (moins de 2 conversions par semaine), un creux de 7 j peut être normal : vérifier par un test avant de conclure.", sev: "haut" },
      { label: "Pas de double comptage", rule: "Incorrect si plus d'une action principale du même type (achat, lead).", sev: "haut" },
      { label: "Pas d'action de test en principale", rule: "Incorrect si « test » dans le nom d'une action principale.", sev: "haut" },
      { label: "Balise du site comme source principale", rule: "À vérifier si les conversions viennent uniquement d'un import GA4.", sev: "moyen" },
      { label: "Valeur de conversion renseignée et cohérente", rule: "Incorrect si la valeur moyenne est < 10 €.", sev: "moyen", tags: ["ecommerce"] },
      { label: "Conversions améliorées activées", rule: "Incorrect si désactivées.", sev: "moyen" },
      { label: "Consent Mode v2 en place", rule: "Incorrect si aucun signal de consentement détecté.", sev: "haut" },
      { label: "Fenêtre d'attribution après vue courte", rule: "Parfait ≤ 3 jours.", sev: "moyen", tags: ["ecommerce"] },
      { label: "Attribution basée sur les données", rule: "Incorrect si une action principale est au dernier clic.", sev: "moyen" },
      { label: "Comptage adapté à chaque action", rule: "Incorrect si « toutes » sur un lead (doit être « une ») ou « une » sur un achat.", sev: "moyen" },
      { label: "Import des conversions hors ligne", rule: "À vérifier si aucun import des ventes signées (CRM). Indispensable pour optimiser sur les vrais clients.", sev: "moyen", tags: ["leads"] },
      { label: "Règles de valeur si enchère à la valeur", rule: "À vérifier si aucune règle.", sev: "bas", tags: ["ecommerce"] },
      { label: "Suivi des appels", rule: "Incorrect si extension d'appel sans conversion d'appel.", sev: "bas", tags: ["local"] },
      { label: "Ventes croisées suivies (Merchant Center)", rule: "À vérifier manuellement.", sev: "bas", tags: ["ecommerce"] },
    ],
  },
  {
    key: "encheres", title: "Budget et enchères", intro: "Comment Google enchérit, et si le budget suit.",
    items: [
      { label: "Stratégie cohérente avec l'objectif", rule: "Incorrect si au clic ou sans valeur en e-commerce, au clic en leads (une fois assez de conversions).", sev: "haut" },
      { label: "Volume suffisant pour le Smart Bidding", rule: "Conversions par campagne sur 30 j : parfait ≥ 30, incorrect < 15. Sous ce seuil, une enchère au CPC plafonné ou « Maximiser les clics » avec plafond est souvent plus stable.", sev: "haut" },
      { label: "Une seule action de conversion pilote l'enchère", rule: "Incorrect si plusieurs objectifs mélangés dans la campagne.", sev: "haut" },
      { label: "Requête large sans Smart Bidding", rule: "Incorrect si des mots-clés en requête large sont en CPC manuel ou au clic.", sev: "haut" },
      { label: "CPA réel par rapport à la cible", rule: "Parfait ≤ 1,1 × la cible, incorrect > 1,3 × la cible (avec au moins 10 conversions).", sev: "haut", tags: ["leads"] },
      { label: "ROAS réel par rapport à la cible", rule: "Parfait ≥ 0,9 × la cible, incorrect < 0,7 × la cible (avec au moins 10 conversions).", sev: "haut", tags: ["ecommerce"] },
      { label: "Part perdue faute de budget", rule: "Sur les campagnes rentables, 30 j : parfait < 10 %, incorrect > 20 %. Si la part perdue au classement est plus forte, le problème est la qualité ou l'enchère, pas le budget.", sev: "haut" },
      { label: "CPA cible renseigné en « Maximiser les conversions »", rule: "À vérifier si aucune cible alors que le CPA cible du compte est connu.", sev: "moyen", tags: ["leads"] },
      { label: "Budget journalier suffisant", rule: "Incorrect si le budget journalier est < 3 × le CPA cible.", sev: "moyen" },
      { label: "Rythme de dépense du mois", rule: "Écart au rythme prévu : parfait ≤ 10 %, incorrect > 20 %.", sev: "moyen" },
      { label: "Pics de CPC", rule: "À vérifier si le CPC d'un jour dépasse 5 × la moyenne des 30 jours.", sev: "moyen" },
      { label: "Plafond de CPC en enchère automatique", rule: "À vérifier si aucun plafond.", sev: "bas" },
      { label: "Campagnes en apprentissage ou limitées", rule: "À vérifier si en apprentissage depuis plus de 14 jours.", sev: "bas" },
    ],
  },
  {
    key: "structure", title: "Structure du compte", intro: "L'organisation des campagnes, pour piloter chaque intention à part.",
    items: [
      { label: "Marque et générique séparés", rule: "Incorrect si aucune campagne marque alors que les recherches de marque ont coûté sur 90 j.", sev: "haut" },
      { label: "Termes de marque dans les campagnes génériques", rule: "Part du coût générique : parfait < 2 %, incorrect > 5 %.", sev: "haut" },
      { label: "Termes génériques dans la campagne marque", rule: "Incorrect si > 10 % du coût de la marque.", sev: "moyen" },
      { label: "Une campagne, un objectif", rule: "Incorrect si plusieurs objectifs de conversion dans la même campagne.", sev: "haut" },
      { label: "Groupes sans annonce active", rule: "Incorrect si au moins un groupe actif sans annonce active.", sev: "haut" },
      { label: "Groupes sans mot-clé, campagnes sans groupe", rule: "Incorrect si au moins un.", sev: "moyen" },
      { label: "Display coupé sur les campagnes Search", rule: "Incorrect si une campagne Search diffuse sur le Réseau Display.", sev: "moyen" },
      { label: "Partenaires du Réseau de Recherche rentables", rule: "Incorrect si le CPA des partenaires > 1,3 × celui de Google Search.", sev: "moyen" },
      { label: "Groupes trop larges", rule: "Incorrect si > 20 mots-clés actifs par groupe. Un groupe qui mélange plusieurs produits ou thèmes (ex. PVC, bois, alu, portes, villes) fait baisser la pertinence et le Quality Score : découper par thème.", sev: "moyen" },
      { label: "Chevauchement de termes entre campagnes", rule: "Incorrect si le même terme est servi par 2 campagnes ou groupes.", sev: "moyen" },
      { label: "Annonces dynamiques encore actives", rule: "À vérifier : migration vers AI Max à prévoir (fin des DSA annoncée pour février 2027).", sev: "moyen" },
      { label: "AI Max sans garde-fous", rule: "Incorrect si AI Max actif sans exclusion de marque ni d'URL.", sev: "haut" },
      { label: "AI Max sans Smart Bidding", rule: "Incorrect si AI Max sur une stratégie au clic.", sev: "moyen" },
      { label: "Convention de nommage respectée", rule: "À vérifier si les noms ne suivent pas la convention de l'agence.", sev: "bas" },
    ],
  },
  {
    key: "mots_cles", title: "Mots-clés et Quality Score", intro: "La qualité des mots-clés, qui fixe le prix de chaque clic.",
    items: [
      { label: "QS des mots-clés qui dépensent le plus", rule: "QS pondéré des mots-clés qui font 80 % du coût : parfait ≥ 7, incorrect < 5. Un QS bas fait payer chaque clic plus cher : comparer le CPC à l'estimation haut de page.", sev: "haut" },
      { label: "Quality Score hors marque", rule: "QS pondéré : parfait ≥ 7, incorrect < 5.", sev: "moyen" },
      { label: "CTR attendu inférieur à la moyenne", rule: "Incorrect si > 20 % des impressions concernées.", sev: "moyen" },
      { label: "Pertinence de l'annonce inférieure", rule: "Incorrect si > 20 % des impressions concernées. Cause fréquente : groupe trop large, annonces qui ne reprennent pas le mot-clé.", sev: "moyen" },
      { label: "Expérience sur la page de destination", rule: "Incorrect si > 20 % des impressions concernées.", sev: "moyen" },
      { label: "Mots-clés qui dépensent sans convertir", rule: "Incorrect si coût sans conversion > 2 × le CPA cible (30 j, au moins 30 clics). En dessous de 30 clics, trop tôt pour conclure.", sev: "haut" },
      { label: "Mots-clés trop chers", rule: "Incorrect si CPA du mot-clé > 1,5 × celui du groupe (au moins 5 conversions).", sev: "moyen" },
      { label: "Mots-clés bloqués par un négatif", rule: "Incorrect si au moins un.", sev: "haut" },
      { label: "Mots-clés refusés", rule: "Incorrect si au moins un.", sev: "haut" },
      { label: "Mots-clés en doublon", rule: "Incorrect si même texte et même correspondance dans la campagne.", sev: "moyen" },
      { label: "Syntaxe de correspondance erronée", rule: "Incorrect si au moins un mot-clé en requête large modifiée (+).", sev: "bas" },
      { label: "Mots-clés rentables qui perdent du classement", rule: "À vérifier si part perdue au classement > 50 %.", sev: "moyen" },
    ],
  },
  {
    key: "termes", title: "Termes de recherche", intro: "Ce que les gens ont vraiment tapé, et ce qui coûte sans rapporter.",
    items: [
      { label: "Liste de négatifs partagée sur chaque campagne Search", rule: "Incorrect si une campagne Search sans liste partagée.", sev: "moyen" },
      { label: "Termes qui gaspillent", rule: "Incorrect si coût d'un terme sans conversion > 1,5 × le CPA (90 j, au moins 20 clics).", sev: "haut" },
      { label: "N-grammes sans conversion", rule: "Incorrect si coût d'un n-gramme sans conversion > 2 × le CPA (90 j).", sev: "haut" },
      { label: "Termes qui convertissent sans être mots-clés", rule: "À vérifier si ≥ 2 conversions sur un terme absent des mots-clés : l'ajouter.", sev: "moyen" },
      { label: "Mots d'intention indésirable", rule: "Incorrect si un terme contient un mot de la liste interdite (gratuit, emploi, formation, occasion…).", sev: "moyen" },
      { label: "Termes hors sujet", rule: "Jugement sur l'intention des termes les plus coûteux. Attention : pour un artisan ou un service local, « devis », « prix », « tarif », « artisan », « près de moi » et les noms de villes sont des intentions d'ACHAT, pas du gaspillage.", sev: "moyen", ia: true },
      { label: "Requêtes à fort volume couvertes en exact", rule: "Part du coût en exact : parfait ≥ 70 %, sinon à vérifier.", sev: "bas" },
      { label: "N-grammes au CTR faible", rule: "À vérifier si CTR < 3 % (au moins 500 impressions).", sev: "bas" },
      { label: "Négatifs courants absents", rule: "À vérifier si gratuit, emploi, pdf… non exclus.", sev: "bas" },
      { label: "Cannibalisation entre groupes", rule: "Incorrect si même terme dans 2 groupes ou plus.", sev: "moyen" },
    ],
  },
  {
    key: "annonces", title: "Annonces et extensions", intro: "Ce que voit l'internaute avant de cliquer.",
    items: [
      { label: "Deux annonces par groupe", rule: "Parfait ≥ 2 annonces actives, incorrect < 1.", sev: "haut" },
      { label: "Force des annonces Bonne ou Excellente", rule: "Incorrect si « Médiocre », à vérifier si « Moyenne ».", sev: "moyen" },
      { label: "CTR des annonces Search hors marque", rule: "30 j, ≥ 1 000 impressions : parfait ≥ 10 %, incorrect < 5 %. Un CTR élevé avec un QS bas = le problème est la pertinence ou la page, pas l'attractivité.", sev: "moyen" },
      { label: "Titres : bonnes pratiques et biais cognitifs", rule: "Bénéfice, chiffre, preuve, appel à l'action, mot-clé repris.", sev: "haut", ia: true },
      { label: "Annonces et composants refusés ou limités", rule: "Incorrect si au moins un actif refusé ou limité. Une extension d'appel refusée coupe les appels : priorité pour un artisan.", sev: "haut" },
      { label: "Adresses cassées, redirigées ou en http", rule: "Incorrect si code 4xx, 5xx, délai dépassé ou http.", sev: "haut" },
      { label: "Extensions minimales", rule: "Liens annexes par campagne : parfait ≥ 4, incorrect < 2.", sev: "moyen" },
      { label: "Extension d'appel et de lieu", rule: "Incorrect si absente.", sev: "moyen", tags: ["local"] },
      { label: "Composants générés automatiquement", rule: "À vérifier si la création automatique est activée.", sev: "moyen" },
      { label: "Nombre de titres et descriptions", rule: "Titres par annonce : parfait ≥ 10, incorrect < 5.", sev: "moyen" },
      { label: "Épinglage excessif", rule: "À vérifier si > 3 titres épinglés.", sev: "bas" },
      { label: "Offre périmée dans les textes", rule: "Incorrect si Black Friday, soldes ou année passée dans un texte.", sev: "moyen" },
      { label: "Mentions obligatoires présentes", rule: "Incorrect si une mention de la fiche du compte est absente.", sev: "bas" },
      { label: "Fautes d'orthographe et de style", rule: "Relecture des textes.", sev: "bas", ia: true },
      { label: "Composants peu diffusés", rule: "À vérifier si un composant fait < 10 % des diffusions.", sev: "bas" },
    ],
  },
  {
    key: "pmax", title: "Performance Max", intro: "Les campagnes PMax : contrôle de la marque, des assets et des canaux.",
    items: [
      { label: "Part de la dépense sur Shopping", rule: "Part du coût PMax sur Shopping : parfait ≥ 80 %, incorrect < 50 %.", sev: "haut", tags: ["ecommerce"] },
      { label: "Répartition par canal pour les leads", rule: "À vérifier si Display et vidéo > 40 % du coût.", sev: "moyen", tags: ["leads"] },
      { label: "Exclusion de marque appliquée", rule: "Incorrect si aucune liste de marques exclue.", sev: "haut" },
      { label: "Termes de marque dans la PMax", rule: "Incorrect si > 5 % des clics PMax.", sev: "haut" },
      { label: "Expansion d'URL finale sans exclusion", rule: "Incorrect si activée sans adresse exclue.", sev: "haut" },
      { label: "Un seul objectif de conversion", rule: "Incorrect si plusieurs objectifs.", sev: "haut" },
      { label: "Stratégie cohérente", rule: "À vérifier si ni ROAS cible ni « Maximiser la valeur ».", sev: "haut", tags: ["ecommerce"] },
      { label: "Titres de la PMax", rule: "Bonnes pratiques et biais cognitifs sur titres, descriptions, visuels et vidéos.", sev: "moyen", ia: true },
      { label: "Signal d'audience sur chaque groupe d'assets", rule: "Incorrect si un groupe d'assets sans signal.", sev: "moyen" },
      { label: "Assets en nombre suffisant", rule: "Incorrect si sous le minimum de Google (titres, images, logo).", sev: "moyen" },
      { label: "Vidéo ajoutée", rule: "À vérifier si aucune vidéo (Google en génère une).", sev: "bas" },
      { label: "Assets générés automatiquement coupés", rule: "À vérifier si retouches d'image ou de texte actives.", sev: "moyen" },
      { label: "Négatifs au niveau de la campagne", rule: "À vérifier si aucun négatif.", sev: "moyen" },
      { label: "Groupe d'assets qui dépense sans convertir", rule: "Incorrect si coût sans conversion > 2 × le CPA.", sev: "haut" },
      { label: "Pages de destination PMax sous-performantes", rule: "À vérifier si taux de conversion de la page < 0,5 × celui de la campagne (≥ 100 clics).", sev: "moyen" },
      { label: "Groupes d'assets en flux seul", rule: "À vérifier manuellement.", sev: "moyen", tags: ["ecommerce"] },
      { label: "Case « acquisition de nouveaux clients »", rule: "À vérifier si cochée.", sev: "bas", tags: ["ecommerce"] },
      { label: "Cannibalisation entre PMax et Search", rule: "À vérifier si les mêmes recherches passent par la PMax et par le Search.", sev: "moyen" },
    ],
  },
  {
    key: "shopping", title: "Shopping et flux", intro: "Les produits qui dépensent, ceux qui rapportent, et la qualité du flux.",
    items: [
      { label: "Dépense sur produits sans conversion", rule: "Part du coût Shopping : parfait < 15 %, incorrect > 30 %.", sev: "haut", tags: ["ecommerce"] },
      { label: "Part du budget sur produits rentables", rule: "Part du coût sur ROAS au-dessus de la cible : parfait ≥ 50 %.", sev: "haut", tags: ["ecommerce"] },
      { label: "Produits refusés ou en erreur", rule: "Incorrect si > 5 % des produits.", sev: "haut", tags: ["ecommerce"] },
      { label: "Qualité du flux (titre, description, prix, GTIN)", rule: "Incorrect si > 10 % des produits sans GTIN ou au titre court.", sev: "moyen", tags: ["ecommerce"] },
      { label: "Produits rentables qui manquent de visibilité", rule: "À vérifier si ROAS > 1,2 × la cible et part d'impressions < 50 %.", sev: "moyen", tags: ["ecommerce"] },
      { label: "Budget sur les produits les plus vendus du site", rule: "À vérifier manuellement.", sev: "haut", tags: ["ecommerce"] },
      { label: "Best-sellers segmentés", rule: "Meilleures ventes dans une campagne à part.", sev: "haut", tags: ["ecommerce"] },
    ],
  },
  {
    key: "display", title: "Display, vidéo et Demand Gen", intro: "Les emplacements, les exclusions et la fréquence.",
    items: [
      { label: "Applis et jeux mobiles exclus", rule: "Incorrect si catégories non exclues.", sev: "moyen" },
      { label: "Contenus sensibles exclus", rule: "Incorrect si non exclus.", sev: "moyen" },
      { label: "Emplacements sans conversion", rule: "Incorrect si un emplacement > 50 € sans conversion (≥ 20 clics).", sev: "moyen" },
      { label: "Canaux Demand Gen contrôlés", rule: "À vérifier si tous les canaux ouverts sans test.", sev: "bas" },
      { label: "Vidéos présentes en Demand Gen", rule: "À vérifier si aucune vidéo.", sev: "bas" },
      { label: "Plafond de fréquence", rule: "À vérifier si aucun plafond sur le Display ou la vidéo.", sev: "bas" },
    ],
  },
  {
    key: "pages", title: "Pages de destination", intro: "Les pages qui répondent, chargent vite et convertissent.",
    items: [
      { label: "Pages qui répondent", rule: "Incorrect si code 4xx, 5xx ou délai dépassé.", sev: "haut" },
      { label: "Vitesse mobile", rule: "Score PageSpeed mobile : parfait ≥ 50, incorrect < 30.", sev: "moyen" },
      { label: "Pages qui dépensent sans convertir", rule: "Incorrect si coût sans conversion > 2 × le CPA (90 j).", sev: "haut" },
      { label: "Pages au taux de conversion faible", rule: "À vérifier si < 0,5 × la moyenne (≥ 200 clics).", sev: "moyen" },
      { label: "Pages adaptées à l'intention", rule: "À vérifier si > 70 % des groupes envoient vers la même page.", sev: "bas" },
      { label: "Cohérence entre l'annonce et la page", rule: "La promesse de l'annonce est-elle présente sur la page ?", sev: "moyen", ia: true },
    ],
  },
  {
    key: "ciblage", title: "Ciblage et audiences", intro: "Où et à qui les annonces sont montrées.",
    items: [
      { label: "Zones en « présence » uniquement", rule: "Incorrect si « présence ou intérêt ».", sev: "bas" },
      { label: "Audiences Search en ciblage par erreur", rule: "Incorrect si une audience en mode ciblage restreint une campagne Search (doit être en observation).", sev: "haut" },
      { label: "Audiences en observation", rule: "Parfait ≥ 5 audiences, sinon à vérifier.", sev: "moyen" },
      { label: "Clients exclus des campagnes d'acquisition", rule: "À vérifier si aucune exclusion de clients ni de remarketing.", sev: "moyen" },
      { label: "Segments qui gaspillent (appareil, zone, âge)", rule: "Incorrect si coût sans conversion > 2 × le CPA.", sev: "moyen" },
      { label: "Langues cohérentes avec les annonces", rule: "À vérifier si la langue ciblée diffère de celle des annonces.", sev: "bas" },
      { label: "18-24 ans sur une offre B2B", rule: "À vérifier si > 10 % du coût.", sev: "bas", tags: ["leads"] },
      { label: "Calendrier de diffusion", rule: "Horaires adaptés aux heures où l'entreprise répond.", sev: "bas", tags: ["leads"] },
    ],
  },
  {
    key: "tendances", title: "Tendances", intro: "Les 30 derniers jours face aux 30 jours d'avant.",
    items: [
      { label: "Chute des conversions", rule: "Incorrect si écart ≤ -30 % (au moins 20 conversions).", sev: "haut" },
      { label: "Hausse du coût par conversion", rule: "Incorrect si écart ≥ +30 % (au moins 10 conversions).", sev: "haut" },
      { label: "Hausse du CPC", rule: "À vérifier si ≥ +30 %.", sev: "moyen" },
      { label: "Baisse du CTR", rule: "À vérifier si ≤ -30 % (≥ 1 000 impressions).", sev: "moyen" },
      { label: "Baisse de la part d'impressions", rule: "À vérifier si ≤ -10 points.", sev: "moyen" },
      { label: "Nouveaux concurrents dans les enchères", rule: "À vérifier manuellement (absent de l'API).", sev: "bas" },
    ],
  },
];

const SEV: Record<Severity, string> = { haut: "HAUT", moyen: "moyen", bas: "bas" };

/** Texte compact de la grille (une ligne par critère), filtrable par catégorie et type de compte. */
export function auditGridText(categories?: string[], tag?: AccountTag): string {
  const cats = AUDIT_GRID.filter((c) => !categories?.length || categories.includes(c.key));
  return cats.map((c) => {
    // Un compte local (artisan) génère aussi des leads : il garde les critères « leads ».
    const ok = tag === "local" ? ["local", "leads"] : tag ? [tag] : null;
    const items = c.items.filter((i) => !ok || !i.tags || i.tags.some((t) => ok.includes(t)));
    return `## ${c.title} (${c.key})\n` + items.map((i) =>
      `- [${SEV[i.sev]}]${i.tags ? ` (${i.tags.join(", ")})` : ""}${i.ia ? " (jugement)" : ""} ${i.label} : ${i.rule}`).join("\n");
  }).join("\n\n");
}
