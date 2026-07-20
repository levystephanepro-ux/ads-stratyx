"use client";
import { useState } from "react";
import {
  DEMO_ACCOUNT,
  DEMO_METRICS_AVANT,
  DEMO_METRICS_APRES,
  DEMO_PROBLEMES,
  DEMO_ACTIONS,
} from "@/lib/google-ads/mock-data";

type Etape = "diagnostic" | "avant" | "apres" | "offre";

const ETAPES: { id: Etape; label: string }[] = [
  { id: "diagnostic", label: "1 · Diagnostic" },
  { id: "avant",      label: "2 · Situation actuelle" },
  { id: "apres",      label: "3 · Avec Stratyx" },
  { id: "offre",      label: "4 · L'offre" },
];

function euros(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function delta(a: number, b: number) {
  if (!b) return "";
  const p = Math.round(((a - b) / b) * 100);
  return p > 0 ? `+${p}%` : `${p}%`;
}

function agregats(metrics: typeof DEMO_METRICS_AVANT) {
  return metrics.reduce(
    (acc, m) => ({
      cost: acc.cost + m.cost,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      value: acc.value + m.conversionsValue,
    }),
    { cost: 0, clicks: 0, conversions: 0, value: 0 },
  );
}

export default function DemoClient() {
  const [etape, setEtape] = useState<Etape>("diagnostic");
  const avant = agregats(DEMO_METRICS_AVANT);
  const apres = agregats(DEMO_METRICS_APRES);
  const cpaAvant = avant.conversions ? avant.cost / avant.conversions : 0;
  const cpaApres = apres.conversions ? apres.cost / apres.conversions : 0;

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#f5f5f3;color:#111;font-family:system-ui,sans-serif}

        .sh{min-height:100vh;background:#f5f5f3}

        /* header */
        .hd{background:#fff;border-bottom:1px solid #e5e5e3;padding:0 24px}
        .hd-i{max-width:820px;margin:0 auto;height:54px;display:flex;align-items:center;justify-content:space-between}
        .logo{font-size:17px;font-weight:600;color:#111;letter-spacing:-.02em}
        .pill{display:flex;align-items:center;gap:6px;font-size:13px;color:#555;background:#f0f0ee;padding:4px 12px;border-radius:99px;border:1px solid #e0e0de}
        .dot{width:7px;height:7px;border-radius:50%;background:#16a34a;flex-shrink:0}

        /* nav */
        .nv{max-width:820px;margin:20px auto 0;padding:0 24px;display:flex;gap:6px;flex-wrap:wrap}
        .nb{padding:7px 14px;border:1px solid #d0d0ce;border-radius:8px;background:#fff;font-size:13px;color:#555;cursor:pointer;transition:all .15s}
        .nb:hover{border-color:#999;color:#111}
        .nb.on{background:#111;color:#fff;border-color:#111}

        /* main */
        .mn{max-width:820px;margin:24px auto 60px;padding:0 24px}
        .ttl{font-size:20px;font-weight:600;color:#111;margin-bottom:4px}
        .sub{font-size:14px;color:#666;margin-bottom:20px}

        /* problèmes */
        .pb-list{display:flex;flex-direction:column;gap:8px;margin-bottom:24px}
        .pb{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;background:#fff;border:1px solid #e5e5e3}
        .pb-text{font-size:14px;color:#111;line-height:1.5}
        .tag{font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap;flex-shrink:0}
        .tag-h{background:#fee2e2;color:#991b1b}
        .tag-m{background:#fef3c7;color:#92400e}
        .tag-b{background:#dcfce7;color:#166534}

        /* kpis */
        .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px}
        .kpi{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e5e3}
        .kpi.bad{border-top:3px solid #ef4444}
        .kpi.good{border-top:3px solid #16a34a}
        .kpi-l{font-size:12px;color:#666;margin-bottom:4px}
        .kpi-v{font-size:22px;font-weight:600;color:#111}
        .kpi-s{font-size:11px;color:#999;margin-top:2px}
        .kpi-d{font-size:12px;font-weight:600;color:#16a34a;margin-top:2px}

        /* alerte */
        .alerte{background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:14px;color:#78350f;margin-bottom:20px;line-height:1.6}

        /* actions */
        .ac-box{background:#fff;border:1px solid #e5e5e3;border-radius:10px;padding:14px 16px;margin-bottom:20px}
        .ac-ttl{font-size:13px;font-weight:600;color:#555;margin-bottom:10px}
        .ac-row{display:flex;gap:8px;font-size:14px;color:#111;padding:6px 0;border-bottom:1px solid #f0f0ee;line-height:1.5}
        .ac-row:last-child{border-bottom:none}
        .check{color:#16a34a;font-weight:700;flex-shrink:0}

        /* offre */
        .of-card{background:#fff;border:1px solid #e5e5e3;border-radius:12px;padding:24px}
        .of-badge{display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:600;padding:4px 12px;border-radius:99px;margin-bottom:16px}
        .of-price{font-size:44px;font-weight:700;color:#111;line-height:1;margin-bottom:4px}
        .of-unit{font-size:18px;font-weight:400;color:#666}
        .of-sub{font-size:13px;color:#999;margin-bottom:20px}
        .of-list{list-style:none;padding:0;border-top:1px solid #f0f0ee;padding-top:16px;margin-bottom:20px}
        .of-list li{font-size:14px;color:#111;padding:6px 0 6px 18px;position:relative;line-height:1.5;border-bottom:1px solid #f5f5f3}
        .of-list li:last-child{border-bottom:none}
        .of-list li::before{content:"·";position:absolute;left:0;color:#999}
        .of-hl{font-weight:600}
        .of-hl::before{content:"★" !important;color:#d97706 !important}
        .of-roi{background:#f5f5f3;border-radius:8px;padding:12px 14px;font-size:14px;color:#444;line-height:1.6}

        /* bouton */
        .cta{margin-top:8px;padding:10px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:background .15s}
        .cta:hover{background:#333}
      `}</style>

      <div className="sh">
        <header className="hd">
          <div className="hd-i">
            <div className="logo">stratyx</div>
            <div className="pill">
              <span className="dot" />
              {DEMO_ACCOUNT.descriptiveName}
            </div>
          </div>
        </header>

        <nav className="nv">
          {ETAPES.map((e) => (
            <button
              key={e.id}
              className={`nb${etape === e.id ? " on" : ""}`}
              onClick={() => setEtape(e.id)}
            >
              {e.label}
            </button>
          ))}
        </nav>

        <main className="mn">

          {etape === "diagnostic" && (
            <>
              <h1 className="ttl">Ce que j'ai trouvé sur votre compte</h1>
              <p className="sub">Audit réalisé ce matin — {DEMO_PROBLEMES.length} problèmes identifiés</p>
              <div className="pb-list">
                {DEMO_PROBLEMES.map((p, i) => (
                  <div key={i} className="pb">
                    <span className={`tag ${p.gravite === "haute" ? "tag-h" : p.gravite === "moyenne" ? "tag-m" : "tag-b"}`}>
                      {p.gravite === "haute" ? "Critique" : p.gravite === "moyenne" ? "Moyen" : "Mineur"}
                    </span>
                    <span className="pb-text">{p.texte}</span>
                  </div>
                ))}
              </div>
              <button className="cta" onClick={() => setEtape("avant")}>
                Voir l'impact en chiffres →
              </button>
            </>
          )}

          {etape === "avant" && (
            <>
              <h1 className="ttl">Situation actuelle — 30 derniers jours</h1>
              <p className="sub">Sans gestion professionnelle</p>
              <div className="kpis">
                <div className="kpi bad">
                  <div className="kpi-l">Budget dépensé</div>
                  <div className="kpi-v">{euros(avant.cost)}</div>
                </div>
                <div className="kpi bad">
                  <div className="kpi-l">Appels reçus</div>
                  <div className="kpi-v">{avant.conversions}</div>
                  <div className="kpi-s">sur {avant.clicks} clics</div>
                </div>
                <div className="kpi bad">
                  <div className="kpi-l">Coût par appel</div>
                  <div className="kpi-v">{euros(Math.round(cpaAvant))}</div>
                  <div className="kpi-s">trop élevé</div>
                </div>
                <div className="kpi bad">
                  <div className="kpi-l">CA généré estimé</div>
                  <div className="kpi-v">{euros(avant.value)}</div>
                </div>
              </div>
              <div className="alerte">
                <strong>Le problème :</strong> vous payez {euros(Math.round(cpaAvant))} pour chaque appel reçu.
                47 % du budget part sur des requêtes non qualifiées — personnes qui cherchent
                un emploi de plombier, une formation, ou un plombier hors de votre zone.
              </div>
              <button className="cta" onClick={() => setEtape("apres")}>
                Voir la projection avec Stratyx →
              </button>
            </>
          )}

          {etape === "apres" && (
            <>
              <h1 className="ttl">Avec Stratyx — même budget, meilleurs résultats</h1>
              <p className="sub">Résultats après 30 jours de gestion</p>
              <div className="kpis">
                <div className="kpi good">
                  <div className="kpi-l">Budget dépensé</div>
                  <div className="kpi-v">{euros(apres.cost)}</div>
                  <div className="kpi-s">identique</div>
                </div>
                <div className="kpi good">
                  <div className="kpi-l">Appels reçus</div>
                  <div className="kpi-v">{apres.conversions}</div>
                  <div className="kpi-d">{delta(apres.conversions, avant.conversions)} vs avant</div>
                </div>
                <div className="kpi good">
                  <div className="kpi-l">Coût par appel</div>
                  <div className="kpi-v">{euros(Math.round(cpaApres))}</div>
                  <div className="kpi-d">{delta(cpaApres, cpaAvant)} vs avant</div>
                </div>
                <div className="kpi good">
                  <div className="kpi-l">CA généré estimé</div>
                  <div className="kpi-v">{euros(apres.value)}</div>
                  <div className="kpi-d">{delta(apres.value, avant.value)} vs avant</div>
                </div>
              </div>
              <div className="ac-box">
                <div className="ac-ttl">Ce qui a été fait :</div>
                {DEMO_ACTIONS.map((a, i) => (
                  <div key={i} className="ac-row">
                    <span className="check">✓</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <button className="cta" onClick={() => setEtape("offre")}>
                Voir l'offre →
              </button>
            </>
          )}

          {etape === "offre" && (
            <>
              <h1 className="ttl">L'offre Stratyx</h1>
              <p className="sub">Zone Nice Centre — exclusivité garantie</p>
              <div className="of-card">
                <div className="of-badge">Mois 1 offert</div>
                <div className="of-price">490 <span className="of-unit">€ / mois</span></div>
                <div className="of-sub">À partir du mois 2 · Sans engagement · Résiliable à tout moment</div>
                <ul className="of-list">
                  <li>Gestion complète de vos campagnes Google Ads</li>
                  <li>Rapport de performance chaque lundi matin</li>
                  <li>Alerte immédiate si le budget déraille</li>
                  <li>Disponible par WhatsApp pour vos questions</li>
                  <li className="of-hl">Exclusivité zone Nice Centre — aucun autre plombier dans mon portefeuille</li>
                </ul>
                <div className="of-roi">
                  <strong>Le calcul :</strong> {apres.conversions} appels × 60 % de closing × 650 € de chantier
                  moyen = <strong>{euros(Math.round(apres.conversions * 0.6 * 650))}</strong> de CA
                  pour <strong>490 € de gestion</strong> + {euros(Math.round(apres.cost))} de budget pub.
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </>
  );
}