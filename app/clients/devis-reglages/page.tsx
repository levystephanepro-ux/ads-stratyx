// Réglages des devis : coordonnées, catalogue de prestations (désignations à variables) et packs.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getQuoteSettings, UNITES, CATEGORIES, VARIABLES, type CatalogItem } from "@/lib/clients/quotes";
import { saveQuoteSettingsAction } from "../quote-actions";

export const dynamic = "force-dynamic";
const input = { padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit", fontSize: 14 } as const;
const lab = { fontSize: 11.5, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 } as const;
type SP = Promise<{ ok?: string; back?: string }>;
const eur = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

export default async function DevisReglages({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const s = await getQuoteSettings();
  const blank = (): CatalogItem => ({ id: "", cat: "", titre: "", detail: "", unite: "forfait", prix: 0, qte: 1, type: "unique", quand: "" });
  const items = [...s.catalogue, blank(), blank(), blank()];
  const packs = [...s.offres, { nom: "", engagementMois: 3, notes: "", lignes: [], items: [] as string[] }];
  const cats = [...new Set([...CATEGORIES, ...s.catalogue.map((x) => x.cat)])];
  const order = (cat: string) => { const i = cats.indexOf(cat); return i < 0 ? 99 : i; };
  const indexed = items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.titre ? 0 : 1) - (b.it.titre ? 0 : 1) || order(a.it.cat) - order(b.it.cat));

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href={sp.back ?? "/clients"}>Retour</Link>}>
      <h1 style={{ margin: "0 0 6px" }}>Catalogue et réglages des devis</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>Ton catalogue de prestations sert à composer chaque devis : à la main, depuis un pack, ou par l&apos;IA. Tout reste modifiable dans le devis.</p>
      {sp.ok && <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Réglages enregistrés.</div>}

      <form action={saveQuoteSettingsAction} style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <input type="hidden" name="back" value={sp.back ?? ""} />
        <input type="hidden" name="nCat" value={items.length} />
        <input type="hidden" name="nPack" value={packs.length} />
        <datalist id="cats">{cats.map((x) => <option key={x} value={x} />)}</datalist>

        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Tes coordonnées et mentions</summary>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 12 }}>
            <div><span style={lab}>Nom commercial</span><input name="raisonSociale" defaultValue={s.raisonSociale} style={input} /></div>
            <div><span style={lab}>Adresse</span><input name="adresse" defaultValue={s.adresse} style={input} /></div>
            <div><span style={lab}>Email</span><input name="email" defaultValue={s.email} style={input} /></div>
            <div><span style={lab}>Téléphone</span><input name="telephone" defaultValue={s.telephone} style={input} /></div>
            <div><span style={lab}>SIRET</span><input name="siret" defaultValue={s.siret} placeholder="en cours d'attribution" style={input} /></div>
            <div><span style={lab}>Mention TVA</span><input name="mentionTva" defaultValue={s.mentionTva} style={input} /></div>
            <div><span style={lab}>Validité du devis (jours)</span><input name="validiteJours" type="number" min={1} defaultValue={s.validiteJours} style={input} /></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Conditions de paiement</span><textarea name="conditionsPaiement" rows={2} defaultValue={s.conditionsPaiement} style={input} /></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Garantie (clause de vérité)</span><textarea name="garantie" rows={2} defaultValue={s.garantie} style={input} /></div>
          </div>
        </details>

        <section className="card" style={{ display: "grid", gap: 10 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Catalogue de prestations</h2>
            <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>Prix de départ indicatifs (freelance senior, TPE et artisans) : ajuste-les. Variables remplies automatiquement dans le titre et le détail :{" "}
              {VARIABLES.map((v, i) => <span key={v.v}><code>{v.v}</code> {v.desc}{i < VARIABLES.length - 1 ? ", " : "."}</span>)}{" "}
              Sans réponse dans le questionnaire, la variable apparaît entre crochets pour la compléter.</p>
          </div>
          {indexed.map(({ it, i }, k) => {
            const head = it.titre ? `${it.titre}` : "Nouvelle prestation";
            const sub = it.titre ? `${it.cat} · ${it.unite === "pct_budget" ? `${it.prix} % du budget` : `${eur(it.prix)} / ${UNITES[it.unite]}`}${it.type === "mensuel" ? ", chaque mois" : ""}` : "";
            const newCat = k === 0 || indexed[k - 1].it.cat !== it.cat || !it.titre;
            return (
              <div key={i}>
                {newCat && it.titre && <div style={{ ...lab, marginTop: 8 }}>{it.cat}</div>}
                {!it.titre && k > 0 && indexed[k - 1].it.titre && <div style={{ ...lab, marginTop: 8 }}>Ajouter une prestation</div>}
                <details style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
                  <summary style={{ cursor: "pointer" }}><strong style={{ fontWeight: 600 }}>{head}</strong> <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{sub}</span></summary>
                  <input type="hidden" name={`c${i}_id`} value={it.id} />
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 3fr)" }}>
                      <div><span style={lab}>Catégorie (section du devis)</span><input name={`c${i}_cat`} list="cats" defaultValue={it.cat} style={input} /></div>
                      <div><span style={lab}>Titre</span><input name={`c${i}_titre`} defaultValue={it.titre} style={input} /></div>
                    </div>
                    <div><span style={lab}>Détail (une puce par ligne)</span><textarea name={`c${i}_detail`} rows={3} defaultValue={it.detail} style={input} /></div>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                      <div><span style={lab}>Unité</span><select name={`c${i}_unite`} defaultValue={it.unite} style={input}>{Object.entries(UNITES).map(([u, v]) => <option key={u} value={u}>{v}</option>)}</select></div>
                      <div><span style={lab}>{it.unite === "pct_budget" ? "Taux %" : "Prix unitaire HT"}</span><input name={`c${i}_prix`} defaultValue={it.prix || ""} inputMode="decimal" style={input} /></div>
                      <div><span style={lab}>Quantité par défaut</span><input name={`c${i}_qte`} defaultValue={it.qte} inputMode="decimal" style={input} /></div>
                      <div><span style={lab}>Fréquence</span><select name={`c${i}_type`} defaultValue={it.type} style={input}><option value="unique">Une fois</option><option value="mensuel">Par mois</option></select></div>
                    </div>
                    <div><span style={lab}>Quand la proposer (guide l&apos;IA)</span><input name={`c${i}_quand`} defaultValue={it.quand} style={input} /></div>
                    {it.titre && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--red)" }}><input type="checkbox" name={`c${i}_suppr`} /> Supprimer cette prestation</label>}
                  </div>
                </details>
              </div>
            );
          })}
        </section>

        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Packs</h2>
            <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>Un pack est une sélection de prestations du catalogue, point de départ d&apos;un devis.</p>
          </div>
          {packs.map((o, k) => (
            <details key={k} open={!o.nom ? undefined : undefined} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
              <summary style={{ cursor: "pointer" }}><strong style={{ fontWeight: 600 }}>{o.nom || "Nouveau pack"}</strong> {o.nom && <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{(o.items ?? []).length} prestation(s), engagement {o.engagementMois} mois</span>}</summary>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr)" }}>
                  <div><span style={lab}>Nom du pack</span><input name={`p${k}_nom`} defaultValue={o.nom} style={input} /></div>
                  <div><span style={lab}>Engagement (mois)</span><input name={`p${k}_engagement`} type="number" min={0} defaultValue={o.engagementMois} style={input} /></div>
                </div>
                <div style={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  {s.catalogue.map((x) => (
                    <label key={x.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
                      <input type="checkbox" name={`p${k}_items`} value={x.id} defaultChecked={(o.items ?? []).includes(x.id)} /> {x.titre}
                    </label>
                  ))}
                </div>
                <div><span style={lab}>Note en bas de devis</span><textarea name={`p${k}_notes`} rows={2} defaultValue={o.notes} style={input} /></div>
                {o.nom && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--red)" }}><input type="checkbox" name={`p${k}_suppr`} /> Supprimer ce pack</label>}
              </div>
            </details>
          ))}
        </section>

        <div className="sticky-actions"><SubmitButton pending="Enregistrement...">Enregistrer</SubmitButton></div>
      </form>
    </Shell>
  );
}
