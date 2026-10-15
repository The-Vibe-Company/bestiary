// US-0972 : un pigeon parti dans l'escorte combat comme toute Bête, il compte dans la force et risque les mêmes pertes ;
// il ne lève pas plus de brouillard : seuls les Éclaireurs (US-0976) le font (US-0969) ; et le récit du retour distingue
// les pigeons partis en escorte de ceux partis comme Éclaireurs. Les Expéditions des essais séjournent là où rien ne se
// montre : aucune Rencontre, donc aucun combat que celui que l'essai livre lui-même, contre la plus forte des Espèces.
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { casesDecouvertes } from "@/monde/brouillard";
import { betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { casesRevelees } from "./brouillard";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";
import { forcesDesEscortes } from "./forces-en-base";
import { subirLesCombats } from "./pertes";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";

const MINUTE = 60_000;
/** La distance de la destination des essais au Foyer, en Cases. */
const DISTANCE = 3;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du pigeon parti en escorte (US-0972)";

describe.skipIf(!URL_TEST)("un pigeon en escorte n'éclaire pas (US-0972, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La plus forte des Espèces du jeu : contre elle, toute escorte perd toutes ses Bêtes. */
  let fort: string;
  /** Le pigeon : sa force et sa vitesse. */
  let pigeon: { nom: string; force: number; vitesse: number };
  const lancement = `pigeon-escorte-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);
  const cle = ({ q, r }: Coordonnees) => `${q},${r}`;

  /** Un chef qui vient de naître dans le Monde d'essai, avec un explorateur et `pigeons` pigeons mâles au Foyer. */
  const naitre = async (pigeons: number) => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Pig", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur')`,
      [territoireId],
    );
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'pigeon', 'male', $2)", [territoireId, pigeons]);
    const { rows } = await pool.query<Coordonnees>("select f.q, f.r from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1", [
      territoireId,
    ]);
    return { territoireId, foyer: rows[0], ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * L'explorateur part une minute après la naissance, escorté de `escorte` pigeons et accompagné de `eclaireurs` pigeons
   * Éclaireurs, vers une Case libre à DISTANCE Cases du Foyer où aucune Bête ne se montre de son départ à son retour : son
   * Expédition, sa destination, ses horaires.
   */
  const partir = async (t: Awaited<ReturnType<typeof naitre>>, escorte: number, eclaireurs: number) => {
    const instant = apres(t.ne, MINUTE);
    await rattraper("territoire", t.territoireId, { pool, jusqua: instant });
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id)
       order by c.q, c.r`,
      [t.territoireId, DISTANCE],
    );
    const aller = dureeDuTrajetMinutes(DISTANCE, escorte > 0 ? [{ vitesse: pigeon.vitesse, nombre: escorte }] : []);
    const sauvages = await betesSauvagesDesCases(pool, rows.map((c) => c.id), instant, apres(instant, (2 * aller + 61) * MINUTE));
    const calme = rows.find((c) => sauvages.get(c.id)!.length === 0);
    if (!calme) throw new Error("Aucune Case calme à la distance de l'essai.");
    const destination = { q: calme.q, r: calme.r };
    const depart = await lancerLExpedition(
      pool,
      t.territoireId,
      {
        destination,
        explorateurs: 1,
        escorte: new Map(escorte > 0 ? [["pigeon", escorte]] : []),
        eclaireurs: new Map(eclaireurs > 0 ? [["pigeon", eclaireurs]] : []),
        sejourMinutes: 60,
      },
      instant,
    );
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    const { rows: h } = await pool.query<HorairesDUneExpedition>(
      `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes" from expedition where id = $1`,
      [depart.expeditionId],
    );
    return { id: depart.expeditionId, destination, horaires: h[0] };
  };
  /** Ce que le Territoire a découvert, sans les abords de son Foyer : seulement les Cases levées par ses Expéditions. */
  const leveesPar = async (territoireId: number) =>
    new Set(
      (
        await pool.query<Coordonnees>(
          `select c.q, c.r from case_decouverte d join case_du_monde c on c.id = d.case_id where d.territoire_id = $1 and d.expedition_id is not null`,
          [territoireId],
        )
      ).rows.map(cle),
    );
  /** Les Cases du Monde d'essai qu'une Expédition de `eclaireurs` Éclaireurs lève à son arrivée, hors des abords du Foyer. */
  const attendues = async (t: Awaited<ReturnType<typeof naitre>>, x: Awaited<ReturnType<typeof partir>>, eclaireurs: number) => {
    const deja = new Set((await casesDecouvertes(pool, t.territoireId)).map(cle));
    const revelees = casesRevelees(t.foyer, x.destination, x.horaires, sejourDUneExpedition(x.horaires)!.debut, eclaireurs);
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from case_du_monde c join unnest($2::int[], $3::int[]) as v(q, r) on c.q = v.q and c.r = v.r where c.monde_id = $1`,
      [mondeId, revelees.map((c) => c.q), revelees.map((c) => c.r)],
    );
    return { toutes: new Set(rows.map(cle)), deja };
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    fort = (await pool.query<{ id: string }>("select id from espece order by attaque::numeric * vie desc, id limit 1")).rows[0].id;
    const { rows } = await pool.query<{ nom: string; attaque: number; vie: number; vitesse: number }>("select nom, attaque, vie, vitesse from espece where id = 'pigeon'");
    pigeon = { nom: rows[0].nom, force: forceDUneBete(rows[0]), vitesse: rows[0].vitesse };
  });
  afterEach(async () => {
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("un pigeon parti dans l'escorte combat comme toute Bête : il compte dans la force et risque les mêmes pertes ; les Éclaireurs non", async () => {
    const t = await naitre(3);
    const x = await partir(t, 2, 1);
    // La force de l'escorte : ses deux pigeons, pas l'Éclaireur.
    expect((await forcesDesEscortes(pool, [x.id])).get(x.id)).toBe(2 * pigeon.force);
    const le = apres(sejourDUneExpedition(x.horaires)!.debut, MINUTE);
    await rattraper("territoire", t.territoireId, { pool, jusqua: le });
    await subirLesCombats(pool, [{ expeditionId: x.id, especeId: fort, le, numero: null, beteDeNaissanceId: null }]);
    // Les deux pigeons de l'escorte perdus, l'un mort, l'autre Blessé (US-0951) ; l'Éclaireur, jamais perdu.
    const { rows: escorte } = await pool.query("select espece_id as \"especeId\", nombre, perdues, blessees from expedition_escorte where expedition_id = $1", [x.id]);
    expect(escorte).toEqual([{ especeId: "pigeon", nombre: 2, perdues: 2, blessees: 1 }]);
    const { rows: eclaireurs } = await pool.query("select espece_id as \"especeId\", nombre from expedition_eclaireur where expedition_id = $1", [x.id]);
    expect(eclaireurs).toEqual([{ especeId: "pigeon", nombre: 1 }]);
    const { rows: effectif } = await pool.query<{ nombre: number }>("select sum(nombre)::int as nombre from effectif where territoire_id = $1 and espece_id = 'pigeon'", [
      t.territoireId,
    ]);
    expect(effectif[0].nombre).toBe(2);
    // Rentrée, le récit dit les pigeons partis, au départ, même perdus au combat : un Éclaireur, deux en escorte.
    await rattraper("territoire", t.territoireId, { pool, jusqua: retourDUneExpedition(x.horaires)! });
    const recit = (await recitsDuTerritoire(pool, t.territoireId)).find((r) => r.titre === "Retour d'Expédition")!;
    expect(recit.texte.split("\n")).toContain(`Éclaireurs : ${pigeon.nom}\u00a0×\u00a01 ; en escorte : ${pigeon.nom}\u00a0×\u00a02.`);
  });

  it("il ne lève pas plus de brouillard : seuls les Éclaireurs le font, même partis avec lui", async () => {
    const [seuls, avec] = [await naitre(2), await naitre(3)];
    // Deux pigeons en escorte, sans Éclaireur ; puis deux en escorte et un Éclaireur.
    const xSeuls = await partir(seuls, 2, 0);
    const xAvec = await partir(avec, 2, 1);
    for (const [t, x, eclaireurs] of [
      [seuls, xSeuls, 0],
      [avec, xAvec, 1],
    ] as const) {
      await rattraper("territoire", t.territoireId, { pool, jusqua: sejourDUneExpedition(x.horaires)!.debut });
      const { toutes, deja } = await attendues(t, x, eclaireurs);
      const levees = await leveesPar(t.territoireId);
      // Exactement le rayon de ses Éclaireurs : toutes les Cases qu'il lève, hors celles déjà découvertes, et pas une de plus.
      expect(levees).toEqual(new Set([...toutes].filter((c) => !deja.has(c) || levees.has(c))));
      for (const c of levees) expect(toutes.has(c), c).toBe(true);
      // Le rayon d'un Éclaireur de plus en lèverait d'autres : ses pigeons d'escorte n'en ont levé aucune.
      const auDela = await attendues(t, x, eclaireurs + 1);
      expect([...auDela.toutes].some((c) => !toutes.has(c) && !auDela.deja.has(c))).toBe(true);
      // Et l'Éclaireur, lui, agrandit le rayon : des Cases que le rayon sans lui ne montrait pas.
      if (eclaireurs > 0) {
        const sans = await attendues(t, x, eclaireurs - 1);
        expect([...levees].some((c) => !sans.toutes.has(c))).toBe(true);
      }
    }
    expect(distance(seuls.foyer, xSeuls.destination)).toBe(DISTANCE);
  });

  it("le récit du retour distingue les pigeons partis en escorte de ceux partis comme Éclaireurs", async () => {
    const [avec, seuls, sans] = [await naitre(3), await naitre(2), await naitre(2)];
    const xAvec = await partir(avec, 2, 1);
    const xSeuls = await partir(seuls, 0, 2);
    const xSans = await partir(sans, 2, 0);
    for (const [t, x] of [
      [avec, xAvec],
      [seuls, xSeuls],
      [sans, xSans],
    ] as const) {
      await rattraper("territoire", t.territoireId, { pool, jusqua: retourDUneExpedition(x.horaires)! });
    }
    const lignes = async (territoireId: number) =>
      (await recitsDuTerritoire(pool, territoireId)).filter((r) => r.titre === "Retour d'Expédition").flatMap((r) => r.texte.split("\n"));
    expect((await lignes(avec.territoireId))[2]).toBe(`Éclaireurs : ${pigeon.nom}\u00a0×\u00a01 ; en escorte : ${pigeon.nom}\u00a0×\u00a02.`);
    // Des Éclaireurs sans pigeon dans l'escorte : la ligne ne dit qu'eux.
    expect((await lignes(seuls.territoireId))[2]).toBe(`Éclaireurs : ${pigeon.nom}\u00a0×\u00a02.`);
    // Sans Éclaireur, aucune ligne : ses pigeons sont une escorte comme une autre.
    expect((await lignes(sans.territoireId)).some((l) => l.startsWith("Éclaireurs"))).toBe(false);
  });
});
