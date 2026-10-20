"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ACTIVITES_CHOIX, ACTIVITE_AUTRE, AUTRE_ACTIVITE_MAX, AUTRE_ACTIVITE_MIN, DESCRIPTION_MAX, PANIER_MAX_EUR, PANIER_MIN_EUR,
  PRIX_ZONE_SUPP_MOIS, RAYONS_PROPOSES, RAYON_INCLUS_KM, expressionPlace, type EtatZone,
} from "@/lib/zones";
import { validerAutreActivite } from "@/lib/zone-validation";

/* ------------------------------------------------------------------
   app/zone/FormulaireZone.tsx

   Le contrôle se fait côté serveur (POST /api/zone/check) : le navigateur
   ne reçoit que l'état, le rayon possible et des noms de communes voisines.
   Jamais la table des zones, ni l'adresse d'un client.
   ------------------------------------------------------------------ */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TEL = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

type Reponse = {
  etat: EtatZone;
  rayonMaxKm?: number;
  suggestions: string[];
  indicatif: boolean;
  supplement: number;
  demandeId?: string;
  /** Message du serveur pour « Autre activité ». */
  message?: string;
};

type Resultat = Reponse & { activite: string; rayonKm: number };

export default function FormulaireZone() {
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [panne, setPanne] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [attente, setAttente] = useState<"non" | "envoi" | "ok" | "echec">("non");
  const [propositions, setPropositions] = useState<string[]>([]);
  const [activiteChoisie, setActiviteChoisie] = useState("");
  const autre = activiteChoisie === ACTIVITE_AUTRE.id;
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  /* Autocomplétion de l'adresse via l'API Adresse (publique, sans clé). */
  function chercherAdresse(valeur: string) {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (valeur.trim().length < 4) {
      setPropositions([]);
      return;
    }
    minuteur.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(valeur.trim())}&limit=5&autocomplete=1`
        );
        if (!res.ok) return;
        const json = (await res.json()) as { features?: { properties?: { label?: string } }[] };
        setPropositions((json.features ?? []).map((f) => f.properties?.label ?? "").filter(Boolean));
      } catch {
        setPropositions([]);
      }
    }, 250);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPanne("");

    const data = new FormData(event.currentTarget);
    const lire = (cle: string) => String(data.get(cle) ?? "").trim();

    const activite = lire("activite");
    const adresse = lire("adresse");
    const rayonKm = Number(lire("rayon"));
    const nom = lire("nom");
    const telephone = lire("telephone");
    const email = lire("email");

    /* ----------------------------- Validation ----------------------------- */
    const err: Record<string, string> = {};
    if (!activite) err.activite = "Choisissez votre activité.";
    if (activite === ACTIVITE_AUTRE.id) {
      const r = validerAutreActivite({ autreActivite: lire("autreActivite"), panierMoyen: lire("panierMoyen"), description: lire("description") });
      if (!r.ok) Object.assign(err, r.erreurs);
    }
    if (adresse.length < 5) err.adresse = "Indiquez l'adresse de votre établissement.";
    if (!rayonKm) err.rayon = "Choisissez un rayon.";
    if (nom.length < 2) err.nom = "Indiquez votre nom.";
    if (!RE_TEL.test(telephone)) err.telephone = "Numéro non reconnu. Format attendu : 06 12 34 56 78.";
    if (!RE_EMAIL.test(email)) err.email = "Adresse email non valide.";
    if (data.get("consentement") !== "on") err.consentement = "Votre accord est nécessaire pour vous recontacter.";

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    /* ----------------------------- Envoi ---------------------------------- */
    setEnvoi(true);
    try {
      const res = await fetch("/api/zone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activite, adresse, rayonKm, nom, telephone, email,
          situation: lire("situation"),
          ...(activite === ACTIVITE_AUTRE.id
            ? { autreActivite: lire("autreActivite"), panierMoyen: lire("panierMoyen"), description: lire("description") }
            : {}),
          consentement: true,
          site_web: lire("site_web"),
        }),
      });
      if (res.status === 429) {
        setPanne("Trop de demandes pour le moment. Réessayez dans une heure, ou appelez-nous directement.");
      } else if (res.status === 400) {
        const j = (await res.json()) as { erreurs?: Record<string, string> };
        setErreurs(j.erreurs ?? {});
      } else if (!res.ok) {
        setPanne("L'envoi n'a pas abouti. Merci de réessayer dans quelques minutes, ou de nous appeler directement.");
      } else {
        const j = (await res.json()) as Reponse;
        setResultat({ ...j, activite, rayonKm });
      }
    } catch {
      setPanne("L'envoi n'a pas abouti. Vérifiez votre connexion, ou appelez-nous directement.");
    }
    setEnvoi(false);
  }

  async function rejoindreAttente(demandeId: string) {
    setAttente("envoi");
    try {
      const res = await fetch("/api/zone/attente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandeId }),
      });
      setAttente(res.ok ? "ok" : "echec");
    } catch {
      setAttente("echec");
    }
  }

  /* ------------------------- Écran de réponse ------------------------------ */
  if (resultat) {
    const { etat, activite, rayonKm, rayonMaxKm, suggestions, indicatif, supplement, demandeId, message } = resultat;
    // Libellé court de l'activité (« de plombier »), distinct du libellé complet du menu.
    const place = expressionPlace(activite);

    const titre =
      etat === "libre"
        ? indicatif
          ? `La place ${place} semble libre autour de cette adresse.`
          : `La place ${place} est libre dans un rayon de ${rayonKm} km autour de votre établissement.`
        : etat === "partielle"
          ? `La place ${place} est libre jusqu'à ${rayonMaxKm ?? "quelques"} km autour de votre établissement.`
          : etat === "prise"
            ? `La place ${place} est déjà prise autour de votre établissement.`
            : "Votre demande est bien enregistrée.";

    const detail = message ? message :
      etat === "libre"
        ? "Nous vous rappelons sous 24 h ouvrées pour la bloquer et regarder vos chiffres ensemble. Aucun engagement à ce stade."
        : etat === "partielle"
          ? `Vous aviez demandé ${rayonKm} km. Nous pouvons réserver un rayon plus réduit : dites-le-nous au téléphone, ou inscrivez-vous sur la liste d'attente pour le rayon complet.`
          : etat === "prise"
            ? "Nous préférons vous le dire tout de suite plutôt que vous faire attendre. Vous pouvez vous inscrire sur la liste d'attente : nous vous prévenons si la place se libère."
            : "Nous vérifions la disponibilité autour de votre établissement et nous vous répondons sous 24 h ouvrées, que la place soit libre ou non.";

    return (
      <div className="zone-reponse" role="status" aria-live="polite">
        <h2>{titre}</h2>
        <p>{detail}</p>

        {indicatif && etat !== "inconnue" && (
          <p className="zone-note">
            Résultat indicatif : l&apos;adresse saisie n&apos;est pas assez précise. Nous le confirmons avec
            l&apos;adresse exacte de votre établissement lors de notre rappel.
          </p>
        )}

        {supplement > 0 && etat !== "inconnue" && (
          <p className="zone-note">
            Un rayon de {rayonKm} km entraîne un supplément de {supplement} € par mois (rayon inclus : {RAYON_INCLUS_KM} km).
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="zone-suggestions">
            <h3>Communes voisines encore ouvertes</h3>
            <ul>
              {suggestions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="zone-aide">
              Si votre établissement est dans l&apos;une d&apos;elles, ou si vous vous y déplacez, dites-le-nous.
            </p>
          </div>
        )}

        {(etat === "prise" || etat === "partielle") && demandeId && (
          <div className="zone-suggestions">
            {attente === "ok" ? (
              <p>Vous êtes sur la liste d&apos;attente. Nous vous écrivons si la place se libère.</p>
            ) : (
              <button
                className="btn"
                type="button"
                onClick={() => rejoindreAttente(demandeId)}
                disabled={attente === "envoi"}
              >
                {attente === "envoi" ? "Inscription…" : "Me prévenir si la place se libère"}
              </button>
            )}
            {attente === "echec" && (
              <p className="zone-erreur">L&apos;inscription n&apos;a pas abouti. Réessayez, ou appelez-nous.</p>
            )}
          </div>
        )}

        <div className="zone-suite">
          <Link className="btn btn-ghost" href="/demo">
            Voir à quoi ressemble un audit
          </Link>
          <Link className="btn btn-ghost" href="/artisans">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  /* -------------------------------- Formulaire ------------------------------ */
  return (
    <form className="zone-form" onSubmit={onSubmit} noValidate>
      {panne && (
        <p className="zone-alerte" role="alert">
          {panne}
        </p>
      )}

      {/* Piège anti-robots : invisible pour les personnes, ignoré si vide. */}
      <div className="zone-piege" aria-hidden="true">
        <label htmlFor="site_web">Ne pas remplir</label>
        <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="zone-champ">
        <label htmlFor="activite">Votre secteur d&apos;activité</label>
        <select
          id="activite"
          name="activite"
          value={activiteChoisie}
          onChange={(e) => setActiviteChoisie(e.target.value)}
        >
          <option value="" disabled>
            Choisissez…
          </option>
          {ACTIVITES_CHOIX.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {erreurs.activite && <span className="zone-erreur">{erreurs.activite}</span>}
      </div>

      {autre && (
        <>
          <div className="zone-champ">
            <label htmlFor="autreActivite">Votre activité</label>
            <input
              id="autreActivite"
              name="autreActivite"
              type="text"
              minLength={AUTRE_ACTIVITE_MIN}
              maxLength={AUTRE_ACTIVITE_MAX}
              placeholder="Par exemple : paysagiste, spa, électricien auto"
            />
            {erreurs.autreActivite && <span className="zone-erreur">{erreurs.autreActivite}</span>}
          </div>

          <div className="zone-champ">
            <label htmlFor="panierMoyen">Panier moyen estimé, en euros</label>
            <input
              id="panierMoyen"
              name="panierMoyen"
              type="number"
              inputMode="decimal"
              min={PANIER_MIN_EUR}
              max={PANIER_MAX_EUR}
              step="any"
              placeholder="450"
            />
            {erreurs.panierMoyen && <span className="zone-erreur">{erreurs.panierMoyen}</span>}
          </div>

          <div className="zone-champ">
            <label htmlFor="description">Décrivez en une phrase ce que vous vendez (facultatif)</label>
            <input id="description" name="description" type="text" maxLength={DESCRIPTION_MAX} />
            {erreurs.description && <span className="zone-erreur">{erreurs.description}</span>}
          </div>
        </>
      )}

      <div className="zone-champ">
        <label htmlFor="adresse">Adresse de votre établissement</label>
        <input
          id="adresse"
          name="adresse"
          type="text"
          list="adresses"
          placeholder="12 rue de la République, 06000 Nice"
          autoComplete="street-address"
          onChange={(e) => chercherAdresse(e.target.value)}
        />
        <datalist id="adresses">
          {propositions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <span className="zone-aide">
          Celle de votre fiche Google Business. Avec la seule commune, le résultat reste indicatif.
        </span>
        {erreurs.adresse && <span className="zone-erreur">{erreurs.adresse}</span>}
      </div>

      <div className="zone-champ">
        <label htmlFor="rayon">Rayon souhaité autour de l&apos;établissement</label>
        <select id="rayon" name="rayon" defaultValue={String(RAYON_INCLUS_KM)}>
          {RAYONS_PROPOSES.map((r) => (
            <option key={r} value={r}>
              {r} km{r > RAYON_INCLUS_KM ? ` (supplément ${PRIX_ZONE_SUPP_MOIS} € par mois)` : " (inclus)"}
            </option>
          ))}
        </select>
        {erreurs.rayon && <span className="zone-erreur">{erreurs.rayon}</span>}
      </div>

      <div className="zone-champ">
        <label htmlFor="nom">Votre nom</label>
        <input id="nom" name="nom" type="text" autoComplete="name" />
        {erreurs.nom && <span className="zone-erreur">{erreurs.nom}</span>}
      </div>

      <div className="zone-duo">
        <div className="zone-champ">
          <label htmlFor="telephone">Téléphone</label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            inputMode="tel"
            placeholder="06 12 34 56 78"
            autoComplete="tel"
          />
          {erreurs.telephone && <span className="zone-erreur">{erreurs.telephone}</span>}
        </div>

        <div className="zone-champ">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" />
          {erreurs.email && <span className="zone-erreur">{erreurs.email}</span>}
        </div>
      </div>

      <div className="zone-champ">
        <label htmlFor="situation">Où en êtes-vous ? (facultatif)</label>
        <select id="situation" name="situation" defaultValue="">
          <option value="">Sans réponse</option>
          <option value="Jamais fait de publicité">Je n&apos;ai jamais fait de publicité</option>
          <option value="Essayé seul, sans résultat">J&apos;ai essayé seul, sans résultat</option>
          <option value="Campagnes en cours">J&apos;ai des campagnes qui tournent</option>
          <option value="Sur une plateforme de mise en relation">
            Je passe par une plateforme de mise en relation
          </option>
        </select>
      </div>

      <div className="zone-consentement">
        <input id="consentement" name="consentement" type="checkbox" />
        <label htmlFor="consentement">
          J&apos;accepte d&apos;être recontacté au sujet de ma zone. Mes coordonnées et l&apos;adresse de mon
          établissement servent uniquement à cela et ne sont ni revendues, ni cédées.{" "}
          <Link href="/confidentialite">Politique de confidentialité</Link>
        </label>
      </div>
      {erreurs.consentement && <span className="zone-erreur">{erreurs.consentement}</span>}

      <button className="btn zone-submit" type="submit" disabled={envoi}>
        {envoi ? "Vérification en cours…" : "Vérifier ma zone"}
      </button>

      <p className="zone-aide zone-aide--final">
        Réponse sous 24 h ouvrées. Si la place est déjà prise, nous vous le disons et nous n&apos;insistons pas.
      </p>
    </form>
  );
}
