// Tests de lib/zones.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITES, ACTIVITES_CHOIX, MESSAGE_ACTIVITE_AUTRE, activiteReconnue, controleZone, distanceKm, estAutreActivite, estOccupee,
  expirationPour, expressionPlace, libelleActivite, libelleCourtActivite, suggestions, transitionZone,
  supplementMensuel, zonesAExpirer, RAYON_MIN_KM,
  type CommuneCentre, type ZoneOccupee,
} from "./zones.ts";

const NICE = { lat: 43.7102, lng: 7.262 };
const CAGNES = { lat: 43.6641, lng: 7.1488 };
const ANTIBES = { lat: 43.5808, lng: 7.1239 };
const CANNES = { lat: 43.5528, lng: 7.0174 };
const FREJUS = { lat: 43.4331, lng: 6.737 };
const NOW = new Date("2026-10-18T10:00:00Z");
const PLUS = (j: number) => new Date(NOW.getTime() + j * 86_400_000).toISOString();

const zone = (p: { lat: number; lng: number }, rayonKm: number, extra: Partial<ZoneOccupee> = {}): ZoneOccupee => ({
  ...p, activite: "plomberie", rayonKm, statut: "actif", expireLe: null, ...extra,
});

test("haversine : distances connues", () => {
  assert.equal(distanceKm(NICE, NICE), 0);
  assert.ok(Math.abs(distanceKm(NICE, CANNES) - 26.3) < 0.5, `Nice-Cannes ${distanceKm(NICE, CANNES)}`);
  assert.ok(Math.abs(distanceKm(CANNES, FREJUS) - 26.2) < 0.5, `Cannes-Fréjus ${distanceKm(CANNES, FREJUS)}`);
  assert.equal(distanceKm(NICE, CANNES), distanceKm(CANNES, NICE));
});

test("aucune zone : libre", () => {
  assert.equal(controleZone("plomberie", NICE, 10, [], { maintenant: NOW }).etat, "libre");
});

test("chevauchement : distance < r1 + r2", () => {
  const d = distanceKm(NICE, CANNES); // ~26,3 km
  const occ = [zone(CANNES, 10)];
  assert.equal(controleZone("plomberie", NICE, 15, occ, { maintenant: NOW }).etat, "libre"); // 15 + 10 < 26,3
  const r = controleZone("plomberie", NICE, 20, occ, { maintenant: NOW }); // 20 + 10 > 26,3
  assert.equal(r.etat, "partielle");
  assert.equal(r.rayonMaxKm, Math.floor((d - 10) * 10) / 10);
});

test("rayonMaxLibre : minimum sur toutes les zones occupées", () => {
  const occ = [zone(CANNES, 10), zone(CAGNES, 5)];
  const d2 = distanceKm(NICE, CAGNES) - 5;
  const d1 = distanceKm(NICE, CANNES) - 10;
  const r = controleZone("plomberie", NICE, 20, occ, { maintenant: NOW });
  assert.equal(r.rayonMaxKm, Math.floor(Math.min(d1, d2) * 10) / 10);
});

test("deux établissements proches : prise", () => {
  const proche = { lat: NICE.lat + 0.01, lng: NICE.lng }; // ~1,1 km
  const r = controleZone("plomberie", proche, 5, [zone(NICE, 10)], { maintenant: NOW });
  assert.equal(r.etat, "prise");
  assert.ok((r.rayonMaxKm ?? 0) < RAYON_MIN_KM);
});

test("même adresse : prise, jamais libre", () => {
  assert.equal(controleZone("plomberie", NICE, 5, [zone(NICE, 5)], { maintenant: NOW }).etat, "prise");
});

test("zones tangentes : pas de chevauchement", () => {
  const d = distanceKm(NICE, CAGNES);
  const r = controleZone("plomberie", NICE, d - 5, [zone(CAGNES, 5)], { maintenant: NOW });
  assert.equal(r.etat, "libre");
});

test("une autre activité ne bloque pas", () => {
  assert.equal(controleZone("electricite", NICE, 10, [zone(NICE, 10)], { maintenant: NOW }).etat, "libre");
});

test("activité comparée sans accents ni casse", () => {
  assert.equal(controleZone("Électricité", NICE, 10, [zone(NICE, 10, { activite: "electricite" })], { maintenant: NOW }).etat, "prise");
});

