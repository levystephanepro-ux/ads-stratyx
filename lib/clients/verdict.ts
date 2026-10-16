// Avis de rentabilité d'un prospect à partir de ses réponses au questionnaire.
// Même modèle que le simulateur de la page partenaire : indicatif, jamais montré au client.
export interface Verdict {
  niveau: "rentable" | "limite" | "non_viable" | "incomplet";
  titre: string;
  lignes: string[];
}

/** Coût moyen d'une demande par secteur (€), repris du simulateur. */
const CPL: Record<string, number> = {
  "Artisan, bâtiment": 40,
  "Santé, bien-être": 25,
  "Commerce, restauration": 12,
  "Tourisme, nautisme": 20,
  "Services aux entreprises": 60,
  "Autre": 30,
};
/** Part des demandes qui signent, par secteur (repris du simulateur), si le client ne sait pas. */
const TAUX: Record<string, number> = {
  "Artisan, bâtiment": 0.25,
  "Santé, bien-être": 0.35,
  "Commerce, restauration": 0.35,
  "Tourisme, nautisme": 0.3,
  "Services aux entreprises": 0.2,
  "Autre": 0.3,
};
export const CATEGORIES = Object.keys(CPL);

const num = (v?: string) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function verdictOf(a: Record<string, string> | null | undefined): Verdict {
  const r = a ?? {};
  const panier = num(r.valeur_lead);
  const closing = num(r.closing);
  const budget = num(r.budget);
  if (!(panier > 0) || !(budget > 0)) {
    return { niveau: "incomplet", titre: "Avis impossible : valeur d'un client ou budget manquant", lignes: [] };
  }
  const cpl = CPL[r.categorie] ?? CPL["Autre"];
  const tauxSaisi = closing > 0;
  const taux = tauxSaisi ? Math.min(closing, 10) / 10 : (TAUX[r.categorie] ?? TAUX["Autre"]);
  const m = num(r.marge);
  const marge = m > 0 && m <= 100 ? m / 100 : 0.4;
  // Au-delà de 800 € par mois, chaque euro rapporte 40 % de demandes en moins.
  const parMois = Math.min(budget, 800) / cpl + (Math.max(0, budget - 800) / cpl) * 0.6;
  // Montée en charge sur 3 mois : 60 %, 90 %, 100 % du rythme.
  const clients3 = parMois * taux * 2.5;
  const cout3 = 990 + 3 * budget;
  const seuil = Math.ceil(cout3 / (panier * marge));
  const ratio = clients3 / seuil;
  const niveau = ratio >= 1.5 ? "rentable" : ratio >= 1 ? "limite" : "non_viable";
  const titre = { rentable: "Rentable sur le papier", limite: "Limite : rentable seulement si tout se passe bien", non_viable: "Non viable à ce budget et à cette valeur de client" }[niveau];
  const lignes = [
    `Secteur : ${r.categorie || "non précisé (Autre)"}, coût d'une demande estimé à ${cpl} €`,
    `Demandes attendues : environ ${Math.round(parMois)} par mois, dont ${Math.round(taux * 100)} % signent${tauxSaisi ? "" : " (estimé selon le secteur : le client ne le connaît pas)"}`,
    `Clients signés sur 3 mois : environ ${clients3.toFixed(1)}`,
    `Seuil de rentabilité : ${seuil} client${seuil > 1 ? "s" : ""} sur 3 mois (coût ${eur(cout3)} : Lancement 990 € + budget, marge ${Math.round(marge * 100)} %${m > 0 && m <= 100 ? "" : ", estimée"})`,
  ];
  const cap = num(r.capacite);
  if (cap > 0 && parMois > cap) lignes.push(`Attention : ${Math.round(parMois)} demandes par mois attendues pour une capacité de ${Math.round(cap)}`);
  const rap = r.delai_rappel;
  if (rap === "Dans la journée" || rap === "Plus d'un jour") lignes.push(`Attention : rappel des demandes « ${rap.toLowerCase()} », à améliorer avant de lancer`);
  return { niveau, titre, lignes };
}
