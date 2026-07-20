"use client";
import { useEffect, useState } from "react";

interface Usage {
  spent: number;
  spentAgent: number;
  spentCopilote: number;
  budget: number | null;
  spentCredits?: number;
  totalCredits?: number | null;
  resetDate: string;
}

const USD_PER_CREDIT = 0.05;
const usdToCredits = (usd: number) => Math.round(usd / USD_PER_CREDIT);

function Bar({ pct }: { pct: number }) {
  const color = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "var(--accent)";
  return (
    <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
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

  const total = usage.totalCredits ?? usdToCredits(usage.budget ?? 0);
  const spent = usage.spentCredits ?? usdToCredits(usage.spent);
  const spentAgent = usdToCredits(usage.spentAgent);
  const spentCopilote = usdToCredits(usage.spentCopilote);
  const remaining = Math.max(0, total - spent);
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const pctAgent = spent > 0 ? (spentAgent / spent) * 100 : 0;
  const pctCopilote = spent > 0 ? (spentCopilote / spent) * 100 : 0;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Crédits IA</span>
        <span className="subtitle" style={{ fontSize: 11 }}>
          Recharge {daysUntil(usage.resetDate)}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="subtitle" style={{ fontSize: 12 }}>Restants ce mois-ci</span>
        <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {remaining} / {total}
        </span>
      </div>
      <Bar pct={pct} />

      {spentAgent > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="subtitle" style={{ fontSize: 12 }}>Agent IA</span>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              {spentAgent} cr
              <span className="subtitle" style={{ marginLeft: 6 }}>({Math.round(pctAgent)}%)</span>
            </span>
          </div>
          <Bar pct={pctAgent} />
        </div>
      )}

      {spentCopilote > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="subtitle" style={{ fontSize: 12 }}>Copilote</span>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              {spentCopilote} cr
              <span className="subtitle" style={{ marginLeft: 6 }}>({Math.round(pctCopilote)}%)</span>
            </span>
          </div>
          <Bar pct={pctCopilote} />
        </div>
      )}

      {spent === 0 && (
        <p className="subtitle" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Aucun crédit utilisé ce mois-ci.
        </p>
      )}
    </div>
  );
}