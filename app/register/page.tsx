export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="center-screen">
      <form className="card login-card" action="/api/auth/register" method="post">
        <div className="brand" style={{ marginBottom: 6 }}>
          ads<span>·stratyx</span>
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>Créer un compte</h1>
        <p className="subtitle">14 jours gratuits, sans carte bancaire.</p>

        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="Email professionnel"
          style={{ marginTop: 16 }}
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Mot de passe (8 caractères min.)"
          minLength={8}
          style={{ marginTop: 8 }}
        />
        <button type="submit" style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>
          Démarrer l&apos;essai gratuit
        </button>

        {error && (
          <p className="status-msg" style={{ color: "var(--red)", marginTop: 10 }}>
            {decodeURIComponent(error)}
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--muted)" }}>
          Déjà un compte ?{" "}
          <a href="/login" style={{ color: "var(--accent-2)" }}>
            Se connecter
          </a>
        </p>
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 8, opacity: 0.7 }}>
          En créant un compte, tu acceptes nos conditions d&apos;utilisation.
        </p>
      </form>
    </div>
  );
}
