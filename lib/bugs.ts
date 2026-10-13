// Signalements de bugs envoyés depuis l'app (bouton « Signaler un bug »).
// Rangés dans app_settings (clé « bug_reports », JSON) : pas de migration.
import { getSetting, setSetting } from "@/lib/agent/store";

export interface BugReport {
  id: string;
  at: string;
  /** page d'où vient le signalement */
  page: string;
  text: string;
  email: string | null;
  account: string | null;
  done: boolean;
}

const KEY = "bug_reports";
const MAX = 200;

export async function listBugs(): Promise<BugReport[]> {
  const raw = await getSetting(KEY);
  try { const l = raw ? (JSON.parse(raw) as BugReport[]) : []; return Array.isArray(l) ? l : []; } catch { return []; }
}

export async function addBug(b: Omit<BugReport, "id" | "at" | "done">): Promise<BugReport> {
  const bug: BugReport = { ...b, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), done: false };
  const list = await listBugs();
  await setSetting(KEY, JSON.stringify([bug, ...list].slice(0, MAX)));
  return bug;
}

export async function setBugDone(id: string, done: boolean): Promise<void> {
  const list = await listBugs();
  await setSetting(KEY, JSON.stringify(list.map((b) => (b.id === id ? { ...b, done } : b))));
}

/** Texte prêt à coller dans une conversation avec Claude. */
export function bugsForClaude(list: BugReport[]): string {
  const open = list.filter((b) => !b.done);
  if (!open.length) return "Aucun bug ouvert.";
  return [
    `Bugs signalés dans ads-stratyx (${open.length} ouvert(s)) :`,
    "",
    ...open.map((b, i) => `${i + 1}. [${new Date(b.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })}] page ${b.page}${b.account ? ` · compte ${b.account}` : ""}${b.email ? ` · ${b.email}` : ""}\n   ${b.text.replace(/\n/g, "\n   ")}`),
  ].join("\n");
}
