// Télécharge les communes des Alpes-Maritimes (06) et du Var (83) sur geo.api.gouv.fr
// et écrit lib/data/communes-06-83.json (autocomplétion et suggestions, pas de centre de zone).
// Usage : node scripts/build-communes.mjs
import { writeFile, mkdir } from "node:fs/promises";

const DEPARTEMENTS = ["06", "83"];
const CHAMPS = "nom,code,codesPostaux,centre,population";

const communes = [];
for (const dep of DEPARTEMENTS) {
  const url = `https://geo.api.gouv.fr/departements/${dep}/communes?fields=${CHAMPS}&format=json&geometry=centre`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo.api.gouv.fr ${dep} : HTTP ${res.status}`);
  const rows = await res.json();
  for (const r of rows) {
    const [lng, lat] = r.centre?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue; // jamais de commune sans centre
    communes.push({
      nom: r.nom,
      insee: r.code,
      departement: dep,
      codesPostaux: r.codesPostaux ?? [],
      lat,
      lng,
      population: r.population ?? 0,
    });
  }
}
communes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

await mkdir(new URL("../lib/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../lib/data/communes-06-83.json", import.meta.url), JSON.stringify(communes) + "\n");
console.log(`${communes.length} communes écrites (${DEPARTEMENTS.join(", ")})`);
