// Lien public générique des partenaires (ex. Club ARIA) : demande le métier et la zone, crée une fiche, puis
// redirige vers le questionnaire court du client. Aucune fiche n'est créée à l'ouverture de la page (aperçus de liens, robots).
import type { Metadata } from "next";
import { startPartnerAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ source?: string; err?: string }>;

export const metadata: Metadata = {
  title: "Publicité Google et Meta : voir si c'est fait pour vous",
  description: "Trois questions pour savoir si votre métier est encore disponible dans votre zone. Environ 5 minutes, sans engagement.",
  robots: { index: false, follow: false },
  openGraph: { title: "Publicité Google et Meta : voir si c'est fait pour vous", siteName: "STRATYXMEDIA" },
};

const field = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit" } as const;

export default async function PartnerStart({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const source = /^[a-z0-9-]{1,30}$/i.test(sp.source ?? "") ? sp.source!.toLowerCase() : "partenaire";
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 60px" }}>
      <h1 style={{ margin: "0 0 6px" }}>La publicité est-elle faite pour vous ?</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Il n&apos;y a qu&apos;une place par métier et par zone. Dites-nous qui vous êtes : nous regardons d&apos;abord si votre place est libre, puis vous
        répondez à quelques questions (environ 5 minutes, sans engagement).
      </p>
      {sp.err === "1" && <div className="card" style={{ borderColor: "var(--accent)", margin: "12px 0" }}>Merci de remplir les trois champs et de cocher la case d&apos;accord.</div>}
      {sp.err === "2" && <div className="card" style={{ borderColor: "var(--accent)", margin: "12px 0" }}>Le service est momentanément indisponible. Réessayez dans quelques minutes, ou écrivez à contact@stratyxmedia.fr.</div>}
      <form action={startPartnerAction} style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <input type="hidden" name="source" value={source} />
        <input name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />
        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="p_name" style={{ fontWeight: 600 }}>Votre nom ou celui de votre entreprise</label>
          <input id="p_name" name="name" required maxLength={120} autoComplete="organization" style={field} />
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="p_activite" style={{ fontWeight: 600 }}>Votre métier</label>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Exemples : plombier, électricien, ostéopathe, restaurant.</span>
          <input id="p_activite" name="activite" required maxLength={200} style={field} />
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="p_zone" style={{ fontWeight: 600 }}>Votre zone</label>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Villes ou département où vous travaillez.</span>
          <input id="p_zone" name="zone" required maxLength={200} style={field} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <input type="checkbox" name="accord" required style={{ marginTop: 3 }} />
          <span>
            J&apos;accepte que STRATYXMEDIA utilise ces informations pour vérifier la disponibilité de mon métier dans ma zone, préparer notre échange et me recontacter.
            Mes réponses peuvent être partagées avec le Club ARIA. <a href="/confidentialite" target="_blank">Politique de confidentialité</a>
          </span>
        </label>
        <div><button className="btn" type="submit">Continuer</button></div>
      </form>
    </main>
  );
}
