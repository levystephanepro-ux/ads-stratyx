'use client'
import { useState } from "react";
import ClientSwitcher from "@/components/ClientSwitcher";
import HealthLight from "@/components/HealthLight";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import CreditGauge from "@/components/CreditGauge";
import { Icons } from "@/components/Icons";
import Owl from "@/components/Owl";

// Icônes : Lucide (components/Icons.tsx)
const Ic = Icons;

type PageKey = "home" | "copilote" | "agent" | "waste" | "scripts" | "rapports" | "comptes" | "clients" | "audit" | "alertes" | "previsions" | "templates" | "connexions" | "persona" | "search-console" | "aide" | "admin" | "sante";

const NAV: { key: PageKey; label: string; ic: keyof typeof Ic; href: string; ownerOnly?: boolean }[] = [
  { key: "home",           label: "Accueil",          ic: "home",       href: "/dashboard" },
  { key: "clients",        label: "Clients",          ic: "clients",    href: "/clients" },
  { key: "waste",          label: "Diagnostic",       ic: "waste",      href: "/waste" },
  { key: "alertes",        label: "Alertes",          ic: "alertes",    href: "/alertes" },
  { key: "copilote",       label: "Copilote",         ic: "copilote",   href: "/copilote" },
  { key: "previsions",     label: "Prévisions",       ic: "previsions", href: "/previsions" },
  { key: "persona",        label: "Persona",          ic: "persona",    href: "/persona" },
  { key: "audit",          label: "Audit prospect",   ic: "audit",      href: "/audit/prospect" },
  { key: "rapports",       label: "Rapports",         ic: "rapports",   href: "/rapports" },
  { key: "comptes",        label: "Comptes liés",     ic: "comptes",    href: "/comptes" },
  { key: "scripts",        label: "Scripts",          ic: "scripts",    href: "/scripts" },
  { key: "search-console", label: "Search Console",   ic: "gsc",        href: "/search-console" },
  { key: "connexions",     label: "Connexions",       ic: "connexions", href: "/connexions" },
  { key: "admin",          label: "Admin",            ic: "admin",      href: "/admin", ownerOnly: true },
  { key: "sante",          label: "Bilan de santé",   ic: "sante",      href: "/admin/sante", ownerOnly: true },
  { key: "aide",           label: "Aide",             ic: "aide",       href: "/aide" },
];
// Menu regroupé par usage : le parcours client d'abord, les réglages repliés en bas.
const GROUPS: { label: string | null; keys: PageKey[]; fold?: boolean }[] = [
  { label: null, keys: ["home", "clients"] },
  { label: "Pilotage", keys: ["waste", "alertes", "copilote"] },
  { label: "Création", keys: ["previsions", "persona", "audit"] },
  { label: "Suivi", keys: ["rapports"] },
  { label: "Outils", keys: ["comptes", "scripts"], fold: true },
  { label: "Réglages", keys: ["connexions", "admin", "sante", "aide"], fold: true },
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
          {GROUPS.map((g, gi) => {
            const items = g.keys
              .map((k) => NAV.find((n) => n.key === k)!)
              .filter((it) => it && (!it.ownerOnly || showAdmin));
            if (items.length === 0) return null;
            const open = items.some((it) => it.key === active);
            const body = items.map(navLink);
            if (g.fold) {
              return (
                <details key={gi} open={open ? true : undefined} className="nav-fold" style={{ marginTop: 18 }}>
                  <summary className="nav-group-label" style={{ cursor: "pointer", listStyle: "none" }}>{g.label} ▾</summary>
                  {body}
                </details>
              );
            }
            return (
              <div key={gi} style={{ marginTop: gi === 0 ? 0 : 18 }}>
                {g.label && <div className="nav-group-label">{g.label}</div>}
                {body}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          {showAdmin && <HealthLight />}
          {showAdmin && <ClientSwitcher />}
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
