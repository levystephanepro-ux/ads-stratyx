"use client";

// Jauge de crédits IA affichée en bas de la sidebar. Pour l'owner : dépense IA
// du mois en euros face au plafond interne (OWNER_MONTHLY_BUDGET_EUR).
import { useEffect, useState } from "react";

interface Usage {
  owner?: boolean;
  spentEur?: number;
  capEur?: number;
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

  const isOwner = !!usage.owner && usage.capEur !== undefined && usage.spentEur !== undefined;
  const remaining = Math.max(0, usage.totalCredits - usage.spentCredits);
  const pct = isOwner
    ? Math.min(100, usage.capEur! > 0 ? (usage.spentEur! / usage.capEur!) * 100 : 100)
    : Math.min(100, (usage.spentCredits / usage.totalCredits) * 100);
  const fmt = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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
        <span style={{ fontWeight: 600 }}>{isOwner ? "IA ce mois" : "Crédits IA"}</span>
        {isOwner ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(usage.spentEur!)}
            <span style={{ opacity: 0.55 }}> / {fmt(usage.capEur!)}</span>
          </span>
        ) : (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {remaining}
            <span style={{ opacity: 0.55 }}> / {usage.totalCredits}</span>
          </span>
        )}
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
            width: `${isOwner ? pct : 100 - pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.4s",
          }}
        />
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 5 }}>
        {isOwner ? "Plafond OWNER_MONTHLY_BUDGET_EUR, remis à zéro le 1er" : "Recharge le 1er du mois"}
      </div>
    </div>
  );
}
