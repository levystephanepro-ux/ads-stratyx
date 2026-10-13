// Briques de mise en page communes (CSS vanilla, classes « ui-* » dans globals.css).
// Objectif : chaque page se lit pareil — en-tête, résumé chiffré, onglets, cartes chiffrées.
import Link from "next/link";
import type { ReactNode } from "react";

/** En-tête de page : grand titre, une phrase de résumé chiffrée, actions à droite. */
export function PageHeader({ title, lede, actions, help }: { title: string; lede?: ReactNode; actions?: ReactNode; help?: ReactNode }) {
  return (
    <header className="ui-header">
      <div className="ui-header-text">
        <h1 className="ui-title">{title}</h1>
        {lede && <p className="ui-lede">{lede}</p>}
      </div>
      {(actions || help) && (
        <div className="ui-header-actions">
          {help && (
            <details className="ui-help">
              <summary className="ui-btn ui-btn-ghost">Comment ça marche</summary>
              <div className="ui-help-body">{help}</div>
            </details>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}

/** Onglets internes (liens), avec compteur facultatif. */
export function Tabs({ items }: { items: { label: string; href: string; active?: boolean; count?: number }[] }) {
  return (
    <nav className="ui-tabs" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`ui-tab${t.active ? " active" : ""}`} aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="ui-tab-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Chiffre clé : petit libellé en capitales, grand chiffre, une ligne d'explication. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat-label">{label}</div>
      <div className={`ui-stat-value${tone ? ` ${tone}` : ""}`}>{value}</div>
      {sub && <div className="ui-stat-sub">{sub}</div>}
    </div>
  );
}

/** Anneau de score sur 100. */
export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const tone = score >= 80 ? "var(--green)" : score >= 60 ? "#f59e0b" : "var(--red)";
  return (
    <div className="ui-ring" style={{ width: size, height: size, background: `conic-gradient(${tone} ${score * 3.6}deg, var(--surface-2) 0deg)` }} aria-label={`${score} sur 100`}>
      <div className="ui-ring-inner" style={{ color: tone }}>{score}</div>
    </div>
  );
}

/** Carte avec titre de section. */
export function Panel({ title, sub, right, children, flush }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`ui-panel${flush ? " flush" : ""}`}>
      {(title || right) && (
        <div className="ui-panel-head">
          <div>
            {title && <div className="ui-panel-title">{title}</div>}
            {sub && <div className="ui-panel-sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Message de retour (succès / avertissement / erreur). */
export function Notice({ tone, children }: { tone: "ok" | "warn" | "err"; children: ReactNode }) {
  return <div className={`ui-notice ${tone}`}>{children}</div>;
}
