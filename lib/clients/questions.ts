// Questionnaire de découverte client (paid media et croissance), tout en français.
// Il sert à deux usages : rempli par toi pendant l'appel (fiche client), ou envoyé au client
// par lien (version complète ou courte). La section interne n'est jamais visible du client.
export interface Question {
  key: string; label: string; help?: string; type: "text" | "long" | "number" | "choice" | "multi"; choices?: string[];
  /** fait partie de la version courte */
  core?: boolean;
}
export interface QSection { title: string; intro?: string; internal?: boolean; questions: Question[] }

export const QUESTIONNAIRE: QSection[] = [
  { title: "Votre entreprise", questions: [
    { key: "activite", core: true, label: "Que faites-vous exactement ?", help: "En 2 ou 3 phrases, comme si vous parliez à un nouveau client.", type: "long" },
    { key: "services", core: true, label: "Vos produits ou services, du plus rentable au moins rentable", type: "long" },
    { key: "zone", core: true, label: "Zone géographique desservie", help: "Villes, départements, rayon autour de l'entreprise, zones à exclure.", type: "text" },
    { key: "differences", core: true, label: "Ce qui vous différencie de vos concurrents", help: "Garanties, délais, certifications, prix, expérience, savoir-faire.", type: "long" },
    { key: "reputation", label: "Votre réputation en ligne", help: "Note et nombre d'avis Google, autres plateformes, réalisations à montrer.", type: "text" },
    { key: "concurrents", label: "Vos principaux concurrents", help: "Noms ou sites web, et ce que vous pensez mieux faire ou moins bien faire qu'eux.", type: "long" },
  ] },
  { title: "Vos clients", questions: [
    { key: "cible", core: true, label: "Qui sont vos meilleurs clients ?", help: "Âge, situation, type d'entreprise, besoin, ce qui les décide.", type: "long" },
    { key: "declencheur", label: "Qu'est-ce qui pousse un client à vous contacter maintenant ?", help: "Urgence, panne, projet, aide financière, recommandation, saison.", type: "long" },
    { key: "recherche", label: "Que tapent-ils sur Google selon vous ?", help: "Les mots ou questions qu'ils utilisent, même approximatifs.", type: "long" },
    { key: "objections", label: "Quelles objections entendez-vous le plus ?", help: "Prix, délai, confiance, comparaison avec un concurrent.", type: "long" },
    { key: "refus", core: true, label: "Quels clients ou demandes ne voulez-vous pas ?", help: "Exemples : petits travaux, hors zone, particuliers, SAV, curieux.", type: "long" },
  ] },
  { title: "Vos chiffres et vos objectifs", intro: "Ces chiffres permettent de calculer ce qu'une demande vaut pour vous, donc combien on peut investir pour l'obtenir.", questions: [
    { key: "objectif", core: true, label: "Objectif principal de la publicité", type: "choice", choices: ["Recevoir des demandes de devis ou des appels", "Vendre en ligne", "Remplir un agenda de rendez-vous", "Faire connaître la marque", "Autre"] },
    { key: "objectif90", label: "Quel résultat vous ferait dire dans 90 jours que ça marche ?", help: "Un chiffre : nombre de demandes, de ventes, de rendez-vous.", type: "text" },
    { key: "valeur_lead", core: true, label: "Valeur moyenne d'un client signé (€)", help: "Panier moyen ou chiffre d'affaires moyen par chantier ou vente.", type: "number" },
    { key: "marge", label: "Marge moyenne sur cette vente (%)", help: "Une estimation suffit.", type: "number" },
    { key: "recurrence", label: "Un client achète-t-il une seule fois ou revient-il ?", type: "choice", choices: ["Achat unique", "Revient de temps en temps", "Contrat ou abonnement récurrent", "Il recommande beaucoup"] },
    { key: "closing", core: true, label: "Sur 10 demandes reçues, combien deviennent clientes ?", type: "number" },
    { key: "delai_vente", label: "Délai moyen entre la première demande et la signature", type: "choice", choices: ["Le jour même", "Moins d'une semaine", "1 à 4 semaines", "Plus d'un mois"] },
    { key: "cpl_cible", label: "Coût maximum acceptable par demande (€)", type: "number" },
    { key: "budget", core: true, label: "Budget publicitaire mensuel envisagé (€)", type: "number" },
    { key: "capacite", label: "Combien de demandes pouvez-vous traiter par mois ?", type: "number" },
    { key: "saison", label: "Périodes fortes et périodes creuses", type: "text" },
  ] },
  { title: "Le traitement des demandes", intro: "Une publicité efficace perd son intérêt si la demande n'est pas rappelée vite.", questions: [
    { key: "delai_rappel", label: "Sous quel délai rappelez-vous une demande ?", type: "choice", choices: ["Moins de 15 minutes", "Dans l'heure", "Dans la journée", "Plus d'un jour"] },
    { key: "qui_repond", label: "Qui répond au téléphone et aux formulaires ?", help: "Vous, un commercial, une assistante, un répondeur. Horaires d'ouverture.", type: "text" },
    { key: "bonne_demande", label: "Qu'est-ce qu'une bonne demande ? Et une mauvaise ?", type: "long" },
    { key: "suivi", label: "Comment suivez-vous vos demandes et vos ventes ?", help: "CRM, tableur, papier, rien. Savez-vous d'où vient chaque client ?", type: "long" },
  ] },
  { title: "Ce qui existe déjà", questions: [
    { key: "site", core: true, label: "Adresse de votre site ou page de vente", type: "text" },
    { key: "deja_teste", core: true, label: "Ce que vous avez déjà essayé en publicité", help: "Google, Meta, agences, ce qui a marché ou non, et pourquoi selon vous.", type: "long" },
    { key: "canaux", label: "D'où viennent vos clients aujourd'hui ?", type: "multi", choices: ["Bouche à oreille", "Référencement naturel Google", "Google Ads", "Facebook ou Instagram", "Fiche Google Business", "Apporteurs d'affaires", "Salons ou événements", "Prospection directe", "Autre"] },
    { key: "outils", label: "Ce qui est déjà en place", type: "multi", choices: ["Compte Google Ads", "Google Analytics", "Google Tag Manager", "Search Console", "Fiche Google Business", "Pixel Meta", "CRM", "Suivi des appels", "Aucun"] },
    { key: "acces", label: "Qui gère ces accès (site, comptes) ?", help: "Vous, un prestataire, votre développeur. Pour pouvoir demander les accès.", type: "text" },
    { key: "contenus", label: "Contenus disponibles", type: "multi", choices: ["Photos de réalisations", "Vidéos", "Avis clients", "Logo et charte", "Certifications", "Aucun pour l'instant"] },
    { key: "contraintes", label: "Mots, promesses ou sujets à éviter dans les annonces", help: "Réglementation de votre métier, mentions obligatoires, engagements que vous ne tenez pas.", type: "long" },
    { key: "autre", label: "Autre chose à nous dire", type: "long" },
  ] },
  { title: "Notes internes (jamais visibles du client)", internal: true, questions: [
    { key: "fit", label: "Compatibilité avec ton offre", type: "choice", choices: ["Très bonne", "Correcte", "À risque", "À refuser"] },
    { key: "budget_realiste", label: "Budget réaliste par rapport à l'objectif", type: "choice", choices: ["Cohérent", "Un peu juste", "Trop faible", "Pas encore clair"] },
    { key: "decideur", label: "Qui décide et qui paie", type: "text" },
    { key: "risques", label: "Points de vigilance", help: "Attentes irréalistes, suivi des demandes faible, site faible, délais.", type: "long" },
    { key: "prochaine_etape", label: "Prochaine étape convenue", type: "text" },
  ] },
];

export const ALL_QUESTIONS = QUESTIONNAIRE.flatMap((s) => s.questions);
const PUBLIC = QUESTIONNAIRE.filter((s) => !s.internal);
export const INTERNAL_KEYS = new Set(QUESTIONNAIRE.filter((s) => s.internal).flatMap((s) => s.questions.map((q) => q.key)));

/** Sections visibles par le client (version complète ou courte). */
export function publicSections(short: boolean): QSection[] {
  return PUBLIC.map((s) => ({ ...s, questions: short ? s.questions.filter((q) => q.core) : s.questions })).filter((s) => s.questions.length);
}
export const publicKeys = (short: boolean) => new Set(publicSections(short).flatMap((s) => s.questions.map((q) => q.key)));
