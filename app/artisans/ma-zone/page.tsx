import { permanentRedirect } from "next/navigation";

// Ancienne adresse de la vérification de zone : la page publique vit désormais sur /zone.
export default function MaZoneRedirection() {
  permanentRedirect("/zone");
}
