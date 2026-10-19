import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { Icons } from "@/components/Icons";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    icon: "admin",
    title: "Connexion & Compte",
    items: [
      {
        q: "Comment créer un compte ?",
        a: "Va sur /register, entre ton email et un mot de passe (8 caractères minimum). Tu bénéficies de 14 jours d'essai gratuit, sans carte bancaire.",
      },
      {
        q: "Comment me connecter ?",
        a: "Va sur /login et entre tes identifiants. Tu es redirigé automatiquement vers le dashboard.",
      },
      {
        q: "Comment me déconnecter ?",
        a: "Clique sur « Déconnexion » en bas de la barre latérale gauche.",
      },
      {
        q: "Que se passe-t-il à la fin de l'essai ?",
        a: "Tu vois une bannière de rappel pendant 14 jours. À l'expiration, les pages sont bloquées et tu es redirigé vers la page Tarif pour activer ton abonnement.",
      },
    ],
  },
  {
    icon: "copilote",
    title: "Copilote IA",
    items: [
      {
        q: "À quoi sert le Copilote ?",
        a: "C'est un assistant conversationnel connecté à ton compte Google Ads. Tu peux lui demander d'analyser tes campagnes, d'identifier des problèmes, de proposer des optimisations ou de rédiger des annonces.",
      },
      {
        q: "Comment poser une question ?",
        a: "Va sur la page Copilote, tape ta question dans le champ en bas et appuie sur Entrée. Exemple : « Quelles campagnes ont le CPA le plus élevé ce mois-ci ? »",
      },
      {
        q: "Puis-je démarrer depuis un template ?",
        a: "Oui. Dans la page Templates, clique sur n'importe quel prompt : il s'ouvre directement dans le Copilote avec le texte pré-rempli.",
      },
      {
        q: "Le Copilote a-t-il accès à mes vraies données ?",
        a: "Oui si tu as connecté un compte Google Ads réel. En mode démo, il utilise des données fictives.",
      },
    ],
  },
  {
    icon: "agent",
    title: "Agent IA",
    items: [
      {
        q: "Qu'est-ce qu'un agent ?",
        a: "Un agent est une mission automatique que tu confies à l'IA : rapport de performance hebdomadaire, détection d'anomalies, résumé de campagne… Il s'exécute sans que tu aies à ouvrir l'application.",
      },
      {
        q: "Comment créer un agent ?",
        a: "Va sur Agent IA → clique « Nouvel agent ». Donne-lui un nom, un type de mission, un compte Google Ads cible et une fréquence (quotidien, hebdomadaire, manuel).",
      },
      {
        q: "Comment je reçois les rapports ?",
        a: "Les agents envoient leurs rapports par email. Configure l'adresse email de destination lors de la création de l'agent.",
      },
      {
        q: "Puis-je lancer un agent manuellement ?",
        a: "Oui. Dans la liste des agents, clique sur le bouton ▶ à côté de l'agent pour l'exécuter immédiatement.",
      },
    ],
  },
  {
    icon: "rapports",
    title: "Templates",
    items: [
      {
        q: "Qu'est-ce qu'un template ?",
        a: "Un template est un prompt Google Ads pré-rédigé et optimisé : audit de campagne, analyse de mots-clés, rédaction d'annonces, détection de gaspillage budget…",
      },
      {
        q: "Comment utiliser un template ?",
        a: "Va sur Templates, parcours les catégories et clique sur le template de ton choix. Il s'ouvre dans le Copilote avec le contexte de ton compte.",
      },
      {
        q: "Puis-je modifier un template ?",
        a: "Oui. Dans le Copilote, une fois le template chargé, tu peux modifier le texte avant d'envoyer.",
      },
    ],
  },
  {
    icon: "connexions",
    title: "Connexions",
    items: [
      {
        q: "Comment connecter mon compte Google Ads ?",
        a: "Ton compte Google Ads (MCC) est connecté via les variables d'environnement Vercel. Si tu vois « Connecté · données réelles » sur le dashboard, c'est bon.",
      },
      {
        q: "Comment connecter Google Search Console ?",
        a: "Va sur Connexions → section Google Search Console → clique « Connecter Search Console ». Tu es redirigé vers Google pour autoriser l'accès, puis renvoyé sur la page Connexions.",
      },
      {
        q: "Comment utiliser le connecteur MCP (Claude) ?",
        a: "Va sur Connexions → Connecteur Stratyx → affiche l'URL du connecteur. Copie cette URL, puis dans Claude : Réglages → Connecteurs → Ajouter un connecteur personnalisé. Colle l'URL et valide.",
      },
      {
        q: "Puis-je connecter Meta Ads ?",
        a: "Oui, via le MCP officiel Meta (gratuit). Va sur Connexions → section Meta Ads et suis les 5 étapes détaillées.",
      },
    ],
  },
  {
    icon: "persona",
    title: "Persona",
    items: [
      {
        q: "À quoi sert la page Persona ?",
        a: "Elle te permet de générer un portrait détaillé de ton client idéal (ICP) : démographie, motivations, freins, canaux préférés. Utile pour affiner tes campagnes et tes annonces.",
      },
      {
        q: "Comment créer un persona ?",
        a: "Va sur Persona, remplis les informations de base sur ton activité et ta cible, puis clique « Générer le persona ». L'IA produit un profil complet en quelques secondes.",
      },
    ],
  },
  {
    icon: "chart",
    title: "Search Console",
    items: [
      {
        q: "À quoi sert la page Search Console ?",
        a: "Elle affiche les données SEO de tes sites : requêtes de recherche, pages les plus vues, taux de clics et position moyenne dans Google.",
      },
      {
        q: "Pourquoi je vois des données de démo ?",
        a: "Si tu n'as pas encore connecté Google Search Console depuis la page Connexions, l'application affiche des données fictives pour te montrer le fonctionnement.",
      },
      {
        q: "Comment changer le site affiché ?",
        a: "Utilise le sélecteur de site en haut de la page Search Console pour choisir parmi les propriétés liées à ton compte GSC.",
      },
    ],
  },
  {
    icon: "layers",
    title: "Abonnement & Tarif",
    items: [
      {
        q: "Combien coûte ads·stratyx ?",
        a: "97 € / mois, sans engagement. 14 jours d'essai gratuit, sans carte bancaire.",
      },
      {
        q: "Comment passer Pro ?",
        a: "Va sur la page Tarif et clique « Nous contacter pour activer ». Un email est envoyé pour convenir du paiement. Ton accès est activé sous 24h.",
      },
      {
        q: "Comment résilier ?",
        a: "Contacte-nous par email. L'abonnement est mensuel sans engagement, résiliable à tout moment.",
      },
    ],
  },
];


