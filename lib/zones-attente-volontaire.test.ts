// Garde-fou : la liste d'attente est une inscription VOLONTAIRE. Rien n'est écrit dans zones_attente avant le clic sur
// « Me prévenir si la place se libère ». Ces tests lisent le code source pour que ça ne puisse pas changer sans qu'on le voie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8").replace(/\r\n/g, "\n");

/** Tous les fichiers source (hors tests, hors types générés) d'un dossier, chemins relatifs à la racine. */
function sources(dossier: string): string[] {
  return (readdirSync(join(RACINE, dossier), { recursive: true }) as string[])
    .map((f) => join(dossier, f).replace(/\\/g, "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !f.endsWith("database.types.ts"));
}
const TOUS = [...sources("app"), ...sources("lib"), ...sources("components")];

test("une seule route appelle ajouterAttente : /api/zone/attente, appelée après un clic", () => {
  const appelants = TOUS.filter((f) => /\bajouterAttente\(/.test(lire(f)) && !/export async function ajouterAttente/.test(lire(f)));
  assert.deepEqual(appelants, ["app/api/zone/attente/route.ts"]);
});

test("seule la fonction ajouterAttente écrit dans zones_attente", () => {
  const ecrivains = TOUS.filter((f) => /from\("zones_attente"\)[\s\S]{0,80}\.(insert|upsert)\(/.test(lire(f)));
  assert.deepEqual(ecrivains, ["lib/zones-store.ts"]);
  const source = lire("lib/zones-store.ts");
  const corps = source.slice(source.indexOf("export async function ajouterAttente"));
  const avantAjouter = source.slice(0, source.indexOf("export async function ajouterAttente"));
  assert.ok(!/from\("zones_attente"\)[\s\S]{0,80}\.(insert|upsert)\(/.test(avantAjouter), "aucune autre écriture avant ajouterAttente");
  assert.match(corps, /\.insert\(/);
});

test("la vérification de zone et la création de la fiche n'inscrivent jamais sur la liste d'attente", () => {
  for (const f of ["app/api/zone/check/route.ts", "lib/zone-check.ts", "lib/geocode.ts", "lib/zone-validation.ts"]) {
    assert.ok(!/attente/i.test(lire(f)), `${f} ne doit pas toucher à la liste d'attente`);
  }
  assert.ok(!/zones_attente/.test(lire("lib/clients/store.ts")), "createZoneLead n'écrit pas dans zones_attente");
  assert.ok(!/zones_attente|ajouterAttente/.test(lire("app/clients/zone-actions.ts")), "les actions de la fiche non plus");
});

test("formulaire : l'appel d'inscription n'existe que dans rejoindreAttente, déclenché par le bouton", () => {
  const f = lire("app/zone/FormulaireZone.tsx");
  // Un seul appel réseau vers la route d'inscription.
  assert.equal((f.match(/\/api\/zone\/attente/g) ?? []).length, 1);
  const debut = f.indexOf("async function rejoindreAttente");
  assert.ok(debut > 0);
  const fin = f.indexOf("\n  }\n", debut);
  assert.ok(f.slice(debut, fin).includes("/api/zone/attente"), "l'appel est dans rejoindreAttente");
  // rejoindreAttente n'est référencée qu'à sa déclaration et dans le onClick du bouton.
  const usages = [...f.matchAll(/rejoindreAttente/g)].length;
  assert.equal(usages, 2);
  assert.match(f, /onClick=\{\(\) => rejoindreAttente\(demandeId\)\}/);
  // Pas d'inscription au chargement ni à l'envoi du formulaire.
  assert.ok(!/useEffect\([^)]*rejoindreAttente/.test(f));
  const onSubmit = f.slice(f.indexOf("async function onSubmit"), debut);
  assert.ok(!onSubmit.includes("rejoindreAttente") && !onSubmit.includes("/api/zone/attente"));
});

test("formulaire : le bouton, puis le message de confirmation seulement après le clic", () => {
  const f = lire("app/zone/FormulaireZone.tsx").replace(/&apos;/g, "'");
  assert.ok(f.includes("Me prévenir si la place se libère"));
  assert.ok(f.includes("Vous êtes sur la liste d'attente. Nous vous écrivons si la place se libère."));
  // Le message n'apparaît que lorsque l'inscription a abouti (état « ok », posé par la réponse de la route), jamais avant.
  assert.match(f, /attente === "ok" \? \(\s*<p>Vous êtes sur la liste d'attente\./);
  assert.match(f, /useState<"non" \| "envoi" \| "ok" \| "echec">\("non"\)/);
  assert.match(f, /setAttente\(res\.ok \? "ok" : "echec"\)/);
  // Le bouton n'est proposé que pour une zone prise ou partielle.
  assert.match(f, /\(etat === "prise" \|\| etat === "partielle"\) && demandeId/);
});

test("la route d'inscription exige une demande récente, prise ou partielle, et ne double jamais une inscription", () => {
  const r = lire("app/api/zone/attente/route.ts");
  assert.match(r, /\["prise", "partielle"\]\.includes\(a\.zone_etat\)/);
  assert.match(r, /a\.liste_attente === "oui"/);
  assert.match(r, /resultat === "deja"/);
  assert.match(lire("lib/zones-store.ts"), /memeInscriptionAttente/);
  const rel = relative(RACINE, join(RACINE, "supabase/migrations/0025_zones_attente_unique.sql")).replace(/\\/g, "/");
  assert.match(readFileSync(join(RACINE, rel), "utf8"), /create unique index if not exists[\s\S]*zones_attente[\s\S]*client_id, activite, lower\(btrim\(adresse\)\)/);
});
