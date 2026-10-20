# Jalon 4 · La carte du Monde

Le joueur découvre le Monde qu'il partage avec les autres : une grande carte en hexagones, avec ses Biomes, son eau, la Couronne et le Cœur sauvage, qu'il parcourt depuis son Foyer mais dont il ne voit d'abord que les abords. Étapes couvertes : 18 à 20 de l'ordre d'attaque.

## Étape 18 · Générer le Monde

### US-0401 · Générer un Monde à partir d'une graine
**En tant que** développeur, **je veux** générer un Monde entier à partir d'une graine, **afin de** pouvoir le recréer à l'identique à tout moment.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). `npm run monde:generer -- --nom "…" --graine 12345` crée un nouveau Monde et ses 10 981 Cases (graine facultative : tirée au hasard et affichée si absente) ; elle refuse un nom déjà pris et ne tourne pas à la mise en ligne. La graine est enregistrée avec le Monde ; le Monde du jeu a reçu la sienne, celle dont sa Couronne a toujours été tirée, sans qu'aucune Case ne change. La Couronne d'un Monde généré est celle que le jeu tirait déjà ; l'intérieur reçoit en attendant le même relief (les vraies régions viennent avec US-0406). Vérifié sur une base de test : même graine, mêmes Cases ; une autre, 7 799 Cases sur 10 981 différentes.
- **Débloquée par** : Étape 4
- **Critères d'acceptation** :
  - Une commande crée un Monde en hexagones à partir d'une graine et l'enregistre.
  - La même graine donne toujours les mêmes Cases avec les mêmes Biomes, vérifié Case par Case par un test automatique.
  - Deux graines différentes donnent deux Mondes différents.
  - La graine est enregistrée avec le Monde.

### US-0402 · Donner au Monde sa forme et ses voisinages
**En tant que** développeur, **je veux** un Monde d'une taille fixe où chaque Case connaît ses voisines, **afin de** mesurer partout les distances de la même façon.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). C'était déjà la géométrie du jeu : un grand hexagone en coordonnées axiales, l'anneau d'une Case étant sa distance au Cœur sauvage. `distance` (`src/monde/hex.ts`) est la seule mesure, l'anneau en découle, et un test refuse toute autre formule dans le code ; `voisinesDansLeMonde` rend six voisines, quatre au bord, trois aux six coins. Rien de visible.
- **Débloquée par** : US-0401
- **Critères d'acceptation** :
  - Le Monde a la forme d'un grand hexagone (décidé le 2026-10-07), de 60 Cases de rayon (provisoire, `MONDE_RAYON`).
  - Chaque Case connaît ses six voisines ; celles du bord en ont moins.
  - La distance entre deux Cases se compte en nombre de Cases à franchir, avec une seule façon de la calculer, réutilisée partout (trajets, brouillard, Couronne).

### US-0403 · Placer le Cœur sauvage au milieu du Monde
**En tant que** développeur, **je veux** que le milieu du Monde forme le Cœur sauvage, **afin de** préparer la région où vivront les Espèces les plus rares.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Les 169 Cases à moins de 8 Cases du milieu forment le Cœur sauvage ; chaque Case le sait (`coeur`), et la taille du Cœur est fixée sur la fiche du Monde à sa création (`rayon_coeur`, 8 pour les Mondes déjà nés). Dans un Monde généré, le Cœur mêle au moins cinq Biomes de terre en régions d'un seul tenant, tirées de la graine (frontières encore géométriques : à reprendre avec US-0406). Aucun Foyer ne peut y naître. Rien ne change pour le Monde du jeu, qui n'a en base que sa Couronne. Rien de visible.
- **Débloquée par** : US-0402
- **Critères d'acceptation** :
  - Les Cases à moins de 8 Cases du milieu (provisoire, `COEUR_SAUVAGE_RAYON`) du Monde appartiennent au Cœur sauvage.
  - Chaque Case sait si elle appartient au Cœur sauvage.
  - Aucun Foyer ne peut naître dans le Cœur sauvage.
  - Le Cœur sauvage mêle plusieurs Biomes au lieu d'un seul (décidé le 2026-10-07).

### US-0404 · Placer la Couronne sur le bord du Monde
**En tant que** développeur, **je veux** que le bord du Monde forme la Couronne, **afin de** préparer les Cases où naîtront les joueurs.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). C'était déjà en place depuis le jalon 1 : les 6 anneaux du bord (2 070 Cases) forment la Couronne, et chaque Case le sait. La story ajoute la preuve, sur 21 graines et sur le Monde du jeu : la Couronne garde assez de terre pour 90 Foyers espacés de 4 Cases (96 emplacements en prairie pour le Monde du jeu). Attention pour US-0413 : avec la règle de naissance actuelle (prairie seulement), un Monde généré n'offre selon sa graine que 76 à 97 emplacements. Rien de visible.
- **Débloquée par** : US-0402
- **Critères d'acceptation** :
  - Les Cases à moins de 6 Cases du bord (provisoire, `COURONNE_ANNEAUX`) appartiennent à la Couronne.
  - Chaque Case sait si elle appartient à la Couronne.
  - La Couronne compte assez de Cases de terre pour accueillir 90 joueurs (provisoire, `JOUEURS_PAR_MONDE`).

