"use client";
import { useState } from "react";
export default function CopyLinkButton({ path, label = "Copier le lien client" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn-ghost no-print" onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* presse-papiers indisponible */ }
    }}>{done ? "Lien copié" : label}</button>
  );
}
