// Signaler un bug : formulaire court (n'importe quel utilisateur connecté),
// et pour le propriétaire la liste des signalements + texte prêt à coller pour Claude.
import Shell from "@/components/Shell";
import SubmitButton from "@/components/SubmitButton";
import CopyTextButton from "@/components/CopyTextButton";
import { getDashboardContext } from "@/lib/workspace";
import { listBugs, bugsForClaude } from "@/lib/bugs";
import { reportBugAction, toggleBugAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signaler un bug" };

type SP = Promise<{ from?: string; ok?: string; err?: string }>;

export default async function BugPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  const sp = await searchParams;
  const from = (sp.from ?? "").slice(0, 200);
  const bugs = ctx.isOwner ? await listBugs() : [];
  const open = bugs.filter((b) => !b.done);
  const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

  return (
    <Shell active="bug" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 4px" }}>Signaler un bug</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Décris ce qui ne marche pas : ce que tu as fait, ce que tu attendais, ce qui s&apos;est passé. Une phrase suffit.
      </p>

      {sp.ok === "1" && <div className="card" style={{ borderColor: "var(--green)", margin: "10px 0" }}>Merci, c&apos;est noté{ctx.isOwner ? " (et envoyé par email à contact@stratyxmedia.fr)" : ""}.</div>}
      {sp.err === "1" && <div className="card" style={{ borderColor: "#f59e0b", margin: "10px 0" }}>Écris au moins quelques mots sur le problème.</div>}

      <form action={reportBugAction} className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Page concernée</span>
          <input name="page" defaultValue={from} placeholder="/alertes" style={{ padding: "8px 10px" }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Le problème</span>
          <textarea name="text" required rows={5} placeholder="Ex. : j'ai cliqué sur « Vérifier maintenant », l'alerte s'affiche mais je n'ai pas reçu d'email." style={{ padding: "10px 12px", fontFamily: "inherit", fontSize: 14, resize: "vertical" }} />
        </label>
        <div><SubmitButton className="btn" pending="Envoi…">Envoyer</SubmitButton></div>
      </form>

      {ctx.isOwner && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>Signalements ({open.length} ouvert{open.length > 1 ? "s" : ""})</strong>
            {open.length > 0 && <CopyTextButton text={bugsForClaude(bugs)} label="Copier pour Claude" />}
          </div>
          <p className="subtitle" style={{ margin: "4px 0 10px", fontSize: 12 }}>
            « Copier pour Claude » met tous les bugs ouverts dans le presse-papier : colle-les dans une conversation avec Claude pour qu&apos;il les corrige.
          </p>
          {bugs.length === 0 && <p className="subtitle" style={{ margin: 0 }}>Aucun signalement.</p>}
          {bugs.map((b) => (
            <div key={b.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", opacity: b.done ? 0.5 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 7, flexShrink: 0, background: b.done ? "var(--green)" : "var(--red)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>
                  {fmt(b.at)} · {b.page}{b.email ? ` · ${b.email}` : ""}{b.account ? ` · ${b.account}` : ""}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, marginTop: 2, textDecoration: b.done ? "line-through" : undefined }}>{b.text}</div>
              </div>
              <form action={toggleBugAction}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="done" value={b.done ? "0" : "1"} />
                <button type="submit" className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>{b.done ? "Rouvrir" : "Résolu"}</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
