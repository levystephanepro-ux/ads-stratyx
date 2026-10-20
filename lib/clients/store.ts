// Fiches clients et questionnaire de découverte (Supabase, service_role).
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getSetting, setSetting } from "@/lib/agent/store";
import { contextKey } from "@/lib/account-context";
import { ALL_QUESTIONS, INTERNAL_KEYS } from "./questions";
import { synchroniserZone } from "@/lib/zones-store";

export interface Client {
  id: string; name: string; customer_id: string | null; website: string | null; contact_email: string | null; notes: string | null;
  answers: Record<string, string>; status: "a_envoyer" | "envoye" | "brouillon" | "rempli"; submitted_at: string | null;
  share_token: string; created_at: string; updated_at: string;
  /** étape commerciale (migration 0022) */
  stage?: string;
  /** contact (migration 0023) */
  contact_name?: string | null;
  contact_phone?: string | null;
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await db().from("clients").select("*").is("workspace_id", null).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}
export async function getClient(id: string): Promise<Client | null> {
  const { data } = await db().from("clients").select("*").eq("id", id).maybeSingle();
  return data as Client | null;
}
export async function getClientByToken(token: string): Promise<Client | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const { data } = await db().from("clients").select("*").eq("share_token", token).maybeSingle();
  return data as Client | null;
}
export async function getClientByCustomer(customerId: string): Promise<Client | null> {
  const { data } = await db().from("clients").select("*").eq("customer_id", customerId).limit(1).maybeSingle();
  return data as Client | null;
}
export async function createClientRow(name: string, customerId: string | null): Promise<string> {
  // Anti-doublon (double clic, rechargement) : même nom, même compte => on renvoie la fiche existante.
  const { data: same } = await db().from("clients").select("id, name, customer_id").is("workspace_id", null).ilike("name", name);
  const dup = (same ?? []).find((c) => (c.customer_id ?? null) === customerId);
  if (dup) return dup.id as string;
  const { data, error } = await db().from("clients").insert({ name, customer_id: customerId, share_token: randomBytes(18).toString("base64url") }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
/** Prospect arrivé par un lien partenaire (ex. Club ARIA) : toujours une nouvelle fiche, jamais d'anti-doublon par nom
 *  (le lien public du questionnaire ne doit jamais ouvrir la fiche d'un autre). Renvoie le lien privé du client. */
export async function createPartnerLead(input: { name: string; activite: string; zone: string; source: string }): Promise<string> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db().from("clients").select("id", { count: "exact", head: true }).gte("created_at", since).not("answers->>source", "is", null);
  if ((count ?? 0) >= 30) throw new Error("trop_de_demandes");
  const share_token = randomBytes(18).toString("base64url");
  const answers: Record<string, string> = { source: input.source, partage_partenaire: "oui", activite: input.activite, zone: input.zone };
  const { error } = await db().from("clients").insert({
    name: input.name, customer_id: null, share_token, status: "envoye", answers,
    notes: `Source : ${input.source} (lien partenaire). Accord de partage des réponses avec le partenaire donné à l'ouverture.`,
  });
  if (error) throw new Error(error.message);
  return share_token;
}
export const SOURCE_VERIFICATION_ZONE = "vérification de zone";

export interface ZoneLeadInput {
  nom: string; telephone: string; email: string; situation: string;
  /** Identifiant d'activité (voir ACTIVITES), ou « autre ». */
  activite: string;
  /** Libellé affiché de l'activité. */
  activiteLibelle: string;
  /** Champs de « Autre activité », déjà validés et nettoyés par la route. */
  autre?: { autreActivite: string; panierMoyen: number; description: string };
  adresse: string; rayonKm: number;
  etat: string; indicatif: boolean;
  geo: { lat: number; lng: number; commune: string; precision: string } | null;
}

/** Demande de la page publique /zone : nouvelle fiche prospect (jamais d'anti-doublon par nom). Renvoie l'id de la fiche. */
export async function createZoneLead(input: ZoneLeadInput): Promise<string> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db().from("clients").select("id", { count: "exact", head: true }).gte("created_at", since).eq("answers->>source", SOURCE_VERIFICATION_ZONE);
  if ((count ?? 0) >= 40) throw new Error("trop_de_demandes");
  const answers: Record<string, string> = {
    source: SOURCE_VERIFICATION_ZONE,
    activite_exclusive: input.activite,
    adresse_etablissement: input.adresse,
    rayon_km: String(input.rayonKm),
    zone_etat: input.etat,
    zone_indicatif: input.indicatif ? "oui" : "non",
  };
  if (input.autre) {
    answers.autre_activite = input.autre.autreActivite;
    answers.autre_panier_moyen = String(input.autre.panierMoyen);
    if (input.autre.description) answers.autre_description = input.autre.description;
    answers.verification_manuelle_zones = "oui";
  }
  if (input.geo) {
    answers.zone_lat = String(input.geo.lat);
    answers.zone_lng = String(input.geo.lng);
    answers.zone_commune = input.geo.commune;
    answers.zone_precision = input.geo.precision;
  }
  const { data, error } = await db().from("clients").insert({
    name: input.nom, customer_id: null, share_token: randomBytes(18).toString("base64url"), answers,
    contact_name: input.nom, contact_phone: input.telephone, contact_email: input.email,
    notes: `Source : ${SOURCE_VERIFICATION_ZONE}.${input.situation ? ` Situation : ${input.situation}.` : ""}${input.autre ? ` Autre activité : ${input.autre.autreActivite}, panier moyen estimé ${input.autre.panierMoyen} euros. À vérifier manuellement : zones existantes.` : ""} Consentement à être recontacté donné sur la page /zone.`,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
export async function updateClient(id: string, patch: Partial<Pick<Client, "name" | "customer_id" | "website" | "contact_email" | "notes" | "answers" | "status" | "submitted_at" | "stage" | "contact_name" | "contact_phone">>) {
  const { error } = await db().from("clients").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  // Toute écriture d'étape (menu, boutons du parcours, devis accepté) aligne la zone d'exclusivité du client.
  // Une erreur de zone (migration 0024 absente, base indisponible) ne bloque jamais le changement d'étape.
  if (patch.stage) await synchroniserZone(id, patch.stage).catch(() => undefined);
}
export async function deleteClient(id: string) {
  await db().from("clients").delete().eq("id", id);
}

/** Lit les réponses d'un formulaire (les cases multiples sont jointes par des virgules). */
export function formAnswers(form: FormData, keys?: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    if (keys && !keys.has(q.key)) continue;
    const v = form.getAll(q.key).map((x) => String(x).trim()).filter(Boolean).join(", ").slice(0, 2000);
    if (v) out[q.key] = v;
  }
  return out;
}

const START = "[Questionnaire client]";
const END = "[/Questionnaire client]";

/** Texte résumé des réponses, lu par le Copilote et le planificateur. */
export function answersToContext(c: Pick<Client, "name" | "website" | "answers">): string {
  const lines = [`${START}`, `Client : ${c.name}`];
  if (c.website) lines.push(`Site : ${c.website}`);
  for (const q of ALL_QUESTIONS) {
    if (INTERNAL_KEYS.has(q.key)) continue; // notes internes : jamais envoyées à l'IA
    const v = c.answers[q.key];
    if (v) lines.push(`${q.label} ${v.replace(/\s*\n\s*/g, " ")}`);
  }
  lines.push(END);
  return lines.join("\n");
}

/** Écrit le questionnaire dans le contexte du compte, en gardant le texte libre déjà saisi. */
export async function syncContext(c: Client): Promise<boolean> {
  if (!c.customer_id || Object.keys(c.answers).length === 0) return false;
  const key = contextKey(c.customer_id);
  const current = (await getSetting(key, null)) ?? "";
  const block = answersToContext(c);
  const i = current.indexOf(START);
  const j = current.indexOf(END);
  const next = i >= 0 && j > i ? current.slice(0, i) + block + current.slice(j + END.length) : (current ? current.trimEnd() + "\n\n" : "") + block;
  await setSetting(key, next, null);
  return true;
}
