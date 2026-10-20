/* ------------------------------------------------------------------
   lib/zones.ts
   Exclusivité territoriale par rayon autour de l'établissement.
   Centre de zone = adresse de l'établissement (fiche Google Business).

   Module pur : aucune donnée, aucun accès base, aucun import alias.
   Les zones occupées et les communes sont passées en paramètre, pour
   que le navigateur ne reçoive jamais la table des zones.

   RÈGLE ABSOLUE : ne jamais annoncer « libre » en cas de doute.
   Erreur de lecture, activité non reconnue, adresse non géocodée,
   rayon invalide : état « inconnue », vérification manuelle.
   ------------------------------------------------------------------ */

/* ------------------------------ Constantes ------------------------------ */

/** Rayon compris dans le pack (km). */
export const RAYON_INCLUS_KM = 10;
export const RAYONS_PROPOSES = [5, 10, 15, 20] as const;
/** Nombre de zones comprises dans le pack. */
export const ZONES_INCLUSES = 1;
/** Supplément mensuel (€) par zone ou tranche supplémentaire. */
export const PRIX_ZONE_SUPP_MOIS = 100;
/** Budget publicitaire minimum supplémentaire (€ par mois) par zone supplémentaire. */
export const BUDGET_SUPP_PAR_ZONE = 250;
/** Deux zones se chevauchent si distance < r1 + r2 - tolérance (km). 0 = aucun recouvrement toléré. */
export const TOLERANCE_CHEVAUCHEMENT_KM = 0;
/** En dessous de ce rayon libre, la zone est considérée comme prise (km). */
export const RAYON_MIN_KM = 3;
export const GARDE_APRES_APPEL_JOURS = 7;
export const LIBERATION_APRES_ARRET_JOURS = 30;
/** Largeur d'une tranche de rayon au-delà du rayon inclus (km) : 15 et 20 km = 1 tranche. */
export const TRANCHE_RAYON_KM = 10;
/** Suggestions de communes voisines : distance maximale (km) et nombre. */
export const RAYON_SUGGESTION_KM = 30;
export const NB_SUGGESTIONS = 3;
/** Score minimum de l'API Adresse pour accepter un géocodage (0 à 1). */
export const SCORE_MIN_GEOCODAGE = 0.7;

/* ------------------------------ Activités ------------------------------- */

/** Activité contrôlable : identifiant stable (minuscules, sans accents) stocké en base, libellé affiché. */
export interface Activite {
  id: string;
  /** Libellé complet : menu du formulaire et e-mails. */
  label: string;
  /** Libellé court : phrases de réponse affichées au public (« la place de plombier »). */
  court: string;
}

export const ACTIVITES: readonly Activite[] = [
  { id: "plomberie", label: "Plomberie (dépannage et installation)", court: "plombier" },
  { id: "electricite", label: "Électricité", court: "électricien" },
  { id: "serrurerie-vitrerie", label: "Serrurerie et vitrerie (dépannage)", court: "serrurier ou vitrier" },
  { id: "chauffage-climatisation", label: "Chauffage et climatisation (pompes à chaleur)", court: "chauffagiste" },
  { id: "couverture-etancheite", label: "Couverture et étanchéité", court: "couvreur" },
  { id: "fenetres-volets-verandas", label: "Fenêtres, volets et vérandas", court: "installateur de fenêtres et volets" },
  { id: "piscine-paysagisme", label: "Piscine et paysagisme (création)", court: "pisciniste ou paysagiste" },
  { id: "cuisine-salle-de-bain", label: "Cuisine et salle de bain", court: "cuisiniste" },
  { id: "immobilier", label: "Immobilier (agents et agences)", court: "agent immobilier" },
  { id: "dentiste-sante", label: "Dentiste et santé à fort panier (implants, orthodontie, esthétique médicale)", court: "dentiste ou praticien de santé" },
  { id: "yachting-refit", label: "Yachting et refit", court: "professionnel du yachting" },
];

/** Dernier choix : jamais contrôlable, toujours en vérification manuelle. */
export const ACTIVITE_AUTRE: Activite = { id: "autre", label: "Autre activité", court: "autre activité" };

