// Historique des simulations de Prévisions : paramètres (pour relancer), résumé chiffré,
// brouillon de campagne (structure, annonces, extensions) et contenu de landing page.
// Stocké dans app_settings (clé "simulations"), sans migration.
import { getSetting, setSetting } from "@/lib/agent/store";
import type { LandingBrief } from "./landing";

export interface BuilderDraft {
  name: string; budget: string; bidding: string; maxCpc: string; match: string; url: string; geoSel: string[];
  groups: { name: string; keywords: string; headlines: string; descriptions: string; path1: string; path2: string }[];
  negatives: string; notes: string; phone: string; sitelinks: string; callouts: string; sched: string;
  landingOn: boolean; landingUrl: string; landing: LandingBrief | null;
}
export interface SimSummary { keywords: number; searches: number; cpc: number | null; monthly: number; leads: number | null; cpa: number | null; places: string }
export interface Simulation {
  id: string; name: string; at: string; updatedAt: string; query: string;
  clientId: string | null; clientName: string | null; summary: SimSummary; draft: BuilderDraft | null;
}

const KEY = "simulations";
const MAX = 40;

export async function listSimulations(): Promise<Simulation[]> {
  const v = await getSetting(KEY, null);
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? (a as Simulation[]) : []; } catch { return []; }
}
export async function getSimulation(id: string): Promise<Simulation | null> {
  return (await listSimulations()).find((s) => s.id === id) ?? null;
}
export async function upsertSimulation(sim: Omit<Simulation, "id" | "at" | "updatedAt"> & { id?: string | null }): Promise<Simulation> {
  const all = await listSimulations();
  const now = new Date().toISOString();
  const prev = sim.id ? all.find((s) => s.id === sim.id) : undefined;
  const saved: Simulation = { ...sim, id: prev?.id ?? crypto.randomUUID(), at: prev?.at ?? now, updatedAt: now };
  const next = [saved, ...all.filter((s) => s.id !== saved.id)].slice(0, MAX);
  await setSetting(KEY, JSON.stringify(next), null);
  return saved;
}
export async function deleteSimulation(id: string): Promise<void> {
  const all = await listSimulations();
  await setSetting(KEY, JSON.stringify(all.filter((s) => s.id !== id)), null);
}
