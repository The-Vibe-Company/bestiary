import type { Metadata, Viewport } from "next";
import { BarreHaut } from "@/components/BarreHaut";
import { polices } from "@/styles/fonts";
import "@/styles/palette.css";
import "@/styles/typographie.css";
import "@/styles/formes.css";
import couleurs from "./couleurs-app.json";
import "./globals.css";

export const metadata: Metadata = {
  // Chaque page peut compléter le titre : « Bestia · Accueil ».
  title: { default: "Bestia", template: "Bestia · %s" },
  appleWebApp: { title: "Bestia", capable: true, statusBarStyle: "black-translucent" },
  description: "Un monde sauvage, des bêtes à apprivoiser. Faites votre sac : l'aventure vous attend.",
  // Le commit d'où vient la version en ligne, lisible dans le code de la page.
  other: { "bestia-version": process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" },
};

// La barre du navigateur sur mobile prend la couleur Encre du blason du loup. La page est sombre : le navigateur le sait
// dès le HTML de départ (color-scheme), et n'y peint jamais son blanc par défaut. La page s'étend sous l'encoche, et en
// laisse les bords libres (US-0164).
export const viewport: Viewport = { themeColor: couleurs.encre, colorScheme: "dark", viewportFit: "cover" };

// `actions` : ce que le haut de l'écran montre, rempli par chaque page (src/app/@actions) : dans le jeu, le nom du chef,
// la navigation, les Stocks et le compteur d'Habitants, posés dans la barre du haut.
// Le fond de la page est posé sur <html> même, avant toute feuille de style : la sarcelle la plus sombre, celle des
// bords du jeu. Une fois les feuilles chargées, --fond-de-page le reprend (globals.css), clair au contrôle.
export default function RootLayout({ children, actions }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={polices} style={{ backgroundColor: `var(--fond-de-page, ${couleurs.abysse})` }}>
      <body>
        <BarreHaut actions={actions} />
        {children}
      </body>
    </html>
  );
}
