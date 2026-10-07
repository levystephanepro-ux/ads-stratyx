import type { Metadata } from "next";
import Link from "next/link";
import "../artisans/artisans.css";
import "./legal.css";

export const metadata: Metadata = {
  title: "Politique de confidentialité · STRATYXMEDIA",
  description:
    "Comment STRATYXMEDIA collecte, utilise et protège les données personnelles de ses visiteurs et de ses clients.",
  robots: { index: true, follow: true },
};

/* ==================================================================
   ⚠️  MODÈLE À COMPLÉTER ET À FAIRE RELIRE

   Ce document est une trame technique fondée sur la pile réellement
   utilisée par Stratyx (Vercel, Supabase, Brevo, Stripe, Cal.com,
   Anthropic, API Google). Il n'a PAS valeur de conseil juridique.

   AVANT PUBLICATION :
   1. Remplacer toutes les valeurs entre [CROCHETS].
   2. Vérifier que la liste des sous-traitants correspond exactement
      aux outils en production. Retirer ceux qui ne servent pas.
   3. Vérifier les durées de conservation : elles doivent refléter
      votre pratique réelle, pas une intention.
   4. Faire relire par un professionnel du droit, en particulier la
      partie « clients » : quand vous accédez au compte publicitaire
      d'un client, vous agissez comme SOUS-TRAITANT pour son compte.
      Cela impose un contrat de sous-traitance (article 28 RGPD)
      distinct de cette politique.
   ================================================================== */

const EDITEUR = {
  raisonSociale: "STRATYXMEDIA (Stéphane LEVY)",
  formeJuridique: "entrepreneur individuel (micro-entreprise)",
  siret: "en cours d'attribution",
  adresse: "1, avenue des Anglais, 06400 Cannes",
  email: "contact@stratyxmedia.fr",
  telephone: "",
  directeur: "Stéphane LEVY",
};

const MAJ = "07/10/2026";

