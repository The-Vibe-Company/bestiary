import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireJeu, valider } from "./charger";
import { BIOMES, ESPECES, RARETES, ROLES, verifierReferences, type EntreeEspece } from "./jeux";

const essai: EntreeEspece = {
  id: "essai",
  nom: "Bête d'essai",
  masse_g: 20,
  arme: 1,
  vitesse: 2,
  regime: "omnivore",
  nourriture_g_par_jour: 4,
  biome: "prairie",
  rarete: "commune",
};

describe("fiche d'Espèce", () => {
  it("tire ses caractéristiques des mesures réelles, par le barème", () => {
    expect(valider(ESPECES, [essai])).toEqual([essai]);
    expect(ESPECES.colonnes(essai)).toMatchObject({ attaque: 473, vie: 473, taille: 1, charge: 5, biome_id: "prairie", role_id: null });
  });

  it.each([
    ["sans Biome", { biome: undefined }, /biome/],
    ["sans Rareté", { rarete: undefined }, /rarete/],
    ["sans régime", { regime: undefined }, /régime/],
    ["avec un régime inconnu", { regime: "frugivore" }, /régime/],
    ["sans masse", { masse_g: undefined }, /masse_g/],
    // US-0804 : la vitesse, que la fiche d'une Espèce affiche, ne manque jamais.
    ["sans vitesse", { vitesse: undefined }, /vitesse/],
    ["avec une arme négative", { arme: -1 }, /arme ne peut pas être négatif/],
  ])("refuse une Espèce %s", (_, changement, message) => {
    expect(() => valider(ESPECES, [{ ...essai, ...changement }])).toThrow(message);
  });

  it("ne renvoie qu'à des Biomes, Raretés et Rôles qui existent", () => {
    const connus = { biomes: ["prairie"], raretes: ["commune"], roles: ["eclaireur"] };
    expect(() => verifierReferences([essai], connus)).not.toThrow();
    expect(() => verifierReferences([{ ...essai, biome: "lune" }], connus)).toThrow(/Biome inconnu « lune »/);
    expect(() => verifierReferences([{ ...essai, role: "magicien" }], connus)).toThrow(/Rôle inconnu « magicien »/);
  });
});

describe("les trois premières Espèces", () => {
  const especes = lireJeu(ESPECES);
  const fiche = (id: string) => {
    const e = especes.find((x) => x.id === id);
    if (!e) throw new Error(`${id} absente`);
    return { entree: e, colonnes: ESPECES.colonnes(e) };
  };

  it("renvoient toutes à des Biomes, Raretés et Rôles qui existent", () => {
    const ids = (liste: { id: string }[]) => liste.map((x) => x.id);
    expect(() =>
      verifierReferences(especes, { biomes: ids(lireJeu(BIOMES)), raretes: ids(lireJeu(RARETES)), roles: ids(lireJeu(ROLES)) }),
    ).not.toThrow();
  });

  it.each([
    ["souris", null, 473, 473, 1],
    ["poule", "nourricier", 5981, 14953, 31.623],
    ["pigeon", "eclaireur", 1214, 4046, 8.556],
  ])("%s : commune, en prairie, Rôle %s, attaque %i, vie %i, %f Places", (id, role, attaque, vie, taille) => {
    const { entree, colonnes } = fiche(id);
    expect(entree).toMatchObject({ rarete: "commune", biome: "prairie" });
    expect(colonnes).toMatchObject({ role_id: role, attaque, vie, taille });
  });

  it.each(["souris", "poule", "pigeon"])("%s a son illustration, rangée dans public/illustrations", (id) => {
    const { illustration } = fiche(id).entree;
    expect(illustration).toBe(`especes/${id}.webp`);
    expect(existsSync(join(__dirname, "../../public/illustrations", illustration!))).toBe(true);
  });

  it("donnent à la souris l'avantage au combat à Places égales", () => {
    const parPlace = (id: string) => {
      const { attaque, taille } = fiche(id).colonnes as { attaque: number; taille: number };
      return attaque / taille;
    };
    expect(parPlace("souris")).toBeGreaterThan(parPlace("poule"));
    expect(parPlace("souris")).toBeGreaterThan(parPlace("pigeon"));
  });
});
