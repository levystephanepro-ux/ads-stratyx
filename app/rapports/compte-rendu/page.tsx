// Compte rendu du mois (modèle Ades) : résultats vs mois précédent, tout ce qui a
// été fait jour par jour d'après le journal Google Ads (avec l'auteur), et un texte
// client rédigé par l'IA, à copier ou télécharger en PDF.
import Link from "next/link";
import OptPage from "@/components/opt/OptPage";
import { Notice, Panel, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import PrintButton from "@/components/PrintButton";
import CopyTextButton from "@/components/CopyTextButton";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { isLive } from "@/lib/google-ads/config";
import { CHANGE_KINDS } from "@/lib/reports/changes";
import { getMonthlyReport, readDraft, recentMonths, monthFrame, AUTHORS, type MonthlyReport, type Author, type Draft } from "@/lib/reports/monthly";
import { frDate } from "@/lib/reports/periods";
import { draftMonthlyReportAction } from "@/app/optimiser/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const vs = (a: number, b: number, lowerIsBetter = false, neutral = false) => {
  if (!b) return <span className="op-delta">pas de base de comparaison</span>;
  const d = (a - b) / b;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`op-delta ${Math.abs(d) < 0.005 || neutral ? "" : good ? "good" : "bad"}`}>{d >= 0 ? "+" : "−"}{Math.abs(Math.round(d * 100))} % vs période précédente</span>;
};