// Guide de l'agence (visible seulement par le propriétaire) : les gestes du
// quotidien, dans l'ordre où on s'en sert. À tenir à jour quand un flux change.
const GUIDE: { title: string; steps: { t: string; d: string; href?: string }[] }[] = [
  {
    title: "Nouveau prospect",
    steps: [
      { t: "Le RDV arrive par Calendly", d: "Chaque matin, l'app importe les rendez-vous pris sur Calendly et crée une fiche client par nouvelle personne (nom, email, téléphone, site, réponses du formulaire). Tu reçois un email « Nouveau client Calendly ». Pour ne pas attendre le lendemain : Clients → « Importer mes RDV Calendly ».", href: "/clients" },
      { t: "Sinon, crée la fiche à la main", d: "Clients → nom de l'entreprise → Créer. Un client avec plusieurs activités ou plusieurs sites = une fiche par activité.", href: "/clients" },
      { t: "Choisis le parcours", d: "Sur la fiche, bloc « Onboarding (toi seul) » : Demandes locales (artisans), E-commerce ou Services et B2B, puis Enregistrer. Le parcours décide des questions envoyées au client (ex. boutique, livraison et réseaux pour l'e-commerce ; taux de signature et rappel des demandes pour les artisans et le B2B)." },
      { t: "Crée la data room", d: "Dans ton Google Drive : un dossier au nom du client, partagé en modification avec lui. Colle le lien dans « Lien du dossier partagé » sur la fiche. Sa page de questionnaire affiche alors « Déposez vos documents » avec la liste adaptée à son parcours (logo, photos, vidéos, documents commerciaux, avis…)." },
      { t: "Envoie le questionnaire", d: "Sur la fiche : « Copier le lien complet » (10–15 min) ou « Copier le lien court », à coller dans WhatsApp ou un email. « Voir ce que voit le client » pour vérifier avant d'envoyer." },
      { t: "Tu es prévenu quand il répond", d: "Dès que le client clique « Envoyer mes réponses », un email part sur contact@stratyxmedia.fr avec un lien vers sa fiche. La fiche passe à « Questionnaire rempli » avec la date." },
      { t: "Proposition et devis", d: "Avant de générer, renseigne dans les notes internes le coût réel estimé d'une demande sur Google : la proposition calcule alors, à partir de l'objectif de chiffre d'affaires du client, le nombre de demandes nécessaires et le budget nécessaire (à côté du plafond rentable). Passe l'étape à « Découverte faite », génère la synthèse, la proposition et le devis." },
    ],
  },
  {
    title: "Client signé",
    steps: [
      { t: "Récupère les accès", d: "Fiche → « Demander les accès au client » : message prêt à envoyer. Coche chaque accès obtenu dans « Accès obtenus » (Google Ads, Analytics, Tag Manager, Search Console, fiche Google, Meta, site) : le compteur en haut de la fiche montre ce qui manque." },
      { t: "Lie le compte Google Ads", d: "Comptes et réglages pour connecter le compte, puis choisis-le dans « Compte Google Ads lié » sur la fiche.", href: "/comptes" },
      { t: "Prépare le lancement", d: "Avant le rendez-vous de lancement : analyse de la marque, de l'offre, de la cible, des avis clients, de la concurrence (bibliothèques publicitaires Meta et Google) et de l'historique du compte. Le Persona (lien sur la fiche) et l'Audit prospect aident.", href: "/audit/prospect" },
      { t: "Prépare les campagnes", d: "Création → Prévisions et campagnes : budget, mots-clés, structure, et création des campagnes en pause. Vérifie le suivi des conversions avant d'activer.", href: "/previsions" },
    ],
  },
  {
    title: "Chaque jour, sans rien faire",
    steps: [
      { t: "Diagnostic + alertes du matin", d: "Vers 6–7 h, chaque compte surveillé est vérifié (compte à l'arrêt, dépense qui s'emballe, plus de conversions, CPA en hausse, budget du mois, pages en erreur). Un email part seulement s'il y a quelque chose d'important.", href: "/alertes" },
      { t: "Vérifier tout de suite", d: "Pilotage → Alertes du matin → « Vérifier maintenant ». Si une alerte se déclenche, l'email part aussi. La ligne « Dernier email » indique si l'envoi a marché.", href: "/alertes" },
      { t: "Le témoin vert/rouge", d: "En bas du menu : vert = tout fonctionne. Rouge = clique dessus pour voir ce qui manque (clé, table, connexion)." },
    ],
  },
  {
    title: "Chaque semaine et chaque mois",
    steps: [
      { t: "Lundi matin", d: "Compte rendu de la semaine par email, tous comptes confondus." },
      { t: "Rapport client", d: "Rapports → Rapports clients : un lien public à envoyer au client, sans connexion.", href: "/rapports" },
      { t: "Diagnostic détaillé", d: "Optimiser → Diagnostic : constats classés par priorité sur 100, montant en jeu, « Corriger » sur chaque ligne, onglet Traité.", href: "/waste" },
    ],
  },
  {
    title: "Optimiser un compte (pages façon Ades)",
    steps: [
      { t: "Termes de recherche", d: "Optimiser → Termes : À exclure (coche, puis exclus en un clic, annulable 30 j), Intentions, N-grammes, Bloquées.", href: "/optimiser/termes" },
      { t: "Mots-clés", d: "Optimiser → Mots-clés : coût, QS, CPA par mot-clé ; onglets Quality Score, Correspondance, Idées.", href: "/optimiser/mots-cles" },
      { t: "Budget du mois", d: "Optimiser → Budget Optimizer : saisis la cible du mois, il donne le budget par jour à mettre pour tomber pile (rien n'est changé dans Google Ads).", href: "/optimiser/budget" },
      { t: "Comprendre une variation", d: "Analyser → Carte des causes (ce qui fait bouger dépense et conversions) et CPC vs marché (budget ou classement, CPC face à l'estimation Google).", href: "/analyser/carte" },
      { t: "Audit noté sur 100", d: "Analyser → Audit : choisis le modèle (leads, local, e-commerce), puis « Scanner le compte ». À imprimer en PDF pour un prospect ou un client.", href: "/analyser/audit" },
    ],
  },
  {
    title: "Quand quelque chose ne marche pas",
    steps: [
      { t: "Signale-le tout de suite", d: "Menu → « Signaler un bug » depuis la page concernée : une phrase suffit. C'est enregistré et envoyé sur contact@stratyxmedia.fr.", href: "/bug" },
      { t: "Fais-le corriger", d: "Sur la page Signaler un bug, « Copier pour Claude » copie tous les bugs ouverts : colle-les dans une conversation avec Claude. Une fois corrigé, clique « Résolu »." },
      { t: "Pas d'email reçu ?", d: "Regarde la ligne « Dernier email » sur Alertes du matin : elle donne l'erreur exacte. Pense aussi aux spams." },
    ],
  },
];

