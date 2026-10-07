import Link from "next/link";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import Shell from "@/components/Shell";
import { getClient } from "@/lib/clients/store";
import { getActiveClient } from "@/lib/clients/active";
import PersonaBuilder from "./PersonaBuilder";

export const dynamic = "force-dynamic";
type SP = Promise<{ client?: string }>;

export default async function PersonaPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const sp = await searchParams;
  // Depuis une fiche client : les réponses du questionnaire pré-remplissent le formulaire.
  const activeId = ctx.isOwner && !sp.client ? (await getActiveClient())?.id : undefined;
  const pick = sp.client ?? activeId;
  const client = ctx.isOwner && pick ? await getClient(pick).catch(() => null) : null;
  const a = client?.answers ?? {};
  const prefill = client
    ? {
        localisation: a.zone ?? "",
        situation_pro: a.cible ?? "",
        frustrations: a.objections ?? "",
        secteur_produit: [a.activite, a.services].filter(Boolean).join(" · "),
        proposition_valeur: a.differences ?? "",
        a_eviter: [a.contraintes, a.refus].filter(Boolean).join(" · "),
        objectif_campagne: a.objectif ?? "",
      }
    : undefined;
  return (
    <Shell active="persona" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      {client && (
        <div className="card" style={{ marginBottom: 14 }}>
          Pré-rempli avec le questionnaire de <strong>{client.name}</strong>. <Link href={`/clients/${client.id}`}>Retour à la fiche</Link>
        </div>
      )}
      <PersonaBuilder token={ctx.mcpToken} prefill={prefill} />
    </Shell>
  );
}
