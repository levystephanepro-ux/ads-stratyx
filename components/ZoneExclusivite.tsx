// Bloc « Zone d'exclusivité » de la fiche client : activité, adresse de l'établissement, rayon, contrôle de chevauchement,
// supplément mensuel, garde 7 jours et réservation. Composant d'affichage : les données sont lues par la page.
// L'adresse d'un client n'apparaît que sur cette page privée, jamais côté public.
import type { Client } from "@/lib/clients/store";
import type { Stage } from "@/lib/clients/stages";
import type { ZoneClient } from "@/lib/zones-store";
import {
  ACTIVITES, ACTIVITE_AUTRE, GARDE_APRES_APPEL_JOURS, PRIX_ZONE_SUPP_MOIS, RAYONS_PROPOSES, RAYON_INCLUS_KM,
  estOccupee, supplementMensuel, type ResultatControle, type StatutZone,
} from "@/lib/zones";
import { enregistrerChampsZoneAction, geocoderZoneAction, gardeZoneAction, reserverZoneAction } from "@/app/clients/zone-actions";

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const lab = { fontSize: 12, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 4 } as const;
const alerte = (couleur: string) => ({ borderLeft: `4px solid ${couleur}`, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13 }) as const;

const STATUT: Record<StatutZone, string> = {
  gardee: "Gardée", reserve: "Réservée", actif: "Active", liberation: "En libération", libere: "Libérée",
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");
const STAGES_CLIENT = ["signe", "lancement", "actif"];

export interface Props {
  client: Client;
  stage: Stage;
  zone: ZoneClient | null;
  /** Contrôle de l'adresse saisie contre les zones des autres clients (null si pas encore géocodée). */
  controle: ResultatControle | null;
  /** Message de la dernière action (paramètre ?zone=ok:... ou err:...). */
  message: { ok: boolean; texte: string } | null;
  maintenant?: Date;
}

export default function ZoneExclusivite({ client: c, stage, zone, controle, message, maintenant = new Date() }: Props) {
  const a = c.answers ?? {};
  const actif = zone && zone.statut !== "libere";
  const activite = a.activite_exclusive || zone?.activite || "";
  const adresse = a.adresse_etablissement || zone?.adresse || "";
  const lien = a.lien_fiche_google || zone?.lienFicheGoogle || "";
  const rayon = Number(a.rayon_km) || zone?.rayonKm || RAYON_INCLUS_KM;
  const lat = a.zone_lat ?? (zone ? String(zone.lat) : "");
  const lng = a.zone_lng ?? (zone ? String(zone.lng) : "");
  const geocodee = !!(a.zone_lat && a.zone_lng);
  const autre = activite === ACTIVITE_AUTRE.id;
  const bloquee = !!zone && estOccupee(zone, maintenant);
  const signeOuPlus = STAGES_CLIENT.includes(stage);
  const supplement = supplementMensuel(rayon, 1);

  const peutGarder = !zone || zone.statut === "libere" || zone.statut === "gardee" || zone.statut === "liberation";
  const peutReserver = !zone || !["reserve", "actif"].includes(zone.statut);

  // Écart entre le centre de la zone enregistrée et l'adresse saisie (déménagement, correction).
  const centreDiffere = !!zone && actif && geocodee &&
    (Math.abs(Number(a.zone_lat) - zone.lat) > 0.0005 || Math.abs(Number(a.zone_lng) - zone.lng) > 0.0005);

  return (
    <section id="zone" className="card" style={{ display: "grid", gap: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Zone d&apos;exclusivité</h2>
        {zone ? (
          <span className={`pill${bloquee ? " ok" : ""}`}>
            {STATUT[zone.statut]}
            {zone.expireLe && (zone.statut === "gardee" || zone.statut === "liberation") ? ` jusqu'au ${date(zone.expireLe)}` : ""}
          </span>
        ) : (
          <span className="pill">Aucune zone</span>
        )}
        {a.source === "vérification de zone" && <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Demande reçue par la page /zone</span>}
      </div>

      {message && <div style={alerte(message.ok ? "var(--green)" : "var(--red)")}>{message.texte}</div>}

      {signeOuPlus && !bloquee && (
        <div style={alerte("var(--red)")}>
          La fiche est à l&apos;étape « {stage === "signe" ? "Signé" : stage === "lancement" ? "En lancement" : "Campagnes actives"} » mais la zone n&apos;est pas bloquée
          {zone ? ` (${STATUT[zone.statut].toLowerCase()}).` : " : aucune zone enregistrée."} Réserve-la maintenant, ou vérifie qu&apos;aucun autre client ne l&apos;a prise.
        </div>
      )}
      {stage === "decouverte" && peutGarder && !bloquee && (
        <div style={alerte("var(--accent)")}>Découverte faite : garde la zone {GARDE_APRES_APPEL_JOURS} jours le temps que le client décide. Sans signature, elle est libérée seule.</div>
      )}
      {zone?.statut === "liberation" && (
        <div style={alerte("var(--accent)")}>
          Zone en libération jusqu&apos;au {date(zone.expireLe)}. Si le client redevient actif avant cette date, elle repasse en active.
        </div>
      )}
      {centreDiffere && (
        <div style={alerte("var(--accent)")}>
          Le centre calculé pour l&apos;adresse saisie n&apos;est pas celui de la zone enregistrée. Clique sur « Recalculer » pour le mettre à jour ; la zone n&apos;est modifiée que s&apos;il n&apos;y a aucun chevauchement.
        </div>
      )}
      {autre && <div style={alerte("var(--accent)")}>« Autre activité » : aucune vérification automatique. Contrôle les zones existantes à la main avant de t&apos;engager.</div>}

      <form action={enregistrerChampsZoneAction} style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="id" value={c.id} />
        <input type="hidden" name="lat0" value={lat} />
        <input type="hidden" name="lng0" value={lng} />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <span style={lab}>Activité</span>
            <select name="activite" defaultValue={activite} style={input}>
              <option value="">Choisir…</option>
              {ACTIVITES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              <option value={ACTIVITE_AUTRE.id}>{ACTIVITE_AUTRE.label}</option>
            </select>
          </div>
          <div>
            <span style={lab}>Rayon autour de l&apos;établissement</span>
            <select name="rayon" defaultValue={String(rayon)} style={input}>
              {RAYONS_PROPOSES.map((r) => <option key={r} value={r}>{r} km{r > RAYON_INCLUS_KM ? ` (supplément ${PRIX_ZONE_SUPP_MOIS} € par mois)` : " (inclus)"}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span style={lab}>Adresse de l&apos;établissement</span>
          <input name="adresse" defaultValue={adresse} placeholder="12 rue de la République, 06000 Nice" style={input} />
          <span className="subtitle" style={{ fontSize: 12 }}>
            Adresse de la fiche Google Business. Si la fiche masque l&apos;adresse (zone de service seulement), saisis l&apos;adresse réelle : elle n&apos;est jamais affichée publiquement.
          </span>
        </div>
        <div>
          <span style={lab}>Lien de la fiche Google</span>
          <input name="lien" defaultValue={lien} placeholder="https://maps.app.goo.gl/..." style={input} />
          {lien && /^https?:\/\//i.test(lien) && <a href={lien} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>Ouvrir la fiche pour comparer l&apos;adresse</a>}
        </div>

        <details>
          <summary style={{ cursor: "pointer", fontSize: 13 }}>Saisir les coordonnées à la main (si le géocodage échoue)</summary>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 8 }}>
            <div><span style={lab}>Latitude</span><input name="lat" defaultValue={lat} inputMode="decimal" placeholder="43.7102" style={input} /></div>
            <div><span style={lab}>Longitude</span><input name="lng" defaultValue={lng} inputMode="decimal" placeholder="7.2620" style={input} /></div>
            <div>
              <span style={lab}>Origine</span>
              <select name="origine" defaultValue={(a.zone_source === "fiche_google" ? "fiche_google" : "manuel")} style={input}>
                <option value="fiche_google">Copiées depuis la fiche Google (Maps)</option>
                <option value="manuel">Saisie manuelle</option>
              </select>
            </div>
          </div>
        </details>

        {geocodee ? (
          <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>
            Centre : {Number(a.zone_lat).toFixed(5)}, {Number(a.zone_lng).toFixed(5)}
            {a.zone_commune ? ` · ${a.zone_commune}` : ""}
            {" · "}{a.zone_source === "fiche_google" ? "coordonnées de la fiche Google" : a.zone_source === "manuel" ? "saisie manuelle" : "géocodage API Adresse"}
            {a.zone_precision && a.zone_precision !== "adresse" ? ` · précision : ${a.zone_precision === "rue" ? "centre de la rue" : "centre de la commune"} (trop imprécis pour réserver)` : ""}
          </p>
        ) : (
          <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>Adresse pas encore géocodée.</p>
        )}

        {controle && !autre && (
          <div style={alerte(controle.etat === "libre" ? "var(--green)" : controle.etat === "inconnue" ? "var(--accent)" : "var(--red)")}>
            <strong>Contrôle : </strong>
            {controle.etat === "libre" && `libre pour ${rayon} km, aucun chevauchement avec un autre client de même activité.`}
            {controle.etat === "partielle" && `chevauchement avec un autre client. Rayon maximal possible : ${controle.rayonMaxKm ?? 0} km.`}
            {controle.etat === "prise" && "zone prise : elle chevauche celle d'un autre client."}
            {controle.etat === "inconnue" && `à vérifier à la main (${controle.raison ?? "doute"}).`}
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>Supplément mensuel : </strong>
          {supplement > 0 ? `${supplement} € par mois (rayon de ${rayon} km, ${RAYON_INCLUS_KM} km inclus)` : "aucun (rayon inclus)"}
        </p>

        {peutReserver && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
            <input type="checkbox" name="verifiee" style={{ marginTop: 3 }} />
            <span>J&apos;ai vérifié que cette adresse correspond à la fiche Google Business (Maps). Obligatoire pour réserver.</span>
          </label>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="btn-ghost">Enregistrer</button>
          <button type="submit" formAction={geocoderZoneAction} className="btn-ghost">{actif ? "Recalculer" : "Géocoder"}</button>
          {peutGarder && <button type="submit" formAction={gardeZoneAction} disabled={autre}>Garder {GARDE_APRES_APPEL_JOURS} jours</button>}
          {peutReserver && <button type="submit" formAction={reserverZoneAction} disabled={autre}>Réserver</button>}
        </div>
        <p className="subtitle" style={{ margin: 0, fontSize: 12 }}>
          « Signé » réserve la zone, « En lancement » ou « Campagnes actives » la rend active, « Perdu » ou « En pause » la libère après 30 jours. Rien à faire à la main : le changement d&apos;étape suffit.
        </p>
      </form>
    </section>
  );
}
