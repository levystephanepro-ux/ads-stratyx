"use client";
// Constructeur de campagne (Prévisions) : réglages, groupes d'annonces éditables,
// proposition par l'IA, vérification et création EN PAUSE dans Google Ads.
import { useState, useTransition } from "react";
import type { AdGroupSpec, CampaignSpec } from "@/lib/planner/create";
import type { Structure, StructureInput } from "@/lib/planner/ai";
import type { ActionResult } from "@/app/previsions/actions";

type Propose = (input: Omit<StructureInput, "accountContext"> & { customerId: string }) => Promise<{ ok: boolean; message: string; structure?: Structure }>;
type Create = (customerId: string, accountName: string, spec: CampaignSpec, mode: "check" | "create") => Promise<ActionResult>;

const lab = { display: "block", fontSize: 12, color: "var(--muted)", margin: "10px 0 4px" } as const;
const ta = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", resize: "vertical" } as const;
const sel = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, width: "100%" } as const;
const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

interface GroupDraft { name: string; keywords: string; headlines: string; descriptions: string; path1: string; path2: string }
const toDraft = (g: AdGroupSpec): GroupDraft => ({ name: g.name, keywords: g.keywords.join("\n"), headlines: g.headlines.join("\n"), descriptions: g.descriptions.join("\n"), path1: g.path1 ?? "", path2: g.path2 ?? "" });

function Counter({ text, max, min, maxCount }: { text: string; max: number; min: number; maxCount: number }) {
  const l = lines(text); const tooLong = l.filter((x) => x.length > max).length;
  const bad = l.length < min || l.length > maxCount || tooLong > 0;
  return <span style={{ color: bad ? "var(--red)" : "var(--muted)" }}> ({l.length} / {min} à {maxCount}{tooLong ? `, ${tooLong} trop long${tooLong > 1 ? "s" : ""} (${max} car. max)` : ""})</span>;
}

