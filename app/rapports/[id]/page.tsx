// Éditeur de rapport client : réglages à gauche, aperçu de ce que voit le client à droite.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/Shell";
import ReportView from "@/components/ReportView";
import PrintButton from "@/components/PrintButton";
import CopyLinkButton from "@/components/CopyLinkButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { getReport, listFolders } from "@/lib/reports/store";
import { buildReport, SECTIONS, ALL_SECTIONS } from "@/lib/reports/data";
import { PERIODS, periodRange } from "@/lib/reports/periods";
import { saveReportAction, deleteReportAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const field = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", fontFamily: "inherit", fontSize: 14 } as const;
const lab = { fontSize: 11, textTransform: "uppercase" as const, color: "var(--muted)", fontWeight: 600, margin: "10px 0 4px", display: "block" };
const TEMPLATES = [
  { key: "hebdo", label: "Hebdo", period: "semaine-derniere" },
  { key: "mensuel", label: "Mensuel", period: "mois-dernier" },
  { key: "qbr", label: "QBR", period: "90" },
  { key: "annuel", label: "Annuel", period: "365" },
];

type P = Promise<{ id: string }>;
type SP = Promise<{ folder?: string; saved?: string; template?: string }>;

export default async function ReportEditor({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouveau";
  const existing = isNew ? null : await getReport(id);
  if (!isNew && !existing) notFound();

  const [{ accounts, defaultCustomerId }, folders] = await Promise.all([
    getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }),
    listFolders().catch(() => []),
  ]);
  const folderId = existing?.folder_id ?? sp.folder ?? "";
  const folder = folders.find((f) => f.id === folderId);
  const tpl = TEMPLATES.find((t) => t.key === (existing?.template ?? sp.template)) ?? TEMPLATES[1];
  const r = {
    customer_id: existing?.customer_id ?? folder?.customer_id ?? defaultCustomerId ?? accounts[0]?.customerId ?? "",
    title: existing?.title ?? "",
    template: tpl.key,
    mode: existing?.mode ?? "leadgen",
    theme: existing?.theme ?? "clair",
    period: existing?.period ?? (isNew ? tpl.period : "30"),
    compare: existing?.compare ?? true,
    client_period: existing?.client_period ?? true,
    intro: existing?.intro ?? "",
    analysis: existing?.analysis ?? "",
    optimisations: existing?.optimisations ?? "",
    sections: existing?.sections?.length ? existing.sections : ALL_SECTIONS,
    author: existing?.author ?? "Stéphane LEVY",
  };
  const accountName = accounts.find((a) => a.customerId === r.customer_id)?.name ?? existing?.account_name ?? r.customer_id;

  let preview: React.ReactNode = null;
  if (!isLive()) preview = <div className="card">Mode démo : l&apos;aperçu lit un vrai compte Google Ads (ADS_DATA_MODE=live).</div>;
  else if (!r.customer_id) preview = <div className="card">Aucun compte Google Ads disponible.</div>;
  else {
    try {
      const data = await buildReport({ customerId: r.customer_id }, periodRange(r.period), r.sections);
      preview = (
        <>
          {data.errors.length > 0 && <div className="card no-print" style={{ marginBottom: 10, fontSize: 12 }}>Sections incomplètes : {data.errors.join(" · ")}</div>}
          <ReportView data={data} meta={{ ...r, title: r.title || `${accountName} · bilan`, accountName, customerId: r.customer_id }} />
        </>
      );
    } catch (e) {
      preview = <div className="card" style={{ borderColor: "var(--red)" }}>{e instanceof Error ? e.message : String(e)}</div>;
    }
  }

  return (
    <Shell active="rapports" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div className="subtitle no-print" style={{ fontSize: 13 }}><Link href="/rapports">Rapports</Link>{folder ? ` › ${folder.name}` : ""} › {isNew ? "Nouveau rapport" : r.title || accountName}</div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 14px" }}>
        <h1 style={{ margin: 0 }}>{isNew ? `Nouveau rapport${folder ? ` pour ${folder.name}` : ""}` : r.title || accountName}</h1>
        {existing && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CopyLinkButton path={`/r/${existing.share_token}`} />
            <Link className="btn-ghost" href={`/r/${existing.share_token}`} target="_blank">Voir comme le client</Link>
            <PrintButton />
          </div>
        )}
      </div>
      {sp.saved && <div className="pill ok no-print" style={{ marginBottom: 10 }}>Enregistré</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="copilote-layout">
        <form action={saveReportAction} className="card no-print" style={{ position: "sticky", top: 12 }}>
          <input type="hidden" name="id" value={existing?.id ?? ""} />
          <span style={lab}>Modèle</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TEMPLATES.map((t) => (
              <label key={t.key} className={`pill ${r.template === t.key ? "ok" : ""}`} style={{ cursor: "pointer" }}>
                <input type="radio" name="template" value={t.key} defaultChecked={r.template === t.key} style={{ marginRight: 4 }} />{t.label}
              </label>
            ))}
          </div>
          <span style={lab}>Chiffres · Thème</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select name="mode" defaultValue={r.mode} style={field}><option value="leadgen">Lead gen</option><option value="ecom">E-commerce</option></select>
            <select name="theme" defaultValue={r.theme} style={field}><option value="clair">Clair</option><option value="sombre">Sombre</option></select>
          </div>
          <span style={lab}>Dossier</span>
          <select name="folder_id" defaultValue={folderId} style={field}>
            <option value="">Sans dossier</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span style={lab}>Compte · Période</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select name="account" defaultValue={`${r.customer_id}|${accountName}`} style={field}>
              {accounts.map((a) => <option key={a.customerId} value={`${a.customerId}|${a.name}`}>{a.name}</option>)}
            </select>
            <select name="period" defaultValue={r.period} style={field}>
              {[...PERIODS, { key: "365", label: "12 derniers mois" }].map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <span style={lab}>Titre du rapport</span>
          <input name="title" defaultValue={r.title} placeholder={`Ex. « ${accountName} · bilan de septembre »`} style={field} />
          <span style={lab}>Préparé par</span>
          <input name="author" defaultValue={r.author} style={field} />
          <span style={lab}>Mot d&apos;introduction (facultatif)</span>
          <textarea name="intro" defaultValue={r.intro} rows={3} placeholder="Deux ou trois phrases pour ton client : ce qui s'est passé, ce que tu proposes." style={field} />
          <span style={lab}>Ton analyse (facultatif)</span>
          <textarea name="analysis" defaultValue={r.analysis} rows={3} placeholder="Ce qui explique les chiffres, en deux ou trois phrases." style={field} />
          <span style={lab}>Tes optimisations (facultatif)</span>
          <textarea name="optimisations" defaultValue={r.optimisations} rows={3} placeholder="Ce que tu as changé et ce que tu proposes." style={field} />

          <span style={lab}>Sections du rapport</span>
          <label style={{ display: "flex", gap: 6, fontSize: 13 }}><input type="checkbox" name="compare" defaultChecked={r.compare} /> Comparer à la période précédente</label>
          <label style={{ display: "flex", gap: 6, fontSize: 13, marginTop: 4 }}><input type="checkbox" name="client_period" defaultChecked={r.client_period} /> Le client peut changer la période</label>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {SECTIONS.map((s) => (
              <label key={s.key} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
                <input type="checkbox" name={`s_${s.key}`} defaultChecked={r.sections.includes(s.key)} />
                <span><strong>{s.label}</strong><br /><span className="subtitle" style={{ fontSize: 12, margin: 0 }}>{s.hint}</span></span>
              </label>
            ))}
          </div>
          <button type="submit" style={{ width: "100%", marginTop: 14 }}>{isNew ? "Créer le rapport" : "Enregistrer et actualiser l'aperçu"}</button>
          <p className="subtitle" style={{ fontSize: 11, margin: "6px 0 0" }}>Le modèle choisit la période par défaut à la création ; tu peux la changer à tout moment.</p>
        </form>

        <div>
          <div className="subtitle no-print" style={{ fontSize: 12, textTransform: "uppercase", margin: "0 0 8px" }}>Aperçu · ce que voit le client</div>
          {preview}
          {existing && (
            <form action={deleteReportAction} className="no-print" style={{ marginTop: 14, textAlign: "right" }}>
              <input type="hidden" name="id" value={existing.id} />
              <button type="submit" className="btn-ghost" style={{ color: "var(--red)" }}>Supprimer ce rapport</button>
            </form>
          )}
        </div>
      </div>
    </Shell>
  );
}
