-- =====================================================================
-- ads-stratyx — Bibliothèque de 40 templates (façon Ades)
-- Idempotent : chaque template n'est inséré que si son nom n'existe pas déjà.
-- Sûr à rejouer, et ne touche pas aux templates que tu as créés toi-même.
-- =====================================================================

insert into public.templates (name, description, category, prompt, icon)
select v.name, v.description, v.category, v.prompt, v.icon
from (values
  -- ---------------- 📊 Reporting ----------------
  ($$Rapport quotidien express$$, $$Le point du jour en 5 lignes : dépense, conversions, alertes.$$, $$Reporting$$,
   $$Donne-moi le point du jour sur mon compte principal en 5 lignes maximum : dépense des dernières 24h, conversions, et toute alerte. Sois ultra concis.$$, $$📅$$),
  ($$Rapport mensuel complet$$, $$Synthèse des 30 derniers jours avec tous les KPI et la tendance.$$, $$Reporting$$,
   $$Rédige le rapport mensuel de mon compte principal (30 derniers jours) : coût, impressions, clics, CTR, CPC, conversions, CPA, ROAS en tableau par campagne, plus un total. Termine par les 3 faits marquants du mois.$$, $$📆$$),
  ($$Comparatif semaine A / B$$, $$Cette semaine vs la précédente : ce qui monte, ce qui descend.$$, $$Reporting$$,
   $$Compare la performance de mon compte principal sur les 7 derniers jours face aux 7 jours précédents. Montre les variations (coût, conversions, CPA, ROAS) et explique ce qui monte et ce qui descend.$$, $$🔁$$),
  ($$Top & flop du mois$$, $$Les 3 meilleures et 3 pires campagnes du mois.$$, $$Reporting$$,
   $$Sur les 30 derniers jours, donne-moi les 3 campagnes les plus performantes et les 3 moins performantes de mon compte principal, avec les chiffres qui le justifient (ROAS, CPA, conversions).$$, $$🏆$$),
  ($$Synthèse pour le client$$, $$Un résumé clair et non technique, prêt à envoyer.$$, $$Reporting$$,
   $$Rédige une synthèse de performance des 30 derniers jours destinée à un client non technique : ton simple, chiffres clés vulgarisés, résultats concrets, et prochaines étapes. Évite le jargon.$$, $$📄$$),
  ($$Tableau de bord KPI$$, $$Tous les indicateurs clés en un seul tableau.$$, $$Reporting$$,
   $$Présente en un seul tableau les KPI de toutes mes campagnes actives sur 30 jours : impressions, clics, CTR, CPC, coût, conversions, CPA, ROAS. Trie par coût décroissant.$$, $$📊$$),

  -- ---------------- 🔍 Audit ----------------
  ($$Audit express (5 min)$$, $$Un diagnostic rapide des points chauds du compte.$$, $$Audit$$,
   $$Fais un audit express de mon compte principal : repère en priorité les 3 problèmes les plus urgents à traiter cette semaine, avec pour chacun l'impact estimé.$$, $$⚡$$),
  ($$Audit complet du compte$$, $$Analyse en profondeur : structure, performance, gaspillage.$$, $$Audit$$,
   $$Réalise un audit complet de mon compte principal sur 30 jours : structure des campagnes et ad groups, performance globale, points de gaspillage, et opportunités. Termine par un plan d'action priorisé.$$, $$🔬$$),
  ($$Analyse du ROAS$$, $$Quelles campagnes sont rentables, lesquelles ne le sont pas.$$, $$Audit$$,
   $$Analyse le ROAS de chaque campagne sur 30 jours. Classe-les de la plus rentable à la moins rentable et indique lesquelles sont sous le seuil de rentabilité.$$, $$💹$$),
  ($$Analyse du CPA$$, $$Le coût par acquisition, campagne par campagne.$$, $$Audit$$,
   $$Analyse le coût par acquisition (CPA) de chaque campagne sur 30 jours. Repère les campagnes dont le CPA est anormalement élevé et explique pourquoi si possible.$$, $$🧮$$),
  ($$Analyse du CTR$$, $$Taux de clics : quelles annonces accrochent, lesquelles non.$$, $$Audit$$,
   $$Analyse le taux de clics (CTR) de mes campagnes sur 30 jours. Identifie celles au CTR faible qui mériteraient de meilleures annonces, et celles qui performent bien.$$, $$👆$$),
  ($$Santé des campagnes actives$$, $$Un check-up rapide de chaque campagne en cours.$$, $$Audit$$,
   $$Passe en revue mes campagnes actives et donne pour chacune un état de santé (bon / à surveiller / problème) avec une justification chiffrée en une ligne.$$, $$🩺$$),
  ($$Analyse de la structure du compte$$, $$Campagnes, ad groups : est-ce bien organisé ?$$, $$Audit$$,
   $$Analyse la structure de mon compte principal : liste les campagnes et leurs groupes d'annonces, et signale les incohérences ou la structure qui pourrait être simplifiée.$$, $$🗂️$$),
  ($$Analyse des taux de conversion$$, $$Où les conversions se font, où ça bloque.$$, $$Audit$$,
   $$Analyse les conversions par campagne sur 30 jours. Repère les campagnes qui génèrent du trafic mais peu de conversions, et celles qui convertissent le mieux.$$, $$✅$$),

  -- ---------------- ✂️ Optimisation ----------------
  ($$Campagnes à mettre en pause$$, $$La liste des campagnes qui coûtent sans rapporter.$$, $$Optimisation$$,
   $$Identifie les campagnes qui, sur 30 jours, dépensent significativement sans générer de conversions (ou avec un ROAS très faible) et qui pourraient être mises en pause. Justifie chaque proposition. Ne modifie rien, propose seulement.$$, $$⏸️$$),
  ($$Ad groups sous-performants$$, $$Les groupes d'annonces qui drainent le budget.$$, $$Optimisation$$,
   $$Repère les groupes d'annonces qui dépensent sans convertir sur 30 jours. Donne la liste priorisée par coût gaspillé, avec l'action recommandée pour chacun.$$, $$📉$$),
  ($$Nettoyage des campagnes inactives$$, $$Fais le ménage dans les campagnes en veille.$$, $$Optimisation$$,
   $$Liste les campagnes qui n'ont eu aucune activité récente ou qui sont en pause depuis longtemps, et propose lesquelles archiver ou réactiver.$$, $$🧹$$),
  ($$Rééquilibrage des budgets$$, $$Déplacer le budget vers ce qui marche.$$, $$Optimisation$$,
   $$Sur la base des 30 derniers jours, propose une nouvelle répartition du budget entre mes campagnes : réduire là où le ROAS est faible, augmenter là où il est bon. Chiffre les recommandations. Propose sans appliquer.$$, $$⚖️$$),
  ($$Réduction du CPA$$, $$Des pistes concrètes pour baisser le coût d'acquisition.$$, $$Optimisation$$,
   $$Analyse mon compte et propose 3 à 5 actions concrètes pour réduire le coût par acquisition, en te basant sur les campagnes et requêtes les plus coûteuses.$$, $$💸$$),
  ($$Quick wins de la semaine$$, $$3 actions faciles à fort impact, tout de suite.$$, $$Optimisation$$,
   $$Donne-moi 3 « quick wins » : des actions simples et rapides à mettre en place cette semaine sur mon compte, avec un impact attendu clair.$$, $$🚀$$),
  ($$Revue des campagnes coûteuses$$, $$Zoom sur les campagnes qui pèsent le plus.$$, $$Optimisation$$,
   $$Concentre-toi sur les 3 campagnes qui dépensent le plus sur 30 jours et analyse en détail si cette dépense est justifiée par les résultats. Recommande des ajustements.$$, $$🔎$$),

  -- ---------------- 🎯 Mots-clés & requêtes ----------------
  ($$Mots-clés négatifs prioritaires$$, $$Les exclusions les plus rentables à ajouter d'abord.$$, $$Mots-clés$$,
   $$Analyse les termes de recherche des 30 derniers jours et propose les 10 mots-clés négatifs prioritaires (les requêtes qui coûtent le plus sans convertir), groupés par thème.$$, $$🚫$$),
  ($$Requêtes qui convertissent le mieux$$, $$Tes meilleurs termes de recherche.$$, $$Mots-clés$$,
   $$Liste les termes de recherche qui ont généré le plus de conversions sur 30 jours. Suggère lesquels transformer en mots-clés exacts pour mieux les exploiter.$$, $$🥇$$),
  ($$Requêtes hors-cible$$, $$Ce sur quoi tu paies alors que ça ne devrait pas.$$, $$Mots-clés$$,
   $$Repère parmi mes termes de recherche ceux qui sont clairement hors-sujet par rapport à mon activité et sur lesquels je gaspille du budget. Propose des négatifs.$$, $$🚧$$),
  ($$Nouvelles idées de mots-clés$$, $$Des pistes d'expansion à partir de tes requêtes.$$, $$Mots-clés$$,
   $$À partir des termes de recherche qui convertissent, propose de nouvelles idées de mots-clés ou de thématiques à cibler pour développer mes campagnes.$$, $$💡$$),
  ($$Termes de recherche les plus coûteux$$, $$Où part l'argent, requête par requête.$$, $$Mots-clés$$,
   $$Donne la liste des termes de recherche les plus coûteux sur 30 jours, avec pour chacun le coût, les clics et les conversions. Indique lesquels surveiller.$$, $$💰$$),
  ($$Analyse d'intention des requêtes$$, $$Ce que cherchent vraiment tes prospects.$$, $$Mots-clés$$,
   $$Analyse les termes de recherche récents et regroupe-les par intention (info, comparaison, achat…). Dis-moi sur quelle intention je dépense le plus et si c'est pertinent.$$, $$🧭$$),

  -- ---------------- 💰 Budget & enchères ----------------
  ($$Campagnes limitées par le budget$$, $$Celles qui pourraient faire plus avec plus.$$, $$Budget$$,
   $$Identifie les campagnes rentables qui semblent bridées par leur budget (bon ROAS mais dépense plafonnée) et pour lesquelles une hausse de budget serait justifiée. Chiffre le potentiel.$$, $$🚦$$),
  ($$Où réinvestir en priorité$$, $$Le meilleur endroit pour mettre 100 € de plus.$$, $$Budget$$,
   $$Si je pouvais ajouter du budget, où faudrait-il le mettre pour le meilleur retour ? Analyse mes campagnes et classe-les par potentiel de réinvestissement.$$, $$🌱$$),
  ($$Où couper les dépenses$$, $$Le meilleur endroit pour économiser 100 €.$$, $$Budget$$,
   $$Où puis-je réduire mes dépenses sans perdre de conversions ? Repère le budget le moins productif sur 30 jours et propose des coupes chiffrées.$$, $$🔻$$),
  ($$Projection de dépense mensuelle$$, $$À ce rythme, combien à la fin du mois ?$$, $$Budget$$,
   $$Sur la base de la dépense récente, projette ma dépense totale d'ici la fin du mois par campagne et au global. Signale si je risque de dépasser un rythme habituel.$$, $$🔮$$),
  ($$Répartition du budget par type$$, $$Search, PMax, Display… qui prend quoi ?$$, $$Budget$$,
   $$Montre comment mon budget se répartit entre les types de campagnes (Search, PMax, Display, Local…) sur 30 jours, et dis-moi si l'équilibre te semble cohérent avec les résultats.$$, $$🥧$$),

  -- ---------------- 🚨 Alertes & surveillance ----------------
  ($$Alerte : dépense sans conversion$$, $$Détecte l'argent qui part dans le vide.$$, $$Alertes$$,
   $$Vérifie s'il existe des campagnes ou ad groups qui dépensent sans aucune conversion sur les 7 derniers jours. Si oui, liste-les par gravité ; sinon, confirme que tout va bien.$$, $$⚠️$$),
  ($$Alerte : chute de conversions$$, $$Es-tu en train de perdre des conversions ?$$, $$Alertes$$,
   $$Compare les conversions des 7 derniers jours à celles des 7 jours précédents. Signale toute baisse notable et essaie d'en identifier la cause (campagne concernée).$$, $$🔴$$),
  ($$Alerte : explosion du coût$$, $$Un coût qui s'emballe quelque part ?$$, $$Alertes$$,
   $$Repère toute hausse anormale de coût sur les 7 derniers jours par rapport à la période précédente. Indique la campagne responsable et l'ampleur de la hausse.$$, $$💥$$),
  ($$Alerte : ROAS en baisse$$, $$Ta rentabilité se dégrade-t-elle ?$$, $$Alertes$$,
   $$Compare le ROAS des 7 derniers jours à la période précédente. Signale les campagnes dont la rentabilité se dégrade et de combien.$$, $$📛$$),
  ($$Surveillance quotidienne$$, $$Un gardien qui checke tout chaque jour.$$, $$Alertes$$,
   $$Fais une surveillance complète de mon compte : dépense, conversions, ROAS, anomalies. Résume en quelques lignes ce qui mérite mon attention aujourd'hui. Si tout est normal, dis-le.$$, $$👁️$$),

  -- ---------------- 📈 Stratégie & croissance ----------------
  ($$Plan d'action 30 jours$$, $$Une feuille de route priorisée pour le mois.$$, $$Stratégie$$,
   $$À partir de l'état actuel de mon compte, propose un plan d'action priorisé pour les 30 prochains jours : quoi faire, dans quel ordre, et l'impact attendu de chaque action.$$, $$🗓️$$),
  ($$Recommandations de croissance$$, $$Comment faire grandir les résultats.$$, $$Stratégie$$,
   $$Analyse mon compte et propose 3 à 5 leviers de croissance concrets pour augmenter les conversions tout en gardant la rentabilité. Priorise-les.$$, $$📈$$),
  ($$Idées de nouvelles campagnes$$, $$Des pistes pour élargir ta présence.$$, $$Stratégie$$,
   $$En te basant sur ce qui fonctionne déjà (campagnes et requêtes performantes), propose des idées de nouvelles campagnes ou de nouveaux angles à tester.$$, $$✨$$),
  ($$Bilan et cap du trimestre$$, $$Où on en est, où on va.$$, $$Stratégie$$,
   $$Fais un bilan synthétique de la performance récente de mon compte et propose 3 objectifs concrets et chiffrés pour le trimestre à venir.$$, $$🧭$$)
) as v(name, description, category, prompt, icon)
where not exists (
  select 1 from public.templates t where t.name = v.name
);
