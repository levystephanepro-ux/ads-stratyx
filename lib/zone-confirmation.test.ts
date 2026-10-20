// Tests de lib/zone-confirmation.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AntiDoublon, DELAI_ANTI_DOUBLON_MS, OBJET_CONFIRMATION, cleDoublon, construireConfirmation, envoyerConfirmation, escapeHtml,
  nettoyerPourLog, type DemandeConfirmation, type DepsConfirmation,
} from "./zone-confirmation.ts";
import { ACTIVITES } from "./zones.ts";

const DEMANDE: DemandeConfirmation = { email: "marie.dupont@example.com", activiteId: "plomberie", adresse: "10 avenue Jean Médecin 06000 Nice", rayonKm: 10 };
const CONTACT = { telephone: "06 12 34 56 78", email: "stephane@stratyxmedia.fr" };

/* ------------------------------- contenu ------------------------------- */

test("objet et texte : demande reçue, vérification de la disponibilité, signature", () => {
  const m = construireConfirmation(DEMANDE, CONTACT);
  assert.equal(m.subject, "Votre demande de zone, bien reçue");
  assert.equal(OBJET_CONFIRMATION, m.subject);
  assert.equal(m.text, [
    "Bonjour,",
    "",
    "Merci, j'ai bien reçu votre demande pour votre activité de plombier autour de 10 avenue Jean Médecin 06000 Nice, rayon de 10 km.",
    "",
    "Je vérifie la disponibilité et je vous rappelle sous 24 h ouvrées pour valider votre zone ensemble. Aucun engagement.",
    "",
    "Mon numéro : 06 12 34 56 78",
    "Mon adresse email : stephane@stratyxmedia.fr",
    "",
    "Stéphane Levy",
    "STRATYXMEDIA",
  ].join("\n"));
  assert.match(m.html, /Stéphane Levy<br>STRATYXMEDIA/);
});

test("jamais « réservée » ni « garantie », jamais le résultat du contrôle, pas de tiret cadratin", () => {
  const interdits = /réserv|garanti|\blibre\b|\bprise?\b|partielle|exclusiv|confirm[ée]e? que|disponible pour vous|zone est/i;
  for (const id of [...ACTIVITES.map((a) => a.id), "autre"]) {
    const m = construireConfirmation({ ...DEMANDE, activiteId: id, autreActivite: id === "autre" ? "Spa de luxe" : null }, CONTACT);
    for (const [nom, contenu] of Object.entries({ objet: m.subject, texte: m.text, html: m.html })) {
      assert.ok(!interdits.test(contenu), `${id} ${nom}`);
      assert.ok(!contenu.includes("—"), `${id} ${nom} : tiret cadratin`);
    }
    assert.match(m.text, /Je vérifie la disponibilité/);
  }
});

test("le contenu ne dépend jamais du résultat (libre, partielle, prise) : la fonction ne le reçoit pas", () => {
  const a = construireConfirmation(DEMANDE, CONTACT);
  const b = construireConfirmation({ ...DEMANDE }, { ...CONTACT });
  assert.deepEqual(a, b);
  assert.equal(construireConfirmation.length >= 1, true);
});

test("libellé court de chaque activité, avec élision (de plombier, d'électricien, d'agent immobilier)", () => {
  const phrase = (id: string) => construireConfirmation({ ...DEMANDE, activiteId: id }, {}).text.match(/pour (votre activité [^.]*?) autour de/)?.[1];
  assert.equal(phrase("plomberie"), "votre activité de plombier");
  assert.equal(phrase("electricite"), "votre activité d'électricien");
  assert.equal(phrase("immobilier"), "votre activité d'agent immobilier");
  assert.equal(phrase("fenetres-volets-verandas"), "votre activité d'installateur de fenêtres et volets");
  assert.equal(phrase("yachting-refit"), "votre activité de professionnel du yachting");
  assert.equal(phrase("dentiste-sante"), "votre activité de dentiste ou praticien de santé");
  for (const a of ACTIVITES) assert.ok(phrase(a.id), a.id);
});

