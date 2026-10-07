// Mise en page commune des audits imprimables (PDF via l'impression du navigateur).
import type { ReactNode } from "react";
import Link from "next/link";
import Owl from "@/components/Owl";
import PrintButton from "@/components/PrintButton";

export default function AuditSheet({ kicker, title, subtitle, back, children, actions }: {
  kicker: string; title: string; subtitle: string; back: { href: string; label: string }; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <main style={{ background: "#f1ece3", minHeight: "100vh", padding: "24px 12px" }}>
      <div className="no-print" style={{ maxWidth: 980, margin: "0 auto 12px", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn-ghost" href={back.href}>{back.label}</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}<PrintButton label="Télécharger en PDF" /></div>
      </div>
      <article className="rv" data-theme="clair">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Owl size={34} />
          <span style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 800, letterSpacing: ".04em", color: "#0B3C5D", fontSize: 20 }}>STRATYX</span>
        </div>
        <div className="rv-kicker">{kicker}</div>
        <h1 className="rv-title">{title}</h1>
        <div className="rv-meta">{subtitle}</div>
        {children}
        <p style={{ marginTop: 40, fontSize: 12, color: "var(--rv-muted)" }}>Audit réalisé par STRATYX Media · stratyxmedia.fr</p>
      </article>
    </main>
  );
}
