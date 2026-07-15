"use client";

import { useState } from "react";

export default function McpUrlBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponible (http non sécurisé) : sélection manuelle */
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      <div className="mono" style={{ flex: 1 }}>
        {url}
      </div>
      <button className="btn-ghost" onClick={copy} style={{ whiteSpace: "nowrap" }}>
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}
