// Audit d'une page de destination (site du client ou prospect), sans IA : on lit le HTML
// comme un visiteur et on contrôle ce qui compte pour une campagne Google Ads.
export interface SiteCheck { id: string; label: string; ok: boolean; level: "critique" | "important" | "mineur"; detail: string }
export interface SiteAudit {
  url: string; finalUrl: string; status: number | null; ms: number | null; sizeKb: number | null;
  title: string; description: string; h1: string[]; checks: SiteCheck[]; score: number; error: string | null;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? "";

export async function analyzeSite(rawUrl: string): Promise<SiteAudit> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const base: SiteAudit = { url, finalUrl: url, status: null, ms: null, sizeKb: null, title: "", description: "", h1: [], checks: [], score: 0, error: null };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  const t0 = Date.now();
  let html = "";
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctl.signal, cache: "no-store", headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "fr-FR,fr;q=0.9" } });
    base.status = res.status; base.finalUrl = res.url || url;
    html = (await res.text()).slice(0, 1_500_000);
    base.ms = Date.now() - t0; base.sizeKb = Math.round(html.length / 1024);
  } catch (e) {
    base.error = e instanceof Error && e.name === "AbortError" ? "La page n'a pas répondu en 15 secondes." : "La page est injoignable depuis nos serveurs (elle peut quand même s'ouvrir dans ton navigateur).";
    return base;
  } finally { clearTimeout(t); }

  const head = html.slice(0, 200_000);
  base.title = text(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? "");
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  base.description = metas.find((m) => /name\s*=\s*["']description["']/i.test(m)) ? attr(metas.find((m) => /name\s*=\s*["']description["']/i.test(m))!, "content") : "";
  base.h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1])).filter(Boolean).slice(0, 5);
  const body = text(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  const lower = html.toLowerCase();
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((i) => !/\balt\s*=\s*["'][^"']+["']/i.test(i)).length;
  const hasViewport = metas.some((m) => /name\s*=\s*["']viewport["']/i.test(m));
  const noindex = metas.some((m) => /name\s*=\s*["']robots["']/i.test(m) && /noindex/i.test(m));
  const tel = /href\s*=\s*["']tel:/i.test(html);
  const phoneText = /(?:\+33|0)\s?[1-9](?:[\s.\-]?\d{2}){4}/.test(body);
  const forms = (html.match(/<form\b/gi) ?? []).length;
  const cta = /(devis|appel|rappel|contact|rendez-vous|réserv|commander|acheter|demander|obtenir)/i.test(body);
  const gtm = /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html);
  const gtag = /googletagmanager\.com\/gtag\/js|gtag\(/i.test(html);
  const ads = /AW-\d{6,}/.test(html);
  const ga4 = /G-[A-Z0-9]{6,}/.test(html);
  const meta = /connect\.facebook\.net|fbq\(/i.test(html);
  const consent = /(axeptio|tarteaucitron|cookiebot|didomi|onetrust|cookieyes|complianz|consent)/i.test(lower);
  const schema = /application\/ld\+json/i.test(html);
  const reviews = /(avis|trustpilot|google reviews|étoiles|certifi|garantie|décennale|rge)/i.test(body);
  const https = base.finalUrl.startsWith("https://");

  const c: SiteCheck[] = [];
  const add = (id: string, label: string, ok: boolean, level: SiteCheck["level"], good: string, bad: string) => c.push({ id, label, ok, level, detail: ok ? good : bad });
  add("http", "La page répond", base.status !== null && base.status < 400, "critique", `Code ${base.status}.`, `La page répond ${base.status} : les annonces enverraient les visiteurs vers une erreur.`);
  add("https", "Page sécurisée (https)", https, "critique", "Connexion sécurisée.", "La page n'est pas en https : Google Ads la refuse ou les visiteurs se méfient.");
  add("noindex", "Page non bloquée", !noindex, "important", "Aucune consigne noindex.", "La page contient « noindex » : ne pas l'utiliser comme page d'atterrissage SEO.");
  add("speed", "Temps de réponse", (base.ms ?? 99999) < 1500, "important", `${base.ms} ms pour recevoir la page.`, `${base.ms} ms pour recevoir la page : au-delà de 1,5 s, une part des visiteurs part avant l'affichage. Mesure aussi le temps complet sur PageSpeed Insights.`);
  add("weight", "Poids de la page HTML", (base.sizeKb ?? 0) < 500, "mineur", `${base.sizeKb} Ko de HTML.`, `${base.sizeKb} Ko de HTML : page très lourde.`);
  add("mobile", "Adaptée au mobile", hasViewport, "critique", "Balise viewport présente.", "Balise viewport absente : la page risque de s'afficher en version bureau sur téléphone, où vient l'essentiel du trafic.");
  add("title", "Titre de la page", base.title.length >= 20 && base.title.length <= 70, "mineur", `« ${base.title} » (${base.title.length} car.).`, base.title ? `Titre de ${base.title.length} caractères : vise 30 à 65.` : "Titre absent.");
  add("desc", "Description de la page", base.description.length >= 70 && base.description.length <= 170, "mineur", `${base.description.length} caractères.`, base.description ? `Description de ${base.description.length} caractères : vise 90 à 160.` : "Description absente.");
  add("h1", "Un titre principal (H1)", base.h1.length === 1, "important", `« ${base.h1[0]} ».`, base.h1.length === 0 ? "Aucun H1 : le visiteur ne retrouve pas la promesse de l'annonce." : `${base.h1.length} H1 : garde un seul titre principal, aligné sur l'annonce.`);
  add("cta", "Appel à l'action visible", cta, "critique", "Mots d'action détectés (devis, contact, appel…).", "Aucun appel à l'action détecté dans le texte.");
  add("tel", "Téléphone cliquable", tel, phoneText || !tel ? "important" : "important", "Numéro cliquable (tel:).", phoneText ? "Un numéro est affiché mais n'est pas cliquable sur mobile : tu perds des appels." : "Aucun numéro de téléphone détecté.");
  add("form", "Formulaire de contact", forms > 0, "important", `${forms} formulaire(s).`, "Aucun formulaire trouvé (il peut se charger après coup, à vérifier à la main).");
  add("proof", "Preuves de confiance", reviews, "important", "Avis, garanties ou certifications mentionnés.", "Aucune preuve de confiance détectée (avis, garanties, certifications).");
  add("track", "Suivi des conversions", gtm || ads || gtag, "critique", `${[gtm && "Google Tag Manager", ads && "balise Google Ads", ga4 && "GA4"].filter(Boolean).join(", ") || "gtag"} détecté.`, "Aucun suivi Google détecté (GTM, gtag, balise Google Ads) : impossible de mesurer les leads.");
  add("consent", "Bandeau de consentement", consent, "mineur", "Outil de consentement détecté.", "Aucun bandeau de consentement détecté : à vérifier (RGPD, et mesure des conversions en Europe).");
  add("meta", "Pixel Meta", meta, "mineur", "Pixel Meta présent.", "Pas de pixel Meta : utile seulement si tu prévois des campagnes Meta.");
  add("alt", "Images décrites (alt)", imgs.length === 0 || noAlt / imgs.length < 0.3, "mineur", `${imgs.length - noAlt} image(s) sur ${imgs.length} avec description.`, `${noAlt} image(s) sur ${imgs.length} sans description.`);
  add("schema", "Données structurées", schema, "mineur", "Balisage schema.org présent.", "Pas de balisage schema.org (entreprise locale, avis).");

  const w = { critique: 3, important: 2, mineur: 1 } as const;
  const total = c.reduce((s, x) => s + w[x.level], 0);
  const got = c.reduce((s, x) => s + (x.ok ? w[x.level] : 0), 0);
  base.checks = c; base.score = Math.round((got / total) * 100);
  return base;
}
