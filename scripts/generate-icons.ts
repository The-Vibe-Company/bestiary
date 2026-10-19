// Fabrique les icônes du jeu à partir de la palette, et les couleurs que l'application lit hors des feuilles de style :
// npm run icones. À relancer si l'Encre, le citron, le fond ou la sarcelle la plus sombre changent (un test le rappelle).
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { paletteHex } from "./lib/couleurs";

const palette = readFileSync("src/styles/palette.css", "utf8");
const encre = paletteHex(palette, "--encre");
const citron = paletteHex(palette, "--citron");
const fond = paletteHex(palette, "--fond");
// Le fond de la page avant toute feuille de style (src/app/layout.tsx).
const abysse = paletteHex(palette, "--sarcelle-abysse");

const TETE = "M8 9 L18 17 L30 17 L40 9 L38 25 L31 37 L24 42 L17 37 L10 25 Z";
const YEUX = "M18 27 L22 28.5 L18 30 Z M30 27 L26 28.5 L30 30 Z M21.5 35 L24 37.5 L26.5 35 Z";

// L'icône d'onglet du prototype : la tête de loup sur une tuile Encre arrondie.
const onglet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="${encre}"/><path d="${TETE}" fill="${citron}"/><path d="${YEUX}" fill="${encre}"/></svg>\n`;

// L'icône d'application : fond plein (le téléphone arrondit lui-même les coins), loup réduit
// pour rester dans la zone que les masques ronds ne coupent jamais.
const application = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${encre}"/><g transform="translate(24 25) scale(0.72) translate(-24 -25)"><path d="${TETE}" fill="${citron}"/><path d="${YEUX}" fill="${encre}"/></g></svg>`;

async function png(svg: string, size: number, out: string) {
  await sharp(Buffer.from(svg), { density: 72 * (size / 48) * 2 }).resize(size, size).png().toFile(out);
}

async function main() {
  writeFileSync("src/app/icon.svg", onglet);
  await png(application, 180, "src/app/apple-icon.png");
  await png(application, 192, "public/icone-192.png");
  await png(application, 512, "public/icone-512.png");
  writeFileSync("src/app/couleurs-app.json", JSON.stringify({ encre, citron, fond, abysse }, null, 2) + "\n");
  console.log(`Icônes fabriquées (Encre ${encre}, citron ${citron}).`);
}

void main();
