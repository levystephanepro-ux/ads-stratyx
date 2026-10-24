// Traduction des constats techniques en langage de dirigeant (vouvoiement, sans jargon Ads).
// Sert aux livrables remis à l'entreprise (audit prospect et audit client). Le diagnostic
// interne (/waste) garde ses textes d'origine, écrits pour le media buyer.
//
// Principe : on ne change jamais ce qui est constaté, seulement la façon de le dire. Aucun
// chiffre n'est inventé : on reprend ceux du constat (montants, campagne) ou on n'en met pas.
import type { Constat } from "./types";
import type { SiteCheck } from "./site";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Ce que le point touche : sert à regrouper et à parler en effet concret. */
export type Impact = "appels" | "argent" | "confiance" | "mesure" | "visibilite";
export const IMPACT_LABELS: Record<Impact, string> = {
  appels: "Demandes et appels",
  argent: "Budget",
  confiance: "Confiance",
  mesure: "Mesure des résultats",
  visibilite: "Visibilité",
};

export interface PlainCheck {
  id: string;
  level: SiteCheck["level"];
  ok: boolean;
  impact: Impact;
  label: string;
  text: string;
}

const SITE: Record<string, { impact: Impact; label: string; good: string; bad: string }> = {
  http: { impact: "appels", label: "Votre page est accessible", good: "Votre page s'ouvre correctement.",
    bad: "Votre page renvoie une erreur : les visiteurs venus de vos annonces arriveraient sur une page qui ne s'affiche pas." },
  https: { impact: "confiance", label: "Votre page est sécurisée", good: "La connexion à votre page est sécurisée.",
    bad: "Votre page n'est pas sécurisée (pas de https) : Google Ads peut la refuser et les visiteurs s'en méfient." },
  noindex: { impact: "visibilite", label: "Votre page peut être trouvée sur Google", good: "Aucune consigne ne demande à Google d'ignorer votre page.",
    bad: "Votre page demande aux moteurs de recherche de l'ignorer : elle ne remontera pas dans les résultats naturels." },
  speed: { impact: "appels", label: "Votre page s'affiche vite", good: "Votre page répond rapidement.",
    bad: "Votre page semble lente à s'ouvrir : les visiteurs impatients repartent avant de vous contacter. À confirmer avec un test de vitesse." },
  weight: { impact: "appels", label: "Votre page est légère", good: "Votre page est d'un poids raisonnable.",
    bad: "Votre page est très lourde : elle risque de s'ouvrir lentement sur téléphone." },
  mobile: { impact: "appels", label: "Votre page est adaptée au téléphone", good: "Votre page est prévue pour les téléphones.",
    bad: "Votre page n'est pas prévue pour les téléphones, qui apportent l'essentiel des visiteurs : beaucoup repartent sans vous contacter." },
  title: { impact: "visibilite", label: "Le titre de votre page est clair", good: "Le titre de votre page a une bonne longueur.",
    bad: "Le titre de votre page est absent ou mal calibré : c'est la première phrase qu'un internaute lit dans Google." },
  desc: { impact: "visibilite", label: "La description de votre page est soignée", good: "La description affichée sous votre page dans Google est bien calibrée.",
    bad: "La description affichée sous votre page dans Google est absente ou mal calibrée : elle donne moins envie de cliquer." },
  h1: { impact: "appels", label: "Votre page affiche une promesse claire", good: "Votre page affiche un titre principal unique.",
    bad: "Votre page n'affiche pas un titre principal unique : le visiteur ne retrouve pas la promesse de l'annonce sur laquelle il a cliqué." },
  cta: { impact: "appels", label: "Vos visiteurs savent comment vous contacter", good: "Votre page invite à agir (devis, appel, contact).",
    bad: "Aucune invitation claire à agir (demander un devis, appeler, être rappelé) n'a été repérée : le visiteur ne sait pas quoi faire ensuite." },
  tel: { impact: "appels", label: "Vos visiteurs peuvent vous appeler d'un clic", good: "Votre numéro se compose d'un clic sur téléphone.",
    bad: "Aucun numéro de téléphone n'a été repéré sur la page : les clients qui préfèrent appeler ne peuvent pas le faire." },
  form: { impact: "appels", label: "Un formulaire permet de vous écrire", good: "Votre page propose un formulaire de contact.",
    bad: "Aucun formulaire n'a été repéré (il peut se charger après coup, à vérifier) : un visiteur qui ne peut pas appeler ne peut pas non plus vous écrire." },
  proof: { impact: "confiance", label: "Votre page rassure", good: "Votre page met en avant des avis, des garanties ou des certifications.",
    bad: "Aucune preuve de confiance n'a été repérée (avis clients, garanties, certifications) : un visiteur hésite à demander un devis à une entreprise qu'il ne connaît pas." },
  track: { impact: "mesure", label: "Vos demandes sont mesurées", good: "Un suivi Google est en place sur votre page.",
    bad: "Aucun suivi Google n'est installé : impossible de savoir combien de demandes vos annonces génèrent." },
  consent: { impact: "mesure", label: "Votre bandeau de cookies est en place", good: "Un outil de consentement est installé.",
    bad: "Aucun bandeau de consentement n'a été repéré : à vérifier pour le respect de la réglementation et pour la mesure de vos demandes." },
  meta: { impact: "mesure", label: "Le suivi Facebook et Instagram est en place", good: "Le suivi Meta est présent.",
    bad: "Pas de suivi Facebook et Instagram : utile seulement si vous prévoyez d'y faire de la publicité." },
  alt: { impact: "visibilite", label: "Vos images sont décrites", good: "Vos images sont décrites.",
    bad: "Plusieurs images n'ont pas de description : léger impact sur votre visibilité." },
  schema: { impact: "visibilite", label: "Google comprend bien votre entreprise", good: "Votre page contient les informations structurées utiles à Google.",
    bad: "Votre page ne contient pas les informations structurées (entreprise locale, avis) qui aident Google à la comprendre." },
};

