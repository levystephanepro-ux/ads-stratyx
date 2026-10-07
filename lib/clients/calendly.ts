// Import des rendez-vous Calendly (API v2, jeton personnel CALENDLY_TOKEN).
// Lecture seule : GET, disponible sur toutes les offres Calendly (pas de webhook).
import { createClientRow, updateClient, listClients } from "./store";

const API = "https://api.calendly.com";
async function get<T>(path: string): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.CALENDLY_TOKEN}`, "Content-Type": "application/json" }, cache: "no-store",
  });
  if (res.status === 401) throw new Error("Jeton Calendly refusé : vérifie CALENDLY_TOKEN sur Vercel.");
  if (!res.ok) throw new Error(`Calendly ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

interface Ev { uri: string; name: string; start_time: string; status: string }
interface Inv { name: string; email: string; status: string; questions_and_answers?: { question: string; answer: string }[] }

export interface ImportResult { events: number; created: string[]; known: number }

export async function importCalendly(daysBack = 30, daysAhead = 60): Promise<ImportResult> {
  if (!process.env.CALENDLY_TOKEN) throw new Error("CALENDLY_TOKEN absent sur Vercel.");
  const me = await get<{ resource: { uri: string } }>("/users/me");
  const min = new Date(Date.now() - daysBack * 864e5).toISOString();
  const max = new Date(Date.now() + daysAhead * 864e5).toISOString();
  const q = new URLSearchParams({ user: me.resource.uri, min_start_time: min, max_start_time: max, status: "active", count: "100", sort: "start_time:asc" });
  const evs = await get<{ collection: Ev[] }>(`/scheduled_events?${q}`);
  const existing = await listClients();
  const emails = new Set(existing.map((c) => (c.contact_email ?? "").toLowerCase()).filter(Boolean));
  const names = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const created: string[] = [];
  let known = 0;
  for (const ev of evs.collection) {
    const uuid = ev.uri.split("/").pop();
    const inv = await get<{ collection: Inv[] }>(`/scheduled_events/${uuid}/invitees?count=50`);
    for (const p of inv.collection.filter((x) => x.status === "active")) {
      const email = (p.email ?? "").toLowerCase();
      const name = (p.name ?? "").trim() || email;
      if ((email && emails.has(email)) || names.has(name.toLowerCase())) { known++; continue; }
      const qa = (p.questions_and_answers ?? []).filter((x) => x.answer?.trim());
      const site = qa.map((x) => x.answer).join(" ").match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[a-z]{2,}/i)?.[0] ?? null;
      const when = new Date(ev.start_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
      const id = await createClientRow(name, null);
      await updateClient(id, {
        contact_email: email || null,
        website: site,
        notes: [`Rendez-vous Calendly « ${ev.name} » le ${when}.`, ...qa.map((x) => `${x.question} : ${x.answer}`)].join("\n").slice(0, 3000),
      });
      emails.add(email); names.add(name.toLowerCase());
      created.push(name);
    }
  }
  return { events: evs.collection.length, created, known };
}