test("« Autre activité » : même mail, activité saisie, aucune promesse de disponibilité", () => {
  const m = construireConfirmation({ ...DEMANDE, activiteId: "autre", autreActivite: "  Spa   de luxe " }, CONTACT);
  assert.match(m.text, /pour votre activité \(Spa de luxe\) autour de/);
  assert.match(m.text, /Je vérifie la disponibilité et je vous rappelle sous 24 h ouvrées/);
  assert.ok(!/disponible\b/.test(m.text));
  const sans = construireConfirmation({ ...DEMANDE, activiteId: "autre" }, CONTACT);
  assert.match(sans.text, /pour votre activité autour de/);
});

test("coordonnées de Stéphane : repli sur rien si absentes", () => {
  const rien = construireConfirmation(DEMANDE, {});
  assert.ok(!/Mon numéro|Mon adresse email/.test(rien.text));
  const seulEmail = construireConfirmation(DEMANDE, { telephone: "", email: "s@x.fr" });
  assert.ok(!/Mon numéro/.test(seulEmail.text));
  assert.match(seulEmail.text, /Mon adresse email : s@x\.fr/);
  const seulTel = construireConfirmation(DEMANDE, { telephone: "0612345678", email: null });
  assert.match(seulTel.text, /Mon numéro : 0612345678/);
  assert.ok(!/Mon adresse email/.test(seulTel.text));
  assert.ok(!rien.text.includes("undefined") && !rien.text.includes("null"));
});

/* ----------------------------- échappement ----------------------------- */

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<b>"A" & 'B'</b>`), "&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;");
  assert.equal(escapeHtml("simple"), "simple");
});

test("toute valeur saisie est échappée dans le HTML", () => {
  const piege = `<script>alert(1)</script><img src=x onerror=alert(2)> "&'`;
  const m = construireConfirmation(
    { ...DEMANDE, activiteId: "autre", autreActivite: piege, adresse: piege },
    { telephone: piege, email: piege },
  );
  assert.ok(!/<script|<img|onerror=alert/i.test(m.html.replace(/&lt;[^&]*&gt;/g, "")), "aucune balise active dans le HTML");
  assert.ok(!m.html.includes("<script"));
  assert.ok(!m.html.includes("<img"));
  assert.ok(m.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(m.html.includes("&quot;&amp;&#39;"));
  // Le texte simple n'est pas du HTML : valeur brute, sur une seule ligne.
  assert.ok(m.text.includes("<script>alert(1)</script>"));
  const multiligne = construireConfirmation({ ...DEMANDE, adresse: "10 rue A\nBcc: evil@example.com" }, {});
  assert.ok(!/\nBcc:/.test(multiligne.text));
});

/* ----------------------------- anti-doublon ---------------------------- */

test("anti-doublon : une seule réservation par e-mail, adresse et activité en 10 minutes", () => {
  let t = 1_000_000;
  const a = new AntiDoublon(DELAI_ANTI_DOUBLON_MS, () => t);
  const cle = cleDoublon("Marie.Dupont@Example.com", "10 avenue Jean Médecin, 06000 Nice", "plomberie");
  assert.equal(a.reserver(cle), true);
  assert.equal(a.reserver(cle), false);
  t += DELAI_ANTI_DOUBLON_MS - 1;
  assert.equal(a.reserver(cle), false, "juste avant les 10 minutes");
  t += 1;
  assert.equal(a.reserver(cle), true, "après les 10 minutes");
  a.liberer(cle);
  assert.equal(a.reserver(cle), true, "libérée : nouvel essai possible");
});

test("clé de doublon : sans accents ni casse, mais distincte selon e-mail, adresse et activité", () => {
  const base = cleDoublon("marie@example.com", "10 avenue Jean Médecin 06000 Nice", "plomberie");
  assert.equal(cleDoublon(" MARIE@example.com ", "10 AVENUE jean medecin, 06000 nice", "Plomberie"), base);
  assert.notEqual(cleDoublon("autre@example.com", "10 avenue Jean Médecin 06000 Nice", "plomberie"), base);
  assert.notEqual(cleDoublon("marie@example.com", "12 rue de la République 06000 Nice", "plomberie"), base);
  assert.notEqual(cleDoublon("marie@example.com", "10 avenue Jean Médecin 06000 Nice", "electricite"), base);
});

