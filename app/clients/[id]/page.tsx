// Fiche client : informations, questionnaire (lien public ou saisie directe), raccourcis outils.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/Shell";
import QuestionFields from "@/components/QuestionFields";
import CopyLinkButton from "@/components/CopyLinkButton";
import ClientSteps from "@/components/ClientSteps";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { getClient } from "@/lib/clients/store";
import { saveClientAction, saveClientDraftAction, saveClientDoneAction, markSentAction, deleteClientAction, setActiveClientAction, setStageAction } from "../actions";
import { getActiveClient } from "@/lib/clients/active";
import { getProposal } from "@/lib/clients/proposal";
import { STAGES, stageOf, nextAction } from "@/lib/clients/stages";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const lab = { fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 } as const;
const LABEL = { a_envoyer: "Questionnaire à envoyer", envoye: "Envoyé, en attente", brouillon: "Brouillon en cours", rempli: "Questionnaire rempli" } as const;

type P = Promise<{ id: string }>;
type SP = Promise<{ saved?: string; err?: string }>;

export default async function ClientPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const c = await getClient(id);
  if (!c) notFound();
  const [{ accounts }, active, prop] = await Promise.all([getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }), getActiveClient(), getProposal(c.id).catch(() => null)]);
  const isActive = active?.id === c.id;
  const stage = stageOf(c);
  const next = nextAction(c, !!prop);
  const acc = c.customer_id ? `?account=${c.customer_id}` : "";

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href="/clients">Tous les clients</Link>}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{c.name}</h1>
        {isActive ? (
          <form action={setActiveClientAction} style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="pill ok">Client actif</span><input type="hidden" name="id" value="" /><input type="hidden" name="back" value={`/clients/${c.id}`} />
            <button className="btn-ghost" type="submit" style={{ padding: "5px 10px", fontSize: 12 }}>Désactiver</button></form>
        ) : (
          <form action={setActiveClientAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={`/clients/${c.id}`} />
            <button type="submit" style={{ padding: "7px 12px", fontSize: 13 }}>Travailler sur ce client</button></form>
        )}
        <form action={setStageAction} style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <input type="hidden" name="id" value={c.id} />
          <select name="stage" defaultValue={stage} style={{ ...input, width: "auto", padding: "6px 10px" }} aria-label="Étape">
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className="btn-ghost" type="submit" style={{ padding: "6px 10px", fontSize: 12 }}>OK</button>
        </form>
      </div>
      {next && <p style={{ margin: "10px 0 0" }}><Link href={next.href}><strong>Prochaine action :</strong> {next.text}</Link></p>}
      {sp.err && <div className="card" style={{ borderColor: "var(--red)", margin: "12px 0" }}>{sp.err}</div>}
      {sp.saved && <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>{sp.saved === "sync" ? "Fiche enregistrée, et le contexte IA du compte est mis à jour (Copilote et Prévisions s'en servent)." : sp.saved === "draft" ? "Brouillon enregistré. Tu peux quitter la page et reprendre plus tard." : "Fiche enregistrée et marquée comme remplie."}</div>}

      <ClientSteps c={c} hasProposal={!!prop} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, margin: "0 0 16px" }}>
        <span className="subtitle" style={{ margin: 0 }}>Aussi :</span>
        <Link href={`/persona?client=${c.id}`}>Persona</Link>
        {c.customer_id && <Link href={`/dashboard${acc}`}>Tableau de bord</Link>}
        {c.customer_id && <Link href={`/copilote`}>Copilote</Link>}
        <span className="subtitle" style={{ margin: 0 }}>Meta Ads : bientôt</span>
      </div>

      <details id="questionnaire" open={c.status !== "rempli" ? true : undefined} className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Questionnaire de découverte · {LABEL[c.status]}{c.submitted_at ? ` · ${new Date(c.submitted_at).toLocaleDateString("fr-FR")}` : ""}</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          <CopyLinkButton path={`/q/${c.share_token}`} label="Copier le lien complet" />
          <CopyLinkButton path={`/q/${c.share_token}?v=court`} label="Copier le lien court (12 questions)" />
          <Link className="btn-ghost" href={`/q/${c.share_token}?apercu=1`} target="_blank">Voir ce que voit le client</Link>
          {c.status === "a_envoyer" && (
            <form action={markSentAction}><input type="hidden" name="id" value={c.id} /><button className="btn-ghost" type="submit">Marquer comme envoyé</button></form>
          )}
        </div>
      <form action={saveClientAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={c.id} />
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Informations</h2>
          <div><span style={lab}>Entreprise</span><input name="name" defaultValue={c.name} required style={input} /></div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div><span style={lab}>Nom du contact</span><input name="contact_name" defaultValue={c.contact_name ?? ""} style={input} /></div>
            <div><span style={lab}>Téléphone</span><input name="contact_phone" type="tel" defaultValue={c.contact_phone ?? ""} style={input} /></div>
          </div>
          <div>
            <span style={lab}>Compte Google Ads lié</span>
            <select name="customer_id" defaultValue={c.customer_id ?? ""} style={input}>
              <option value="">Aucun</option>
              {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
            </select>
          </div>
          <div><span style={lab}>Site web</span><input name="website" defaultValue={c.website ?? ""} placeholder="https://" style={input} /></div>
          <div><span style={lab}>Email du contact</span><input name="contact_email" type="email" defaultValue={c.contact_email ?? ""} style={input} /></div>
          <div><span style={lab}>Notes internes (non visibles du client)</span><textarea name="notes" rows={3} defaultValue={c.notes ?? ""} style={{ ...input, font: "inherit" }} /></div>
        </section>

        <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>Réponses au questionnaire</h2>
        <p className="subtitle" style={{ margin: 0 }}>Remplies par le client via le lien, ou saisies par toi après un appel.</p>
        <QuestionFields answers={c.answers ?? {}} />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="sync" value="1" defaultChecked />
          <span>Mettre à jour le contexte IA du compte lié avec ces réponses</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", bottom: 0, padding: "10px 0", background: "var(--bg)", zIndex: 5 }}>
          <button type="submit" formAction={saveClientDraftAction}>Enregistrer le brouillon</button>
          <button type="submit" formAction={saveClientDoneAction} className="btn-ghost">Enregistrer et marquer comme rempli</button>
          <Link className="btn-ghost" href="/clients">Quitter</Link>
        </div>
      </form>

      </details>

      <form action={deleteClientAction} style={{ marginTop: 28 }}>
        <input type="hidden" name="id" value={c.id} />
        <button className="btn-ghost" type="submit" style={{ color: "var(--red)" }}>Supprimer cette fiche</button>
      </form>
    </Shell>
  );
}
