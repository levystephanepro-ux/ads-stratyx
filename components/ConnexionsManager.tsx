"use client";

// Liste les comptes Google Ads du MCC et permet de choisir celui ciblé par défaut
// par le Copilote et les agents.
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ManagedAccount {
  customerId: string;
  name: string;
  currencyCode: string | null;
}

export default function ConnexionsManager({
  accounts,
  defaultCustomerId,
  token,
  dbReady,
}: {
  accounts: ManagedAccount[];
  defaultCustomerId: string;
  token: string;
  dbReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setDefault(customerId: string) {
    setBusy(customerId);
    setError(null);
    try {
      const res = await fetch("/api/connexions/default", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": token },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `Erreur ${res.status}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="card">
        <p className="subtitle" style={{ margin: 0 }}>
          Aucun compte détecté sous le MCC. Vérifie la connexion Google Ads.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mono" style={{ color: "var(--red)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {accounts.map((a) => {
          const isDefault = a.customerId === defaultCustomerId;
          return (
            <div
              className="card"
              key={a.customerId}
              style={
                isDefault
                  ? { borderColor: "color-mix(in srgb, var(--accent) 50%, var(--border))" }
                  : undefined
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="tpl-ic" style={{ fontSize: 18 }}>📊</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="subtitle" style={{ fontSize: 13 }}>
                      {a.customerId}
                      {a.currencyCode ? ` · ${a.currencyCode}` : ""}
                    </div>
                  </div>
                </div>
                <div>
                  {isDefault ? (
                    <span className="pill ok">● Compte par défaut</span>
                  ) : (
                    <button
                      className="btn-ghost"
                      onClick={() => setDefault(a.customerId)}
                      disabled={busy !== null || !dbReady}
                      title={
                        dbReady
                          ? "Cibler ce compte par défaut"
                          : "Nécessite Supabase (base de réglages)"
                      }
                    >
                      {busy === a.customerId ? "…" : "Définir par défaut"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="subtitle" style={{ fontSize: 13, marginTop: 12 }}>
        Le compte par défaut est celui que le Copilote et les agents interrogent
        quand tu ne précises pas de compte. Claude peut toujours cibler un autre
        compte à la demande.
        {!dbReady && " (Le changement nécessite Supabase configuré.)"}
      </p>
    </div>
  );
}
