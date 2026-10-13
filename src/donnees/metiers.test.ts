import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { iconeDeMetier } from "@/monde/metiers";
import { lireJeu, valider } from "./charger";
import { METIERS } from "./jeux";

describe("Métiers des Habitants (US-0307)", () => {
  const metiers = lireJeu(METIERS);
  const entree = (changement: object) => ({ id: "bucheron", nom: "Bûcheron", phrase: "rapporte du Bois des forêts", ordre: 1, ...changement });

  it("sont les huit, dans l'ordre : explorateur, chasseur, cueilleur, bûcheron, mineur, chercheur, bâtisseur, éleveur", () => {
    expect(metiers.map((m) => m.id)).toEqual(["explorateur", "chasseur", "cueilleur", "bucheron", "mineur", "chercheur", "batisseur", "eleveur"]);
    expect(metiers.map((m) => m.nom)).toEqual(["Explorateur", "Chasseur", "Cueilleur", "Bûcheron", "Mineur", "Chercheur", "Bâtisseur", "Éleveur"]);
    expect(metiers.map((m) => m.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("disent chacun, en une phrase courte, à quoi ils servent, à lire à la suite du nom", () => {
    expect(metiers.find((m) => m.id === "bucheron")?.phrase).toBe("rapporte du Bois des forêts");
    for (const m of metiers) {
      expect(m.phrase.length, m.id).toBeGreaterThan(10);
      expect(m.phrase.length, m.id).toBeLessThanOrEqual(60);
    }
  });

  it("disent quand ils serviront, sauf l'explorateur, qui part en Expédition (US-0911), et l'éleveur, qui soigne les Blessés (US-0955)", () => {
    expect(Object.fromEntries(metiers.map((m) => [m.id, m.servira ?? null]))).toEqual({
      explorateur: null,
      chasseur: "avec les Récoltes",
      cueilleur: "avec les Récoltes",
      bucheron: "avec les Récoltes",
      mineur: "avec les Récoltes",
      chercheur: "quand le cercle des sages sera bâti",
      batisseur: "avec les premières constructions",
      eleveur: null,
    });
  });

  it("ont chacun leur icône, rangée sous leur identifiant", () => {
    for (const m of metiers) expect(existsSync(join(process.cwd(), "public", iconeDeMetier(m.id))), m.id).toBe(true);
  });

  it("acceptent un Métier qui sert déjà : il n'a rien à attendre", () => {
    expect(METIERS.colonnes(valider(METIERS, [entree({})])[0])).toMatchObject({ id: "bucheron", servira: null });
  });

  it.each([
    ["une phrase vide", { phrase: " " }, "(phrase)"],
    ["une phrase qui commence par une majuscule", { phrase: "Rapporte du Bois" }, "(phrase) : une minuscule au début, sans point final"],
    ["une phrase qui finit par un point", { phrase: "rapporte du Bois." }, "(phrase) : une minuscule au début, sans point final"],
    ["un « servira » qui finit par un point", { servira: "avec les Récoltes." }, "(servira) : une minuscule au début, sans point final"],
    ["un identifiant accentué", { id: "bûcheron" }, "(id)"],
  ])("refusent %s, en disant où", (_, changement, message) => {
    expect(() => valider(METIERS, [entree(changement)])).toThrow(message);
  });
});