test("statuts : gardée expirée libère, gardée valide bloque, réservée bloque", () => {
  assert.equal(estOccupee({ statut: "gardee", expireLe: PLUS(-1) }, NOW), false);
  assert.equal(estOccupee({ statut: "gardee", expireLe: PLUS(3) }, NOW), true);
  assert.equal(estOccupee({ statut: "liberation", expireLe: PLUS(-1) }, NOW), false);
  assert.equal(estOccupee({ statut: "liberation", expireLe: PLUS(10) }, NOW), true);
  assert.equal(estOccupee({ statut: "reserve", expireLe: null }, NOW), true);
  assert.equal(estOccupee({ statut: "actif", expireLe: PLUS(-100) }, NOW), true);
  assert.equal(estOccupee({ statut: "libere", expireLe: null }, NOW), false);
  assert.equal(estOccupee({ statut: "gardee", expireLe: null }, NOW), true); // date absente : on bloque
  assert.equal(controleZone("plomberie", NICE, 5, [zone(NICE, 5, { statut: "gardee", expireLe: PLUS(-1) })], { maintenant: NOW }).etat, "libre");
});

test("exclure un client : son propre recalcul ne le bloque pas", () => {
  const occ = [zone(NICE, 10, { clientId: "c1" })];
  assert.equal(controleZone("plomberie", NICE, 10, occ, { maintenant: NOW }).etat, "prise");
  assert.equal(controleZone("plomberie", NICE, 10, occ, { maintenant: NOW, exclureClientId: "c1" }).etat, "libre");
});

