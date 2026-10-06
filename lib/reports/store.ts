// Dossiers et rapports clients (Supabase, clé service_role).
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export interface Folder { id: string; name: string; customer_id: string | null; created_at: string }
export interface ClientReport {
  id: string; folder_id: string | null; customer_id: string; account_name: string | null; title: string | null;
  template: string; mode: string; theme: string; period: string; compare: boolean; client_period: boolean;
  intro: string | null; analysis: string | null; optimisations: string | null; sections: string[];
  share_token: string; author: string | null; created_at: string; updated_at: string;
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listFolders(): Promise<Folder[]> {
  const { data } = await db().from("report_folders").select("id, name, customer_id, created_at").is("workspace_id", null).order("name");
  return (data ?? []) as Folder[];
}
export async function createFolder(name: string, customerId: string | null) {
  const { data, error } = await db().from("report_folders").insert({ name, customer_id: customerId }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
export async function listReports(): Promise<ClientReport[]> {
  const { data } = await db().from("client_reports").select("*").is("workspace_id", null).order("updated_at", { ascending: false });
  return (data ?? []) as ClientReport[];
}
export async function getReport(id: string): Promise<ClientReport | null> {
  const { data } = await db().from("client_reports").select("*").eq("id", id).maybeSingle();
  return data as ClientReport | null;
}
export async function getReportByToken(token: string): Promise<ClientReport | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const { data } = await db().from("client_reports").select("*").eq("share_token", token).maybeSingle();
  return data as ClientReport | null;
}
export async function saveReport(r: Partial<ClientReport> & { customer_id: string }): Promise<string> {
  const row = { ...r, updated_at: new Date().toISOString() };
  if (r.id) {
    const { error } = await db().from("client_reports").update(row).eq("id", r.id);
    if (error) throw new Error(error.message);
    return r.id;
  }
  const { data, error } = await db().from("client_reports").insert({ ...row, share_token: randomBytes(18).toString("base64url") }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
export async function deleteReport(id: string) {
  await db().from("client_reports").delete().eq("id", id);
}
