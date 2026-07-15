// Outils exposés à Claude via MCP. Chaque outil a un schéma d'entrée (JSON Schema)
// et un handler qui renvoie du texte. On garde les sorties lisibles par un humain
// ET exploitables par Claude (tableaux markdown + chiffres clés).
import {
  getAccount,
  listCampaigns,
  getCampaignMetrics,
  getSearchTerms,
  listAdGroups,
  listManagedAccounts,
  setCampaignStatus,
  updateCampaignBudget,
  type AdsContext,
} from "@/lib/google-ads/client";
import { isLive } from "@/lib/google-ads/config";
import type { WorkspaceContext } from "./auth";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_ads_accounts",
    description:
      "Liste les comptes Google Ads connectés à cet espace (nom, devise, fuseau). " +
      "Utilise-le pour savoir quels comptes sont pilotables.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_campaigns",
    description:
      "Liste les campagnes d'un compte Google Ads : nom, statut, type (Search, " +
      "PMax, Shopping…) et budget quotidien.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description:
            "ID du compte (sans tirets). Facultatif : le compte par défaut est utilisé si absent.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_campaign_performance",
    description:
      "Performance des campagnes sur une période : impressions, clics, coût, " +
      "conversions, valeur, plus les KPI calculés CTR, CPC, CPA et ROAS. " +
      "Idéal pour un audit ou détecter les campagnes qui drainent le budget.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "ID du compte (facultatif, défaut = compte par défaut).",
        },
        since: {
          type: "string",
          description: "Date de début ISO YYYY-MM-DD (défaut : il y a 30 jours).",
        },
        until: {
          type: "string",
          description: "Date de fin ISO YYYY-MM-DD (défaut : aujourd'hui).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_search_terms",
    description:
      "Termes de recherche réels ayant déclenché les annonces, avec clics, coût et " +
      "conversions. Sert à repérer les requêtes qui gaspillent le budget (à exclure).",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        since: { type: "string", description: "Début ISO YYYY-MM-DD (défaut -30j)." },
        until: { type: "string", description: "Fin ISO YYYY-MM-DD (défaut aujourd'hui)." },
        limit: { type: "number", description: "Nombre max de termes (défaut 30)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_ad_groups",
    description:
      "Groupes d'annonces d'un compte avec coût et conversions sur la période. " +
      "Utile pour repérer les ad groups qui drainent sans convertir.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        since: { type: "string", description: "Début ISO YYYY-MM-DD (défaut -30j)." },
        until: { type: "string", description: "Fin ISO YYYY-MM-DD (défaut aujourd'hui)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_campaign_status",
    description:
      "ÉCRITURE : met une campagne en pause ou l'active. Action réelle sur le compte. " +
      "Demande TOUJOURS confirmation à l'utilisateur, puis rappelle avec confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", description: "ID de la campagne (obligatoire)." },
        status: { type: "string", enum: ["ENABLED", "PAUSED"], description: "Nouvel état." },
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        confirm: {
          type: "boolean",
          description: "Doit valoir true pour appliquer. Sans lui, l'outil ne fait que prévisualiser.",
        },
      },
      required: ["campaign_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_campaign_budget",
    description:
      "ÉCRITURE : change le budget quotidien d'une campagne (en devise du compte). " +
      "Action réelle. Demande TOUJOURS confirmation, puis rappelle avec confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", description: "ID de la campagne (obligatoire)." },
        daily_budget: { type: "number", description: "Nouveau budget quotidien (ex. 50 pour 50 €)." },
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        confirm: {
          type: "boolean",
          description: "Doit valoir true pour appliquer. Sans lui, l'outil ne fait que prévisualiser.",
        },
      },
      required: ["campaign_id", "daily_budget"],
      additionalProperties: false,
    },
  },
];