test("doute : jamais libre (activité, adresse, rayon, zone illisible)", () => {
  assert.equal(controleZone("autre", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Autre activité", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  // « Autre activité » reste inconnue même si une zone existe sur la même adresse : jamais libre ni prise.
  assert.equal(controleZone("autre", NICE, 10, [zone(NICE, 10, { activite: "autre" })], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Astronaute", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", null, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", { lat: NaN, lng: 7 }, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", { lat: 0, lng: 400 }, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", NICE, 0, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", NICE, Number.NaN, [], { maintenant: NOW }).etat, "inconnue");
  const cassee = { ...zone(CANNES, 10), lat: Number.NaN };
  assert.equal(controleZone("plomberie", NICE, 5, [cassee], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("plomberie", NICE, 5, undefined as unknown as ZoneOccupee[], { maintenant: NOW }).etat, "inconnue");
});

test("activiteReconnue : identifiant ou libellé, sans accents ni casse", () => {
  assert.equal(activiteReconnue("plomberie"), "plomberie");
  assert.equal(activiteReconnue("PLOMBERIE"), "plomberie");
  assert.equal(activiteReconnue("Plomberie (dépannage et installation)"), "plomberie");
  assert.equal(activiteReconnue("Électricité"), "electricite");
  assert.equal(activiteReconnue("serrurerie-vitrerie"), "serrurerie-vitrerie");
  assert.equal(activiteReconnue("yachting-refit"), "yachting-refit");
  assert.equal(activiteReconnue("   "), null);
  assert.equal(activiteReconnue(undefined as unknown as string), null);
});

test("liste des activités : 11 dans l'ordre, identifiants stables, « Autre activité » en dernier choix", () => {
  assert.deepEqual(ACTIVITES.map((a) => a.id), [
    "plomberie", "electricite", "serrurerie-vitrerie", "chauffage-climatisation", "couverture-etancheite",
    "fenetres-volets-verandas", "piscine-paysagisme", "cuisine-salle-de-bain", "immobilier", "dentiste-sante", "yachting-refit",
  ]);
  assert.equal(ACTIVITES.length, 11);
  for (const a of ACTIVITES) assert.match(a.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(new Set(ACTIVITES.map((a) => a.id)).size, 11);
  assert.equal(ACTIVITES[0].label, "Plomberie (dépannage et installation)");
  assert.equal(ACTIVITES[9].label, "Dentiste et santé à fort panier (implants, orthodontie, esthétique médicale)");
  assert.equal(ACTIVITES_CHOIX.length, 12);
  assert.equal(ACTIVITES_CHOIX[11].id, "autre");
  assert.equal(ACTIVITES_CHOIX[11].label, "Autre activité");
  assert.ok(!ACTIVITES.some((a) => a.id === "autre"), "« autre » n'est pas une activité contrôlable");
});

test("anciennes activités retirées, « Autre activité » jamais contrôlable", () => {
  for (const ancienne of ["Maçonnerie", "Peinture", "Carrelage", "Coiffure et beauté", "Kiné et ostéopathie", "Garage et auto", "Salle de sport", "Services à la personne", "Vitrerie", "Paysagisme", "Piscine"]) {
    assert.equal(activiteReconnue(ancienne), null, ancienne);
  }
  assert.equal(activiteReconnue("autre"), null);
  assert.equal(activiteReconnue("Autre activité"), null);
  assert.equal(estAutreActivite("autre"), true);
  assert.equal(estAutreActivite("Autre activité"), true);
  assert.equal(estAutreActivite("plomberie"), false);
  assert.equal(libelleActivite("electricite"), "Électricité");
  assert.equal(libelleActivite("autre"), "Autre activité");
  assert.equal(MESSAGE_ACTIVITE_AUTRE, "Je regarde votre activité à la main et je vous réponds sous 24 h ouvrées.");
});

test("supplément mensuel : 100 € par tranche au-delà de 10 km et par zone au-delà de la première", () => {
  assert.equal(supplementMensuel(5, 1), 0);
  assert.equal(supplementMensuel(10, 1), 0);
  assert.equal(supplementMensuel(15, 1), 100);
  assert.equal(supplementMensuel(20, 1), 100);
  assert.equal(supplementMensuel(25, 1), 200);
  assert.equal(supplementMensuel(10, 2), 100);
  assert.equal(supplementMensuel(20, 3), 300);
  assert.equal(supplementMensuel(10, 0), 0);
});

test("expirations : gardée et libération échues passent à libéré, jamais une réservée", () => {
  const zs = [
    { id: "a", statut: "gardee" as const, expireLe: PLUS(-1) },
    { id: "b", statut: "gardee" as const, expireLe: PLUS(2) },
    { id: "c", statut: "liberation" as const, expireLe: PLUS(-5) },
    { id: "d", statut: "liberation" as const, expireLe: null },
    { id: "e", statut: "reserve" as const, expireLe: PLUS(-5) },
    { id: "f", statut: "actif" as const, expireLe: PLUS(-5) },
  ];
  assert.deepEqual(zonesAExpirer(zs, NOW).map((z) => z.id), ["a", "c"]);
  const garde = Date.parse(expirationPour("gardee", NOW)) - NOW.getTime();
  const lib = Date.parse(expirationPour("liberation", NOW)) - NOW.getTime();
  assert.equal(garde, 7 * 86_400_000);
  assert.equal(lib, 30 * 86_400_000);
});

test("suggestions : 3 communes libres dans 30 km, triées par distance", () => {
  const communes: CommuneCentre[] = [
    { nom: "Nice", ...NICE },
    { nom: "Cagnes-sur-Mer", ...CAGNES },
    { nom: "Antibes", ...ANTIBES },
    { nom: "Cannes", ...CANNES },
    { nom: "Fréjus", ...FREJUS },
  ];
  // Rien d'occupé : Cannes (~26 km) passe après les trois plus proches, Fréjus est trop loin.
  const libre = suggestions("plomberie", NICE, 5, communes, [], { maintenant: NOW });
  assert.deepEqual(libre.map((c) => c.nom), ["Nice", "Cagnes-sur-Mer", "Antibes"]);
  // Cagnes occupée : sa commune et celles qui chevauchent sont écartées.
  const avec = suggestions("plomberie", NICE, 5, communes, [zone(CAGNES, 5)], { maintenant: NOW });
  assert.ok(!avec.some((c) => c.nom === "Cagnes-sur-Mer"));
  assert.ok(avec.length <= 3);
  // Doute : aucune suggestion.
  assert.deepEqual(suggestions("autre", NICE, 5, communes, [], { maintenant: NOW }), []);
  assert.deepEqual(suggestions("plomberie", null, 5, communes, [], { maintenant: NOW }), []);
});

test("libellés courts : un par activité, distincts du libellé complet du menu", () => {
  const attendus: Record<string, string> = {
    plomberie: "plombier",
    electricite: "électricien",
    "serrurerie-vitrerie": "serrurier ou vitrier",
    "chauffage-climatisation": "chauffagiste",
    "couverture-etancheite": "couvreur",
    "fenetres-volets-verandas": "installateur de fenêtres et volets",
    "piscine-paysagisme": "pisciniste ou paysagiste",
    "cuisine-salle-de-bain": "cuisiniste",
    immobilier: "agent immobilier",
    "dentiste-sante": "dentiste ou praticien de santé",
    "yachting-refit": "professionnel du yachting",
  };
  assert.deepEqual(Object.keys(attendus), ACTIVITES.map((a) => a.id));
  for (const a of ACTIVITES) {
    assert.equal(a.court, attendus[a.id], a.id);
    assert.equal(libelleCourtActivite(a.id), attendus[a.id]);
    assert.notEqual(a.court, a.label, `${a.id} : libellé court différent du libellé du menu`);
  }
  // Le libellé complet reste celui du menu et des e-mails.
  assert.equal(libelleActivite("plomberie"), "Plomberie (dépannage et installation)");
  assert.equal(libelleActivite("dentiste-sante"), "Dentiste et santé à fort panier (implants, orthodontie, esthétique médicale)");
  assert.equal(libelleCourtActivite("inconnue"), "inconnue");
});

test("expressionPlace : « de » ou « d' » selon la première lettre", () => {
  assert.equal(expressionPlace("plomberie"), "de plombier");
  assert.equal(expressionPlace("electricite"), "d'électricien");
  assert.equal(expressionPlace("immobilier"), "d'agent immobilier");
  assert.equal(expressionPlace("fenetres-volets-verandas"), "d'installateur de fenêtres et volets");
  assert.equal(expressionPlace("chauffage-climatisation"), "de chauffagiste");
  assert.equal(expressionPlace("yachting-refit"), "de professionnel du yachting");
  assert.equal(`La place ${expressionPlace("plomberie")} est libre autour de votre établissement`, "La place de plombier est libre autour de votre établissement");
});

test("étape de la fiche : « Signé » réserve la zone, sans autre action", () => {
  const t = transitionZone("signe", { statut: "gardee", expireLe: PLUS(3) }, NOW);
  assert.deepEqual(t, { statut: "reserve", expireLe: null, reverification: false });
  assert.equal(transitionZone("signe", { statut: "liberation", expireLe: PLUS(10) }, NOW)?.statut, "reserve");
  assert.equal(transitionZone("signe", { statut: "reserve", expireLe: null }, NOW), null);
  assert.equal(transitionZone("signe", { statut: "actif", expireLe: null }, NOW), null);
});

test("signature d'une zone qui ne bloquait plus rien : vérification obligatoire avant reprise", () => {
  assert.equal(transitionZone("signe", { statut: "gardee", expireLe: PLUS(-1) }, NOW)?.reverification, true); // garde expirée
  assert.equal(transitionZone("signe", { statut: "libere", expireLe: null }, NOW)?.reverification, true);
  assert.equal(transitionZone("actif", { statut: "liberation", expireLe: PLUS(-2) }, NOW)?.reverification, true);
  assert.equal(transitionZone("actif", { statut: "libere", expireLe: null }, NOW)?.reverification, true);
  assert.equal(transitionZone("actif", { statut: "liberation", expireLe: PLUS(5) }, NOW)?.reverification, false); // retour en pause avant la fin
});

test("étape de la fiche : « En lancement » et « Campagnes actives » rendent la zone active", () => {
  for (const stage of ["lancement", "actif"]) {
    assert.deepEqual(transitionZone(stage, { statut: "reserve", expireLe: null }, NOW), { statut: "actif", expireLe: null, reverification: false });
    assert.equal(transitionZone(stage, { statut: "actif", expireLe: null }, NOW), null);
    assert.equal(transitionZone(stage, { statut: "gardee", expireLe: PLUS(2) }, NOW)?.statut, "actif");
  }
});

test("étape de la fiche : « Perdu » et « En pause » libèrent après 30 jours", () => {
  for (const stage of ["perdu", "pause"]) {
    for (const statut of ["reserve", "actif"] as const) {
      const t = transitionZone(stage, { statut, expireLe: null }, NOW);
      assert.equal(t?.statut, "liberation", `${stage} ${statut}`);
      assert.equal(Date.parse(t!.expireLe!) - NOW.getTime(), 30 * 86_400_000);
      assert.equal(t?.reverification, false);
    }
    // Zone seulement gardée (jamais signée) : libérée tout de suite.
    assert.deepEqual(transitionZone(stage, { statut: "gardee", expireLe: PLUS(4) }, NOW), { statut: "libere", expireLe: null, reverification: false });
    // Déjà en libération ou libérée : on ne repousse jamais la date.
    assert.equal(transitionZone(stage, { statut: "liberation", expireLe: PLUS(12) }, NOW), null);
    assert.equal(transitionZone(stage, { statut: "libere", expireLe: null }, NOW), null);
  }
});

test("étapes sans effet sur la zone (prospect, découverte, proposition, inconnue), même en retour arrière", () => {
  for (const stage of ["prospect", "decouverte", "proposition", "nimporte-quoi", ""]) {
    for (const statut of ["gardee", "reserve", "actif", "liberation", "libere"] as const) {
      assert.equal(transitionZone(stage, { statut, expireLe: PLUS(3) }, NOW), null, `${stage} ${statut}`);
    }
  }
});

test("zone libérée par l'étape : le territoire redevient libre pour un autre client", () => {
  const t = transitionZone("perdu", { statut: "gardee", expireLe: PLUS(4) }, NOW)!;
  const z = zone(NICE, 10, { statut: t.statut, expireLe: t.expireLe, clientId: "c1" });
  assert.equal(controleZone("plomberie", NICE, 10, [z], { maintenant: NOW }).etat, "libre");
  const t2 = transitionZone("signe", { statut: "gardee", expireLe: PLUS(4) }, NOW)!;
  const z2 = zone(NICE, 10, { statut: t2.statut, expireLe: t2.expireLe, clientId: "c1" });
  assert.equal(controleZone("plomberie", NICE, 10, [z2], { maintenant: NOW }).etat, "prise");
});