### US-0405 · Mesurer l'éloignement de chaque Case au Cœur sauvage
**En tant que** développeur, **je veux** que chaque Case connaisse sa distance au Cœur sauvage, **afin de** pouvoir plus tard y régler la Rareté des Bêtes sauvages et la fréquence des Incursions.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Chaque Case porte sa distance au Cœur sauvage (colonne `eloignement`, obligatoire), 0 pour les siennes et seulement elles (contrainte `case_coeur_a_zero`), 53 au bord d'un Monde de 60 ; la migration l'a calculée pour les Cases déjà en base (48 à 53 pour la Couronne du Monde du jeu). Elle se déduit de l'anneau (`eloignementDuCoeur`, fondée sur `distance`) : la même graine donne les mêmes distances. Rien de visible.
- **Débloquée par** : US-0403
- **Critères d'acceptation** :
  - Chaque Case porte sa distance au Cœur sauvage, en Cases.
  - Les Cases du Cœur sauvage sont à 0.
  - La même graine donne toujours les mêmes distances.

### US-0406 · Former des régions de Biomes crédibles
**En tant que** joueur, **je veux** que les Biomes forment de vraies régions, **afin de** parcourir un Monde qui ressemble à un vrai paysage.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Un Monde généré dessine désormais toute sa terre, Couronne comprise, avec les huit Biomes : elle est découpée en régions d'au moins 6 Cases aux frontières sinueuses, chacune prenant un Biome selon sa température et son humidité ; aucune Case isolée, chaque Biome entre 4 et 30 % de la terre (parts visées : prairie 20 %, forêt 17 %, savane et toundra 12 %, montagne 11 %, jungle et désert 10 %, banquise 8 %). Le Monde du jeu garde sa Couronne, déjà en base. Prouvé sur 21 graines, tenu sur 600. Rien de visible.
- **Débloquée par** : US-0402
- **Critères d'acceptation** :
  - Les huit Biomes de terre (prairie, forêt, jungle, savane, désert, montagne, toundra, banquise) sont tous présents.
  - Chaque Biome forme des régions d'un seul tenant d'au moins 6 Cases (provisoire, `REGION_BIOME_MIN_CASES`).
  - Une Case isolée au milieu d'un autre Biome reste rare : au plus 20 sur tout le Monde (provisoire, `CASES_ISOLEES_MAX`).
  - La part de chaque Biome reste entre 4 et 30 % de la terre (provisoire, `PART_BIOME_MIN`, `PART_BIOME_MAX`).

### US-0407 · Enchaîner les Biomes de façon naturelle
**En tant que** joueur, **je veux** que les Biomes voisins aillent bien ensemble, **afin de** croire au Monde que je parcours.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Les voisinages interdits sont écrits dans `donnees/biomes.yaml` (`jamais_a_cote_de`) : le froid (banquise, toundra) ne touche jamais le chaud (désert, savane, jungle), ni le désert la jungle ; prairie, forêt et montagne vont avec tout. La liste est validée au chargement et lue par le générateur. Le Monde a un côté froid et un côté chaud, orientés par la graine (banquise, toundra, puis prairie et forêt, puis le chaud), et ses montagnes forment des chaînes au moins trois fois plus longues que larges. Prouvé sur 21 graines. Rien de visible.
- **Débloquée par** : US-0406
- **Critères d'acceptation** :
  - Certains voisinages n'existent jamais, comme banquise contre désert ou contre jungle ; la liste complète est fixée dans les données du jeu (décidé le 2026-10-07 : `donnees/biomes.yaml`).
  - Les Biomes froids et les Biomes chauds se regroupent selon une seule règle : un côté froid et un côté chaud du Monde (décidé le 2026-10-07).
  - Les montagnes forment des chaînes plutôt que des taches isolées.

### US-0408 · Créer la mer
**En tant que** joueur, **je veux** trouver de grandes étendues de mer, **afin de** parcourir un Monde aux paysages variés.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). La mer couvre 15 % des Cases d'un Monde généré, en une à trois étendues d'au moins 300 Cases d'un seul tenant, jamais jointives, sans Case de mer isolée, jamais dans le Cœur sauvage (au moins 4 Cases de lui) ; elle peut toucher la Couronne, qui garde de la terre pour 90 Foyers. Toute l'eau est en variante « mer » ; côtes, lacs et rivières viennent ensuite. Prouvé sur 21 graines, tenu sur 600 (mers de 414 Cases au moins). Rien de visible.
- **Débloquée par** : US-0406
- **Critères d'acceptation** :
  - La mer forme de grandes étendues d'eau d'un seul tenant.
  - Elle couvre 15 % des Cases du Monde (provisoire, `MER_PART`).
  - Elle peut toucher la Couronne, mais la Couronne garde assez de Cases de terre pour les naissances.

### US-0409 · Border la mer de côtes
**En tant que** joueur, **je veux** que la mer soit bordée de côtes, **afin de** voir où la terre rencontre l'eau.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Les Cases de mer voisines de la terre passent en côte (Biome eau, variante « côte ») : la côte suit tout le rivage sans trou, et la mer du large ne touche que de la mer ou de la côte ; mer et côte font ensemble 15 % du Monde. Prouvé sur 21 graines, tenu sur 600. Rien de visible.
- **Débloquée par** : US-0408
- **Critères d'acceptation** :
  - Toute Case de mer qui touche la terre devient une Case de côte.
  - La côte suit tout le rivage, sans trou.
  - La mer ne touche jamais directement une Case de terre.

### US-0410 · Semer des lacs
**En tant que** joueur, **je veux** trouver des lacs à l'intérieur des terres, **afin de** rencontrer de l'eau loin de la mer.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Huit lacs de 3 à 12 Cases (variante « lac »), d'un seul tenant, à l'intérieur des terres : jamais dans le Cœur sauvage ni dans la Couronne (pour garder la place des naissances), ni sur une montagne, toujours séparés de la mer, des côtes et des autres lacs par de la terre. Prouvé sur 21 graines, tenu sur 600. Rien de visible.
- **Débloquée par** : US-0408
- **Critères d'acceptation** :
  - Des lacs de 3 à 12 Cases (provisoire, `LAC_MIN_CASES`, `LAC_MAX_CASES`) apparaissent à l'intérieur des terres.
  - Un lac ne touche jamais la mer ni la côte.
  - Le Monde compte 8 lacs (provisoire, `LACS_PAR_MONDE`).

