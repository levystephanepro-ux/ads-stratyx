// Fiche Google Business d'une entreprise locale : lecture via Places API (clé GOOGLE_PLACES_API_KEY),
// saisie manuelle si la clé est absente, ou données d'exemple en mode démo.
// Les contrôles sont rédigés pour le dirigeant (vouvoiement) et réutilisent la forme de SiteCheck.
import type { SiteCheck } from "./site";

export interface GbpData {
  source: "places" | "manuel" | "exemple";
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  hasHours: boolean | null;
  /** Nombre de photos renvoyées par Google (10 au maximum). */
  photos: number | null;
  phone: string;
  website: string;
  status: string;
  mapsUrl: string;
}

export interface GbpResult { data: GbpData | null; message: string | null }

const key = () => process.env.GOOGLE_PLACES_API_KEY ?? "";
export const hasPlacesKey = () => !!key();

interface PlaceRaw {
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: unknown;
  photos?: unknown[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  types?: string[];
}
interface PlacesResponse { places?: PlaceRaw[] }

const FIELD_LIST = [
  "displayName", "formattedAddress", "rating", "userRatingCount", "regularOpeningHours", "photos",
  "websiteUri", "nationalPhoneNumber", "businessStatus", "googleMapsUri", "types",
];
const FIELDS = FIELD_LIST.map((f) => `places.${f}`).join(",");

function toGbp(p: PlaceRaw, fallbackName: string): GbpData {
  return {
    source: "places",
    name: p.displayName?.text ?? fallbackName,
    address: p.formattedAddress ?? "",
    rating: typeof p.rating === "number" ? p.rating : null,
    reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    hasHours: !!p.regularOpeningHours,
    photos: Array.isArray(p.photos) ? p.photos.length : 0,
    phone: p.nationalPhoneNumber ?? "",
    website: p.websiteUri ?? "",
    status: p.businessStatus ?? "",
    mapsUrl: p.googleMapsUri ?? "",
  };
}

async function placesFetch(url: string, init: { method: "GET" | "POST"; fields: string; body?: unknown }): Promise<{ ok: true; json: unknown } | { ok: false; message: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: init.method,
      signal: ctl.signal,
      cache: "no-store",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key(), "X-Goog-FieldMask": init.fields },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint = res.status === 403 || res.status === 400 ? " Vérifiez que Places API (New) est activée pour cette clé." : "";
      return { ok: false, message: `Google Places a répondu ${res.status}.${hint}${body ? ` ${body.slice(0, 160)}` : ""}` };
    }
    return { ok: true, json: await res.json() };
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    return { ok: false, message: timeout ? "Google Places n'a pas répondu en 10 secondes." : "Google Places est injoignable pour le moment." };
  } finally { clearTimeout(t); }
}

export interface PlaceSuggestion { id: string; main: string; secondary: string; business: boolean }

/** Suggestions pendant la frappe (Places Autocomplete). Renvoie une liste vide si la clé est absente. */
export async function suggestPlaces(input: string): Promise<{ suggestions: PlaceSuggestion[]; message: string | null }> {
  const q = input.trim();
  if (q.length < 3) return { suggestions: [], message: null };
  if (!hasPlacesKey()) return { suggestions: [], message: "Clé Google Places absente dans cet environnement." };
  const r = await placesFetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    fields: "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types",
    body: { input: q, languageCode: "fr", regionCode: "FR", includedRegionCodes: ["fr"] },
  });
  if (!r.ok) return { suggestions: [], message: r.message };
  const json = r.json as { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; types?: string[] } }[] };
  const suggestions = (json.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    const types = p.types ?? [];
    return [{
      id: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
      business: types.includes("establishment") || types.includes("point_of_interest"),
    }];
  }).slice(0, 6);
  return { suggestions, message: null };
}

/** Fiche précise à partir d'une suggestion choisie (identifiant Google). */
export async function placeById(placeId: string): Promise<GbpResult> {
  const id = placeId.trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return { data: null, message: null };
  if (!hasPlacesKey()) return { data: null, message: "La clé Google Places n'est pas disponible dans cet environnement : renseignez la fiche à la main." };
  const r = await placesFetch(`https://places.googleapis.com/v1/places/${id}?languageCode=fr&regionCode=FR`, { method: "GET", fields: FIELD_LIST.join(",") });
  if (!r.ok) return { data: null, message: r.message };
  const p = r.json as PlaceRaw;
  const types = p.types ?? [];
  const isBusiness = types.includes("establishment") || types.includes("point_of_interest");
  return {
    data: toGbp(p, ""),
    message: isBusiness ? null : "Cette suggestion est une adresse, pas une fiche d'entreprise : cherchez plutôt le nom de l'entreprise.",
  };
}

/** Cherche la fiche par « nom + ville ». Renvoie la première correspondance (à vérifier sur l'adresse affichée). */
export async function lookupPlace(query: string): Promise<GbpResult> {
  const q = query.trim();
  if (!q) return { data: null, message: null };
  if (!hasPlacesKey()) return { data: null, message: "La clé Google Places n'est pas disponible dans cet environnement : renseignez la fiche à la main." };
  const r = await placesFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", fields: FIELDS,
    body: { textQuery: q, languageCode: "fr", regionCode: "FR", pageSize: 1 },
  });
  if (!r.ok) return { data: null, message: r.message };
  const p = (r.json as PlacesResponse).places?.[0];
  if (!p) return { data: null, message: "Aucune fiche Google trouvée pour cette recherche. Essayez avec le nom exact et la ville." };
  return { data: toGbp(p, q), message: null };
}

