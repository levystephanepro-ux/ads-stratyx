// Questionnaire de découverte client : sections et questions (tout en français).
export interface Question { key: string; label: string; help?: string; type: "text" | "long" | "number" | "choice"; choices?: string[] }
export interface QSection { title: string; questions: Question[] }

export const QUESTIONNAIRE: QSection[] = [
  { title: "Votre entreprise", questions: [
    { key: "activite", label: "Que faites-vous exactement ?", help: "En 2 ou 3 phrases, comme si vous parliez à un nouveau client.", type: "long" },
    { key: "services", label: "Vos produits ou services principaux", help: "Du plus rentable au moins rentable si possible.", type: "long" },
    { key: "zone", label: "Zone géographique desservie", help: "Villes, départements, rayon autour de l'entreprise.", type: "text" },
    { key: "differences", label: "Ce qui vous différencie de vos concurrents", help: "Garanties, délais, certifications, prix, expérience, avis.", type: "long" },
    { key: "concurrents", label: "Vos principaux concurrents", help: "Noms ou sites web.", type: "long" },
  ] },
  { title: "Vos clients idéaux", questions: [
    { key: "cible", label: "Qui sont vos meilleurs clients ?", help: "Âge, situation, type d'entreprise, besoin, ce qui les décide.", type: "long" },
    { key: "refus", label: "Quels clients ou demandes ne voulez-vous pas ?", help: "Exemple : petits travaux, hors zone, particuliers, SAV.", type: "long" },
    { key: "objections", label: "Quelles objections entendez-vous le plus ?", type: "long" },
  ] },
  { title: "Vos objectifs", questions: [
    { key: "objectif", label: "Objectif principal de la publicité", type: "choice", choices: ["Recevoir des demandes de devis / appels", "Vendre en ligne", "Remplir des rendez-vous", "Faire connaître la marque", "Autre"] },
    { key: "budget", label: "Budget publicitaire mensuel envisagé (€)", type: "number" },
    { key: "valeur_lead", label: "Valeur moyenne d'un client signé (€)", help: "Panier moyen ou marge moyenne par chantier ou vente.", type: "number" },
    { key: "closing", label: "Sur 10 demandes reçues, combien deviennent clientes ?", type: "number" },
    { key: "cpl_cible", label: "Coût maximum acceptable par demande (€)", type: "number" },
    { key: "capacite", label: "Combien de demandes pouvez-vous traiter par mois ?", type: "number" },
  ] },
  { title: "Ce qui existe déjà", questions: [
    { key: "site", label: "Adresse de votre site ou page de vente", type: "text" },
    { key: "deja_teste", label: "Ce que vous avez déjà essayé en publicité", help: "Google, Meta, agences, ce qui a marché ou non.", type: "long" },
    { key: "suivi", label: "Comment suivez-vous vos demandes ?", help: "Appels, formulaires, CRM, tableur, rien.", type: "long" },
    { key: "saison", label: "Périodes fortes et périodes creuses", type: "text" },
    { key: "contraintes", label: "Mots, promesses ou sujets à éviter dans les annonces", type: "long" },
    { key: "autre", label: "Autre chose à nous dire", type: "long" },
  ] },
];

export const ALL_QUESTIONS = QUESTIONNAIRE.flatMap((s) => s.questions);
