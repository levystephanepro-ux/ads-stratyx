// Identification du propriétaire de la plateforme (toi).
// L'owner voit tous les comptes du MCC et n'a pas de quota IA ; les clients
// ne voient que les comptes reliés à leur espace.
export function ownerEmail(): string {
  return process.env.OWNER_EMAIL || "levy.stephane.pro@gmail.com";
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ownerEmail().toLowerCase();
}
