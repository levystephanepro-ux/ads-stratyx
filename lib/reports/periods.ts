// Périodes des rapports (comme dans Google Ads), toujours jusqu'à hier inclus :
// Google consolide les chiffres du jour le lendemain.
export const PERIODS: { key: string; label: string }[] = [
  { key: "hier", label: "Hier" },
  { key: "7", label: "7 derniers jours" },
  { key: "semaine-derniere", label: "Semaine dernière" },
  { key: "14", label: "14 derniers jours" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "30", label: "30 derniers jours" },
  { key: "mois-dernier", label: "Mois dernier" },
  { key: "60", label: "60 derniers jours" },
  { key: "90", label: "90 derniers jours" },
];

export interface Range { since: string; until: string; days: number }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const span = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5) + 1;

export function periodRange(key: string, now = new Date()): Range {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = addDays(today, -1);
  switch (key) {
    case "hier": return { since: iso(y), until: iso(y), days: 1 };
    case "semaine-derniere": {
      const dow = (today.getUTCDay() + 6) % 7; // 0 = lundi
      const end = addDays(today, -dow - 1); const start = addDays(end, -6);
      return { since: iso(start), until: iso(end), days: 7 };
    }
    case "mois": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const end = y < start ? start : y;
      return { since: iso(start), until: iso(end), days: span(start, end) };
    }
    case "mois-dernier": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { since: iso(start), until: iso(end), days: span(start, end) };
    }
    default: {
      const n = Math.max(1, Number(key) || 30);
      return { since: iso(addDays(y, -(n - 1))), until: iso(y), days: n };
    }
  }
}

/** Période de même durée juste avant. */
export function previous(r: Range): Range {
  const end = addDays(new Date(r.since + "T00:00:00Z"), -1);
  return { since: iso(addDays(end, -(r.days - 1))), until: iso(end), days: r.days };
}

export const periodLabel = (key: string) => PERIODS.find((p) => p.key === key)?.label ?? `${key} jours`;
export const frDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC" });
