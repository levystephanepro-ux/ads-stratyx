// Bilan de santé de l'installation : vérifications en LECTURE SEULE (rien n'est créé ni modifié).
// La création de campagne est testée en validateOnly : Google vérifie sans rien enregistrer.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { isLive } from "@/lib/google-ads/config";
import { listManagedAccounts, searchRaw } from "@/lib/google-ads/client";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { keywordIdeas, suggestGeo } from "@/lib/planner/ideas";
import { createPausedSearchCampaign, type CampaignSpec } from "@/lib/planner/create";
import { latestAuditReports } from "@/lib/audit/run";
import { lastAlertsRun } from "@/lib/alerts/run";

export type Status = "ok" | "warn" | "fail" | "skip";
export interface Check { group: string; label: string; status: Status; detail: string; ms?: number }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 400);
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Pas de réponse en ${ms / 1000} s`)), ms))]);
}
async function run(group: string, label: string, fn: () => Promise<{ status: Status; detail: string }>, ms = 25000): Promise<Check> {
  const t = Date.now();
  try { return { group, label, ...(await withTimeout(fn(), ms)), ms: Date.now() - t }; }
  catch (e) { return { group, label, status: "fail", detail: msg(e), ms: Date.now() - t }; }
}

const ENV: { name: string; need: "requis" | "conseillé"; why: string }[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", need: "requis", why: "base de données" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", need: "requis", why: "base de données (serveur)" },
  { name: "ADS_DATA_MODE", need: "requis", why: "live en production" },
  { name: "GOOGLE_ADS_DEVELOPER_TOKEN", need: "requis", why: "API Google Ads" },
  { name: "GOOGLE_ADS_OAUTH_CLIENT_ID", need: "requis", why: "connexion Google" },
  { name: "GOOGLE_ADS_OAUTH_CLIENT_SECRET", need: "requis", why: "connexion Google" },
  { name: "GOOGLE_ADS_REFRESH_TOKEN", need: "requis", why: "accès à tes comptes" },
  { name: "GOOGLE_ADS_LOGIN_CUSTOMER_ID", need: "requis", why: "identifiant du MCC" },
  { name: "ANTHROPIC_API_KEY", need: "requis", why: "IA (Copilote, structure, persona)" },
  { name: "CRON_SECRET", need: "requis", why: "tâches du matin" },
  { name: "STRATYX_INTERNAL_MODE", need: "conseillé", why: "usage interne" },
  { name: "RESEND_API_KEY", need: "conseillé", why: "emails du matin et du lundi" },
  { name: "AGENT_EMAIL_TO", need: "conseillé", why: "destinataire des emails" },
  { name: "AGENT_EMAIL_FROM", need: "conseillé", why: "expéditeur des emails" },
  { name: "OWNER_MONTHLY_BUDGET_EUR", need: "conseillé", why: "plafond IA mensuel" },
];

export async function healthChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Variables d'environnement (présence seulement, jamais la valeur)
  for (const e of ENV) {
    const v = process.env[e.name];
    checks.push({ group: "Configuration", label: e.name, status: v ? "ok" : e.need === "requis" ? "fail" : "warn", detail: v ? `présente · ${e.why}` : `absente · ${e.why}` });
  }
  if (process.env.ADS_DATA_MODE && process.env.ADS_DATA_MODE !== "live") checks.push({ group: "Configuration", label: "Mode des données", status: "warn", detail: `ADS_DATA_MODE=${process.env.ADS_DATA_MODE} : données factices.` });
  const from = process.env.AGENT_EMAIL_FROM ?? "";
  if (from && /resend\.dev/i.test(from)) checks.push({ group: "Configuration", label: "Expéditeur des emails", status: "warn", detail: "Adresse de test Resend : les emails ne partent que vers l'adresse de ton compte Resend. Vérifie un domaine (stratyxmedia.fr) avant d'envoyer à des clients." });

  // 2. Base de données : chaque table utilisée
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const TABLES: [string, string][] = [["app_settings", "réglages et contexte IA"], ["audit_reports", "diagnostics (0018)"], ["report_folders", "dossiers de rapports (0019)"], ["client_reports", "rapports clients (0019)"], ["action_log", "journal des corrections (0020)"], ["clients", "fiches clients (0021)"]];
  checks.push(...await Promise.all(TABLES.map(([t, why]) => run("Base de données", t, async () => {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) return { status: "fail" as Status, detail: `${why} : ${error.message}. Lance la migration correspondante.` };
    return { status: "ok" as Status, detail: `${why} · ${count ?? 0} ligne(s)` };
  }, 10000))));

  // 3. Google Ads
  if (!isLive()) {
    checks.push({ group: "Google Ads", label: "Mode live", status: "skip", detail: "Mode démo : tests Google Ads ignorés." });
  } else {
    let account: string | null = null;
    checks.push(await run("Google Ads", "Comptes accessibles", async () => {
      const list = await listManagedAccounts();
      const direct = list.filter((a) => a.source === "direct").length;
      return { status: list.length ? "ok" : "fail", detail: `${list.length} compte(s)${direct ? `, dont ${direct} en accès direct hors MCC` : ""}.` };
    }));
    checks.push(await run("Google Ads", "Compte par défaut", async () => {
      const info = await getAccountsInfo({ workspaceId: null, isOwner: true });
      account = info.defaultCustomerId ?? info.accounts[0]?.customerId ?? null;
      if (!account) return { status: "fail", detail: "Aucun compte par défaut." };
      const r = await searchRaw({ customerId: account }, "SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1");
      const c = r[0]?.customer ?? {};
      return { status: "ok", detail: `${c.descriptiveName ?? account} (${account}) · ${c.currencyCode ?? "?"} · ${c.timeZone ?? "?"}` };
    }));
    if (account) {
      const acc: string = account;
      const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "");
      if (login && login === acc) checks.push({ group: "Google Ads", label: "Identifiant MCC", status: "warn", detail: "GOOGLE_ADS_LOGIN_CUSTOMER_ID est égal au compte par défaut : vérifie que c'est bien l'identifiant du MCC et pas celui d'un client." });
      const [hist, planner, geo, mutate] = await Promise.all([
        run("Google Ads", "Historique des modifications (rapports, Change Impact)", async () => {
          const since = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
          const today = new Date().toISOString().slice(0, 10);
          const r = await searchRaw({ customerId: acc }, `SELECT change_event.change_date_time FROM change_event WHERE change_event.change_date_time >= '${since}' AND change_event.change_date_time <= '${today} 23:59:59' LIMIT 5`);
          return { status: "ok", detail: `lecture OK (${r.length} modification(s) récente(s) lue(s)).` };
        }),
        run("Google Ads", "Planificateur de mots-clés (Prévisions, audit prospect)", async () => {
          try {
            const ideas = await keywordIdeas(acc, ["fenêtre pvc"], ["2250"]);
            return { status: ideas.length ? "ok" : "warn", detail: ideas.length ? `${ideas.length} idée(s), ex. « ${ideas[0].text} » ${ideas[0].searches} rech./mois.` : "Aucune idée renvoyée." };
          } catch (e) {
            const m = msg(e);
            if (/DEVELOPER_TOKEN|not approved|test account|basic access|PERMISSION/i.test(m)) return { status: "fail", detail: `Accès refusé : ton token développeur doit avoir l'accès Basic (ou Standard) pour le planificateur. Demande-le dans le Centre API du MCC. (${m.slice(0, 160)})` };
            throw e;
          }
        }),
        run("Google Ads", "Recherche de lieux", async () => {
          const g = await suggestGeo(["Toulon"]);
          return { status: g.length ? "ok" : "warn", detail: g.length ? `${g[0].name} (${g[0].type}, id ${g[0].id}).` : "Aucun lieu trouvé." };
        }),
        run("Google Ads", "Création de campagne avec extensions (simulation)", async () => {
          const spec: CampaignSpec = {
            name: `Test santé Stratyx ${Date.now()}`, dailyBudget: 5, bidding: "MAXIMIZE_CLICKS", maxCpc: null, geoIds: ["2250"], matchType: "PHRASE",
            finalUrl: "https://www.stratyxmedia.fr/", negatives: ["gratuit"],
            groups: [{ name: "Groupe test", keywords: ["test stratyx"], headlines: ["Titre de test un", "Titre de test deux", "Titre de test trois"], descriptions: ["Description de test numéro un.", "Description de test numéro deux."] }],
            extensions: {
              phone: "04 94 00 00 00",
              sitelinks: [{ text: "Nous contacter", desc1: "Réponse rapide", desc2: "Devis sans engagement", url: "https://www.stratyxmedia.fr/" }],
              callouts: ["Devis gratuit"],
              schedule: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 19 },
            },
          };
          await createPausedSearchCampaign(acc, spec, true);
          return { status: "ok", detail: "Google a validé budget, campagne, lieux, négatifs, groupe, annonce, liens annexes, accroche, appel et horaires. Rien n'a été créé." };
        }, 40000),
      ]);
      checks.push(hist, planner, geo, mutate);
    }
  }

  // 4. IA
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const models: [string, string[]][] = [
      ["Modèle Sonnet (structure de campagne)", [process.env.BUILDER_MODEL ?? "claude-sonnet-5-5", "claude-sonnet-4-6"]],
      ["Modèle Opus (option)", [process.env.BUILDER_MODEL_OPUS ?? "claude-opus-5-5", "claude-opus-4-6"]],
    ];
    checks.push(...await Promise.all(models.map(([label, chain]) => run("IA", label, async () => {
      const tried: string[] = [];
      for (const m of [...new Set(chain)]) {
        try { await client.messages.create({ model: m, max_tokens: 1, messages: [{ role: "user", content: "ok" }] }); return { status: (tried.length ? "warn" : "ok") as Status, detail: tried.length ? `${m} utilisé (${tried.join(", ")} indisponible).` : `${m} disponible.` }; }
        catch (e) { if (!/model|not_found|404/i.test(msg(e))) throw e; tried.push(m); }
      }
      return { status: "fail" as Status, detail: `Aucun modèle disponible : ${tried.join(", ")}.` };
    }, 20000))));
  }

  // 5. Tâches automatiques
  checks.push(await run("Tâches du matin", "Dernier diagnostic automatique", async () => {
    const r = await latestAuditReports();
    const last = r.map((x) => x.created_at ?? x.run_date).sort().pop();
    if (!last) return { status: "warn", detail: "Aucun diagnostic enregistré pour l'instant." };
    const h = (Date.now() - new Date(last).getTime()) / 36e5;
    return { status: h < 30 ? "ok" : "warn", detail: `il y a ${Math.round(h)} h (${r.length} compte(s))${h >= 30 ? " : la tâche de 5 h UTC n'a peut-être pas tourné, regarde Vercel > Cron Jobs." : "."}` };
  }, 10000));
  checks.push(await run("Tâches du matin", "Dernières alertes", async () => {
    const a = await lastAlertsRun();
    if (!a) return { status: "warn", detail: "Aucun passage enregistré pour l'instant." };
    const h = (Date.now() - new Date(a.ranAt).getTime()) / 36e5;
    return { status: h < 30 ? "ok" : "warn", detail: `il y a ${Math.round(h)} h, ${a.accounts.length} compte(s), ${a.accounts.reduce((n, x) => n + x.alerts.length, 0)} alerte(s).` };
  }, 10000));

  return checks;
}
