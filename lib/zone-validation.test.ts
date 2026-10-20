// Tests de lib/zone-validation.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import { contientHtml, lirePanier, nettoyerTexte, validerAutreActivite } from "./zone-validation.ts";

const OK = { autreActivite: "Spa de luxe", panierMoyen: 450, description: "Soins et massages" };

test("nettoyerTexte : contrôle, espaces multiples, bords", () => {
  assert.equal(nettoyerTexte("  Spa   de\tluxe \n"), "Spa de luxe");
  assert.equal(nettoyerTexte("a" + String.fromCharCode(0) + "b"), "a b");
  assert.equal(nettoyerTexte("a" + String.fromCharCode(0x200b) + "b"), "a b");
  assert.equal(nettoyerTexte(42), "");
  assert.equal(nettoyerTexte(null), "");
  assert.equal(nettoyerTexte({}), "");
});

test("contientHtml : toute balise est détectée", () => {
  assert.equal(contientHtml("<b>gras</b>"), true);
  assert.equal(contientHtml("<script>alert(1)</script>"), true);
  assert.equal(contientHtml("a > b"), true);
  assert.equal(contientHtml("Spa et massages"), false);
});

test("autre activité valide : champs nettoyés", () => {
  const r = validerAutreActivite({ autreActivite: "  Spa   de luxe ", panierMoyen: "450", description: "  Soins   et massages " });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.valeurs, { autreActivite: "Spa de luxe", panierMoyen: 450, description: "Soins et massages" });
});

test("description facultative", () => {
  for (const description of [undefined, null, "", "   "]) {
    const r = validerAutreActivite({ ...OK, description });
    assert.ok(r.ok, String(description));
    if (r.ok) assert.equal(r.valeurs.description, "");
  }
});

test("activité : 3 à 80 caractères, obligatoire", () => {
  const e = (autreActivite: unknown) => validerAutreActivite({ ...OK, autreActivite });
  assert.ok(!e("").ok);
  assert.ok(!e(undefined).ok);
  assert.ok(!e("ab").ok);
  assert.ok(!e("  ab  ").ok);
  assert.ok(e("abc").ok);
  assert.ok(e("a".repeat(80)).ok);
  assert.ok(!e("a".repeat(81)).ok);
  assert.ok(!e("a".repeat(5000)).ok);
  assert.ok(!e(123 as unknown).ok);
  assert.ok(!e(["Spa de luxe"] as unknown).ok);
});

test("panier moyen : nombre entre 1 et 100 000", () => {
  const ok = (v: unknown) => assert.ok(lirePanier(v).erreur === null, String(v));
  const ko = (v: unknown) => assert.ok(lirePanier(v).erreur !== null, String(v));
  ok(1); ok(450); ok(100000); ok("450"); ok("450,50"); ok(" 1 200 "); ok(99999.99);
  ko(0); ko(0.99); ko(-5); ko(100001); ko("100001"); ko("");
  ko(undefined); ko(null); ko(Number.NaN); ko(Number.POSITIVE_INFINITY);
  ko("abc"); ko("12abc"); ko("1e3"); ko("0x10"); ko(true); ko({}); ko([450]);
  assert.equal(lirePanier("450,50").valeur, 450.5);
  assert.equal(lirePanier(10.456).valeur, 10.46);
});

test("description : 200 caractères au maximum", () => {
  assert.ok(validerAutreActivite({ ...OK, description: "a".repeat(200) }).ok);
  assert.ok(!validerAutreActivite({ ...OK, description: "a".repeat(201) }).ok);
  assert.ok(!validerAutreActivite({ ...OK, description: "a".repeat(5000) }).ok);
  assert.ok(!validerAutreActivite({ ...OK, description: 42 as unknown }).ok);
});

test("aucun HTML accepté dans aucun des trois champs", () => {
  for (const champ of ["autreActivite", "description"] as const) {
    for (const html of ["<b>Spa</b>", "Spa <script>alert(1)</script>", "Spa <img src=x onerror=alert(1)>", "a > b spa", "<"]) {
      const r = validerAutreActivite({ ...OK, [champ]: html });
      assert.ok(!r.ok, `${champ} : ${html}`);
      if (!r.ok) assert.ok(r.erreurs[champ], `${champ} : erreur attendue`);
    }
  }
  assert.ok(!validerAutreActivite({ ...OK, panierMoyen: "<b>450</b>" }).ok);
});

test("plusieurs erreurs renvoyées ensemble, par champ", () => {
  const r = validerAutreActivite({ autreActivite: "a", panierMoyen: "x", description: "<i>" });
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.erreurs).sort(), ["autreActivite", "description", "panierMoyen"]);
});