export default async function CompteRendu({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/rapports/compte-rendu", sp);
  const months = recentMonths(3);
  const month = months.includes(sp.mois ?? "") ? sp.mois! : months[0];
  const frame = monthFrame(month);

  let r: MonthlyReport | null = null;
  let err: string | null = null;
  let draft: Draft | null = null;
  if (!frame.ready) err = "Le mois vient de commencer : rien à afficher avant demain.";
  else if (scope.account) {
    try {
      [r, draft] = await Promise.all([getMonthlyReport(scope.account.customerId, month), readDraft(scope.account.customerId, month)]);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;

  const lines = r?.lines ?? [];
  const kind = sp.type && lines.some((l) => l.kind === sp.type) ? sp.type : null;
  const by = sp.auteur && sp.auteur in AUTHORS ? (sp.auteur as Author) : null;
  const shown = lines.filter((l) => (!kind || l.kind === kind) && (!by || l.by === by));
  const byDay = new Map<string, typeof shown>();
  shown.forEach((l) => byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]));
  const kinds = [...new Set(lines.map((l) => l.kind))];
  const authors = [...new Set(lines.map((l) => l.by))];
  const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  // texte brut (sans IA) : résultats + actions jour par jour
  const plain = r ? [
    `Compte rendu · ${scope.account?.name ?? ""} · ${frame.label}`,
    `Résultats du ${frDate(frame.start)} au ${frDate(frame.end)} : dépense ${eur(r.res.cost)}, ${Math.round(r.res.conv * 10) / 10} conversion(s), ${r.res.clicks} clics.`,
    "", "Actions menées :",
    ...[...byDay.entries()].flatMap(([day, ls]) => [frDate(day), ...ls.map((l) => `- ${l.text}${l.detail.length ? ` : ${l.detail.join(", ")}` : ""}`)]),
  ].join("\n") : "";

  return (
    <OptPage
      scope={scope}
      title={`Compte rendu · ${frame.label}`}
      sub="Jour par jour, prêt pour le client. Chaque ligne vient du journal Google Ads : datée, avec son auteur."
      filters="none"
      help={<>
        <p>Les <strong>résultats</strong> du mois (du 1er à hier) sont comparés au même nombre de jours du mois précédent.</p>
        <p>Le <strong>journal</strong> liste toutes les modifications du compte, regroupées par jour, type et campagne. Auteur : <strong>Manuel</strong> (interface, Editor), <strong>Stratyx</strong> (corrections envoyées depuis l&apos;app), <strong>API</strong> (autre appli), <strong>Auto Google</strong> (recommandations appliquées toutes seules). Google ne garde que 30 jours d&apos;historique.</p>
        <p><strong>Rédiger le compte rendu</strong> : l&apos;IA écrit le texte client à partir de ces seules données (environ 1 crédit). Relis-le avant de l&apos;envoyer.</p>
      </>}
      extraActions={r ? <><CopyTextButton text={draft?.text ?? plain} className="ui-btn ui-btn-ghost" label="Copier le texte" /><PrintButton className="ui-btn ui-btn-primary" /></> : undefined}
      tabs={months.map((m) => ({ label: monthFrame(m).label.replace(/^./, (c) => c.toUpperCase()), href: scope.href({ mois: m, type: null, auteur: null, msg: null }), active: m === month }))}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {err && <Notice tone="err">{err}</Notice>}
      {!isLive() && r && <Notice tone="warn">Mode démo : données de démonstration.</Notice>}

      {r && (
        <>
          <section className="ui-panel">
            <div className="ui-panel-head">
              <div className="ui-panel-title">Du {frDate(frame.start)} au {frDate(frame.end)}</div>
              <div className="ui-panel-sub" style={{ marginTop: 0 }}>comparé au {frDate(frame.pStart)} → {frDate(frame.pEnd)}</div>
            </div>
            <div className="op-stats4">
              <Stat label="Conversions" value={(Math.round(r.res.conv * 10) / 10).toLocaleString("fr-FR")} sub={vs(r.res.conv, r.prev.conv)} />
              <Stat label="Coût par conversion" value={r.res.conv ? eur(r.res.cost / r.res.conv) : "–"} sub={r.res.conv && r.prev.conv ? vs(r.res.cost / r.res.conv, r.prev.cost / r.prev.conv, true) : <span className="op-delta">{r.res.conv ? "pas de base de comparaison" : "aucune conversion sur la période"}</span>} />
              <Stat label="Clics" value={r.res.clicks.toLocaleString("fr-FR")} sub={vs(r.res.clicks, r.prev.clicks)} />
              <Stat label="Dépense" value={eur(r.res.cost)} sub={vs(r.res.cost, r.prev.cost, false, true)} />
            </div>
          </section>

          <Panel
            title={<span className="op-h2">Le compte rendu à envoyer</span>}
            sub="Actions faites, pourquoi, résultats du mois : rédigé à partir de cette page."
            right={
              <form action={draftMonthlyReportAction} className="no-print">
                <input type="hidden" name="customer_id" value={scope.account?.customerId ?? ""} />
                <input type="hidden" name="account_name" value={scope.account?.name ?? ""} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="back" value={scope.href({ msg: null })} />
                <SubmitButton className="ui-btn ui-btn-primary" pending="Rédaction… (15 s)">{draft ? "Rédiger à nouveau" : "✦ Rédiger le compte rendu"}</SubmitButton>
              </form>
            }
          >
            {draft ? (
              <>
                <div className="cr-draft">{draft.text}</div>
                <div className="dg-foot no-print" style={{ marginTop: 10 }}>Rédigé le {new Date(draft.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })} · relis avant d&apos;envoyer · « Copier le texte » en haut de page.</div>
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--muted)" }}>Pas encore de texte pour ce mois. « Rédiger le compte rendu » écrit un message client (résultats, actions, prochaines étapes) à partir des chiffres et du journal ci-dessous.</p>
            )}
          </Panel>

          <div className="cr-filters no-print">
            <span className="op-subtabs">
              <Link href={scope.href({ type: null, msg: null })} className={!kind ? "active" : undefined}>Tout {lines.length}</Link>
              {kinds.map((k) => <Link key={k} href={scope.href({ type: k, msg: null })} className={kind === k ? "active" : undefined}>{CHANGE_KINDS[k] ?? k} {lines.filter((l) => l.kind === k).length}</Link>)}
            </span>
            {authors.length > 1 && (
              <span className="op-subtabs">
                <Link href={scope.href({ auteur: null, msg: null })} className={!by ? "active" : undefined}>Tous les auteurs</Link>
                {authors.map((a) => <Link key={a} href={scope.href({ auteur: a, msg: null })} className={by === a ? "active" : undefined}>{AUTHORS[a].label}</Link>)}
              </span>
            )}
          </div>
          <p className="dg-foot" style={{ margin: "0 0 10px" }}>
            {count(shown.length, "modification", "modifications")} sur {count(byDay.size, "jour", "jours")}
            {r.since > frame.start ? ` · Google garde 30 jours d'historique : journal lu à partir du ${frDate(r.since)}` : ""}
          </p>

          {byDay.size === 0 ? (
            <Panel><p style={{ margin: 0, color: "var(--muted)" }}>Aucune modification sur la sélection.</p></Panel>
          ) : [...byDay.entries()].map(([day, ls]) => (
            <section key={day} className="ui-panel flush cr-day">
              <div className="cr-day-head">
                <strong>{new Date(day + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).replace(/^./, (c) => c.toUpperCase())}</strong>
                <span>{count(ls.length, "modification", "modifications")}</span>
              </div>
              {ls.map((l, i) => (
                <div key={i} className="cr-line">
                  <span className="cr-time">{l.time}</span>
                  <div className="cr-main">
                    <div><span className="op-tag" style={{ marginRight: 8 }}>{CHANGE_KINDS[l.kind] ?? l.kind}</span>{l.text}</div>
                    {l.detail.length > 0 && <div className="op-kw-sub">{l.detail.slice(0, 6).join(" · ")}{l.detail.length > 6 ? ` (+${l.detail.length - 6})` : ""}</div>}
                  </div>
                  <span className={`op-tag ${l.by === "stratyx" ? "blue" : l.by === "google" ? "red" : ""}`} title={`${AUTHORS[l.by].hint}${l.author ? ` · ${l.author}` : ""}`}>{AUTHORS[l.by].label}</span>
                </div>
              ))}
            </section>
          ))}
          <p className="dg-foot">Source : journal Google Ads (change_event) ; modifications d&apos;un même type, d&apos;une même campagne et d&apos;un même jour regroupées. « Stratyx » : modification par API un jour où une correction a été envoyée depuis l&apos;app.</p>
        </>
      )}
    </OptPage>
  );
}
