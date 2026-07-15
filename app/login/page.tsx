export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="center-screen">
      <form className="card login-card" action="/api/auth/signin" method="post">
        <div className="brand" style={{ marginBottom: 6 }}>
          ads<span>·stratyx</span>
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>Connexion</h1>
        <p className="subtitle">Accède à ton espace ads·stratyx.</p>

        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="Email"
          style={{ marginTop: 16 }}
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Mot de passe"
          style={{ marginTop: 8 }}
        />
        <button type="submit" style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>
          Se connecter
        </button>

        {error && (
          <p className="status-msg" style={{ color: "var(--red)", marginTop: 10 }}>
            Email ou mot de passe incorrect.
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--muted)" }}>
          Pas encore de compte ?{" "}
          <a href="/register" style={{ color: "var(--accent-2)" }}>
            Créer un compte
          </a>
        </p>
      </form>
    </div>
  );
}