/* ------------------------------- envoi --------------------------------- */

function faux(surcharge: Partial<DepsConfirmation> = {}) {
  const appels = {
    envoyer: [] as { to: string; subject: string; text: string; html: string; replyTo?: string | null }[],
    noter: 0,
    journal: [] as [string, Record<string, unknown>][],
  };
  const deps: DepsConfirmation = {
    envoyer: async (m) => { appels.envoyer.push(m); },
    dejaConfirmee: async () => false,
    noterEnvoi: async () => { appels.noter++; },
    journal: (message, detail) => { appels.journal.push([message, detail]); },
    antiDoublon: new AntiDoublon(),
    contact: { telephone: "06 12 34 56 78", email: "stephane@stratyxmedia.fr" },
    replyTo: "stephane@stratyxmedia.fr",
    ...surcharge,
  };
  return { deps, appels };
}

test("envoi : un mail à l'adresse saisie, reply-to Stéphane, noté sur la fiche, rien dans les logs", async () => {
  const { deps, appels } = faux();
  assert.equal(await envoyerConfirmation(deps, DEMANDE, "fiche-1"), "envoye");
  assert.equal(appels.envoyer.length, 1);
  const m = appels.envoyer[0];
  assert.equal(m.to, "marie.dupont@example.com");
  assert.equal(m.subject, "Votre demande de zone, bien reçue");
  assert.equal(m.replyTo, "stephane@stratyxmedia.fr");
  assert.match(m.text, /Je vérifie la disponibilité/);
  assert.ok(m.html.length > 0);
  assert.equal(appels.noter, 1);
  assert.equal(appels.journal.length, 0);
});

test("formulaire renvoyé deux fois de suite : un seul mail", async () => {
  const { deps, appels } = faux();
  assert.equal(await envoyerConfirmation(deps, DEMANDE, "fiche-1"), "envoye");
  assert.equal(await envoyerConfirmation(deps, { ...DEMANDE, email: "MARIE.DUPONT@example.com " , adresse: "10 AVENUE jean médecin 06000 nice" }, "fiche-2"), "doublon");
  assert.equal(appels.envoyer.length, 1);
  // Une autre activité ou une autre adresse est une autre demande.
  assert.equal(await envoyerConfirmation(deps, { ...DEMANDE, activiteId: "electricite" }, "fiche-3"), "envoye");
  assert.equal(await envoyerConfirmation(deps, { ...DEMANDE, adresse: "12 rue de la République 06000 Nice" }, "fiche-4"), "envoye");
  assert.equal(appels.envoyer.length, 3);
});

test("deux envois simultanés : un seul mail", async () => {
  const { deps, appels } = faux({ envoyer: async (m) => { await new Promise((r) => setTimeout(r, 20)); appels.envoyer.push(m); } });
  const [a, b] = await Promise.all([envoyerConfirmation(deps, DEMANDE, "f1"), envoyerConfirmation(deps, DEMANDE, "f2")]);
  assert.deepEqual([a, b].sort(), ["doublon", "envoye"]);
  assert.equal(appels.envoyer.length, 1);
});

test("doublon vu en base (autre instance serveur) : pas de second mail", async () => {
  const { deps, appels } = faux({ dejaConfirmee: async () => true });
  assert.equal(await envoyerConfirmation(deps, DEMANDE, "f1"), "doublon");
  assert.equal(appels.envoyer.length, 0);
  assert.equal(appels.noter, 0);
});

