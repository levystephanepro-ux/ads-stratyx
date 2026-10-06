"use client";
// Formulaire de création de campagne Search en pause (Prévisions).
// Garde la saisie après envoi (les valeurs reviennent dans l'état de l'action).
import { useActionState } from "react";
import type { CreateState } from "@/app/previsions/actions";

type Action = (prev: CreateState, form: FormData) => Promise<CreateState>;

const lab = { display: "block", fontSize: 12, color: "var(--muted)", margin: "10px 0 4px" } as const;
const ta = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", resize: "vertical" } as const;
const sel = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, width: "100%" } as const;

export default function CampaignForm({ action, initial, geos }: {
  action: Action;
  initial: Record<string, string>;
  geos: { id: string; label: string }[];
}) {
  const [state, run, pending] = useActionState(action, { ok: null, messages: [], values: initial });
  const v = (k: string) => state.values[k] ?? initial[k] ?? "";
  const checkedGeos = new Set((v("g") || geos.map((g) => g.id).join(",")).split(","));
  const count = (k: string) => v(k).split(/\r?\n/).filter((x) => x.trim()).length;

  return (
    <form action={run} className="card" key={state.created ?? "f"}>
      <strong>Créer la campagne en pause</strong>
      <p className="subtitle" style={{ margin: "4px 0 0", fontSize: 13 }}>
        Une campagne Search, un groupe, une annonce responsive. Elle est créée EN PAUSE : rien ne diffuse avant que tu l&apos;actives dans Google Ads.
      </p>
      <input type="hidden" name="customer_id" value={v("customer_id")} />
      <input type="hidden" name="account_name" value={v("account_name")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <div><span style={lab}>Nom de la campagne</span><input name="name" defaultValue={v("name")} required /></div>
        <div><span style={lab}>Budget quotidien (€)</span><input name="budget" inputMode="decimal" defaultValue={v("budget")} required /></div>
        <div><span style={lab}>Enchères</span>
          <select name="bidding" defaultValue={v("bidding") || "MAXIMIZE_CLICKS"} style={sel}>
            <option value="MAXIMIZE_CLICKS">Maximiser les clics (lancement)</option>
            <option value="MAXIMIZE_CONVERSIONS">Maximiser les conversions</option>
            <option value="MANUAL_CPC">CPC manuel</option>
          </select></div>
        <div><span style={lab}>CPC max (€, facultatif)</span><input name="maxcpc" inputMode="decimal" defaultValue={v("maxcpc")} placeholder="ex. 2,50" /></div>
      </div>

      <span style={lab}>Lieux ciblés (présence)</span>
      {geos.length === 0 ? <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>Aucun lieu trouvé : renseigne une ville plus haut et relance la prévision.</p> : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {geos.map((g) => (
            <label key={g.id} className="pill" style={{ cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name="g" value={g.id} defaultChecked={checkedGeos.has(g.id)} style={{ margin: 0 }} /> {g.label}
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        <div>
          <span style={lab}>Mots-clés, un par ligne ({count("keywords")})</span>
          <textarea name="keywords" rows={8} defaultValue={v("keywords")} style={ta} />
          <span style={lab}>Correspondance</span>
          <select name="match" defaultValue={v("match") || "PHRASE"} style={sel}>
            <option value="PHRASE">Expression (recommandé)</option>
            <option value="EXACT">Exacte</option>
            <option value="BROAD">Large</option>
          </select>
        </div>
        <div>
          <span style={lab}>URL finale</span><input name="url" defaultValue={v("url")} placeholder="https://…" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><span style={lab}>Chemin 1</span><input name="path1" defaultValue={v("path1")} maxLength={15} /></div>
            <div><span style={lab}>Chemin 2</span><input name="path2" defaultValue={v("path2")} maxLength={15} /></div>
          </div>
          <span style={lab}>Titres, un par ligne, 30 caractères max ({count("headlines")} / 3 à 15)</span>
          <textarea name="headlines" rows={7} defaultValue={v("headlines")} style={ta} />
          <span style={lab}>Descriptions, une par ligne, 90 caractères max ({count("descriptions")} / 2 à 4)</span>
          <textarea name="descriptions" rows={4} defaultValue={v("descriptions")} style={ta} />
        </div>
      </div>

      {state.messages.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${state.ok ? "var(--green)" : "var(--red)"}` }}>
          {state.messages.map((m, i) => <div key={i} style={{ fontSize: 13 }}>{state.ok ? "✓ " : "• "}{m}</div>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="submit" name="mode" value="check" className="btn-ghost" disabled={pending}>{pending ? "Envoi…" : "Vérifier sans créer"}</button>
        <button type="submit" name="mode" value="create" disabled={pending || !!state.created}>{pending ? "Envoi…" : state.created ? "Créée ✓" : "Créer en pause"}</button>
      </div>
    </form>
  );
}
