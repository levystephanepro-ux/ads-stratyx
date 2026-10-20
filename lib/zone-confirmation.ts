// Mail de confirmation envoyé au prospect après une demande sur /zone.
// Module pur (dépendances injectées) : testé avec node --test. Texte court, première personne, signé Stéphane Levy.
// Règles : jamais « réservée » ni « garantie » ; le résultat (libre, partielle, prise) n'est jamais donné comme une
// confirmation, seulement « je vérifie la disponibilité » ; un échec d'envoi ne bloque jamais, il est écrit dans les
// logs sans l'adresse e-mail ; un seul mail par demande (anti-doublon sur e-mail, adresse et activité, 10 minutes).
import { expressionPlace, normalise } from "./zones.ts";

export const OBJET_CONFIRMATION = "Votre demande de zone, bien reçue";
export const DELAI_ANTI_DOUBLON_MS = 10 * 60 * 1000;

export interface DemandeConfirmation {
  /** Adresse e-mail saisie par le prospect. */
  email: string;
  /** Identifiant d'activité (voir ACTIVITES) ou « autre ». */
  activiteId: string;
  /** « Autre activité » : activité saisie par le prospect. */
  autreActivite?: string | null;
  /** Adresse de l'établissement, telle que saisie. */
  adresse: string;
  rayonKm: number;
}

export interface ContactStephane {
  telephone?: string | null;
  email?: string | null;
}

export interface MailConfirmation {
  subject: string;
  text: string;
  html: string;
}

/** Échappe une valeur saisie avant de l'insérer dans du HTML. */
export function escapeHtml(valeur: string): string {
  return String(valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Une ligne de texte : retours à la ligne et espaces multiples ramenés à un espace. */
const uneLigne = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

function phraseActivite(d: DemandeConfirmation): string {
  if (d.activiteId === "autre") {
    const a = uneLigne(d.autreActivite ?? "");
    return a ? `votre activité (${a})` : "votre activité";
  }
  return `votre activité ${expressionPlace(d.activiteId)}`;
}

/** Contenu du mail : objet, texte simple et HTML simple. Identique quel que soit le résultat du contrôle de zone. */
export function construireConfirmation(d: DemandeConfirmation, contact: ContactStephane = {}): MailConfirmation {
  const activite = phraseActivite(d);
  const adresse = uneLigne(d.adresse);
  const telephone = uneLigne(contact.telephone ?? "");
  const email = uneLigne(contact.email ?? "");

  const intro = `Merci, j'ai bien reçu votre demande pour ${activite} autour de ${adresse}, rayon de ${d.rayonKm} km.`;
  const suite = "Je vérifie la disponibilité et je vous rappelle sous 24 h ouvrées pour valider votre zone ensemble. Aucun engagement.";
  const coordonnees: { libelle: string; valeur: string }[] = [];
  if (telephone) coordonnees.push({ libelle: "Mon numéro", valeur: telephone });
  if (email) coordonnees.push({ libelle: "Mon adresse email", valeur: email });

  const text = [
    "Bonjour,",
    "",
    intro,
    "",
    suite,
    ...(coordonnees.length ? ["", ...coordonnees.map((c) => `${c.libelle} : ${c.valeur}`)] : []),
    "",
    "Stéphane Levy",
    "STRATYXMEDIA",
  ].join("\n");

  const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;
  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2e2b25">',
    p("Bonjour,"),
    p(escapeHtml(intro)),
    p(escapeHtml(suite)),
    ...(coordonnees.length ? [p(coordonnees.map((c) => `${escapeHtml(c.libelle)} : ${escapeHtml(c.valeur)}`).join("<br>"))] : []),
    p("Stéphane Levy<br>STRATYXMEDIA"),
    "</div>",
  ].join("\n");

  return { subject: OBJET_CONFIRMATION, text, html };
}

/** Clé de l'anti-doublon : e-mail, adresse et activité, sans accents ni casse. */
export function cleDoublon(email: string, adresse: string, activiteId: string): string {
  return [uneLigne(email).toLowerCase(), normalise(adresse), normalise(activiteId)].join("|");
}

/** Mémoire serveur : une clé réservée n'est plus acceptée pendant le délai. Réservation synchrone, donc sûre contre deux envois simultanés. */
export class AntiDoublon {
  private vus = new Map<string, number>();
  private delaiMs: number;
  private maintenant: () => number;

  constructor(delaiMs: number = DELAI_ANTI_DOUBLON_MS, maintenant: () => number = Date.now) {
    this.delaiMs = delaiMs;
    this.maintenant = maintenant;
  }

  /** true si la clé n'avait pas été vue depuis moins du délai (et la réserve) ; false si c'est un doublon. */
  reserver(cle: string): boolean {
    const t = this.maintenant();
    for (const [k, v] of this.vus) if (t - v >= this.delaiMs) this.vus.delete(k);
    if (this.vus.has(cle)) return false;
    this.vus.set(cle, t);
    return true;
  }

  /** Rend la clé disponible (envoi échoué : un nouvel envoi du formulaire pourra réessayer). */
  liberer(cle: string): void {
    this.vus.delete(cle);
  }
}

/** Texte d'erreur sans adresse e-mail : l'adresse saisie ne doit jamais apparaître dans les logs. */
export function nettoyerPourLog(message: unknown, email?: string): string {
  let m = message instanceof Error ? message.message : String(message ?? "");
  if (email) m = m.split(email).join("[email]");
  return m.replace(/[^\s@<>"',;()]+@[^\s@<>"',;()]+/g, "[email]").slice(0, 300);
}

export interface DepsConfirmation {
  envoyer(m: { to: string; subject: string; text: string; html: string; replyTo?: string | null }): Promise<void>;
  /** true si une demande identique de moins de 10 minutes a déjà reçu sa confirmation (lu en base). */
  dejaConfirmee(): Promise<boolean>;
  /** Note en base que la confirmation de cette demande est partie (sert à la détection de doublon). */
  noterEnvoi(): Promise<void>;
  /** Logs serveur : ne jamais y mettre l'adresse e-mail ni l'adresse de l'établissement. */
  journal(message: string, detail: Record<string, unknown>): void;
  antiDoublon: AntiDoublon;
  contact: ContactStephane;
  /** Adresse de réponse (reply-to) : celle de Stéphane. */
  replyTo?: string | null;
}

/**
 * Envoie la confirmation. Ne lève jamais : « envoye », « doublon » ou « echec » (écrit dans les logs).
 * @param repere identifiant de la demande, seul repère écrit dans les logs.
 */
export async function envoyerConfirmation(
  deps: DepsConfirmation, d: DemandeConfirmation, repere: string,
): Promise<"envoye" | "doublon" | "echec"> {
  const cle = cleDoublon(d.email, d.adresse, d.activiteId);
  if (!deps.antiDoublon.reserver(cle)) return "doublon";
  try {
    if (await deps.dejaConfirmee()) return "doublon";
    const mail = construireConfirmation(d, { telephone: deps.contact.telephone, email: deps.contact.email ?? deps.replyTo });
    await deps.envoyer({ to: d.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: deps.replyTo ?? null });
  } catch (e) {
    deps.antiDoublon.liberer(cle);
    deps.journal("[zone] confirmation au prospect non envoyée", { demande: repere, erreur: nettoyerPourLog(e, d.email) });
    return "echec";
  }
  try {
    await deps.noterEnvoi();
  } catch (e) {
    deps.journal("[zone] confirmation envoyée mais non notée", { demande: repere, erreur: nettoyerPourLog(e, d.email) });
  }
  return "envoye";
}
