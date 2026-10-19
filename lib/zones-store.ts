// Accès base des zones d'exclusivité (migration 0024), service_role, serveur seulement.
// Une erreur de lecture est propagée : l'appelant doit alors répondre « inconnue », jamais « libre ».
import { createClient } from "@supabase/supabase-js";
import {
  activiteReconnue, controleZone, distanceKm, zonesAExpirer,
  type StatutZone, type ZoneOccupee,
} from "@/lib/zones";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface LigneZone {
  id: string; client_id: string | null; activite: string; lat: number; lng: number;
  rayon_km: number | string; statut: StatutZone; expire_le: string | null;
}

const COLONNES = "id, client_id, activite, lat, lng, rayon_km, statut, expire_le";

function versZone(r: LigneZone): ZoneOccupee {
  return {
    activite: r.activite, lat: Number(r.lat), lng: Number(r.lng), rayonKm: Number(r.rayon_km),
    statut: r.statut, expireLe: r.expire_le, clientId: r.client_id,
  };
}

/** Zones susceptibles de bloquer une activité (le contrôle écarte ensuite les zones expirées). */
export async function zonesOccupees(activite: string): Promise<ZoneOccupee[]> {
  const act = activiteReconnue(activite);
  if (!act) return [];
  const { data, error } = await db()
    .from("zones_exclusives").select(COLONNES)
    .eq("activite", act).in("statut", ["gardee", "reserve", "actif", "liberation"]);
  if (error) throw new Error(`zones illisibles : ${error.message}`);
  return ((data ?? []) as LigneZone[]).map(versZone);
}

export interface ZoneLiberee { id: string; activite: string; lat: number; lng: number; rayonKm: number }
export interface AttenteConcernee {
  activite: string; adresse: string; rayonKm: number; rayonMaxKm: number | undefined; etat: "libre" | "partielle"; clientId: string | null;
}

/** Passe à « libere » les zones gardées ou en libération dont la date est dépassée. */
export async function expirerZones(maintenant: Date = new Date()): Promise<ZoneLiberee[]> {
  const { data, error } = await db()
    .from("zones_exclusives").select(COLONNES).in("statut", ["gardee", "liberation"]);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as LigneZone[]).map((r) => ({ id: r.id, statut: r.statut, expireLe: r.expire_le, r }));
  const aLiberer = zonesAExpirer(rows, maintenant);
  if (!aLiberer.length) return [];
  // Filtre sur le statut : une zone passée à « reserve » entre-temps n'est jamais libérée.
  const { data: maj, error: e2 } = await db()
    .from("zones_exclusives").update({ statut: "libere" })
    .in("id", aLiberer.map((z) => z.id)).in("statut", ["gardee", "liberation"]).select("id");
  if (e2) throw new Error(e2.message);
  const ok = new Set((maj ?? []).map((m: { id: string }) => m.id));
  return aLiberer.filter((z) => ok.has(z.id)).map(({ r }) => ({
    id: r.id, activite: r.activite, lat: Number(r.lat), lng: Number(r.lng), rayonKm: Number(r.rayon_km),
  }));
}

/** Entrées de la liste d'attente qui peuvent obtenir (tout ou partie de) leur zone après une libération. */
export async function attenteConcernee(liberees: ZoneLiberee[], maintenant: Date = new Date()): Promise<AttenteConcernee[]> {
  if (!liberees.length) return [];
  const activites = [...new Set(liberees.map((z) => z.activite))];
  const { data, error } = await db()
    .from("zones_attente").select("activite, adresse, lat, lng, rayon_km, client_id").in("activite", activites);
  if (error) throw new Error(error.message);
  const occupees = new Map<string, ZoneOccupee[]>();
  const res: AttenteConcernee[] = [];
  for (const a of (data ?? []) as { activite: string; adresse: string; lat: number; lng: number; rayon_km: number | string; client_id: string | null }[]) {
    const p = { lat: Number(a.lat), lng: Number(a.lng) };
    const rayon = Number(a.rayon_km);
    if (!liberees.some((z) => z.activite === a.activite && distanceKm(p, z) < rayon + z.rayonKm)) continue;
    if (!occupees.has(a.activite)) occupees.set(a.activite, await zonesOccupees(a.activite));
    const c = controleZone(a.activite, p, rayon, occupees.get(a.activite)!, { maintenant });
    if (c.etat === "libre" || c.etat === "partielle") {
      res.push({ activite: a.activite, adresse: a.adresse, rayonKm: rayon, rayonMaxKm: c.rayonMaxKm, etat: c.etat, clientId: a.client_id });
    }
  }
  return res;
}

/** Inscription d'un prospect sur la liste d'attente d'une zone prise. */
export async function ajouterAttente(e: { activite: string; adresse: string; lat: number; lng: number; rayonKm: number; clientId: string }): Promise<void> {
  const act = activiteReconnue(e.activite);
  if (!act) throw new Error("activité non reconnue");
  const { error } = await db().from("zones_attente").insert({
    activite: act, adresse: e.adresse, lat: e.lat, lng: e.lng, rayon_km: e.rayonKm, client_id: e.clientId,
  });
  if (error) throw new Error(error.message);
}
