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

interface Ev { uri: string; name: string; start_time: string; status: string; location?: { type?: string; location?: string } }
interface Inv { name: string; email: string; status: string; text_reminder_number?: string | null; questions_and_answers?: { question: string; answer: string }[] }

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
      // Réponses du formulaire Calendly rangées dans la fiche (repérées par mots-clés de la question).
      const find = (re: RegExp) => qa.find((x) => re.test(x.question.toLowerCase()))?.answer.trim() ?? "";
      const company = find(/entreprise|soci[ée]t[ée]/);
      const siteAns = find(/site|facebook|lien/);
      const site = (siteAns || qa.map((x) => x.answer).join(" ")).match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[a-z]{2,}|[a-z0-9-]+\.(?:fr|com|net|org|eu)\b[^\s]*/i)?.[0] ?? null;
      const attente = find(/attendez|objectif|publicit[ée] vous/).toLowerCase();
      const objectif = /devis|appel/.test(attente) ? "Recevoir des demandes de devis ou des appels" : /vendre|vente/.test(attente) ? "Vendre en ligne" : /conna[iî]tre|notori/.test(attente) ? "Faire connaître la marque" : "";
      const answers: Record<string, string> = {};
      const act = find(/activit[ée]|m[ée]tier/); if (act) answers.activite = act;
      if (site) answers.site = site;
      if (objectif) answers.objectif = objectif;
      const deja = find(/d[ée]j[aà]|essay/); if (deja) answers.deja_teste = deja;
      // Telephone : lieu "J'appellerai l'invite" (outbound_call), sinon numero de rappel SMS, sinon une question.
      const phone = (ev.location?.type === "outbound_call" ? ev.location.location : "") || p.text_reminder_number || find(/t[ée]l[ée]phone|portable/);
      const clientName = company || name;
      if (company && names.has(company.toLowerCase())) { known++; continue; }
      const when = new Date(ev.start_time).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
      const id = await createClientRow(clientName, null);
      await updateClient(id, {
        contact_email: email || null,
        website: site && !/^https?:/i.test(site) ? `https://${site}` : site,
        answers,
        status: Object.keys(answers).length ? "brouillon" : "a_envoyer",
        notes: [`Rendez-vous Calendly « ${ev.name} » le ${when}, avec ${name}${email ? ` (${email})` : ""}${phone ? `, tél. ${phone}` : ""}.`, ...qa.map((x) => `${x.question} : ${x.answer}`)].join("\n").slice(0, 3000),
      });
      names.add(clientName.toLowerCase());
      created.push(clientName);
      if (email) emails.add(email);
      names.add(name.toLowerCase());
    }
  }
  return { events: evs.collection.length, created, known };
}
