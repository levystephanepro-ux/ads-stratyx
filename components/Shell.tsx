'use client'
import { useState } from "react";
import { usePathname } from "next/navigation";
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

// Correspondance ancienne clé de page -> adresse (repli si l'adresse courante ne suffit pas).
const KEY_HREF: Partial<Record<PageKey, string>> = {
  home: "/dashboard", clients: "/clients", waste: "/waste", alertes: "/alertes", copilote: "/copilote",
  previsions: "/previsions", persona: "/persona", audit: "/audit/prospect", rapports: "/rapports",
  comptes: "/comptes", scripts: "/scripts", connexions: "/connexions", aide: "/aide",
  admin: "/admin", sante: "/admin/sante", "search-console": "/search-console",
};

type Item = { label: string; href: string; ic?: keyof typeof Ic; ownerOnly?: boolean };
type Section = { id: string; label: string; ic: keyof typeof Ic; items: Item[] };

// Menu à plusieurs niveaux (pages existantes uniquement).
const TOP: Item[] = [
  { label: "Accueil", href: "/dashboard", ic: "home" },
  { label: "Clients", href: "/clients", ic: "clients" },
];
const SECTIONS: Section[] = [
  { id: "pilotage", label: "Pilotage", ic: "waste", items: [
    { label: "Diagnostic", href: "/waste" },
    { label: "Journal des corrections", href: "/waste/journal" },
    { label: "Alertes du matin", href: "/alertes" },
    { label: "Scripts", href: "/scripts" },
  ] },
  { id: "creation", label: "Création", ic: "previsions", items: [
    { label: "Prévisions et campagnes", href: "/previsions" },
    { label: "Persona", href: "/persona" },
    { label: "Audit prospect", href: "/audit/prospect" },
  ] },
  { id: "rapports", label: "Rapports", ic: "rapports", items: [
    { label: "Rapports clients", href: "/rapports" },
    { label: "Compte rendu mensuel", href: "/rapports/compte-rendu" },
    { label: "Impact des changements", href: "/rapports/impact" },
  ] },
];
const SETTINGS: Item[] = [
  { label: "Comptes et réglages", href: "/comptes", ic: "comptes" },
  { label: "Bilan de santé", href: "/admin/sante", ic: "sante", ownerOnly: true },
  { label: "Aide", href: "/aide", ic: "aide" },
];

const ALL_HREFS = [...TOP, ...SECTIONS.flatMap((x) => x.items), ...SETTINGS, { label: "Copilote", href: "/copilote" }].map((i) => i.href);

// Adresse du menu la plus précise qui contient la page courante.
function activeHref(path: string, fallback?: string): string | null {
  const hit = ALL_HREFS.filter((h) => path === h || path.startsWith(h + "/")).sort((x, y) => y.length - x.length)[0];
  return hit ?? fallback ?? null;
}

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

  const path = usePathname() ?? "";
  const current = activeHref(path, KEY_HREF[active]);
  const initial = SECTIONS.find((x) => x.items.some((i) => i.href === current))?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(initial);
  const close = () => setDrawerOpen(false);
  const withQ = (href: string) => (href === "/dashboard" ? href : `${href}${q}`);

  const link = (it: Item) => {
    const isActive = it.href === current;
    return (
      <Link key={it.href} href={withQ(it.href)} className={`side-link${isActive ? " active" : ""}`} onClick={close}>
        {it.ic && <span className="side-ic">{Ic[it.ic]}</span>}
        <span className="side-label">{it.label}</span>
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
          <div className="nav-group-label">Accueil</div>
          {TOP.map(link)}

          {showAdmin && (
            <>
              <div className="side-client" style={{ marginTop: 14 }}><ClientSwitcher /></div>
            </>
          )}

          <div style={{ marginTop: 10 }}>
            {SECTIONS.map((sec) => {
              const isOpen = openId === sec.id;
              const holds = sec.items.some((i) => i.href === current);
              return (
                <div key={sec.id}>
                  <button
                    type="button"
                    className={`side-link side-section${holds ? " holds" : ""}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : sec.id)}
                  >
                    <span className="side-ic">{Ic[sec.ic]}</span>
                    <span className="side-label">{sec.label}</span>
                    <span className={`side-chev${isOpen ? " open" : ""}`} aria-hidden>›</span>
                  </button>
                  {isOpen && (
                    <div className="side-sub">
                      {sec.items.map((it) => (
                        <Link key={it.href} href={withQ(it.href)} className={`side-sublink${it.href === current ? " active" : ""}`} onClick={close}>
                          {it.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link href={withQ("/copilote")} className={`side-copilot${current === "/copilote" ? " active" : ""}`} onClick={close}>
            <span className="side-ic">{Ic.copilote}</span>
            <span className="side-label">Copilote</span>
            <span className="side-pill">IA</span>
          </Link>

          <div className="side-settings">
            <div className="nav-group-label">Réglages</div>
            {SETTINGS.filter((i) => !i.ownerOnly || showAdmin).map(link)}
          </div>
        </nav>

        <div className="sidebar-foot">
          {showAdmin && <HealthLight />}
          {accountName && (
            <Link
              href={showAdmin ? "/comptes" : "/connexions"}
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
