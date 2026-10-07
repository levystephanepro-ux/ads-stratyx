// Devis client : document imprimable (PDF) + édition sur mesure (catalogue, quantités, remises, options, IA).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getClient } from "@/lib/clients/store";
import { getQuote, getQuoteSettings, totals, lineAmount, UNITES, CATEGORIES, type QuoteLine } from "@/lib/clients/quotes";
import { createQuoteAction, createBlankQuoteAction, aiQuoteAction, saveQuoteAction, saveQuoteStayAction } from "../../quote-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type P = Promise<{ id: string }>;
type SP = Promise<{ edit?: string; ia?: string; err?: string }>;

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const nb = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const input = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit", fontSize: 14 } as const;
const small = { fontSize: 11, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 2 } as const;
const td = { padding: "8px 10px", borderBottom: "1px solid var(--rv-border)", verticalAlign: "top" } as const;
const STATUT = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé" } as const;

function qtyLabel(l: QuoteLine) {
  if (l.unite === "pct_budget") return `${nb(l.pu ?? 0)} %`;
  const q = l.qte ?? 1, u = UNITES[l.unite ?? "forfait"];
  if (l.unite === "forfait" || !l.unite) return q === 1 ? "forfait" : `${nb(q)} forfaits`;
  return `${nb(q)} ${u}${q > 1 && !u.endsWith("s") ? "s" : ""}`;
}

function grouped(lines: QuoteLine[]) {
  const out: { section: string; lines: QuoteLine[] }[] = [];
  for (const l of lines) {
    const sec = l.section || "Prestations";
    const g = out.find((x) => x.section === sec);
    if (g) g.lines.push(l); else out.push({ section: sec, lines: [l] });
  }
  return out;
}

