"use client";
// Constructeur de campagne (Prévisions) : réglages, groupes d'annonces éditables,
// proposition par l'IA, vérification et création EN PAUSE dans Google Ads.
import { useState, useTransition } from "react";
import type { AdGroupSpec, CampaignSpec, Extensions } from "@/lib/planner/create";
import { DAY_FR, validateSpec } from "@/lib/planner/create";
import { toEditorCsv } from "@/lib/planner/editor";
import type { BuilderTier, Structure, StructureInput } from "@/lib/planner/ai";
import type { ActionResult } from "@/app/previsions/actions";
import type { LandingBrief, LandingInput } from "@/lib/planner/landing";
import { messageMatchGaps, landingToMarkdown } from "@/lib/planner/landing-text";
import type { BuilderDraft, SimSummary } from "@/lib/planner/simulations";

type Propose = (input: Omit<StructureInput, "accountContext"> & { customerId: string; tier?: BuilderTier }) => Promise<{ ok: boolean; message: string; structure?: Structure }>;
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

/** Lignes qui dépassent la limite, avec leur longueur, sous le champ concerné. */
function TooLong({ items, max }: { items: string[]; max: number }) {
  const bad = items.filter((x) => x.length > max);
  if (!bad.length) return null;
  return (
    <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--red)" }}>
      {bad.map((x, k) => <li key={k}>« {x} » : {x.length} / {max} caractères</li>)}
    </ul>
  );
}
const sitelinkParts = (v: string) => lines(v).map((l) => l.split("|").map((x) => x.trim()));

type ProposeLanding = (i: Omit<LandingInput, "accountContext"> & { customerId: string }) => Promise<{ ok: boolean; message: string; brief?: LandingBrief }>;
type Save = (i: { id?: string | null; name: string; query: string; summary: SimSummary; draft: BuilderDraft | null }) => Promise<{ ok: boolean; id?: string; message: string }>;

