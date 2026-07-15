"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Account {
  customerId: string;
  name: string;
  currencyCode: string | null;
}

// Sélecteur de compte : mémorise le choix dans un cookie (lu côté serveur) et
// rafraîchit la page pour recharger les données du compte choisi.
export default function AccountSwitcher({
  accounts,
  selected,
}: {
  accounts: Account[];
  selected: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    // Cookie 30 jours, lisible côté serveur (non-HttpOnly car posé par le client).
    document.cookie = `sx_customer=${id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    startTransition(() => router.refresh());
  }

  if (accounts.length <= 1) return null;

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <span className="subtitle" style={{ margin: 0 }}>
        Compte
      </span>
      <select
        value={selected}
        onChange={onChange}
        disabled={pending}
        style={{
          background: "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 14,
        }}
      >
        {accounts.map((a) => (
          <option key={a.customerId} value={a.customerId}>
            {a.name} ({a.customerId})
          </option>
        ))}
      </select>
    </label>
  );
}