export default async function AidePage() {
  const ctx = await getDashboardContext();

  return (
    <Shell active="aide" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <h1 className="page-title">Centre d'aide</h1>
      <p className="page-lede">
        Tout ce qu'il faut savoir pour tirer le meilleur d'ads·stratyx.
      </p>

      {ctx.isOwner && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Guide de l&apos;agence</h2>
          <p className="subtitle" style={{ margin: "0 0 14px", fontSize: 13 }}>Les gestes du quotidien, dans l&apos;ordre. Visible seulement par toi.</p>
          <div style={{ display: "grid", gap: 16 }}>
            {GUIDE.map((g) => (
              <div key={g.title}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{g.title}</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                  {g.steps.map((st) => (
                    <li key={st.t} style={{ fontSize: 14, lineHeight: 1.5 }}>
                      <strong>{st.href ? <a href={st.href}>{st.t}</a> : st.t}</strong>
                      <div className="subtitle" style={{ margin: "2px 0 0", fontSize: 13 }}>{st.d}</div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {SECTIONS.map((section) => (
          <div key={section.title} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid color-mix(in srgb, var(--muted) 20%, transparent)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ width: 22, height: 22, display: "inline-flex", color: "var(--accent)" }}>{Icons[section.icon as keyof typeof Icons]}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{section.title}</h2>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {section.items.map((item, i) => (
                <details key={i} style={{ borderBottom: i < section.items.length - 1 ? "1px solid color-mix(in srgb, var(--muted) 15%, transparent)" : "none" }}>
                  <summary style={{
                    padding: "14px 20px",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: 14,
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    userSelect: "none",
                  }}>
                    {item.q}
                    <span style={{ fontSize: 18, opacity: 0.4, flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{
                    margin: 0,
                    padding: "0 20px 16px",
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: "var(--muted)",
                  }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12, textAlign: "center", padding: "20px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14 }}>
          Tu as une question qui n'est pas listée ici ?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/bug?from=/aide" className="btn-ghost" style={{ fontSize: 13 }}>Signaler un bug</a>
          <a
            href="mailto:levy.stephane.pro@gmail.com?subject=Question ads·stratyx"
            className="btn"
            style={{ fontSize: 13 }}
          >
            Contacter le support →
          </a>
        </div>
      </div>
    </Shell>
  );
}
