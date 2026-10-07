// Fiche client : informations, questionnaire (lien public ou saisie directe), raccourcis outils.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/Shell";
import QuestionFields from "@/components/QuestionFields";
import CopyLinkButton from "@/components/CopyLinkButton";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { getClient } from "@/lib/clients/store";
import { saveClientAction, markSentAction, deleteClientAction } from "../actions";

export const dynamic = "force-dynamic";

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const lab = { fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 } as const;
const LABEL = { a_envoyer: "Questionnaire à envoyer", envoye: "Envoyé, en attente", rempli: "Questionnaire rempli" } as const;

type P = Promise<{ id: string }>;
type SP = Promise<{ saved?: string }>;

export default async function ClientPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const c = await getClient(id);
  if (!c) notFound();
  const { accounts } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const acc = c.customer_id ? `?account=${c.customer_id}` : "";
  const prospect = `/audit/prospect?${new URLSearchParams({ nom: c.name, ...(c.website ? { url: c.website } : {}) }).toString()}`;
  const tools = c.customer_id
    ? [
        { href: `/waste${acc}`, t: "Diagnostic et audit", d: "Score de santé, gaspillage, correctifs en un clic." },
        { href: `/audit/client${acc}`, t: "Audit PDF du compte", d: "Document à remettre au client." },
        { href: `/previsions${acc}`, t: "Prévisions et structure", d: "Mots clés, budget, campagne en pause." },
        { href: `/rapports`, t: "Rapports", d: "Rapport du mois, lien client, PDF." },
        { href: `/alertes`, t: "Alertes", d: "Budget, conversions, landing page." },
        { href: `/dashboard${acc}`, t: "Tableau de bord", d: "Dépense, conversions, budget." },
        { href: `/persona?client=${c.id}`, t: "Persona", d: "Pré-rempli avec le questionnaire." },
      ]
    : [];

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href="/clients">Tous les clients</Link>}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{c.name}</h1>
        <span className="pill">{LABEL[c.status]}</span>
      </div>
      {sp.saved && <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>{sp.saved === "sync" ? "Fiche enregistrée, et le contexte IA du compte est mis à jour (Copilote et Prévisions s'en servent)." : "Fiche enregistrée."}</div>}

      <div className="card" style={{ margin: "16px 0", display: "grid", gap: 10 }}>
        <strong>Lien du questionnaire à envoyer au client</strong>
        <p className="subtitle" style={{ margin: 0 }}>Le client répond sans compte. Ses réponses arrivent ici et alimentent le contexte IA du compte lié.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CopyLinkButton path={`/q/${c.share_token}`} label="Copier le lien du questionnaire" />
          <Link className="btn-ghost" href={`/q/${c.share_token}`} target="_blank">Voir ce que voit le client</Link>
          {c.status === "a_envoyer" && (
            <form action={markSentAction}><input type="hidden" name="id" value={c.id} /><button className="btn-ghost" type="submit">Marquer comme envoyé</button></form>
          )}
        </div>
        {c.submitted_at && <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Dernières réponses le {new Date(c.submitted_at).toLocaleDateString("fr-FR")}</span>}
      </div>

      {tools.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
          {tools.map((t) => (
            <Link key={t.t} href={t.href} className="card" style={{ color: "inherit" }}>
              <strong>{t.t}</strong><br /><span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{t.d}</span>
            </Link>
          ))}
          <Link href={prospect} className="card" style={{ color: "inherit" }}><strong>Audit de la page</strong><br /><span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Page, suivi, potentiel de recherche.</span></Link>
          <div className="card" style={{ opacity: 0.6 }}><strong>Meta Ads</strong><br /><span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Bientôt.</span></div>
        </div>
      ) : (
        <div className="card subtitle" style={{ marginBottom: 16 }}>Lie un compte Google Ads à ce client pour activer l'audit, les prévisions, les alertes et le contexte IA.</div>
      )}

      <form action={saveClientAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={c.id} />
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Informations</h2>
          <div><span style={lab}>Nom</span><input name="name" defaultValue={c.name} required style={input} /></div>
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
        <div><SubmitButton pending="Enregistrement...">Enregistrer la fiche</SubmitButton></div>
      </form>

      <form action={deleteClientAction} style={{ marginTop: 28 }}>
        <input type="hidden" name="id" value={c.id} />
        <button className="btn-ghost" type="submit" style={{ color: "var(--red)" }}>Supprimer cette fiche</button>
      </form>
    </Shell>
  );
}
