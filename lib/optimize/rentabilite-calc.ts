// Calculs purs de rentabilité (utilisables côté serveur et dans le navigateur) :
// CPA cible / critique, ROAS cible / critique, CPL, budget. Méthode du calculateur
// « Budget pub & KPIs cibles ».
export type Mode = "lead" | "ecom";

export interface RentaInput {
  mode: Mode;
  /** Valeur moyenne HT d'une vente (panier moyen, ou prix moyen d'un chantier). */
  panier: number;
  cogs: number;        // % du panier : coûts variables (production, pose, matière)
  livraison: number;   // % : livraison / distribution
  transaction: number; // % : frais de transaction, commissions
  agence: number;      // % : coûts marketing hors pub (agence, outils)
  opex: number;        // % : coûts fixes
  benefice: number;    // % : bénéfice net voulu
  /** Prospect → client, en % (mode lead uniquement). */
  conv: number;
  /** Objectif de chiffre d'affaires mensuel HT. */
  ca: number;
}

export const EXEMPLE: RentaInput = { mode: "ecom", panier: 120, cogs: 15, livraison: 6.66, transaction: 5.68, agence: 5, opex: 30, benefice: 11.92, conv: 25, ca: 33477.69 };

export interface Targets {
  mc1: number; contrib: number; mc2: number; mc3: number;
  beneficeEur: number;
  cpaCible: number; cpaCritique: number;
  roasCible: number | null; roasCritique: number | null;
  ventes: number; leads: number | null;
  cplCible: number | null; cplCritique: number | null;
  budgetMois: number; budgetJour: number;
  /** Le modèle est-il viable ? (marge après coûts > 0) */
  viable: boolean;
}

export function compute(i: RentaInput): Targets {
  const p = Math.max(0, i.panier);
  const pc = (x: number) => (p * Math.max(0, x)) / 100;
  const mc1 = p - pc(i.cogs);
  const contrib = mc1 - pc(i.livraison) - pc(i.transaction);
  const mc2 = contrib - pc(i.agence);
  const mc3 = mc2 - pc(i.opex);
  const beneficeEur = pc(i.benefice);
  const cpaCritique = Math.max(0, mc3);
  const cpaCible = Math.max(0, mc3 - beneficeEur);
  const ventes = p > 0 ? Math.max(0, i.ca) / p : 0;
  const conv = i.mode === "lead" && i.conv > 0 ? i.conv / 100 : null;
  const budgetMois = cpaCible * ventes;
  return {
    mc1, contrib, mc2, mc3, beneficeEur, cpaCible, cpaCritique,
    roasCible: cpaCible > 0 ? p / cpaCible : null,
    roasCritique: cpaCritique > 0 ? p / cpaCritique : null,
    ventes,
    leads: conv ? ventes / conv : null,
    cplCible: conv ? cpaCible * conv : null,
    cplCritique: conv ? cpaCritique * conv : null,
    budgetMois, budgetJour: budgetMois / 30,
    viable: mc3 > 0,
  };
}

export type Verdict = "bon" | "limite" | "perte" | "aucune";

/** Où se situe un coût par vente réel : sous la cible, entre cible et critique, ou au-dessus du seuil de rentabilité. */
export function verdict(cpaReel: number | null, t: Targets): Verdict {
  if (cpaReel === null || !isFinite(cpaReel)) return "aucune";
  if (cpaReel <= t.cpaCible) return "bon";
  if (cpaReel <= t.cpaCritique) return "limite";
  return "perte";
}

export const VERDICT_TXT: Record<Verdict, string> = {
  bon: "Rentable, bénéfice voulu atteint",
  limite: "Rentable mais sous le bénéfice voulu",
  perte: "Perte à chaque vente",
  aucune: "Pas de vente mesurée",
};
