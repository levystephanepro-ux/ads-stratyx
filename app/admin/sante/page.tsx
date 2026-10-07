// Bilan de santé : vérifications automatiques en lecture seule + liste de tests à faire à la main.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { healthChecks, saveHealthSummary, type Status } from "@/lib/health";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ICON: Record<Status, string> = { ok: "OK", warn: "À vérifier", fail: "Échec", skip: "Ignoré" };
const COLOR: Record<Status, string> = { ok: "var(--green)", warn: "#d9820b", fail: "var(--red)", skip: "var(--muted)" };

const MANUAL: { t: string; how: string; href: string }[] = [
  { t: "Diagnostic", how: "Clique « Relancer le diagnostic ». Le résultat et l'heure de lecture doivent changer.", href: "/waste" },
  { t: "Correction en un clic", how: "Applique un ajout de négatifs, vérifie-le dans Google Ads, puis annule-le depuis le Journal des corrections.", href: "/waste/journal" },
  { t: "Prévisions et structure IA", how: "Lance une recherche (ex. « fenêtre pvc », Toulon), « Proposer la structure avec l'IA », ajoute 1 lien annexe et 1 accroche, puis « Vérifier sans créer ».", href: "/previsions" },
  { t: "Export Google Ads Editor", how: "Dans Prévisions, « Exporter pour Google Ads Editor », puis dans Editor : Compte, Importer, Depuis un fichier. Note les erreurs.", href: "/previsions" },
  { t: "Questionnaire client", how: "Sur une fiche, copie le lien court, ouvre-le en navigation privée, enregistre un brouillon, puis envoie. Vérifie le statut sur la fiche.", href: "/clients" },
  { t: "Contexte IA", how: "Après le questionnaire, demande au Copilote « que sais-tu de ce client ? » sur le compte lié.", href: "/copilote" },
  { t: "Rapport client", how: "Crée un rapport, ouvre le lien client en navigation privée, télécharge le PDF.", href: "/rapports" },
  { t: "Audits PDF", how: "Audit prospect sur une landing D2B, puis Audit PDF du compte depuis le Diagnostic. Vérifie la mise en page du PDF.", href: "/audit/prospect" },
  { t: "Persona", how: "Depuis une fiche client remplie, ouvre Persona : les champs doivent être pré-remplis.", href: "/clients" },
  { t: "Emails", how: "Vérifie la réception de l'email du matin (si alertes) et du lundi.", href: "/alertes" },
];

export default async function SantePage() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const t = Date.now();
  const checks = await healthChecks();
  await saveHealthSummary(checks);
  const groups = [...new Set(checks.map((c) => c.group))];
  const count = (s: Status) => checks.filter((c) => c.status === s).length;

  return (
    <Shell active="sante" token={ctx.mcpToken} showAdmin trialDaysLeft={ctx.trialDaysLeft} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href="/admin/sante">Relancer les tests</Link>}>
      <h1 style={{ margin: "0 0 6px" }}>Bilan de santé</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Tests automatiques en lecture seule : rien n&apos;est créé ni modifié dans Google Ads (la création de campagne est simulée par Google).
        Durée {Math.round((Date.now() - t) / 1000)} s · coût IA négligeable.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 16px" }}>
        <span className="pill" style={{ color: COLOR.ok }}>{count("ok")} OK</span>
        <span className="pill" style={{ color: COLOR.warn }}>{count("warn")} à vérifier</span>
        <span className="pill" style={{ color: COLOR.fail }}>{count("fail")} échec(s)</span>
      </div>

      {groups.map((g) => (
        <div key={g} className="card" style={{ marginBottom: 12, padding: 0 }}>
          <div style={{ padding: "12px 16px", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>{g}</div>
          {checks.filter((c) => c.group === g).map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 260px) 90px minmax(0, 1fr)", gap: 10, padding: "9px 16px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{c.label}</span>
              <span style={{ color: COLOR[c.status], fontWeight: 700 }}>{ICON[c.status]}</span>
              <span style={{ overflowWrap: "anywhere" }}>{c.detail}{c.ms !== undefined && c.ms > 3000 ? ` (${Math.round(c.ms / 1000)} s)` : ""}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ marginTop: 20 }}>
        <strong>Tests à faire à la main</strong>
        <p className="subtitle" style={{ margin: "4px 0 10px", fontSize: 13 }}>Ceux-là modifient quelque chose ou demandent tes yeux. Note ce qui coince et envoie-le moi avec une capture.</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {MANUAL.map((m) => (
            <li key={m.t} style={{ margin: "8px 0" }}>
              <Link href={m.href}><strong>{m.t}</strong></Link>
              <div className="subtitle" style={{ margin: 0, fontSize: 13 }}>{m.how}</div>
            </li>
          ))}
        </ol>
      </div>
    </Shell>
  );
}
