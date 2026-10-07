// Synthèse de découverte et proposition d'accompagnement (imprimable en PDF).
import { notFound, redirect } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getClient } from "@/lib/clients/store";
import { getProposal } from "@/lib/clients/proposal";
import { generateProposalAction } from "../../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type P = Promise<{ id: string }>;
type SP = Promise<{ err?: string }>;

const eur = (x: number | null) => (x === null ? "à préciser" : `${Math.round(x).toLocaleString("fr-FR")} €`);
const box = { background: "var(--rv-card)", border: "1px solid var(--rv-border)", borderRadius: 12, padding: "12px 14px" } as const;

export default async function PropositionPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const c = await getClient(id);
  if (!c) notFound();
  const s = await getProposal(id);
  const regen = (
    <form action={generateProposalAction}>
      <input type="hidden" name="id" value={c.id} />
      <SubmitButton className="btn-ghost" pending="Rédaction… (30 à 60 s)">{s ? "Régénérer" : "Générer"}</SubmitButton>
    </form>
  );

  if (!s) {
    return (
      <AuditSheet kicker="Synthèse et proposition" title={c.name} subtitle="Pas encore générée" back={{ href: `/clients/${c.id}`, label: "Retour à la fiche" }} actions={regen}>
        {sp.err && <p style={{ color: "#d92d4b" }}>{sp.err}</p>}
        <p style={{ marginTop: 20 }}>Remplis le questionnaire (au moins activité, cible, valeur d&apos;un client, taux de signature et budget), puis clique sur « Générer ».</p>
      </AuditSheet>
    );
  }
  const p = s.proposal, e = s.economics;
  const date = new Date(s.at).toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

  return (
    <AuditSheet kicker="Synthèse de découverte et proposition" title={c.name} subtitle={`Préparé le ${date}`} back={{ href: `/clients/${c.id}`, label: "Retour à la fiche" }} actions={regen} footer="Document préparé par STRATYXMEDIA · stratyxmedia.fr">
      {sp.err && <p className="no-print" style={{ color: "#d92d4b" }}>{sp.err}</p>}
      <section><h2 className="rv-h2">Ce que nous avons compris</h2><p style={{ whiteSpace: "pre-wrap" }}>{p.resume}</p>
        {p.enjeux.length > 0 && <ul style={{ paddingLeft: 20 }}>{p.enjeux.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      </section>

      <section>
        <h2 className="rv-h2">Vos chiffres</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {e.valeurDemande !== null && <div style={box}><div className="rv-kicker">Ce que rapporte une demande</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(e.valeurDemande)}</div><div style={{ fontSize: 12 }}>marge moyenne, après taux de signature</div></div>}
          {e.cplMaxRentable !== null && <div style={box}><div className="rv-kicker">Coût maximum rentable</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(e.cplMaxRentable)}</div><div style={{ fontSize: 12 }}>par demande, au-delà la pub perd de l&apos;argent</div></div>}
          <div style={box}><div className="rv-kicker">Budget recommandé</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(p.budget_mensuel)}</div><div style={{ fontSize: 12 }}>par mois, hors honoraires</div></div>
          {e.demandesBudget !== null && <div style={box}><div className="rv-kicker">Ordre de grandeur</div><div style={{ fontSize: 22, fontWeight: 700 }}>~{Math.round(e.demandesBudget)} demandes</div><div style={{ fontSize: 12 }}>par mois avec le budget envisagé, à confirmer en conditions réelles</div></div>}
        </div>
        {e.valeurDemande === null && <p style={{ fontSize: 13, color: "var(--rv-muted)" }}>À compléter ensemble pour fixer votre seuil de rentabilité : {[e.valeurClient === null && "valeur moyenne d'un client", e.margePct === null && "marge", e.closing === null && "part des demandes signées"].filter(Boolean).join(", ")}.</p>}
        {p.budget_justification && <p>{p.budget_justification}</p>}
      </section>

      <section><h2 className="rv-h2">Stratégie recommandée</h2><p style={{ whiteSpace: "pre-wrap" }}>{p.strategie}</p>
        {p.campagnes.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead><tr>{["Campagne", "Objectif", "Ciblage", "Budget"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--rv-border)", fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>{p.campagnes.map((x, i) => (
              <tr key={i}><td style={{ padding: "6px 8px", borderBottom: "1px solid var(--rv-border)", fontWeight: 600 }}>{x.nom}</td><td style={{ padding: "6px 8px", borderBottom: "1px solid var(--rv-border)" }}>{x.objectif}</td><td style={{ padding: "6px 8px", borderBottom: "1px solid var(--rv-border)" }}>{x.ciblage}</td><td style={{ padding: "6px 8px", borderBottom: "1px solid var(--rv-border)", whiteSpace: "nowrap" }}>{x.budget_pct} % · {eur(p.budget_mensuel * x.budget_pct / 100)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {p.objectifs_90j.length > 0 && <section><h2 className="rv-h2">Objectifs à 90 jours</h2><ul style={{ paddingLeft: 20 }}>{p.objectifs_90j.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
      {p.prerequis.length > 0 && <section><h2 className="rv-h2">Avant de lancer</h2><ul style={{ paddingLeft: 20 }}>{p.prerequis.map((x, i) => <li key={i}>{x}</li>)}</ul>
        {s.site && !s.site.error && <p style={{ fontSize: 13, color: "var(--rv-muted)" }}>Audit de votre page : {s.site.score}/100{s.site.fails.length ? `, à corriger : ${s.site.fails.join(", ")}` : ""}.</p>}
      </section>}
      {p.plan.length > 0 && <section><h2 className="rv-h2">Déroulé</h2>{p.plan.map((x, i) => <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--rv-border)" }}><strong>{x.periode}</strong><div>{x.actions}</div></div>)}</section>}
      {p.risques.length > 0 && <section><h2 className="rv-h2">Points de vigilance</h2><ul style={{ paddingLeft: 20 }}>{p.risques.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
      {p.prochaine_etape && <section><h2 className="rv-h2">Prochaine étape</h2><p>{p.prochaine_etape}</p></section>}
      <p className="no-print" style={{ fontSize: 12, color: "var(--rv-muted)", marginTop: 24 }}>Rédigé par {s.model} à partir du questionnaire. Relis avant d&apos;envoyer.</p>
    </AuditSheet>
  );
}
