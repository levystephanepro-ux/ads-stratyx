// Réglages des devis : tes coordonnées, mentions et offres types.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getQuoteSettings } from "@/lib/clients/quotes";
import { saveQuoteSettingsAction } from "../quote-actions";

export const dynamic = "force-dynamic";
const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit" } as const;
const lab = { fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 } as const;
type SP = Promise<{ ok?: string; back?: string }>;

export default async function DevisReglages({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const s = await getQuoteSettings();
  const offres = [...s.offres, ...Array.from({ length: Math.max(0, 3 - s.offres.length) }, () => ({ nom: "", engagementMois: 3, notes: "", lignes: [] }))].slice(0, 3);

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href={sp.back ?? "/clients"}>Retour</Link>}>
      <h1 style={{ margin: "0 0 6px" }}>Réglages des devis</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>Tes coordonnées et tes offres types. Chaque devis part d&apos;une offre, puis se modifie librement.</p>
      {sp.ok && <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Réglages enregistrés.</div>}
      <form action={saveQuoteSettingsAction} style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <input type="hidden" name="back" value={sp.back ?? ""} />
        <section className="card" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div><span style={lab}>Nom commercial</span><input name="raisonSociale" defaultValue={s.raisonSociale} style={input} /></div>
          <div><span style={lab}>Adresse</span><input name="adresse" defaultValue={s.adresse} style={input} /></div>
          <div><span style={lab}>Email</span><input name="email" defaultValue={s.email} style={input} /></div>
          <div><span style={lab}>Téléphone</span><input name="telephone" defaultValue={s.telephone} style={input} /></div>
          <div><span style={lab}>SIRET</span><input name="siret" defaultValue={s.siret} placeholder="en cours d'attribution" style={input} /></div>
          <div><span style={lab}>Mention TVA</span><input name="mentionTva" defaultValue={s.mentionTva} style={input} /></div>
          <div><span style={lab}>Validité du devis (jours)</span><input name="validiteJours" type="number" min={1} defaultValue={s.validiteJours} style={input} /></div>
          <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Conditions de paiement</span><textarea name="conditionsPaiement" rows={2} defaultValue={s.conditionsPaiement} style={input} /></div>
          <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Garantie (clause de vérité)</span><textarea name="garantie" rows={2} defaultValue={s.garantie} style={input} /></div>
        </section>
        {offres.map((o, k) => (
          <section key={k} className="card" style={{ display: "grid", gap: 10 }}>
            <strong>Offre {k + 1}{k > 0 ? " (facultative)" : ""}</strong>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr)" }}>
              <div><span style={lab}>Nom de l&apos;offre</span><input name={`o${k}_nom`} defaultValue={o.nom} style={input} /></div>
              <div><span style={lab}>Engagement (mois)</span><input name={`o${k}_engagement`} type="number" min={0} defaultValue={o.engagementMois} style={input} /></div>
            </div>
            {Array.from({ length: 6 }, (_, i) => o.lignes[i] ?? { libelle: "", type: "unique", montant: 0 }).map((l, i) => (
              <div key={i} style={{ display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 4fr) minmax(0, 1.2fr) minmax(0, 1fr)" }}>
                <input name={`o${k}_l${i}_libelle`} defaultValue={l.libelle} placeholder={`Ligne ${i + 1}`} style={input} />
                <select name={`o${k}_l${i}_type`} defaultValue={l.type} style={input}><option value="unique">Une fois</option><option value="mensuel">Par mois</option></select>
                <input name={`o${k}_l${i}_montant`} defaultValue={l.montant || ""} placeholder="€ HT" inputMode="decimal" style={input} />
              </div>
            ))}
            <div><span style={lab}>Note en bas de devis</span><textarea name={`o${k}_notes`} rows={2} defaultValue={o.notes} style={input} /></div>
          </section>
        ))}
        <div><SubmitButton pending="Enregistrement...">Enregistrer les réglages</SubmitButton></div>
      </form>
    </Shell>
  );
}
