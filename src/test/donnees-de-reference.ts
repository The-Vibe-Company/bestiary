// Ce qu'un fichier d'essai écrit dans les tables des données de référence du jeu (JEUX) sans copie propre à sa
// transaction. Lu dans le texte du fichier, sans l'exécuter : src/test/donnees-de-reference.test.ts s'en sert pour refuser
// une telle écriture, qui ferait attendre, ou s'interbloquer, les autres fichiers (preparerMondeDeTest les recharge tous
// en même temps). À l'exécution, donneesDeReferenceTenues (src/test/base.ts) vérifie la même chose sur une transaction.
import * as jeux from "@/donnees/jeux";

/** Les tables des données de référence, celles que lireDonnees charge. */
const TABLES = [...new Set(jeux.JEUX.map((jeu) => jeu.table))].sort();

/** Chaque jeu de données que jeux.ts exporte sous son nom (BIOMES, METIERS, ESPECES_D_ESSAI…), et sa table. */
const TABLE_DU_JEU = Object.entries(jeux).flatMap(([nom, valeur]) =>
  valeur && typeof valeur === "object" && "table" in valeur && typeof valeur.table === "string" ? [[nom, valeur.table] as const] : [],
);

/** Un nom de table dans du SQL, entre guillemets ou non, sans le schéma : ce nom seul, ni plus long ni qualifié. */
const table = (nom: string) => `(?<![\\w."])"?${nom}"?(?![\\w"])`;
/** La même table, nommée avec son schéma : celle du jeu, pas une copie. */
const tableDuJeu = (nom: string) => `"?public"?\\."?${nom}"?(?![\\w"])`;
/**
 * Ce qui écrit dans une table, ou en tient les lignes : le même verrou que celui qui fait attendre les autres fichiers.
 * `truncate` en vide plusieurs d'un coup : la table cherchée peut suivre d'autres, et une virgule.
 */
const ECRIT = `(?:update(?:\\s+only)?|insert\\s+into|delete\\s+from(?:\\s+only)?|truncate(?:\\s+table)?(?:\\s+only)?(?:\\s+[\\w".]+\\s*,(?:\\s*only)?)*|merge\\s+into|lock(?:\\s+table)?(?:\\s+only)?)\\s+`;
/** Le début d'une copie temporaire. */
const COPIE = `create\\s+temp(?:orary)?\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?`;

/**
 * Les tables des données de référence que `texte` écrit sans s'en être fait une copie temporaire (create temp[orary]
 * table <table> …), chacune une fois, dans l'ordre des noms. Écrire : update, insert into, delete from, truncate, merge
 * into, lock table ; ou charger un jeu de données (chargerJeu) : tous (lireDonnees…, JEUX), ou celui qui est nommé
 * (METIERS, ESPECES_D_ESSAI…, comme deuxième argument). Une écriture qui nomme `public.<table>` vise la table du jeu, copie ou non. Une copie
 * faite d'un nom calculé (`"${table}"`) couvre toutes les tables.
 *
 * Lu fichier par fichier, sans suivre les transactions : une copie faite n'importe où dans le fichier couvre toutes ses
 * écritures dans cette table. C'est assez tant que chaque copie précède son écriture dans la même transaction, comme
 * aujourd'hui ; un `select … for update` sur une table du jeu, ou une table passée dans une variable, lui échappent.
 */
export function ecrituresSansCopie(texte: string): string[] {
  const copieCalculee = new RegExp(`${COPIE}"?\\$\\{`, "i").test(texte);
  const charge = /chargerJeu\(/.test(texte);
  const chargeTout = charge && (/lireDonnees\w*\(/.test(texte) || /\bJEUX\b/.test(texte));
  // Le jeu nommé comme deuxième argument de chargerJeu, et là seulement : une constante du même nom ailleurs n'écrit rien.
  const chargees = charge ? TABLE_DU_JEU.filter(([nom]) => new RegExp(`chargerJeu\\(\\s*[^,()]+,\\s*${nom}\\b`).test(texte)).map(([, t]) => t) : [];
  return TABLES.filter((nom) => {
    const copiee = copieCalculee || new RegExp(`${COPIE}${table(nom)}`, "i").test(texte);
    const ecriteDuJeu = new RegExp(`${ECRIT}${tableDuJeu(nom)}`, "i").test(texte);
    const ecrite = new RegExp(`${ECRIT}${table(nom)}`, "i").test(texte) || chargeTout || chargees.includes(nom);
    return ecriteDuJeu || (ecrite && !copiee);
  });
}
