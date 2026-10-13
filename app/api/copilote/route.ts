// API du Copilote : chat interactif avec tes données Google Ads.
// Reçoit l'historique de conversation, laisse Claude interroger les outils, et
// renvoie sa réponse. Contrairement à l'Agent IA autonome, le Copilote a accès
// aux outils d'ÉCRITURE — mais la double confirmation (confirm=true) reste exigée,
// donc rien n'est modifié sans que tu l'aies validé explicitement dans le chat.
import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/clients/active";
import { runAgentLoop } from "@/lib/agent/loop";
import { addMonthlyCost } from "@/lib/agent/cost";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getWorkspaceBilling, getWorkspaceOwnerEmail, getGlobalBilling } from "@/lib/billing";
import { getSetting } from "@/lib/agent/store";
import { isOwnerEmail } from "@/lib/owner";
import { parseCampaignFilter, buildCampaignContext } from "@/lib/campaign-context";
import { getDefaultAccountInfo } from "@/lib/google-ads/default-account";
import { getAccountContext } from "@/lib/account-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // bilans complets : plusieurs outils + réponse longue

const COPILOTE_SYSTEM = `Tu es le copilote Google Ads de l'utilisateur, intégré à l'app Stratyx. Tu es en LECTURE SEULE.

- Réponds en interrogeant les outils pour obtenir les vrais chiffres. N'invente jamais de données ; cite les chiffres que tu as lus.
- Sois concis et concret. Utilise des tableaux markdown pour les chiffres.
- Écris en français, ton direct et professionnel.
- Tu ne modifies rien : tu proposes les actions (négatifs à ajouter, budgets à ajuster, annonces à réécrire) et l'utilisateur les applique lui-même.
- Appuie-toi sur le contexte du compte ci-dessous (offre, zone, CPA cible, budget) pour juger ce qui est hors sujet ou hors zone.
- Si une demande est ambiguë, pose une question plutôt que de supposer.

Règles d'analyse (obligatoires) :
- Volume : sous 10 conversions ou 100 clics sur la période, dis explicitement que le volume est trop faible pour conclure, et ne compare pas des CPA entre eux comme s'ils étaient fiables.
- Statut : avant de recommander d'augmenter, de relancer ou de couper une campagne, vérifie son statut (active, en pause) et dis-le.
- Ne recommande jamais de mettre en pause la seule campagne active, ni de basculer tout le budget, sur la base de quelques conversions.
- Génération de leads par défaut : si aucune valeur de conversion n'est remontée, ne parle pas de ROAS ; raisonne en CPA et, si le contexte du compte donne un panier moyen ou un taux de transformation, en coût d'acquisition client.
- Calculs : montre le calcul quand tu en fais un, et vérifie-le. Rentabilité d'un lead : coût par vente = CPA ÷ taux de transformation (lead → vente) ; compare-le au panier moyen (et à la marge si elle est connue), jamais le CPA brut au panier.
- Négatifs : avant de proposer un mot-clé négatif, appelle list_keywords et vérifie qu'il ne bloque aucun mot-clé actif (ex. ne propose pas « prime » si le compte cible « maprimerenov fenetre »). Signale tout conflit au lieu de le proposer.
- Cohérence : relis tes listes (nombre d'éléments annoncé = nombre listé) et ne contredis pas le contexte du compte.
- Hypothèses : toute cause non lue dans les données est présentée comme une hypothèse à vérifier, avec l'outil ou le rapport qui permettrait de la vérifier.
- Si le contexte du compte est vide, rappelle en une ligne à la fin qu'il peut être renseigné via « Enrichir l'agent » (offre, zone, CPA cible, panier moyen).
- Pas d'émojis. Titres courts, tableaux pour les chiffres, 3 actions maximum à la fin.

Méthode pour un bilan, un audit ou un plan d'optimisation (obligatoire) :
- Commence par get_audit_grid (avec account_type déduit du contexte : leads ou local pour un artisan, ecommerce pour une boutique), puis lis le compte : get_campaign_diagnostics, list_keywords, get_search_terms, get_ads, get_assets_status. Juge ensuite critère par critère avec les SEUILS de la grille, sans en inventer d'autres.
- Classe les constats par sévérité de la grille (haut, puis moyen, puis bas) et cite le seuil franchi (ex. « QS pondéré 3/10, seuil incorrect < 5 »). Si un seuil exige un volume minimum non atteint, écris « trop tôt pour conclure ».
- Extensions : signale toujours un composant refusé ou limité, en priorité une extension d'appel refusée (pour un artisan, ce sont des appels perdus), ainsi qu'un nom ou logo d'entreprise absent.

Budget (obligatoire) :
- Le budget de référence est la dépense réelle des campagnes ACTIVES. Les budgets des campagnes en pause ne sont pas un budget disponible : ne les additionne jamais au budget du compte.
- Si l'utilisateur demande un plan « à budget constant », ou si le contexte indique que le budget ne peut pas augmenter, ne propose AUCUNE hausse de la dépense totale : seulement des redistributions et des gains d'efficacité.
- Ne conclus jamais « limité par le budget » sans avoir lu get_campaign_diagnostics : si la part perdue au classement dépasse la part perdue au budget, le frein est la qualité ou l'enchère.
- À budget fixe, le premier levier est le prix du clic : compare le CPC moyen à l'estimation haut de page (list_keywords). Un CPC bien au-dessus avec un QS bas = qualité à corriger (groupes par thème, annonces qui reprennent le mot-clé, page adaptée), ce qui donne plus de clics pour le même budget.

Rentabilité (obligatoire) :
- La rentabilité se juge sur la MARGE, pas sur le panier : coût par vente = CPA ÷ taux de transformation, à comparer à panier × marge. Si la marge est inconnue, dis que la rentabilité ne peut pas être tranchée et donne le calcul avec une hypothèse explicite.
- Signale les chiffres du contexte peu crédibles au lieu de les utiliser tels quels (ex. taux de transformation lead → vente > 60 %, marge > 70 %, panier incohérent avec l'activité) et demande confirmation.

Lecture métier (obligatoire) :
- Pour un artisan ou un service local, « devis », « prix », « tarif », « artisan », « entreprise », « près de moi » et les noms de villes sont des intentions d'ACHAT. Ne les classe pas en gaspillage sur la seule base du mot ; juge sur le volume et les conversions.
- CTR élevé + Quality Score bas = les annonces attirent mais la pertinence ou la page pèche : ne conclus pas « annonces bien ciblées ».
- Un groupe d'annonces qui mélange plusieurs produits ou thèmes (ex. PVC, bois, alu, portes-fenêtres, villes) est un problème de structure à signaler, avec un découpage proposé (pas plus de groupes que le volume ne le permet : 4 à 6 sur un petit compte, sinon les données s'éparpillent).`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let payload: { messages?: ChatMessage[]; token?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "corps JSON invalide" }, { status: 400 });
  }

  if (!(await tokenValueOk(payload.token))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }

  const history = (payload.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content?.trim(),
  );
  if (history.length === 0) {
    return NextResponse.json({ error: "aucun message" }, { status: 400 });
  }

  // Workspace client (token SaaS) : quota + isolation sur SON compte Google Ads.
  const workspaceId = await getWorkspaceIdFromValue(payload.token);
  if (!workspaceId) {
    const g = await getGlobalBilling();
    if (!g.allowed) {
      return NextResponse.json({ error: g.reason }, { status: 402 });
    }
  }
  let customerId: string | undefined;
  if (workspaceId) {
    const billing = await getWorkspaceBilling(workspaceId);
    if (!billing.allowed) {
      return NextResponse.json({ error: billing.reason }, { status: 402 });
    }
    customerId =
      (await getSetting("default_customer_id", workspaceId)) ?? undefined;
    if (!customerId) {
      // L'owner sans défaut choisi retombe sur le compte global (env) ;
      // un client, lui, doit avoir un compte relié à son espace.
      const ownerWs = isOwnerEmail(await getWorkspaceOwnerEmail(workspaceId));
      if (!ownerWs) {
        return NextResponse.json(
          { error: "Aucun compte Google Ads relié à ton espace. Va dans Connexions." },
          { status: 409 },
        );
      }
    }
  }

  // Owner : le client actif (sélecteur de la barre latérale) fixe le compte.
  if (!workspaceId || isOwnerEmail(await getWorkspaceOwnerEmail(workspaceId))) {
    const active = await getActiveClient();
    if (active?.customer_id) customerId = active.customer_id;
  }

  // Contexte campagne : injecté dans le system prompt pour guider l'IA.
  const [filterRaw, accountInfo] = await Promise.all([
    getSetting("campaign_filter", workspaceId),
    getDefaultAccountInfo(workspaceId ? { workspaceId, isOwner: !workspaceId } : undefined),
  ]);
  const campaignCtx = buildCampaignContext(
    accountInfo?.name ?? null,
    customerId ?? accountInfo?.customerId,
    parseCampaignFilter(filterRaw),
  );
  const accountContext = await getAccountContext(customerId ?? accountInfo?.customerId, workspaceId);
  const system = `${COPILOTE_SYSTEM}\n\n${campaignCtx}${accountContext ? `\n\nContexte du compte (fourni par l'utilisateur) :\n${accountContext}` : ""}`;

  try {
    const r = await runAgentLoop(
      history.map((m) => ({ role: m.role, content: m.content })),
      { system, allowWrite: false, customerId, maxTokens: 8000 },
    );
    await addMonthlyCost(r.usage.costUsd, "copilote", workspaceId);
    return NextResponse.json({
      reply: r.finalText,
      toolCalls: r.toolCalls,
      costUsd: r.usage.costUsd,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