### US-0411 · Tracer des rivières
**En tant que** joueur, **je veux** voir des rivières couler des montagnes vers l'eau, **afin de** lire le paysage comme un vrai relief.

- **Statut** : Livrée le 2026-10-07 (autopilot, par un agent en parallèle). Douze rivières (variante « rivière ») partent du pied d'une chaîne de montagnes et serpentent jusqu'à une côte ou un lac, sans boucle, sur 12 à 90 Cases ; un affluent peut rejoindre une autre rivière ; elles peuvent traverser la Couronne, jamais le Cœur sauvage. Une rivière coupe la terre : un tracé qui laisserait une région de moins de 6 Cases est abandonné pour la source suivante. Prouvé sur 21 graines, tenu sur 600. Rien de visible.
- **Débloquée par** : US-0407, US-0409, US-0410
- **Critères d'acceptation** :
  - Une rivière est une suite de Cases voisines, d'un seul tenant.
  - Elle part d'une montagne et finit sur une côte ou dans un lac.
  - Elle ne forme jamais de boucle.
  - Deux rivières peuvent se rejoindre (décidé le 2026-10-07).
  - Le Monde compte 12 rivières (provisoire, `RIVIERES_PAR_MONDE`).

### US-0412 · Contrôler le Monde généré sur une page interne
**En tant que** développeur, **je veux** voir le Monde entier sur une page de contrôle, **afin de** juger d'un coup d'œil si ses Biomes sont crédibles.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Une page interne /controle/monde (comme /controle : mot de passe, 404 en production) : un champ « Graine » génère le Monde à la volée, sans l'enregistrer, et la liste des Mondes en base l'affiche à partir de ses Cases. La carte entière sans brouillard, une couleur par Biome et par eau (mer, côte, lac, rivière), la Couronne et le Cœur cernés, les emplacements de naissance marqués ; à côté, la part de chaque Biome, le nombre de lacs et de rivières, les emplacements libres et les voisinages interdits trouvés. Un lien « Le Monde entier » y mène depuis /controle.
- **Débloquée par** : US-0405, US-0411
- **Critères d'acceptation** :
  - Une page de contrôle interne montre le Monde entier, sans brouillard, coloré par Biome, avec la Couronne et le Cœur sauvage.
  - Elle affiche la part de chaque Biome, le nombre de lacs et de rivières, et le nombre de Cases de naissance encore libres.
  - Elle signale les voisinages interdits s'il y en a.
  - Elle est inaccessible aux joueurs.

### US-0413 · Réserver de bonnes Cases de naissance sur la Couronne
**En tant que** nouveau joueur, **je veux** naître sur une Case qui me laisse une chance de grandir, **afin de** ne pas être désavantagé dès le départ.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Avant tout le reste, la génération réserve 24 poches de prairie de 40 Cases, régulièrement réparties sur l'anneau du milieu de la Couronne (décalage tiré de la graine), que la mer, les montagnes et les rivières contournent. Seule la prairie de la Couronne reçoit un Foyer, hors du Cœur, à 4 Cases d'écart (`emplacementsDeNaissance`) : 101 à 119 emplacements sur les graines testées, 97 à 121 sur 600, sans trou de plus de 19° sur le tour. La prairie fait 20 à 22 % de la terre ; la forêt grandit d'autant côté froid et côté chaud. Le Monde du jeu et ses naissances ne changent pas. Rien de visible.
- **Débloquée par** : US-0404, US-0411
- **Critères d'acceptation** :
  - Seules les Cases de prairie de la Couronne peuvent recevoir un Foyer, comme à l'étape 9 (US-0152) : tous les départs se valent (ADR 0008).
  - La Couronne générée compte assez de prairie pour les naissances, tout autour du Monde.
  - Deux Foyers sont toujours séparés d'au moins 4 Cases (provisoire, `ECART_ENTRE_FOYERS`).

### US-0414 · Faire naître les joueurs sur le Monde généré
**En tant que** nouveau joueur, **je veux** naître sur une vraie Case du Monde, **afin de** commencer ma partie sur la carte que partagent tous les joueurs.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Le Monde du jeu n'est plus « le premier » mais le Monde ouvert, un seul à la fois (`monde.ouvert_le`, `ferme_le`, migration 0043) ; Aube l'est depuis sa naissance : rien n'a changé en production. Les naissances visent le Monde ouvert, sous un verrou commun : dix naissances simultanées sur un Monde généré obtiennent dix Cases différentes, en prairie sur la Couronne, à 4 Cases d'écart. `npm run monde:basculer -- --vers <Monde> [--essai]` ouvre un Monde généré en entier, y place chaque chef existant sur une Case de naissance libre (prairie : production inchangée), rattache son Territoire, et ferme l'ancien Monde ; Stocks, Habitants, Voyageurs, Récits et temps restent intacts, prouvé ligne pour ligne. La bascule de la production attend l'accord d'Antoine.
- **Débloquée par** : US-0413, Étape 9
- **Critères d'acceptation** :
  - La naissance de l'étape 9 choisit désormais une Case libre de la Couronne du Monde généré, selon les règles de US-0413.
  - Deux joueurs qui naissent au même instant n'obtiennent jamais la même Case.
  - Les joueurs nés avant cette étape reçoivent un Foyer sur le Monde généré, avec leurs stocks et leurs Habitants intacts.
  - Leur nouvelle Case est en prairie comme l'ancienne : leur production continue ne change pas.

