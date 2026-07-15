import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ads-stratyx — pilote tes Google Ads avec Stratyx",
  description:
    "Connecte ton compte Google Ads à Stratyx et pilote tes campagnes en langage naturel.",
  // App privée : on interdit toute indexation par les moteurs de recherche.
  robots: { index: false, follow: false, nocache: true },
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
