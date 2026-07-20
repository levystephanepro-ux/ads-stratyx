// Landing page publique — la vitrine de Stratyx (stratyxmedia.fr).
// Cible : media buyers / gérants de PME qui pilotent leurs Google Ads.
import Link from "next/link";
import { PLANS, planCredits } from "@/lib/plans";

export const dynamic = "force-static";

const FEATURES = [
  {
    icon: "💬",
    title: "Copilote IA",
    desc: "Pose tes questions en français : « Quelles campagnes gaspillent du budget ? » Le copilote interroge ton compte en direct et répond avec les vrais chiffres.",
  },
  {
    icon: "🤖",
    title: "Agents autonomes 24/7",
    desc: "Des agents qui auditent tes campagnes chaque matin et t'envoient le rapport par email. Tu te lèves, c'est déjà analysé.",
  },
  {
    icon: "⚡",
    title: "Actions avec garde-fou",
    desc: "Pause d'une campagne, ajustement de budget : le copilote propose, TU valides. Rien n'est modifié sans ton accord explicite.",
  },
  {
    icon: "📋",
    title: "40+ templates prêts à l'emploi",
    desc: "Audit RSA, détection d'annonces low-CTR, mots-clés négatifs, opportunités de budget… Un clic et l'analyse démarre.",
  },
  {
    icon: "🔍",
    title: "Search Console intégrée",
    desc: "Ta visibilité organique à côté de tes campagnes : requêtes, pages, et opportunités Ads détectées depuis ton SEO.",
  },
  {
    icon: "🔌",
    title: "Connecteur Claude (MCP)",
    desc: "Tu as déjà Claude Pro ? Branche ton compte Google Ads directement dans Claude et discute avec tes campagnes, en illimité.",
  },
];

const STEPS = [
  { n: "1", title: "Crée ton compte", desc: "Essai gratuit 14 jours, sans carte bancaire. Tu accèdes à l'app immédiatement." },
  { n: "2", title: "On relie ton compte Google Ads", desc: "L'équipe Stratyx connecte ton compte en quelques heures. Tes données restent chez Google — accès en lecture, écriture uniquement sur validation." },
  { n: "3", title: "Délègue", desc: "Discute avec le copilote, active des agents, reçois tes rapports par email. Tes campagnes ne restent plus jamais 3 semaines sans audit." },
];

