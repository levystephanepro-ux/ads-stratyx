import type { Metadata } from "next";
import Link from "next/link";
import "../artisans.css";
import "./formation.css";

export const metadata: Metadata = {
  title: "La formation — Comprendre et piloter sa publicité | Stratyx",
  description:
    "Six modules, une dizaine d'heures, une vingtaine de documents à garder. Google et Meta expliqués aux artisans, sans jargon. Alpes-Maritimes et Var.",
  robots: { index: true, follow: true },
};

/* ------------------------------------------------------------------
   À PERSONNALISER AVANT MISE EN LIGNE
   - PRIX : à remplir une fois l'échelle tarifaire arrêtée.
   - FAQ "financement" : la réponse écrite ici suppose que Stratyx
     n'a PAS de numéro de déclaration d'activité ni de Qualiopi.
     Si cela change, réécrire — mais ne jamais laisser entendre
     qu'un financement est possible tant qu'il ne l'est pas.
   ------------------------------------------------------------------ */
const PRIX = "—— €";

const MODULES = [
  {
    n: 1,
    titre: "Les bases",
    duree: "1 h",
    promesse:
      "Savoir d'où viennent vos clients aujourd'hui, et calculer ce que vous pouvez payer un appel sans perdre d'argent.",
    points: [
      "D'où viennent réellement vos 10 derniers chantiers",
      "Google ou Meta : lequel pour votre métier",
      "Les 5 façons de brûler son budget",
      "Le calcul du coût par appel maximum",
    ],
  },
  {
    n: 2,
    titre: "Google, en local",
    duree: "2 h 30",
    promesse:
      "Construire un compte qui ne diffuse qu'aux gens de votre secteur, sur les recherches qui font sonner le téléphone.",
    points: [
      "Comment organiser son compte sans se disperser",
      "Ne payer que pour les gens présents dans votre zone",
      "Les recherches qui rapportent, celles qui coûtent",
      "Bloquer « emploi », « formation », « tuto » et les autres",
      "Écrire une annonce qui donne envie d'appeler",
      "Fixer son budget à partir de ses chiffres, pas au hasard",
    ],
  },
  {
    n: 3,
    titre: "Meta, en local",
    duree: "2 h",
    promesse:
      "Savoir si Facebook et Instagram ont un sens pour votre métier — et comment tourner des vidéos qui marchent, au téléphone.",
    points: [
      "Quand Meta ne sert à rien : le savoir avant de payer",
      "Pourquoi trop cibler fait échouer une campagne",
      "Les 4 formats qui fonctionnent en artisanat",
      "Formulaire ou site : lequel selon votre façon de travailler",
      "Recontacter ceux qui vous connaissent déjà",
    ],
  },
  {
    n: 4,
    titre: "Savoir ce qui rapporte",
    duree: "1 h 30",
    promesse:
      "Compter les appels, pas les clics. Sans ça, tout le reste est de la décoration.",
    points: [
      "Suivre les appels, et ne compter que les vrais",
      "Découvrir combien d'appels vous ratez chaque semaine",
      "Pourquoi Google et Facebook annoncent plus que la réalité",
      "Les 4 seuls chiffres à regarder",
    ],
  },
  {
    n: 5,
    titre: "Les 20 minutes du lundi",
    duree: "1 h 30",
    promesse:
      "Une routine courte, à heure fixe, qui protège votre budget — et qui se conclut le plus souvent par « je ne touche à rien ».",
    points: [
      "L'ordre exact des vérifications",
      "Quand couper une recherche qui coûte, avec un seuil chiffré",
      "Quand monter le budget, quand s'abstenir",
      "Diagnostiquer en 5 points avant de couper quoi que ce soit",
      "Anticiper les saisons du 06 et du 83",
    ],
  },
  {
    n: 6,
    titre: "Gagner du temps",
    duree: "1 h",
    promesse:
      "Réduire la routine de moitié avec les bons outils, et savoir à partir de quand il vaut mieux déléguer.",
    points: [
      "Ce qu'un outil fait à votre place, et ce qu'il ne fera jamais",
      "Les 5 usages utiles quand on débute",
      "Le calcul : ce que votre pilotage vous coûte en heures",
      "Le test des 8 semaines pour décider sur un fait",
    ],
  },
];

