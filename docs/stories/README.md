# User stories

Le découpage fin de l'[ordre d'attaque](../ordre-d-attaque.md) : 748 stories en 18 fichiers, une par comportement que l'on peut livrer et tester seul. On les construit dans l'ordre d'attaque, jalon par jalon (0 à 4, puis 9, 8, 5, 6, 7, puis 10 et la suite, voir [ADR 0008](../adr/0008-pas-de-couple-de-depart.md)), en respectant les déblocages. Les mots du jeu sont ceux de [CONTEXT.md](../../CONTEXT.md).

## Où on en est

Dernière story livrée : **US-0837** · Affecter une Bête à son Rôle ; les jalons 0 à 4 sont terminés, le jalon 9 avance (l'étape 38 est faite, la Rencontre et l'Apprivoisement de l'étape 40 aussi). US-0141, livrée le 2026-10-05, est retirée avec le Couple de départ ([ADR 0008](../adr/0008-pas-de-couple-de-depart.md)). Les e-mails ne partent pas encore pour de vrai, voir Zewed/bestia-2#1, et l'entrée reste fermée en production jusqu'à ce qu'Antoine décide de l'ouvrir. Prochaines : la fin du jalon 9 (le combat contre la Bête trop forte, les Blessés, le Couple réuni, plusieurs Expéditions sur une Case, les pigeons éclaireurs), puis le jalon 8.

## Sommaire

| Jalon | Étapes | Stories | À décider |
|---|---|---:|---:|
| [0 · Les fondations](00-fondations.md) | 1 à 4 | 52 | 1 |
| [1 · Entrer dans le jeu](01-entrer-dans-le-jeu.md) | 5 à 9, sans la 8 | 54 | 0 |
| [2 · Le territoire respire](02-le-territoire-respire.md) | 10 à 12 | 32 | 0 |
| [3 · Les Habitants](03-les-habitants.md) | 13 à 17 | 43 | 0 |
| [4 · La carte du Monde](04-la-carte-du-monde.md) | 18 à 20 | 43 | 0 |
| [5 · Récolter](05-recolter.md) | 21 à 24 | 52 | 24 |
| [6 · Construire](06-construire.md) | 25 à 30 | 46 | 13 |
| [7 · La Recherche](07-la-recherche.md) | 31 à 32 | 31 | 6 |
| [8 · Les Bêtes à la maison](08-les-betes-a-la-maison.md) | 33 à 37 | 44 | 13 |
| [9 · Explorer et apprivoiser](09-explorer-et-apprivoiser.md) | 38 à 45 | 76 | 22 |
| [10 · Le Bestiaire](10-le-bestiaire.md) | 46 à 49 | 47 | 20 |
| [11 · S'étendre](11-s-etendre.md) | 50 à 52 | 42 | 25 |
| [12 · Les Épreuves](12-les-epreuves.md) | 53 | 34 | 7 |
| [13 · Le danger sauvage](13-le-danger-sauvage.md) | 54 à 55 | 24 | 14 |
| [14 · Les autres joueurs](14-les-autres-joueurs.md) | 56 à 60 | 49 | 22 |
| [15 · Le Monde vivant](15-le-monde-vivant.md) | 61 à 63 | 28 | 16 |
| [16 · Le confort](16-le-confort.md) | 64 à 66 | 36 | 12 |
| [17 · Plus tard](17-plus-tard.md) | hors étapes | 15 | 18 |
| **Total** | **65 étapes** | **748** | **213** |

Les points encore ouverts sont rassemblés dans [a-decider.md](a-decider.md). Les valeurs à fixer en jouant sont marquées « (chiffre à régler) » dans les stories (122 au total).

## Lire une story

```
### US-0925 · Des Bêtes sauvages apparaissent de temps en temps
**En tant que** joueur, **je veux** …, **afin de** ….

- **Débloquée par** : US-0923, US-0924, Étape 3
- **Critères d'acceptation** :
  - …
```

- **Numéro** : `US-JJNN`, où `JJ` est le jalon et `NN` l'ordre dans le jalon. Un numéro ne change jamais, même si la story est réécrite.
- **Personnages** : joueur, nouveau joueur, visiteur, chef attaqué, développeur.
- **Critères d'acceptation** : deux à cinq, chacun vérifiable par un test ou en jouant.
- **« (à décider) »** : une règle de jeu encore ouverte. On la tranche avant de coder la story.
- **Statut** (facultatif) : une story abandonnée, reportée ou couverte autrement le dit ici, avec la date et la raison.
- **« (chiffre à régler) »** : une valeur d'équilibrage. On code avec une valeur provisoire, réglable sans toucher au code.

## Comment les stories se débloquent

- Une story se commence quand toutes celles de sa ligne **Débloquée par** sont en ligne et testées.
- « Étape N » veut dire : toutes les stories de l'étape N de l'ordre d'attaque.
- Une dépendance pointe toujours vers une story placée plus haut, dans le même fichier ou dans un jalon attaqué avant. Aucune ne pointe vers l'avant.
- Une story qui attend une étape attaquée plus tard est **reportée** : son Statut le dit, et on la fait avec cette étape (US-0929 avec l'étape 24, US-0939 avec l'étape 35).
- Les stories sans dépendance vers une autre story ouvrent un jalon, ou lancent un chantier qui peut avancer en parallèle (les Espèces d'essai, les Rôles, les Anneaux).

## Choix pris en écrivant, à confirmer

Ces règles ne viennent pas de la conception. Elles ont été posées pour que les stories tiennent debout. Elles restent valables tant qu'on ne les remet pas en cause.

- Une seule page **Récits** rassemble tous les comptes rendus (US-0324). Une liste **Sorties en cours** suit les Récoltes et les Expéditions (US-0514). Une page **Bêtes** montre les Bêtes du Territoire (jalon 8).
- Une Espèce a au plus un Rôle.
- Tout ce qui s'élève se paie au lancement de l'Élevage. Les Bêtes élevées naissent une par une, et leurs Places sont réservées dès le lancement.
- Le Couple en Réserve ne part jamais pendant une Famine.
- Plusieurs constructions de sortes différentes peuvent être en chantier en même temps, mais une seule par sorte.
- Une Bête sauvage est à portée quand la force de l'escorte est au moins égale à la sienne ; une Bête commune l'est toujours, même sans escorte. Entre Expéditions sans escorte, une Bête disputée se tire à chances égales (US-0935, US-0963).
- Le Foyer naît dès le nom de chef validé ; le récit d'arrivée s'affiche entre les deux écrans (US-0153, US-0158). Jusqu'aux Habitats par Biome (étape 51), le Foyer loge les Bêtes de tout Biome (US-0823).
- Une Bête s'affecte à son Rôle là où il sert : au Foyer pour un Nourricier (US-0837), au départ d'une Expédition pour un Éclaireur (US-0976). Affecter et retirer sont gratuits et immédiats. Un Éclaireur ne combattant pas, il fuit avec les explorateurs sans rien risquer ; une Bête affectée ne compte pas dans la puissance de l'armée (US-1444).
- Une Espèce n'a qu'un éleveur à la fois, et un éleveur occupé ne change pas de Métier avant la fin de son Élevage, comme un explorateur parti (US-0843, US-0844).
- Les Épreuves ne verrouillent l'interface que jusqu'à la première Bête ramenée (US-1227).
- Un Couple se forme de lui-même dès qu'un mâle et une femelle de la même Espèce sont au Foyer. Il n'y a qu'un Couple par Espèce.
- Un Avant-poste se bâtit sur la Case qu'il revendique. Le Foyer regroupe les Cases proches de la hutte du chef, et les Cases plus éloignées sont des Marches.
