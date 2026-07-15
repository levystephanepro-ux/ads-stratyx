// Missions de l'Agent IA. Chaque mission est un "prompt récurrent" que Claude
// exécute en autonomie (il appelle lui-même les outils Google Ads), puis dont le
// résultat est envoyé par email.
//
// V1 : les missions sont définies ici (pas de base de données). Pour en ajouter/
// modifier, on édite ce fichier. La V2 branchera Supabase pour créer des missions
// depuis l'UI.

export type MissionFrequency = "daily" | "weekly" | "monthly";

export interface Mission {
  id: string;
  name: string;
  description: string;
  prompt: string;
  frequency: MissionFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  model?: string;
  allowWrite?: boolean;
  enabled: boolean;
}

/** Consigne système commune : le "caractère" de l'agent. */
export const DEFAULT_SYSTEM = `Tu es un analyste Google Ads senior qui rédige des points concis pour un gérant occupé.

Règles :
- Commence TOUJOURS par appeler les outils pour récupérer les vrais chiffres. N'invente jamais de données.
- Sois court, concret et chiffré. Va droit au but.
- Écris en français, dans un ton direct et professionnel, format email.
- Structure : un titre en gras, 2-4 constats chiffrés, puis une section "Recommandations" avec des actions concrètes et priorisées.
- Si tout va bien, dis-le clairement en une ligne plutôt que de meubler.
- Tu es en LECTURE SEULE : tu ne modifies rien. Tu proposes des actions, l'utilisateur décide.
- Termine ta réponse par le rapport final (pas de "je vais maintenant...", livre directement le résultat).`;

export const MISSIONS: Mission[] = [
  // --- Missions PROGRAMMÉES (tournent automatiquement via le cron) ---
  {
    id: "audit-quotidien",
    name: "Audit quotidien des campagnes",
    description:
      "Chaque matin : état des campagnes actives, dépense du jour, et alerte si quelque chose dérape.",
    frequency: "daily",
    model: "claude-haiku-4-5-20251001",
    enabled: true,
    prompt:
      "Fais-moi un point rapide sur mes campagnes Google Ads. Liste les comptes " +
      "gérés, puis pour le compte principal regarde les campagnes et leur " +
      "performance sur les 7 derniers jours. Signale toute anomalie : campagne qui " +
      "dépense sans convertir, chute ou explosion de coût, ROAS faible. Si tout est " +
      "normal, dis-le en une phrase.",
  },
  {
    id: "rapport-hebdo",
    name: "Rapport de performance hebdomadaire",
    description:
      "Chaque lundi : synthèse chiffrée de la semaine (coût, conversions, ROAS) et tendance.",
    frequency: "weekly",
    dayOfWeek: 1,
    model: "claude-haiku-4-5-20251001",
    enabled: true,
    prompt:
      "Rédige le rapport de performance de mon compte Google Ads principal sur les 7 " +
      "derniers jours : coût total, conversions, valeur, CPA et ROAS, sous forme de " +
      "tableau. Compare aux 7 jours précédents et indique la tendance (hausse/baisse). " +
      "Conclus par les 2-3 points d'attention de la semaine.",
  },
  {
    id: "gaspillage-hebdo",
    name: "Chasse au gaspillage",
    description:
      "Chaque jeudi : les termes de recherche et groupes d'annonces qui dépensent sans convertir.",
    frequency: "weekly",
    dayOfWeek: 4,
    model: "claude-haiku-4-5-20251001",
    enabled: true,
    prompt:
      "Analyse les 30 derniers jours de mon compte Google Ads principal. Identifie " +
      "les termes de recherche et les groupes d'annonces qui ont dépensé de l'argent " +
      "SANS générer de conversion — c'est du budget gaspillé. Donne-moi la liste " +
      "priorisée (du plus coûteux au moins coûteux) avec, pour chaque, le montant " +
      "gaspillé et l'action recommandée (mot-clé négatif à ajouter, ad group à mettre " +
      "en pause, etc.).",
  },

  // --- Missions À LA DEMANDE (lancées manuellement, pas d'email automatique) ---
  {
    id: "bilan-comptes",
    name: "Bilan tous comptes",
    model: "claude-haiku-4-5-20251001",
    description:
      "Vue d'ensemble de tous les comptes gérés en un coup d'œil.",
    frequency: "weekly",
    enabled: false,
    prompt:
      "Liste tous les comptes Google Ads gérés. Pour chacun, donne un résumé très " +
      "court de la performance des 7 derniers jours (coût, conversions, ROAS) sous " +
      "forme de tableau. Termine par quel compte a besoin d'attention en priorité.",
  },
];

/** La mission doit-elle tourner à cette date (le cron s'exécute une fois/jour) ? */
export function missionDue(m: Mission, date: Date): boolean {
  if (!m.enabled) return false;
  if (m.frequency === "daily") return true;
  const target = m.dayOfWeek ?? 1; // lundi par défaut
  return date.getUTCDay() === target;
}
