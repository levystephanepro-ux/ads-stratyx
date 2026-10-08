// Fonctions sans dépendance serveur (utilisables côté navigateur) pour la landing page.
import type { AdGroupSpec } from "./create";
import type { LandingBrief } from "./landing";

/** Contrôle du message match : titres d'annonce dont aucun mot important n'apparaît sur la page. */
export function messageMatchGaps(brief: LandingBrief, groups: AdGroupSpec[]): { groupe: string; manquants: string[] }[] {
  const page = [brief.hero.titre, brief.hero.sousTitre, ...brief.hero.preuvesRapides, ...brief.sections.flatMap((x) => [x.titre, x.texte, ...x.points]), ...brief.benefices, ...brief.preuves]
    .join(" ").toLowerCase();
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const pageN = norm(page);
  return groups.map((g) => ({
    groupe: g.name,
    manquants: g.headlines.filter((h) => {
      const words = norm(h).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      return words.length > 0 && !words.some((w) => pageN.includes(w));
    }),
  })).filter((x) => x.manquants.length);
}

export function landingToMarkdown(b: LandingBrief, campaign: string, pageUrl: string): string {
  const L: string[] = [];
  L.push(`# Landing page : ${b.titrePage || campaign}`, "");
  L.push(`Campagne : ${campaign}`, pageUrl ? `URL prévue : ${pageUrl}` : "", "");
  L.push("## SEO", `- Meta title : ${b.metaTitle}`, `- Meta description : ${b.metaDescription}`, "");
  L.push("## Haut de page", `# ${b.hero.titre}`, b.hero.sousTitre, "", ...b.hero.preuvesRapides.map((p) => `- ${p}`), "", `Bouton : **${b.hero.cta}**`, "");
  for (const x of b.sections) {
    L.push(`## ${x.titre}  (ancre #${x.ancre}, groupe « ${x.groupe} »)`, x.texte, "", ...x.points.map((p) => `- ${p}`));
    if (x.titresAnnonceRepris.length) L.push("", `_Titres d'annonce repris : ${x.titresAnnonceRepris.join(" | ")}_`);
    L.push("");
  }
  if (b.benefices.length) L.push("## Pourquoi nous choisir", ...b.benefices.map((p) => `- ${p}`), "");
  if (b.etapes.length) L.push("## Comment ça se passe", ...b.etapes.map((p, i) => `${i + 1}. ${p}`), "");
  if (b.preuves.length) L.push("## Preuves", ...b.preuves.map((p) => `- ${p}`), "");
  L.push("## Formulaire", ...b.formulaire.champs.map((c) => `- ${c}`), `Bouton : **${b.formulaire.bouton}**`, b.formulaire.reassurance, "");
  if (b.faq.length) { L.push("## Questions fréquentes"); for (const f of b.faq) L.push(`**${f.q}**`, f.r, ""); }
  L.push("## Appel final", b.ctaFinal, "");
  if (b.aFournir.length) L.push("## À fournir par le client", ...b.aFournir.map((p) => `- [ ] ${p}`), "");
  if (b.notes) L.push("## Notes", b.notes, "");
  return L.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}
