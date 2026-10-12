import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerCompte } from "@/comptes/compte";
import { calculerEmpreinte } from "@/comptes/empreinte";
import { recevoirLesBetesDeNaissance } from "@/monde/betes-de-naissance";
import { choisirCaseDeNaissance } from "@/monde/foyers";
import { distance } from "@/monde/hex";
import { foyerDuTerritoire, marquerRecitLu } from "@/monde/territoire";
import { BETES_DE_NAISSANCE } from "@/reglages";
import { maintenant } from "@/temps/horloge";
import { LETTRES_SANS_MOT_INTERDIT, mondeDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { chefDuCompte, enregistrerNomDeChef, naitreSurLaCouronne, nomDejaPris, nomInterdit } from "./chef";
import { caractereRefuse, cleDuNom, NOM_NON_AUTORISE, NOM_TROP_COURT } from "./nom";

/**
 * Le Monde d'essai de ce fichier : ses naissances y ont lieu, sauf celles qui portent sur le Monde du jeu (chefDuCompte,
 * naitreSurLaCouronne). La Couronne d'Aube, partagée par toute la suite, n'aurait pas la place de ses rafales.
 */
const MONDE_D_ESSAI = "Essai des chefs (US-0153)";

describe.skipIf(!URL_TEST)("chef d'un compte (sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `chef-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  const nouveauCompte = async () => (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
  /** Le nombre de chefs du compte, dans tous les Mondes. */
  const chefsDu = async (compteId: number) => (await pool.query<{ n: number }>("select count(*)::int as n from chef where compte_id = $1", [compteId])).rows[0].n;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    // Aucun mot interdit ne finit par l'une des lettres de la fin des noms d'essai (suffixeDEssai, nomUnique).
    const { rows } = await pool.query("select mot from mot_interdit where right(mot, 1) = any($1::text[])", [[...LETTRES_SANS_MOT_INTERDIT]]);
    expect(rows).toEqual([]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("n'existe pas pour un compte qui vient d'être créé", async () => {
    const compte = await nouveauCompte();
    expect(await chefDuCompte(pool, compte.id)).toBeNull();
  });

  it("porte le nom choisi dans le Monde du jeu", async () => {
    const compte = await nouveauCompte();
    await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), 'Ourse', $2)", [compte.id, `ourse${numero}${lancement.replace(/[^a-z0-9]/g, "")}`]);
    expect(await chefDuCompte(pool, compte.id)).toEqual({ nom: "Ourse", territoireId: null, recitLu: false, betesAttendues: false });
  });

  it("n'est pas celui d'un autre Monde", async () => {
    const compte = await nouveauCompte();
    const { rows } = await pool.query("insert into monde (nom) values ($1) returning id", [`${lancement}-monde`]);
    await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, $2, 'Lynx', 'lynx')", [compte.id, rows[0].id]);
    expect(await chefDuCompte(pool, compte.id)).toBeNull();
  });

  it("n'en a qu'un par Monde", async () => {
    const compte = await nouveauCompte();
    const ajouter = (nom: string) =>
      pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
        compte.id,
        nom,
        `${cleDuNom(nom)}${numero}${lancement.replace(/[^a-z0-9]/g, "")}`,
      ]);
    await ajouter("Ourse");
    await expect(ajouter("Lynx")).rejects.toMatchObject({ constraint: "chef_un_par_monde" });
  });

  /**
   * La fin des noms de ce lancement (suffixeDEssai) : aucun mot interdit ne les refuse, et tous les chefs nés au même
   * instant naissent.
   */
  const suffixe = suffixeDEssai();
  /** Un nom propre à ce lancement, pour ne pas croiser les chefs des autres essais. */
  const nomUnique = (base: string) => `${base}${suffixe}`.slice(0, 16);
  const nommer = async (nom: string) => {
    const compte = await nouveauCompte();
    return pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
      compte.id,
      nom,
      cleDuNom(nom),
    ]);
  };

  it("sait qu'un nom est déjà pris, majuscules, accents et signes mis à part (US-0135)", async () => {
    const nom = nomUnique("Élan");
    expect(await nomDejaPris(pool, nom)).toBe(false);
    await nommer(nom);
    expect(await nomDejaPris(pool, nom)).toBe(true);
    expect(await nomDejaPris(pool, nom.replace("Élan", "e-LAN"))).toBe(true);
    expect(await nomDejaPris(pool, nom.replace("Élan", "Élans"))).toBe(false);
  });

  it("refuse en base deux noms jugés identiques dans le même Monde", async () => {
    const nom = nomUnique("Cœur");
    await nommer(nom);
    await expect(nommer(nom.replace("Cœur", "Coeur"))).rejects.toMatchObject({ constraint: "chef_nom_unique_dans_le_monde" });
  });

  it("refuse en base une forme de comparaison qui ne serait pas à plat", async () => {
    const compte = await nouveauCompte();
    await expect(
      pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), 'Élan', 'Élan')", [compte.id]),
    ).rejects.toMatchObject({ constraint: "chef_cle_nom_a_plat" });
  });

  describe("enregistrer le nom (US-0137)", () => {
    it("enregistre le nom nettoyé, avec sa forme de comparaison", async () => {
      const compte = await nouveauCompte();
      const nom = nomUnique("Ours Brun");
      expect(await enregistrerNomDeChef(pool, compte.id, `  ${nom.replace(" ", "   ")} `)).toEqual({ statut: "enregistre", nom });
      expect(await chefDuCompte(pool, compte.id)).toMatchObject({ nom, territoireId: expect.any(Number) });
      const { rows } = await pool.query("select cle_nom from chef where compte_id = $1", [compte.id]);
      expect(rows[0].cle_nom).toBe(cleDuNom(nom));
    });

    it("refait toutes les règles, sans rien enregistrer d'un nom refusé", async () => {
      const compte = await nouveauCompte();
      expect(await enregistrerNomDeChef(pool, compte.id, "Ou")).toEqual({ statut: "refuse", erreur: NOM_TROP_COURT });
      expect(await enregistrerNomDeChef(pool, compte.id, "Loup@")).toEqual({ statut: "refuse", erreur: caractereRefuse("@") });
      expect(await enregistrerNomDeChef(pool, compte.id, "    ")).toEqual({ statut: "refuse", erreur: NOM_TROP_COURT });
      expect(await chefDuCompte(pool, compte.id)).toBeNull();
    });

    it("dit qu'un nom est pris, majuscules, accents et signes mis à part", async () => {
      const premier = await nouveauCompte();
      const second = await nouveauCompte();
      const nom = nomUnique("Élan");
      await enregistrerNomDeChef(pool, premier.id, nom.replace("Élan", "Elan"), Math.random, mondeId);
      expect(await enregistrerNomDeChef(pool, second.id, nom.toUpperCase(), Math.random, mondeId)).toEqual({ statut: "pris" });
      expect(await chefsDu(second.id)).toBe(0);
    });

    /** Des connexions déjà ouvertes : sinon leur ouverture, une à une, étalerait la rafale. */
    const chaufferLePool = () => Promise.all(Array.from({ length: 10 }, () => pool.query("select pg_sleep(0.2)")));

    it("ne donne le nom qu'à un seul des chefs qui le veulent au même instant", async () => {
      const comptes = await Promise.all(Array.from({ length: 10 }, () => nouveauCompte()));
      const nom = nomUnique("Rafale");
      await chaufferLePool();
      const resultats = await Promise.all(comptes.map((compte) => enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)));
      expect(resultats.filter((r) => r.statut === "enregistre")).toHaveLength(1);
      expect(resultats.filter((r) => r.statut === "pris")).toHaveLength(9);
      const { rows } = await pool.query("select count(*)::int as n from chef where cle_nom = $1", [cleDuNom(nom)]);
      expect(rows[0].n).toBe(1);
    });

    it("traite un double appui du même joueur comme un seul", async () => {
      const compte = await nouveauCompte();
      const nom = nomUnique("Double");
      await chaufferLePool();
      const resultats = await Promise.all([enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId), enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)]);
      expect(resultats).toEqual([
        { statut: "enregistre", nom },
        { statut: "enregistre", nom },
      ]);
      const { rows } = await pool.query("select count(*)::int as n from chef where compte_id = $1", [compte.id]);
      expect(rows[0].n).toBe(1);
    });
  });

  describe("noms interdits, avec la liste de la base (US-0138)", () => {
    it.each(["Connard42", "Bestia Officiel", "BestiaTeam", "Le Con", "Admin", "P3d0", "Salooope", "C-o-n-n-a-r-d"])("refuse « %s »", async (nom) => {
      expect(await nomInterdit(pool, nom)).toBe(true);
    });

    it.each(["Conquête", "Faucon", "Leçon", "Dispute", "Badminton", "Communiquer", "Unique", "Violon", "Pornic", "Habite", "Nazim", "Niger", "Fagot", "Kaki", "Dickens", "Culotte", "Ourse"])(
      "laisse passer « %s »",
      async (nom) => {
        expect(await nomInterdit(pool, nom)).toBe(false);
      },
    );

    it("refuse un nom interdit à l'enregistrement, sans rien enregistrer", async () => {
      const compte = await nouveauCompte();
      expect(await enregistrerNomDeChef(pool, compte.id, "Connard42")).toEqual({ statut: "refuse", erreur: NOM_NON_AUTORISE });
      expect(await chefDuCompte(pool, compte.id)).toBeNull();
    });
  });

  describe("naître sur la Couronne (US-0153)", () => {
    /** La Case possédée par le chef d'un compte. */
    const caseDu = async (compteId: number) => {
      const { rows } = await pool.query(
        `select c.q, c.r, c.couronne, c.biome_id as biome from case_du_monde c join chef ch on ch.id = c.chef_id where ch.compte_id = $1`,
        [compteId],
      );
      return rows;
    };

    it("donne au nouveau chef une Case libre de la Couronne, en prairie, à lui seul", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Naissance"), Math.random, mondeId);
      const cases = await caseDu(compte.id);
      expect(cases).toHaveLength(1);
      expect(cases[0]).toMatchObject({ couronne: true, biome: "prairie" });
    });

    it("fait de cette Case son Foyer, imprenable, seule Case de son Territoire (US-0155)", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Foyer"), Math.random, mondeId);
      const { rows } = await pool.query(
        `select t.foyer_case_id = c.id as foyer, c.imprenable,
           (select count(*)::int from case_du_monde where chef_id = ch.id) as cases
         from territoire t join chef ch on ch.id = t.chef_id join case_du_monde c on c.chef_id = ch.id
         where ch.compte_id = $1`,
        [compte.id],
      );
      expect(rows).toEqual([{ foyer: true, imprenable: true, cases: 1 }]);
    });

    it("fait naître le chef suivant parmi les 5 emplacements libres les plus proches du dernier arrivé", async () => {
      // Dans le Monde d'essai de ce fichier, aucun autre fichier ne fait naître de chef entre les deux.
      const premier = await nouveauCompte();
      const second = await nouveauCompte();
      await enregistrerNomDeChef(pool, premier.id, nomUnique("Aîné"), Math.random, mondeId);
      // Les 5 emplacements possibles juste avant la naissance du second, selon la règle elle-même.
      const { rows: libres } = await pool.query("select q, r, biome_id as biome from case_du_monde where monde_id = $1 and couronne and chef_id is null", [mondeId]);
      const { rows: foyers } = await pool.query(
        `select c.q, c.r from territoire t join case_du_monde c on c.id = t.foyer_case_id join chef ch on ch.id = t.chef_id
         where c.monde_id = $1 order by ch.cree_le desc, ch.id desc`,
        [mondeId],
      );
      const possibles = new Set([0, 1, 2, 3, 4].map((i) => choisirCaseDeNaissance(libres, foyers, foyers[0], () => i / 5)).map((c) => `${c?.q},${c?.r}`));
      await enregistrerNomDeChef(pool, second.id, nomUnique("Cadet"), Math.random, mondeId);
      const [a] = await caseDu(premier.id);
      const [b] = await caseDu(second.id);
      expect(foyers[0]).toEqual({ q: a.q, r: a.r });
      expect(possibles.has(`${b.q},${b.r}`)).toBe(true);
      expect(distance(a, b)).toBeGreaterThanOrEqual(4);
    });

    it("ne donne qu'une Case pour un double appui, et aucune à qui n'obtient pas le nom", async () => {
      const compte = await nouveauCompte();
      const autre = await nouveauCompte();
      const nom = nomUnique("Unique");
      await Promise.all([
        enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId),
        enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId),
        enregistrerNomDeChef(pool, autre.id, nom, Math.random, mondeId),
      ]);
      // Le premier arrivé, l'un ou l'autre, obtient le nom et une seule Case ; l'autre aucune.
      const cases = [(await caseDu(compte.id)).length, (await caseDu(autre.id)).length].sort();
      expect(cases).toEqual([0, 1]);
    });

    it("donne des Cases différentes, bien espacées, à des chefs qui naissent au même instant", async () => {
      const comptes = await Promise.all(Array.from({ length: 8 }, () => nouveauCompte()));
      await Promise.all(Array.from({ length: 10 }, () => pool.query("select pg_sleep(0.2)")));
      const noms = ["Abeille", "Bison", "Castor", "Daim", "Écureuil", "Faon", "Gerboise", "Hérisson"];
      await Promise.all(comptes.map((compte, i) => enregistrerNomDeChef(pool, compte.id, nomUnique(noms[i]), Math.random, mondeId)));
      const cases = (await Promise.all(comptes.map((compte) => caseDu(compte.id)))).map((c) => c[0]);
      expect(cases.every(Boolean)).toBe(true);
      for (const [i, a] of cases.entries()) for (const b of cases.slice(i + 1)) expect(distance(a, b)).toBeGreaterThanOrEqual(4);
    });

    it("donne 30 Cases différentes, toutes bien espacées, à 30 chefs qui naissent au même instant (US-0154)", async () => {
      // Trente comptes d'un coup, avec une seule empreinte de mot de passe : la calculer trente fois
      // à la fois prendrait des gigaoctets de mémoire et étoufferait les autres tests.
      const empreinte = await calculerEmpreinte("une phrase de passe");
      const { rows: comptes } = await pool.query<{ id: number }>(
        "insert into compte (email, empreinte_mot_de_passe) select $1 || '-rafale-' || n || '@essai.test', $2 from generate_series(1, 30) as n returning id",
        [lancement, empreinte],
      );
      // De la patience, pas plus de connexions (les naissances passent de toute façon une par une) :
      // depuis un poste loin de la base, trente naissances durent plus que le délai d'attente habituel.
      const rafale = poolDeTest({ connectionTimeoutMillis: 60_000 });
      await Promise.all(Array.from({ length: 10 }, () => rafale.query("select pg_sleep(0.2)")));
      const resultats = await Promise.all(
        comptes.map((compte, i) =>
          enregistrerNomDeChef(rafale, compte.id, nomUnique(`Rafale${String.fromCharCode(97 + (i % 26))}${i >= 26 ? "z" : ""}`), Math.random, mondeId),
        ),
      );
      await rafale.end();
      expect(resultats.every((r) => r.statut === "enregistre")).toBe(true);
      const cases = (await Promise.all(comptes.map((compte) => caseDu(compte.id)))).map((c) => c[0]);
      expect(new Set(cases.map((c) => `${c.q},${c.r}`)).size).toBe(30);
      for (const [i, a] of cases.entries()) for (const b of cases.slice(i + 1)) expect(distance(a, b)).toBeGreaterThanOrEqual(4);
      // Depuis un poste loin de la base, une naissance prend près d'une demi-seconde : trente à la suite, une quinzaine.
    }, 90_000);

    it("règle le marque-page du temps du Territoire sur sa naissance, à l'heure du jeu (US-0156)", async () => {
      const compte = await nouveauCompte();
      const avant = maintenant();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Horloge"), Math.random, mondeId);
      const apres = maintenant();
      const { rows } = await pool.query(
        "select t.ne_le, t.calcule_jusqu_a from territoire t join chef ch on ch.id = t.chef_id where ch.compte_id = $1",
        [compte.id],
      );
      expect(rows[0].calcule_jusqu_a).toEqual(rows[0].ne_le);
      expect(rows[0].ne_le.getTime()).toBeGreaterThanOrEqual(avant.getTime());
      expect(rows[0].ne_le.getTime()).toBeLessThanOrEqual(apres.getTime());
    });

    it("dit le Biome du Foyer de son Territoire : la prairie (US-0157)", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Prairial"), Math.random, mondeId);
      // Et le nom du Monde de ce Foyer : ici, le Monde d'essai.
      const territoireId = (await territoireDuCompte(pool, compte.id))!;
      expect(await foyerDuTerritoire(pool, territoireId)).toEqual({ biome: { id: "prairie", nom: "Prairie" }, monde: MONDE_D_ESSAI });
      expect(await foyerDuTerritoire(pool, -1)).toBeNull();
    });

    it("ne donne le récit d'arrivée qu'une fois, avec le nom du Monde (US-0158)", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Conteur"));
      const { territoireId } = (await chefDuCompte(pool, compte.id))!;
      expect(await foyerDuTerritoire(pool, territoireId!)).toMatchObject({ monde: "Aube" });
      expect(await marquerRecitLu(pool, territoireId!, maintenant())).toBe(true);
      expect(await marquerRecitLu(pool, territoireId!, maintenant())).toBe(false);
      expect(await chefDuCompte(pool, compte.id)).toMatchObject({ recitLu: true });
    });

    it("donne un Foyer à un chef qui n'en avait pas, une seule fois (US-0160)", async () => {
      const compte = await nouveauCompte();
      const nom = nomUnique("Ancien");
      // Un chef d'avant les Foyers : son nom, sans Case ni Territoire.
      await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
        compte.id,
        nom,
        cleDuNom(nom),
      ]);
      const territoireId = await naitreSurLaCouronne(pool, compte.id);
      expect(territoireId).toEqual(expect.any(Number));
      expect(await chefDuCompte(pool, compte.id)).toEqual({ nom, territoireId, recitLu: false, betesAttendues: false });
      expect(await caseDu(compte.id)).toHaveLength(1);
      expect(await naitreSurLaCouronne(pool, compte.id)).toBe(territoireId);
      expect(await caseDu(compte.id)).toHaveLength(1);
    });

    it("libère la Case d'un compte supprimé, qui redevient prenable", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Passant"), Math.random, mondeId);
      const [c] = await caseDu(compte.id);
      await pool.query("delete from compte where id = $1", [compte.id]);
      const { rows } = await pool.query("select chef_id, imprenable from case_du_monde where q = $1 and r = $2 and monde_id = $3", [c.q, c.r, mondeId]);
      expect(rows[0]).toEqual({ chef_id: null, imprenable: false });
    });
  });

  describe("les Bêtes de naissance (US-0975)", () => {
    /** Les Bêtes de naissance du Territoire du chef d'un compte : leur arrivée, et la naissance de son Territoire. */
    const betesDu = async (compteId: number) =>
      (
        await pool.query<{ arrivee: Date; neLe: Date }>(
          `select b.arrivee, t.ne_le as "neLe" from chef ch join territoire t on t.chef_id = ch.id join bete_de_naissance b on b.territoire_id = t.id
           where ch.compte_id = $1`,
          [compteId],
        )
      ).rows;

    it("arrivent avec le Foyer, par l'un et l'autre chemin de la naissance", async () => {
      const nouveau = await nouveauCompte();
      await enregistrerNomDeChef(pool, nouveau.id, nomUnique("Pisteur"));
      const ancien = await nouveauCompte();
      const nom = nomUnique("Traqueur");
      // Un chef d'avant les Foyers (US-0160), qui reçoit le sien à son retour.
      await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
        ancien.id,
        nom,
        cleDuNom(nom),
      ]);
      await naitreSurLaCouronne(pool, ancien.id);
      for (const compte of [nouveau, ancien]) {
        const betes = await betesDu(compte.id);
        expect(betes).toHaveLength(BETES_DE_NAISSANCE);
        for (const b of betes) expect(b.arrivee).toEqual(b.neLe);
        expect(await chefDuCompte(pool, compte.id)).toMatchObject({ betesAttendues: false });
      }
    });

    it("dit qu'un Territoire né avant elles les attend encore, jusqu'à ce qu'il les reçoive", async () => {
      const compte = await nouveauCompte();
      await enregistrerNomDeChef(pool, compte.id, nomUnique("Revenant"));
      const { territoireId } = (await chefDuCompte(pool, compte.id))!;
      await pool.query("delete from bete_de_naissance where territoire_id = $1", [territoireId]);
      await pool.query("update territoire set betes_de_naissance_le = null where id = $1", [territoireId]);
      expect(await chefDuCompte(pool, compte.id)).toMatchObject({ betesAttendues: true });
      expect(await recevoirLesBetesDeNaissance(pool, territoireId!, maintenant())).toBe(BETES_DE_NAISSANCE);
      expect(await chefDuCompte(pool, compte.id)).toMatchObject({ betesAttendues: false });
    });
  });
});

