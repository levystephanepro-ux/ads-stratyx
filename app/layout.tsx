import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratyx — pilote tes Google Ads en langage naturel",
  description:
    "Copilote IA + agents autonomes pour tes campagnes Google Ads. Audits, rapports " +
    "quotidiens par email, optimisations — en français, sans regex ni tableurs. " +
    "Essai gratuit 14 jours.",
  // La landing est indexable ; les pages de l'app sont derrière le login.
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning : certaines extensions navigateur (Google Tag
    // Assistant, etc.) injectent des attributs sur <html> avant l'hydratation,
    // ce qui déclenche un faux mismatch. Ça n'affecte que cet élément.
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique le thème sauvegardé avant le premier rendu pour éviter le flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ads-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();` }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