### US-0415 · Refuser la naissance quand la Couronne est pleine
**En tant que** nouveau joueur, **je veux** un message clair si le Monde n'a plus de place pour moi, **afin de** ne pas rester bloqué sans comprendre.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Quand il ne reste aucune Case de prairie de la Couronne à 4 Cases de tout Foyer, le Monde est plein : le nouveau joueur lit « Le Monde est complet : il n'y a plus de place pour un nouveau Foyer. Un autre Monde ouvrira plus tard. » sous le champ de son nom, « Valider » grisé ; aucun chef ni Territoire n'est créé, aucune erreur n'est levée. Prouvé sur un Monde généré ouvert et plein.
- **Débloquée par** : US-0414
- **Critères d'acceptation** :
  - Quand plus aucune Case de la Couronne ne respecte les règles de naissance, le Monde est plein.
  - Le nouveau joueur voit un message qui l'explique, au lieu d'une erreur.
  - Aucun Foyer n'est créé ; l'ouverture d'un autre Monde viendra plus tard.

### US-0416 · Interdire de régénérer un Monde ouvert
**En tant que** développeur, **je veux** qu'un Monde où vivent des joueurs ne puisse jamais être régénéré, **afin de** tenir la promesse d'un Monde qui ne se réinitialise jamais.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). `npm run monde:generer` ne crée que des Mondes nouveaux et refuse un nom existant (« … il ne sera jamais régénéré. Générez-en un nouveau, sous un autre nom. ») ; `preparerCouronne` refuse un Monde généré. En base, des déclencheurs refusent d'effacer une Case, de vider la table ou de changer la nature d'une Case (place, anneau, Couronne, Cœur, éloignement, Biome) dès que son Monde a été ouvert ou compte un chef ; qui possède la Case change toujours, et des Cases peuvent encore s'ajouter. En développement, un nouveau Monde se génère à côté du Monde du jeu.
- **Débloquée par** : US-0414
- **Critères d'acceptation** :
  - La commande de génération refuse de toucher un Monde qui compte au moins un joueur.
  - Aucune autre commande ne peut réinitialiser un Monde ouvert.
  - En développement, on peut générer un nouveau Monde à côté pour essayer d'autres réglages.

## Étape 19 · Voir la carte

### US-0417 · Ouvrir la carte sur son Foyer
**En tant que** joueur, **je veux** ouvrir la carte du Monde depuis la navigation, **afin de** voir où se trouve mon Foyer.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Une entrée « Carte » en deuxième place de la navigation (Foyer, Carte, Habitants, Récits ; quatre onglets égaux sur mobile) ouvre la page /jeu/carte : la carte du Monde du joueur, en hexagones de 28 px dessinés dans un canvas net sur les écrans haute densité, occupe toute la place sous la barre, sans défilement, le Foyer au milieu de l'écran. Toutes les Cases sont visibles (le brouillard viendra à l'étape 20) ; seules celles à l'écran sont dessinées. Sur le Monde actuel de la production, Aube, on ne voit que sa Couronne. Vérifié en vrai sur Terra en dev.
- **Débloquée par** : US-0414
- **Critères d'acceptation** :
  - Une entrée « Carte » figure dans la navigation, sur ordinateur comme sur mobile.
  - À l'ouverture, la carte montre le Foyer du joueur au milieu de l'écran.
  - Les Cases sont dessinées en hexagones.
  - Pour l'instant, toutes les Cases sont visibles ; le brouillard arrive à l'étape 20.

### US-0418 · Dessiner chaque Case selon son Biome
**En tant que** joueur, **je veux** reconnaître le Biome de chaque Case au premier regard, **afin de** lire la carte sans effort.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Chaque Biome a sa couleur (la même que /controle/monde) et son motif, et les quatre eaux (mer, côte, lac, rivière) les leurs : douze motifs différents, dessinés dans la Case, avec un fin trait clair entre les Cases. Deux couleurs de la palette diffèrent toujours nettement (la paire la plus proche, lac et rivière, reste distincte). Vérifié en vrai sur ordinateur et à 320 px.
- **Débloquée par** : US-0417
- **Critères d'acceptation** :
  - Chaque Biome a sa couleur et son motif, dans la direction artistique du prototype.
  - Les quatre eaux (côte, lac, rivière, mer) se distinguent entre elles et de la terre.
  - Deux Biomes voisins se distinguent au premier coup d'œil, même sur un petit écran.

### US-0419 · Repérer son Foyer sur la carte
**En tant que** joueur, **je veux** repérer mon Foyer tout de suite sur la carte, **afin de** toujours retrouver mon chez-moi d'un coup d'œil.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La Case du Foyer montre l'illustration de la hutte, découpée à l'hexagone et cernée d'Encre, sous une épingle citron dont la tête ne descend jamais sous 9 px : quand les Cases rapetissent (le zoom viendra avec US-0423), elle grossit par rapport à elles. Les Foyers des autres joueurs sont un petit hexagone d'Encre, sans hutte ni épingle. Vérifié en vrai.
- **Débloquée par** : US-0418, Étape 9
- **Critères d'acceptation** :
  - La Case du Foyer montre l'illustration de la hutte du chef.
  - Le Foyer reste repérable à tous les degrés de zoom, grâce à un repère qui grossit quand on dézoome.
  - Les Foyers des autres joueurs ne se confondent pas avec le sien.