const FAQ = [
  {
    q: "J'ai besoin d'un compte Claude ?",
    a: "Non. Avec le plan Pro, tout se passe dans l'app : copilote et agents inclus. Si tu as déjà Claude Pro/Max, le plan Starter te permet de brancher tes campagnes directement dans ton Claude — c'est illimité et moins cher.",
  },
  {
    q: "Stratyx peut modifier mes campagnes sans me demander ?",
    a: "Non. Les agents sont en lecture seule par défaut. Le copilote peut proposer une action (pause, budget), mais il exige ta confirmation explicite avant d'appliquer quoi que ce soit.",
  },
  {
    q: "Comment mes données sont-elles isolées ?",
    a: "Chaque client a son espace étanche : ton copilote et tes agents ne voient que TON compte Google Ads, et tes rapports ne sont envoyés qu'à toi.",
  },
  {
    q: "Je peux résilier quand je veux ?",
    a: "Oui, sans engagement. L'essai s'arrête tout seul si tu ne t'abonnes pas — aucune carte n'est demandée.",
  },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Barre de navigation ── */}
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", maxWidth: 1080, width: "100%", margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div className="brand" style={{ fontSize: 20 }}>ads<span>·stratyx</span></div>
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="#tarifs" style={{ fontSize: 14, color: "var(--muted)" }}>Tarifs</a>
          <Link href="/login" className="btn-ghost" style={{ fontSize: 14 }}>
            Se connecter
          </Link>
          <Link href="/register" className="btn" style={{ fontSize: 14 }}>
            Essai gratuit →
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1, maxWidth: 1080, width: "100%", margin: "0 auto", padding: "0 24px 60px", boxSizing: "border-box" }}>
        {/* ── Hero ── */}
        <section style={{ textAlign: "center", padding: "64px 0 48px" }}>
          <span className="pill ok" style={{ fontSize: 12 }}>
            Essai gratuit 14 jours · sans carte bancaire
          </span>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", lineHeight: 1.15, margin: "20px auto 16px", maxWidth: 760, letterSpacing: "-0.02em" }}>
            Pilote tes Google Ads{" "}
            <span style={{ color: "var(--accent-2)" }}>en langage naturel</span>
          </h1>
          <p className="subtitle" style={{ fontSize: 17, maxWidth: 620, margin: "0 auto 28px", lineHeight: 1.6 }}>
            Un copilote IA qui connaît tes campagnes, et des agents qui les
            auditent tous les matins pendant que tu dors. Fini les exports, les
            tableurs et les audits repoussés.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn" style={{ fontSize: 16, padding: "13px 28px" }}>
              Démarrer l&apos;essai gratuit →
            </Link>
            <a href="#comment" className="btn-ghost" style={{ fontSize: 16, padding: "13px 28px" }}>
              Comment ça marche
            </a>
          </div>

          {/* Aperçu conversation */}
          <div
            className="card"
            style={{ maxWidth: 620, margin: "44px auto 0", textAlign: "left", padding: 20 }}
          >
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 10px" }}>
                <strong style={{ color: "var(--accent-2)" }}>Toi :</strong>{" "}
                Quelles campagnes ont un CPA au-dessus de 40€ ce mois-ci ?
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "var(--accent)" }}>Stratyx :</strong>{" "}
                2 campagnes dépassent ce seuil : « Search — Fenêtres » (CPA 52,30€,
                +38% vs juin) et « PMax — Rénovation » (CPA 47,10€). La première
                brûle 68% de son budget sur 3 requêtes hors-cible — je peux te
                lister les mots-clés négatifs à ajouter ?
              </p>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ padding: "40px 0" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 32 }}>
            Tout ce qu&apos;un media buyer fait à la main.{" "}
            <span style={{ color: "var(--accent-2)" }}>En automatique.</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{f.title}</div>
                <p className="subtitle" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comment ça marche ── */}
        <section id="comment" style={{ padding: "40px 0" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 32 }}>
            Opérationnel en 24h
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {STEPS.map((s) => (
              <div className="card" key={s.n}>
                <div
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "var(--accent)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 16, marginBottom: 12,
                  }}
                >
                  {s.n}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{s.title}</div>
                <p className="subtitle" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tarifs ── */}
        <section id="tarifs" style={{ padding: "40px 0" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 8 }}>
            Deux offres, selon ton usage
          </h2>
          <p className="subtitle" style={{ textAlign: "center", marginBottom: 32 }}>
            14 jours d&apos;essai gratuit sur les deux. Sans engagement.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, maxWidth: 760, margin: "0 auto" }}>
            {/* Starter */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{PLANS.starter.label}</div>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
                Tu as déjà Claude Pro ou Max
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
                {PLANS.starter.priceEur}€<span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>/mois</span>
              </div>
              <ul className="subtitle" style={{ fontSize: 13.5, lineHeight: 1.9, margin: "0 0 20px", paddingLeft: 18 }}>
                <li>Connecteur MCP dans ton Claude (illimité)</li>
                <li>{PLANS.starter.maxAgents} agents IA programmés</li>
                <li>{planCredits("starter")} crédits IA in-app / mois</li>
                <li>Templates + Search Console</li>
              </ul>
              <Link href="/register" className="btn-ghost" style={{ width: "100%", justifyContent: "center", display: "flex", boxSizing: "border-box" }}>
                Essayer gratuitement
              </Link>
            </div>
            {/* Pro */}
            <div className="card" style={{ border: "2px solid var(--accent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{PLANS.pro.label}</div>
                <span className="pill ok" style={{ fontSize: 11 }}>Recommandé</span>
              </div>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
                Tout dans l&apos;app, pas besoin de compte Claude
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
                {PLANS.pro.priceEur}€<span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>/mois</span>
              </div>
              <ul className="subtitle" style={{ fontSize: 13.5, lineHeight: 1.9, margin: "0 0 20px", paddingLeft: 18 }}>
                <li>Copilote IA intégré</li>
                <li>{PLANS.pro.maxAgents} agents IA programmés</li>
                <li>{planCredits("pro")} crédits IA / mois</li>
                <li>Personas + support prioritaire</li>
              </ul>
              <Link href="/register" className="btn" style={{ width: "100%", justifyContent: "center", display: "flex", boxSizing: "border-box" }}>
                Essayer gratuitement →
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding: "40px 0", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 28 }}>
            Questions fréquentes
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {FAQ.map((f) => (
              <details className="card" key={f.q} style={{ padding: "14px 18px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14.5, userSelect: "none" }}>
                  {f.q}
                </summary>
                <p className="subtitle" style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section style={{ textAlign: "center", padding: "48px 0 20px" }}>
          <h2 style={{ fontSize: 26, marginBottom: 12 }}>
            Tes campagnes méritent un audit quotidien.
          </h2>
          <p className="subtitle" style={{ marginBottom: 24 }}>
            Crée ton compte, on te connecte sous 24h.
          </p>
          <Link href="/register" className="btn" style={{ fontSize: 16, padding: "13px 28px" }}>
            Démarrer l&apos;essai gratuit →
          </Link>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)", padding: "20px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 10, maxWidth: 1080, width: "100%",
          margin: "0 auto", boxSizing: "border-box",
        }}
      >
        <span className="subtitle" style={{ fontSize: 12.5 }}>
          © {new Date().getFullYear()} Stratyx · stratyxmedia.fr
        </span>
        <span className="subtitle" style={{ fontSize: 12.5 }}>
          <a href="mailto:levy.stephane.pro@gmail.com" style={{ color: "var(--muted)" }}>Contact</a>
          {" · "}
          <Link href="/pricing" style={{ color: "var(--muted)" }}>Tarifs</Link>
          {" · "}
          <Link href="/login" style={{ color: "var(--muted)" }}>Connexion</Link>
        </span>
      </footer>
    </div>
  );
}
