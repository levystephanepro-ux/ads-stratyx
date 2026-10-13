// Tableau de données façon Ades (composant serveur) : en-têtes triables par lien,
// ligne de total, « Voir plus ». Le tri passe par ?tri=colonne&ordre=asc|desc.
import Link from "next/link";
import type { ReactNode } from "react";

export interface Col<R> {
  id: string;
  label: ReactNode;
  /** Valeur de tri ; absent = colonne non triable. */
  sort?: (r: R) => number | string | null;
  render: (r: R) => ReactNode;
  num?: boolean;
  width?: string;
  /** Contenu de la ligne de total pour cette colonne. */
  total?: ReactNode;
}

export default function Table<R>({
  cols,
  rows,
  rowKey,
  sort,
  dir,
  hrefFor,
  limit = 25,
  showAll,
  allHref,
  empty = "Rien sur la période.",
  rowClass,
  totalLabel,
}: {
  cols: Col<R>[];
  rows: R[];
  rowKey: (r: R) => string;
  sort?: string;
  dir?: "asc" | "desc";
  /** Lien d'en-tête : (colonne, ordre) → adresse. */
  hrefFor?: (col: string, dir: "asc" | "desc") => string;
  limit?: number;
  showAll?: boolean;
  allHref?: string;
  empty?: ReactNode;
  rowClass?: (r: R) => string | undefined;
  totalLabel?: ReactNode;
}) {
  const col = cols.find((c) => c.id === sort && c.sort);
  const sorted = col
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a), y = col.sort!(b);
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        const r = typeof x === "string" && typeof y === "string" ? x.localeCompare(y, "fr") : (x as number) - (y as number);
        return dir === "asc" ? r : -r;
      })
    : rows;
  const shown = showAll ? sorted : sorted.slice(0, limit);
  const hasTotal = totalLabel !== undefined;

  return (
    <div className="op-table-wrap">
      <table className="op-table">
        <thead>
          <tr>
            {cols.map((c) => {
              const active = c.id === col?.id;
              const next = active && dir === "desc" ? "asc" : "desc";
              const inner = <>{c.label}{c.sort && <span className={`op-arrow${active ? " on" : ""}`}>{active ? (dir === "asc" ? "↑" : "↓") : "↓"}</span>}</>;
              return (
                <th key={c.id} className={c.num ? "num" : undefined} style={c.width ? { width: c.width } : undefined}>
                  {c.sort && hrefFor ? <Link href={hrefFor(c.id, next)} scroll={false}>{inner}</Link> : inner}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 ? (
            <tr><td colSpan={cols.length} className="op-empty">{empty}</td></tr>
          ) : (
            shown.map((r) => (
              <tr key={rowKey(r)} className={rowClass?.(r)}>
                {cols.map((c) => <td key={c.id} className={c.num ? "num" : undefined}>{c.render(r)}</td>)}
              </tr>
            ))
          )}
        </tbody>
        {hasTotal && shown.length > 0 && (
          <tfoot>
            <tr>
              {cols.map((c, i) => <td key={c.id} className={c.num ? "num" : undefined}>{i === 0 ? totalLabel : c.total ?? ""}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
      {!showAll && sorted.length > limit && allHref && (
        <div className="op-more"><Link href={allHref} scroll={false}>Voir les {sorted.length} lignes</Link></div>
      )}
    </div>
  );
}

/** Variation colorée (+12 % vert / −8 % rouge ; inverse si « moins = mieux »). */
export function Delta({ cur, prev, lowerIsBetter, show = true }: { cur: number; prev: number; lowerIsBetter?: boolean; show?: boolean }) {
  if (!show || prev <= 0) return null;
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return <span className="op-delta">=</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`op-delta ${good ? "good" : "bad"}`}>{d > 0 ? "+" : "−"}{Math.abs(Math.round(d * 100))} %</span>;
}

/** Barre de part (0-1) avec pourcentage. */
export function Bar({ v }: { v: number }) {
  return (
    <span className="op-bar">
      <span className="op-bar-track"><span className="op-bar-fill" style={{ width: `${Math.min(100, Math.round(v * 100))}%` }} /></span>
      <span className="op-bar-v">{Math.round(v * 100)} %</span>
    </span>
  );
}

