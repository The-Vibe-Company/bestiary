import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lancerLExpedition } from "@/expeditions/depart";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import type { Coordonnees } from "@/monde/hex";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; la page lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
// Ce que la page envoie au navigateur pour la carte : les propriétés de CarteDuJeu, telles quelles.
vi.mock("./CarteDuJeu", () => ({ CarteDuJeu: (proprietes: object) => <canvas data-proprietes={JSON.stringify(proprietes)} /> }));
vi.mock("./Legende", () => ({ Legende: () => <aside /> }));
vi.mock("./Attente", () => ({ Attente: () => <div /> }));

import Carte from "./page";

describe.skipIf(!URL_TEST)("les Expéditions que la carte reçoit, sur base (US-0913)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `carte-expeditions-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;

  /** Un chef qui naît dans le Monde d'essai de ce fichier, et son Territoire. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Exp", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /** Une Case libre du Monde du Territoire, à `ecart` Cases de son Foyer. */
  const aLEcart = async (territoireId: number, ecart: number): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1`,
      [territoireId, ecart],
    );
    return rows[0];
  };
  /** Les Expéditions que la page de la carte donne au navigateur du joueur de ce Territoire. */
  const envoyees = async (territoireId: number) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await Carte({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as PageProps<"/jeu/carte">));
    const brut = html.match(/data-proprietes="([^"]*)"/)![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    return (JSON.parse(brut) as { expeditions: ExpeditionEnCours[] }).expeditions;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, "Essai du suivi des Expéditions sur la carte (US-0913)");
  }, 60_000);
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("donne au joueur qui l'a envoyée son Expédition en cours, et à nul autre, même voisin", async () => {
    const moi = await naitre();
    const voisin = await naitre();
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur')", [moi]);
    const destination = await aLEcart(moi, 3);
    const depart = await lancerLExpedition(pool, moi, { destination, explorateurs: 1, escorte: new Map(), sejourMinutes: 60 }, new Date());
    expect(depart).toHaveProperty("expeditionId");
    const id = (depart as { expeditionId: number }).expeditionId;
    expect((await envoyees(moi)).map((e) => ({ id: e.id, q: e.destination.q, r: e.destination.r, explorateurs: e.explorateurs }))).toEqual([
      { id, ...destination, explorateurs: ["Joran"] },
    ]);
    expect(await envoyees(voisin)).toEqual([]);
  });

  it("US-0962 : deux joueurs en séjour sur la même Case : la carte de chacun ne montre que son Expédition, jamais celle de l'autre", async () => {
    const moi = await naitre();
    const voisin = await naitre();
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Ilda', 'explorateur')", [moi]);
    const destination = await aLEcart(moi, 2);
    // Mon Expédition, partie il y a deux heures, séjourne déjà sur la Case ; celle du voisin y séjourne depuis une
    // demi-heure, posée en base comme un départ l'aurait fait, loin de son Foyer.
    const instant = Date.now();
    const depart = await lancerLExpedition(pool, moi, { destination, explorateurs: 1, escorte: new Map(), sejourMinutes: 240 }, new Date(instant - 2 * 3_600_000));
    const mienne = (depart as { expeditionId: number }).expeditionId;
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
       select $1, c.id, $4, 30, 240 from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.q = $2 and c.r = $3
       where t.id = $5 returning id`,
      [voisin, destination.q, destination.r, new Date(instant - 3_600_000), moi],
    );
    const sienne = rows[0].id;
    expect((await envoyees(moi)).map((e) => e.id)).toEqual([mienne]);
    expect((await envoyees(voisin)).map((e) => e.id)).toEqual([sienne]);
  });
});
