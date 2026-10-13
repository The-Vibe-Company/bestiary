# Conventions des workers de Bestia 2

Lis d'abord `AGENTS.md` (ce Next.js 16 a des changements cassants ; les guides sont dans `node_modules/next/dist/docs/`) et `CONTEXT.md` (les mots du jeu, avec leur majuscule : Territoire, Foyer, Case, Habitant, Bête, Expédition…).

## Armada
- La CLI `armada` est déjà installée sur ce poste : ne la réinstalle pas (`npm install -g` lancé par plusieurs agents à la fois l'a déjà cassée pour toute la flotte). Si `armada` manque, utilise `npx -y @the-vibe-company/armada@0.2.61` et dis-le au coordinateur.

## Le ticket
- La story de `docs/stories` citée dans le ticket fait foi ; les décisions du ticket (« décidé le … ») et ses valeurs provisoires sont tranchées : ne les rediscute pas, ne tranche aucune autre question de jeu (demande avec `armada ask`).
- **Ne touche pas à `docs/`** : le coordinateur y écrit le statut de la story et les décisions à la fusion.
- Une valeur « à régler en jouant » va dans `src/reglages.ts`, **ajoutée à la fin** du fichier, commentée avec sa story et « valeur provisoire ».
- Une migration Drizzle : réserve son numéro (`armada reserve migration --next`), puis `drizzle/00NN_*.sql`, son entrée de journal et `src/db/schema.ts`. Jamais de migration destructrice.

## Le code
- Français partout : noms, commentaires, textes. Commentaires qui citent la story (`US-0901 : …`), avec la même densité et les mêmes idiomes que le code autour.
- Pages sobres : aucune phrase d'explication quand les titres, champs et boutons suffisent ; la seule phrase admise est celle que la story demande.
- Aucune bibliothèque nouvelle sans le demander.
- Test d'abord, un critère à la fois, à l'interface où le joueur l'observe.

## Avant chaque envoi
- **Bases** : les tests sur base et le serveur de dev de vérification tournent sur le Postgres local de Bestia (conteneur Docker `bestia-db`, `postgres://bestia@127.0.0.1:5433/<base>`, sans mot de passe), sur la base que le coordinateur t'attribue (`bestia_test_a` à `bestia_test_e`). Jamais Neon : il ne sert que la production, dans son plan gratuit.
- `npm run lint`, `npm run typecheck`, puis la suite : `NODE_ENV=production VERCEL_ENV=production npx vitest run --maxWorkers=2`. La CI les repasse sur ta branche, sur son propre Postgres : attends-la verte.
- Tests sur base : un chef naît dans un Monde d'essai propre à ton fichier (`mondeDEssai(pool, "<nom>")`, `src/test/base.ts`), jamais sur Aube, sauf si l'essai porte vraiment sur le Monde du jeu : sa Couronne n'a de place que pour quelques dizaines de Foyers, partagés par toute la suite.
- Un critère visible se vérifie en vrai, dans un navigateur, de 320 à 1 440 px, sans défilement de côté ; joins une capture avec `armada attach`.
- Noms de chef d'essai : `nomDEssai(prefixe, suffixeDEssai(), n)` (`src/test/base.ts`), jamais un suffixe tiré librement : il forme parfois un mot interdit, et le chef est refusé.
- Un essai à plusieurs chefs les fait tous naître d'abord, puis choisit ses Cases (Bête de naissance, destination), une par essai : un Foyer né après coup peut tomber sur la Case choisie.
- Un essai qui cherche dans le Monde (une Bête rare, une Case calme) prend 60 s de délai et un plafond prévu pour le régime le plus défavorable.
- Aucune Espèce d'essai nommée dans le code ni dans les tests : prends souris, poule ou pigeon.
- Une base de test réutilisée d'une PR à l'autre peut faire sauter une migration à Drizzle : applique ce qui manque sur la base, sans toucher aux fichiers. Si une migration réservée plus tôt fusionne avant la tienne, recoud ton instantané (copie le précédent, change la table, nouvel `id`, `prevId` = l'`id` du précédent) jusqu'à ce que `drizzle-kit generate` ne trouve aucun changement et que `drizzle-kit check` passe, puis remets ta base d'aplomb. Un script qui importe un module `server-only` se lance avec `npx tsx --conditions=react-server`.
- La suite complète vide la ligne `horloge` de sa base : après avoir ancré l'horloge du serveur de dev, ne relance pas la suite sur la même base.
- Avalanche d'`ECONNREFUSED` sur 5433 : `pg_isready`, puis `open -a Docker`, puis relance.
- Un essai qui raconte un séjour (effectif, heure de retour, récit) sur une Case qu'il n'a pas choisie calme est attaquable : une Bête rare peut lui coûter des Bêtes (US-0944) et le faire fuir (US-0945). Choisis une Case sans Bête plus rare que commune pendant tout le séjour, ou épargne l'Expédition avec `epargneePar` / `effacerLExpedition` (`src/test/attaques.ts`), qui calculent l'attaque comme le jeu.
- Un essai qui apprivoise des Bêtes dans un Monde d'essai réutilisé efface d'abord, dans `beforeAll`, les lignes `bete_partie` de son Monde : sinon une relance retombe sur une Bête déjà emmenée.
- Un essai qui choisit son scénario par tirage (identifiants, Cases) vérifie dans l'essai même les conditions qui font sa preuve (qui est sur la Case, quand, dans quel ordre) : une recherche trop large laisse passer, au hasard, un scénario qui ne prouve plus rien.
- Depuis US-0945, `evoluer` peut s'arrêter avant la fin de sa tranche (`arret`) : ce qu'une règle écrit pendant le temps ne couvre que `]depuis, arret]`. Après chaque fusion de main, regarde si `src/temps/avancer.ts` ou `src/temps/regles.ts` ont changé.
- Une règle lue par plusieurs requêtes SQL (la guérison, la présence sur une Case) passe par un seul helper ; la PR qui fusionne en second y ramène tous les appels. Dans un `case … then $n`, type le paramètre (`$n::float8`).
- L'inscription locale demande une confirmation par e-mail : le lien est écrit dans le journal du serveur de dev.
- Un numéro de migration réservé peut être pris par une PR fusionnée avant la tienne : regarde `drizzle/` sur origin/main à chaque fusion de main et juste avant de pousser.
- Une constante SQL de module qui lit les exports d'un autre module casse les essais qui moquent ce module : construis la requête à l'appel (comme `src/monde/couple.ts`).
- Le relecteur isolé ne lance aucune commande git qui déplace HEAD (`checkout`, `switch`, `reset`) : lecture seule.
- Tout ce qui retire des Bêtes valides du Foyer appelle `bornerLesAffectations` (`src/monde/roles.ts`) dans sa transaction (US-0837).
- Tout état que lisent plusieurs Territoires (présence sur une Case, force d'escorte, départ d'une Bête) se prouve par un essai à deux joueurs sur une Case partagée, rattrapés dans les deux ordres.
- Arrête tes serveurs par leurs PID, jamais par leur nom (`pkill -f …` arrête aussi ceux des autres agents). Un critère « sur mobile » se vérifie aussi téléphone couché.

## La pull request
- Titre au format Commitizen qu'exige Armada, suivi du titre du ticket : `feat(expeditions): US-0901 · Ouvrir l'écran d'Expédition` (la fusion en squash en fait le commit de la story) ; corps : ce que le joueur vit désormais, comment chaque critère a été vérifié, ce qui reste hors du ticket.
- Fin de chaque message de commit : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
