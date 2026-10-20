// Aucun essai sur base n'écrit dans une table des données de référence du jeu sans s'en faire d'abord une copie propre à
// sa transaction : tous les fichiers les rechargent en même temps (preparerMondeDeTest), et une ligne tenue le temps d'un
// essai les fait attendre, ou s'interbloquer (#65, #89).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ecrituresSansCopie } from "./donnees-de-reference";

/**
 * Les fichiers qui écrivent dans une table des données de référence sans copie : exactement ces tables, et pourquoi c'est
 * sans risque. Une table de plus, ou de moins, fait échouer l'essai : la liste suit le fichier.
 */
const PERMIS: Record<string, { tables: string[]; raison: string }> = {
  "src/donnees/especes.db.test.ts": {
    tables: ["biome", "espece", "rarete"],
    raison:
      "éprouve les contraintes de la table des Espèces elle-même, clés étrangères comprises, qu'une copie n'aurait pas : une ligne neuve, dans une transaction annulée aussitôt ; le Biome et la Rareté qu'elle demande, posés s'ils manquent, sans rien changer à ceux qui sont là",
  },
};

/** Les fichiers d'essais sur base du dépôt, chemin depuis sa racine. */
const essaisSurBase = () =>
  readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((chemin) => /\.db\.test\.tsx?$/.test(chemin))
    .map((chemin) => join("src", chemin))
    .sort();

describe("les essais sur base et les données de référence du jeu", () => {
  it("repère une écriture dans une table des données de référence, faite sans copie", () => {
    expect(ecrituresSansCopie(`await client.query("update espece set vitesse = 2.5 where id = 'souris'");`)).toEqual(["espece"]);
    expect(ecrituresSansCopie(`insert into "ressource" (id) values ('x')`)).toEqual(["ressource"]);
    expect(ecrituresSansCopie(`DELETE FROM production_biome where biome_id = 'prairie'`)).toEqual(["production_biome"]);
    // Les autres façons de tenir des lignes, les mêmes verrous que #65 et #89, et leurs variantes.
    expect(ecrituresSansCopie(`truncate rarete; merge into ressource using v on true when matched then update set x = 1; update only metier set x = 1; lock table biome in exclusive mode`)).toEqual([
      "biome",
      "metier",
      "rarete",
      "ressource",
    ]);
    expect(ecrituresSansCopie(`delete from only rarete; lock espece; lock table only metier in share mode; truncate biome, "role"`)).toEqual(["biome", "espece", "metier", "rarete", "role"]);
  });

  it("laisse passer celle qui se fait dans une copie propre à la transaction", () => {
    expect(ecrituresSansCopie(`create temp table espece on commit drop as table public.espece;\nupdate espece set vitesse = 2.5`)).toEqual([]);
    expect(ecrituresSansCopie(`create temporary table "metier" (like public."metier" including all) on commit drop;\nupdate metier set servira = null`)).toEqual([]);
    expect(ecrituresSansCopie(`create temp table if not exists espece on commit drop as table public.espece;\nupdate espece set vitesse = 2.5`)).toEqual([]);
  });

  it("ne compte que la copie de la table écrite, et jamais une écriture qui nomme la table du jeu", () => {
    expect(ecrituresSansCopie(`create temp table ressource on commit drop as table public.ressource;\nupdate espece set vitesse = 2.5`)).toEqual(["espece"]);
    expect(ecrituresSansCopie(`create temp table espece on commit drop as table public.espece;\nupdate public.espece set vitesse = 2.5`)).toEqual(["espece"]);
    expect(ecrituresSansCopie(`create temp table espece on commit drop as table public.espece;\nupdate "public"."espece" set vitesse = 2.5`)).toEqual(["espece"]);
  });

  it("compte le chargement des vrais fichiers de données comme une écriture dans toutes leurs tables, sauf dans des copies de chacune", () => {
    const charge = `for (const { jeu, entrees } of lireDonnees()) await chargerJeu(client, jeu, entrees);`;
    expect(ecrituresSansCopie(charge)).toEqual(expect.arrayContaining(["biome", "espece", "rarete", "ressource"]));
    const copies = `for (const table of tables) await client.query(\`create temp table "\${table}" (like public."\${table}" including all) on commit drop\`);\n`;
    expect(ecrituresSansCopie(copies + charge)).toEqual([]);
    // Quel que soit le nom de ce qui lit les fichiers, ou la liste des jeux parcourue.
    expect(ecrituresSansCopie(`for (const l of lireDonneesPour("x")) await chargerJeu(client, l.jeu, l.entrees);`)).toEqual(expect.arrayContaining(["biome", "espece", "rarete", "ressource"]));
    expect(ecrituresSansCopie(`for (const jeu of JEUX) await chargerJeu(client, jeu, lireJeu(jeu));`)).toEqual(expect.arrayContaining(["biome", "espece", "rarete", "ressource"]));
    // Un jeu d'essai propre au fichier, sans les vrais fichiers de données : pas une table du jeu.
    expect(ecrituresSansCopie(`await chargerJeu(client, jeu, entrees);`)).toEqual([]);
  });

  it("compte le chargement d'un seul jeu de données nommé comme une écriture dans sa table", () => {
    expect(ecrituresSansCopie(`await chargerJeu(client, METIERS, lireJeu(METIERS));`)).toEqual(["metier"]);
    expect(ecrituresSansCopie(`await chargerJeu(client, ESPECES_D_ESSAI, essais);`)).toEqual(["espece"]);
    expect(ecrituresSansCopie(`create temp table metier on commit drop as table public.metier;\nawait chargerJeu(client, METIERS, lireJeu(METIERS));`)).toEqual([]);
    // Nommer un jeu sans le charger n'écrit rien : lireJeu(METIERS) compare un fichier à la base.
    expect(ecrituresSansCopie(`expect(await lesMetiers(pool)).toEqual(lireJeu(METIERS));`)).toEqual([]);
    // Ni le nommer ailleurs que comme le jeu chargé : un jeu d'essai propre au fichier, à côté d'une constante du même nom.
    expect(ecrituresSansCopie(`const RESSOURCES = 3;\nawait chargerJeu(client, jeu, entrees); // pas ESPECES.colonnes`)).toEqual([]);
    expect(ecrituresSansCopie(`await chargerJeu(\n  client,\n  ESPECES_D_ESSAI,\n  essais,\n);`)).toEqual(["espece"]);
  });

  it("ne confond pas une table du jeu avec une autre qui en commence le nom, ni avec une table qui n'en est pas", () => {
    expect(ecrituresSansCopie(`update especes_essai set x = 1; insert into expedition (id) values (1); update biome_x set y = 2`)).toEqual([]);
  });

  it("aucun essai sur base n'écrit dans une table des données de référence sans copie, hors des cas permis, dits table par table", () => {
    const fichiers = essaisSurBase();
    expect(fichiers.length).toBeGreaterThan(100);
    const fautifs = fichiers.filter((f) => !(f in PERMIS)).map((f) => [f, ecrituresSansCopie(readFileSync(f, "utf8"))]).filter(([, tables]) => tables.length > 0);
    expect(fautifs).toEqual([]);
    // Chaque cas permis écrit encore sans copie, dans ces tables-là et pas une de plus : sinon la liste change avec lui.
    for (const [f, { tables }] of Object.entries(PERMIS)) expect(ecrituresSansCopie(readFileSync(f, "utf8")), f).toEqual(tables);
  });
});
