import { Bree_Serif, Nunito_Sans } from "next/font/google";

// Les polices du jeu, hébergées par Next avec lui, chacune avec sa police de secours réglée aux mêmes dimensions : rien
// ne saute à l'affichage. Le sous-ensemble « latin » couvre les caractères du jeu (é, è, ê, à, ç, œ, É…). Chacune pose sa
// variable CSS sur la page (layout.tsx) ; typographie.css en fait les noms que les pages emploient.

/** Les titres : une serif à empattements carrés, franche et chaleureuse (une seule graisse). */
export const breeSerif = Bree_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bree",
  display: "swap",
});

/** Le texte, les nombres, les boutons et les étiquettes : arrondie et lisible petite ; 600 à 800 pour ce qui compte. */
export const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito-sans",
  display: "swap",
});

/** Les deux variables, à poser ensemble sur la page (layout.tsx). */
export const polices = [breeSerif, nunitoSans].map((police) => police.variable).join(" ");
