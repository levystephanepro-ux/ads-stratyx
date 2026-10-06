// Lot 1 · Diagnostic de structure et réglages (aucune métrique de performance requise).
import { normKw, negativeBlocks } from "@/lib/audit/negatives";
import { during, micros, num, q, MATCH_LABEL } from "./helpers";
import type { ScriptDef } from "./types";

const ENABLED = "campaign.status = 'ENABLED'";

export const STRUCTURE_SCRIPTS: ScriptDef[] = [
  {
    id: "diffusion-campagnes",
    title: "Diffusion des campagnes",
    description: "Chaque campagne active avec l'état que Google lui donne (éligible, limitée…) et les raisons : la réponse la plus rapide à « pourquoi elle ne diffuse plus ? ».",
    category: "diagnostic", level: "Débutant", frequency: "Quotidien", channels: "Tous types",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "type", label: "Type", type: "text" },
      { key: "status", label: "État Google", type: "text" },
      { key: "reasons", label: "Raisons", type: "text" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `
        SELECT campaign.name, campaign.advertising_channel_type, campaign.primary_status, campaign.primary_status_reasons
        FROM campaign WHERE ${ENABLED} ORDER BY campaign.name`);
      const out = rows.map((r) => ({
        campaign: r.campaign?.name ?? "",
        type: r.campaign?.advertisingChannelType ?? "",
        status: r.campaign?.primaryStatus ?? "",
        reasons: (r.campaign?.primaryStatusReasons ?? []).join(", "),
      }));
      const limited = out.filter((r) => r.status !== "ELIGIBLE").length;
      return { rows: out, summary: `${out.length} campagne(s) active(s), ${limited} non pleinement éligible(s).` };
    },
  },
  {
    id: "reglages-campagnes",
    title: "Réglages des campagnes",
    description: "Partenaires de recherche, réseau Display, ciblage « présence ou intérêt » : les réglages qui font dépenser hors de votre cible.",
    category: "diagnostic", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "partners", label: "Partenaires", type: "text" },
      { key: "display", label: "Réseau Display", type: "text" },
      { key: "geo", label: "Ciblage géo", type: "text" },
      { key: "alert", label: "À vérifier", type: "text" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `
        SELECT campaign.name, campaign.advertising_channel_type,
               campaign.network_settings.target_search_network, campaign.network_settings.target_content_network,
               campaign.geo_target_type_setting.positive_geo_target_type
        FROM campaign WHERE ${ENABLED} AND campaign.advertising_channel_type IN ('SEARCH', 'SHOPPING')`);
      const out = rows.map((r) => {
        const ns = r.campaign?.networkSettings ?? {};
        const geo = r.campaign?.geoTargetTypeSetting?.positiveGeoTargetType ?? "";
        const alerts = [
          ns.targetSearchNetwork ? "partenaires activés" : null,
          ns.targetContentNetwork ? "Display activé sur une campagne Search" : null,
          geo === "PRESENCE_OR_INTEREST" ? "présence OU intérêt (diffuse hors zone)" : null,
        ].filter(Boolean);
        return {
          campaign: r.campaign?.name ?? "",
          partners: ns.targetSearchNetwork ? "Oui" : "Non",
          display: ns.targetContentNetwork ? "Oui" : "Non",
          geo: geo === "PRESENCE" ? "Présence" : geo === "PRESENCE_OR_INTEREST" ? "Présence ou intérêt" : geo,
          alert: alerts.join(" · "),
        };
      });
      return { rows: out, summary: `${out.filter((r) => r.alert).length} campagne(s) avec un réglage à vérifier.` };
    },
  },
  {
    id: "zones-ciblees",
    title: "Zones ciblées",
    description: "Les pays, villes et rayons visés ou exclus par chaque campagne active : l'oubli d'une exclusion se voit en un coup d'œil.",
    category: "diagnostic", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "mode", label: "Mode", type: "text" },
      { key: "zone", label: "Zone", type: "text" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `
        SELECT campaign.name, campaign_criterion.type, campaign_criterion.negative,
               campaign_criterion.location.geo_target_constant,
               campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units,
               campaign_criterion.proximity.address.city_name
        FROM campaign_criterion
        WHERE ${ENABLED} AND campaign_criterion.type IN ('LOCATION', 'PROXIMITY')`);
      const ids = [...new Set(rows.map((r) => r.campaignCriterion?.location?.geoTargetConstant).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const g = await q(ctx, `
          SELECT geo_target_constant.resource_name, geo_target_constant.canonical_name
          FROM geo_target_constant
          WHERE geo_target_constant.resource_name IN (${ids.map((i) => `'${i}'`).join(", ")})`);
        g.forEach((x) => names.set(x.geoTargetConstant?.resourceName, x.geoTargetConstant?.canonicalName));
      }
      const out = rows.map((r) => {
        const c = r.campaignCriterion ?? {};
        const zone = c.type === "PROXIMITY"
          ? `Rayon ${c.proximity?.radius ?? "?"} ${c.proximity?.radiusUnits === "KILOMETERS" ? "km" : c.proximity?.radiusUnits ?? ""} autour de ${c.proximity?.address?.cityName ?? "une adresse"}`
          : names.get(c.location?.geoTargetConstant) ?? c.location?.geoTargetConstant ?? "";
        return { campaign: r.campaign?.name ?? "", mode: c.negative ? "Exclue" : "Ciblée", zone };
      }).sort((a, b) => a.campaign.localeCompare(b.campaign));
      return { rows: out };
    },
  },
  {
    id: "groupes-sans-annonce",
    title: "Groupes sans annonce",
    description: "Les groupes d'annonces actifs sans aucune annonce active et approuvée : ils ne diffusent rien, quels que soient leurs mots-clés.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Display",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "adGroup", label: "Groupe d'annonces", type: "text" },
    ],
    async run(ctx) {
      const [groups, ads] = await Promise.all([
        q(ctx, `SELECT campaign.name, ad_group.id, ad_group.name FROM ad_group
                WHERE ${ENABLED} AND ad_group.status = 'ENABLED'`),
        q(ctx, `SELECT ad_group.id, ad_group_ad.policy_summary.approval_status FROM ad_group_ad
                WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'`),
      ]);
      const withAd = new Set(ads.filter((a) => a.adGroupAd?.policySummary?.approvalStatus !== "DISAPPROVED").map((a) => String(a.adGroup?.id)));
      const out = groups.filter((g) => !withAd.has(String(g.adGroup?.id)))
        .map((g) => ({ campaign: g.campaign?.name ?? "", adGroup: g.adGroup?.name ?? "" }));
      return { rows: out, summary: out.length ? `${out.length} groupe(s) actif(s) qui ne peuvent rien diffuser.` : "Tous les groupes actifs ont au moins une annonce diffusable." };
    },
  },
  {
    id: "groupes-sans-mot-cle",
    title: "Groupes sans mot-clé",
    description: "Les groupes d'annonces Search actifs sans aucun mot-clé actif : leurs annonces ne peuvent pas diffuser sur le Réseau de Recherche.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "adGroup", label: "Groupe d'annonces", type: "text" },
    ],
    async run(ctx) {
      const [groups, kws] = await Promise.all([
        q(ctx, `SELECT campaign.name, ad_group.id, ad_group.name FROM ad_group
                WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group.type = 'SEARCH_STANDARD'`),
        q(ctx, `SELECT ad_group.id FROM ad_group_criterion
                WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'`),
      ]);
      const withKw = new Set(kws.map((k) => String(k.adGroup?.id)));
      const out = groups.filter((g) => !withKw.has(String(g.adGroup?.id)))
        .map((g) => ({ campaign: g.campaign?.name ?? "", adGroup: g.adGroup?.name ?? "" }));
      return { rows: out };
    },
  },
  {
    id: "campagnes-sans-negatif",
    title: "Campagnes sans négatif",
    description: "Les campagnes Search et Shopping actives sans aucun mot-clé négatif, ni sur la campagne ni par une liste partagée : la porte ouverte aux recherches hors sujet.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "type", label: "Type", type: "text" },
    ],
    async run(ctx) {
      const [camps, neg, lists] = await Promise.all([
        q(ctx, `SELECT campaign.id, campaign.name, campaign.advertising_channel_type FROM campaign
                WHERE ${ENABLED} AND campaign.advertising_channel_type IN ('SEARCH', 'SHOPPING')`),
        q(ctx, `SELECT campaign.id FROM campaign_criterion
                WHERE ${ENABLED} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE`),
        q(ctx, `SELECT campaign.id FROM campaign_shared_set
                WHERE ${ENABLED} AND shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign_shared_set.status = 'ENABLED'`),
      ]);
      const has = new Set([...neg, ...lists].map((r) => String(r.campaign?.id)));
      const out = camps.filter((c) => !has.has(String(c.campaign?.id)))
        .map((c) => ({ campaign: c.campaign?.name ?? "", type: c.campaign?.advertisingChannelType ?? "" }));
      return { rows: out };
    },
  },
  {
    id: "negatifs-bloquants",
    title: "Négatifs bloquants",
    description: "Les mots-clés actifs qu'un de vos négatifs empêche de diffuser, qu'il soit posé sur la campagne, sur le groupe ou dans une liste partagée : retirez le négatif ou le mot-clé.",
    category: "mots_cles", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "keyword", label: "Mot-clé bloqué", type: "text" },
      { key: "negative", label: "Négatif en cause", type: "text" },
      { key: "where", label: "Posé sur", type: "text" },
    ],
    async run(ctx) {
      const [kws, campNeg, agNeg, links, shared] = await Promise.all([
        q(ctx, `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'`),
        q(ctx, `SELECT campaign.id, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion
                WHERE ${ENABLED} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE`),
        q(ctx, `SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion
                WHERE ${ENABLED} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE`),
        q(ctx, `SELECT campaign.id, shared_set.id, shared_set.name FROM campaign_shared_set
                WHERE ${ENABLED} AND shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign_shared_set.status = 'ENABLED'`),
        q(ctx, `SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion
                WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_criterion.type = 'KEYWORD'`),
      ]);
      type Neg = { text: string; match: string; where: string };
      const byCamp = new Map<string, Neg[]>();
      const byGroup = new Map<string, Neg[]>();
      const push = (m: Map<string, Neg[]>, k: string, n: Neg) => m.set(k, [...(m.get(k) ?? []), n]);
      campNeg.forEach((r) => push(byCamp, String(r.campaign?.id), { text: r.campaignCriterion?.keyword?.text, match: r.campaignCriterion?.keyword?.matchType, where: "campagne" }));
      agNeg.forEach((r) => push(byGroup, String(r.adGroup?.id), { text: r.adGroupCriterion?.keyword?.text, match: r.adGroupCriterion?.keyword?.matchType, where: "groupe" }));
      const setContent = new Map<string, Neg[]>();
      shared.forEach((r) => push(setContent, String(r.sharedSet?.id), { text: r.sharedCriterion?.keyword?.text, match: r.sharedCriterion?.keyword?.matchType, where: "" }));
      links.forEach((l) => (setContent.get(String(l.sharedSet?.id)) ?? []).forEach((n) =>
        push(byCamp, String(l.campaign?.id), { ...n, where: `liste « ${l.sharedSet?.name} »` })));
      const fmt = (t: string, m: string) => (m === "EXACT" ? `[${t}]` : m === "PHRASE" ? `"${t}"` : t);
      const out = [];
      for (const k of kws) {
        const text = k.adGroupCriterion?.keyword?.text ?? "";
        const negs = [...(byCamp.get(String(k.campaign?.id)) ?? []), ...(byGroup.get(String(k.adGroup?.id)) ?? [])];
        for (const n of negs) {
          if (!n.text || !negativeBlocks(n.text, n.match, text)) continue;
          out.push({
            campaign: `${k.campaign?.name ?? ""} › ${k.adGroup?.name ?? ""}`,
            keyword: fmt(text, k.adGroupCriterion?.keyword?.matchType),
            negative: fmt(n.text, n.match),
            where: n.where,
          });
        }
      }
      return { rows: out, summary: `${kws.length} mots-clés actifs comparés à ${[...byCamp.values(), ...byGroup.values()].flat().length} négatifs.` };
    },
  },
  {
    id: "mots-cles-doublons",
    title: "Mots-clés en double",
    description: "Le même mot-clé, même correspondance, actif dans plusieurs groupes : ils se font concurrence. Gardez celui qui convertit le mieux.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [
      { key: "keyword", label: "Mot-clé", type: "text" },
      { key: "match", label: "Correspondance", type: "text" },
      { key: "count", label: "Groupes", type: "int" },
      { key: "where", label: "Où", type: "text" },
    ],
    async run(ctx) {
      const kws = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'`);
      const m = new Map<string, string[]>();
      kws.forEach((k) => {
        const key = `${normKw(k.adGroupCriterion?.keyword?.text ?? "")}|${k.adGroupCriterion?.keyword?.matchType}`;
        m.set(key, [...(m.get(key) ?? []), `${k.campaign?.name} › ${k.adGroup?.name}`]);
      });
      const out = [...m.entries()].filter(([, w]) => w.length > 1).map(([key, w]) => {
        const [text, match] = key.split("|");
        return { keyword: text, match: MATCH_LABEL[match] ?? match, count: w.length, where: w.join(" · ") };
      }).sort((a, b) => b.count - a.count);
      return { rows: out };
    },
  },
  {
    id: "mots-cles-zombies",
    title: "Mots-clés zombies",
    description: "Les mots-clés actifs qui n'ont eu aucune impression sur la période : du poids mort, ou le signe d'un négatif ou d'une enchère trop basse.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [
      { key: "campaign", label: "Campagne › groupe", type: "text" },
      { key: "keyword", label: "Mot-clé", type: "text" },
      { key: "match", label: "Correspondance", type: "text" },
      { key: "status", label: "État Google", type: "text" },
    ],
    async run(ctx, range) {
      const [kws, perf] = await Promise.all([
        q(ctx, `SELECT campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
                       ad_group_criterion.keyword.match_type, ad_group_criterion.primary_status
                FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'`),
        q(ctx, `SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.impressions FROM keyword_view
                WHERE ${during(range)} AND metrics.impressions > 0`),
      ]);
      const seen = new Set(perf.map((p) => `${p.adGroup?.id}|${p.adGroupCriterion?.criterionId}`));
      const out = kws.filter((k) => !seen.has(`${k.adGroup?.id}|${k.adGroupCriterion?.criterionId}`)).map((k) => ({
        campaign: `${k.campaign?.name} › ${k.adGroup?.name}`,
        keyword: k.adGroupCriterion?.keyword?.text ?? "",
        match: MATCH_LABEL[k.adGroupCriterion?.keyword?.matchType] ?? "",
        status: k.adGroupCriterion?.primaryStatus ?? "",
      }));
      return { rows: out, summary: `${out.length} mot(s)-clé(s) actif(s) sur ${kws.length} sans aucune impression.` };
    },
  },
  {
    id: "listes-negatifs",
    title: "Listes de mots-clés négatifs",
    description: "Vos listes de négatifs partagées, leur nombre de mots-clés (Google en accepte 5 000 au plus) et le nombre de campagnes liées.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping",
    columns: [
      { key: "list", label: "Liste", type: "text" },
      { key: "keywords", label: "Négatifs", type: "int" },
      { key: "campaigns", label: "Campagnes liées", type: "int" },
    ],
    async run(ctx) {
      const [sets, links] = await Promise.all([
        q(ctx, `SELECT shared_set.id, shared_set.name, shared_set.member_count FROM shared_set
                WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'`),
        q(ctx, `SELECT shared_set.id FROM campaign_shared_set
                WHERE campaign_shared_set.status = 'ENABLED' AND shared_set.type = 'NEGATIVE_KEYWORDS'`),
      ]);
      const count = new Map<string, number>();
      links.forEach((l) => count.set(String(l.sharedSet?.id), (count.get(String(l.sharedSet?.id)) ?? 0) + 1));
      return { rows: sets.map((s) => ({ list: s.sharedSet?.name ?? "", keywords: num(s.sharedSet?.memberCount), campaigns: count.get(String(s.sharedSet?.id)) ?? 0 })) };
    },
  },
  {
    id: "qui-a-modifie",
    title: "Qui a modifié quoi",
    description: "Chaque modification du compte, par qui et avec quel outil (interface, Google, script, API), sur les 29 derniers jours.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [
      { key: "date", label: "Date", type: "text" },
      { key: "who", label: "Qui", type: "text" },
      { key: "tool", label: "Outil", type: "text" },
      { key: "what", label: "Élément", type: "text" },
      { key: "op", label: "Action", type: "text" },
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "fields", label: "Champs", type: "text" },
    ],
    async run(ctx) {
      // change_event : 30 derniers jours maximum, LIMIT obligatoire.
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 29);
      const rows = await q(ctx, `
        SELECT change_event.change_date_time, change_event.user_email, change_event.client_type,
               change_event.change_resource_type, change_event.resource_change_operation,
               change_event.changed_fields, campaign.name
        FROM change_event
        WHERE change_event.change_date_time >= '${iso(since)}' AND change_event.change_date_time <= '${iso(new Date())} 23:59:59'
        ORDER BY change_event.change_date_time DESC LIMIT 1000`);
      const TOOL: Record<string, string> = {
        GOOGLE_ADS_WEB_CLIENT: "Interface", GOOGLE_ADS_AUTOMATED_RULE: "Règle auto", GOOGLE_ADS_SCRIPTS: "Script",
        GOOGLE_ADS_BULK_UPLOAD: "Import", GOOGLE_ADS_API: "API", GOOGLE_ADS_EDITOR: "Editor",
        GOOGLE_ADS_MOBILE_APP: "Appli mobile", GOOGLE_ADS_RECOMMENDATIONS: "Recos Google", INTERNAL_TOOL: "Google", OTHER: "Autre",
      };
      return {
        rows: rows.map((r) => ({
          date: String(r.changeEvent?.changeDateTime ?? "").slice(0, 16),
          who: r.changeEvent?.userEmail ?? "",
          tool: TOOL[r.changeEvent?.clientType] ?? r.changeEvent?.clientType ?? "",
          what: r.changeEvent?.changeResourceType ?? "",
          op: r.changeEvent?.resourceChangeOperation ?? "",
          campaign: r.campaign?.name ?? "",
          fields: String(r.changeEvent?.changedFields ?? ""),
        })),
      };
    },
  },
  {
    id: "budget-compte",
    title: "Budget du compte",
    description: "Le budget du compte (facture ou prépayé) : plafond, déjà dépensé et dates. Ce qui reste avant que tout s'arrête.",
    category: "encheres_budget", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [
      { key: "name", label: "Budget", type: "text" },
      { key: "status", label: "État", type: "text" },
      { key: "limit", label: "Plafond", type: "eur" },
      { key: "spent", label: "Dépensé", type: "eur" },
      { key: "start", label: "Début", type: "text" },
      { key: "end", label: "Fin", type: "text" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `
        SELECT account_budget.name, account_budget.status, account_budget.approved_spending_limit_micros,
               account_budget.approved_spending_limit_type, account_budget.amount_served_micros,
               account_budget.approved_start_date_time, account_budget.approved_end_date_time, account_budget.approved_end_time_type
        FROM account_budget`);
      return {
        rows: rows.map((r) => {
          const b = r.accountBudget ?? {};
          return {
            name: b.name ?? "Budget du compte",
            status: b.status ?? "",
            limit: b.approvedSpendingLimitType === "INFINITE" ? null : micros(b.approvedSpendingLimitMicros),
            spent: micros(b.amountServedMicros),
            start: String(b.approvedStartDateTime ?? "").slice(0, 10),
            end: b.approvedEndTimeType === "FOREVER" ? "Sans fin" : String(b.approvedEndDateTime ?? "").slice(0, 10),
          };
        }),
        summary: rows.length ? undefined : "Aucun budget de compte : facturation automatique, rien ne s'arrête faute de plafond.",
      };
    },
  },
];