### US-0420 · Déplacer la carte à la souris
**En tant que** joueur, **je veux** faire glisser la carte à la souris, **afin de** parcourir le Monde sur ordinateur.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Glisser en gardant le bouton appuyé déplace la carte, chaque Case suivant exactement le pointeur, redessinée au rythme de l'écran ; en deçà de 4 px, c'est un clic, pas un glissement. Le milieu de l'écran ne va pas plus loin que 2 Cases au-delà du bord du Monde, et la carte glisse encore le long de ce bord. Vérifié en vrai.
- **Débloquée par** : US-0417
- **Critères d'acceptation** :
  - Glisser en gardant le bouton appuyé déplace la carte, qui suit la souris sans à-coups.
  - Un clic sans glisser n'est pas pris pour un déplacement.
  - Le déplacement s'arrête un peu au-delà du bord du Monde : on ne peut pas perdre la carte de vue.

### US-0421 · Déplacer la carte au doigt
**En tant que** joueur, **je veux** faire glisser la carte du doigt, **afin de** parcourir le Monde sur mon téléphone.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Les mêmes gestes au doigt : la carte suit le doigt, la page ne défile pas (la carte garde les gestes pour elle), un toucher de moins de 8 px n'est pas un glissement, mêmes limites qu'à la souris. Vérifié en vrai à 390 px.
- **Débloquée par** : US-0420
- **Critères d'acceptation** :
  - Glisser un doigt déplace la carte, qui suit le doigt sans à-coups.
  - Glisser sur la carte ne fait pas défiler la page.
  - Un toucher bref n'est pas pris pour un déplacement.
  - Les limites sont les mêmes qu'à la souris.

### US-0422 · Déplacer la carte au clavier
**En tant que** joueur, **je veux** déplacer la carte avec les flèches du clavier, **afin de** parcourir le Monde sans souris.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La carte se sélectionne au clavier (Tab, contour visible, nommée « Carte du Monde ») ; chaque flèche la déplace de 3 Cases, sans faire défiler la page (sauf avec Alt, Ctrl ou Cmd) ; mêmes limites qu'à la souris. Vérifié en vrai.
- **Débloquée par** : US-0420
- **Critères d'acceptation** :
  - Quand la carte est sélectionnée, chaque flèche la déplace de 3 Cases (provisoire, `CARTE_PAS_CLAVIER_CASES`).
  - Les flèches ne font pas défiler la page pendant ce temps.
  - Les limites sont les mêmes qu'à la souris.

### US-0423 · Zoomer à la molette ou au pavé tactile
**En tant que** joueur, **je veux** zoomer à la molette ou au pavé tactile, **afin de** passer d'une vue d'ensemble au détail d'une Case.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La molette et le geste de zoom du pavé tactile zooment en continu autour du pointeur (la Case sous le pointeur reste en place), d'une vue large de 40 Cases de rayon (sur la plus petite dimension) à une vue rapprochée de 4 Cases ; la page elle-même ne zoome ni ne défile (Safari compris). Vérifié en vrai.
- **Débloquée par** : US-0420
- **Critères d'acceptation** :
  - La molette et le geste de zoom du pavé tactile zooment autour du pointeur.
  - Le zoom va d'une vue large de 40 Cases de rayon à une vue rapprochée de 4 Cases (provisoire, `CARTE_ZOOM_LARGE_CASES`, `CARTE_ZOOM_PROCHE_CASES`). Depuis le 2026-10-19 (retour d'Antoine, The-Vibe-Company/bestiary#81), la vue la plus large montre le Monde entier, toutes les Cases inconnues grisées sous le brouillard.
  - La page elle-même ne zoome pas.

### US-0424 · Zoomer en pinçant
**En tant que** joueur, **je veux** zoomer en pinçant l'écran, **afin de** naviguer sur mon téléphone comme sur n'importe quelle carte.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Pincer à deux doigts zoome autour du point situé entre eux et le suit ; le zoom du navigateur ne se déclenche pas sur la carte ; le doigt qui reste continue de glisser sans à-coup ; mêmes limites qu'à la molette. Vérifié en vrai (pincement simulé).
- **Débloquée par** : US-0421, US-0423
- **Critères d'acceptation** :
  - Pincer à deux doigts zoome autour du point situé entre les deux doigts.
  - Le zoom du navigateur ne se déclenche pas sur la carte.
  - Les limites de zoom sont les mêmes qu'à la molette.

### US-0425 · Zoomer avec des boutons
**En tant que** joueur, **je veux** des boutons pour zoomer, **afin de** pouvoir zoomer même sans molette ni pincement.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Deux boutons « + » et « − » de 44 px, en bas à droite de la carte (au-dessus des onglets sur mobile), zooment d'un cran (×1,5) autour du milieu de l'écran et se grisent quand leur limite est atteinte, y compris à la molette. Vérifié en vrai.
- **Débloquée par** : US-0423
- **Critères d'acceptation** :
  - Deux boutons « + » et « − » restent visibles sur la carte, à portée de pouce sur mobile.
  - Chaque appui zoome d'un cran, autour du milieu de l'écran.
  - Un bouton est grisé quand sa limite de zoom est atteinte.

### US-0426 · Revenir au Foyer sur la carte
**En tant que** joueur, **je veux** un bouton qui ramène la carte sur mon Foyer, **afin de** ne jamais me perdre dans le Monde.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Un bouton « Revenir au Foyer » de 44 px, au-dessus de « + » et « − », ramène la carte sur le Foyer au zoom d'ouverture, par un glissement doux de 300 ms (`CARTE_RETOUR_AU_FOYER_MS`). Avec le mouvement réduit, elle y va d'un coup ; un geste pendant le mouvement l'arrête. Quand le Foyer est hors de l'écran, une flèche citron au bord de la carte pointe vers lui, suit la vue, évite la légende et les panneaux, et ramène au Foyer quand on la touche. Sur mobile, les boutons restent au-dessus du panneau de la légende ouvert. Vérifié en vrai.
- **Débloquée par** : US-0419, US-0420
- **Critères d'acceptation** :
  - Un bouton ramène la carte sur le Foyer, au zoom par défaut, par un court mouvement.
  - Le bouton reste visible quoi que l'on fasse sur la carte.
  - Quand le Foyer est hors de l'écran, une flèche au bord de la carte indique sa direction (décidé le 2026-10-08).

