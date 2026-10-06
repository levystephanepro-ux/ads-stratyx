import type { Column, Row } from "./types";

export function formatCell(v: Row[string], type: Column["type"]): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string" && type === "text") return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  switch (type) {
    case "eur": return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })} €`;
    case "int": return Math.round(n).toLocaleString("fr-FR");
    case "pct": return `${(n * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
    case "num": return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    default: return String(v);
  }
}

/** CSV séparé par des points-virgules (ouvre directement dans Excel en français). */
export function toCsv(columns: Column[], rows: Row[]): string {
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = columns.map((c) => esc(c.label)).join(";");
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined) return "";
      if (typeof v === "number") return String(c.type === "pct" ? Math.round(v * 1000) / 10 : v).replace(".", ",");
      return esc(String(v));
    }).join(";"),
  );
  return "﻿" + [head, ...body].join("\n");
}
