// Tests de lib/app-url.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseApplication, entreeDepuisRequete, lienApplication, lienFicheClient, origineApplication } from "./app-url.ts";

const APP = "https://app.stratyxmedia.fr";
const ID = "3f2b8c1e-5a47-4d7e-9b0a-1c2d3e4f5a6b";

test("lien de la fiche : {base}/clients/{id}", () => {
  assert.equal(lienApplication(`/clients/${ID}`, { appUrl: APP }), `${APP}/clients/${ID}`);
  assert.equal(lienApplication(`clients/${ID}`, { appUrl: APP }), `${APP}/clients/${ID}`, "barre initiale ajoutée");
});

test("1. la variable dédiée passe avant tout", () => {
  assert.equal(baseApplication({ appUrl: APP, vercelUrl: "ads-stratyx-abc.vercel.app", hoteRequete: "autre.example.com" }), APP);
});

test("variable dédiée : barre finale, chemin, espaces et schéma manquant corrigés", () => {
  assert.equal(baseApplication({ appUrl: "https://app.stratyxmedia.fr/" }), APP);
  assert.equal(baseApplication({ appUrl: "  https://app.stratyxmedia.fr/dashboard?x=1 " }), APP);
  assert.equal(baseApplication({ appUrl: "app.stratyxmedia.fr" }), APP);
  assert.equal(baseApplication({ appUrl: "http://localhost:3000/" }), "http://localhost:3000");
});

test("2. sans variable dédiée : https://${VERCEL_URL}", () => {
  assert.equal(baseApplication({ vercelUrl: "ads-stratyx-abc.vercel.app" }), "https://ads-stratyx-abc.vercel.app");
  assert.equal(baseApplication({ appUrl: "", vercelUrl: "ads-stratyx-abc.vercel.app" }), "https://ads-stratyx-abc.vercel.app");
  assert.equal(baseApplication({ appUrl: null, vercelUrl: "ads-stratyx-abc.vercel.app", hoteRequete: "x.example.com" }), "https://ads-stratyx-abc.vercel.app");
});

test("3. sans variable ni VERCEL_URL : l'hôte de la requête", () => {
  assert.equal(baseApplication({ hoteRequete: "app.stratyxmedia.fr" }), APP);
  assert.equal(baseApplication({ hoteRequete: "app.stratyxmedia.fr", protoRequete: "https" }), APP);
  assert.equal(baseApplication({ hoteRequete: "preview.example.com, proxy.interne" }), "https://preview.example.com", "premier hôte d'une liste");
  assert.equal(baseApplication({ hoteRequete: "localhost:3000" }), "http://localhost:3000", "local : http");
  assert.equal(baseApplication({ hoteRequete: "localhost:3001", protoRequete: "http" }), "http://localhost:3001");
});

test("4. rien du tout : localhost de développement", () => {
  assert.equal(baseApplication(), "http://localhost:3000");
  assert.equal(baseApplication({}), "http://localhost:3000");
  assert.equal(baseApplication({ appUrl: "", vercelUrl: "", hoteRequete: "" }), "http://localhost:3000");
});

test("jamais le site vitrine, à aucune étape", () => {
  const vitrines = ["https://stratyxmedia.fr", "https://www.stratyxmedia.fr", "https://www.stratyxmedia.fr/", "stratyxmedia.fr", "WWW.STRATYXMEDIA.FR", "http://www.stratyxmedia.fr/clients/x"];
  for (const v of vitrines) {
    assert.equal(origineApplication(v), null, v);
    // La variable pointe vers la vitrine : on passe à VERCEL_URL.
    assert.equal(baseApplication({ appUrl: v, vercelUrl: "ads-stratyx-abc.vercel.app" }), "https://ads-stratyx-abc.vercel.app", v);
    // Puis à l'hôte de la requête.
    assert.equal(baseApplication({ appUrl: v, hoteRequete: "app.stratyxmedia.fr" }), APP, v);
    // Et si tout pointe vers la vitrine : le repli local, jamais la vitrine.
    const base = baseApplication({ appUrl: v, vercelUrl: v, hoteRequete: v });
    assert.equal(base, "http://localhost:3000", v);
    assert.ok(!/(^|\/\/|\.)stratyxmedia\.fr/.test(base.replace("app.stratyxmedia.fr", "")), v);
  }
  assert.equal(origineApplication(APP), APP, "app.stratyxmedia.fr n'est pas le site vitrine");
  assert.equal(origineApplication("https://monstratyxmedia.fr"), "https://monstratyxmedia.fr", "un autre domaine proche n'est pas bloqué");
});

test("valeurs invalides ignorées", () => {
  for (const v of ["", "   ", null, undefined, "ftp://app.example.com", "javascript:alert(1)", "http://", "https://exa mple.com"]) {
    assert.equal(origineApplication(v as string | null | undefined), null, String(v));
  }
  assert.equal(baseApplication({ appUrl: "javascript:alert(1)", vercelUrl: "ads-stratyx-abc.vercel.app" }), "https://ads-stratyx-abc.vercel.app");
});

test("entrées de la requête : x-forwarded-host prioritaire sur host", () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } });
  assert.deepEqual(entreeDepuisRequete(req({ "x-forwarded-host": "app.stratyxmedia.fr", host: "interne:3000", "x-forwarded-proto": "https" })),
    { hoteRequete: "app.stratyxmedia.fr", protoRequete: "https" });
  assert.deepEqual(entreeDepuisRequete(req({ host: "localhost:3000" })), { hoteRequete: "localhost:3000", protoRequete: null });
  assert.deepEqual(entreeDepuisRequete(null), {});
  assert.deepEqual(entreeDepuisRequete(undefined), {});
  assert.equal(baseApplication(entreeDepuisRequete(req({ "x-forwarded-host": "app.stratyxmedia.fr" }))), APP);
});

test("lienFicheClient : variable dédiée, repli sur la requête, id encodé", () => {
  const sauve = { app: process.env.NEXT_PUBLIC_APP_URL, vercel: process.env.VERCEL_URL };
  try {
    process.env.NEXT_PUBLIC_APP_URL = APP;
    process.env.VERCEL_URL = "ads-stratyx-abc.vercel.app";
    assert.equal(lienFicheClient(ID), `${APP}/clients/${ID}`);

    process.env.NEXT_PUBLIC_APP_URL = "https://www.stratyxmedia.fr"; // variable mal réglée : la vitrine est ignorée
    assert.equal(lienFicheClient(ID), `https://ads-stratyx-abc.vercel.app/clients/${ID}`);

    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    const req = { headers: { get: (n: string) => (n === "host" ? "app.stratyxmedia.fr" : null) } };
    assert.equal(lienFicheClient(ID, req), `${APP}/clients/${ID}`);
    assert.equal(lienFicheClient("a/b c"), "http://localhost:3000/clients/a%2Fb%20c");
  } finally {
    if (sauve.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = sauve.app;
    if (sauve.vercel === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = sauve.vercel;
  }
});