const LIVRABLES = [
  "Le calculateur du coût par appel maximum",
  "Le tableau d'origine de vos 10 derniers clients",
  "La grille Google / Meta selon votre métier",
  "La fiche des 5 erreurs, à afficher",
  "L'audit express de votre compte en 10 points",
  "Le modèle de structure de compte, avec 4 exemples par métier",
  "Le générateur de mots-clés par croisement",
  "Les listes de mots-clés à bloquer : 119 de base, plus 8 métiers",
  "Le fichier prêt à importer dans Google",
  "La grille de rédaction d'annonces et 30 formulations qui marchent",
  "Le calculateur de budget et d'enchères",
  "Le modèle de campagne Meta",
  "10 scripts de vidéos à tourner au téléphone",
  "La grille de préparation et le suivi d'usure des vidéos",
  "La checklist d'installation du suivi des appels",
  "Le tableau de suivi hebdomadaire, avec calculs automatiques",
  "La checklist des 20 minutes, à imprimer",
  "L'arbre de décision : je coupe, je monte, je laisse",
  "Le guide de démarrage",
  "La fiche de décision des 8 semaines",
];

export default function FormationPage() {
  return (
    <main className="art form">
      {/* ---------------------------------------------------- HERO */}
      <header className="form-hero">
        <Link className="zone-retour" href="/artisans">
          ← Retour
        </Link>
        <span className="pill">Formation</span>
        <h1>Comprendre votre publicité avant de la payer.</h1>
        <p className="subtitle">
          Six modules, une dizaine d&apos;heures, une vingtaine de documents que
          vous gardez. Google et Meta expliqués comme on parle sur un chantier :
          sans sigle, sans anglais, avec des chiffres qui sont les vôtres.
        </p>
        <div className="art-cta">
          <Link className="btn" href="/artisans/ma-zone">
            Nous en parler
          </Link>
          <a className="btn btn-ghost" href="#programme">
            Voir le programme
          </a>
        </div>
        <p className="art-note">
          Accès à vie · mises à jour comprises · {PRIX}
        </p>
      </header>

      {/* ------------------------------------------------- POUR QUI */}
      <section className="art-section">
        <h2>À qui ça s&apos;adresse</h2>
        <div className="art-grid">
          <article className="card">
            <h3>Vous n&apos;avez jamais essayé</h3>
            <p>
              Vous voulez comprendre avant de dépenser. La formation vous évite
              les quatre erreurs qui coûtent le plus cher, dès le premier euro.
            </p>
          </article>
          <article className="card">
            <h3>Vous avez essayé et perdu de l&apos;argent</h3>
            <p>
              C&apos;est le cas le plus fréquent. Dans presque tous les comptes,
              l&apos;argent part au même endroit — et ce sont des réglages, pas
              une fatalité.
            </p>
          </article>
          <article className="card">
            <h3>Quelqu&apos;un s&apos;en occupe pour vous</h3>
            <p>
              Vous voulez savoir si le travail est bien fait et poser les bonnes
              questions. Après le module 4, vous saurez lire n&apos;importe quel
              rapport.
            </p>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------ PROGRAMME */}
      <section className="art-section" id="programme">
        <h2>Le programme</h2>
        <p className="art-lead">
          Chaque leçon suit la même trame : un cas concret, la règle, une
          démonstration à l&apos;écran, une seule action à faire, un document à
          garder.
        </p>

        <div className="form-modules">
          {MODULES.map((m) => (
            <details key={m.n} className="form-module">
              <summary>
                <span className="form-module-num">{m.n}</span>
                <span className="form-module-titre">
                  {m.titre}
                  <span className="form-module-duree">{m.duree}</span>
                </span>
              </summary>
              <div className="form-module-corps">
                <p className="form-module-promesse">{m.promesse}</p>
                <ul>
                  {m.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ LIVRABLES */}
      <section className="art-section art-section--accent">
        <h2>Ce que vous gardez</h2>
        <p className="art-lead">
          La vidéo se regarde une fois. Les documents servent tous les mois.
          Calculateurs, checklists, modèles à remplir : ils restent à vous, même
          si vous ne prenez jamais rien d&apos;autre chez nous.
        </p>
        <ul className="form-livrables">
          {LIVRABLES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------- FRANC */}
      <section className="art-section art-section--franc">
        <h2>Ce que cette formation ne fait pas</h2>
        <ul className="art-non">
          <li>
            <strong>Elle ne vous rendra pas expert.</strong> Elle vous rend
            capable de piloter votre propre publicité correctement. C&apos;est
            différent, et c&apos;est suffisant.
          </li>
          <li>
            <strong>Elle ne supprime pas le travail.</strong> Comptez 20 minutes
            par semaine, indéfiniment. Si vous savez déjà que vous ne les aurez
            pas, dites-le-nous : la délégation vous coûtera moins cher.
          </li>
          <li>
            <strong>Elle ne promet pas de résultat.</strong> Personne ne peut
            promettre un nombre de chantiers. Ce qu&apos;elle garantit, c&apos;est
            que vous saurez si votre publicité rapporte — et beaucoup
            d&apos;artisans ne le savent pas.
          </li>
          <li>
            <strong>Elle ne sert à rien si vous ne décrochez pas.</strong> La
            publicité fait sonner le téléphone. Si personne ne répond en
            journée, réglez ça d&apos;abord.
          </li>
        </ul>
      </section>

      {/* ----------------------------------------------------- FAQ */}
      <section className="art-section">
        <h2>Les questions qu&apos;on nous pose</h2>
        <div className="art-faq">
          <details>
            <summary>Combien de temps pour tout faire ?</summary>
            <p>
              Une dizaine d&apos;heures de vidéo, à votre rythme. La plupart des
              artisans étalent sur trois à quatre semaines, un module par
              semaine, en faisant l&apos;exercice entre deux.
            </p>
          </details>
          <details>
            <summary>Je ne suis pas à l&apos;aise avec l&apos;informatique.</summary>
            <p>
              Tout est montré à l&apos;écran, clic par clic. Les calculs se font
              dans des fichiers déjà préparés : vous remplissez les cases
              jaunes, le reste se calcule seul.
            </p>
          </details>
          <details>
            <summary>Est-ce que c&apos;est finançable ?</summary>
            <p>
              Non, pas aujourd&apos;hui. Un financement par un fonds de formation
              suppose des agréments que nous n&apos;avons pas encore. Nous
              préférons vous le dire plutôt que vous laisser espérer un
              remboursement qui n&apos;arrivera pas.
            </p>
          </details>
          <details>
            <summary>Faut-il déjà avoir un compte publicitaire ?</summary>
            <p>
              Non. La création du compte fait partie du module 2. Si vous en
              avez déjà un, l&apos;audit du module 1 vous dira ce qu&apos;il faut y
              corriger.
            </p>
          </details>
          <details>
            <summary>Et si finalement je préfère déléguer ?</summary>
            <p>
              C&apos;est une conclusion fréquente, et c&apos;est prévu : le dernier
              module contient le calcul qui permet de trancher, en heures et en
              euros. Nous ne prenons qu&apos;un artisan par métier et par commune —
              vérifiez d&apos;abord que votre zone est libre.
            </p>
          </details>
          <details>
            <summary>Le programme évolue-t-il ?</summary>
            <p>
              Oui. Google et Facebook changent leurs interfaces plusieurs fois
              par an ; les démonstrations sont refaites en conséquence. Les
              mises à jour sont comprises.
            </p>
          </details>
        </div>
      </section>

      {/* ---------------------------------------------- CTA FINALE */}
      <section className="art-final">
        <h2>Apprendre, ou confier ?</h2>
        <p>
          Dans les deux cas, ça commence par la même question : votre zone
          est-elle encore libre ? Réponse sous 24 h, sans engagement.
        </p>
        <Link className="btn" href="/artisans/ma-zone">
          Vérifier ma zone
        </Link>
      </section>
    </main>
  );
}