export default function CampaignBuilder({ customerId, accountName, languageId, geos, initial, aiInput, propose, create, proposeLanding, save, sim, saved }: {
  customerId: string; accountName: string; languageId: string;
  geos: { id: string; label: string }[];
  initial: { name: string; budget: string; url: string; group: AdGroupSpec };
  aiInput: Omit<StructureInput, "accountContext">;
  propose: Propose; create: Create; proposeLanding: ProposeLanding; save: Save;
  sim: { id: string | null; name: string; query: string; summary: SimSummary };
  saved?: BuilderDraft | null;
}) {
  const d = saved ?? null;
  const [name, setName] = useState(d?.name ?? initial.name);
  const [budget, setBudget] = useState(d?.budget ?? initial.budget);
  const [bidding, setBidding] = useState<CampaignSpec["bidding"]>((d?.bidding as CampaignSpec["bidding"]) ?? "MAXIMIZE_CLICKS");
  const [maxCpc, setMaxCpc] = useState(d?.maxCpc ?? "");
  const [match, setMatch] = useState<CampaignSpec["matchType"]>((d?.match as CampaignSpec["matchType"]) ?? "PHRASE");
  const [url, setUrl] = useState(d?.url ?? initial.url);
  const [geoSel, setGeoSel] = useState<string[]>(d?.geoSel?.length ? d.geoSel.filter((id) => geos.some((g) => g.id === id)) : geos.map((g) => g.id));
  const [groups, setGroups] = useState<GroupDraft[]>(d?.groups?.length ? d.groups : [toDraft(initial.group)]);
  const [negatives, setNegatives] = useState(d?.negatives ?? "");
  const [notes, setNotes] = useState(d?.notes ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [sitelinks, setSitelinks] = useState(d?.sitelinks ?? "");
  const [callouts, setCallouts] = useState(d?.callouts ?? "");
  const [sched, setSched] = useState(d?.sched ?? "");
  const [tier, setTier] = useState<BuilderTier>("sonnet");
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState<"" | "ia" | "check" | "create" | "landing" | "save">("");
  // Landing page dédiée, alignée sur les annonces.
  const [landingOn, setLandingOn] = useState(d?.landingOn ?? false);
  const [landingUrl, setLandingUrl] = useState(d?.landingUrl ?? "");
  const [landing, setLanding] = useState<LandingBrief | null>(d?.landing ?? null);
  const adsKey = (gs: GroupDraft[]) => gs.map((g) => `${g.name}|${g.headlines}|${g.descriptions}`).join("§");
  const [landingFor, setLandingFor] = useState<string>(d?.landing ? adsKey(d.groups) : "");
  // Historique
  const [simId, setSimId] = useState<string | null>(sim.id);
  const [simName, setSimName] = useState(sim.name);
  const [, start] = useTransition();

  const setG = (i: number, k: keyof GroupDraft, v: string) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

  const extensions = (): Extensions => {
    const sl = lines(sitelinks).map((l) => { const [text = "", desc1 = "", desc2 = "", u = ""] = l.split("|").map((x) => x.trim()); return { text, desc1, desc2, url: u || url }; });
    const schedule = sched === "ouvres" ? { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 19 } : sched === "semaine" ? { days: [1, 2, 3, 4, 5, 6], startHour: 8, endHour: 20 } : null;
    return { phone: phone.trim() || undefined, sitelinks: sl, callouts: lines(callouts), schedule };
  };
  const exportCsv = () => {
    const sp = spec();
    // Mêmes règles que la création (longueurs Google, nombres de titres et descriptions) : Editor refuserait sinon.
    const problems = validateSpec(sp);
    if (problems.length) { setMsg({ ok: false, lines: ["Export bloqué, à corriger d'abord :", ...problems] }); return; }
    const csv = toEditorCsv({ ...sp, groups: sp.groups.map((g) => ({ ...g, path1: g.path1 || undefined, path2: g.path2 || undefined })) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${(name || "campagne").replace(/[^\w-]+/g, "_")}_google-ads-editor.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const spec = (): CampaignSpec => ({
    name, dailyBudget: num(budget), bidding, maxCpc: maxCpc ? num(maxCpc) : null, geoIds: geoSel, matchType: match, finalUrl: url,
    negatives: lines(negatives), languageId,
    geoNames: geos.filter((g) => geoSel.includes(g.id)).map((g) => g.label), extensions: extensions(),
    groups: groups.map((g) => ({ name: g.name, keywords: lines(g.keywords), headlines: lines(g.headlines), descriptions: lines(g.descriptions), path1: g.path1, path2: g.path2 })),
  });

  const runIA = () => {
    setBusy("ia"); setMsg(null);
    start(async () => {
      const r = await propose({ ...aiInput, url: url || aiInput.url, customerId, tier });
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
  const draft = (): BuilderDraft => ({
    name, budget, bidding, maxCpc, match, url, geoSel, groups, negatives, notes, phone, sitelinks, callouts, sched,
    landingOn, landingUrl, landing,
  });
  const saveSim = () => {
    setBusy("save");
    start(async () => {
      const r = await save({ id: simId, name: simName, query: sim.query, summary: sim.summary, draft: draft() });
      if (r.ok && r.id) setSimId(r.id);
      setMsg({ ok: r.ok, lines: [r.message] });
      setBusy("");
    });
  };
  const runLanding = () => {
    setBusy("landing"); setMsg(null);
    start(async () => {
      const sp = spec();
      const r = await proposeLanding({
        customerId, campaignName: name, url: landingUrl || url, objectif: aiInput.objectif, places: aiInput.places,
        groups: sp.groups, callouts: lines(callouts), phone: phone.trim() || undefined,
      });
      if (r.ok && r.brief) { setLanding(r.brief); setLandingFor(adsKey(groups)); }
      setMsg({ ok: r.ok, lines: [r.message, ...(r.ok ? ["Pense à enregistrer la simulation pour garder ce contenu."] : [])] });
      setBusy("");
    });
  };
  const downloadLanding = () => {
    if (!landing) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([landingToMarkdown(landing, name, landingUrl || url)], { type: "text/markdown;charset=utf-8" }));
    a.download = `${(name || "landing").replace(/[^\w-]+/g, "_")}_landing.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const landingStale = !!landing && landingFor !== adsKey(groups);
  const gaps = landing ? messageMatchGaps(landing, spec().groups) : [];

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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={tier} onChange={(e) => setTier(e.target.value as BuilderTier)} disabled={!!busy} style={{ ...sel, width: "auto" }} title="Modèle d'IA">
            <option value="sonnet">Sonnet (recommandé, ~0,07 €)</option>
            <option value="opus">Opus (plus fin, ~0,35 €)</option>
          </select>
          <button type="button" onClick={runIA} disabled={!!busy} style={{ whiteSpace: "nowrap" }}>
            {busy === "ia" ? "L'IA prépare la structure… (20 à 90 s)" : "✦ Proposer la structure avec l'IA"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{simId ? "Simulation enregistrée :" : "Garder cette simulation :"}</span>
        <input value={simName} onChange={(e) => setSimName(e.target.value)} style={{ flex: "1 1 220px", padding: "7px 10px", fontSize: 13 }} aria-label="Nom de la simulation" />
        <button type="button" className="btn-ghost" onClick={saveSim} disabled={!!busy} style={{ padding: "7px 12px", fontSize: 13 }}>
          {busy === "save" ? "Enregistrement…" : simId ? "Mettre à jour" : "Enregistrer la simulation"}
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
            <div><span style={lab}>Titres, un par ligne<Counter text={g.headlines} max={30} min={3} maxCount={15} /></span><textarea rows={9} value={g.headlines} onChange={(e) => setG(i, "headlines", e.target.value)} style={ta} /><TooLong items={lines(g.headlines)} max={30} /></div>
            <div>
              <span style={lab}>Descriptions, une par ligne<Counter text={g.descriptions} max={90} min={2} maxCount={4} /></span><textarea rows={6} value={g.descriptions} onChange={(e) => setG(i, "descriptions", e.target.value)} style={ta} /><TooLong items={lines(g.descriptions)} max={90} />
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

      <div style={{ marginTop: 16, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <strong style={{ fontSize: 14 }}>Extensions et horaires</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          <div>
            <span style={lab}>Liens annexes, un par ligne : titre (25) | description 1 (35) | description 2 (35) | URL ({lines(sitelinks).length})</span>
            <textarea rows={5} value={sitelinks} onChange={(e) => setSitelinks(e.target.value)} style={ta} placeholder={"Devis gratuit | Réponse sous 24 h | Sans engagement | https://…\nNos réalisations"} />
            <TooLong items={sitelinkParts(sitelinks).map((p) => p[0] ?? "")} max={25} />
            <TooLong items={sitelinkParts(sitelinks).flatMap((p) => [p[1] ?? "", p[2] ?? ""])} max={35} />
          </div>
          <div>
            <span style={lab}>Accroches, une par ligne, 25 caractères max ({lines(callouts).length})</span>
            <textarea rows={5} value={callouts} onChange={(e) => setCallouts(e.target.value)} style={ta} placeholder={"Devis gratuit\nPose par nos équipes\nGarantie décennale"} />
            <TooLong items={lines(callouts)} max={25} />
          </div>
          <div>
            <span style={lab}>Téléphone (extension d&apos;appel)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="04 94 00 00 00" />
            <span style={lab}>Horaires de diffusion</span>
            <select value={sched} onChange={(e) => setSched(e.target.value)} style={sel}>
              <option value="">Toute la semaine, 24 h</option>
              <option value="ouvres">{DAY_FR[1]} au {DAY_FR[5].toLowerCase()}, 8 h à 19 h</option>
              <option value="semaine">{DAY_FR[1]} au {DAY_FR[6].toLowerCase()}, 8 h à 20 h</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, fontSize: 14 }}>
          <input type="checkbox" checked={landingOn} onChange={(e) => setLandingOn(e.target.checked)} />
          Prévoir une landing page dédiée à cette campagne
        </label>
        {landingOn && (
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>Le contenu de la page est rédigé à partir des groupes et annonces ci-dessus : chaque groupe a sa section, ses titres d&apos;annonce sont repris sur la page (cohérence annonce, page, conversion).</p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "end" }}>
              <div><span style={lab}>URL prévue de la landing (facultatif)</span><input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://www.client.fr/devis-pergola" /></div>
              <button type="button" className="btn-ghost" disabled={!landingUrl.trim()} onClick={() => setUrl(landingUrl.trim())} style={{ padding: "9px 12px", fontSize: 13 }}>Utiliser comme URL finale</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={runLanding} disabled={!!busy}>
                {busy === "landing" ? "L'IA rédige la page… (20 à 60 s)" : landing ? "✦ Régénérer la landing à partir des annonces" : "✦ Rédiger la landing à partir des annonces"}
              </button>
              {landing && <button type="button" className="btn-ghost" onClick={downloadLanding}>Télécharger le brief (.md)</button>}
            </div>
            {landingStale && <div style={{ fontSize: 13, color: "#d9820b" }}>Les annonces ont changé depuis la rédaction de la page : régénère-la pour garder la cohérence.</div>}
            {landing && (
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "grid", gap: 10, fontSize: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Haut de page</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{landing.hero.titre}</div>
                  <div>{landing.hero.sousTitre}</div>
                  {landing.hero.preuvesRapides.length > 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{landing.hero.preuvesRapides.join(" · ")}</div>}
                  <div style={{ marginTop: 4 }}><span className="pill">{landing.hero.cta}</span></div>
                </div>
                {landing.sections.map((x, k) => (
                  <div key={k} style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Section #{x.ancre} · groupe « {x.groupe} »</div>
                    <strong>{x.titre}</strong>
                    <div>{x.texte}</div>
                    {x.points.length > 0 && <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{x.points.map((p, j) => <li key={j}>{p}</li>)}</ul>}
                    {x.titresAnnonceRepris.length > 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Titres d&apos;annonce repris : {x.titresAnnonceRepris.join(" | ")}</div>}
                    {(landingUrl || url) && <div style={{ fontSize: 12, color: "var(--muted)" }}>URL finale conseillée pour ce groupe : {(landingUrl || url).replace(/#.*$/, "")}#{x.ancre}</div>}
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 4 }}>
                  <div><strong>Formulaire :</strong> {landing.formulaire.champs.join(", ")} · bouton « {landing.formulaire.bouton} » · {landing.formulaire.reassurance}</div>
                  {landing.benefices.length > 0 && <div><strong>Pourquoi nous :</strong> {landing.benefices.join(" · ")}</div>}
                  {landing.etapes.length > 0 && <div><strong>Étapes :</strong> {landing.etapes.join(" → ")}</div>}
                  {landing.faq.length > 0 && <div><strong>FAQ :</strong> {landing.faq.length} questions (dans le brief)</div>}
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>SEO : {landing.metaTitle} · {landing.metaDescription}</div>
                </div>
                {landing.aFournir.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    <strong>À demander au client :</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{landing.aFournir.map((p, j) => <li key={j}>{p}</li>)}</ul>
                  </div>
                )}
                {gaps.length > 0 ? (
                  <div style={{ fontSize: 13, color: "#d9820b" }}>
                    Cohérence à vérifier, titres d&apos;annonce absents de la page :
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{gaps.map((g) => <li key={g.groupe}>« {g.groupe} » : {g.manquants.join(" | ")}</li>)}</ul>
                  </div>
                ) : <div style={{ fontSize: 13, color: "var(--green)" }}>✓ Chaque titre d&apos;annonce retrouve ses mots sur la page.</div>}
                {landing.notes && <div style={{ fontSize: 13, color: "var(--muted)" }}>{landing.notes}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${msg.ok ? "var(--green)" : "var(--red)"}` }}>
          {msg.lines.map((m, i) => <div key={i} style={{ fontSize: 13 }}>{msg.ok ? "✓ " : "• "}{m}</div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!!busy}>Exporter pour Google Ads Editor (CSV)</button>
        <button type="button" className="btn-ghost" onClick={() => send("check")} disabled={!!busy}>{busy === "check" ? "Vérification…" : "Vérifier sans créer"}</button>
        <button type="button" onClick={() => send("create")} disabled={!!busy || created}>{busy === "create" ? "Création…" : created ? "Créée ✓" : "Créer en pause"}</button>
      </div>
    </div>
  );
}
