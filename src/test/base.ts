import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";
import { createPool } from "@/db";
import { chargerJeu } from "@/donnees/charger";
import { lireDonnees } from "@/donnees/jeux";
import { graineDuMonde } from "@/monde/couronne";
import { creerUnMonde } from "@/monde/generer";
import { preparerCouronne } from "@/monde/preparer-couronne";

/**
 * L'adresse de la base réservée aux tests : TEST_DATABASE_URL, sinon .env.test.local
 * (écrit par npm run db:test-setup). Sans elle, les tests sur base sont sautés.
 */
export function urlBaseDeTest(): string | undefined {
  if (process.env.TEST_DATABASE_URL?.trim()) return process.env.TEST_DATABASE_URL.trim();
  const fichier = join(process.cwd(), ".env.test.local");
  if (!existsSync(fichier)) return undefined;
  const ligne = readFileSync(fichier, "utf8").match(/^TEST_DATABASE_URL=(.+)$/m);
  return ligne?.[1].trim() || undefined;
}

export const URL_TEST = urlBaseDeTest();

export function poolDeTest(reglages?: { max?: number; connectionTimeoutMillis?: number }) {
  if (!URL_TEST) throw new Error("Pas de base de test : lancez npm run db:test-setup.");
  return createPool(URL_TEST, reglages);
}

/**
 * Prépare pour de bon la base de test comme une base en ligne : les données de référence et la
 * Couronne du Monde du jeu (US-0153). Se relance sans risque, même depuis plusieurs fichiers de
 * test à la fois. Comme à la mise en ligne, les données puis la Couronne passent chacune dans sa
 * transaction : réunies, elles tiendraient les Ressources en attendant le Monde, quand une naissance
 * d'un autre fichier tient le Monde en attendant les Ressources de ses Stocks, et se bloqueraient.
 */
export async function preparerMondeDeTest(pool: Pool): Promise<void> {
  await enTransaction(pool, async (client) => {
    for (const { jeu, entrees } of lireDonnees()) await chargerJeu(client, jeu, entrees);
  });
  await enTransaction(pool, async (client) => {
    const { rows } = await client.query<{ id: number }>("select id from monde order by id limit 1");
    await preparerCouronne(client, rows[0].id);
  });
}

/**
 * Le Monde d'essai d'un fichier de test, généré une seule fois dans la base de test sous ce nom (un Monde ne s'efface
 * pas) : ses chefs y naissent (enregistrerNomDeChef, avec ce Monde) quand le Monde du jeu leur est indifférent. La
 * Couronne d'Aube, que se partagent tous les fichiers, n'a de place que pour quelques dizaines de Foyers : elle ne se
 * remplit plus, et aucune naissance d'un autre fichier ne se glisse entre les leurs. Un nom par fichier : les chefs
 * qu'un passage interrompu y aurait laissés repartent ici, avec leur compte. Sûr quand plusieurs fichiers le demandent
 * en même temps.
 */
export async function mondeDEssai(pool: Pool, nom: string): Promise<number> {
  return enTransaction(pool, async (client) => {
    const { rows } = await client.query<{ id: number }>("select id from monde where nom = $1", [nom]);
    const mondeId = rows[0]?.id ?? (await creerUnMonde(client, { nom, graine: graineDuMonde(nom) })).mondeId;
    await client.query("delete from compte where id in (select compte_id from chef where monde_id = $1)", [mondeId]);
    return mondeId;
  });
}

/**
 * Les lettres par lesquelles ne finit aucun mot interdit (US-0138) : une suite qui n'a qu'elles, collée au nom d'un chef
 * d'essai, n'y forme jamais un de ces mots. Tirée parmi toutes les lettres, elle en formait un de temps en temps
 * (« Gerboise » suivi de « xxe » donnait « Gerboisexxe »), et le chef, refusé, ne naissait pas. src/chefs/chef.db.test.ts
 * vérifie qu'aucun mot de la liste ne finit par l'une d'elles.
 */
export const LETTRES_SANS_MOT_INTERDIT = "bcjquvwxz";

/** Six lettres tirées au hasard parmi LETTRES_SANS_MOT_INTERDIT : la fin des noms de chef d'un lancement, propre à lui. */
export function suffixeDEssai(): string {
  return Array.from({ length: 6 }, () => LETTRES_SANS_MOT_INTERDIT[Math.floor(Math.random() * LETTRES_SANS_MOT_INTERDIT.length)]).join("");
}

/**
 * Le nom du `n`-ième chef d'essai d'un lancement (de 0 à 80) : `debut`, la fin propre au lancement (suffixeDEssai), puis
 * `n`, écrit lui aussi en LETTRES_SANS_MOT_INTERDIT.
 */
export function nomDEssai(debut: string, suffixe: string, n: number): string {
  const lettres = LETTRES_SANS_MOT_INTERDIT;
  return `${debut}${suffixe}${lettres[Math.floor(n / lettres.length) % lettres.length]}${lettres[n % lettres.length]}`;
}

/** Le Territoire du chef d'un compte, dans quelque Monde qu'il soit né (chefDuCompte ne lit que le Monde du jeu), ou null. */
export async function territoireDuCompte(base: Pick<Pool, "query">, compteId: number): Promise<number | null> {
  const { rows } = await base.query<{ id: number }>("select t.id from territoire t join chef ch on ch.id = t.chef_id where ch.compte_id = $1", [compteId]);
  return rows[0]?.id ?? null;
}

/**
 * Un pool dont chaque connexion est `client` lui-même, et chaque transaction un point de reprise de la sienne, validé ou
 * annulé comme elle : ce que le jeu y fait l'est pour de bon, tel que cette transaction le voit, puis s'efface avec elle.
 * Une seule connexion : ni verrou ni isolation entre deux transactions ne s'y éprouvent, et deux connexions ouvertes à la
 * fois mêleraient leurs points de reprise.
 */
export function poolDansLaTransaction(client: PoolClient): Pool {
  const ordres = new Map([
    ["begin", "savepoint jeu"],
    ["commit", "release savepoint jeu"],
    ["rollback", "rollback to savepoint jeu"],
  ]);
  const connexion = { query: (texte: string, valeurs?: unknown[]) => client.query(ordres.get(texte) ?? texte, valeurs), release: () => {} };
  return { connect: async () => connexion, query: (texte: string, valeurs?: unknown[]) => client.query(texte, valeurs) } as unknown as Pool;
}

/** Une transaction à la fois pour tous les fichiers de test qui préparent la base. */
async function enTransaction<T>(pool: Pool, travail: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(4153)");
    const resultat = await travail(client);
    await client.query("commit");
    return resultat;
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    throw erreur;
  } finally {
    client.release();
  }
}