export default function ConfidentialitePage() {
  return (
    <main className="art legal">
      <header className="legal-hero">
        <a className="legal-retour" href="https://www.stratyxmedia.fr/">← Retour au site</a>
        <h1>Politique de confidentialité</h1>
        <p className="subtitle">
          Ce document explique quelles données nous collectons, pourquoi,
          combien de temps nous les gardons et comment vous pouvez en reprendre
          le contrôle.
        </p>
        <p className="legal-maj">Dernière mise à jour : {MAJ}</p>
      </header>

      <article className="legal-corps">
        {/* ------------------------------------------------------ 1 */}
        <section>
          <h2>1. Qui est responsable de vos données</h2>
          <p>
            Le responsable du traitement est {EDITEUR.raisonSociale},{" "}
            {EDITEUR.formeJuridique}, immatriculée sous le numéro{" "}
            {EDITEUR.siret}, dont le siège est situé {EDITEUR.adresse}.
          </p>
          <p>
            Directeur de la publication : {EDITEUR.directeur}
            <br />
            Contact : <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>
            {EDITEUR.telephone ? ` · ${EDITEUR.telephone}` : ""}
          </p>
          <p className="legal-note">
            Nous n&apos;avons pas désigné de délégué à la protection des données
            (DPO), cette désignation n&apos;étant pas obligatoire au regard de
            notre activité. Vos demandes sont traitées directement à
            l&apos;adresse ci-dessus.
          </p>
        </section>

        {/* ------------------------------------------------------ 2 */}
        <section>
          <h2>2. Les données que nous collectons</h2>

          <h3>Si vous prenez rendez-vous ou répondez à notre questionnaire de découverte</h3>
          <ul>
            <li>Votre nom, le nom de votre entreprise, votre email et votre téléphone</li>
            <li>Votre site et, si vous les indiquez, les identifiants de vos comptes publicitaires</li>
            <li>
              Vos réponses sur votre activité, vos clients, vos objectifs, votre
              budget et les chiffres que vous choisissez de partager
            </li>
            <li>Les notes prises pendant nos échanges</li>
          </ul>
          <p>
            <strong>Pourquoi :</strong> préparer notre échange, analyser votre
            situation et vous faire une proposition adaptée.
            <br />
            <strong>Base légale :</strong> les mesures précontractuelles prises à
            votre demande. Toutes les questions sont facultatives, sauf celles
            nécessaires pour vous recontacter.
          </p>

          <h3>Si vous remplissez le formulaire de vérification de zone</h3>
          <ul>
            <li>Votre nom</li>
            <li>Votre métier et votre commune principale d&apos;intervention</li>
            <li>Votre numéro de téléphone et votre adresse email</li>
            <li>
              Votre situation actuelle vis-à-vis de la publicité, si vous
              choisissez de la préciser
            </li>
          </ul>
          <p>
            <strong>Pourquoi :</strong> vous rappeler au sujet de la
            disponibilité de votre zone et de nos offres.
            <br />
            <strong>Base légale :</strong> votre consentement, recueilli par la
            case à cocher du formulaire.
          </p>

          <h3>Si vous devenez client</h3>
          <ul>
            <li>Vos informations de facturation et votre historique de commandes</li>
            <li>Vos identifiants de connexion à votre espace, le cas échéant</li>
            <li>
              Les données de vos comptes publicitaires que vous nous autorisez à
              consulter
            </li>
            <li>Nos échanges par email et les comptes rendus de rendez-vous</li>
          </ul>
          <p>
            <strong>Pourquoi :</strong> exécuter la prestation, vous facturer et
            respecter nos obligations comptables.
            <br />
            <strong>Base légale :</strong> l&apos;exécution du contrat qui nous
            lie, et nos obligations légales en matière de comptabilité.
          </p>

          <h3>Lors de votre visite sur le site</h3>
          <p>
            Des données techniques de connexion (adresse IP, type de navigateur,
            pages consultées) sont traitées pour assurer le fonctionnement et la
            sécurité du site. Des outils de mesure d&apos;audience ne sont
            déposés qu&apos;après votre accord, exprimé via le bandeau prévu à
            cet effet.
          </p>
        </section>

        {/* ------------------------------------------------------ 3 */}
        <section>
          <h2>3. Qui d&apos;autre y a accès</h2>
          <p>
            Nous ne vendons ni ne cédons vos données. Nous faisons appel à des
            prestataires techniques qui les traitent pour notre compte,
            uniquement dans la mesure nécessaire à leur mission :
          </p>
          <div className="legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prestataire</th>
                  <th>Rôle</th>
                  <th>Hébergement</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vercel</td>
                  <td>Hébergement du site et de l&apos;application</td>
                  <td>Hors UE</td>
                </tr>
                <tr>
                  <td>Supabase</td>
                  <td>Base de données et authentification</td>
                  <td>[RÉGION À PRÉCISER]</td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>Envoi des emails</td>
                  <td>Hors UE</td>
                </tr>
                <tr>
                  <td>Calendly</td>
                  <td>Prise de rendez-vous</td>
                  <td>Hors UE</td>
                </tr>
                <tr>
                  <td>Anthropic</td>
                  <td>Analyse assistée par intelligence artificielle</td>
                  <td>Hors UE</td>
                </tr>
                <tr>
                  <td>Google</td>
                  <td>
                    Accès aux données de vos campagnes et de votre référencement,
                    sur votre autorisation
                  </td>
                  <td>Hors UE</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Certains de ces prestataires sont établis en dehors de l&apos;Union
            européenne. Ces transferts sont encadrés par les garanties prévues
            par le règlement européen sur la protection des données, notamment
            les clauses contractuelles types de la Commission européenne ou les
            mécanismes d&apos;adéquation applicables.
          </p>
        </section>

        {/* ------------------------------------------------------ 4 */}
        <section>
          <h2>4. Intelligence artificielle</h2>
          <p>
            Nos analyses de campagnes s&apos;appuient sur un service
            d&apos;intelligence artificielle. Les données transmises se limitent
            aux statistiques de campagnes nécessaires à l&apos;analyse et, pour
            préparer une proposition, à vos réponses au questionnaire de découverte. Elles ne
            sont pas utilisées pour entraîner des modèles.
          </p>
          <p>
            Aucune décision produisant des effets juridiques n&apos;est prise de
            manière entièrement automatisée : toute recommandation est validée
            par une personne avant d&apos;être appliquée.
          </p>
        </section>

        {/* ------------------------------------------------------ 5 */}
        <section>
          <h2>5. Combien de temps nous les gardons</h2>
          <div className="legal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Donnée</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Demande de vérification de zone sans suite</td>
                  <td>3 ans à compter du dernier contact</td>
                </tr>
                <tr>
                  <td>Données client pendant la relation</td>
                  <td>Toute la durée du contrat</td>
                </tr>
                <tr>
                  <td>Données client après la fin du contrat</td>
                  <td>3 ans</td>
                </tr>
                <tr>
                  <td>Documents comptables et factures</td>
                  <td>10 ans (obligation légale)</td>
                </tr>
                <tr>
                  <td>Journaux techniques du site</td>
                  <td>12 mois</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------------------ 6 */}
        <section>
          <h2>6. Vos droits</h2>
          <p>Vous pouvez à tout moment :</p>
          <ul>
            <li>demander l&apos;accès aux données que nous détenons sur vous ;</li>
            <li>en demander la correction si elles sont inexactes ;</li>
            <li>en demander la suppression ;</li>
            <li>demander à ce que leur utilisation soit limitée ;</li>
            <li>vous opposer à leur utilisation ;</li>
            <li>en demander une copie dans un format réutilisable ;</li>
            <li>
              retirer votre consentement, sans que cela remette en cause ce qui a
              été fait avant.
            </li>
          </ul>
          <p>
            Une seule adresse pour tout cela :{" "}
            <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>. Nous
            répondons sous un mois. Une preuve d&apos;identité peut vous être
            demandée en cas de doute.
          </p>
          <p>
            Si notre réponse ne vous satisfait pas, vous pouvez saisir la
            Commission nationale de l&apos;informatique et des libertés (CNIL),
            3 place de Fontenoy, 75007 Paris —{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
              cnil.fr
            </a>
            .
          </p>
        </section>

        {/* ------------------------------------------------------ 7 */}
        <section>
          <h2>7. Sécurité</h2>
          <p>
            Les accès à nos bases sont restreints et journalisés, les échanges
            avec le site sont chiffrés, et les identifiants de connexion à vos
            comptes publicitaires sont stockés sous forme chiffrée. Aucun
            dispositif n&apos;étant infaillible, nous vous informerions sans
            délai en cas d&apos;incident vous concernant, conformément à nos
            obligations.
          </p>
        </section>

        {/* ------------------------------------------------------ 8 */}
        <section>
          <h2>8. Si vous êtes client : vos propres obligations</h2>
          <p>
            Lorsque nous accédons à vos comptes publicitaires, nous traitons des
            données pour votre compte et sur vos instructions. Un contrat de
            sous-traitance distinct encadre cette relation ; il vous est remis
            au démarrage de la prestation.
          </p>
          <p>
            De votre côté, vous restez responsable des données que vous
            collectez auprès de vos propres clients, notamment via les
            formulaires publicitaires : mentions d&apos;information, recueil du
            consentement et bandeau de votre site vous incombent.
          </p>
        </section>

        {/* ------------------------------------------------------ 9 */}
        <section>
          <h2>9. Modifications</h2>
          <p>
            Cette politique peut évoluer avec nos outils et notre activité. La
            date de mise à jour figure en haut de page. En cas de changement
            important concernant vos données, nous vous en informons directement.
          </p>
        </section>
      </article>

      <footer className="legal-pied">
        <a className="btn btn-ghost" href="https://www.stratyxmedia.fr/">Retour au site</a>
        <Link className="btn btn-ghost" href="/mentions-legales">Mentions légales</Link>
      </footer>
    </main>
  );
}
