import type { Metadata } from "next";
import Link from "next/link";
import FormulaireZone from "./FormulaireZone";
import "../artisans.css";
import "./ma-zone.css";

export const metadata: Metadata = {
  title: "Vérifier ma zone — Stratyx",
  description:
    "Une seule place par métier et par commune dans les Alpes-Maritimes et le Var. Vérifiez si la vôtre est encore libre. Réponse sous 24 h, sans engagement.",
  robots: { index: true, follow: true },
};

export default function MaZonePage() {
  return (
    <main className="art zone">
      <header className="zone-hero">
        <Link className="zone-retour" href="/artisans">
          ← Retour
        </Link>
        <span className="pill">Alpes-Maritimes · Var</span>
        <h1>Votre zone est-elle encore libre ?</h1>
        <p className="subtitle">
          Nous ne travaillons qu&apos;avec un artisan par métier et par commune.
          Dites-nous les vôtres, nous vous répondons sous 24 h ouvrées — que la
          place soit disponible ou non.
        </p>
      </header>

      <section className="zone-corps">
        <FormulaireZone />

        <aside className="zone-aparte card">
          <h2>Ce qui se passe ensuite</h2>
          <ol>
            <li>
              <strong>Nous vérifions la place.</strong> Si elle est prise, vous
              le saurez tout de suite et nous ne vous relancerons pas.
            </li>
            <li>
              <strong>Nous vous appelons.</strong> Trente minutes : panier moyen,
              zone d&apos;intervention, capacité à décrocher le téléphone.
            </li>
            <li>
              <strong>Vous repartez avec un chiffre.</strong> Ce que vous pouvez
              payer un appel sans perdre d&apos;argent — que vous travailliez avec
              nous ou non.
            </li>
          </ol>
          <p className="zone-aide">
            Pas de devis à signer à ce stade, pas d&apos;engagement de durée
            ensuite.
          </p>
        </aside>
      </section>
    </main>
  );
}
