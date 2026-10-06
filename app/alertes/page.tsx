// Alertes : modèles prêts à l'emploi + règles personnalisées, vérifiées chaque
// matin avec le diagnostic et envoyées par email si quelque chose se déclenche.
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAlertsConfig, templateOn, TEMPLATES, METRICS, type Metric } from "@/lib/alerts/config";
import { lastAlertsRun } from "@/lib/alerts/run";
import { saveTemplatesAction, addRuleAction, deleteRuleAction, runAlertsNowAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SP = Promise<{ msg?: string }>;
const lab = { display: "block", fontSize: 12, color: "var(--muted)", margin: "0 0 4px" } as const;

export default async function AlertesPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const [cfg, last] = await Promise.all([getAlertsConfig(), lastAlertsRun().catch(() => null)]);
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const sel = { padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14 } as const;

  const headerRight = (
    <form action={runAlertsNowAction}>
      <SubmitButton className="btn" pending="Vérification… (10 à 30 s)">Vérifier maintenant</SubmitButton>
    </form>
  );

  return (
    <Shell active="alertes" token={ctx.mcpToken} headerRight={headerRight} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 4px" }}>Alertes</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Vérifiées chaque matin sur les comptes surveillés, en même temps que le diagnostic. Si une alerte se déclenche, elle arrive en tête de l&apos;email. Sans IA, aucun crédit.
      </p>
      {msg && <div className="card" style={{ borderColor: msg.ok ? "var(--green)" : "#f59e0b", margin: "10px 0" }}>{msg.text}</div>}

      {last && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong>Dernière vérification</strong>
            <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{new Date(last.ranAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })}</span>
          </div>
          {last.accounts.length === 0 && <p className="subtitle" style={{ margin: "6px 0 0" }}>Aucun compte vérifié.</p>}
          {last.accounts.map((a) => (
            <div key={a.customerId} style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600 }}>{a.name} {a.alerts.length === 0 && <span style={{ color: "var(--green)", fontWeight: 400, fontSize: 13 }}>· rien à signaler</span>}</div>
              {a.alerts.map((x) => (
                <div key={x.key} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 7, flexShrink: 0, background: x.severity === "critique" ? "var(--red)" : "#f59e0b" }} />
                  <div><div style={{ fontWeight: 600 }}>{x.title}</div><div className="subtitle" style={{ margin: 0, fontSize: 13, wordBreak: "break-word" }}>{x.detail}</div></div>
                </div>
              ))}
              {a.errors.length > 0 && <div className="subtitle" style={{ fontSize: 11, margin: "4px 0 0" }}>Lectures incomplètes : {a.errors.map((e) => e.slice(0, 90)).join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}

      <form action={saveTemplatesAction} className="card" style={{ marginBottom: 14 }}>
        <strong>Modèles</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {TEMPLATES.map((t) => {
            const v = templateOn(cfg, t.key);
            return (
              <div key={t.key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: "1 1 300px", cursor: "pointer" }}>
                  <input type="checkbox" name={`on_${t.key}`} defaultChecked={v.on} />
                  <span><strong>{t.label}</strong><br /><span className="subtitle" style={{ fontSize: 12, margin: 0 }}>{t.hint}</span></span>
                </label>
                {t.param && (
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    {t.param.label}
                    <input name={`p_${t.key}`} defaultValue={String(v.param)} inputMode="decimal" style={{ width: 70, padding: "6px 8px", fontSize: 13 }} />
                    <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{t.param.unit}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <SubmitButton pending="Enregistrement…" style={{ marginTop: 12 }}>Enregistrer les modèles</SubmitButton>
      </form>

      <div className="card">
        <strong>Règles personnalisées</strong>
        <p className="subtitle" style={{ margin: "4px 0 10px", fontSize: 13 }}>Exemple : « Dépense d&apos;hier &gt; 60 € » ou « Taux de clic des 7 derniers jours &lt; 3 % sur les campagnes Fenêtres ».</p>
        {cfg.rules.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {cfg.rules.map((r) => (
              <form key={r.id} action={deleteRuleAction} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <input type="hidden" name="id" value={r.id} />
                <span style={{ fontSize: 14 }}>
                  {r.name && <strong>{r.name} · </strong>}
                  {METRICS[r.metric].label} {r.period === "hier" ? "d'hier" : "des 7 derniers jours"} {r.op} {r.value}{METRICS[r.metric].unit ? ` ${METRICS[r.metric].unit}` : ""}
                  {r.campaign ? ` · campagnes « ${r.campaign} »` : " · compte entier"}
                </span>
                <button type="submit" className="btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Supprimer</button>
              </form>
            ))}
          </div>
        )}
        <form action={addRuleAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end" }}>
          <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Nom (facultatif)</span><input name="name" placeholder="Ex. Dépense anormale" /></div>
          <div><span style={lab}>Indicateur</span>
            <select name="metric" style={sel} defaultValue="cost">
              {(Object.keys(METRICS) as Metric[]).map((m) => <option key={m} value={m}>{METRICS[m].label}{METRICS[m].unit ? ` (${METRICS[m].unit})` : ""}</option>)}
            </select></div>
          <div><span style={lab}>Période</span>
            <select name="period" style={sel} defaultValue="hier"><option value="hier">Hier</option><option value="7">7 derniers jours</option></select></div>
          <div><span style={lab}>Condition</span>
            <select name="op" style={sel} defaultValue=">"><option value=">">au-dessus de</option><option value="<">en dessous de</option></select></div>
          <div><span style={lab}>Seuil</span><input name="value" inputMode="decimal" placeholder="60" required /></div>
          <div><span style={lab}>Campagnes contenant</span><input name="campaign" placeholder="vide = compte entier" /></div>
          <div><SubmitButton pending="Ajout…" style={{ width: "100%" }}>Ajouter la règle</SubmitButton></div>
        </form>
      </div>
    </Shell>
  );
}