/** Un contrôle de la page, reformulé pour le dirigeant. Un id inconnu garde son texte d'origine. */
export function plainSiteCheck(c: SiteCheck): PlainCheck {
  const t = SITE[c.id];
  if (!t) return { id: c.id, level: c.level, ok: c.ok, impact: "visibilite", label: c.label, text: c.detail };
  let bad = t.bad;
  if (c.id === "tel" && /pas cliquable/i.test(c.detail)) {
    bad = "Votre numéro est affiché mais ne se compose pas d'un clic sur téléphone : vous perdez des appels.";
  }
  return { id: c.id, level: c.level, ok: c.ok, impact: t.impact, label: t.label, text: c.ok ? t.good : bad };
}

/** Note sur 100 d'une liste de contrôles (mêmes poids que l'audit de page). */
export function scoreOf(checks: { ok: boolean; level: SiteCheck["level"] }[]): number {
  const w = { critique: 3, important: 2, mineur: 1 } as const;
  const total = checks.reduce((s, x) => s + w[x.level], 0);
  if (!total) return 0;
  return Math.round((checks.reduce((s, x) => s + (x.ok ? w[x.level] : 0), 0) / total) * 100);
}

export interface PlainConstat {
  id: string;
  severity: Constat["severity"];
  impact: Impact;
  title: string;
  detail: string;
  action: string;
  amount: number | null;
  /** false = pas de traduction connue : texte d'origine conservé (écrit pour un media buyer). */
  translated: boolean;
}

