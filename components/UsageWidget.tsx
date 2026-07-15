"use client";

// Widget de suivi des coûts API Anthropic — style "Limites d'utilisation" Claude.
// Affiché sur le dashboard, se rafraîchit côté client via /api/usage.
import { useEffect, useState } from "react";

interface Usage {
  spent: number;
  spentAgent: number;
  spentCopilote: number;
  budget: number | null;
  resetDate: string;
}

function Bar({ pct, warn }: { pct: number; warn?: boolean }) {
  const color = pct > 80 ? "var(--red, #ef4444)" : pct > 50 ? "#f59e0b" : "var(--accent)";
  return (
    <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
}

function fmt(usd: number) {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const d = Math.ceil(diff / 86_400_000);
  return d <= 1 ? "demain" : `dans ${d}j`;
}

export default function UsageWidget() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/usage").then((r) => r.json()).then(setUsage).catch(() => {});
  }, []);

  if (!usage) return null;

  const { spent, spentAgent, spentCopilote, budget, resetDate } = usage;
  const pct = budget ? (spent / budget) * 100 : null;
  const pctAgent = spent > 0 ? (spentAgent / spent) * 100 : 0;
  const pctCopilote = spent > 0 ? (spentCopilote / spent) * 100 : 0;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Coûts API Anthropic</span>
        <span className="subtitle" style={{ fontSize: 11 }}>
          Réinit. {daysUntil(resetDate)}
        </span>
      </div>

      {/* Total vs budget */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="subtitle" style={{ fontSize: 12 }}>
          {budget ? "Ce mois-ci" : "Total cumulé"}
        </span>
        <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {fmt(spent)}{budget ? ` / ${fmt(budget)}` : ""}
          {pct !== null && (
            <span className="subtitle" style={{ marginLeft: 6, fontWeight: 400 }}>
              ({Math.round(pct)}%)
            </span>
          )}
        </span>
      </div>
      {pct !== null && <Bar pct={pct} />}

      {/* Détail Agent IA */}
      {spentAgent > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="subtitle" style={{ fontSize: 12 }}>🤖 Agent IA</span>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              {fmt(spentAgent)}
              <span className="subtitle" style={{ marginLeft: 6 }}>({Math.round(pctAgent)}%)</span>
            </span>
          </div>
          <Bar pct={pctAgent} />
        </div>
      )}

      {/* Détail Copilote */}
      {spentCopilote > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="subtitle" style={{ fontSize: 12 }}>💬 Copilote</span>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              {fmt(spentCopilote)}
              <span className="subtitle" style={{ marginLeft: 6 }}>({Math.round(pctCopilote)}%)</span>
            </span>
          </div>
          <Bar pct={pctCopilote} />
        </div>
      )}

      {spent === 0 && (
        <p className="subtitle" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Aucune dépense ce mois-ci.
        </p>
      )}
    </div>
  );
}
