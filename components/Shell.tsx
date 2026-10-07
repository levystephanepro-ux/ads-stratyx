'use client'
import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import CreditGauge from "@/components/CreditGauge";
import { Icons } from "@/components/Icons";
import Owl from "@/components/Owl";

// Icônes : Lucide (components/Icons.tsx)
const Ic = Icons;

type PageKey = "home" | "copilote" | "agent" | "waste" | "scripts" | "rapports" | "comptes" | "clients" | "alertes" | "previsions" | "templates" | "connexions" | "persona" | "search-console" | "aide" | "admin";

const NAV: { key: PageKey; label: string; ic: keyof typeof Ic; href: string }[] = [
  { key: "home",       label: "Accueil",     ic: "home",       href: "/dashboard" },
  { key: "copilote",   label: "Copilote",    ic: "copilote",   href: "/copilote" },
  { key: "waste",      label: "Diagnostic",  ic: "waste",      href: "/waste" },
  { key: "scripts",    label: "Scripts",     ic: "scripts",    href: "/scripts" },
  { key: "rapports",   label: "Rapports",    ic: "rapports",   href: "/rapports" },
  { key: "alertes",    label: "Alertes",     ic: "alertes",    href: "/alertes" },
  { key: "previsions", label: "Prévisions",  ic: "previsions", href: "/previsions" },
  { key: "comptes",    label: "Comptes liés", ic: "comptes",   href: "/comptes" },
  { key: "clients",    label: "Clients",     ic: "clients",    href: "/clients" },
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
  accountName,
  children,
}: {
  active: PageKey;
  token?: string;
  headerRight?: React.ReactNode;
  trialDaysLeft?: number | null;
  showAdmin?: boolean;
  accountName?: string | null;
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
        <div className="brand"><Owl size={30} badge /><span className="brand-txt">ads<b>·stratyx</b></span></div>
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
          <div className="brand"><Owl size={30} badge /><span className="brand-txt">ads<b>·stratyx</b></span></div>
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
          {NAV.slice(0, 2).map(navLink)}
          <div className="nav-group-label" style={{ marginTop: 18 }}>Outils</div>
          {NAV.slice(2).map(navLink)}
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
          {accountName && (
            <Link
              href="/connexions"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: 8, fontSize: 12, color: "var(--muted)",
                background: "var(--surface-2)", textDecoration: "none",
                border: "1px solid var(--border)", marginBottom: 6,
              }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{Icons.chart}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {accountName}
              </span>
              <span style={{ opacity: 0.4, fontSize: 11 }}>▸</span>
            </Link>
          )}
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
