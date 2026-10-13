import { describe, expect, it } from "vitest";
import { lireUnRetour, medaillonDuRecit, minutesDUneDuree, sorteDUnFait } from "./lecture-du-recit";

describe("la lecture d'un Récit sur la page Récits", () => {
  it("lit une durée telle que le jeu l'écrit, en minutes", () => {
    expect(["40 min", "2 h", "2 h 40", "1 j", "1 j 3 h", "bientôt"].map(minutesDUneDuree)).toEqual([40, 120, 160, 1440, 1620, null]);
  });

  it("lit un retour d'Expédition : ses faits sans la ligne des durées, ses durées, le Biome de sa destination", () => {
    expect(
      lireUnRetour(
        "Destination : Prairie, à 8 Cases de votre Foyer.\nAller 2 h 40, séjour 4 h, retour 2 h 40.\n21 Cases sont sorties du brouillard.\nUne Bête s'est montrée.",
      ),
    ).toEqual({
      faits: ["Destination : Prairie, à 8 Cases de votre Foyer.", "21 Cases sont sorties du brouillard.", "Une Bête s'est montrée."],
      durees: { aller: 160, sejour: 240, retour: 160 },
      biome: "Prairie",
    });
  });

  it("lit un retour rappelé sans séjour, sa destination encore inconnue, sa ligne de rappel gardée (US-0920)", () => {
    expect(
      lireUnRetour(
        "Destination : Case inconnue, à 5 Cases de votre Foyer.\nRappelée à l'aller le 9 octobre à 14:50.\nAller 50 min, sans séjour, retour 50 min.\nAucune Case n'est sortie du brouillard.\nAucune Bête ne s'est montrée.",
      ),
    ).toEqual({
      faits: [
        "Destination : Case inconnue, à 5 Cases de votre Foyer.",
        "Rappelée à l'aller le 9 octobre à 14:50.",
        "Aucune Case n'est sortie du brouillard.",
        "Aucune Bête ne s'est montrée.",
      ],
      durees: { aller: 50, sejour: 0, retour: 50 },
      biome: "Case inconnue",
    });
  });

  it("garde en fait une ligne qu'elle ne sait pas lire : rien du texte ne se perd", () => {
    expect(lireUnRetour("Aller longtemps, séjour 4 h, retour 2 h.\nUne Bête s'est montrée.")).toEqual({
      faits: ["Aller longtemps, séjour 4 h, retour 2 h.", "Une Bête s'est montrée."],
      durees: null,
      biome: null,
    });
  });

  it("donne à chaque sorte de Récit son médaillon ; à une guérison de Blessés, l'éleveur, comme la Réserve (US-0954)", () => {
    expect(
      [
        "Retour d'Expédition",
        "Fin de la Famine",
        "2 Voyageurs ont repris la route",
        "Lumi a rejoint le Territoire",
        "Lumi a quitté le Territoire",
        "3 Blessés ont guéri",
        "1 Blessé a guéri",
      ].map(medaillonDuRecit),
    ).toEqual([
      "/illustrations/metiers/explorateur.webp",
      "/illustrations/ressources/vegetaux.webp",
      "/illustrations/icones/habitants.webp",
      "/illustrations/icones/habitants.webp",
      "/illustrations/icones/habitants.webp",
      "/illustrations/metiers/eleveur.webp",
      "/illustrations/metiers/eleveur.webp",
    ]);
  });

  it("reconnaît les faits d'un combat, de ses pertes, de la fuite et d'une Bête partie ailleurs, pour les marquer (US-0947, US-0951, US-0964)", () => {
    expect(
      [
        "Combat le 14 octobre à 09:59 : Loup gris, de force 173 205, contre votre escorte, de force 170 280.",
        "Attaque le 14 octobre à 10:30 : Loup gris, de force 173 205, contre vos explorateurs, sans escorte.",
        "Pertes au combat : Souris grise (2 morts, 1 Blessé) et Pigeon biset (2 Blessés).",
        "Aucune perte.",
        "Vos explorateurs ont fui et sont tous rentrés au Foyer.",
        "Poule a suivi une autre Expédition.",
        "Écureuil roux et Lièvre ont suivi d'autres Expéditions.",
        "Pigeon biset n'était plus sur la Case à votre arrivée.",
        "Une Bête s'est montrée.",
        "Destination : Prairie, à 8 Cases de votre Foyer.",
      ].map(sorteDUnFait),
    ).toEqual(["combat", "combat", "pertes", "pertes", "fuite", "ailleurs", "ailleurs", "ailleurs", null, null]);
  });
});
