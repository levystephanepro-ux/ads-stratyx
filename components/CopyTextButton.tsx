"use client";
import { useState } from "react";
export default function CopyTextButton({ text, label = "Copier le texte" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn-ghost no-print" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* indisponible */ }
    }}>{done ? "Copié" : label}</button>
  );
}
