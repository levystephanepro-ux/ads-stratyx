// Client Supabase "admin" (clé service_role) — contourne la RLS.
// Réservé au serveur MCP et aux route handlers appelés par Claude : ces requêtes
// n'ont PAS de session utilisateur (elles arrivent d'un token MCP), donc on
// identifie le workspace via le token puis on lit/écrit avec ce client.
// Ne JAMAIS importer ce fichier dans un composant navigateur.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
