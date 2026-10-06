// Journal des corrections (table action_log, migration 0020).
import { createClient } from "@supabase/supabase-js";
import type { Fix } from "@/lib/audit/types";
import type { Undo } from "./apply";

export const UNDO_DAYS = 30;

export interface ActionLog {
  id: string;
  workspace_id?: string | null;
  customer_id: string;
  account_name: string | null;
  constat_id: string | null;
  title: string;
  summary: string;
  fix: Fix;
  undo: Undo | null;
  status: "done" | "undone" | "failed";
  error: string | null;
  author: string | null;
  created_at: string;
  undone_at: string | null;
}

function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase non configuré.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const canUndo = (a: ActionLog, now = Date.now()) =>
  a.status === "done" && !!a.undo && now - Date.parse(a.created_at) < UNDO_DAYS * 864e5;

export async function listActions(customerId?: string, limit = 200): Promise<ActionLog[]> {
  let q = db().from("action_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (customerId) q = q.eq("customer_id", customerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ActionLog[];
}

export async function getAction(id: string): Promise<ActionLog | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from("action_log").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ActionLog) ?? null;
}

export async function logAction(row: Omit<ActionLog, "id" | "created_at" | "undone_at">): Promise<string> {
  const { data, error } = await db().from("action_log").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function markUndone(id: string): Promise<void> {
  const { error } = await db().from("action_log").update({ status: "undone", undone_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
