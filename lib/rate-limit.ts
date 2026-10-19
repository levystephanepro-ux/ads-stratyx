// Limitation de débit simple, en mémoire (par instance serverless) : freine le bourrage de formulaire
// sans dépendance. Le plafond global de demandes par heure est contrôlé en base (voir createZoneLead).
const seaux = new Map<string, number[]>();

/** true si la clé a dépassé `max` appels sur `fenetreMs`. Enregistre l'appel sinon. */
export function limite(cle: string, max: number, fenetreMs: number): boolean {
  const maintenant = Date.now();
  const recents = (seaux.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
  if (recents.length >= max) {
    seaux.set(cle, recents);
    return true;
  }
  recents.push(maintenant);
  seaux.set(cle, recents);
  if (seaux.size > 5000) {
    for (const [k, v] of seaux) if (!v.some((t) => maintenant - t < fenetreMs)) seaux.delete(k);
  }
  return false;
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "inconnue";
}
