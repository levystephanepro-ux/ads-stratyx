// Accès aux données Templates & Agents (Supabase, tables 0002).
//
// Phase mono-utilisateur : on utilise la clé service_role (hors RLS) côté serveur.
// L'accès est protégé au niveau des routes API par le token partagé.
//
// Repli gracieux : si Supabase n'est pas configuré, listTasks() retombe sur les
// missions codées en dur (lecture seule) pour que l'app ne casse jamais ; les
// écritures renvoient alors une erreur explicite.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MISSIONS } from "./missions";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  icon: string;
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  run_hour_utc: number;
  model: string;
  enabled: boolean;
  allow_write: boolean;
  last_run_at: string | null;
  last_status: string | null;
  workspace_id: string | null;
}

export function supabaseReady(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Client admin sans générique <Database> : autorise les tables 0002 sans avoir à
// régénérer database.types.ts.
function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function notReady(): never {
  throw new Error(
    "Base de données non configurée : ajoute NEXT_PUBLIC_SUPABASE_URL et " +
      "SUPABASE_SERVICE_ROLE_KEY dans Vercel, puis redéploie.",
  );
}

// ---------------- Templates ----------------

export async function listTemplates(): Promise<Template[]> {
  if (!supabaseReady()) return [];
  const { data, error } = await admin()
    .from("templates")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Template[];
}

export async function createTemplate(t: Omit<Template, "id">): Promise<Template> {
  if (!supabaseReady()) notReady();
  const { data, error } = await admin()
    .from("templates")
    .insert({
      name: t.name,
      description: t.description,
      category: t.category || "Général",
      prompt: t.prompt,
      icon: t.icon || "📋",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Template;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Omit<Template, "id">>,
): Promise<void> {
  if (!supabaseReady()) notReady();
  const { error } = await admin()
    .from("templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!supabaseReady()) notReady();
  const { error } = await admin().from("templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Agent tasks ----------------

/** Missions codées en dur → forme AgentTask (repli lecture seule). */
function fallbackTasks(): AgentTask[] {
  return MISSIONS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    prompt: m.prompt,
    category: "",
    frequency: m.frequency,
    day_of_week: m.dayOfWeek ?? null,
    day_of_month: null,
    run_hour_utc: 7,
    model: m.model ?? "claude-haiku-4-5-20251001",
    enabled: m.enabled,
    allow_write: m.allowWrite ?? false,
    last_run_at: null,
    last_status: null,
    workspace_id: null,
  }));
}

export async function listTasks(workspaceId?: string | null): Promise<AgentTask[]> {
  if (!supabaseReady()) return fallbackTasks();
  let q = admin().from("agent_tasks").select("*");
  if (workspaceId) {
    q = q.eq("workspace_id", workspaceId);
  } else {
    q = q.is("workspace_id", null);
  }
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentTask[];
}

/** Toutes les tâches, tous workspaces confondus (cron quotidien). */
export async function listAllTasks(): Promise<AgentTask[]> {
  if (!supabaseReady()) return fallbackTasks();
  const { data, error } = await admin()
    .from("agent_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentTask[];
}

export async function getTask(id: string, workspaceId?: string | null): Promise<AgentTask | null> {
  if (!supabaseReady()) return fallbackTasks().find((t) => t.id === id) ?? null;
  let q = admin().from("agent_tasks").select("*").eq("id", id);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AgentTask) ?? null;
}

export type NewTask = {
  name: string;
  description: string;
  prompt: string;
  category: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  run_hour_utc: number;
  model: string;
  enabled: boolean;
  allow_write: boolean;
};

export async function createTask(t: NewTask, workspaceId?: string | null): Promise<AgentTask> {
  if (!supabaseReady()) notReady();
  const { data, error } = await admin()
    .from("agent_tasks")
    .insert({ ...t, workspace_id: workspaceId ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentTask;
}

export async function updateTask(
  id: string,
  patch: Partial<NewTask>,
  workspaceId?: string | null,
): Promise<void> {
  if (!supabaseReady()) notReady();
  let q = admin()
    .from("agent_tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string, workspaceId?: string | null): Promise<void> {
  if (!supabaseReady()) notReady();
  let q = admin().from("agent_tasks").delete().eq("id", id);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function markTaskRun(id: string, status: string): Promise<void> {
  if (!supabaseReady()) return; // repli : pas de persistance
  await admin()
    .from("agent_tasks")
    .update({ last_run_at: new Date().toISOString(), last_status: status })
    .eq("id", id);
}

// ---------------- Réglages (clé/valeur) ----------------

export async function getSetting(key: string, workspaceId?: string | null): Promise<string | null> {
  if (!supabaseReady()) return null;
  try {
    let q = admin().from("app_settings").select("value").eq("key", key);
    if (workspaceId) {
      q = q.eq("workspace_id", workspaceId);
    } else {
      q = q.is("workspace_id", null);
    }
    const { data, error } = await q.maybeSingle();
    if (error) return null;
    return (data?.value as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string, workspaceId?: string | null): Promise<void> {
  if (!supabaseReady()) notReady();
  // Unicité (key, workspace_id) — index app_settings_key_ws_uniq (migration 0017).
  const { error } = await admin()
    .from("app_settings")
    .upsert(
      { key, value, workspace_id: workspaceId ?? null, updated_at: new Date().toISOString() },
      { onConflict: "key,workspace_id" },
    );
  if (error) throw new Error(error.message);
}

/** La tâche doit-elle tourner à cette date (cron quotidien 7h UTC) ? */
export function taskDue(t: AgentTask, date: Date): boolean {
  if (!t.enabled) return false;
  if (t.frequency === "daily") return true;
  if (t.frequency === "weekly") return date.getUTCDay() === (t.day_of_week ?? 1);
  if (t.frequency === "monthly") return date.getUTCDate() === (t.day_of_month ?? 1);
  return false;
}