### US-0427 · Retrouver la carte là où on l'a laissée
**En tant que** joueur, **je veux** retrouver la carte au même endroit quand j'y reviens, **afin de** ne pas refaire le chemin à chaque fois.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Dans le même onglet, la carte se rouvre au même endroit et au même zoom (vue retenue en coordonnées du Monde dans `sessionStorage`, ramenée aux bornes d'un écran plus petit). Un nouvel onglet, un autre Monde ou un autre Foyer se rouvrent sur le Foyer, comme lorsque le stockage est indisponible. Vérifié en vrai.
- **Débloquée par** : US-0426
- **Critères d'acceptation** :
  - En revenant sur la carte pendant la même visite, on retrouve le même endroit et le même zoom.
  - À une nouvelle visite, la carte se rouvre sur le Foyer plutôt que là où on l'avait laissée (décidé le 2026-10-08).

### US-0428 · Ouvrir la fiche d'une Case
**En tant que** joueur, **je veux** toucher une Case pour ouvrir sa fiche, **afin de** connaître son Biome et son propriétaire.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Toucher ou cliquer une Case la surligne aussitôt (un trait citron bordé d'Encre) et ouvre sa fiche : son Biome, ou pour l'eau sa variante, et son propriétaire (« Libre », « Votre Foyer » ou le nom du chef). Au clavier, Entrée ouvre la fiche de la Case du milieu. La fiche est lue sur le serveur, à partir du Monde et du Foyer du joueur, jamais du navigateur. Un glissement ou un pincement n'ouvre rien, pas plus qu'un toucher hors du Monde. Sur ordinateur, la fiche flotte en haut à gauche de la carte, et la carte glisse juste assez pour que la fiche ne cache pas la Case. Vérifié en vrai.
- **Débloquée par** : US-0421
- **Critères d'acceptation** :
  - Toucher ou cliquer une Case ouvre sa fiche, avec son Biome et son propriétaire : « Libre », « Votre Foyer » ou le nom du chef.
  - La Case choisie est surlignée sur la carte.
  - Un glissement n'ouvre pas de fiche.
  - Sur ordinateur, la fiche s'ouvre à côté de la carte, sans la cacher.

### US-0429 · Situer une Case dans le Monde depuis sa fiche
**En tant que** joueur, **je veux** voir sur la fiche où se trouve la Case dans le Monde, **afin de** juger si elle est proche de chez moi ou du Cœur sauvage.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La fiche dit « Couronne », « Cœur sauvage » ou « Entre la Couronne et le Cœur sauvage », et la distance au Foyer (« À 7 Cases de votre Foyer », rien pour le Foyer lui-même). Pour une Case du Cœur sauvage, elle ajoute « Les Espèces les plus rares vivent ici. » Vérifié en vrai.
- **Débloquée par** : US-0428, US-0404, US-0405
- **Critères d'acceptation** :
  - La fiche dit si la Case appartient à la Couronne ou au Cœur sauvage.
  - Elle donne la distance entre la Case et le Foyer, en Cases.
  - Pour une Case du Cœur sauvage, une phrase explique que les Espèces les plus rares y vivent.

### US-0430 · Fermer la fiche d'une Case
**En tant que** joueur, **je veux** fermer la fiche d'une Case facilement, **afin de** revenir à la carte sans détour.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La fiche se ferme par sa croix de 44 px, par Échap (le focus revient à la carte) ou par un toucher sur la carte hors de la Case. Toucher une autre Case remplace la fiche. Fermer retire le surlignage, et une réponse du serveur arrivée trop tard est ignorée. Vérifié en vrai.
- **Débloquée par** : US-0428
- **Critères d'acceptation** :
  - La fiche se ferme par sa croix, par la touche Échap, ou en touchant la carte hors de la Case.
  - Toucher une autre Case remplace la fiche au lieu d'en ouvrir une deuxième.
  - Fermer la fiche retire le surlignage de la Case.

### US-0431 · Lire la fiche d'une Case sur mobile
**En tant que** joueur, **je veux** que la fiche d'une Case s'ouvre en bas de l'écran sur mon téléphone, **afin de** garder la carte sous les yeux.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Sur mobile, la fiche s'ouvre dans un panneau en bas, au-dessus des onglets, à la place de la légende. Si la Case tombait dessous, la carte glisse pour qu'on la voie. Glisser le panneau vers le bas au-delà de 60 px le ferme, sinon il revient. Les boutons de la carte et la flèche du Foyer restent au-dessus du panneau, et la carte se manie au-dessus. Toucher « Légende » ferme la fiche et montre la légende. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0428
- **Critères d'acceptation** :
  - Sur mobile, la fiche s'ouvre dans un panneau en bas de l'écran, sans cacher la Case choisie.
  - On la ferme en la faisant glisser vers le bas.
  - La carte reste utilisable au-dessus du panneau.

### US-0432 · Consulter la légende de la carte
**En tant que** joueur, **je veux** une légende qui explique les couleurs et les repères de la carte, **afin de** ne jamais hésiter sur le Biome d'une Case.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Un bouton « Légende » (44 px) en haut à droite de la carte ouvre un panneau flottant sur ordinateur, un panneau en bas (au plus 45 % de la hauteur, au-dessus des onglets) sur mobile : les 8 Biomes et les 4 eaux, chacun avec un échantillon dessiné par les mêmes fonctions que la carte (couleur, motif, bordure), puis « Votre Foyer » et « Autres Foyers ». Il s'ouvre et se ferme d'un geste, et l'appareil se souvient de son état. Vérifié en vrai.
- **Débloquée par** : US-0418
- **Critères d'acceptation** :
  - Un bouton « Légende » ouvre la liste des Biomes et des quatre eaux avec leur couleur, ainsi que le repère du Foyer.
  - La légende s'ouvre et se ferme d'un geste ; l'appareil retient si elle était ouverte.
  - Sur mobile, elle s'ouvre dans un panneau qui laisse la carte visible.

### US-0433 · Voir les limites de la Couronne et du Cœur sauvage
**En tant que** joueur, **je veux** voir sur la carte où s'arrêtent la Couronne et le Cœur sauvage, **afin de** mesurer le danger d'une région.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Chaque Case connaît sa zone ; sur les arêtes entre la Couronne et le reste du Monde, un liseré d'Encre semi-transparente en tirets de 2 px, et autour du Cœur sauvage des pointillés ronds, dessinés au-dessus des Cases sans les cacher ; la légende gagne ces deux lignes. Sur Aube, qui n'a que sa Couronne, la limite n'apparaît pas (rien n'est dessiné au-delà). Vérifié en vrai.
- **Débloquée par** : US-0418, US-0432
- **Critères d'acceptation** :
  - Un léger liseré marque la limite de la Couronne et celle du Cœur sauvage.
  - Le liseré ne cache pas les Biomes.
  - La légende explique ces deux liserés.

