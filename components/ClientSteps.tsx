// Parcours d'un client en 6 étapes, avec l'état de chacune et le bouton qui fait avancer.
import Link from "next/link";
import type { Client } from "@/lib/clients/store";
import { stageOf, stageRank } from "@/lib/clients/stages";
import { setStageAction } from "@/app/clients/actions";

type State = "fait" | "en_cours" | "a_faire";
interface Step { n: number; title: string; state: State; detail: string; links: { href: string; label: string }[]; advance?: { stage: string; label: string } }

const COLOR: Record<State, string> = { fait: "var(--green)", en_cours: "var(--accent)", a_faire: "var(--border)" };

export default function ClientSteps({ c, hasProposal }: { c: Client; hasProposal: boolean }) {
  const r = stageRank(stageOf(c));
  const fiche = `/clients/${c.id}`;
  const acc = c.customer_id ? `?account=${c.customer_id}` : "";
  const site = c.website || c.answers?.site;
  const steps: Step[] = [
    { n: 1, title: "Découverte", state: c.status === "rempli" ? "fait" : c.status === "a_envoyer" ? "a_faire" : "en_cours",
      detail: c.status === "rempli" ? "Questionnaire rempli." : c.status === "brouillon" ? "Questionnaire en brouillon." : c.status === "envoye" ? "Lien envoyé, en attente." : "Questionnaire à remplir en appel ou à envoyer.",
      links: [{ href: `${fiche}#questionnaire`, label: "Questionnaire" }] },
    { n: 2, title: "Audit", state: hasProposal || r >= stageRank("proposition") ? "fait" : c.status === "rempli" ? "en_cours" : "a_faire",
      detail: c.customer_id ? "Audit du compte existant et de la page." : "Audit de la page et du potentiel de recherche.",
      links: [
        { href: `/audit/prospect?${new URLSearchParams({ nom: c.name, ...(site ? { url: site } : {}) }).toString()}`, label: "Audit de la page" },
        ...(c.customer_id ? [{ href: `/audit/client${acc}`, label: "Audit du compte" }] : []),
      ] },
    { n: 3, title: "Proposition", state: r >= stageRank("proposition") ? "fait" : hasProposal ? "en_cours" : "a_faire",
      detail: r >= stageRank("proposition") ? "Proposition envoyée." : hasProposal ? "Générée, à relire et envoyer." : "Synthèse, budget et stratégie générés depuis le questionnaire.",
      links: [{ href: `${fiche}/proposition`, label: hasProposal ? "Ouvrir" : "Générer" }],
      advance: hasProposal && r < stageRank("proposition") ? { stage: "proposition", label: "Marquer comme envoyée" } : undefined },
    { n: 4, title: "Signature", state: r >= stageRank("signe") ? "fait" : r === stageRank("proposition") ? "en_cours" : "a_faire",
      detail: r >= stageRank("signe") ? "Client signé." : "Relance et validation du budget.",
      links: [], advance: r === stageRank("proposition") ? { stage: "signe", label: "Client signé" } : undefined },
    { n: 5, title: "Lancement", state: r >= stageRank("actif") ? "fait" : r >= stageRank("signe") ? "en_cours" : "a_faire",
      detail: !c.customer_id ? "Lier le compte Google Ads à la fiche, puis structurer la campagne." : "Structure dans Prévisions, création en pause ou export Editor, puis activation.",
      links: c.customer_id ? [{ href: `/previsions${acc}`, label: "Prévisions" }, { href: "/comptes", label: "Comptes liés" }] : [{ href: "/comptes", label: "Comptes liés" }],
      advance: r >= stageRank("signe") && r < stageRank("actif") ? { stage: "actif", label: "Campagnes en ligne" } : undefined },
    { n: 6, title: "Suivi", state: r === stageRank("actif") ? "en_cours" : "a_faire",
      detail: "Diagnostic chaque matin, alertes, rapport du mois.",
      links: c.customer_id ? [{ href: `/waste${acc}`, label: "Diagnostic" }, { href: "/alertes", label: "Alertes" }, { href: "/rapports", label: "Rapports" }] : [] },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, margin: "14px 0" }}>
      {steps.map((s) => (
        <div key={s.n} className="card" style={{ padding: 12, borderTop: `4px solid ${COLOR[s.state]}`, display: "grid", gap: 6, alignContent: "start", opacity: s.state === "a_faire" ? 0.75 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            <strong style={{ fontSize: 14 }}>{s.n}. {s.title}</strong>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.state === "a_faire" ? "var(--muted)" : COLOR[s.state] }}>{s.state === "fait" ? "Fait" : s.state === "en_cours" ? "En cours" : "À faire"}</span>
          </div>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{s.detail}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {s.links.map((l) => <Link key={l.href} href={l.href} style={{ fontSize: 12 }}>{l.label}</Link>)}
          </div>
          {s.advance && (
            <form action={setStageAction}>
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="stage" value={s.advance.stage} />
              <button type="submit" style={{ padding: "6px 10px", fontSize: 12, width: "100%" }}>{s.advance.label}</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
