// Audit (modèle Ades) : grille de 139 critères par catégorie, modèles (complet,
// leads, local, e-commerce), « Mes critères », scan noté sur 100 et historique.
import Link from "next/link";
import OptPage from "@/components/opt/OptPage";
import { Notice, Panel, ScoreRing, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import PrintButton from "@/components/PrintButton";
import { Icons } from "@/components/Icons";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { AUDIT_GRID } from "@/lib/audit/criteria";
import { activeCriteria, evaluate, fetchScanData, MODELS, readOff, readScans, type Model, type ScanResult, type ScanStatus } from "@/lib/audit/scan";
import { saveCriteriaAction, scanAuditAction } from "@/app/optimiser/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ICON: Record<string, keyof typeof Icons> = {
  compte: "comptes", suivi: "sante", encheres: "chart", structure: "templates", mots_cles: "gsc", termes: "gsc",
  annonces: "copilote", pmax: "sparkles", shopping: "building", display: "chart", pages: "rapports", ciblage: "persona", tendances: "previsions",
};
const SEVL = { haut: "Haut · très strict", moyen: "Moyen · un peu moins strict", bas: "Bas · tranquille" };
const ST: Record<ScanStatus, { label: string; tone: string }> = {
  ok: { label: "Parfait", tone: "green" }, warn: { label: "À vérifier", tone: "blue" }, bad: { label: "Incorrect", tone: "red" },
  manual: { label: "À cocher", tone: "" }, na: { label: "Non applicable", tone: "" },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/audit", sp);
  const model: Model = (sp.modele && sp.modele in MODELS ? sp.modele : "complet") as Model;
  const off = await readOff();
  const cats = activeCriteria(model, off);
  const nActive = cats.reduce((s, c) => s + c.items.length, 0);
  const scans = scope.account ? await readScans(scope.account.customerId) : [];
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;

  let scan: ScanResult | null = null;
  let scanErr: string | null = null;
  if (sp.scan === "now" && scope.ads) {
    try { const { data, skipped } = await fetchScanData(scope.ads); scan = evaluate(data, model, off, skipped); } catch (e) { scanErr = e instanceof Error ? e.message : String(e); }
  } else if (sp.scan !== undefined) {
    scan = scans[Number(sp.scan)] ?? null;
  }
  const view = scan ? "resultat" : sp.onglet === "criteres" ? "criteres" : "accueil";

  const scanForm = (
    <form action={scanAuditAction}>
      <input type="hidden" name="customer_id" value={scope.account?.customerId ?? ""} />
      <input type="hidden" name="modele" value={model} />
      <input type="hidden" name="back" value={scope.href({ msg: null, scan: null })} />
      <SubmitButton className="ui-btn ui-btn-primary" pending="Scan en cours… (30 à 60 s)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
        {scan ? "Relancer le scan" : "Scanner le compte"}
      </SubmitButton>
    </form>
  );

  return (
    <OptPage
      scope={scope}
      title="Audit"
      sub="Un audit complet du compte, noté sur 100, puis le rapport PDF à imprimer ou envoyer."
      filters="none"
      ia={scan ? `Lis le dernier audit noté ${scan.score}/100 et propose un plan de correction par ordre d'impact` : undefined}
      extraActions={<>{scan && <PrintButton />}{scanForm}</>}
      help={<>
        <p>L&apos;audit passe le compte au crible de la grille ({AUDIT_GRID.reduce((s, c) => s + c.items.length, 0)} critères de media buyers) sur les 30 derniers jours, 90 jours pour les termes de recherche. Sans IA, aucun crédit.</p>
        <p>Chaque critère sort <strong>Parfait</strong>, <strong>À vérifier</strong> ou <strong>Incorrect</strong>. Ce que l&apos;API ne permet pas de lire reste <strong>À cocher</strong> (jamais inventé). La note pèse les critères selon leur sévérité (haut ×3, moyen ×2, bas ×1).</p>
        <p><strong>Modèle</strong> : garde seulement les critères utiles au type de compte. <strong>Mes critères</strong> : désactive ceux qui ne te servent pas.</p>
      </>}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {scanErr && <Notice tone="err">Scan impossible : {scanErr.slice(0, 220)}</Notice>}
      {sp.scan !== undefined && sp.scan !== "now" && !scan && <Notice tone="warn">Audit introuvable dans l&apos;historique.</Notice>}

      {view === "accueil" && (
        <>
          <Panel title={<span className="op-h2">Ce que l&apos;audit va analyser</span>} sub={`${nActive} critères actifs · 30 derniers jours, 90 jours pour les termes de recherche`}>
            <form className="op-toolbar" action={scope.path}>
              {Object.entries(sp).filter(([k, v]) => v && !["modele", "msg", "onglet", "scan"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <span className="op-kw-sub" style={{ marginTop: 0 }}>Modèle</span>
              <select name="modele" defaultValue={model} className="op-mini-select" aria-label="Modèle d'audit">
                {Object.entries(MODELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="ui-btn ui-btn-ghost" type="submit">Appliquer</button>
              <Link className="ui-btn ui-btn-ghost" href={scope.href({ onglet: "criteres", msg: null })}>Mes critères</Link>
            </form>
            <div className="op-cats">
              {cats.map((c) => (
                <div key={c.key} className={`op-cat${c.items.length ? "" : " off"}`}>
                  <span className="op-cat-ic">{Icons[ICON[c.key] ?? "audit"]}</span>
                  <span><strong>{c.title}</strong><em>{c.items.length} critère{c.items.length > 1 ? "s" : ""}</em></span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={<span className="op-h2">Audits précédents</span>} flush>
            {scans.length === 0 ? (
              <p className="dg-empty">Aucun audit pour ce compte. Clique sur « Scanner le compte ».</p>
            ) : scans.map((s, i) => (
              <Link key={s.at} href={scope.href({ scan: String(i), msg: null })} className="op-hist">
                <span>{new Date(s.at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })}</span>
                <span className="op-kw-sub" style={{ marginTop: 0 }}>{MODELS[s.model]}</span>
                <span><strong className={s.score >= 80 ? "op-good" : s.score >= 60 ? "" : "op-bad"}>{s.score} / 100</strong> · {s.counts.bad} incorrect{s.counts.bad > 1 ? "s" : ""}</span>
                <span className="op-link">Ouvrir →</span>
              </Link>
            ))}
          </Panel>
        </>
      )}

      {view === "criteres" && (
        <form action={saveCriteriaAction}>
          <input type="hidden" name="back" value={scope.href({ msg: null })} />
          <div className="op-crit-bar">
            <Link className="ui-btn ui-btn-ghost" href={scope.href({ onglet: null, msg: null })}>← Retour</Link>
            <span className="op-kw-sub" style={{ marginTop: 0 }}>Coche les critères à garder : ils s&apos;appliquent à tous les comptes.</span>
            <SubmitButton className="ui-btn ui-btn-primary" pending="…">Enregistrer</SubmitButton>
          </div>
          {AUDIT_GRID.map((c) => (
            <section key={c.key} className="ui-panel flush op-crit">
              <div className="op-crit-head"><strong>{c.title}</strong><span>{c.intro}</span></div>
              {c.items.map((it, i) => {
                const id = `${c.key}.${i}`;
                return (
                  <label key={id} className="op-crit-row">
                    <input type="checkbox" name="on" value={id} defaultChecked={!off.has(id)} className="op-switch" />
                    <span className="op-crit-main">
                      <strong>{it.label}</strong>
                      {it.tags?.map((t) => <span key={t} className="op-tag" style={{ marginLeft: 6 }}>{t === "ecommerce" ? "E-commerce" : t === "leads" ? "Leads" : "Local"}</span>)}
                      {it.ia && <span className="op-tag blue" style={{ marginLeft: 6 }}>Jugement</span>}
                      <span className="op-crit-rule">{it.rule}</span>
                    </span>
                    <span className="op-crit-sev"><strong>{SEVL[it.sev].split(" · ")[0]}</strong> · {SEVL[it.sev].split(" · ")[1]}</span>
                  </label>
                );
              })}
            </section>
          ))}
          <div className="op-crit-bar"><span /><SubmitButton className="ui-btn ui-btn-primary" pending="…">Enregistrer</SubmitButton></div>
        </form>
      )}

      {view === "resultat" && scan && <Result scan={scan} hrefCat={(c) => scope.href({ cat: c })} cat={sp.cat} filter={sp.f} href={(p) => scope.href(p)} />}
    </OptPage>
  );
}

function Result({ scan, cat, filter, href }: { scan: ScanResult; cat?: string; filter?: string; hrefCat: (c: string) => string; href: (p: Record<string, string | null>) => string }) {
  const byId = new Map(scan.items.map((i) => [i.id, i]));
  const cats = AUDIT_GRID.map((c) => {
    const items = c.items.map((it, i) => ({ ...it, id: `${c.key}.${i}`, r: byId.get(`${c.key}.${i}`) })).filter((x) => x.r);
    const W = { haut: 3, moyen: 2, bas: 1 };
    let got = 0, max = 0;
    items.forEach((x) => { if (["ok", "warn", "bad"].includes(x.r!.status)) { max += W[x.sev]; got += W[x.sev] * (x.r!.status === "ok" ? 1 : x.r!.status === "warn" ? 0.5 : 0); } });
    return { ...c, items, score: max ? Math.round((got / max) * 100) : null, bad: items.filter((x) => x.r!.status === "bad").length };
  }).filter((c) => c.items.length);
  const order: Record<ScanStatus, number> = { bad: 0, warn: 1, manual: 2, ok: 3, na: 4 };
  const sevOrder = { haut: 0, moyen: 1, bas: 2 };
  const shown = cats.filter((c) => !cat || c.key === cat);
  const flt = (s: ScanStatus) => !filter || filter === s || (filter === "pb" && (s === "bad" || s === "warn"));
  const scoreTxt = scan.score >= 80 ? "Compte sain" : scan.score >= 60 ? "À surveiller" : "À reprendre";
  return (
    <>
      <section className="ui-panel dg-hero">
        <div className="dg-hero-score"><ScoreRing score={scan.score} size={112} /><Stat label="Note de l'audit" value={scoreTxt} sub={`${MODELS[scan.model]} · ${new Date(scan.at).toLocaleDateString("fr-FR", { dateStyle: "long" })}`} /></div>
        <Stat label="Incorrects" value={scan.counts.bad} tone={scan.counts.bad ? "bad" : "good"} />
        <Stat label="À vérifier" value={scan.counts.warn} tone={scan.counts.warn ? "warn" : undefined} />
        <Stat label="Parfaits" value={scan.counts.ok} tone="good" sub={`${scan.counts.manual} à cocher · ${scan.counts.na} non applicables`} />
      </section>
      <div className="op-cat-scores">
        <Link href={href({ cat: null })} className={`op-cat-score${!cat ? " active" : ""}`}><span>Toutes les catégories</span><strong>{scan.items.length}</strong></Link>
        {cats.map((c) => (
          <Link key={c.key} href={href({ cat: c.key })} className={`op-cat-score${cat === c.key ? " active" : ""}`}>
            <span>{c.title}</span>
            <strong className={c.score === null ? "" : c.score >= 80 ? "op-good" : c.score >= 60 ? "" : "op-bad"}>{c.score === null ? "–" : `${c.score}`}</strong>
          </Link>
        ))}
      </div>
      <div className="op-toolbar">
        <span className="op-subtabs">
          <a href={href({ f: null })} className={!filter ? "active" : undefined}>Tous</a>
          <a href={href({ f: "pb" })} className={filter === "pb" ? "active" : undefined}>Problèmes</a>
          <a href={href({ f: "manual" })} className={filter === "manual" ? "active" : undefined}>À cocher</a>
          <a href={href({ f: "ok" })} className={filter === "ok" ? "active" : undefined}>Parfaits</a>
        </span>
      </div>
      {shown.map((c) => {
        const items = c.items.filter((x) => flt(x.r!.status)).sort((a, b) => order[a.r!.status] - order[b.r!.status] || sevOrder[a.sev] - sevOrder[b.sev]);
        if (!items.length) return null;
        return (
          <section key={c.key} className="ui-panel flush op-crit">
            <div className="op-crit-head"><strong>{c.title}</strong><span>{c.intro}</span>{c.score !== null && <span className="op-crit-score">{c.score}/100</span>}</div>
            {items.map((x) => (
              <div key={x.id} className="op-crit-row">
                <span className={`op-tag ${ST[x.r!.status].tone}`} style={{ minWidth: 92, textAlign: "center" }}>{ST[x.r!.status].label}</span>
                <span className="op-crit-main">
                  <strong>{x.label}</strong>
                  <span className="op-crit-rule" style={{ color: "var(--text)" }}>{x.r!.detail}</span>
                  <span className="op-crit-rule">{x.rule}</span>
                </span>
                <span className="op-crit-sev"><strong>{SEVL[x.sev].split(" · ")[0]}</strong></span>
              </div>
            ))}
          </section>
        );
      })}
      {scan.skipped.length > 0 && <p className="dg-foot">Lectures indisponibles : {scan.skipped.join(" · ")}</p>}
    </>
  );
}

