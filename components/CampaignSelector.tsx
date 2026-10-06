'use client'
import { useEffect, useState } from "react";

interface Campaign { id: string; name: string; status: string }
interface CampaignFilter { mode: "all" | "selected"; campaigns?: { id: string; name: string }[] }

export default function CampaignSelector({ token, accountName }: { token: string; accountName?: string | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<CampaignFilter>({ mode: "all" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = { "x-app-token": token };
    Promise.all([
      fetch("/api/campaigns", { headers: h }).then((r) => r.json()),
      fetch("/api/campaigns/filter", { headers: h }).then((r) => r.json()),
    ]).then(([cData, fData]) => {
      setCampaigns(cData.campaigns ?? []);
      setFilter(fData.filter ?? { mode: "all" });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  function toggle(c: Campaign) {
    setFilter((prev) => {
      const current = prev.campaigns ?? [];
      const exists = current.some((x) => x.id === c.id);
      const next = exists ? current.filter((x) => x.id !== c.id) : [...current, { id: c.id, name: c.name }];
      return { mode: "selected", campaigns: next };
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/campaigns/filter", {
      method: "POST",
      headers: { "x-app-token": token, "content-type": "application/json" },
      body: JSON.stringify(filter),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <p className="subtitle" style={{ fontSize: 13 }}>Chargement des campagnes…</p>;
  if (!campaigns.length) return (
    <p className="subtitle" style={{ fontSize: 13 }}>
      Aucune campagne trouvée. Assure-toi qu'un compte Google Ads est relié.
    </p>
  );

  const selectedIds = new Set((filter.campaigns ?? []).map((c) => c.id));
  const isAll = filter.mode === "all";
  const selectedCamps = filter.campaigns ?? [];
  const summary = isAll
    ? "Toutes les campagnes"
    : selectedCamps.length === 0
      ? "Aucune campagne sélectionnée"
      : selectedCamps.length === 1
        ? selectedCamps[0].name
        : `${selectedCamps[0].name} +${selectedCamps.length - 1}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* En-tête replié */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: "var(--text)", width: "100%", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13 }}>
          <span style={{ opacity: 0.5, marginRight: 6 }}>{open ? "▾" : "▸"}</span>
          {summary}
        </span>
        {!open && saved && <span style={{ fontSize: 12, color: "var(--accent)" }}>✓ Enregistré</span>}
      </button>

      {!open && <div style={{ borderTop: "1px solid var(--border)" }} />}

      {open && <>
      {/* Toggle Toutes / Sélection */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className={isAll ? "btn" : "btn-ghost"}
          style={{ fontSize: 13, padding: "6px 14px" }}
          onClick={() => { setFilter({ mode: "all" }); setSaved(false); }}
        >
          Toutes les campagnes
        </button>
        <button
          className={!isAll ? "btn" : "btn-ghost"}
          style={{ fontSize: 13, padding: "6px 14px" }}
          onClick={() => { setFilter({ mode: "selected", campaigns: [] }); setSaved(false); }}
        >
          Sélection
        </button>
      </div>

      {/* Liste campagnes */}
      {!isAll && (
        <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {campaigns.map((c) => {
            const checked = selectedIds.has(c.id);
            return (
              <label
                key={c.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  background: checked ? "color-mix(in srgb, var(--accent) 12%, var(--surface))" : "var(--surface-2)",
                  border: `1px solid ${checked ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c)}
                  style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                />
                <span style={{ flex: 1 }}>{c.name}</span>
                <span
                  className="pill"
                  style={{ fontSize: 11, opacity: c.status === "ENABLED" ? 1 : 0.5 }}
                >
                  {c.status === "ENABLED" ? "active" : c.status === "PAUSED" ? "pausée" : c.status.toLowerCase()}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Résumé */}
      {!isAll && (
        <p className="subtitle" style={{ fontSize: 12, margin: 0 }}>
          {selectedIds.size === 0
            ? "Aucune campagne sélectionnée — le copilote et les agents analyseront tout le compte."
            : `${selectedIds.size} campagne${selectedIds.size > 1 ? "s" : ""} sélectionnée${selectedIds.size > 1 ? "s" : ""}.`}
        </p>
      )}

      <button
        className="btn"
        style={{ fontSize: 13, padding: "8px 18px", width: "fit-content" }}
        onClick={save}
        disabled={saving}
      >
        {saving ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
      </button>
      </>}
    </div>
  );
}
