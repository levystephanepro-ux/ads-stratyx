import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    icon: "🔐",
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
    icon: "💬",
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
        a: "Oui. Dans la page Templates, clique sur n'importe quel prompt — il s'ouvre directement dans le Copilote avec le texte pré-rempli.",
      },
      {
        q: "Le Copilote a-t-il accès à mes vraies données ?",
        a: "Oui si tu as connecté un compte Google Ads réel. En mode démo, il utilise des données fictives.",
      },
    ],
  },
  {
    icon: "🤖",
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
    icon: "📋",
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
    icon: "🔗",
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
    icon: "👤",
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
    icon: "📊",
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
    icon: "💳",
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

export default async function AidePage() {
  const ctx = await getDashboardContext();

  return (
    <Shell active="aide" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <h1 className="page-title">Centre d'aide</h1>
      <p className="page-lede">
        Tout ce qu'il faut savoir pour tirer le meilleur d'ads·stratyx.
      </p>

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
              <span style={{ fontSize: 22 }}>{section.icon}</span>
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
        <a
          href="mailto:levy.stephane.pro@gmail.com?subject=Question ads·stratyx"
          className="btn"
          style={{ fontSize: 13 }}
        >
          Contacter le support →
        </a>
      </div>
    </Shell>
  );
}
