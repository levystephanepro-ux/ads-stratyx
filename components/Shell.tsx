'use client'
import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import CreditGauge from "@/components/CreditGauge";

// ── Icônes SVG inline ────────────────────────────────────────────────────────
const Ic = {
  home: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/>
      <path d="M7 18v-6h6v6"/>
    </svg>
  ),
  copilote: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7l-4 3V5Z"/>
      <path d="M6.5 8.5h7M6.5 11h4.5"/>
    </svg>
  ),
  agent: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3 9 10h7L8 17"/>
    </svg>
  ),
  templates: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  persona: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3.5"/>
      <path d="M2.5 17c0-3.314 3.358-6 7.5-6s7.5 2.686 7.5 6"/>
    </svg>
  ),
  gsc: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M10 6v4l2.5 2.5"/>
      <path d="M6.5 3.5A7.5 7.5 0 0 0 3 9"/>
    </svg>
  ),
  connexions: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4.5" cy="10" r="2"/>
      <circle cx="15.5" cy="4.5" r="2"/>
      <circle cx="15.5" cy="15.5" r="2"/>
      <path d="m6.5 10 7-4M6.5 10l7 4"/>
    </svg>
  ),
  aide: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M10 14v-1"/>
      <path d="M10 10.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4v1.5"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2 4 4.5v4c0 4.1 2.6 7.3 6 8.5 3.4-1.2 6-4.4 6-8.5v-4L10 2Z"/>
      <path d="m7.5 9.5 2 2 3.5-3.5"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M13 14l3-4-3-4M16 10H8"/>
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5h14M3 10h14M3 15h14"/>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 5l10 10M15 5 5 15"/>
    </svg>
  ),
};

type PageKey = "home" | "copilote" | "agent" | "templates" | "connexions" | "persona" | "search-console" | "aide" | "admin";

const NAV: { key: PageKey; label: string; ic: keyof typeof Ic; href: string }[] = [
  { key: "home",       label: "Accueil",     ic: "home",       href: "/dashboard" },
  { key: "copilote",   label: "Copilote",    ic: "copilote",   href: "/copilote" },
  { key: "agent",      label: "Agent IA",    ic: "agent",      href: "/agent" },
  { key: "templates",  label: "Templates",   ic: "templates",  href: "/templates" },
  { key: "persona",         label: "Persona",          ic: "persona",    href: "/persona" },
  { key: "search-console", label: "Search Console",   ic: "gsc",        href: "/search-console" },
  { key: "connexions",      label: "Connexions",       ic: "connexions", href: "/connexions" },
  { key: "aide",            label: "Aide",             ic: "aide",       href: "/aide" },
];

export default function Shell({
  active,
  token,
  headerRight,
  trialDaysLeft,
  showAdmin,
  children,
}: {
  active: PageKey;
  token?: string;
  headerRight?: React.ReactNode;
  trialDaysLeft?: number | null;
  showAdmin?: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const q = token ? `?token=${encodeURIComponent(token)}` : "";

  const navLink = (it: (typeof NAV)[number]) => {
    const href = it.key === "home" ? it.href : `${it.href}${q}`;
    const isActive = it.key === active;
    return (
      <Link
        key={it.key}
        href={href}
        className={`side-link${isActive ? " active" : ""}`}
        onClick={() => setDrawerOpen(false)}
      >
        <span className="side-ic">{Ic[it.ic]}</span>
        <span className="side-label">{it.label}</span>
        {isActive && <span className="side-dot" />}
      </Link>
    );
  };

  return (
    <div className="shell">
      {/* ── Mobile header ── */}
      <header className="mobile-header">
        <button
          className="hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
        >
          {Ic.menu}
        </button>
        <div className="brand">ads<span>·stratyx</span></div>
        <ThemeToggle />
      </header>

      {/* ── Overlay ── */}
      {drawerOpen && (
        <div
          className="nav-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${drawerOpen ? " drawer-open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">ads<span>·stratyx</span></div>
          <button
            className="drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer"
          >
            {Ic.close}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Navigation</div>
          {NAV.slice(0, 3).map(navLink)}
          <div className="nav-group-label" style={{ marginTop: 18 }}>Outils</div>
          {NAV.slice(3).map(navLink)}
          {showAdmin && (
            <>
              <div className="nav-group-label" style={{ marginTop: 18 }}>Gestion</div>
              <Link
                href="/admin"
                className={`side-link${active === "admin" ? " active" : ""}`}
                onClick={() => setDrawerOpen(false)}
              >
                <span className="side-ic">{Ic.admin}</span>
                <span className="side-label">Admin</span>
                {active === "admin" && <span className="side-dot" />}
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <CreditGauge />
          <ThemeToggle />
          <form action="/api/auth/signout" method="post" style={{ margin: 0 }}>
            <button type="submit" className="side-link logout-btn">
              <span className="side-ic">{Ic.logout}</span>
              <span className="side-label">Déconnexion</span>
            </button>
          </form>
          <span className="brand-version">ads·stratyx</span>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <main className="main">
        {trialDaysLeft !== null && trialDaysLeft !== undefined && (
          <div style={{
            padding: '10px 20px',
            background: trialDaysLeft <= 3
              ? 'color-mix(in srgb, var(--red) 12%, var(--surface))'
              : trialDaysLeft <= 7
                ? 'color-mix(in srgb, #fbbf24 10%, var(--surface))'
                : 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
            borderBottom: `1px solid ${trialDaysLeft <= 3 ? 'color-mix(in srgb, var(--red) 30%, transparent)' : trialDaysLeft <= 7 ? 'color-mix(in srgb, #fbbf24 30%, transparent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 13, gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ color: trialDaysLeft <= 3 ? 'var(--red)' : trialDaysLeft <= 7 ? '#fbbf24' : 'var(--accent-2)' }}>
              {trialDaysLeft === 0
                ? '⚠️ Ton essai a expiré.'
                : `⏳ Essai gratuit — il te reste ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''}.`}
            </span>
            <a href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-2)', whiteSpace: 'nowrap' }}>
              Passer Pro →
            </a>
          </div>
        )}
        <div className="main-inner">
          {headerRight && <div className="main-header">{headerRight}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}