### US-0434 · Afficher la carte rapidement
**En tant que** joueur, **je veux** que la carte s'affiche vite, **afin de** jouer même quand je n'ai que quelques secondes.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Les 10 981 Cases voyagent en colonnes compactes (moins de 12 octets par Case, 3,5 Ko compressées) ; mesuré en navigateur sans tête, téléphone 390 px, processeur ralenti ×4 : carte utilisable en 1,8 s en 4G lente (la « connexion mobile ordinaire » retenue), 3,4 s en 3G rapide (mesure pessimiste, serveur local en HTTP/1.1). Pendant le chargement, un bloc d'attente Bento (trois Cases qui battent) couvre toute l'attente, jusqu'au premier dessin ; un `loading.tsx` a été écarté parce qu'il ralentissait la carte. En cas d'échec : « La carte n'a pas pu s'afficher. » et « Réessayer ».
- **Débloquée par** : US-0418
- **Critères d'acceptation** :
  - La carte est utilisable en moins de 3 secondes (provisoire, `CARTE_UTILISABLE_SECONDES` ; mesuré en 4G lente) sur une connexion mobile ordinaire.
  - Pendant le chargement, un état d'attente s'affiche dans l'habillage Bento.
  - En cas d'échec, un message et un bouton « Réessayer » s'affichent.

### US-0435 · Garder la carte fluide sur mobile
**En tant que** joueur, **je veux** une carte fluide sur mon téléphone, **afin de** parcourir le Monde sans saccades.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1357, Zewed/bestia-2#6). Dézoomée au maximum, la carte tombait à 1 ou 2 images par seconde sur le téléphone de référence : refermer chaque hexagone d'un même grand tracé coûtait de plus en plus cher dans Chrome. Les remplissages ne referment plus les hexagones et les bords se referment autrement, pour le même dessin à l'œil. Mesures (build de production, Chrome sans tête, processeur ralenti 4 fois, 390 × 844, densité 3, tout le Monde découvert) : 54 à 56 images par seconde au zoom par défaut, 49 à 52 dézoomé au maximum, encore 45 à 57 après 5 minutes de navigation, sans montée de la mémoire. Seules les Cases à l'écran, et une de marge, sont dessinées.
- **Débloquée par** : US-0424
- **Critères d'acceptation** :
  - Déplacements et zoom tiennent 30 images par seconde (provisoire) sur le téléphone de référence : Chrome en émulation mobile, processeur ralenti 4 fois, 390 × 844 px, densité 3 (décidé le 2026-10-08).
  - Seules les Cases à l'écran, et un peu autour, sont dessinées.
  - Dézoomer au maximum reste aussi fluide.
  - Après 5 minutes (provisoire) de navigation continue, la carte ne ralentit pas.

## Étape 20 · Le brouillard

### US-0436 · Ne voir d'abord que les abords de son Foyer
**En tant que** nouveau joueur, **je veux** ne voir au départ que les Cases proches de mon Foyer, **afin de** garder au Monde tout son mystère.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Une Case est découverte quand elle est enregistrée pour le Territoire (migration 0045, table `case_decouverte`). Un Territoire naît avec les Cases à 4 Cases ou moins de son Foyer découvertes, dans la même transaction que sa naissance. La migration les a données aux Territoires déjà nés ; son calcul en SQL est le miroir de `distance` et donne exactement les mêmes Cases. Une bascule de Monde découvre les abords du nouveau Foyer. La carte montre encore tout : le dessin du brouillard vient avec US-0437. Vérifié sur base.
- **Débloquée par** : US-0417
- **Critères d'acceptation** :
  - Au départ, seules les Cases à 4 Cases (provisoire, `ABORDS_DU_FOYER_CASES`) du Foyer ou moins sont découvertes.
  - Toutes les autres Cases sont sous le brouillard.
  - Les joueurs nés avant cette étape découvrent eux aussi les abords de leur Foyer, et rien de plus.

