"use client";

// Jauge de crédits IA affichée en bas de la sidebar (clients uniquement).
// L'owner n'a pas de quota : la jauge ne s'affiche pas pour lui.
import { useEffect, useState } from "react";

interface Usage {
  spentCredits: number;
  totalCredits: number | null;
  resetDate: string;
}

export default function CreditGauge() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsage(d))
      .catch(() => {});
  }, []);

  if (!usage || usage.totalCredits === null) return null;

  const remaining = Math.max(0, usage.totalCredits - usage.spentCredits);
  const pct = Math.min(100, (usage.spentCredits / usage.totalCredits) * 100);
  const color =
    pct >= 90 ? "var(--red, #ef4444)" : pct >= 70 ? "#f59e0b" : "var(--accent)";

  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ fontWeight: 600 }}>Crédits IA</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {remaining}
          <span style={{ opacity: 0.55 }}> / {usage.totalCredits}</span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${100 - pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.4s",
          }}
        />
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 5 }}>
        Recharge le 1er du mois
      </div>
    </div>
  );
}
