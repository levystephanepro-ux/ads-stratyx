// API du Copilote : chat interactif avec tes données Google Ads.
// Reçoit l'historique de conversation, laisse Claude interroger les outils, et
// renvoie sa réponse. Contrairement à l'Agent IA autonome, le Copilote a accès
// aux outils d'ÉCRITURE — mais la double confirmation (confirm=true) reste exigée,
// donc rien n'est modifié sans que tu l'aies validé explicitement dans le chat.
import { NextResponse } from "next/server";
import { runAgentLoop } from "@/lib/agent/loop";
import { addMonthlyCost } from "@/lib/agent/cost";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getWorkspaceBilling, getWorkspaceOwnerEmail } from "@/lib/billing";
import { getSetting } from "@/lib/agent/store";
import { isOwnerEmail } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const COPILOTE_SYSTEM = `Tu es le copilote Google Ads de l'utilisateur, intégré à l'app ads-stratyx.

- Réponds à ses questions en interrogeant les outils pour obtenir les vrais chiffres. N'invente jamais de données.
- Sois concis et concret. Utilise des tableaux markdown pour les chiffres.
- Écris en français, ton direct et professionnel.
- Tu peux MODIFIER les campagnes (pause/activation, budget), mais JAMAIS sans validation : explique d'abord précisément l'action que tu vas faire, demande une confirmation claire, et n'utilise confirm=true que quand l'utilisateur a répondu oui sans ambiguïté.
- Si une demande est risquée ou ambiguë, pose une question plutôt que d'agir.`;

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

  try {
    const r = await runAgentLoop(
      history.map((m) => ({ role: m.role, content: m.content })),
      { system: COPILOTE_SYSTEM, allowWrite: true, customerId },
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
