"use client";
// Sélecteur du client actif (barre latérale) : toutes les pages suivent son compte Google Ads.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Item { id: string; name: string; linked: boolean }

export default function ClientSwitcher() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clients/active", { cache: "no-store" }).then((r) => r.json()).then((j) => { setItems(j.clients ?? []); setActive(j.active ?? ""); }).catch(() => setItems([]));
  }, []);
  if (!items || items.length === 0) return null;

  const change = async (id: string) => {
    setBusy(true); setActive(id);
    await fetch("/api/clients/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id || null }) }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  };

  return (
    <label style={{ display: "grid", gap: 4, margin: "0 4px 8px", padding: "0 8px", fontSize: 11, color: "var(--side-muted, var(--muted))", textTransform: "uppercase", letterSpacing: ".04em" }}>
      Client actif
      <select value={active} disabled={busy} onChange={(e) => change(e.target.value)}
        style={{ padding: "7px 8px", borderRadius: 8, fontSize: 13, textTransform: "none", letterSpacing: 0, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", width: "100%" }}>
        <option value="">Aucun (compte par défaut)</option>
        {items.map((c) => <option key={c.id} value={c.id}>{c.name}{c.linked ? "" : " (sans compte Ads)"}</option>)}
      </select>
    </label>
  );
}