test("échec d'envoi silencieux : jamais d'exception, journal sans l'adresse e-mail, nouvel essai possible", async () => {
  const email = DEMANDE.email;
  const { deps, appels } = faux({
    envoyer: async () => { throw new Error(`The "to" field "${email}" is invalid (domain not verified)`); },
  });
  const r = await envoyerConfirmation(deps, DEMANDE, "fiche-9"); // ne lève pas
  assert.equal(r, "echec");
  assert.equal(appels.journal.length, 1);
  assert.match(appels.journal[0][0], /confirmation au prospect non envoyée/);
  assert.deepEqual(Object.keys(appels.journal[0][1]).sort(), ["demande", "erreur"]);
  assert.equal(appels.journal[0][1].demande, "fiche-9");
  const log = JSON.stringify(appels.journal);
  assert.ok(!log.includes(email), "l'adresse e-mail n'est pas dans les logs");
  assert.ok(!log.includes("marie.dupont"), "ni sa partie locale");
  assert.ok(!log.includes("Jean Médecin"), "ni l'adresse de l'établissement");
  assert.equal(appels.noter, 0);
  // La clé a été libérée : un nouvel envoi du formulaire peut réessayer.
  const retour = faux({ antiDoublon: deps.antiDoublon });
  assert.equal(await envoyerConfirmation(retour.deps, DEMANDE, "fiche-10"), "envoye");
});

test("autres pannes silencieuses : lecture du doublon, écriture de la note", async () => {
  const a = faux({ dejaConfirmee: async () => { throw new Error("base indisponible pour marie.dupont@example.com"); } });
  assert.equal(await envoyerConfirmation(a.deps, DEMANDE, "f1"), "echec");
  assert.ok(!JSON.stringify(a.appels.journal).includes("marie.dupont"));
  assert.equal(a.appels.envoyer.length, 0);

  const b = faux({ noterEnvoi: async () => { throw new Error("écriture refusée"); } });
  assert.equal(await envoyerConfirmation(b.deps, DEMANDE, "f2"), "envoye", "le mail est parti");
  assert.equal(b.appels.journal.length, 1);
  assert.match(b.appels.journal[0][0], /non notée/);
});

test("nettoyerPourLog : aucune adresse e-mail", () => {
  assert.equal(nettoyerPourLog(new Error("to marie@example.com failed"), "marie@example.com"), "to [email] failed");
  assert.equal(nettoyerPourLog("a@b.fr et c.d@e.org", undefined), "[email] et [email]");
  assert.equal(nettoyerPourLog(undefined), "");
  assert.ok(nettoyerPourLog("x".repeat(1000)).length <= 300);
});

/* --------------------------- code source (garde-fous) --------------------------- */

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const src = (f: string) => readFileSync(RACINE + f, "utf8").replace(/\r\n/g, "\n");

test("la route envoie la confirmation dans le bloc d'e-mails non bloquant, après la création de la fiche", () => {
  const r = src("app/api/zone/check/route.ts");
  const creation = r.indexOf("createZoneLead(");
  const bloc = r.indexOf("// Les e-mails ne bloquent jamais la réponse");
  const confirmation = r.indexOf("await confirmerDemande(");
  const reponse = r.lastIndexOf("return NextResponse.json({");
  assert.ok(creation > 0 && bloc > creation && confirmation > bloc && reponse > confirmation);
  assert.match(r.slice(bloc, confirmation), /try \{/);
});

test("sendProspectEmail : expéditeur PROSPECT_EMAIL_FROM puis AGENT_EMAIL_FROM, reply-to, erreur sans la réponse de Resend", () => {
  const e = src("lib/agent/email.ts");
  const corps = e.slice(e.indexOf("export async function sendProspectEmail"));
  assert.match(corps, /process\.env\.PROSPECT_EMAIL_FROM \|\| process\.env\.AGENT_EMAIL_FROM/);
  assert.match(corps, /reply_to: m\.replyTo/);
  assert.ok(!corps.includes("res.text()"), "la réponse de Resend (qui peut contenir l'adresse) n'est jamais relue");
  const serveur = src("lib/zone-confirmation-serveur.ts");
  assert.match(serveur, /PROSPECT_REPLY_TO \|\| process\.env\.AGENT_EMAIL_TO/);
  assert.match(serveur, /PROSPECT_PHONE/);
});
