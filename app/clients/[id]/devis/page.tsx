// Devis client : document imprimable (PDF) + édition.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getClient } from "@/lib/clients/store";
import { getQuote, getQuoteSettings, totals } from "@/lib/clients/quotes";
import { createQuoteAction, saveQuoteAction } from "../../quote-actions";

export const dynamic = "force-dynamic";
type P = Promise<{ id: string }>;
type SP = Promise<{ edit?: string }>;

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const input = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit" } as const;
const td = { padding: "8px 10px", borderBottom: "1px solid var(--rv-border)" } as const;
const STATUT = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé" } as const;

export default async function DevisPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const c = await getClient(id);
  if (!c) notFound();
  const [q, s] = await Promise.all([getQuote(id), getQuoteSettings()]);
  const back = { href: `/clients/${id}`, label: "Retour à la fiche" };
  const reglages = <Link className="btn-ghost" href={`/clients/devis-reglages?back=/clients/${id}/devis`}>Mes tarifs et mentions</Link>;

  if (!q) {
    return (
      <AuditSheet kicker="Devis" title={c.name} subtitle="Pas encore de devis" back={back} actions={reglages}>
        <form action={createQuoteAction} className="no-print" style={{ display: "grid", gap: 10, marginTop: 20, maxWidth: 480 }}>
          <input type="hidden" name="id" value={c.id} />
          <span>Partir de l&apos;offre :</span>
          <select name="offre" style={input}>{s.offres.map((o, i) => <option key={i} value={i}>{o.nom}</option>)}</select>
          <SubmitButton pending="Création...">Créer le devis</SubmitButton>
          {s.offres.every((o) => o.lignes.every((l) => !l.montant)) && <p style={{ fontSize: 13, color: "#d9820b" }}>Tes tarifs ne sont pas encore renseignés : ouvre « Mes tarifs et mentions » pour les saisir une fois pour toutes.</p>}
        </form>
      </AuditSheet>
    );
  }

  const t = totals(q);
  const date = new Date(q.date);
  const until = new Date(date.getTime() + s.validiteJours * 864e5);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const editing = sp.edit === "1";
  const rows = [...q.lignes, ...Array.from({ length: Math.max(0, 8 - q.lignes.length) }, () => ({ libelle: "", type: "unique" as const, montant: 0 }))];

  return (
    <AuditSheet kicker={`Devis ${q.numero}`} title={q.offreNom} subtitle={`Pour ${c.name} · ${fmt(date)} · valable jusqu'au ${fmt(until)}`} back={back}
      footer={`${s.raisonSociale} · ${s.adresse}${s.siret ? ` · SIRET ${s.siret}` : ""} · ${s.email}${s.telephone ? ` · ${s.telephone}` : ""}`}
      actions={<>{reglages}<Link className="btn-ghost" href={editing ? `/clients/${id}/devis` : `/clients/${id}/devis?edit=1`}>{editing ? "Aperçu" : "Modifier"}</Link></>}>
      {editing ? (
        <form action={saveQuoteAction} className="no-print" style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <input type="hidden" name="id" value={c.id} />
          <label>Titre de l&apos;offre<input name="offreNom" defaultValue={q.offreNom} style={input} /></label>
          {rows.map((l, i) => (
            <div key={i} style={{ display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 4fr) minmax(0, 1.2fr) minmax(0, 1fr)" }}>
              <input name={`l${i}_libelle`} defaultValue={l.libelle} placeholder={`Ligne ${i + 1}`} style={input} />
              <select name={`l${i}_type`} defaultValue={l.type} style={input}><option value="unique">Une fois</option><option value="mensuel">Par mois</option></select>
              <input name={`l${i}_montant`} defaultValue={l.montant || ""} placeholder="€ HT" inputMode="decimal" style={input} />
            </div>
          ))}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label>Engagement (mois)<input name="engagementMois" type="number" min={0} defaultValue={q.engagementMois} style={input} /></label>
            <label>Budget pub conseillé (€/mois, non facturé)<input name="budgetPub" defaultValue={q.budgetPub ?? ""} inputMode="decimal" style={input} /></label>
            <label>Statut<select name="statut" defaultValue={q.statut} style={input}>{Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <label>Note<textarea name="notes" rows={3} defaultValue={q.notes} style={input} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="garantie" defaultChecked={q.garantie} /> Inclure la garantie (clause de vérité)</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="redate" /> Mettre la date du jour</label>
          <p className="subtitle" style={{ margin: 0, fontSize: 12 }}>Statut « Envoyé » : fiche en « Proposition envoyée ». « Accepté » : fiche en « Signé ». « Refusé » : fiche en « Perdu ».</p>
          <div><SubmitButton pending="Enregistrement...">Enregistrer le devis</SubmitButton></div>
        </form>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 18, fontSize: 13 }}>
            <div><div className="rv-kicker">Prestataire</div><strong>{s.raisonSociale}</strong><br />{s.adresse}<br />{s.email}{s.telephone && <><br />{s.telephone}</>}{s.siret && <><br />SIRET {s.siret}</>}</div>
            <div style={{ textAlign: "right" }}><div className="rv-kicker">Client</div><strong>{c.name}</strong>{c.contact_email && <><br />{c.contact_email}</>}{c.website && <><br />{c.website}</>}</div>
          </div>
          <section>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...td, textAlign: "left", fontSize: 12 }}>Prestation</th><th style={{ ...td, textAlign: "right", fontSize: 12 }}>Fréquence</th><th style={{ ...td, textAlign: "right", fontSize: 12 }}>Montant HT</th></tr></thead>
              <tbody>{q.lignes.map((l, i) => (
                <tr key={i}><td style={td}>{l.libelle}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{l.type === "mensuel" ? "par mois" : "une fois"}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{eur(l.montant)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ display: "grid", justifyContent: "end", gap: 4, marginTop: 12, textAlign: "right" }}>
              {t.unique > 0 && <div>Mise en place : <strong>{eur(t.unique)}</strong></div>}
              {t.mensuel > 0 && <div>Honoraires mensuels : <strong>{eur(t.mensuel)}</strong> par mois</div>}
              {q.engagementMois > 0 && t.mensuel > 0 && <div style={{ fontSize: 16 }}>Total sur {q.engagementMois} mois : <strong>{eur(t.engagement)}</strong></div>}
              <div style={{ fontSize: 12, color: "var(--rv-muted)" }}>{s.mentionTva}</div>
            </div>
          </section>
          {q.budgetPub ? <p style={{ marginTop: 18 }}>Budget publicitaire conseillé : <strong>{eur(q.budgetPub)} par mois</strong>, payé directement aux régies (Google, Meta), non inclus dans ce devis.</p> : null}
          {q.notes && <p style={{ whiteSpace: "pre-wrap" }}>{q.notes}</p>}
          {q.garantie && s.garantie && <section><h2 className="rv-h2">Notre engagement</h2><p>{s.garantie}</p></section>}
          <section><h2 className="rv-h2">Conditions</h2>
            <p style={{ fontSize: 13 }}>{q.engagementMois > 0 ? `Engagement de ${q.engagementMois} mois, puis sans engagement, résiliable chaque mois. ` : ""}{s.conditionsPaiement} Devis valable {s.validiteJours} jours.</p>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 30, breakInside: "avoid" }}>
            <div style={{ border: "1px solid var(--rv-border)", borderRadius: 10, padding: 14, minHeight: 110 }}><div className="rv-kicker">{s.raisonSociale}</div></div>
            <div style={{ border: "1px solid var(--rv-border)", borderRadius: 10, padding: 14, minHeight: 110 }}><div className="rv-kicker">Bon pour accord, date et signature</div><div style={{ fontSize: 12, color: "var(--rv-muted)" }}>{c.name}</div></div>
          </div>
          <p className="no-print" style={{ fontSize: 12, color: "var(--rv-muted)", marginTop: 16 }}>Statut : {STATUT[q.statut]}</p>
        </>
      )}
    </AuditSheet>
  );
}
