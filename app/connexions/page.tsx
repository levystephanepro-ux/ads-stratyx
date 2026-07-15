// Page Connexions — comptes Google Ads du MCC + connecteur Claude (MCP).
import { getAppUrl } from "@/lib/app-url";
import { adsConfig, isLive, hasEnvAccount } from "@/lib/google-ads/config";
import { listManagedAccounts } from "@/lib/google-ads/client";
import { getSetting, supabaseReady } from "@/lib/agent/store";
import { getOAuthMeta } from "@/lib/oauth-store";
import ConnexionsManager, { type ManagedAccount } from "@/components/ConnexionsManager";
import ConnexionsGscCard from "@/components/ConnexionsGscCard";
import McpUrlBox from "@/components/McpUrlBox";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function ConnexionsPage() {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const tok = ctx.mcpToken;
  const mcpUrl = `${getAppUrl()}/api/mcp?token=${tok}`;
  const dbReady = supabaseReady();
  const gscMeta = await getOAuthMeta(tok, "gsc");
  const gscConnected = gscMeta !== null;
  const connectUrl = `/api/auth/gsc/connect?token=${encodeURIComponent(tok)}`;

  let accounts: ManagedAccount[] = [];
  let fetchError: string | null = null;
  if (isLive() && hasEnvAccount()) {
    try {
      accounts = await listManagedAccounts(adsConfig.refreshToken);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }
  }

  const defaultCustomerId =
    (await getSetting("default_customer_id")) || adsConfig.customerId;

  return (
    <Shell active="connexions" token={tok} trialDaysLeft={ctx.trialDaysLeft}>
      <h1 className="page-title">🔗 Connexions</h1>
      <p className="page-lede">
        Tes comptes Google Ads (via ton compte manager MCC) et le connecteur Stratyx.
      </p>

      {/* Comptes Google Ads */}
      <div className="section-title">
        Comptes Google Ads {adsConfig.loginCustomerId && `· MCC ${adsConfig.loginCustomerId}`}
      </div>

      {fetchError && (
        <div
          className="card"
          style={{ marginBottom: 16, borderColor: "color-mix(in srgb, var(--red) 45%, transparent)" }}
        >
          <strong style={{ color: "var(--red)" }}>Erreur Google Ads</strong>
          <p className="mono" style={{ marginTop: 8, marginBottom: 0 }}>{fetchError}</p>
        </div>
      )}

      {!isLive() || !hasEnvAccount() ? (
        <div className="card">
          <p className="subtitle" style={{ margin: 0 }}>
            Mode démo — connecte un compte Google Ads réel pour gérer les comptes du MCC.
          </p>
        </div>
      ) : (
        <ConnexionsManager
          accounts={accounts}
          defaultCustomerId={defaultCustomerId}
          token={tok}
          dbReady={dbReady}
        />
      )}

      {/* Google Search Console */}
      <div className="section-title" style={{ marginTop: 36 }}>
        Google Search Console
      </div>
      <ConnexionsGscCard
        connected={gscConnected}
        email={gscMeta?.email ?? null}
        connectUrl={connectUrl}
        token={tok}
      />

      {/* Connecteurs externes */}
      <div className="section-title" style={{ marginTop: 36 }}>
        Connecteurs externes recommandés
      </div>
      <p className="subtitle" style={{ marginBottom: 16, fontSize: 13 }}>
        ads·stratyx se branche <strong>à côté</strong> des MCPs officiels gratuits.
        Tu actives le connecteur chez le provider, il cohabite avec ads·stratyx dans
        Claude — aucun crédit consommé ici.
      </p>

      {/* Meta Ads */}
      <div
        className="card"
        style={{
          marginBottom: 12,
          background:
            "linear-gradient(150deg, color-mix(in srgb, #1877f2 8%, var(--surface)), var(--surface))",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* Icône Meta */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#1877f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ∞
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Meta Ads</span>
              <span
                className="pill ok"
                style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                Officiel Meta · Gratuit
              </span>
            </div>
            <p className="subtitle" style={{ margin: "0 0 14px", fontSize: 13 }}>
              Campagnes Facebook &amp; Instagram, audiences, insights, édition.
              Le MCP officiel Meta est gratuit en bêta ouverte.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href="https://developers.facebook.com/docs/marketing-api/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ fontSize: 13 }}
              >
                Récupérer mon URL chez Meta →
              </a>
              <a
                href="https://claude.ai/settings/connectors"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
                style={{ fontSize: 13 }}
              >
                Ouvrir Claude · Connecteurs
              </a>
            </div>
            <details style={{ marginTop: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.5 }}>▶</span>
                Voir les 5 étapes détaillées
              </summary>
              <ol style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {[
                  <>Clique <strong>Récupérer mon URL chez Meta</strong> ci-dessus. Tu arrives sur la page Meta Business Connectors.</>,
                  <>OAuth en 1 clic avec ton compte Meta Business. Approuve les scopes.</>,
                  <>Meta te génère une URL MCP unique du type <span className="mono" style={{ display: "inline", padding: "1px 6px", fontSize: 12 }}>https://mcp.meta.com/ads/&lt;your-id&gt;</span>. Copie-la.</>,
                  <>Va dans <strong>Claude → Settings → Connectors → Add custom connector</strong>, colle l&apos;URL, valide.</>,
                  <>Le connecteur Meta cohabite avec ads·stratyx dans Claude. Claude route Google Ads vers ads·stratyx, Meta vers Meta. <strong>Aucun crédit consommé ici.</strong></>,
                ].map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "var(--text)",
                        color: "var(--bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </div>
      </div>

      {/* Connecteur Stratyx (MCP) */}
      <div className="section-title" style={{ marginTop: 32 }}>
        Connecteur Stratyx (MCP)
      </div>
      <div className="card">
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
              userSelect: "none",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.5 }}>▶</span>
            Afficher l&apos;URL du connecteur
            <span className="pill" style={{ fontSize: 11 }}>Privé</span>
          </summary>
          <div style={{ marginTop: 14 }}>
            <p className="subtitle" style={{ marginTop: 0 }}>
              Copie cette URL, puis dans Claude : Réglages → Connecteurs → Ajouter un
              connecteur personnalisé.
            </p>
            <McpUrlBox url={mcpUrl} />
            <p className="subtitle" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
              Le token identifie ton espace. Ne le partage pas.
            </p>
          </div>
        </details>
      </div>
    </Shell>
  );
}