export default async function DevisPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const c = await getClient(id);
  if (!c) notFound();
  const [q, s] = await Promise.all([getQuote(id), getQuoteSettings()]);
  const back = { href: `/clients/${id}`, label: "Retour à la fiche" };
  const reglages = <Link className="btn-ghost" href={`/clients/devis-reglages?back=/clients/${id}/devis`}>Catalogue et mentions</Link>;
  const err = sp.err ? <div className="card no-print" style={{ borderColor: "var(--red)", marginTop: 14 }}>{sp.err}</div> : null;

  if (!q) {
    const answered = Object.keys(c.answers ?? {}).length;
    return (
      <AuditSheet kicker="Devis" title={c.name} subtitle="Pas encore de devis" back={back} actions={reglages}>
        {err}
        <div className="no-print" style={{ display: "grid", gap: 14, marginTop: 20, maxWidth: 560 }}>
          <form action={aiQuoteAction} className="card" style={{ display: "grid", gap: 8 }}>
            <input type="hidden" name="id" value={c.id} />
            <strong>Laisser l&apos;IA composer le devis</strong>
            <span className="subtitle" style={{ margin: 0, fontSize: 13 }}>Elle choisit les prestations de ton catalogue d&apos;après le questionnaire ({answered} réponse{answered > 1 ? "s" : ""}) et la proposition, avec une raison pour chaque ligne. Tes prix restent les tiens.</span>
            <div><SubmitButton pending="L'IA prépare le devis...">Proposer le devis</SubmitButton></div>
          </form>
          <form action={createQuoteAction} className="card" style={{ display: "grid", gap: 8 }}>
            <input type="hidden" name="id" value={c.id} />
            <strong>Partir d&apos;un pack</strong>
            <select name="offre" style={input}>{s.offres.map((o, i) => <option key={i} value={i}>{o.nom}</option>)}</select>
            <div><SubmitButton pending="Création...">Créer depuis ce pack</SubmitButton></div>
          </form>
          <form action={createBlankQuoteAction}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn-ghost" type="submit">Devis vierge</button>
          </form>
        </div>
      </AuditSheet>
    );
  }

  const t = totals(q);
  const date = new Date(q.date);
  const until = new Date(date.getTime() + s.validiteJours * 864e5);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const editing = sp.edit === "1";
  const included = q.lignes.filter((l) => !l.option);
  const options = q.lignes.filter((l) => l.option);
  // Anciennes lignes (montant seul) converties en quantité × prix pour l'édition.
  const editRows: QuoteLine[] = [
    ...q.lignes.map((l) => (l.pu === undefined ? { ...l, qte: 1, pu: l.montant, unite: l.unite ?? "forfait" as const } : l)),
    ...Array.from({ length: 2 }, () => ({ libelle: "", type: "unique" as const, montant: 0, qte: 1, pu: 0, unite: "forfait" as const })),
  ];
  const cats = [...new Set([...CATEGORIES, ...s.catalogue.map((x) => x.cat)])];

  const table = (lines: QuoteLine[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>
        <th style={{ ...td, textAlign: "left", fontSize: 12 }}>Désignation</th>
        <th style={{ ...td, textAlign: "right", fontSize: 12, whiteSpace: "nowrap" }}>Quantité</th>
        <th style={{ ...td, textAlign: "right", fontSize: 12, whiteSpace: "nowrap" }}>Prix unitaire HT</th>
        <th style={{ ...td, textAlign: "right", fontSize: 12, whiteSpace: "nowrap" }}>Montant HT</th>
      </tr></thead>
      {grouped(lines).map((g) => (
        <tbody key={g.section} style={{ breakInside: "avoid" }}>
          <tr><td colSpan={4} style={{ ...td, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--rv-muted)", paddingTop: 14 }}>{g.section}</td></tr>
          {g.lines.map((l, i) => {
            const m = lineAmount(l, q.budgetPub);
            return (
              <tr key={i}>
                <td style={td}>
                  <strong style={{ fontWeight: 600 }}>{l.libelle}</strong>
                  {l.detail && <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--rv-muted)" }}>{l.detail.split("\n").filter(Boolean).map((d, k) => <li key={k}>{d}</li>)}</ul>}
                  {!!l.remise && <div style={{ fontSize: 12, color: "var(--rv-muted)", marginTop: 2 }}>Remise {nb(l.remise)} %</div>}
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{l.pu === undefined ? "" : qtyLabel(l)}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{l.pu === undefined ? "" : l.unite === "pct_budget" ? "du budget pub" : eur(l.pu)}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{l.unite === "pct_budget" && !q.budgetPub ? "selon budget" : eur(m)}{l.type === "mensuel" ? " / mois" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );

  return (
    <AuditSheet kicker={`Devis ${q.numero}`} title={q.offreNom} subtitle={`Pour ${c.name} · ${fmt(date)} · valable jusqu'au ${fmt(until)}`} back={back}
      footer={`${s.raisonSociale} · ${s.adresse}${s.siret ? ` · SIRET ${s.siret}` : ""} · ${s.email}${s.telephone ? ` · ${s.telephone}` : ""}`}
      actions={<>{reglages}<Link className="btn-ghost" href={editing ? `/clients/${id}/devis` : `/clients/${id}/devis?edit=1`}>{editing ? "Aperçu" : "Modifier"}</Link></>}>
      {err}
      {editing ? (
        <div className="no-print" style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {q.ia && (
            <details className="card" open={sp.ia === "1"} style={{ borderColor: "var(--accent)" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Pourquoi ces lignes (proposition de l&apos;IA)</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5 }}>{q.ia.raisons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>Vérifie chaque ligne : les crochets comme [zone] signalent une information absente du questionnaire.</p>
            </details>
          )}
          <form action={aiQuoteAction} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={c.id} />
            <SubmitButton pending="L'IA prépare le devis...">{q.ia ? "Relancer la proposition de l'IA" : "Proposer les lignes avec l'IA"}</SubmitButton>
            <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Remplace les lignes actuelles. Tes prix du catalogue sont conservés.</span>
          </form>

          <form action={saveQuoteAction} style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={c.id} />
            <datalist id="sections">{cats.map((x) => <option key={x} value={x} />)}</datalist>
            <label><span style={small}>Titre du devis</span><input name="offreNom" defaultValue={q.offreNom} style={input} /></label>

            {editRows.map((l, i) => (
              <div key={i} className="card" style={{ display: "grid", gap: 8, padding: 12, opacity: l.libelle ? 1 : 0.75 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 3fr) minmax(0, 1fr)" }}>
                  <label><span style={small}>Section</span><input name={`l${i}_section`} list="sections" defaultValue={l.section ?? ""} style={input} /></label>
                  <label><span style={small}>{l.libelle ? `Ligne ${i + 1}` : "Nouvelle ligne"}</span><input name={`l${i}_libelle`} defaultValue={l.libelle} placeholder="Désignation" style={input} /></label>
                  <label><span style={small}>Fréquence</span><select name={`l${i}_type`} defaultValue={l.type} style={input}><option value="unique">Une fois</option><option value="mensuel">Par mois</option></select></label>
                </div>
                <label><span style={small}>Détail (une puce par ligne)</span><textarea name={`l${i}_detail`} rows={l.detail ? Math.min(5, l.detail.split("\n").length + 1) : 2} defaultValue={l.detail ?? ""} style={input} /></label>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", alignItems: "end" }}>
                  <label><span style={small}>Unité</span><select name={`l${i}_unite`} defaultValue={l.unite ?? "forfait"} style={input}>{Object.entries(UNITES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label><span style={small}>Quantité</span><input name={`l${i}_qte`} defaultValue={nb(l.qte ?? 1)} inputMode="decimal" style={input} /></label>
                  <label><span style={small}>{l.unite === "pct_budget" ? "Taux %" : "Prix unitaire HT"}</span><input name={`l${i}_pu`} defaultValue={l.pu ? nb(l.pu) : ""} placeholder="€" inputMode="decimal" style={input} /></label>
                  <label><span style={small}>Remise %</span><input name={`l${i}_remise`} defaultValue={l.remise ? nb(l.remise) : ""} inputMode="decimal" style={input} /></label>
                  <div style={{ fontSize: 13, paddingBottom: 8 }}>{l.libelle ? <>= <strong>{eur(lineAmount(l, q.budgetPub))}</strong>{l.type === "mensuel" ? " / mois" : ""}</> : null}</div>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name={`l${i}_option`} defaultChecked={!!l.option} /> En option (hors total)</label>
                  {l.libelle && <label style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--red)" }}><input type="checkbox" name={`l${i}_suppr`} /> Retirer</label>}
                </div>
              </div>
            ))}

            <details className="card">
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ajouter depuis le catalogue</summary>
              {cats.filter((cat) => s.catalogue.some((x) => x.cat === cat)).map((cat) => (
                <div key={cat} style={{ marginTop: 10 }}>
                  <div style={small}>{cat}</div>
                  {s.catalogue.filter((x) => x.cat === cat).map((x) => (
                    <label key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 14 }}>
                      <input type="checkbox" name="add" value={x.id} /> {x.titre}
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{x.unite === "pct_budget" ? `${nb(x.prix)} % du budget` : `${eur(x.prix)} / ${UNITES[x.unite]}`}{x.type === "mensuel" ? ", chaque mois" : ""}</span>
                    </label>
                  ))}
                </div>
              ))}
              <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>Les lignes cochées sont ajoutées à l&apos;enregistrement, variables remplies.</p>
            </details>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <label><span style={small}>Engagement (mois)</span><input name="engagementMois" type="number" min={0} defaultValue={q.engagementMois} style={input} /></label>
              <label><span style={small}>Budget pub mensuel (non facturé)</span><input name="budgetPub" defaultValue={q.budgetPub ?? ""} inputMode="decimal" style={input} /></label>
              <label><span style={small}>Remise globale %</span><input name="remiseGlobale" defaultValue={q.remiseGlobale ? nb(q.remiseGlobale) : ""} inputMode="decimal" style={input} /></label>
              <label><span style={small}>Statut</span><select name="statut" defaultValue={q.statut} style={input}>{Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label><span style={small}>Note en bas du devis</span><textarea name="notes" rows={3} defaultValue={q.notes} style={input} /></label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="garantie" defaultChecked={q.garantie} /> Inclure la garantie (clause de vérité)</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="redate" /> Mettre la date du jour</label>
            <p className="subtitle" style={{ margin: 0, fontSize: 12 }}>Statut « Envoyé » : fiche en « Proposition envoyée ». « Accepté » : fiche en « Signé ». « Refusé » : fiche en « Perdu ».</p>
            <div className="sticky-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SubmitButton pending="Enregistrement...">Enregistrer et voir le devis</SubmitButton>
              <button className="btn-ghost" type="submit" formAction={saveQuoteStayAction}>Enregistrer et continuer</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 18, fontSize: 13 }}>
            <div><div className="rv-kicker">Prestataire</div><strong>{s.raisonSociale}</strong><br />{s.adresse}<br />{s.email}{s.telephone && <><br />{s.telephone}</>}{s.siret && <><br />SIRET {s.siret}</>}</div>
            <div style={{ textAlign: "right" }}><div className="rv-kicker">Client</div><strong>{c.name}</strong>{c.contact_name && <><br />{c.contact_name}</>}{c.contact_phone && <><br />{c.contact_phone}</>}{c.contact_email && <><br />{c.contact_email}</>}{c.website && <><br />{c.website}</>}</div>
          </div>
          <section>
            {table(included)}
            <div style={{ display: "grid", justifyContent: "end", gap: 4, marginTop: 12, textAlign: "right", breakInside: "avoid" }}>
              {t.remise > 0 && <div style={{ fontSize: 13 }}>Sous-total : {t.brutU > 0 && <>{eur(t.brutU)} de mise en place</>}{t.brutU > 0 && t.brutM > 0 && ", "}{t.brutM > 0 && <>{eur(t.brutM)} par mois</>} · remise {nb(q.remiseGlobale ?? 0)} %</div>}
              {t.unique > 0 && <div>Mise en place : <strong>{eur(t.unique)}</strong></div>}
              {t.mensuel > 0 && <div>Honoraires mensuels : <strong>{eur(t.mensuel)}</strong> par mois</div>}
              {q.engagementMois > 0 && t.mensuel > 0 && <div style={{ fontSize: 16 }}>Total sur {q.engagementMois} mois : <strong>{eur(t.engagement)}</strong></div>}
              <div style={{ fontSize: 12, color: "var(--rv-muted)" }}>{s.mentionTva}</div>
            </div>
          </section>
          {options.length > 0 && (
            <section style={{ breakInside: "avoid" }}>
              <h2 className="rv-h2">Options, non comprises dans le total</h2>
              {table(options.map((l) => ({ ...l, section: l.section || "Options" })))}
            </section>
          )}
          {q.budgetPub ? <p style={{ marginTop: 18 }}>Budget publicitaire conseillé : <strong>{eur(q.budgetPub)} par mois</strong>, payé directement aux régies (Google, Meta), non inclus dans ce devis.</p> : null}
          {q.notes && <p style={{ whiteSpace: "pre-wrap" }}>{q.notes}</p>}
          {q.garantie && s.garantie && <section style={{ breakInside: "avoid" }}><h2 className="rv-h2">Notre engagement</h2><p>{s.garantie}</p></section>}
          <section style={{ breakInside: "avoid" }}><h2 className="rv-h2">Conditions</h2>
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
