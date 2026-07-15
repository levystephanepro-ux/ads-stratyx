export const dynamic = "force-dynamic";

const FEATURES = [
  "Copilote Google Ads IA",
  "Agent IA autonome (rapports quotidiens)",
  "Analyse Search Console",
  "Générateur de personas",
  "Templates de prompts",
  "Connexion multi-comptes MCC",
  "Connecteur Claude MCP",
  "Support prioritaire",
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; trial?: string }>;
}) {
  const { checkout, trial } = await searchParams;
  const stripeReady = !!process.env.STRIPE_PRICE_ID && !!process.env.STRIPE_SECRET_KEY;
  const contactEmail = process.env.CONTACT_EMAIL || "levy.stephane.pro@gmail.com";

  return (
    <div className="center-screen" style={{ alignItems: "center" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: "0 16px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="brand" style={{ marginBottom: 16, fontSize: 22 }}>
            ads<span>·stratyx</span>
          </div>
          <h1 style={{ fontSize: 32, margin: "0 0 10px" }}>
            Simple &amp; <span style={{ color: "var(--accent-2)" }}>transparent</span>
          </h1>
          <p className="subtitle" style={{ fontSize: 15 }}>
            Un seul plan. Accès complet. 14 jours gratuits.
          </p>
        </div>

        {checkout === "cancelled" && (
          <div className="card" style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--muted) 40%, transparent)", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Paiement annulé. Ton essai est toujours actif.
          </div>
        )}

        {trial === "expired" && (
          <div className="card" style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--red) 40%, transparent)", fontSize: 13, color: "var(--red)", textAlign: "center" }}>
            Ton essai gratuit est terminé. Passe Pro pour continuer à utiliser ads·stratyx.
          </div>
        )}

        {/* Plan card */}
        <div className="card" style={{ border: "2px solid var(--accent)", position: "relative" }}>
          <div style={{
            position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
            background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "3px 12px", borderRadius: 99, letterSpacing: "0.06em",
            textTransform: "uppercase", whiteSpace: "nowrap",
          }}>
            14 jours gratuits
          </div>

          <div style={{ textAlign: "center", marginBottom: 24, paddingTop: 8 }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em" }}>
              97€
              <span style={{ fontSize: 16, fontWeight: 400, color: "var(--muted)" }}>/mois</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              Sans engagement · Résiliable à tout moment
            </div>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 10 }}>
            {FEATURES.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" fill="color-mix(in srgb, var(--accent) 15%, transparent)" stroke="var(--accent)" strokeWidth="1"/>
                  <path d="M4.5 8l2.5 2.5 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {stripeReady ? (
            <form action="/api/stripe/checkout" method="post">
              <button type="submit" style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 0" }}>
                Passer Pro →
              </button>
            </form>
          ) : (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent("Abonnement ads·stratyx Pro")}&body=${encodeURIComponent("Bonjour, je souhaite activer mon abonnement Pro.")}`}
              className="btn"
              style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 0", display: "flex", boxSizing: "border-box" }}
            >
              Nous contacter pour activer →
            </a>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--muted)", opacity: 0.7 }}>
          Aucune carte requise pendant l&apos;essai.
          {stripeReady ? " Paiement sécurisé par Stripe." : " Activation sous 24h après contact."}
        </p>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          Déjà un compte ?{" "}
          <a href="/login" style={{ color: "var(--accent-2)" }}>Se connecter</a>
          {" · "}
          <a href="/register" style={{ color: "var(--accent-2)" }}>Créer un compte</a>
        </p>
      </div>
    </div>
  );
}
