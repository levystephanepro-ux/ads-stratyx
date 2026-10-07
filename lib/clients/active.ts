// Client actif (cookie) : toutes les pages de l'owner travaillent sur son compte Google Ads.
import { cookies } from "next/headers";
import { getClient } from "./store";

export const ACTIVE_COOKIE = "stratyx_client";

export interface ActiveClient { id: string; name: string; customer_id: string | null }

export async function getActiveClient(): Promise<ActiveClient | null> {
  try {
    const id = (await cookies()).get(ACTIVE_COOKIE)?.value;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const c = await getClient(id);
    return c ? { id: c.id, name: c.name, customer_id: c.customer_id } : null;
  } catch {
    return null; // hors requête (cron) ou base indisponible
  }
}

export async function setActiveClientCookie(id: string | null) {
  const jar = await cookies();
  if (!id) jar.delete(ACTIVE_COOKIE);
  else jar.set(ACTIVE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
}
