// Tests de lib/zones.ts. Lancer : npm run test:zones (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activiteReconnue, controleZone, distanceKm, estOccupee, expirationPour, suggestions,
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
  ...p, activite: "Plomberie", rayonKm, statut: "actif", expireLe: null, ...extra,
});

test("haversine : distances connues", () => {
  assert.equal(distanceKm(NICE, NICE), 0);
  assert.ok(Math.abs(distanceKm(NICE, CANNES) - 26.3) < 0.5, `Nice-Cannes ${distanceKm(NICE, CANNES)}`);
  assert.ok(Math.abs(distanceKm(CANNES, FREJUS) - 26.2) < 0.5, `Cannes-Fréjus ${distanceKm(CANNES, FREJUS)}`);
  assert.equal(distanceKm(NICE, CANNES), distanceKm(CANNES, NICE));
});

test("aucune zone : libre", () => {
  assert.equal(controleZone("Plomberie", NICE, 10, [], { maintenant: NOW }).etat, "libre");
});

test("chevauchement : distance < r1 + r2", () => {
  const d = distanceKm(NICE, CANNES); // ~26,3 km
  const occ = [zone(CANNES, 10)];
  assert.equal(controleZone("Plomberie", NICE, 15, occ, { maintenant: NOW }).etat, "libre"); // 15 + 10 < 26,3
  const r = controleZone("Plomberie", NICE, 20, occ, { maintenant: NOW }); // 20 + 10 > 26,3
  assert.equal(r.etat, "partielle");
  assert.equal(r.rayonMaxKm, Math.floor((d - 10) * 10) / 10);
});

test("rayonMaxLibre : minimum sur toutes les zones occupées", () => {
  const occ = [zone(CANNES, 10), zone(CAGNES, 5)];
  const d2 = distanceKm(NICE, CAGNES) - 5;
  const d1 = distanceKm(NICE, CANNES) - 10;
  const r = controleZone("Plomberie", NICE, 20, occ, { maintenant: NOW });
  assert.equal(r.rayonMaxKm, Math.floor(Math.min(d1, d2) * 10) / 10);
});

test("deux établissements proches : prise", () => {
  const proche = { lat: NICE.lat + 0.01, lng: NICE.lng }; // ~1,1 km
  const r = controleZone("Plomberie", proche, 5, [zone(NICE, 10)], { maintenant: NOW });
  assert.equal(r.etat, "prise");
  assert.ok((r.rayonMaxKm ?? 0) < RAYON_MIN_KM);
});

test("même adresse : prise, jamais libre", () => {
  assert.equal(controleZone("Plomberie", NICE, 5, [zone(NICE, 5)], { maintenant: NOW }).etat, "prise");
});

test("zones tangentes : pas de chevauchement", () => {
  const d = distanceKm(NICE, CAGNES);
  const r = controleZone("Plomberie", NICE, d - 5, [zone(CAGNES, 5)], { maintenant: NOW });
  assert.equal(r.etat, "libre");
});

test("une autre activité ne bloque pas", () => {
  assert.equal(controleZone("Électricité", NICE, 10, [zone(NICE, 10)], { maintenant: NOW }).etat, "libre");
});

test("activité comparée sans accents ni casse", () => {
  assert.equal(controleZone("electricite", NICE, 10, [zone(NICE, 10, { activite: "Électricité" })], { maintenant: NOW }).etat, "prise");
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
  assert.equal(controleZone("Plomberie", NICE, 5, [zone(NICE, 5, { statut: "gardee", expireLe: PLUS(-1) })], { maintenant: NOW }).etat, "libre");
});

test("exclure un client : son propre recalcul ne le bloque pas", () => {
  const occ = [zone(NICE, 10, { clientId: "c1" })];
  assert.equal(controleZone("Plomberie", NICE, 10, occ, { maintenant: NOW }).etat, "prise");
  assert.equal(controleZone("Plomberie", NICE, 10, occ, { maintenant: NOW, exclureClientId: "c1" }).etat, "libre");
});

test("doute : jamais libre (activité, adresse, rayon, zone illisible)", () => {
  assert.equal(controleZone("Autre", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Astronaute", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("", NICE, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", null, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", { lat: NaN, lng: 7 }, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", { lat: 0, lng: 400 }, 10, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", NICE, 0, [], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", NICE, Number.NaN, [], { maintenant: NOW }).etat, "inconnue");
  const cassee = { ...zone(CANNES, 10), lat: Number.NaN };
  assert.equal(controleZone("Plomberie", NICE, 5, [cassee], { maintenant: NOW }).etat, "inconnue");
  assert.equal(controleZone("Plomberie", NICE, 5, undefined as unknown as ZoneOccupee[], { maintenant: NOW }).etat, "inconnue");
});

test("activiteReconnue", () => {
  assert.equal(activiteReconnue("plomberie"), "Plomberie");
  assert.equal(activiteReconnue("Coiffure et beauté"), "Coiffure et beauté");
  assert.equal(activiteReconnue("Autre"), null);
  assert.equal(activiteReconnue("   "), null);
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
  const libre = suggestions("Plomberie", NICE, 5, communes, [], { maintenant: NOW });
  assert.deepEqual(libre.map((c) => c.nom), ["Nice", "Cagnes-sur-Mer", "Antibes"]);
  // Cagnes occupée : sa commune et celles qui chevauchent sont écartées.
  const avec = suggestions("Plomberie", NICE, 5, communes, [zone(CAGNES, 5)], { maintenant: NOW });
  assert.ok(!avec.some((c) => c.nom === "Cagnes-sur-Mer"));
  assert.ok(avec.length <= 3);
  // Doute : aucune suggestion.
  assert.deepEqual(suggestions("Autre", NICE, 5, communes, [], { maintenant: NOW }), []);
  assert.deepEqual(suggestions("Plomberie", null, 5, communes, [], { maintenant: NOW }), []);
});