/** Liste affichée dans le formulaire : les 11 activités puis « Autre activité ». */
export const ACTIVITES_CHOIX: readonly Activite[] = [...ACTIVITES, ACTIVITE_AUTRE];

/** Réponse à toute demande « Autre activité ». */
export const MESSAGE_ACTIVITE_AUTRE =
  "Je regarde votre activité à la main et je vous réponds sous 24 h ouvrées.";

/** Limites des champs de « Autre activité ». */
export const AUTRE_ACTIVITE_MIN = 3;
export const AUTRE_ACTIVITE_MAX = 80;
export const PANIER_MIN_EUR = 1;
export const PANIER_MAX_EUR = 100_000;
export const DESCRIPTION_MAX = 200;

/** Normalise pour comparer « Saint-Laurent du Var » et « saint laurent-du-var ». */
export function normalise(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Identifiant de l'activité, ou null si elle n'est pas dans la liste. Accepte l'identifiant ou le libellé. « Autre activité » n'est jamais contrôlable. */
export function activiteReconnue(valeur: string): string | null {
  if (typeof valeur !== "string") return null;
  const n = normalise(valeur);
  if (!n) return null;
  return ACTIVITES.find((a) => normalise(a.id) === n || normalise(a.label) === n)?.id ?? null;
}

/** Vrai pour « Autre activité » (identifiant ou libellé). */
export function estAutreActivite(valeur: string): boolean {
  if (typeof valeur !== "string") return false;
  const n = normalise(valeur);
  return n === normalise(ACTIVITE_AUTRE.id) || n === normalise(ACTIVITE_AUTRE.label);
}

/** Libellé court d'une activité (« plombier »), ou le libellé complet si l'identifiant est inconnu. */
export function libelleCourtActivite(id: string): string {
  const a = [...ACTIVITES, ACTIVITE_AUTRE].find((x) => x.id === id);
  return a ? a.court : id;
}

/** « de plombier », « d'électricien » : complément du nom « place », avec élision devant une voyelle ou un h muet. */
export function expressionPlace(id: string): string {
  const court = libelleCourtActivite(id);
  return /^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(court) ? "d'" + court : "de " + court;
}

/** Libellé à afficher pour un identifiant d'activité (identifiant renvoyé tel quel s'il est inconnu). */
export function libelleActivite(id: string): string {
  return [...ACTIVITES, ACTIVITE_AUTRE].find((a) => a.id === id)?.label ?? id;
}

/* -------------------------------- Types --------------------------------- */

export type StatutZone = "gardee" | "reserve" | "actif" | "liberation" | "libere";

export interface Point {
  lat: number;
  lng: number;
}

export interface ZoneOccupee extends Point {
  activite: string;
  rayonKm: number;
  statut: StatutZone;
  /** Fin de garde (gardee) ou de libération (liberation), ISO. */
  expireLe: string | null;
  clientId?: string | null;
}

export interface CommuneCentre extends Point {
  nom: string;
}

export type EtatZone = "libre" | "partielle" | "prise" | "inconnue";

export interface ResultatControle {
  etat: EtatZone;
  /** Rayon maximal possible sans chevauchement (km), arrondi à l'inférieur au dixième. Renseigné pour libre, partielle et prise. */
  rayonMaxKm?: number;
  /** Raison de l'état « inconnue » (usage interne, jamais affichée au public). */
  raison?: string;
}

/* ------------------------------- Distance ------------------------------- */

const RAYON_TERRE_KM = 6371.0088;

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function pointValide(p: Partial<Point> | null | undefined): p is Point {
  return (
    !!p &&
    typeof p.lat === "number" && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180
  );
}

/** Distance à vol d'oiseau (haversine), en km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------ Occupation ------------------------------ */

function apres(iso: string | null, maintenant: Date): boolean {
  if (!iso) return true; // date absente ou illisible : on considère la zone encore occupée
  const t = Date.parse(iso);
  return Number.isNaN(t) ? true : t > maintenant.getTime();
}

/** Une zone bloque le territoire : gardée ou en libération non expirée, réservée, active. */
export function estOccupee(z: Pick<ZoneOccupee, "statut" | "expireLe">, maintenant: Date = new Date()): boolean {
  switch (z.statut) {
    case "reserve":
    case "actif":
      return true;
    case "gardee":
    case "liberation":
      return apres(z.expireLe, maintenant);
    case "libere":
      return false;
    default:
      return true; // statut inattendu : on bloque, jamais l'inverse
  }
}

/* ------------------------------- Contrôle ------------------------------- */

export interface OptionsControle {
  maintenant?: Date;
  /** Ignore les zones de ce client (recalcul de sa propre zone). */
  exclureClientId?: string | null;
}

function arrondiInf(x: number): number {
  return Math.floor(x * 10 + 1e-9) / 10;
}

/**
 * Contrôle d'un établissement (point + rayon voulu) contre les zones occupées.
 * Deux zones de même activité se chevauchent si distance < r1 + r2 - tolérance.
 * rayonMaxLibre = min sur les zones occupées de (distance - rayon existant + tolérance).
 */
export function controleZone(
  activite: string,
  point: Partial<Point> | null | undefined,
  rayonKm: number,
  zonesOccupees: readonly ZoneOccupee[],
  options: OptionsControle = {},
): ResultatControle {
  const act = activiteReconnue(activite);
  if (!act) return { etat: "inconnue", raison: "activité non reconnue ou « Autre activité »" };
  if (!pointValide(point)) return { etat: "inconnue", raison: "adresse non géocodée" };
  if (typeof rayonKm !== "number" || !Number.isFinite(rayonKm) || rayonKm <= 0) {
    return { etat: "inconnue", raison: "rayon invalide" };
  }
  if (!Array.isArray(zonesOccupees)) return { etat: "inconnue", raison: "zones illisibles" };

  const maintenant = options.maintenant ?? new Date();
  const cible = normalise(act);
  let rayonMax = Number.POSITIVE_INFINITY;

  for (const z of zonesOccupees) {
    if (normalise(z.activite) !== cible) continue;
    if (options.exclureClientId && z.clientId === options.exclureClientId) continue;
    if (!estOccupee(z, maintenant)) continue;
    if (!pointValide({ lat: z.lat, lng: z.lng }) || typeof z.rayonKm !== "number" || !Number.isFinite(z.rayonKm)) {
      return { etat: "inconnue", raison: "zone existante illisible" }; // doute : jamais « libre »
    }
    rayonMax = Math.min(rayonMax, distanceKm(point, z) - z.rayonKm + TOLERANCE_CHEVAUCHEMENT_KM);
  }

  if (rayonMax >= rayonKm - 1e-9) {
    return { etat: "libre", rayonMaxKm: Number.isFinite(rayonMax) ? arrondiInf(rayonMax) : undefined };
  }
  const max = arrondiInf(Math.max(0, rayonMax));
  return max >= RAYON_MIN_KM
    ? { etat: "partielle", rayonMaxKm: max }
    : { etat: "prise", rayonMaxKm: max };
}

/* ------------------------------ Supplément ------------------------------ */

/**
 * Supplément mensuel (€) : 100 € par tranche de rayon au-delà de 10 km
 * (15 et 20 km = 1 tranche) et 100 € par zone au-delà de la première.
 * Le rayon est celui de la zone principale.
 */
export function supplementMensuel(rayonKm: number, nbZones: number = ZONES_INCLUSES): number {
  const tranches = rayonKm > RAYON_INCLUS_KM ? Math.ceil((rayonKm - RAYON_INCLUS_KM) / TRANCHE_RAYON_KM - 1e-9) : 0;
  const zonesSupp = Math.max(0, Math.floor(nbZones) - ZONES_INCLUSES);
  return (tranches + zonesSupp) * PRIX_ZONE_SUPP_MOIS;
}

/* ------------------------------ Suggestions ----------------------------- */

/**
 * Jusqu'à 3 communes dans 30 km, libres pour le rayon voulu, triées par distance.
 * Le centre de la commune sert de point de test. Une commune « inconnue » n'est jamais proposée.
 */
export function suggestions(
  activite: string,
  point: Partial<Point> | null | undefined,
  rayonKm: number,
  communes: readonly CommuneCentre[],
  zonesOccupees: readonly ZoneOccupee[],
  options: OptionsControle = {},
): CommuneCentre[] {
  if (!activiteReconnue(activite) || !pointValide(point)) return [];
  return communes
    .map((c) => ({ c, d: distanceKm(point, c) }))
    .filter(({ d }) => d <= RAYON_SUGGESTION_KM)
    .sort((x, y) => x.d - y.d)
    .filter(({ c }) => controleZone(activite, c, rayonKm, zonesOccupees, options).etat === "libre")
    .slice(0, NB_SUGGESTIONS)
    .map(({ c }) => c);
}

/* ------------------------------ Expiration ------------------------------ */

export interface ZoneAvecStatut {
  id: string;
  statut: StatutZone;
  expireLe: string | null;
}

/** Zones à passer à « libere » : gardée ou en libération, avec une date d'expiration dépassée. */
export function zonesAExpirer<T extends ZoneAvecStatut>(zones: readonly T[], maintenant: Date = new Date()): T[] {
  return zones.filter((z) => {
    if (z.statut !== "gardee" && z.statut !== "liberation") return false;
    if (!z.expireLe) return false; // pas de date : on ne libère jamais seul
    const t = Date.parse(z.expireLe);
    return !Number.isNaN(t) && t <= maintenant.getTime();
  });
}

/** Date d'expiration à poser : garde de 7 jours ou libération de 30 jours. */
export function expirationPour(statut: "gardee" | "liberation", depuis: Date = new Date()): string {
  const jours = statut === "gardee" ? GARDE_APRES_APPEL_JOURS : LIBERATION_APRES_ARRET_JOURS;
  return new Date(depuis.getTime() + jours * 86_400_000).toISOString();
}

/* ------------------------ Étape commerciale et zone ------------------------ */

export interface TransitionZone {
  statut: StatutZone;
  expireLe: string | null;
  /** La zone ne bloquait plus rien (libérée ou expirée) : vérifier l'absence de chevauchement avant de la reprendre. */
  reverification: boolean;
}

/**
 * Statut que doit prendre la zone d'un client quand sa fiche change d'étape, ou null si rien ne change.
 *  - signe : réservée.
 *  - lancement ou actif : active.
 *  - perdu ou pause : en libération 30 jours (zone réservée ou active) ; libérée tout de suite si elle n'était que gardée.
 *  - toute autre étape (prospect, découverte, proposition) : aucun changement, y compris en cas de retour en arrière.
 */
export function transitionZone(
  stage: string,
  zone: { statut: StatutZone; expireLe: string | null },
  maintenant: Date = new Date(),
): TransitionZone | null {
  const bloquait = estOccupee(zone, maintenant);
  if (stage === "signe") {
    if (zone.statut === "reserve" || zone.statut === "actif") return null;
    return { statut: "reserve", expireLe: null, reverification: !bloquait };
  }
  if (stage === "lancement" || stage === "actif") {
    if (zone.statut === "actif") return null;
    return { statut: "actif", expireLe: null, reverification: !bloquait };
  }
  if (stage === "perdu" || stage === "pause") {
    if (zone.statut === "libere") return null;
    if (zone.statut === "liberation") return null; // déjà en cours de libération : on garde la date
    if (zone.statut === "gardee") return { statut: "libere", expireLe: null, reverification: false };
    return { statut: "liberation", expireLe: expirationPour("liberation", maintenant), reverification: false };
  }
  return null;
}

/* ---------------------------- Liste d'attente ---------------------------- */

export interface InscriptionAttente {
  clientId: string | null;
  activite: string;
  adresse: string;
}

/** Deux inscriptions sont la même si le client, l'activité et l'adresse (sans accents ni casse) sont identiques. */
export function memeInscriptionAttente(a: InscriptionAttente, b: InscriptionAttente): boolean {
  if (!a.clientId || !b.clientId || a.clientId !== b.clientId) return false;
  const actA = activiteReconnue(a.activite) ?? normalise(a.activite);
  const actB = activiteReconnue(b.activite) ?? normalise(b.activite);
  return actA === actB && normalise(a.adresse) === normalise(b.adresse);
}
