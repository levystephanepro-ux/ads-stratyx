// Outils exposés à Claude via MCP. Chaque outil a un schéma d'entrée (JSON Schema)
// et un handler qui renvoie du texte. On garde les sorties lisibles par un humain
// ET exploitables par Claude (tableaux markdown + chiffres clés).
import {
  getAccount,
  listCampaigns,
  getCampaignMetrics,
  getSearchTerms,
  listAdGroups,
  listAds,
  listManagedAccounts,
  setCampaignStatus,
  updateCampaignBudget,
  searchRaw,
  type AdsContext,
} from "@/lib/google-ads/client";
import { isLive } from "@/lib/google-ads/config";
import { auditGridText, AUDIT_GRID, type AccountTag } from "@/lib/audit/criteria";
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
    name: "get_ads",
    description:
      "Annonces d'un compte (RSA surtout) : titres, descriptions, épinglage " +
      "(pinning), chemins d'URL, URL finale, ad strength, statut de validation, " +
      "plus impressions, clics, coût et conversions sur la période. Sert à auditer " +
      "le contenu des annonces. Filtre facultatif par campaign_id (recommandé sur " +
      "les gros comptes).",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        campaign_id: { type: "string", description: "ID de campagne pour filtrer (facultatif)." },
        since: { type: "string", description: "Début ISO YYYY-MM-DD (défaut -30j)." },
        until: { type: "string", description: "Fin ISO YYYY-MM-DD (défaut aujourd'hui)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_keywords",
    description:
      "Liste les mots-clés ACTIFS (texte, correspondance, groupe, Quality Score et ses 3 composantes — CTR attendu, " +
      "pertinence de l'annonce, expérience page —, coût, clics, conversions, CPC moyen comparé à l'estimation Google " +
      "pour le haut de page) " +
      "ET tous les mots-clés négatifs (campagne, groupe, listes partagées). À appeler AVANT de proposer un négatif, " +
      "pour vérifier qu'il ne bloque aucun mot-clé actif.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        since: { type: "string", description: "Date de début ISO YYYY-MM-DD." },
        until: { type: "string", description: "Date de fin ISO YYYY-MM-DD." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_campaign_diagnostics",
    description:
      "Diagnostic des campagnes sur la période : part d'impressions Search, part PERDUE faute de budget et part " +
      "perdue au CLASSEMENT (qualité/enchère), haut de page et 1re position, budget/jour, dépense réelle par jour, " +
      "stratégie d'enchères, CPA cible, réseaux (partenaires, Display) et ciblage géographique (présence ou intérêt). " +
      "À appeler AVANT de recommander une hausse de budget : si la part perdue au classement dépasse la part perdue " +
      "au budget, le frein est la qualité ou l'enchère, pas le budget.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "ID du compte (facultatif)." },
        since: { type: "string", description: "Début ISO YYYY-MM-DD (défaut -30j)." },
        until: { type: "string", description: "Fin ISO YYYY-MM-DD (défaut hier)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_assets_status",
    description:
      "Extensions et composants (appel, liens annexes, accroches, extraits structurés, nom et logo d'entreprise…) " +
      "rattachés aux campagnes actives et au compte, avec leur statut de validation Google (refusé, limité, approuvé) " +
      "et le motif. Signale aussi les types manquants. Une extension d'appel refusée coupe les appels : à vérifier dans tout bilan.",
    inputSchema: {
      type: "object",
      properties: { customer_id: { type: "string", description: "ID du compte (facultatif)." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_audit_grid",
    description:
      "Grille d'audit Google Ads de référence (139 critères de media buyers pro) : pour chaque critère, la règle, " +
      "les seuils (parfait / incorrect / à vérifier), la sévérité et le type de compte concerné (e-commerce, leads, local). " +
      "À appeler AU DÉBUT de tout bilan, audit ou plan d'optimisation, puis juger le compte critère par critère " +
      "avec les seuils de la grille. Filtrable par catégorie : " + AUDIT_GRID.map((c) => c.key).join(", ") + ".",
    inputSchema: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string" }, description: "Clés de catégories (facultatif, défaut : toutes)." },
        account_type: { type: "string", enum: ["ecommerce", "leads", "local"], description: "Type de compte, pour ne garder que les critères utiles (facultatif)." },
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
    case "list_keywords":
      return keywordsTool(ws, args.customer_id as string | undefined, args.since as string | undefined, args.until as string | undefined);
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
    case "get_ads":
      return adsTool(
        ws,
        args.customer_id as string | undefined,
        args.campaign_id as string | undefined,
        args.since as string | undefined,
        args.until as string | undefined,
      );
    case "get_campaign_diagnostics":
      return diagnosticsTool(ws, args.customer_id as string | undefined, args.since as string | undefined, args.until as string | undefined);
    case "get_assets_status":
      return assetsTool(ws, args.customer_id as string | undefined);
    case "get_audit_grid":
      return { text: auditGridText(args.categories as string[] | undefined, args.account_type as AccountTag | undefined) };
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
  const [metrics, acc, camps] = await Promise.all([
    getCampaignMetrics(ctx, range),
    getAccount(ctx),
    listCampaigns(ctx).catch(() => []),
  ]);
  const cur = acc.currencyCode;
  // Statut ACTUEL de chaque campagne : une campagne en pause peut avoir dépensé
  // pendant la période, il ne faut pas la présenter comme active.
  const STATUS: Record<string, string> = { ENABLED: "Active", PAUSED: "En pause", REMOVED: "Supprimée" };
  const statusOf = new Map(camps.map((c) => [c.id, STATUS[c.status] ?? c.status]));

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
      return `| ${m.campaignName} | ${statusOf.get(m.campaignId) ?? "?"} | ${int(m.impressions)} | ${int(m.clicks)} | ${pct(ctr)} | ${eur(cpc, cur)} | ${eur(m.cost, cur)} | ${int(m.conversions)} | ${m.conversions ? eur(cpa, cur) : "—"} | ${m.cost ? roas.toFixed(2) + "×" : "—"} |`;
    })
    .join("\n");

  const totCpa = tConv ? tCost / tConv : 0;
  const totRoas = tCost ? tValue / tCost : 0;

  return {
    text:
      `Performance — compte ${ctx.customerId} · ${range.since} → ${range.until}\n\n` +
      `Statut = statut ACTUEL (une campagne « En pause » a pu dépenser pendant la période avant sa mise en pause).\n\n` +
      `| Campagne | Statut actuel | Impr. | Clics | CTR | CPC | Coût | Conv. | CPA | ROAS |\n` +
      `|---|---|---|---|---|---|---|---|---|---|\n${rows}\n\n` +
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

const PIN_LABEL: Record<string, string> = {
  HEADLINE_1: "📌 T1",
  HEADLINE_2: "📌 T2",
  HEADLINE_3: "📌 T3",
  DESCRIPTION_1: "📌 D1",
  DESCRIPTION_2: "📌 D2",
};

async function adsTool(
  ws: WorkspaceContext,
  customerId?: string,
  campaignId?: string,
  since?: string,
  until?: string,
): Promise<ToolResult> {
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(0) };
  const ads = await listAds(ctx, range, campaignId);
  const acc = await getAccount(ctx);
  const cur = acc.currencyCode;
  if (ads.length === 0) {
    return {
      text:
        `Aucune annonce active ou en pause (compte ${ctx.customerId}` +
        `${campaignId ? `, campagne ${campaignId}` : ""}).`,
    };
  }

  const fmtAssets = (list: { text: string; pinnedField: string | null }[]) =>
    list.length
      ? list
          .map((a) => `- ${a.text} (${a.text.length} car.)` +
            (a.pinnedField ? ` ${PIN_LABEL[a.pinnedField] ?? a.pinnedField}` : ""))
          .join("\n")
      : "- —";

  const blocks = ads.map((a) => {
    const ctr = a.impressions ? a.clicks / a.impressions : 0;
    const path = [a.path1, a.path2].filter(Boolean).join("/");
    return (
      `### ${a.campaignName} › ${a.adGroupName} — annonce ${a.adId}\n` +
      `Type ${a.adType} · Statut ${a.status} · Ad strength **${a.adStrength}** · ` +
      `Validation ${a.approvalStatus}\n` +
      `Impr. ${int(a.impressions)} · Clics ${int(a.clicks)} · CTR ${pct(ctr)} · ` +
      `Coût ${eur(a.cost, cur)} · Conv. ${int(a.conversions)}\n` +
      `URL : ${a.finalUrls[0] ?? "—"}${path ? ` · Chemin : /${path}` : ""}\n\n` +
      `**Titres (${a.headlines.length}/15)**\n${fmtAssets(a.headlines)}\n\n` +
      `**Descriptions (${a.descriptions.length}/4)**\n${fmtAssets(a.descriptions)}`
    );
  });

  return {
    text:
      `Annonces — compte ${ctx.customerId} · ${range.since} → ${range.until} ` +
      `(${ads.length}, triées par coût)\n\n${blocks.join("\n\n---\n\n")}`,
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

async function keywordsTool(ws: WorkspaceContext, customerId?: string, since?: string, until?: string): Promise<ToolResult> {
  if (!isLive()) return { text: "Mode démo : liste des mots-clés indisponible." };
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(1) };
  const MT: Record<string, string> = { EXACT: "exact", PHRASE: "expression", BROAD: "large" };
  const QL: Record<string, string> = { BELOW_AVERAGE: "faible", AVERAGE: "moyen", ABOVE_AVERAGE: "bon" };
  const fmt = (t: string, m: string) => (m === "EXACT" ? `[${t}]` : m === "PHRASE" ? `"${t}"` : t);
  const [kws, perf, campNeg, agNeg, links, shared] = await Promise.all([
    searchRaw(ctx, `SELECT campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr, ad_group_criterion.position_estimates.top_of_page_cpc_micros
      FROM ad_group_criterion WHERE campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED'
        AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE`),
    searchRaw(ctx, `SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.cost_micros, metrics.clicks, metrics.conversions
      FROM keyword_view WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`),
    searchRaw(ctx, `SELECT campaign.name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion
      WHERE campaign.status = 'ENABLED' AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE`),
    searchRaw(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion
      WHERE campaign.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE`),
    searchRaw(ctx, `SELECT campaign.name, shared_set.id, shared_set.name FROM campaign_shared_set
      WHERE campaign.status = 'ENABLED' AND shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign_shared_set.status = 'ENABLED'`),
    searchRaw(ctx, `SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_criterion.type = 'KEYWORD'`),
  ]);
  const p = new Map<string, { cost: number; clicks: number; conv: number }>();
  perf.forEach((r) => {
    const k = `${r.adGroup?.id}|${r.adGroupCriterion?.criterionId}`;
    const x = p.get(k) ?? { cost: 0, clicks: 0, conv: 0 };
    x.cost += Number(r.metrics?.costMicros ?? 0) / 1e6; x.clicks += Number(r.metrics?.clicks ?? 0); x.conv += Number(r.metrics?.conversions ?? 0);
    p.set(k, x);
  });
  const kwRows = kws.map((r) => {
    const x = p.get(`${r.adGroup?.id}|${r.adGroupCriterion?.criterionId}`) ?? { cost: 0, clicks: 0, conv: 0 };
    const qi = r.adGroupCriterion?.qualityInfo ?? {};
    const top = Number(r.adGroupCriterion?.positionEstimates?.topOfPageCpcMicros ?? 0) / 1e6;
    const cpc = x.clicks ? x.cost / x.clicks : 0;
    const vsTop = cpc && top ? ` (${cpc > top * 1.2 ? "au-dessus" : cpc < top * 0.8 ? "en dessous" : "proche"})` : "";
    return `| ${fmt(r.adGroupCriterion?.keyword?.text ?? "", r.adGroupCriterion?.keyword?.matchType)} | ${MT[r.adGroupCriterion?.keyword?.matchType] ?? ""} | ${r.campaign?.name} › ${r.adGroup?.name} | ${qi.qualityScore ?? "–"} | ${QL[qi.searchPredictedCtr] ?? "–"} / ${QL[qi.creativeQualityScore] ?? "–"} / ${QL[qi.postClickQualityScore] ?? "–"} | ${eur(x.cost)} | ${int(x.clicks)} | ${int(x.conv)} | ${cpc ? eur(cpc) : "–"} | ${top ? eur(top) + vsTop : "–"} |`;
  }).join("\n");
  const setNames = new Map<string, string[]>();
  links.forEach((l) => setNames.set(String(l.sharedSet?.id), [...(setNames.get(String(l.sharedSet?.id)) ?? []), `${l.sharedSet?.name} → ${l.campaign?.name}`]));
  const negRows = [
    ...campNeg.map((r) => `| ${fmt(r.campaignCriterion?.keyword?.text ?? "", r.campaignCriterion?.keyword?.matchType)} | campagne ${r.campaign?.name} |`),
    ...agNeg.map((r) => `| ${fmt(r.adGroupCriterion?.keyword?.text ?? "", r.adGroupCriterion?.keyword?.matchType)} | groupe ${r.campaign?.name} › ${r.adGroup?.name} |`),
    ...shared.filter((r) => setNames.has(String(r.sharedSet?.id))).map((r) => `| ${fmt(r.sharedCriterion?.keyword?.text ?? "", r.sharedCriterion?.keyword?.matchType)} | liste ${setNames.get(String(r.sharedSet?.id))!.join(", ")} |`),
  ].join("\n");
  return {
    text:
      `Mots-clés actifs — compte ${ctx.customerId} · ${range.since} → ${range.until}\n\n` +
      `QS détaillé = CTR attendu / pertinence de l'annonce / expérience sur la page. « Haut de page » = CPC estimé par Google pour apparaître en haut de page ; un CPC moyen bien au-dessus signale un Quality Score qui fait payer plus cher.\n\n` +
      `| Mot-clé | Corresp. | Campagne › groupe | QS | QS détaillé | Coût | Clics | Conv. | CPC moyen | Haut de page (est.) |\n|---|---|---|---|---|---|---|---|---|---|\n${kwRows || "| (aucun) |"}\n\n` +
      `Mots-clés négatifs\n\n| Négatif | Posé sur |\n|---|---|\n${negRows || "| (aucun) |"}`,
  };
}


const pctOrDash = (v: unknown) => (v === undefined || v === null || v === "" ? "–" : `${(Number(v) * 100).toFixed(1)} %`);

async function diagnosticsTool(ws: WorkspaceContext, customerId?: string, since?: string, until?: string): Promise<ToolResult> {
  if (!isLive()) return { text: "Mode démo : diagnostic des campagnes indisponible." };
  const ctx = resolveContext(ws, customerId);
  const range = { since: since ?? daysAgo(30), until: until ?? daysAgo(1) };
  const days = Math.max(1, Math.round((Date.parse(range.until) - Date.parse(range.since)) / 864e5) + 1);
  const BID: Record<string, string> = {
    MANUAL_CPC: "CPC manuel", MAXIMIZE_CLICKS: "Maximiser les clics", TARGET_SPEND: "Maximiser les clics",
    MAXIMIZE_CONVERSIONS: "Maximiser les conversions", TARGET_CPA: "CPA cible", MAXIMIZE_CONVERSION_VALUE: "Maximiser la valeur",
    TARGET_ROAS: "ROAS cible", TARGET_IMPRESSION_SHARE: "Part d'impressions cible",
  };
  const GEO: Record<string, string> = { PRESENCE: "présence", PRESENCE_OR_INTEREST: "présence OU intérêt (à corriger)" };
  const [settings, perf] = await Promise.all([
    searchRaw(ctx, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros, campaign_budget.amount_micros,
        campaign.network_settings.target_search_network, campaign.network_settings.target_content_network,
        campaign.geo_target_type_setting.positive_geo_target_type
      FROM campaign WHERE campaign.status != 'REMOVED'`),
    searchRaw(ctx, `SELECT campaign.id, metrics.cost_micros, metrics.clicks, metrics.conversions,
        metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share,
        metrics.search_top_impression_share, metrics.search_absolute_top_impression_share
      FROM campaign WHERE campaign.advertising_channel_type = 'SEARCH' AND segments.date BETWEEN '${range.since}' AND '${range.until}'`).catch(() => []),
  ]);
  const p = new Map(perf.map((r) => [String(r.campaign?.id), r]));
  let activeBudget = 0, pausedBudget = 0, totalCost = 0;
  const rows = settings.map((c) => {
    const id = String(c.campaign?.id);
    const m = p.get(id)?.metrics ?? {};
    const budget = Number(c.campaignBudget?.amountMicros ?? 0) / 1e6;
    const cost = Number(m.costMicros ?? 0) / 1e6;
    totalCost += cost;
    if (c.campaign?.status === "ENABLED") activeBudget += budget; else pausedBudget += budget;
    const tcpa = Number(c.campaign?.targetCpa?.targetCpaMicros ?? c.campaign?.maximizeConversions?.targetCpaMicros ?? 0) / 1e6;
    const ns = c.campaign?.networkSettings ?? {};
    const nets = [ns.targetSearchNetwork ? "partenaires" : null, ns.targetContentNetwork ? "Display" : null].filter(Boolean).join(" + ") || "Google seul";
    return `| ${c.campaign?.name} | ${c.campaign?.status === "ENABLED" ? "Active" : "En pause"} | ${eur(budget)} | ${eur(cost / days)} | ${BID[c.campaign?.biddingStrategyType] ?? c.campaign?.biddingStrategyType ?? "–"}${tcpa ? ` (cible ${eur(tcpa)})` : ""} | ${pctOrDash(m.searchImpressionShare)} | ${pctOrDash(m.searchBudgetLostImpressionShare)} | ${pctOrDash(m.searchRankLostImpressionShare)} | ${pctOrDash(m.searchTopImpressionShare)} | ${pctOrDash(m.searchAbsoluteTopImpressionShare)} | ${nets} | ${GEO[c.campaign?.geoTargetTypeSetting?.positiveGeoTargetType] ?? "–"} |`;
  }).join("\n");
  return {
    text:
      `Diagnostic des campagnes — compte ${ctx.customerId} · ${range.since} → ${range.until} (${days} j)\n\n` +
      `Budget des campagnes ACTIVES : ${eur(activeBudget)}/jour · dépense réelle moyenne : ${eur(totalCost / days)}/jour. ` +
      `Les budgets des campagnes en pause (${eur(pausedBudget)}/jour) ne sont PAS dépensés : ne les compte jamais comme budget disponible.\n\n` +
      `| Campagne | Statut | Budget/jour | Dépense/jour | Enchères | Part impr. | Perdue budget | Perdue classement | Haut de page | 1re position | Réseaux | Zone |\n` +
      `|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows || "| (aucune) |"}\n\n` +
      `Lecture : si « Perdue classement » > « Perdue budget », augmenter le budget ne règle rien ; il faut améliorer la qualité (Quality Score, pertinence, page) ou l'enchère.`,
  };
}

const ASSET_LABEL: Record<string, string> = {
  CALL: "Appel", SITELINK: "Lien annexe", CALLOUT: "Accroche", STRUCTURED_SNIPPET: "Extrait structuré",
  BUSINESS_NAME: "Nom d'entreprise", BUSINESS_LOGO: "Logo", LOGO: "Logo", PRICE: "Prix", PROMOTION: "Promotion",
  LEAD_FORM: "Formulaire", IMAGE: "Image", LOCATION: "Lieu",
};
const APPROVAL: Record<string, string> = {
  APPROVED: "approuvé", APPROVED_LIMITED: "LIMITÉ", DISAPPROVED: "REFUSÉ", AREA_OF_INTEREST_ONLY: "limité (zone)", UNKNOWN: "–",
};

async function assetsTool(ws: WorkspaceContext, customerId?: string): Promise<ToolResult> {
  if (!isLive()) return { text: "Mode démo : extensions indisponibles." };
  const ctx = resolveContext(ws, customerId);
  const FIELDS = `asset.id, asset.type, asset.call_asset.phone_number, asset.sitelink_asset.link_text, asset.callout_asset.callout_text,
    asset.structured_snippet_asset.header, asset.text_asset.text, asset.name,
    asset.policy_summary.approval_status, asset.policy_summary.review_status, asset.policy_summary.policy_topic_entries`;
  const [camp, cust] = await Promise.all([
    searchRaw(ctx, `SELECT campaign.name, campaign_asset.field_type, ${FIELDS} FROM campaign_asset
      WHERE campaign.status = 'ENABLED' AND campaign_asset.status = 'ENABLED'`).catch(() => null),
    searchRaw(ctx, `SELECT customer_asset.field_type, ${FIELDS} FROM customer_asset WHERE customer_asset.status = 'ENABLED'`).catch(() => null),
  ]);
  if (camp === null && cust === null) return { text: "Lecture des extensions impossible sur ce compte (droits ou API)." };
  const label = (r: RawRowLike) => {
    const a = r.asset ?? {};
    return a.callAsset?.phoneNumber ?? a.sitelinkAsset?.linkText ?? a.calloutAsset?.calloutText ?? a.structuredSnippetAsset?.header ?? a.textAsset?.text ?? a.name ?? `#${a.id}`;
  };
  const topics = (r: RawRowLike) => ((r.asset?.policySummary?.policyTopicEntries ?? []) as { topic?: string }[]).map((t) => t.topic).filter(Boolean).join(", ");
  const line = (where: string, field: string, r: RawRowLike) => {
    const st = r.asset?.policySummary?.approvalStatus ?? "UNKNOWN";
    return `| ${ASSET_LABEL[field] ?? field} | ${label(r)} | ${where} | ${APPROVAL[st] ?? st}${topics(r) ? ` (${topics(r)})` : ""} |`;
  };
  const rows = [
    ...(camp ?? []).map((r) => line(`campagne ${r.campaign?.name}`, r.campaignAsset?.fieldType, r)),
    ...(cust ?? []).map((r) => line("compte", r.customerAsset?.fieldType, r)),
  ];
  const present = new Set([...(camp ?? []).map((r) => r.campaignAsset?.fieldType), ...(cust ?? []).map((r) => r.customerAsset?.fieldType)]);
  const missing = ["CALL", "SITELINK", "CALLOUT", "STRUCTURED_SNIPPET", "BUSINESS_NAME", "BUSINESS_LOGO"].filter((t) => !present.has(t)).map((t) => ASSET_LABEL[t]);
  const bad = rows.filter((r) => r.includes("REFUSÉ") || r.includes("LIMITÉ")).length;
  return {
    text:
      `Extensions et composants — compte ${ctx.customerId}\n\n` +
      `${bad ? `**${bad} composant(s) refusé(s) ou limité(s).** ` : "Aucun composant refusé. "}` +
      `${missing.length ? `Types absents : ${missing.join(", ")}.` : "Tous les types principaux sont présents."}\n\n` +
      `| Type | Contenu | Rattaché à | Validation |\n|---|---|---|---|\n${rows.join("\n") || "| (aucun) |"}`,
  };
}

// Lignes GAQL brutes (champs en camelCase, structure variable selon la requête).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRowLike = any;