const num = (s?: string) => {
  const n = Number((s ?? "").replace(/\s/g, "").replace(",", "."));
  return s && s.trim() !== "" && Number.isFinite(n) ? n : null;
};
const yn = (s?: string) => (s === "oui" ? true : s === "non" ? false : null);

/** Saisie à la main : note, avis, horaires (oui/non), photos, téléphone, site. Renvoie null si rien n'est renseigné. */
export function gbpFromManual(sp: { gb_note?: string; gb_avis?: string; gb_horaires?: string; gb_photos?: string; gb_tel?: string; gb_site?: string }, name: string): GbpData | null {
  const d: GbpData = {
    source: "manuel", name, address: "",
    rating: num(sp.gb_note), reviews: num(sp.gb_avis), hasHours: yn(sp.gb_horaires), photos: num(sp.gb_photos),
    phone: (sp.gb_tel ?? "").trim(), website: (sp.gb_site ?? "").trim(), status: "OPERATIONAL", mapsUrl: "",
  };
  const any = d.rating !== null || d.reviews !== null || d.hasHours !== null || d.photos !== null || d.phone || d.website;
  return any ? d : null;
}

/** Données d'exemple (mode démo), clairement signalées comme telles dans la page. */
export function demoGbp(name: string): GbpData {
  return { source: "exemple", name: name || "Entreprise exemple", address: "12 rue de l'Exemple, 83000 Toulon", rating: 4.1, reviews: 14, hasHours: true, photos: 3, phone: "04 00 00 00 00", website: "https://exemple.fr", status: "OPERATIONAL", mapsUrl: "" };
}

const host = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

/** Contrôles de la fiche. Une donnée absente (saisie manuelle incomplète) n'est ni validée ni comptée : elle est ignorée. */
export function gbpChecks(g: GbpData, auditedUrl: string): SiteCheck[] {
  const c: SiteCheck[] = [];
  const add = (id: string, label: string, ok: boolean, level: SiteCheck["level"], good: string, bad: string) => c.push({ id, label, ok, level, detail: ok ? good : bad });

  if (g.status && g.status !== "OPERATIONAL") {
    add("gbp-open", "Votre fiche indique que l'entreprise est ouverte", false, "critique", "", "Votre fiche Google est marquée comme fermée : elle est écartée des recherches locales.");
  }
  if (g.rating !== null) {
    add("gbp-rating", "Votre note Google rassure", g.rating >= 4.3, "important",
      `Note de ${g.rating.toLocaleString("fr-FR")} sur 5.`,
      `Note de ${g.rating.toLocaleString("fr-FR")} sur 5 : en dessous de 4,3, beaucoup de clients potentiels vont voir un concurrent mieux noté.`);
  }
  if (g.reviews !== null) {
    add("gbp-reviews", "Vous avez assez d'avis clients", g.reviews >= 25, g.reviews < 10 ? "important" : "mineur",
      `${g.reviews} avis clients.`,
      `${g.reviews} avis seulement : une fiche avec peu d'avis inspire moins confiance qu'un concurrent qui en a davantage.`);
  }
  if (g.hasHours !== null) {
    add("gbp-hours", "Vos horaires sont renseignés", g.hasHours, "important", "Horaires d'ouverture renseignés.",
      "Aucun horaire n'est renseigné : Google affiche votre fiche avec moins de confiance, et les clients ne savent pas quand vous joindre.");
  }
  if (g.photos !== null) {
    add("gbp-photos", "Votre fiche montre votre travail", g.photos >= 5, "mineur",
      g.source === "places" ? "Au moins 5 photos sur la fiche." : `${g.photos} photos sur la fiche.`,
      `${g.photos} photo(s) seulement : des réalisations et des photos de l'équipe aident à convaincre de demander un devis.`);
  }
  if (g.source !== "manuel" || g.phone) {
    add("gbp-phone", "Votre téléphone figure sur la fiche", !!g.phone, "important", "Numéro de téléphone renseigné.",
      "Aucun numéro de téléphone sur la fiche : les clients qui préfèrent appeler depuis Google Maps ne le peuvent pas.");
  }
  if (g.source !== "manuel" || g.website) {
    add("gbp-site", "Votre site figure sur la fiche", !!g.website, "important", "Site renseigné sur la fiche.",
      "Aucun site n'est lié à la fiche : les clients ne peuvent pas découvrir vos réalisations depuis Google.");
    if (g.website && auditedUrl) {
      const same = host(g.website) === host(auditedUrl);
      add("gbp-same", "La fiche renvoie vers la page analysée", same, "mineur", "La fiche renvoie vers la même adresse que la page analysée.",
        `La fiche renvoie vers ${host(g.website)}, pas vers la page analysée (${host(auditedUrl)}) : vérifiez que c'est voulu.`);
    }
  }
  return c;
}
