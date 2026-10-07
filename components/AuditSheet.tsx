// Mise en page commune des audits imprimables (PDF via l'impression du navigateur).
import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import PrintButton from "@/components/PrintButton";

export default function AuditSheet({ kicker, title, subtitle, back, children, actions, footer = "Audit réalisé par STRATYXMEDIA · stratyxmedia.fr" }: {
  kicker: string; title: string; subtitle: string; back: { href: string; label: string }; children: ReactNode; actions?: ReactNode; footer?: string;
}) {
  return (
    <main className="audit-wrap" style={{ background: "#f1ece3", minHeight: "100vh", padding: "24px 12px" }}>
      <div className="no-print" style={{ maxWidth: 980, margin: "0 auto 12px", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn-ghost" href={back.href}>{back.label}</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}<PrintButton label="Télécharger en PDF" /></div>
      </div>
      <article className="rv" data-theme="clair">
        <div className="rv-brand"><BrandLogo size={26} /></div>
        <div className="rv-kicker">{kicker}</div>
        <h1 className="rv-title">{title}</h1>
        <div className="rv-meta">{subtitle}</div>
        {children}
        <p style={{ marginTop: 40, fontSize: 12, color: "var(--rv-muted)" }}>{footer}</p>
      </article>
    </main>
  );
}
