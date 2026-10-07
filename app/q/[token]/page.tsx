// Lien public du questionnaire de découverte : pas de connexion.
import { notFound } from "next/navigation";
import QuestionFields from "@/components/QuestionFields";
import { getClientByToken } from "@/lib/clients/store";
import { submitQuestionnaireAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questionnaire de découverte", robots: { index: false, follow: false } };

type P = Promise<{ token: string }>;
type SP = Promise<{ ok?: string; v?: string }>;

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
      {sp.ok === "1" && (
        <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Merci, vos réponses sont bien enregistrées. Vous pouvez encore les modifier ci-dessous.</div>
      )}
      <form action={submitQuestionnaireAction} style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="v" value={short ? "court" : ""} />
        <input name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />
        <QuestionFields answers={c.answers ?? {}} mode={short ? "court" : "public"} />
        <button type="submit">Envoyer mes réponses</button>
      </form>
    </main>
  );
}