// --- Helpers de formatage ---
const eur = (n: number, cur = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(n);
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const pct = (n: number) => `${(n * 100).toFixed(2)} %`;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Choisit le compte cible : celui demandé, sinon le compte par défaut du workspace. */
function resolveContext(
  ws: WorkspaceContext,
  customerId?: string,
): AdsContext {
  if (customerId) {
    const found = ws.connections.find((c) => c.customerId === customerId);
    return {
      customerId,
      refreshToken: found?.refreshToken ?? null,
    };
  }
  const def =
    ws.connections.find((c) => c.isDefault) ?? ws.connections[0] ?? null;
  return {
    customerId: def?.customerId ?? "0000000000",
    refreshToken: def?.refreshToken ?? null,
  };
}

type ToolResult = { text: string };

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ws: WorkspaceContext,
): Promise<ToolResult> {
  switch (name) {
    case "list_ads_accounts":
      return listAccountsTool(ws);
    case "list_campaigns":
      return listCampaignsTool(ws, args.customer_id as string | undefined);
    case "get_campaign_performance":
      return performanceTool(
        ws,
        args.customer_id as string | undefined,
        args.since as string | undefined,
        args.until as string | undefined,
      );
    case "get_search_terms":
      return searchTermsTool(
        ws,
        args.customer_id as string | undefined,
        args.since as string | undefined,
        args.until as string | undefined,
        args.limit as number | undefined,
      );
    case "list_ad_groups":
      return adGroupsTool(
        ws,
        args.customer_id as string | undefined,
        args.since as string | undefined,
        args.until as string | undefined,
      );
    case "set_campaign_status":
      return setStatusTool(ws, args);
    case "update_campaign_budget":
      return updateBudgetTool(ws, args);
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

async function listAccountsTool(ws: WorkspaceContext): Promise<ToolResult> {
  // En live, on liste tous les comptes gérés sous le MCC (Claude peut alors
  // cibler n'importe lequel via customer_id).
  if (isLive()) {
    const accounts = await listManagedAccounts();
    const rows = accounts
      .map((a) => `| ${a.name} | ${a.customerId} | ${a.currencyCode ?? "—"} |`)
      .join("\n");
    return {
      text:
        `Comptes gérés (${accounts.length}) :\n\n` +
        `| Compte | ID | Devise |\n|---|---|---|\n${rows}\n\n` +
        `Passe l'ID voulu en \`customer_id\` aux autres outils pour cibler un compte.`,
    };
  }

  // Si des comptes sont connectés en base, on les liste. Sinon (démo mock),
  // on interroge la façade qui renvoie le compte factice.
  if (ws.connections.length > 0) {
    // Enrichit les comptes dont les métadonnées manquent (ex. raccourci env) via
    // un appel réel, pour afficher nom/devise/fuseau plutôt que "—".
    const enriched = await Promise.all(
      ws.connections.map(async (c) => {
        if (c.descriptiveName) return c;
        try {
          const acc = await getAccount({
            customerId: c.customerId,
            refreshToken: c.refreshToken,
          });
          return {
            ...c,
            descriptiveName: acc.descriptiveName,
            currencyCode: acc.currencyCode,
            timeZone: acc.timeZone,
          };
        } catch {
          return c;
        }
      }),
    );
    const rows = enriched
      .map(
        (c) =>
          `| ${c.descriptiveName ?? "—"} | ${c.customerId} | ${c.currencyCode ?? "—"} | ${c.timeZone ?? "—"} | ${c.isDefault ? "✅" : ""} |`,
      )
      .join("\n");
    return {
      text:
        `Comptes Google Ads connectés (${ws.connections.length}) :\n\n` +
        `| Compte | ID | Devise | Fuseau | Défaut |\n|---|---|---|---|---|\n${rows}`,
    };
  }
  const acc = await getAccount(resolveContext(ws));
  return {
    text:
      `1 compte (démo) :\n\n| Compte | ID | Devise | Fuseau |\n|---|---|---|---|\n` +
      `| ${acc.descriptiveName} | ${acc.customerId} | ${acc.currencyCode} | ${acc.timeZone} |`,
  };
}

async function listCampaignsTool(
  ws: WorkspaceContext,
  customerId?: string,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, customerId);
  const campaigns = await listCampaigns(ctx);
  const rows = campaigns
    .map(
      (c) =>
        `| ${c.name} | ${c.channel} | ${c.status} | ${eur(c.dailyBudget)} |`,
    )
    .join("\n");
  return {
    text:
      `Campagnes du compte ${ctx.customerId} (${campaigns.length}) :\n\n` +
      `| Campagne | Type | Statut | Budget/jour |\n|---|---|---|---|\n${rows}`,
  };
}

async function performanceTool(
  ws: WorkspaceContext,
  customerId?: string,
  since?: string,
  until?: string,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(0) };
  const metrics = await getCampaignMetrics(ctx, range);
  const acc = await getAccount(ctx);
  const cur = acc.currencyCode;

  let tImpr = 0,
    tClicks = 0,
    tCost = 0,
    tConv = 0,
    tValue = 0;

  const rows = metrics
    .map((m) => {
      tImpr += m.impressions;
      tClicks += m.clicks;
      tCost += m.cost;
      tConv += m.conversions;
      tValue += m.conversionsValue;
      const ctr = m.impressions ? m.clicks / m.impressions : 0;
      const cpc = m.clicks ? m.cost / m.clicks : 0;
      const cpa = m.conversions ? m.cost / m.conversions : 0;
      const roas = m.cost ? m.conversionsValue / m.cost : 0;
      return `| ${m.campaignName} | ${int(m.impressions)} | ${int(m.clicks)} | ${pct(ctr)} | ${eur(cpc, cur)} | ${eur(m.cost, cur)} | ${int(m.conversions)} | ${m.conversions ? eur(cpa, cur) : "—"} | ${m.cost ? roas.toFixed(2) + "×" : "—"} |`;
    })
    .join("\n");

  const totCpa = tConv ? tCost / tConv : 0;
  const totRoas = tCost ? tValue / tCost : 0;

  return {
    text:
      `Performance — compte ${ctx.customerId} · ${range.since} → ${range.until}\n\n` +
      `| Campagne | Impr. | Clics | CTR | CPC | Coût | Conv. | CPA | ROAS |\n` +
      `|---|---|---|---|---|---|---|---|---|\n${rows}\n\n` +
      `**Total** — Coût ${eur(tCost, cur)} · Conv. ${int(tConv)} · ` +
      `Valeur ${eur(tValue, cur)} · CPA ${eur(totCpa, cur)} · ROAS ${totRoas.toFixed(2)}×`,
  };
}

