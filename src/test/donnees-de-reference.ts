// Ce qu'un fichier d'essai écrit dans les tables des données de référence du jeu (JEUX) sans copie propre à sa
// transaction. Lu dans le texte du fichier, sans l'exécuter : src/test/donnees-de-reference.test.ts s'en sert pour refuser
// une telle écriture, qui ferait attendre, ou s'interbloquer, les autres fichiers (preparerMondeDeTest les recharge tous
// en même temps). À l'exécution, donneesDeReferenceTenues (src/test/base.ts) vérifie la même chose sur une transaction.
import { JEUX } from "@/donnees/jeux";

/** Les tables des données de référence, celles que lireDonnees charge. */
const TABLES = [...new Set(JEUX.map((jeu) => jeu.table))].sort();

/** Un nom de table dans du SQL, entre guillemets ou non, sans le schéma public : ce nom seul, ni plus long ni qualifié. */
const table = (nom: string) => `(?<![\\w."])"?${nom}"?(?![\\w"])`;

/**
 * Les tables des données de référence que `texte` écrit (update, insert into, delete from) sans s'en être fait une copie
 * temporaire (create temp[orary] table <table> …), chacune une fois, dans l'ordre des noms. Une écriture qui nomme
 * `public.<table>` vise la table du jeu, copie ou non. Charger les vrais fichiers de données (lireDonnees) écrit dans
 * toutes les tables à la fois : une copie faite d'un nom calculé (`"${table}"`) les couvre toutes.
 */
export function ecrituresSansCopie(texte: string): string[] {
  const copieCalculee = /create\s+temp(?:orary)?\s+table\s+"?\$\{/i.test(texte);
  const chargeTout = /lireDonnees\(/.test(texte) && /chargerJeu\(/.test(texte);
  return TABLES.filter((nom) => {
    const copiee =
      copieCalculee ||
      new RegExp(
        `create\\s+temp(?:orary)?\\s+table\\s+${table(nom)}`,
        "i",
      ).test(texte);
    const ecriteDuJeu = new RegExp(
      `(?:update|insert\\s+into|delete\\s+from)\\s+(?:public\\.)"?${nom}"?(?![\\w"])`,
      "i",
    ).test(texte);
    const ecrite = new RegExp(
      `(?:update|insert\\s+into|delete\\s+from)\\s+${table(nom)}`,
      "i",
    ).test(texte);
    return ecriteDuJeu || ((ecrite || chargeTout) && !copiee);
  });
}
