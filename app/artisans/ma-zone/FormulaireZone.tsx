"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  METIERS,
  COMMUNES,
  etatZone,
  communesVoisines,
  type EtatZone,
} from "@/lib/zones";

/* ------------------------------------------------------------------
   app/artisans/ma-zone/FormulaireZone.tsx  —  version Web3Forms

   Aucun serveur, aucune variable d'environnement, aucun Brevo.
   La clé d'accès Web3Forms est PUBLIQUE par conception : elle ne
   permet que d'envoyer un message vers VOTRE boîte, rien d'autre.

   👉 UNE SEULE CHOSE À FAIRE : remplacer CLE_WEB3FORMS ci-dessous
      par la clé reçue par email lors de la création du formulaire.
   ------------------------------------------------------------------ */

const CLE_WEB3FORMS = "fb886207-fa1b-4f36-89d6-106e2422794b";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TEL = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

type Resultat = {
  etat: EtatZone;
  commune: string;
  metier: string;
  suggestions: string[];
};

export default function FormulaireZone() {
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [panne, setPanne] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPanne("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const lire = (cle: string) => String(data.get(cle) ?? "").trim();

    const metier = lire("metier");
    const commune = lire("commune");
    const nom = lire("nom");
    const telephone = lire("telephone");
    const email = lire("email");

    /* ----------------------------- Validation ----------------------------- */
    const err: Record<string, string> = {};
    if (!metier) err.metier = "Choisissez votre métier.";
    if (commune.length < 2) err.commune = "Indiquez votre commune principale.";
    if (nom.length < 2) err.nom = "Indiquez votre nom.";
    if (!RE_TEL.test(telephone)) {
      err.telephone = "Numéro non reconnu. Format attendu : 06 12 34 56 78.";
    }
    if (!RE_EMAIL.test(email)) err.email = "Adresse email non valide.";
    if (data.get("consentement") !== "on") {
      err.consentement = "Votre accord est nécessaire pour vous recontacter.";
    }

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    /* --------------------------- État de la zone -------------------------- */
    const etat = etatZone(metier, commune);

    /* ----------------------------- Envoi ---------------------------------- */
    setEnvoi(true);

    const charge = {
      access_key: CLE_WEB3FORMS,
      subject: `Zone ${etat.toUpperCase()} — ${metier} · ${commune}`,
      from_name: "Stratyx — Formulaire zone",
      replyto: email,
      botcheck: data.get("botcheck") ?? "",

      Metier: metier,
      Commune: commune,
      "Etat connu de la zone": etat,
      Nom: nom,
      Telephone: telephone,
      Email: email,
      Situation: lire("situation") || "non précisée",
      Recu_le: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
    };

    try {
      const reponse = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(charge),
      });
      const json = (await reponse.json()) as { success?: boolean };

      if (!reponse.ok || !json.success) {
        setPanne(
          "L'envoi n'a pas abouti. Merci de réessayer dans quelques minutes, ou de nous appeler directement."
        );
        setEnvoi(false);
        return;
      }
    } catch {
      setPanne(
        "L'envoi n'a pas abouti. Vérifiez votre connexion, ou appelez-nous directement."
      );
      setEnvoi(false);
      return;
    }

    setResultat({
      etat,
      commune,
      metier,
      suggestions: etat === "prise" ? communesVoisines(commune, metier) : [],
    });
    setEnvoi(false);
  }

  /* ------------------------- Écran de confirmation ------------------------- */
  if (resultat) {
    const { etat, commune, metier, suggestions } = resultat;

    const titre =
      etat === "prise"
        ? `La place ${metier.toLowerCase()} est déjà prise sur ${commune}.`
        : etat === "libre"
          ? `La place ${metier.toLowerCase()} est libre sur ${commune}.`
          : "Votre demande est bien enregistrée.";

    const detail =
      etat === "prise"
        ? "Nous préférons vous le dire tout de suite plutôt que vous faire attendre. Nous ne vous relancerons pas."
        : etat === "libre"
          ? "Nous vous rappelons sous 24 h ouvrées pour la bloquer et regarder vos chiffres ensemble. Aucun engagement à ce stade."
          : "Nous vérifions la disponibilité sur votre commune et nous vous répondons sous 24 h ouvrées — que la place soit libre ou non.";

    return (
      <div className="zone-reponse" role="status" aria-live="polite">
        <h2>{titre}</h2>
        <p>{detail}</p>

        {suggestions.length > 0 && (
          <div className="zone-suggestions">
            <h3>Communes voisines encore ouvertes</h3>
            <ul>
              {suggestions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="zone-aide">
              Si vous vous y déplacez, dites-le-nous : la place y est peut-être
              encore libre.
            </p>
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

      {/* Piège anti-robots imposé par Web3Forms : ne pas renommer */}
      <div className="zone-piege" aria-hidden="true">
        <label htmlFor="botcheck">Ne pas remplir</label>
        <input id="botcheck" name="botcheck" type="checkbox" tabIndex={-1} />
      </div>

      <div className="zone-champ">
        <label htmlFor="metier">Votre métier</label>
        <select id="metier" name="metier" defaultValue="">
          <option value="" disabled>
            Choisissez…
          </option>
          {METIERS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {erreurs.metier && <span className="zone-erreur">{erreurs.metier}</span>}
      </div>

      <div className="zone-champ">
        <label htmlFor="commune">Votre commune principale</label>
        <input
          id="commune"
          name="commune"
          type="text"
          list="communes"
          placeholder="Nice"
          autoComplete="address-level2"
        />
        <datalist id="communes">
          {COMMUNES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <span className="zone-aide">
          Celle où vous intervenez le plus, pas forcément celle de votre siège.
        </span>
        {erreurs.commune && <span className="zone-erreur">{erreurs.commune}</span>}
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
          {erreurs.telephone && (
            <span className="zone-erreur">{erreurs.telephone}</span>
          )}
        </div>

        <div className="zone-champ">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          {erreurs.email && <span className="zone-erreur">{erreurs.email}</span>}
        </div>
      </div>

      <div className="zone-champ">
        <label htmlFor="situation">Où en êtes-vous ? (facultatif)</label>
        <select id="situation" name="situation" defaultValue="">
          <option value="">Sans réponse</option>
          <option value="Jamais fait de publicité">
            Je n&apos;ai jamais fait de publicité
          </option>
          <option value="Essayé seul, sans résultat">
            J&apos;ai essayé seul, sans résultat
          </option>
          <option value="Campagnes en cours">
            J&apos;ai des campagnes qui tournent
          </option>
          <option value="Sur une plateforme de mise en relation">
            Je passe par une plateforme de mise en relation
          </option>
        </select>
      </div>

      <div className="zone-consentement">
        <input id="consentement" name="consentement" type="checkbox" />
        <label htmlFor="consentement">
          J&apos;accepte d&apos;être recontacté au sujet de ma zone. Mes
          coordonnées servent uniquement à cela et ne sont ni revendues, ni
          cédées. <Link href="/confidentialite">Politique de confidentialité</Link>
        </label>
      </div>
      {erreurs.consentement && (
        <span className="zone-erreur">{erreurs.consentement}</span>
      )}

      <button className="btn zone-submit" type="submit" disabled={envoi}>
        {envoi ? "Vérification en cours…" : "Vérifier ma zone"}
      </button>

      <p className="zone-aide zone-aide--final">
        Réponse sous 24 h ouvrées. Si la place est déjà prise, nous vous le
        disons et nous n&apos;insistons pas.
      </p>
    </form>
  );
}
