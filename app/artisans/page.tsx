import type { Metadata } from "next";
import Link from "next/link";
import "./artisans.css";

export const metadata: Metadata = {
  title: "Stratyx — Un seul artisan par métier et par zone",
  description:
    "Publicité Google installée et pilotée pour les artisans des Alpes-Maritimes et du Var. Une seule place par métier et par commune. Audit de votre zone gratuit.",
  robots: { index: true, follow: true },
};

/* ------------------------------------------------------------------
   À PERSONNALISER AVANT MISE EN LIGNE
   - PRIX_FORMATION / PRIX_COPILOTE : à remplir une fois l'échelle
     tarifaire arrêtée.
   - ZONES : brancher sur le suivi d'exclusivité (Notion) ou éditer
     à la main. Ne laissez jamais une zone affichée "libre" si elle
     ne l'est pas : c'est la promesse centrale de la page.
   ------------------------------------------------------------------ */
const PRIX_FORMATION = "—— €";
const PRIX_COPILOTE = "—— € / mois";

const ZONES = [
  { commune: "Nice", metier: "Plomberie", libre: true },
  { commune: "Nice", metier: "Électricité", libre: false },
  { commune: "Cagnes-sur-Mer", metier: "Plomberie", libre: true },
  { commune: "Antibes", metier: "Menuiserie", libre: true },
  { commune: "Saint-Laurent-du-Var", metier: "Couverture", libre: true },
  { commune: "Cannes", metier: "Paysagisme", libre: false },
];

