"use client";

// UI de la page Admin (owner) : gestion des clients sans passer par SQL.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminClientRow, AdminSummary } from "@/lib/admin";

interface MccAccount {
  customerId: string;
  name: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "var(--accent)" },
  trialing: { label: "Essai", color: "#f59e0b" },
  past_due: { label: "Impayé", color: "var(--red, #ef4444)" },
  canceled: { label: "Coupé", color: "var(--red, #ef4444)" },
  none: { label: "Aucun abonnement", color: "var(--muted)" },
};

export default function AdminManager({
  rows,
  summary,
  mccAccounts,
}: {
  rows: AdminClientRow[];
  summary: AdminSummary;
  mccAccounts: MccAccount[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});

  async function call(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(String(data.error ?? `Erreur ${res.status}`));
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const stat = (label: string, value: string, sub?: string) => (
    <div className="card" style={{ padding: "12px 16px", flex: 1, minWidth: 130 }}>
      <div className="subtitle" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div className="subtitle" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Résumé */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {stat("Clients", String(summary.clients))}
        {stat("Actifs", String(summary.actifs))}
        {stat("En essai", String(summary.essais))}
        {stat("Revenu / mois", `${summary.revenueEur}€`, "abonnements actifs")}
        {stat("Coût API / mois", `$${summary.apiCostUsd.toFixed(2)}`, "Anthropic, tous espaces")}
      </div>

      {error && (
        <div className="mono" style={{ color: "var(--red)", marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Clients */}
      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((r) => {
          const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.none;
          const key = r.userId;
          return (
            <div className="card" key={key}>
              {/* Ligne 1 : identité + badges */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 15 }}>{r.email}</strong>
                {r.isOwner && (
                  <span className="pill" style={{ fontSize: 11 }}>👑 Toi</span>
                )}
                <span
                  className="pill"
                  style={{ fontSize: 11, borderColor: `color-mix(in srgb, ${st.color} 50%, transparent)`, color: st.color }}
                >
                  {st.label}
                  {r.status === "trialing" && r.trialDaysLeft !== null && ` · ${r.trialDaysLeft}j restants`}
                </span>
                {!r.isOwner && r.status === "active" && (
                  <span className="pill" style={{ fontSize: 11 }}>
                    {r.plan === "starter" ? "Starter 49€" : "Pro 97€"}
                  </span>
                )}
              </div>

              {/* Ligne 2 : conso + agents */}
              {!r.isOwner && (
                <div className="subtitle" style={{ fontSize: 12.5, marginTop: 8 }}>
                  Crédits : <strong>{r.spentCredits} / {r.totalCredits}</strong> ce mois-ci
                  {" · "}coût réel ${r.spentUsd.toFixed(2)}
                  {" · "}{r.agentCount} agent{r.agentCount > 1 ? "s" : ""}
                </div>
              )}

              {/* Ligne 3 : comptes Google Ads reliés */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                {r.connections.length === 0 && !r.isOwner && (
                  <span className="subtitle" style={{ fontSize: 12.5 }}>
                    Aucun compte Google Ads relié
                  </span>
                )}
                {r.connections.map((c) => (
                  <span key={c.customerId} className="pill" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {c.name}
                    {c.customerId === r.defaultCustomerId && " ★"}
                    {!r.isOwner && r.workspaceId && (
                      <button
                        onClick={() =>
                          call("/api/admin/link-account", {
                            workspaceId: r.workspaceId,
                            customerId: c.customerId,
                            action: "unlink",
                          }, key)
                        }
                        disabled={busy === key}
                        title="Délier ce compte"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 0, fontSize: 13, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {/* Actions */}
              {!r.isOwner && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
                  {/* Relier un compte du MCC */}
                  {r.workspaceId && mccAccounts.length > 0 && (
                    <>
                      <select
                        value={selected[key] ?? ""}
                        onChange={(e) => setSelected((s) => ({ ...s, [key]: e.target.value }))}
                        style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                      >
                        <option value="">Relier un compte MCC…</option>
                        {mccAccounts
                          .filter((a) => !r.connections.some((c) => c.customerId === a.customerId))
                          .map((a) => (
                            <option key={a.customerId} value={a.customerId}>
                              {a.name} ({a.customerId})
                            </option>
                          ))}
                      </select>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 13 }}
                        disabled={!selected[key] || busy === key}
                        onClick={() => {
                          const acc = mccAccounts.find((a) => a.customerId === selected[key]);
                          call("/api/admin/link-account", {
                            workspaceId: r.workspaceId,
                            customerId: selected[key],
                            name: acc?.name ?? null,
                          }, key);
                          setSelected((s) => ({ ...s, [key]: "" }));
                        }}
                      >
                        Relier
                      </button>
                    </>
                  )}

                  <span style={{ flex: 1 }} />

                  {/* Plans */}
                  {(r.status !== "active" || r.plan !== "starter") && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 13 }}
                      disabled={busy === key}
                      onClick={() => call("/api/admin/activate", { userId: r.userId, plan: "starter" }, key)}
                    >
                      Activer Starter
                    </button>
                  )}
                  {(r.status !== "active" || r.plan !== "pro") && (
                    <button
                      className="btn"
                      style={{ fontSize: 13 }}
                      disabled={busy === key}
                      onClick={() => call("/api/admin/activate", { userId: r.userId, plan: "pro" }, key)}
                    >
                      Activer Pro
                    </button>
                  )}
                  {r.status === "active" && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 13, color: "var(--red)" }}
                      disabled={busy === key}
                      onClick={() => {
                        if (confirm(`Couper l'accès de ${r.email} ?`)) {
                          call("/api/admin/activate", { userId: r.userId, action: "cancel" }, key);
                        }
                      }}
                    >
                      Couper l&apos;accès
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
