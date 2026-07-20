import { PLANS, planCredits } from "@/lib/plans";

export const dynamic = "force-dynamic";

const OFFERS = [
  {
    id: "starter",
    plan: PLANS.starter,
    tagline: "Tu as déjà Claude Pro ou Max",
    highlight: false,
    features: [
      "Connecteur MCP dans TON Claude (illimité, sur ton abonnement Claude)",
      "Connexion à ton compte Google Ads (MCC)",
      `${PLANS.starter.maxAgents} agents IA programmés (rapports par email)`,
      "Bibliothèque de templates de prompts",
      "Analyse Search Console",
      `${planCredits("starter")} crédits IA in-app / mois`,
      "Support par email",
    ],
  },
  {
    id: "pro",
    plan: PLANS.pro,
    tagline: "Tout dans l'app, pas besoin de compte Claude",
    highlight: true,
    features: [
      "Copilote Google Ads IA intégré",
      `${PLANS.pro.maxAgents} agents IA programmés (rapports par email)`,
      "Connecteur Claude MCP (si tu as Claude)",
      "Connexion multi-comptes MCC",
      "Analyse Search Console",
      "Générateur de personas",
      `${planCredits("pro")} crédits IA / mois`,
      "Support prioritaire",
    ],
  },
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
      <div style={{ maxWidth: 880, width: "100%", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="brand" style={{ marginBottom: 16, fontSize: 22 }}>
            ads<span>·stratyx</span>
          </div>
          <h1 style={{ fontSize: 32, margin: "0 0 10px" }}>
            Deux offres, selon <span style={{ color: "var(--accent-2)" }}>ton usage</span>
          </h1>
          <p className="subtitle" style={{ fontSize: 15 }}>
            14 jours d&apos;essai gratuit sur les deux. Sans engagement.
          </p>
        </div>

        {checkout === "cancelled" && (
          <div className="card" style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--muted) 40%, transparent)", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Paiement annulé. Ton essai est toujours actif.
          </div>
        )}

        {trial === "expired" && (
          <div className="card" style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--red) 40%, transparent)", fontSize: 13, color: "var(--red)", textAlign: "center" }}>
            Ton essai gratuit est terminé. Choisis une offre pour continuer à utiliser ads·stratyx.
          </div>
        )}

        {/* Cartes des offres */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {OFFERS.map((offer) => (
            <div
              key={offer.id}
              className="card"
              style={{
                border: offer.highlight ? "2px solid var(--accent)" : "1px solid var(--border)",
                position: "relative",
              }}
            >
              {offer.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700,
                  padding: "3px 12px", borderRadius: 99, letterSpacing: "0.06em",
                  textTransform: "uppercase", whiteSpace: "nowrap",
                }}>
                  Recommandé
                </div>
              )}

              <div style={{ textAlign: "center", marginBottom: 20, paddingTop: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                  {offer.plan.label}
                </div>
                <div className="subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
                  {offer.tagline}
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>
                  {offer.plan.priceEur}€
                  <span style={{ fontSize: 15, fontWeight: 400, color: "var(--muted)" }}>/mois</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Sans engagement · Résiliable à tout moment
                </div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "grid", gap: 9 }}>
                {offer.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="8" cy="8" r="7.5" fill="color-mix(in srgb, var(--accent) 15%, transparent)" stroke="var(--accent)" strokeWidth="1"/>
                      <path d="M4.5 8l2.5 2.5 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {offer.id === "pro" && stripeReady ? (
                <form action="/api/stripe/checkout" method="post">
                  <button type="submit" style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 0" }}>
                    Passer {offer.plan.label} →
                  </button>
                </form>
              ) : (
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Abonnement ads·stratyx ${offer.plan.label}`)}&body=${encodeURIComponent(`Bonjour, je souhaite activer l'offre ${offer.plan.label} (${offer.plan.priceEur}€/mois).`)}`}
                  className={offer.highlight ? "btn" : "btn-ghost"}
                  style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "12px 0", display: "flex", boxSizing: "border-box" }}
                >
                  Nous contacter pour activer →
                </a>
              )}
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--muted)", opacity: 0.7 }}>
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
