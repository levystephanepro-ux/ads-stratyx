// Géocodage d'une adresse via l'API Adresse (api-adresse.data.gouv.fr, gratuite, sans clé).
// Serveur seulement. Un score trop bas, une erreur réseau ou une réponse illisible
// renvoient null : l'appelant traite alors la zone comme « inconnue » (jamais « libre »).
import { SCORE_MIN_GEOCODAGE, pointValide } from "@/lib/zones";

const ENDPOINT = "https://api-adresse.data.gouv.fr/search/";

export interface Geocodage {
  lat: number;
  lng: number;
  commune: string;
  /** Adresse normalisée renvoyée par la BAN. */
  libelle: string;
  score: number;
  /** adresse = numéro trouvé ; rue = centre de la rue ; commune = centre de commune (indicatif seulement). */
  precision: "adresse" | "rue" | "commune";
}

interface ReponseAdresse {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { label?: string; score?: number; city?: string; type?: string };
  }[];
}

export async function geocoder(adresse: string): Promise<Geocodage | null> {
  const q = adresse.trim().replace(/\s+/g, " ");
  if (q.length < 3 || q.length > 200) return null;
  try {
    const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(q)}&limit=1&autocomplete=0`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const f = ((await res.json()) as ReponseAdresse).features?.[0];
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    const score = f?.properties?.score;
    if (typeof score !== "number" || score < SCORE_MIN_GEOCODAGE) return null;
    const p = { lat, lng };
    if (!pointValide(p)) return null;
    const type = f?.properties?.type;
    return {
      lat: p.lat,
      lng: p.lng,
      commune: f?.properties?.city ?? "",
      libelle: f?.properties?.label ?? q,
      score,
      precision: type === "housenumber" ? "adresse" : type === "street" ? "rue" : "commune",
    };
  } catch {
    return null;
  }
}
