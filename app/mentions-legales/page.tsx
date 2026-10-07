import type { Metadata } from "next";
import Link from "next/link";
import "../artisans/artisans.css";
import "../confidentialite/legal.css";

export const metadata: Metadata = {
  title: "Mentions légales · STRATYXMEDIA",
  description: "Mentions légales de l'application STRATYXMEDIA (app.stratyxmedia.fr).",
  robots: { index: true, follow: true },
};

const EDITEUR = {
  nom: "STRATYXMEDIA",
  personne: "Stéphane LEVY",
  statut: "entrepreneur individuel exerçant sous le régime de la micro-entreprise",
  siret: "en cours d'attribution",
  adresse: "1, avenue des Anglais, 06400 Cannes, France",
  email: "contact@stratyxmedia.fr",
  telephone: "",
  site: "app.stratyxmedia.fr",
};
const MAJ = "07/10/2026";

export default function MentionsLegalesPage() {
  return (
    <main className="art legal">
      <header className="legal-hero">
        <a className="legal-retour" href="https://www.stratyxmedia.fr/">← Retour au site</a>
        <h1>Mentions légales</h1>
        <p className="subtitle">
          En application des articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie
          numérique (LCEN), il est porté à la connaissance des utilisateurs et visiteurs du site {EDITEUR.site} les présentes
          mentions légales. L&apos;utilisation du site vaut acceptation des présentes mentions légales.
        </p>
        <p className="legal-maj">Dernière mise à jour : {MAJ}</p>
      </header>

      <article className="legal-corps">
        <section>
          <h2>Article 1. Éditeur du site</h2>
          <p>
            Le site {EDITEUR.site} est édité par {EDITEUR.personne}, {EDITEUR.statut}, sous le nom commercial {EDITEUR.nom},
            dont le siège est situé {EDITEUR.adresse}.
          </p>
          <p>
            SIRET : {EDITEUR.siret}.<br />
            TVA non applicable, article 293 B du Code général des impôts.<br />
            {EDITEUR.telephone && <>Téléphone : {EDITEUR.telephone}.<br /></>}
            Email : <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.<br />
            Directeur de la publication : {EDITEUR.personne}.
          </p>
        </section>

        <section>
          <h2>Article 2. Hébergement</h2>
          <p>
            Le site est hébergé par la société Vercel Inc., dont le siège social est situé 440 N Barranca Avenue #4133,
            Covina, CA 91723, États-Unis. Site web : <a href="https://vercel.com" target="_blank" rel="noreferrer">vercel.com</a>.
            Contact : privacy@vercel.com.
          </p>
          <p>Les données de l&apos;application sont stockées par la société Supabase Inc. (base de données).</p>
        </section>

        <section>
          <h2>Article 3. Disponibilité du site</h2>
          <p>
            {EDITEUR.nom} s&apos;efforce de maintenir le site accessible à tout moment, sans toutefois y être tenu par une
            obligation de résultat. L&apos;accès au site peut être interrompu, notamment pour des raisons de maintenance, de mise
            à jour ou pour tout autre motif technique, sans que la responsabilité de l&apos;éditeur puisse être engagée de ce fait.
          </p>
        </section>

        <section>
          <h2>Article 4. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des contenus du site (textes, images, logos, mises en page, code) et des documents qu&apos;il produit
            (rapports, audits, propositions) est la propriété exclusive de {EDITEUR.nom}, sauf mention contraire, et est protégé
            par le Code de la propriété intellectuelle.
          </p>
          <p>
            Aucun de ces éléments ne peut être copié, reproduit, diffusé, exploité ou modifié, en tout ou partie, sans
            l&apos;accord préalable et écrit de {EDITEUR.nom}, à l&apos;exception des documents remis à un client pour son propre
            usage. Tout usage non autorisé est susceptible de constituer une contrefaçon engageant la responsabilité civile et
            pénale de son auteur (articles L.335-2 et suivants du Code de la propriété intellectuelle).
          </p>
        </section>

        <section>
          <h2>Article 5. Données personnelles</h2>
          <p>
            Les données à caractère personnel collectées sur le site, notamment via le questionnaire de découverte et la prise
            de rendez-vous, sont traitées par {EDITEUR.personne} ({EDITEUR.nom}), en qualité de responsable de traitement, dans le
            respect du Règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et de la loi Informatique et Libertés du 6 janvier 1978
            modifiée.
          </p>
          <p>
            Ces données sont collectées aux fins de préparation des échanges, d&apos;élaboration de propositions commerciales et
            de gestion de la relation client. Elles ne sont ni vendues ni cédées à des tiers.
          </p>
          <p>
            Conformément à la réglementation applicable, tout utilisateur dispose d&apos;un droit d&apos;accès, de rectification,
            d&apos;effacement, de limitation, d&apos;opposition et de portabilité de ses données. Ces droits peuvent être exercés
            en écrivant à <a href={`mailto:${EDITEUR.email}`}>{EDITEUR.email}</a>.
          </p>
          <p>
            Le détail des données collectées, des prestataires et des durées de conservation figure dans la{" "}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
          <p>
            En cas de difficulté, l&apos;utilisateur peut introduire une réclamation auprès de la Commission Nationale de
            l&apos;Informatique et des Libertés (CNIL) : <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">www.cnil.fr</a>.
          </p>
        </section>

        <section>
          <h2>Article 6. Cookies</h2>
          <p>
            Le site n&apos;utilise ni cookie publicitaire ni outil de mesure d&apos;audience. Seuls des cookies techniques,
            nécessaires à la connexion à l&apos;espace privé et à son bon fonctionnement, peuvent être déposés. Ils ne
            nécessitent pas de consentement préalable.
          </p>
        </section>

        <section>
          <h2>Article 7. Droit applicable</h2>
          <p>
            Le site et ses mentions légales sont régis par le droit français. Tout différend relatif à leur interprétation ou à
            leur exécution relèvera, à défaut d&apos;accord amiable, de la compétence exclusive des juridictions françaises.
          </p>
        </section>
      </article>

      <footer className="legal-pied">
        <a className="btn btn-ghost" href="https://www.stratyxmedia.fr/">Retour au site</a>
      </footer>
    </main>
  );
}