/** Un constat du compte Google Ads, reformulé pour le dirigeant. Les montants viennent du constat. */
export function plainConstat(c: Constat): PlainConstat {
  const base = { id: c.id, severity: c.severity, amount: c.amount, translated: true };
  const id = c.id;

  if (id.startsWith("recherche:")) {
    return { ...base, impact: "argent",
      title: c.amount ? `${eur(c.amount)} dépensés sur des recherches qui n'ont rien rapporté` : "Des recherches sans rapport avec votre activité vous coûtent de l'argent",
      detail: "Des internautes ont cliqué sur vos annonces sans jamais vous contacter. En excluant ces recherches, l'argent est réservé aux personnes qui cherchent vraiment vos services.",
      action: c.severity === "mineur" ? "Nous surveillons ces recherches avant de décider de les exclure." : "Nous excluons ces recherches de vos campagnes." };
  }
  if (id.startsWith("kw:nonconv:")) {
    return { ...base, impact: "argent",
      title: c.amount ? `Un mot-clé a coûté ${eur(c.amount)} sans vous apporter de demande` : "Un mot-clé dépense sans vous apporter de demande",
      detail: "Ce mot-clé a reçu assez de clics pour qu'il soit très improbable que l'absence de demande soit due au hasard.",
      action: "Nous le mettons en pause ou nous le resserrons, puis nous vérifions les recherches qu'il déclenche." };
  }
  if (id.startsWith("kw:watch:")) {
    return { ...base, impact: "argent",
      title: "Un mot-clé dépense sans résultat pour l'instant",
      detail: "Il n'a pas encore reçu assez de clics pour conclure.",
      action: "Nous le surveillons : sans demande d'ici deux semaines, nous baissons son enchère ou nous le mettons en pause." };
  }
  if (id.startsWith("kw:qs:")) {
    return { ...base, impact: "argent",
      title: "Vos clics coûtent plus cher que ceux de vos concurrents",
      detail: "Google juge qu'une de vos annonces correspond mal à la recherche ou à la page : vous payez davantage à chaque clic.",
      action: "Nous rapprochons l'annonce et la page de ce mot-clé pour faire baisser le prix du clic." };
  }
  if (id.startsWith("conflit:")) {
    return { ...base, impact: "appels",
      title: "Un réglage empêche une de vos annonces de s'afficher",
      detail: "Un mot exclu bloque une recherche que vous voulez pourtant atteindre : des clients potentiels ne voient pas votre annonce.",
      action: "Nous retirons ou ajustons cette exclusion." };
  }
  if (id.startsWith("budget:limite-sansconv:")) {
    return { ...base, impact: "argent",
      title: "Une campagne manque de budget mais ne rapporte rien pour l'instant",
      detail: "Elle s'arrête avant la fin de la journée sans avoir produit de demande.",
      action: "Inutile d'augmenter le budget avant d'avoir corrigé ce qui ne convertit pas." };
  }
  if (id.startsWith("budget:limite:")) {
    return { ...base, impact: "appels",
      title: "Une campagne qui fonctionne s'arrête trop tôt dans la journée",
      detail: "Elle apporte des demandes, mais son budget est épuisé avant la fin de la journée : des clients potentiels voient alors vos concurrents à votre place.",
      action: "Augmenter son budget, ou resserrer la zone visée, pour ne plus passer à côté de ces demandes." };
  }
  if (id.startsWith("budget:campagne-sansconv:")) {
    return { ...base, impact: "argent",
      title: c.amount ? `${eur(c.amount)} dépensés sur une campagne sans aucune demande` : "Une campagne dépense sans aucune demande",
      detail: "Elle reçoit des clics mais aucun appel ni formulaire, alors que vos autres campagnes en reçoivent.",
      action: "Nous vérifions la page et le suivi, puis nous réduisons le budget tant que rien n'arrive." };
  }
  if (id.startsWith("budget:rang:")) {
    return { ...base, impact: "appels",
      title: "Une campagne perd des clients au profit de concurrents mieux placés",
      detail: "Sur une campagne qui apporte des demandes, vos annonces sont souvent devancées par celles de vos concurrents.",
      action: "Nous améliorons l'annonce et la page avant d'augmenter les enchères." };
  }
  if (id.startsWith("policy:")) {
    const kind = id.split(":")[1];
    const refused = c.severity !== "mineur";
    const title = kind === "annonce"
      ? (refused ? "Une de vos annonces est bloquée par Google : elle ne s'affiche pas" : "Une de vos annonces est limitée par Google : elle s'affiche moins")
      : (refused ? "Une information complémentaire de votre annonce (appel, lien…) est refusée par Google" : "Une information complémentaire de votre annonce est limitée par Google");
    return { ...base, impact: "appels", title,
      detail: refused ? "Tant qu'elle est refusée, elle ne vous apporte aucun client." : "La restriction limite la diffusion sans la bloquer.",
      action: refused ? "Nous la corrigeons selon le motif donné par Google et nous demandons un nouvel examen." : "Nous vérifions la restriction pour ne pas perdre de diffusion." };
  }
  if (id.startsWith("marque:nom:")) {
    return { ...base, impact: "confiance",
      title: "Le nom de votre entreprise n'apparaît pas dans l'annonce",
      detail: "Google l'affiche en haut de l'annonce quand il est renseigné : cela rassure et se remarque.",
      action: "Nous renseignons le nom de votre entreprise." };
  }
  if (id.startsWith("marque:logo:")) {
    return { ...base, impact: "confiance",
      title: "Votre logo n'apparaît pas dans l'annonce",
      detail: "Le logo s'affiche avec le nom de l'entreprise et rend l'annonce plus reconnaissable.",
      action: "Nous ajoutons votre logo (carré, 1200 × 1200)." };
  }
  if (id === "suivi:aucune-action") {
    return { ...base, impact: "mesure",
      title: "Vos demandes (appels, formulaires) ne sont pas comptées",
      detail: "Sans mesure, Google ne sait pas quelles annonces vous rapportent des clients et dépense à l'aveugle.",
      action: "Nous mettons en place le suivi des appels et des formulaires." };
  }
  if (id === "suivi:rupture-7j") {
    return { ...base, impact: "mesure",
      title: "Plus aucune demande mesurée depuis 7 jours",
      detail: "Vos annonces reçoivent des clics, mais aucune demande n'est enregistrée alors qu'il y en avait avant : soit le suivi ne fonctionne plus, soit le site ne donne plus envie de contacter.",
      action: "Nous testons le formulaire et l'appel, et nous vérifions le suivi avant de toucher aux campagnes." };
  }
  if (id === "suivi:zero-30j") {
    return { ...base, impact: "mesure",
      title: "Aucune demande mesurée en 30 jours",
      detail: "Des clics et un budget ont été dépensés sans qu'aucune demande ne soit enregistrée.",
      action: "Nous vérifions d'abord le suivi : un compte qui reçoit des appels sans les mesurer est piloté à l'aveugle." };
  }
  return { ...base, translated: false, impact: "argent", title: c.title, detail: c.detail, action: c.action };
}
