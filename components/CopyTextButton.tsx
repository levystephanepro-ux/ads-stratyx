"use client";
import { useState } from "react";
export default function CopyTextButton({ text, label = "Copier le texte", className = "btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={`${className} no-print`} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* indisponible */ }
    }}>{done ? "Copié" : label}</button>
  );
}