async function searchTermsTool(
  ws: WorkspaceContext,
  customerId?: string,
  since?: string,
  until?: string,
  limit?: number,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(0) };
  const terms = await getSearchTerms(ctx, range, limit ?? 30);
  const acc = await getAccount(ctx);
  if (terms.length === 0) {
    return { text: `Aucun terme de recherche sur la période (compte ${ctx.customerId}). ` +
      `Normal pour un compte sans campagne Search active.` };
  }
  const rows = terms
    .map((t) => `| ${t.term} | ${t.campaignName} | ${int(t.clicks)} | ${eur(t.cost, acc.currencyCode)} | ${int(t.conversions)} |`)
    .join("\n");
  return {
    text:
      `Termes de recherche — compte ${ctx.customerId} · ${range.since} → ${range.until}\n\n` +
      `| Terme | Campagne | Clics | Coût | Conv. |\n|---|---|---|---|---|\n${rows}`,
  };
}

async function adGroupsTool(
  ws: WorkspaceContext,
  customerId?: string,
  since?: string,
  until?: string,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(0) };
  const groups = await listAdGroups(ctx, range);
  const acc = await getAccount(ctx);
  if (groups.length === 0) {
    return { text: `Aucun groupe d'annonces sur la période (compte ${ctx.customerId}).` };
  }
  const rows = groups
    .map((g) => `| ${g.name} | ${g.campaignName} | ${g.status} | ${eur(g.cost, acc.currencyCode)} | ${int(g.conversions)} |`)
    .join("\n");
  return {
    text:
      `Groupes d'annonces — compte ${ctx.customerId} · ${range.since} → ${range.until}\n\n` +
      `| Ad group | Campagne | Statut | Coût | Conv. |\n|---|---|---|---|---|\n${rows}`,
  };
}

async function setStatusTool(
  ws: WorkspaceContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, args.customer_id as string | undefined);
  const campaignId = String(args.campaign_id);
  const status = args.status as "ENABLED" | "PAUSED";
  if (args.confirm !== true) {
    return {
      text:
        `⚠️ Confirmation requise. Action prévue : passer la campagne ${campaignId} ` +
        `du compte ${ctx.customerId} en **${status}**. ` +
        `Confirme avec l'utilisateur, puis rappelle set_campaign_status avec confirm=true.`,
    };
  }
  await setCampaignStatus(ctx, campaignId, status);
  return { text: `✅ Campagne ${campaignId} passée en ${status} (compte ${ctx.customerId}).` };
}

async function updateBudgetTool(
  ws: WorkspaceContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, args.customer_id as string | undefined);
  const campaignId = String(args.campaign_id);
  const budget = Number(args.daily_budget);
  const acc = await getAccount(ctx);
  if (args.confirm !== true) {
    return {
      text:
        `⚠️ Confirmation requise. Action prévue : régler le budget quotidien de la ` +
        `campagne ${campaignId} (compte ${ctx.customerId}) à **${eur(budget, acc.currencyCode)}**. ` +
        `Confirme avec l'utilisateur, puis rappelle update_campaign_budget avec confirm=true.`,
    };
  }
  await updateCampaignBudget(ctx, campaignId, budget);
  return {
    text: `✅ Budget de la campagne ${campaignId} réglé à ${eur(budget, acc.currencyCode)} (compte ${ctx.customerId}).`,
  };
}