### US-0437 · Dessiner le brouillard
**En tant que** joueur, **je veux** distinguer au premier regard les Cases découvertes de celles sous le brouillard, **afin de** voir ce qu'il me reste à explorer.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Une Case sous le brouillard est peinte d'une brume unie, sans motif ni bord, d'un neutre distinct de toutes les teintes de Biome et d'eau. Sous la brume, on ne voit ni liseré de la Couronne ou du Cœur sauvage, ni Foyer d'un autre chef, et rien ne se devine à son bord. La légende ajoute « Brouillard » aux Repères. Vérifié en vrai.
- **Débloquée par** : US-0436, US-0432
- **Critères d'acceptation** :
  - Une Case sous le brouillard est dessinée d'un aspect uniforme, sans son Biome ni son propriétaire.
  - Le bord du brouillard ne laisse deviner aucun Biome caché.
  - La légende ajoute le brouillard.

### US-0438 · Toucher une Case sous le brouillard
**En tant que** joueur, **je veux** qu'une Case sous le brouillard ne dise rien d'elle, **afin de** garder l'envie d'aller la découvrir.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La fiche d'une Case sous le brouillard dit « Case inconnue », sa distance au Foyer et « Une Expédition pourra la découvrir. », rien d'autre. La réponse vient du serveur. Vérifié en vrai, sur ordinateur et à 390 px.
- **Débloquée par** : US-0437, US-0428
- **Critères d'acceptation** :
  - La fiche d'une Case sous le brouillard dit seulement « Case inconnue » et donne sa distance au Foyer.
  - Elle ne montre ni Biome, ni propriétaire, ni appartenance à la Couronne ou au Cœur sauvage.
  - Elle explique que les Expéditions permettront plus tard de la découvrir.

### US-0439 · Ne rien laisser passer de ce que cache le brouillard
**En tant que** développeur, **je veux** que le navigateur ne reçoive jamais ce que cache le brouillard, **afin de** rendre la triche impossible.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Pour une Case non découverte, la page ne reçoit que sa place et la brume : ni Biome, ni zone, ni Foyer. La liste des teintes envoyée ne contient que celles des Cases découvertes. Demander directement la fiche d'une Case cachée renvoie « Case inconnue », sans nom de chef. Prouvé sur base, en inspectant ce que reçoit la page et par l'action appelée directement.
- **Débloquée par** : US-0438
- **Critères d'acceptation** :
  - Le navigateur ne reçoit ni le Biome ni le propriétaire d'une Case sous le brouillard du joueur.
  - Dans les échanges du navigateur, seules les Cases découvertes portent un Biome.
  - Demander directement la fiche d'une Case sous le brouillard renvoie « Case inconnue ».

### US-0440 · Avoir son propre brouillard
**En tant que** joueur, **je veux** un brouillard qui n'appartient qu'à moi, **afin de** découvrir le Monde à mon rythme.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Chaque Territoire a ses Cases découvertes, enregistrées à part, une ligne par Case, effacées avec lui. Deux Territoires aux Foyers éloignés n'ont aucune Case en commun, et ce qu'un joueur découvre reste caché pour les autres, voisin compris. Vérifié sur base.
- **Débloquée par** : US-0436
- **Critères d'acceptation** :
  - Chaque joueur a son propre brouillard, enregistré à part.
  - Deux joueurs aux Foyers éloignés ne voient pas les mêmes Cases.
  - Une Case découverte par un joueur reste cachée pour les autres.

### US-0441 · Garder visibles les Cases déjà vues
**En tant que** joueur, **je veux** que les Cases que j'ai découvertes le restent pour toujours, **afin de** ne jamais perdre ce que j'ai exploré.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Une Case découverte reste découverte d'une visite et d'un appareil à l'autre. Seul le fait d'être découverte est enregistré : son Biome et son propriétaire se lisent toujours en direct. Une seule façon de découvrir, sans effet sur une Case déjà découverte. Rien dans le jeu ne retire une Case découverte (rattrapage, Famine, renvoi, accueil) ; un test le vérifie dans tout le code. Vérifié sur base.
- **Débloquée par** : US-0440
- **Critères d'acceptation** :
  - Une Case découverte reste découverte d'une visite à l'autre et sur tous les appareils.
  - Son Biome et son propriétaire restent à jour, même si l'on n'y retourne jamais.
  - Aucune action du jeu ne remet une Case sous le brouillard.

### US-0442 · Découvrir des Cases d'une seule façon
**En tant que** développeur, **je veux** une seule façon de découvrir des Cases, **afin de** la réutiliser pour les Expéditions et les Avant-postes sans rien réécrire.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Seul `decouvrir` écrit les Cases découvertes ; la naissance et la bascule passent par lui, et redécouvrir une Case ne change rien. La carte ouverte demande les nouvelles découvertes au serveur toutes les 60 secondes, tant que l'onglet est visible (`CARTE_DECOUVERTES_SECONDES`), et dès qu'il le redevient. Elle les dessine aussitôt, sans recharger la page. Vérifié en vrai.
- **Débloquée par** : US-0441
- **Critères d'acceptation** :
  - Les abords du Foyer sont découverts par cette seule façon de faire.
  - Découvrir une Case déjà découverte ne change rien.
  - Une Case découverte apparaît sur la carte sans recharger la page.

### US-0443 · Compter les Cases découvertes
**En tant que** joueur, **je veux** voir combien de Cases j'ai découvertes, **afin de** mesurer mes progrès dans la découverte du Monde.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). En bas à gauche de la carte, une ligne discrète : « 61 Cases découvertes · 0,6 % du Monde ». Elle passe sous la forme « moins de 0,1 % » si besoin, et monte à chaque découverte. Sur mobile, elle reste au-dessus du panneau du bas, et la flèche du Foyer l'évite. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0442
- **Critères d'acceptation** :
  - La carte affiche le nombre de Cases découvertes.
  - La part du Monde découverte s'affiche aussi, en pourcentage (décidé le 2026-10-08).
  - Le compteur monte à chaque découverte.
