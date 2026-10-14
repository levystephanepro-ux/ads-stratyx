'use client'
// Barre de filtres façon Ades : campagne · période · vs période précédente.
// Change l'adresse (?campagne=&periode=&cmp=) : la page serveur relit les données.
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function FilterBar({
  campaigns,
  campaignId,
  days,
  compare,
  accounts,
  accountId,
  allLabel = "Toutes les campagnes",
  hideCampaign,
  hideCompare,
  hidePeriod,
}: {
  campaigns: { id: string; name: string; status: string }[];
  campaignId: string | null;
  days: number;
  compare: boolean;
  accounts?: { customerId: string; name: string }[];
  accountId?: string | null;
  allLabel?: string;
  hideCampaign?: boolean;
  hideCompare?: boolean;
  hidePeriod?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string | null) => {
    const q = new URLSearchParams(sp?.toString() ?? "");
    if (v === null || v === "") q.delete(k); else q.set(k, v);
    q.delete("msg");
    if (k === "account") q.delete("campagne");
    router.push(`${path}?${q.toString()}`);
  };
  const current = campaigns.find((c) => c.id === campaignId);
  const dot = current ? (current.status === "ENABLED" ? "on" : "off") : "all";

  return (
    <div className="op-filters">
      {accounts && accounts.length > 1 && (
        <label className="op-select">
          <span className="op-ic" aria-hidden>▤</span>
          <select value={accountId ?? ""} onChange={(e) => set("account", e.target.value)} aria-label="Compte">
            {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
          </select>
        </label>
      )}
      {!hideCampaign && (
        <label className="op-select">
          <span className={`op-dot ${dot}`} aria-hidden />
          <select value={campaignId ?? ""} onChange={(e) => set("campagne", e.target.value)} aria-label="Campagne">
            <option value="">{allLabel}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.status !== "ENABLED" ? " (en pause)" : ""}</option>
            ))}
          </select>
        </label>
      )}
      {!hidePeriod && <label className="op-select">
        <span className="op-ic" aria-hidden>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        </span>
        <select value={String(days)} onChange={(e) => set("periode", e.target.value)} aria-label="Période">
          <option value="7">7 derniers jours</option>
          <option value="14">14 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </select>
      </label>}
      {!hideCompare && !hidePeriod && (
        <>
          <span className="op-vs">vs</span>
          <label className="op-select">
            <select value={compare ? "1" : "0"} onChange={(e) => set("cmp", e.target.value === "1" ? null : "0")} aria-label="Comparaison">
              <option value="1">Période précédente</option>
              <option value="0">Sans comparaison</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