export default function ArtisansPage() {
  return (
    <main className="art">
      {/* ---------------------------------------------------- HERO */}
      <header className="art-hero">
        <span className="pill">Alpes-Maritimes · Var</span>
        <h1>
          Un seul artisan par métier
          <br />
          et par zone.
        </h1>
        <p className="subtitle">
          Nous installons et pilotons votre publicité Google pour que les
          habitants de votre secteur vous trouvent en premier. Une seule place
          par métier et par commune. Quand elle est prise, elle est prise.
        </p>
        <div className="art-cta">
          <Link className="btn" href="/artisans/ma-zone">
            Voir si ma zone est libre
          </Link>
          <Link className="btn btn-ghost" href="/demo">
            Voir un audit en 2 minutes
          </Link>
        </div>
        <p className="art-note">
          Audit de zone gratuit · sans engagement · réponse sous 24 h
        </p>
      </header>

      {/* ------------------------------------------------- PROBLÈME */}
      <section className="art-section">
        <h2>Aujourd'hui, vos clients viennent d'où ?</h2>
        <p className="art-lead">
          Chez la plupart des artisans que nous rencontrons, la réponse tient en
          trois lignes — et deux d'entre elles posent problème.
        </p>

        <div className="art-grid">
          <article className="card">
            <h3>Le bouche-à-oreille</h3>
            <p>
              Excellent, gratuit, et impossible à accélérer. Quand l'agenda se
              vide, il ne se remplit pas sur commande.
            </p>
          </article>
          <article className="card">
            <h3>Les plateformes de mise en relation</h3>
            <p>
              Elles vous apportent des chantiers et prennent une commission sur
              chacun. Le jour où elles augmentent leur taux, vous travaillez
              autant et vous gagnez moins. Vous ne décidez de rien.
            </p>
          </article>
          <article className="card">
            <h3>La publicité que vous pilotez</h3>
            <p>
              Le seul canal où vous fixez le budget, la zone et le volume. C'est
              aussi le seul que la plupart des artisans n'exploitent pas, ou
              perdent de l'argent en essayant seuls.
            </p>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------- EXCLUSIVITÉ */}
      <section className="art-section art-section--accent">
        <h2>Pourquoi une seule place par zone</h2>
        <p className="art-lead">
          Sur Google, deux plombiers de la même ville qui font de la publicité
          sur les mêmes recherches ne se partagent pas les clients : ils font
          monter le prix du clic l'un pour l'autre. Le seul gagnant est Google.
        </p>
        <p className="art-lead">
          C'est pour ça que nous ne prenons qu'un artisan par métier et par
          zone. Ce n'est pas un argument commercial, c'est une condition pour
          que votre budget serve à quelque chose.
        </p>

        <div className="art-zones">
          <div className="art-zones-head">
            <h3>Zones actuellement ouvertes</h3>
            <span className="art-note">Mis à jour manuellement</span>
          </div>
          <ul>
            {ZONES.map((z) => (
              <li key={`${z.commune}-${z.metier}`} className={z.libre ? "libre" : "prise"}>
                <span className="art-zone-metier">{z.metier}</span>
                <span className="art-zone-commune">{z.commune}</span>
                <span className="art-zone-etat">
                  {z.libre ? "Libre" : "Réservée"}
                </span>
              </li>
            ))}
          </ul>
          <Link className="btn" href="/artisans/ma-zone">
            Vérifier ma commune et mon métier
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------ DEUX VOIES */}
      <section className="art-section">
        <h2>Deux façons de s'y prendre</h2>
        <p className="art-lead">
          Certains veulent comprendre et garder la main. D'autres veulent que ce
          soit réglé. Les deux se défendent.
        </p>

        <div className="art-offres">
          <article className="card art-offre">
            <span className="pill">Vous pilotez</span>
            <h3>La formation</h3>
            <p className="art-prix">{PRIX_FORMATION}</p>
            <ul>
              <li>6 modules, environ 10 heures</li>
              <li>Google et Meta, expliqués sans jargon</li>
              <li>14 documents à remplir et à garder</li>
              <li>Le calcul de ce que vous pouvez payer un appel</li>
              <li>La routine de 20 minutes par semaine</li>
            </ul>
            <p className="art-offre-note">
              Vous repartez avec un compte qui fonctionne, même si vous ne
              prenez jamais rien d'autre chez nous.
            </p>
            <Link className="btn btn-ghost" href="/artisans/formation">
              Voir le programme
            </Link>
          </article>

          <article className="card art-offre art-offre--reco">
            <span className="pill">Nous pilotons</span>
            <h3>Le Copilote</h3>
            <p className="art-prix">{PRIX_COPILOTE}</p>
            <ul>
              <li>Installation complète de vos campagnes</li>
              <li>Suivi des appels, pour savoir ce qui rapporte</li>
              <li>Audit automatique tous les matins</li>
              <li>Un point mensuel, en français, sans tableau illisible</li>
              <li>Votre zone réservée pendant toute la durée</li>
            </ul>
            <p className="art-offre-note">
              Vous décrochez le téléphone. Nous nous occupons du reste.
            </p>
            <Link className="btn" href="/artisans/ma-zone">
              Voir si ma zone est libre
            </Link>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------- DÉMO */}
      <section className="art-section art-section--demo">
        <h2>Ce qu'un audit trouve, concrètement</h2>
        <p className="art-lead">
          Voici l'audit réel d'un compte de plomberie à Nice. Six problèmes,
          trouvés en une matinée. Ils sont les mêmes chez presque tout le monde.
        </p>
        <ul className="art-findings">
          <li>
            <strong>47 mots-clés</strong> qui déclenchaient des annonces sur
            « plombier emploi », « formation plomberie », « plombier salaire »
          </li>
          <li>
            <strong>Aucun bouton d'appel</strong> — les clients ne pouvaient pas
            appeler en un geste depuis leur téléphone
          </li>
          <li>
            <strong>Zone trop large</strong> — des clics payés à Toulon et à
            Marseille
          </li>
          <li>
            <strong>Aucun suivi des appels</strong> — Google optimisait sans
            savoir ce qui faisait sonner le téléphone
          </li>
        </ul>
        <Link className="btn" href="/demo">
          Voir l'audit complet
        </Link>
      </section>

      {/* ------------------------------------------------- DÉROULÉ */}
      <section className="art-section">
        <h2>Comment ça commence</h2>
        <ol className="art-steps">
          <li>
            <span className="art-step-num">1</span>
            <div>
              <h3>Vous vérifiez votre zone</h3>
              <p>
                Vous indiquez votre métier et votre commune. Nous vous disons
                sous 24 h si la place est libre. Si elle est prise, nous vous le
                disons aussi — et nous ne vous relançons pas.
              </p>
            </div>
          </li>
          <li>
            <span className="art-step-num">2</span>
            <div>
              <h3>On regarde vos chiffres ensemble</h3>
              <p>
                Trente minutes au téléphone ou en visio. Panier moyen, zone
                d'intervention, capacité à décrocher. À la fin, vous savez ce
                que vous pouvez payer un appel sans perdre d'argent — que vous
                travailliez avec nous ou non.
              </p>
            </div>
          </li>
          <li>
            <span className="art-step-num">3</span>
            <div>
              <h3>Vous choisissez</h3>
              <p>
                Apprendre à le faire, ou nous le confier. Sans engagement de
                durée dans les deux cas.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* ------------------------------------------------ PAS POUR */}
      <section className="art-section art-section--franc">
        <h2>Ce n'est pas pour vous si…</h2>
        <ul className="art-non">
          <li>
            <strong>Vous ne pouvez pas décrocher en journée.</strong> La
            publicité fait sonner le téléphone. Si personne ne répond, vous
            payez pour offrir vos clients au concurrent suivant. Réglez ça
            d'abord — nous vous le dirons franchement.
          </li>
          <li>
            <strong>Votre agenda est déjà plein sur six mois.</strong> Vous
            n'avez pas besoin de nous. Revenez quand ça se calmera.
          </li>
          <li>
            <strong>Vous cherchez des résultats la semaine prochaine.</strong>{" "}
            Sur du dépannage urgent, le téléphone peut sonner vite. Sur de la
            rénovation, comptez deux à trois mois avant de juger.
          </li>
          <li>
            <strong>Vous voulez le budget publicitaire le plus bas possible.</strong>{" "}
            En dessous d'un certain seuil, une campagne ne sort pas assez
            souvent pour produire quoi que ce soit. Mieux vaut couvrir un
            quartier correctement que tout un département à moitié.
          </li>
        </ul>
      </section>

      {/* ----------------------------------------------------- FAQ */}
      <section className="art-section">
        <h2>Les questions qu'on nous pose</h2>
        <div className="art-faq">
          <details>
            <summary>J'ai déjà essayé Google Ads et j'ai perdu de l'argent.</summary>
            <p>
              C'est le cas le plus fréquent. Dans presque tous les comptes que
              nous ouvrons, l'argent est parti dans quatre choses : une zone trop
              large, des mots-clés trop généraux, aucune exclusion, et aucun
              suivi des appels. Ce sont des réglages, pas une fatalité.
            </p>
          </details>
          <details>
            <summary>Je n'ai pas de site internet.</summary>
            <p>
              Ce n'est pas bloquant pour du dépannage : l'essentiel des appels
              vient directement de l'annonce. Pour un métier de projet
              (rénovation, cuisine, piscine), un site simple devient utile. Nous
              vous le dirons avant de commencer, pas après.
            </p>
          </details>
          <details>
            <summary>Combien faut-il mettre en publicité ?</summary>
            <p>
              Ça ne se choisit pas au hasard : ça se calcule à partir de votre
              panier moyen, de votre marge et du nombre d'appels qui deviennent
              des chantiers. Nous faisons ce calcul avec vous au premier
              rendez-vous, et vous repartez avec le chiffre même si vous ne
              donnez pas suite.
            </p>
          </details>
          <details>
            <summary>Je suis déjà sur une plateforme de mise en relation.</summary>
            <p>
              Vous pouvez garder les deux. La différence est simple : sur une
              plateforme, vous payez une commission sur chaque chantier, sans
              limite. Ici, vous payez un budget que vous fixez, et le client est
              à vous.
            </p>
          </details>
          <details>
            <summary>Et si ma zone est déjà prise ?</summary>
            <p>
              Nous vous le disons tout de suite, et nous n'insistons pas. Nous
              pouvons regarder une commune voisine si vous vous y déplacez, ou
              vous prévenir si la place se libère — uniquement si vous nous le
              demandez.
            </p>
          </details>
          <details>
            <summary>Je peux arrêter quand je veux ?</summary>
            <p>
              Oui, sans engagement de durée. Votre compte publicitaire reste le
              vôtre : si vous partez, vous repartez avec.
            </p>
          </details>
        </div>
      </section>

      {/* ---------------------------------------------- CTA FINALE */}
      <section className="art-final">
        <h2>Votre zone est peut-être encore libre.</h2>
        <p>
          Dites-nous votre métier et votre commune. Réponse sous 24 h, sans
          engagement.
        </p>
        <Link className="btn" href="/artisans/ma-zone">
          Vérifier ma zone
        </Link>
      </section>
    </main>
  );
}
