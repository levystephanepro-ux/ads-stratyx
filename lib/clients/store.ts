// Fiches clients et questionnaire de découverte (Supabase, service_role).
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getSetting, setSetting } from "@/lib/agent/store";
import { contextKey } from "@/lib/account-context";
import { ALL_QUESTIONS, INTERNAL_KEYS } from "./questions";

export interface Client {
  id: string; name: string; customer_id: string | null; website: string | null; contact_email: string | null; notes: string | null;
  answers: Record<string, string>; status: "a_envoyer" | "envoye" | "rempli"; submitted_at: string | null;
  share_token: string; created_at: string; updated_at: string;
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
export async function updateClient(id: string, patch: Partial<Pick<Client, "name" | "customer_id" | "website" | "contact_email" | "notes" | "answers" | "status" | "submitted_at">>) {
  const { error } = await db().from("clients").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
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
