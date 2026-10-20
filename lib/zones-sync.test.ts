// Tests de lib/zones-sync.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGE_CONFLIT, lireEchec, synchroniserAvecJournal, type DepsSynchro, type EchecSynchro } from "./zones-sync.ts";

const AT = new Date("2026-10-20T10:00:00Z");

function faux(surcharge: Partial<DepsSynchro> = {}) {
  const appels = {
    synchroniser: [] as [string, string][],
    noter: [] as [string, EchecSynchro][],
    effacer: [] as string[],
    journal: [] as [string, Record<string, unknown>][],
  };
  const deps: DepsSynchro = {
    synchroniser: async (id, stage) => { appels.synchroniser.push([id, stage]); return { statut: "reserve", conflit: false }; },
    noter: async (id, echec) => { appels.noter.push([id, echec]); },
    effacer: async (id) => { appels.effacer.push(id); },
    journal: (message, detail) => { appels.journal.push([message, detail]); },
    maintenant: () => AT,
    ...surcharge,
  };
  return { deps, appels };
}

test("échec technique : écrit dans les logs, noté pour la fiche, ne lève jamais", async () => {
  const { deps, appels } = faux({ synchroniser: async () => { throw new Error('relation "zones_exclusives" does not exist'); } });
  const ok = await synchroniserAvecJournal(deps, "c1", "signe");
  assert.equal(ok, false);
  // Logs serveur : message, client, étape et cause.
  assert.equal(appels.journal.length, 1);
  assert.match(appels.journal[0][0], /échec de la synchronisation/);
  assert.deepEqual(appels.journal[0][1], { clientId: "c1", stage: "signe", erreur: 'relation "zones_exclusives" does not exist' });
  // Message visible sur la fiche.
  assert.equal(appels.noter.length, 1);
  assert.equal(appels.noter[0][0], "c1");
  assert.deepEqual(appels.noter[0][1], {
    stage: "signe", conflit: false, at: AT.toISOString(), message: 'Erreur technique : relation "zones_exclusives" does not exist',
  });
  assert.equal(appels.effacer.length, 0, "un échec n'efface pas l'échec précédent");
});

test("échec avec une valeur qui n'est pas une Error", async () => {
  const { deps, appels } = faux({ synchroniser: async () => { throw "panne réseau"; } });
  assert.equal(await synchroniserAvecJournal(deps, "c1", "actif"), false);
  assert.equal(appels.noter[0][1].message, "Erreur technique : panne réseau");
});

test("chevauchement : journal et message visible, sans panne", async () => {
  const { deps, appels } = faux({ synchroniser: async () => ({ statut: null, conflit: true }) });
  assert.equal(await synchroniserAvecJournal(deps, "c2", "signe"), false);
  assert.equal(appels.journal.length, 1);
  assert.match(appels.journal[0][0], /chevauchement/);
  assert.deepEqual(appels.noter[0][1], { stage: "signe", conflit: true, at: AT.toISOString(), message: MESSAGE_CONFLIT });
  assert.equal(appels.effacer.length, 0);
});

test("succès : rien dans les logs, l'échec précédent est effacé", async () => {
  const { deps, appels } = faux();
  assert.equal(await synchroniserAvecJournal(deps, "c3", "signe"), true);
  assert.deepEqual(appels.synchroniser, [["c3", "signe"]]);
  assert.equal(appels.journal.length, 0);
  assert.equal(appels.noter.length, 0);
  assert.deepEqual(appels.effacer, ["c3"]);
});

test("aucune zone ou aucun changement : c'est un succès", async () => {
  const { deps, appels } = faux({ synchroniser: async () => ({ statut: null, conflit: false }) });
  assert.equal(await synchroniserAvecJournal(deps, "c4", "proposition"), true);
  assert.equal(appels.journal.length, 0);
  assert.deepEqual(appels.effacer, ["c4"]);
});

test("l'échec ne peut pas être noté : le second problème est lui aussi écrit dans les logs", async () => {
  const { deps, appels } = faux({
    synchroniser: async () => { throw new Error("base indisponible"); },
    noter: async () => { throw new Error("app_settings illisible"); },
  });
  assert.equal(await synchroniserAvecJournal(deps, "c5", "actif"), false);
  assert.equal(appels.journal.length, 2);
  assert.match(appels.journal[1][0], /échec noté impossible/);
  assert.equal(appels.journal[1][1].erreur, "app_settings illisible");
});

test("effacement de l'ancien échec impossible : journalisé, la synchronisation reste un succès", async () => {
  const { deps, appels } = faux({ effacer: async () => { throw new Error("écriture refusée"); } });
  assert.equal(await synchroniserAvecJournal(deps, "c6", "signe"), true);
  assert.equal(appels.journal.length, 1);
  assert.match(appels.journal[0][0], /non effacé/);
});

test("lireEchec : JSON valide, vide ou illisible", () => {
  const e: EchecSynchro = { stage: "signe", message: "x", conflit: true, at: AT.toISOString() };
  assert.deepEqual(lireEchec(JSON.stringify(e)), e);
  assert.equal(lireEchec(""), null);
  assert.equal(lireEchec(null), null);
  assert.equal(lireEchec(undefined), null);
  assert.equal(lireEchec("pas du json"), null);
  assert.equal(lireEchec(JSON.stringify({ stage: "signe" })), null);
  assert.equal(lireEchec(JSON.stringify({ ...e, message: "a".repeat(1000) }))?.message.length, 400);
  assert.equal(lireEchec(JSON.stringify({ ...e, conflit: "oui" }))?.conflit, false);
});
