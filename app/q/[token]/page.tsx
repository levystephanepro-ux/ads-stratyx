// Lien public du questionnaire de découverte : pas de connexion.
import { notFound } from "next/navigation";
import QuestionFields from "@/components/QuestionFields";
import { getClientByToken } from "@/lib/clients/store";
import { submitQuestionnaireAction, submitDraftAction, submitDoneAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questionnaire de découverte", robots: { index: false, follow: false } };

type P = Promise<{ token: string }>;
type SP = Promise<{ ok?: string; v?: string; apercu?: string }>;

export default async function PublicQuestionnaire({ params, searchParams }: { params: P; searchParams: SP }) {
  const { token } = await params;
  const sp = await searchParams;
  const c = await getClientByToken(token);
  if (!c) notFound();
  const short = sp.v === "court";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 60px" }}>
      <h1 style={{ margin: "0 0 6px" }}>Faisons connaissance{c.name ? `, ${c.name}` : ""}</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Ces questions nous permettent de construire vos campagnes Google Ads sur mesure. Comptez {short ? "5" : "10 à 15"} minutes. Répondez simplement, vous pourrez modifier vos réponses en rouvrant ce lien.
      </p>
      <p className="subtitle" style={{ fontSize: 12, margin: "0 0 12px" }}>
        Vos réponses servent uniquement à STRATYXMEDIA pour préparer notre échange et vous faire une proposition. Elles ne sont
        ni vendues ni partagées, et toutes les questions sont facultatives.{" "}
        <a href="/confidentialite" target="_blank">Politique de confidentialité</a>
      </p>
      {sp.apercu === "1" && (
        <div className="card" style={{ borderColor: "var(--accent)", margin: "0 0 12px" }}>
          Aperçu de ce que voit le client. <a href={`/clients/${c.id}`}>Retour à la fiche</a> · <a href="/dashboard">Tableau de bord</a>
        </div>
      )}
      {sp.ok === "1" && (
        <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Merci, vos réponses sont bien enregistrées. Vous pouvez encore les modifier ci-dessous.</div>
      )}
      {sp.ok === "draft" && (
        <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Brouillon enregistré. Vous pouvez fermer cette page et reprendre plus tard avec le même lien.</div>
      )}
      <form action={submitQuestionnaireAction} style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="v" value={short ? "court" : ""} />
        <input name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />
        <QuestionFields answers={c.answers ?? {}} mode={short ? "court" : "public"} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", bottom: 0, padding: "10px 0", background: "var(--bg)" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", fontSize: 13 }}>
            <input type="checkbox" name="accord" required style={{ marginTop: 3 }} />
            <span>J&apos;accepte que STRATYXMEDIA utilise ces informations pour préparer notre échange et me recontacter à ce sujet.{" "}
              <a href="/confidentialite" target="_blank">Politique de confidentialité</a></span>
          </label>
          <button type="submit" formAction={submitDoneAction}>Envoyer mes réponses</button>
          <button type="submit" formAction={submitDraftAction} formNoValidate className="btn-ghost">Enregistrer et reprendre plus tard</button>
        </div>
      </form>
      <p className="subtitle" style={{ fontSize: 12, marginTop: 20 }}>
        Modification ou suppression de vos réponses à tout moment : contact@stratyxmedia.fr ·{" "}
        <a href="/mentions-legales" target="_blank">Mentions légales</a>
      </p>
    </main>
  );
}