export default function CampaignBuilder({ customerId, accountName, languageId, geos, initial, aiInput, propose, create }: {
  customerId: string; accountName: string; languageId: string;
  geos: { id: string; label: string }[];
  initial: { name: string; budget: string; url: string; group: AdGroupSpec };
  aiInput: Omit<StructureInput, "accountContext">;
  propose: Propose; create: Create;
}) {
  const [name, setName] = useState(initial.name);
  const [budget, setBudget] = useState(initial.budget);
  const [bidding, setBidding] = useState<CampaignSpec["bidding"]>("MAXIMIZE_CLICKS");
  const [maxCpc, setMaxCpc] = useState("");
  const [match, setMatch] = useState<CampaignSpec["matchType"]>("PHRASE");
  const [url, setUrl] = useState(initial.url);
  const [geoSel, setGeoSel] = useState<string[]>(geos.map((g) => g.id));
  const [groups, setGroups] = useState<GroupDraft[]>([toDraft(initial.group)]);
  const [negatives, setNegatives] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState<"" | "ia" | "check" | "create">("");
  const [, start] = useTransition();

  const setG = (i: number, k: keyof GroupDraft, v: string) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

  const spec = (): CampaignSpec => ({
    name, dailyBudget: num(budget), bidding, maxCpc: maxCpc ? num(maxCpc) : null, geoIds: geoSel, matchType: match, finalUrl: url,
    negatives: lines(negatives), languageId,
    groups: groups.map((g) => ({ name: g.name, keywords: lines(g.keywords), headlines: lines(g.headlines), descriptions: lines(g.descriptions), path1: g.path1, path2: g.path2 })),
  });

  const runIA = () => {
    setBusy("ia"); setMsg(null);
    start(async () => {
      const r = await propose({ ...aiInput, url: url || aiInput.url, customerId });
      if (r.ok && r.structure) {
        setGroups(r.structure.groups.map(toDraft));
        setNegatives(r.structure.negatives.join("\n"));
        setNotes(r.structure.notes);
        if (r.structure.campaignName) setName(r.structure.campaignName);
      }
      setMsg({ ok: r.ok, lines: [r.message] });
      setBusy("");
    });
  };
  const send = (mode: "check" | "create") => {
    setBusy(mode); setMsg(null);
    start(async () => {
      const r = await create(customerId, accountName, spec(), mode);
      setMsg({ ok: r.ok, lines: r.messages });
      if (r.ok && r.created) setCreated(true);
      setBusy("");
    });
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <strong>Construire la campagne</strong>
          <p className="subtitle" style={{ margin: "2px 0 0", fontSize: 13 }}>Créée EN PAUSE : rien ne diffuse avant que tu l&apos;actives dans Google Ads.</p>
        </div>
        <button type="button" onClick={runIA} disabled={!!busy} style={{ whiteSpace: "nowrap" }}>
          {busy === "ia" ? "L'IA prépare la structure… (20 à 60 s)" : "✦ Proposer la structure avec l'IA"}
        </button>
      </div>
      {notes && <p style={{ fontSize: 13, margin: "10px 0 0", padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)" }}>{notes}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div style={{ gridColumn: "span 2" }}><span style={lab}>Nom de la campagne</span><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><span style={lab}>Budget quotidien (€)</span><input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" /></div>
        <div><span style={lab}>Enchères</span>
          <select value={bidding} onChange={(e) => setBidding(e.target.value as CampaignSpec["bidding"])} style={sel}>
            <option value="MAXIMIZE_CLICKS">Maximiser les clics (lancement)</option>
            <option value="MAXIMIZE_CONVERSIONS">Maximiser les conversions</option>
            <option value="MANUAL_CPC">CPC manuel</option>
          </select></div>
        <div><span style={lab}>CPC max (€, facultatif)</span><input value={maxCpc} onChange={(e) => setMaxCpc(e.target.value)} inputMode="decimal" placeholder="ex. 2,50" /></div>
        <div><span style={lab}>Correspondance</span>
          <select value={match} onChange={(e) => setMatch(e.target.value as CampaignSpec["matchType"])} style={sel}>
            <option value="PHRASE">Expression (recommandé)</option><option value="EXACT">Exacte</option><option value="BROAD">Large</option>
          </select></div>
        <div style={{ gridColumn: "1 / -1" }}><span style={lab}>URL finale</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
      </div>

      <span style={lab}>Lieux ciblés (présence)</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {geos.map((g) => (
          <label key={g.id} className="pill" style={{ cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={geoSel.includes(g.id)} onChange={(e) => setGeoSel((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))} style={{ margin: 0 }} /> {g.label}
          </label>
        ))}
      </div>

      {groups.map((g, i) => (
        <div key={i} style={{ marginTop: 14, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="pill" style={{ fontSize: 12 }}>Groupe {i + 1}</span>
            <input value={g.name} onChange={(e) => setG(i, "name", e.target.value)} style={{ flex: 1, padding: "7px 10px", fontSize: 14 }} />
            {groups.length > 1 && <button type="button" className="btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}>Retirer</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <div><span style={lab}>Mots-clés, un par ligne ({lines(g.keywords).length})</span><textarea rows={9} value={g.keywords} onChange={(e) => setG(i, "keywords", e.target.value)} style={ta} /></div>
            <div><span style={lab}>Titres, un par ligne<Counter text={g.headlines} max={30} min={3} maxCount={15} /></span><textarea rows={9} value={g.headlines} onChange={(e) => setG(i, "headlines", e.target.value)} style={ta} /></div>
            <div>
              <span style={lab}>Descriptions, une par ligne<Counter text={g.descriptions} max={90} min={2} maxCount={4} /></span><textarea rows={6} value={g.descriptions} onChange={(e) => setG(i, "descriptions", e.target.value)} style={ta} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div><span style={lab}>Chemin 1</span><input value={g.path1} maxLength={15} onChange={(e) => setG(i, "path1", e.target.value)} style={{ padding: "7px 10px", fontSize: 13 }} /></div>
                <div><span style={lab}>Chemin 2</span><input value={g.path2} maxLength={15} onChange={(e) => setG(i, "path2", e.target.value)} style={{ padding: "7px 10px", fontSize: 13 }} /></div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ marginTop: 10, padding: "7px 12px", fontSize: 13 }}
        onClick={() => setGroups((gs) => [...gs, { name: `Groupe ${gs.length + 1}`, keywords: "", headlines: "", descriptions: "", path1: "", path2: "" }])}>+ Ajouter un groupe</button>

      <span style={lab}>Négatifs de campagne, un par ligne, en expression ({lines(negatives).length})</span>
      <textarea rows={4} value={negatives} onChange={(e) => setNegatives(e.target.value)} style={ta} placeholder={"emploi\nformation\ngratuit"} />

      {msg && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${msg.ok ? "var(--green)" : "var(--red)"}` }}>
          {msg.lines.map((m, i) => <div key={i} style={{ fontSize: 13 }}>{msg.ok ? "✓ " : "• "}{m}</div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost" onClick={() => send("check")} disabled={!!busy}>{busy === "check" ? "Vérification…" : "Vérifier sans créer"}</button>
        <button type="button" onClick={() => send("create")} disabled={!!busy || created}>{busy === "create" ? "Création…" : created ? "Créée ✓" : "Créer en pause"}</button>
      </div>
    </div>
  );
}
