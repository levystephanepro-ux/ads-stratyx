"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/workspace";
import { getAlertsConfig, saveAlertsConfig, TEMPLATES, METRICS, type CustomRule, type Metric } from "@/lib/alerts/config";
import { runAlertsForOwner } from "@/lib/alerts/run";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
}
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));

export async function saveTemplatesAction(form: FormData): Promise<void> {
  await owner();
  const c = await getAlertsConfig();
  for (const t of TEMPLATES) {
    const p = num(form.get(`p_${t.key}`));
    c.templates[t.key] = { on: form.get(`on_${t.key}`) === "on", param: t.param ? (Number.isFinite(p) && p > 0 ? p : t.param.def) : undefined };
  }
  await saveAlertsConfig(c);
  revalidatePath("/alertes");
  redirect(`/alertes?msg=${encodeURIComponent("ok:Alertes enregistrées.")}`);
}

export async function addRuleAction(form: FormData): Promise<void> {
  await owner();
  const metric = String(form.get("metric") ?? "") as Metric;
  const value = num(form.get("value"));
  if (!(metric in METRICS) || !Number.isFinite(value)) redirect(`/alertes?msg=${encodeURIComponent("err:Règle incomplète : choisis un indicateur et un seuil.")}`);
  const rule: CustomRule = {
    id: Math.random().toString(36).slice(2, 10),
    name: String(form.get("name") ?? "").trim().slice(0, 80),
    metric, value,
    op: form.get("op") === "<" ? "<" : ">",
    period: form.get("period") === "7" ? "7" : "hier",
    campaign: String(form.get("campaign") ?? "").trim().slice(0, 80),
  };
  const [acc, accName] = String(form.get("account") ?? "").split("|");
  if (/^\d{6,12}$/.test(acc ?? "")) { rule.account = acc; rule.accountName = (accName ?? "").slice(0, 80); }
  const c = await getAlertsConfig();
  c.rules = [...c.rules, rule].slice(0, 30);
  await saveAlertsConfig(c);
  revalidatePath("/alertes");
  redirect(`/alertes?msg=${encodeURIComponent("ok:Règle ajoutée.")}`);
}

export async function deleteRuleAction(form: FormData): Promise<void> {
  await owner();
  const id = String(form.get("id") ?? "");
  const c = await getAlertsConfig();
  c.rules = c.rules.filter((r) => r.id !== id);
  await saveAlertsConfig(c);
  revalidatePath("/alertes");
}

export async function runAlertsNowAction(): Promise<void> {
  await owner();
  let msg: string;
  try {
    const run = await runAlertsForOwner();
    const n = run.accounts.reduce((s, a) => s + a.alerts.length, 0);
    msg = run.accounts.length === 0 ? "err:Aucun compte surveillé (mode démo ou Comptes liés)." : n ? `err:${n} alerte(s) déclenchée(s), détail ci-dessous.` : "ok:Vérifié : aucune alerte.";
  } catch (e) { msg = `err:${e instanceof Error ? e.message : String(e)}`; }
  revalidatePath("/alertes");
  redirect(`/alertes?msg=${encodeURIComponent(msg)}`);
}
