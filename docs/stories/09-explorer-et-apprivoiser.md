# Jalon 9 · Explorer et apprivoiser

Le joueur envoie ses explorateurs, seuls ou avec une escorte de Bêtes, vers des Cases lointaines où le Monde fait apparaître des Bêtes sauvages. Seuls, ils ne ramènent que des Bêtes communes : ce sont ses premières Bêtes, et chaque nouveau Foyer en a quelques-unes à portée. Avec une escorte assez forte, il apprivoise plus rare, perd des Bêtes face à plus fort que lui, et réunit ses premiers Couples, qui lui ouvrent l'Élevage. Étapes couvertes : 38 à 45 de l'ordre d'attaque, attaquées juste après la carte du Monde (ADR 0008).

## Étape 38 · La première Expédition

### US-0901 · Ouvrir l'écran d'Expédition
**En tant que** joueur, **je veux** préparer une Expédition depuis la carte ou depuis le menu, **afin de** partir chercher des Bêtes sauvages là où je le décide.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1359, Zewed/bestia-2#3). La fiche d'une Case se termine par « Envoyer une Expédition », sauf sur le Foyer du joueur ; le lien ouvre l'écran d'Expédition (`/jeu/expeditions/nouvelle`) avec la Case pour destination : son Biome, « inconnu » sous le brouillard, et sa distance au Foyer. Une entrée « Expéditions » de la navigation ouvre le même écran sans destination, avec « Choisir sur la carte ». L'écran tient de 320 à 1 440 px sans défilement de côté. Vérifié en vrai.
- **Débloquée par** : Étape 14, Étape 19
- **Critères d'acceptation** :
  - Toucher une Case de la carte propose « Envoyer une Expédition », qui ouvre l'écran d'Expédition avec cette Case déjà choisie comme destination.
  - Le menu ouvre le même écran, sans destination choisie.
  - L'écran tient sur un téléphone sans défilement de côté, et chaque choix se fait au pouce.

### US-0902 · Choisir les explorateurs
**En tant que** joueur, **je veux** choisir combien de mes explorateurs partent, **afin de** garder les autres pour d'autres Expéditions.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1360, Zewed/bestia-2#5). Sous la destination, le bloc « Explorateurs » montre les explorateurs libres sur le total (« Libres 2 / 3 ») et le nombre qui partent, choisi au pouce entre « − » et « + ». Le choix part de zéro et ne dépasse jamais les libres ; il est gardé dans l'adresse. « Partir » reste grisé à zéro, avec « Il faut au moins un explorateur. » ; le départ lui-même arrive avec US-0911. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0901
- **Critères d'acceptation** :
  - Seuls les Habitants au Métier d'explorateur qui ne sont pas déjà partis sont proposés, avec un compteur « libres / total ».
  - Il faut au moins un explorateur : à zéro, le bouton de départ reste grisé et dit pourquoi.
  - On ne peut pas choisir plus d'explorateurs qu'il n'y en a de libres.
  - Un explorateur de plus augmente les chances de Rencontre sur la Case (la règle chiffrée arrive avec l'étape 40) ; d'ici là, il ne change que ce que l'Expédition mange (décidé le 2026-10-08).

### US-0903 · Aucun explorateur libre
**En tant que** nouveau joueur, **je veux** comprendre pourquoi je ne peux pas encore partir, **afin de** trouver comment lancer ma première Expédition.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1361, Zewed/bestia-2#8). Quand aucun explorateur n'est libre, un bloc « Explorateurs » remplace tout le formulaire de l'écran d'Expédition. Il dit « Aucun explorateur » et « Il faut au moins un explorateur pour partir. », ou, quand tous sont partis, « Prochain retour le 9 octobre à 14:05 » (heure de Paris, alimentée par le départ, US-0911). Un lien « Donner le Métier d'explorateur » mène à la page Habitants. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0902
- **Critères d'acceptation** :
  - Sans aucun explorateur, l'écran affiche un message clair à la place du formulaire, avec un lien vers la page Habitants pour donner ce Métier.
  - Si tous les explorateurs sont déjà partis, le message indique l'heure du prochain retour.
  - Le lien mène directement à la page Habitants, sur ordinateur comme sur mobile.

### US-0904 · Choisir l'escorte
**En tant que** joueur, **je veux** choisir, Espèce par Espèce, combien de Bêtes accompagnent mes explorateurs, **afin de** leur donner assez de force pour qu'une Bête sauvage plus rare les suive.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1362, Zewed/bestia-2#9). L'effectif d'un Territoire se compte par Espèce et par sexe (table `effectif`, migration 0047, ADR 0002), vide pour tous tant que l'apprivoisement (étape 40) n'existe pas. Avec des Bêtes, le bloc « Escorte » de l'écran d'Expédition liste chaque Espèce disponible avec sa vignette et son nombre ; on en choisit au pouce avec « − » et « + », « Toutes » et « Aucune ». Le choix est gardé dans l'adresse et rien n'est retenu avant le départ. Les Bêtes d'un Couple en Réserve et celles déjà sorties seront retirées des disponibles (jalon 8, US-0911). Sans Bête, pas de bloc. Vérifié en vrai, avec des Bêtes ajoutées à un compte d'essai.
- **Débloquée par** : US-0902
- **Critères d'acceptation** :
  - Chaque Espèce de l'effectif apparaît avec son illustration et le nombre de Bêtes disponibles ; sans aucune Bête, l'écran ne propose pas d'escorte et l'Expédition part sans (US-0909).
  - Les Bêtes d'un Couple en Réserve et les Bêtes déjà sorties ne sont jamais proposées.
  - On ne peut pas dépasser le nombre disponible ; un bouton « toutes » prend le maximum d'une Espèce, un autre remet à zéro.
  - Rien n'est retenu tant que le départ n'est pas confirmé : les Bêtes choisies restent disponibles ailleurs jusque-là.

### US-0905 · La force de l'escorte
**En tant que** joueur, **je veux** voir la force de mon escorte pendant que je la compose, **afin de** juger ce qu'elle pourra apprivoiser.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1363, Zewed/bestia-2#12). Sous les Espèces du bloc « Escorte », une ligne « Force » donne la force de l'escorte, qui se met à jour à chaque Bête ajoutée ou retirée. Elle vaut 0 sans escorte. La force d'une Bête est l'arrondi de la racine carrée de son attaque multipliée par sa vie (une souris vaut 473, une poule 9 457), la même pour toutes les Bêtes d'une Espèce chez tous les joueurs ; l'escorte en fait la simple somme (`src/expeditions/force.ts`). Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0904
- **Critères d'acceptation** :
  - La force de l'escorte est la simple somme des forces de ses Bêtes, sans bonus de groupe ni règle de taille.
  - La force d'une Bête vient des caractéristiques de son Espèce, la même pour toutes les Bêtes de l'Espèce et chez tous les joueurs ; la force d'une Bête vaut la racine carrée de l'attaque multipliée par la vie, arrondie (décidé le 2026-10-08).
  - Aucune Recherche ne change cette force.
  - Le total se met à jour à chaque Bête ajoutée ou retirée ; sans escorte, il vaut zéro.

### US-0906 · Choisir la durée du séjour
**En tant que** joueur, **je veux** choisir combien de temps l'Expédition reste sur la Case, **afin de** l'accorder au moment où je reviendrai jouer.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1364, Zewed/bestia-2#4). Le bloc « Séjour » de l'écran d'Expédition montre la durée choisie en grand, avec un curseur de 30 min à 1 j par pas de 30 min et, d'un doigt, les durées toutes prêtes 1 h, 4 h, 8 h et 12 h (1 h par défaut). La durée est gardée dans l'adresse, au rechargement comme au détour par la carte. Le séjour ne commencera qu'à l'arrivée (`horaireDuSejour`, que le départ, US-0911, utilisera). Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0901
- **Critères d'acceptation** :
  - La durée se choisit entre 30 minutes et 24 heures, par pas de 30 minutes (provisoire, `SEJOUR_MINUTES`).
  - Quelques durées toutes prêtes se choisissent d'un doigt sur mobile ; 1 h, 4 h, 8 h et 12 h (décidé le 2026-10-08).
  - Le séjour ne commence qu'à l'arrivée : le temps du trajet ne le raccourcit pas.

### US-0907 · Choisir la destination
**En tant que** joueur, **je veux** choisir la Case où se rend l'Expédition, même si elle est encore dans le brouillard, **afin de** partir à la découverte du Monde.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1365, Zewed/bestia-2#7). Depuis l'écran d'Expédition, « Choisir sur la carte » ouvre la carte en mode choix : toucher une Case ouvre sa fiche, avec sa distance et « Choisir cette destination », qui revient à l'écran. Une Case sous le brouillard peut être choisie ; son Biome s'affiche « inconnu ». Le Foyer et toute Case d'un Territoire sont refusés par le serveur, même sous le brouillard, avec « Cette Case appartient à un Territoire. ». Le détour par la carte garde les autres choix de l'écran. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0901, Étape 20
- **Critères d'acceptation** :
  - Toucher une Case depuis l'écran d'Expédition la choisit ; sa distance en Cases depuis le Foyer s'affiche.
  - Une Case dans le brouillard peut être choisie ; son Biome s'affiche « inconnu ».
  - Le Foyer lui-même ne peut pas être choisi.
  - Une Case qui appartient à un Territoire, le sien ou celui d'un autre joueur, est refusée avec le message « Cette Case appartient à un Territoire. » (décidé le 2026-10-08).

### US-0908 · La portée d'exploration
**En tant que** joueur, **je veux** voir jusqu'où mes Expéditions peuvent aller, **afin de** choisir une destination qu'elles peuvent atteindre.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1366, Zewed/bestia-2#10). La destination d'une Expédition est à 8 Cases du Foyer au plus (`PORTEE_D_EXPLORATION_CASES`, provisoire). Pendant le choix sur la carte, les Cases au-delà sont voilées et leur fiche dit « Cette Case est hors de portée. ». Le serveur refuse de même une destination hors de portée, d'où que vienne la demande. Le voile ne coûte rien de plus à la carte, même dézoomée. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0907
- **Critères d'acceptation** :
  - Une portée d'exploration de départ limite la distance d'une destination à 8 Cases du Foyer (provisoire, `PORTEE_D_EXPLORATION_CASES`).
  - Pendant le choix de la destination, les Cases hors de portée sont grisées et ne peuvent pas être choisies.
  - Le jeu refuse une destination hors de portée, même demandée par un autre chemin que l'écran.
  - Des Recherches de la branche Explorer agrandiront cette portée (US-0731, jalon 7).

### US-0909 · Partir sans escorte
**En tant que** joueur, **je veux** envoyer des explorateurs seuls, **afin de** lever le brouillard et ramener mes premières Bêtes sans en risquer aucune.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1367, Zewed/bestia-2#11). Une Expédition avec au moins un explorateur peut partir sans aucune Bête. Sans Bête disponible, le bloc « Escorte » de l'écran d'Expédition dit seulement « Sans escorte, l'Expédition ne ramènera que des Bêtes communes. ». Sans escorte, elle avance au pas des explorateurs, 20 minutes de jeu par Case (provisoire, `PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE`), que la durée du trajet (US-0912) utilisera. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0902, US-0906, US-0907
- **Critères d'acceptation** :
  - Une Expédition avec au moins un explorateur et aucune Bête peut partir.
  - Sans escorte, elle ne peut ramener que des Bêtes communes (règle à l'étape 40) ; le récapitulatif l'indique en quelques mots, à la place de la force.
  - Sans escorte, l'Expédition avance au pas des explorateurs : 20 minutes de jeu par Case (provisoire, `PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE`).

### US-0910 · Le récapitulatif avant le départ
**En tant que** joueur, **je veux** relire tout ce que j'ai choisi avant de confirmer, **afin de** ne pas partir avec une erreur.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1368, Zewed/bestia-2#14). Au pied de l'écran d'Expédition, un bloc « Récapitulatif » suit chaque choix sans recharger la page, le curseur du séjour compris : explorateurs, escorte par Espèce et sa force (ou « Sans escorte : Bêtes communes seulement »), destination et Biome (ou « inconnu »), aller, séjour, retour et heure de retour prévue, qui avance au rythme du jeu. « Partir » reste grisé et nomme ce qui manque : une destination, au moins un explorateur, ou les deux. Sur un téléphone, il reste collé en bas, replié sur l'heure de retour prévue et « Partir », et un chevron le déplie. Le trajet d'une escorte n'est pas encore chiffré (« — ») : il arrive avec US-0912.
- **Débloquée par** : US-0905, US-0906, US-0908
- **Critères d'acceptation** :
  - Le récapitulatif montre les explorateurs, l'escorte par Espèce, sa force, la destination et son Biome (ou « inconnu »), les durées de l'aller, du séjour et du retour, et l'heure de retour prévue.
  - Il rappelle que ceux qui partent continuent de manger pendant toute l'absence.
  - Tant qu'un choix manque, le bouton « Partir » reste grisé et nomme ce qui manque.
  - Sur mobile, le récapitulatif reste visible en bas de l'écran pendant qu'on compose l'Expédition.

### US-0911 · Lancer l'Expédition
**En tant que** joueur, **je veux** confirmer le départ, **afin de** mettre en route mes explorateurs et mon escorte.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1369, Zewed/bestia-2#16). « Partir » lance l'Expédition, à l'heure du jeu, dans une transaction qui relit tout au moment de confirmer, et mène à la liste des Expéditions en cours, où elle apparaît à l'aller. Les explorateurs partis sont « en Expédition » sur la page Habitants : leur Métier ne se change pas et ils ne se renvoient pas avant leur retour. Les Bêtes de l'escorte sortent des disponibles. Deux départs au même instant ne prennent jamais deux fois le même explorateur ni la même Bête ; un départ refusé ne retient rien et dit pourquoi. Tables expedition et expedition_escorte (migration 0049). Rien ne fait encore rentrer une Expédition (US-0916).
- **Débloquée par** : US-0910
- **Critères d'acceptation** :
  - « Partir » fait passer les explorateurs et les Bêtes à l'état « en Expédition » : ils ne sont plus proposés ailleurs, et le Métier d'un explorateur parti ne peut pas être changé avant son retour.
  - L'Expédition apparaît aussitôt dans la liste des Expéditions en cours, en phase « aller ».
  - Deux départs envoyés au même instant n'emmènent jamais deux fois le même explorateur ni la même Bête.
  - Si une Bête ou un explorateur n'est plus disponible au moment de confirmer, le départ est refusé avec un message, et rien n'est retenu.

### US-0912 · La durée du trajet
**En tant que** joueur, **je veux** que le trajet dure selon la distance et l'allure de mon escorte, **afin de** choisir entre aller loin et revenir vite.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1370, Zewed/bestia-2#19). L'aller dure la distance en Cases multipliée par l'allure de l'Expédition, et le retour autant. L'allure est celle des explorateurs, 20 minutes de jeu par Case pour une marche à 5 km/h, ou celle de la Bête la plus lente de l'escorte si elle va moins vite : 20 × 5 / v minutes par Case à v km/h, arrondies à la minute supérieure. Aucune Espèce du jeu n'étant aujourd'hui plus lente que 5 km/h, une escorte va pour l'instant au pas des explorateurs. Le chemin va en ligne droite, Case par Case, l'eau comprise (src/expeditions/chemin.ts). Le récapitulatif chiffre maintenant l'aller, le retour et l'heure prévue d'une escorte ; la migration 0050 a chiffré les Expéditions parties sans trajet.
- **Débloquée par** : US-0911
- **Critères d'acceptation** :
  - La durée de l'aller dépend de la distance en Cases : 20 minutes de jeu par Case au pas des explorateurs (décidé le 2026-10-08).
  - L'Expédition avance au pas de la Bête la plus lente de l'escorte, d'après la vitesse de son Espèce ; le pas des explorateurs, une marche à 5 km/h, est aussi une limite : l'Expédition va au plus lent des deux (décidé le 2026-10-08).
  - Le retour dure autant que l'aller.
  - Le chemin passe de Case en Case ; l'eau se traverse à la même allure, en ligne droite, comme la distance de la carte (décidé le 2026-10-08).
  - En vitesse accélérée de développement, toutes ces durées sont raccourcies d'autant.

### US-0913 · Suivre l'Expédition sur la carte
**En tant que** joueur, **je veux** voir où en est mon Expédition sur la carte, **afin de** suivre sa progression d'un coup d'œil.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1371, Zewed/bestia-2#23). Sur la carte, chaque Expédition en cours du joueur a un repère posé sur son chemin, qui avance chaque seconde au rythme du jeu ; son chemin est tracé en pointillés du Foyer à la destination, marquée d'un fanion. Seul le joueur qui l'a envoyée les voit. Toucher le repère ouvre la fiche de l'Expédition, avec le même détail que la liste : phase, temps restant, explorateurs, escorte, retour prévu. Toucher encore passe au repère suivant posé au même point, puis à la Case dessous. La position sur le chemin se calcule en un seul endroit (src/expeditions/position.ts).
- **Débloquée par** : US-0911, Étape 19
- **Critères d'acceptation** :
  - Un repère montre l'endroit du chemin où se trouve l'Expédition, et la destination est marquée.
  - Seul le joueur qui l'a envoyée voit ce repère.
  - Toucher le repère ouvre le détail de l'Expédition : phase, temps restant, explorateurs et escorte.

### US-0914 · Le brouillard se lève sur le chemin
**En tant que** joueur, **je veux** que le brouillard se lève là où passe mon Expédition, **afin de** découvrir le Monde en l'explorant.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1372, Zewed/bestia-2#26). Le brouillard se lève là où passe une Expédition, Case après Case, à l'heure exacte de son passage : 1 Case autour de chaque Case du chemin, puis 2 autour de la destination à l'arrivée, Biome compris ; rien au départ. Levé, il le reste, pour ce joueur seulement, et un joueur absent retrouve exactement les mêmes Cases qu'en direct. Chaque Case levée revient à l'Expédition qui l'a révélée la première (case_decouverte.expedition_id, migration 0054), pour le récit de retour. Une carte ouverte montre les nouvelles Cases à sa relecture suivante, une minute au plus.
- **Débloquée par** : US-0912, Étape 20
- **Critères d'acceptation** :
  - Les Cases traversées, et leurs voisines dans un rayon de 1 Case (2 autour de la destination, décidé le 2026-10-09), sortent du brouillard au fur et à mesure du passage, pas toutes au départ.
  - À l'arrivée, la destination et ses voisines sont révélées, Biome compris.
  - Le brouillard levé le reste pour toujours, et pour ce joueur seulement.
  - Après une absence, les Cases révélées sont exactement celles qu'on aurait vues en suivant l'Expédition en direct.

### US-0915 · Le séjour sur la Case
**En tant que** joueur, **je veux** que mon Expédition reste sur la Case le temps choisi, **afin de** lui laisser la chance d'y croiser des Bêtes sauvages.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1373, Zewed/bestia-2#22). À l'arrivée, l'Expédition passe en « séjour » avec le compte à rebours de la durée choisie, et repart seule vers le Foyer à sa fin, sans action ni rechargement. Le séjour va de l'arrivée (comprise) à la fin de la durée (exclue) ; un seul endroit dit quelles Expéditions sont présentes sur une Case, à un instant ou pendant une période (src/expeditions/presence.ts), la même réponse en direct et au rattrapage : c'est là que l'étape 40 fera ses Rencontres.
- **Débloquée par** : US-0912
- **Critères d'acceptation** :
  - À l'arrivée, l'Expédition passe en phase « séjour », avec le compte à rebours de la durée choisie.
  - Pendant tout le séjour, elle est présente sur la Case : c'est là qu'auront lieu ses Rencontres (étape 40).
  - À la fin du séjour, elle repart seule vers le Foyer, sans action du joueur.

### US-0916 · Le retour au Foyer
**En tant que** joueur, **je veux** retrouver mes explorateurs et mes Bêtes à leur retour, **afin de** les renvoyer aussitôt.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1374, Zewed/bestia-2#24). Le retour est un événement daté du Territoire, programmé au départ, appliqué à son heure exacte par le mécanisme du temps, page ouverte, au rattrapage ou par la tâche planifiée : les explorateurs redeviennent libres et leur Métier se change de nouveau, les Bêtes de l'escorte redeviennent disponibles, et l'Expédition quitte la liste, qui se relit d'elle-même à l'heure du retour. L'Expédition rentrée n'est pas effacée (rentree_le) : sa présence sur la Case se relit toujours. L'heure du retour se calcule en un seul endroit (retourDUneExpedition). Migration 0052.
- **Débloquée par** : US-0915
- **Critères d'acceptation** :
  - Au retour, les explorateurs redeviennent libres et les Bêtes de l'escorte rentrent dans l'effectif.
  - L'Expédition quitte la liste des Expéditions en cours.
  - Le retour a lieu à l'heure prévue même si le joueur n'est pas connecté (rattrapage à l'ouverture de page ou tâche planifiée).

### US-0917 · Le récit de retour
**En tant que** joueur, **je veux** lire un récit à chaque retour d'Expédition, **afin de** savoir ce que mes explorateurs ont vécu.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1375, Zewed/bestia-2#28). À chaque retour, un Récit « Retour d'Expédition », daté de l'heure exacte du retour, s'ajoute à la page Récits : la destination et son Biome désormais connu, sa distance, les durées réelles de l'aller, du séjour et du retour, le nombre de Cases sorties du brouillard, et « Aucune Bête ne s'est montrée » quand rien ne s'est passé, sinon combien de Bêtes se sont montrées. Le compteur de non lus suit : dans la barre du haut sur ordinateur, sur l'onglet Récits de la navigation du bas sur mobile. Le même Récit en direct, au rattrapage ou par la tâche planifiée.
- **Débloquée par** : US-0916, Étape 16
- **Critères d'acceptation** :
  - Chaque retour ajoute un récit daté à la page Récits (US-0324).
  - Le récit donne la destination et son Biome désormais connu, les durées réelles de l'aller, du séjour et du retour, et le nombre de Cases sorties du brouillard.
  - Quand rien ne s'est passé, le récit le dit en une phrase (« aucune Bête ne s'est montrée ») : il n'est jamais vide.
  - Un compteur de récits non lus s'affiche dans la barre du haut, sur ordinateur comme sur mobile.

### US-0918 · La liste des Expéditions en cours
**En tant que** joueur, **je veux** voir toutes mes Expéditions en cours au même endroit, **afin de** savoir quand chacune revient.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1376, Zewed/bestia-2#20). La page /jeu/expeditions montre chaque Expédition en cours : destination, distance, phase et temps restant de la phase (« arrive dans », « repart dans », « rentre dans », puis « de retour »), puis ses explorateurs par prénom, son escorte et son retour prévu. Les comptes à rebours avancent sans recharger, au rythme du jeu. Sans Expédition, « Aucune Expédition en cours » et un bouton « Préparer une Expédition ». Sur mobile (jusqu'à 820 px), chacune tient sur une ligne qu'on déplie. Le détail est un composant réutilisable (DetailDeLExpedition), repris par la carte (US-0913).
- **Débloquée par** : US-0911
- **Critères d'acceptation** :
  - Chaque Expédition montre sa destination, sa phase (aller, séjour, retour), son temps restant, ses explorateurs et son escorte.
  - Les comptes à rebours avancent sans recharger la page.
  - Sans Expédition en cours, la liste affiche « Aucune Expédition en cours » et un bouton pour en préparer une.
  - Sur mobile, chaque Expédition tient sur une ligne qu'on déplie pour voir le détail.

### US-0919 · Plusieurs Expéditions à la fois
**En tant que** joueur, **je veux** lancer une nouvelle Expédition pendant qu'une autre est en route, **afin de** fouiller plusieurs directions en même temps.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1377, Zewed/bestia-2#18). Le départ respectait déjà la règle : la story est prouvée par des tests. Plusieurs Expéditions partent tant qu'il reste un explorateur libre, chacune avec sa destination, son escorte et ses horaires, sans effet sur les autres ; le prochain retour affiché est celui de la plus proche. Aucun plafond hors des explorateurs libres. Deux Expéditions peuvent viser la même Case.
- **Débloquée par** : US-0911
- **Critères d'acceptation** :
  - On peut lancer une nouvelle Expédition tant qu'il reste au moins un explorateur libre.
  - Chaque Expédition a sa destination, son escorte et ses horaires, sans effet sur les autres.
  - Aucun plafond d'Expéditions simultanées autre que le nombre d'explorateurs libres (décidé le 2026-10-08).

### US-0920 · Rappeler une Expédition à l'aller
**En tant que** joueur, **je veux** rappeler une Expédition pendant son trajet aller, **afin de** récupérer mes Bêtes si j'en ai besoin ailleurs.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1378, Zewed/bestia-2#33). Un bouton « Rappeler », dans la liste comme sur la fiche de la carte, fait faire demi-tour à l'Expédition à l'aller ou en séjour ; il disparaît au retour. Rappelée à l'aller, elle rentre après le temps déjà parcouru, ne séjourne pas, ne voit aucune Bête et ne rapporte rien ; les Cases déjà révélées le restent. Rappelée en séjour, elle y met fin et rentre après le temps de l'aller. Son retour programmé est déplacé, et le récit de retour dit qu'elle a été rappelée, et quand. Deux rappels au même instant n'en font qu'un. Migration 0059.
- **Débloquée par** : US-0912
- **Critères d'acceptation** :
  - Pendant l'aller, un bouton « Rappeler » fait faire demi-tour ; le retour dure le temps déjà parcouru.
  - Une Expédition rappelée ne séjourne pas, ne voit aucune Bête et ne rapporte rien ; les Cases déjà révélées le restent.
  - Pendant le retour, le bouton disparaît.
  - Le récit indique que l'Expédition a été rappelée, et à quel moment.
  - Pendant le séjour aussi, « Rappeler » met fin au séjour et lance le retour aussitôt (décidé le 2026-10-08).

### US-0921 · Ceux qui sont partis mangent toujours
**En tant que** joueur, **je veux** que mes explorateurs continuent de manger pendant l'Expédition, **afin de** prévoir mes stocks de Nourriture avant un long départ.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1379, Zewed/bestia-2#17). Les explorateurs partis restent comptés dans l'Entretien : la Nourriture baisse comme s'ils étaient là, et l'avertissement « famine imminente » le prend en compte. En Famine, seuls les Habitants restés au Foyer s'en vont ; sans plus personne au Foyer, la Famine dure sans départ jusqu'au retour des explorateurs. La règle « jamais le dernier Habitant » compte aussi les absents : le dernier resté au Foyer peut donc partir pendant une Expédition. En direct et au rattrapage, les mêmes départs.
- **Débloquée par** : US-0911, Étape 15
- **Critères d'acceptation** :
  - La Nourriture des explorateurs continue d'être prise sur les stocks pendant toute l'Expédition.
  - L'avertissement « famine imminente » tient compte des Expéditions en cours.
  - L'Entretien des Bêtes de l'escorte s'y ajoutera quand les Bêtes mangeront (étape 35, US-0826).
  - En cas de Famine pendant une Expédition, seuls les Habitants restés au Foyer peuvent s'en aller : un explorateur absent ne part pas, et les Bêtes de l'escorte ne retournent pas au sauvage (décidé le 2026-10-08).

### US-0922 · Une Expédition vécue en mon absence
**En tant que** joueur, **je veux** retrouver le résultat exact d'une Expédition qui s'est entièrement déroulée pendant que je n'étais pas là, **afin de** jouer par courtes sessions sans rien perdre.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1380, Zewed/bestia-2#32). Prouvée de bout en bout : cinq Expéditions (escortées, sans escorte, rappelées à l'aller et en séjour) vécues page ouverte, rattrapées d'un bloc au retour du joueur, ou par la seule tâche planifiée, donnent exactement les mêmes Cases révélées, Rencontres, Apprivoisements, Bestiaire, effectif et récits, dans l'ordre des retours. À ×60, une Expédition complète se vérifie en quelques minutes. Les combats viendront avec l'étape 41.
- **Débloquée par** : US-0917, Étape 3
- **Critères d'acceptation** :
  - Une Expédition partie, arrivée et rentrée pendant une absence donne les mêmes Cases révélées, les mêmes Rencontres, les mêmes combats et le même récit que si la page était restée ouverte.
  - Les récits arrivent dans l'ordre des retours.
  - En vitesse accélérée, une Expédition complète se vérifie en quelques minutes.

## Étape 39 · Le Monde fait apparaître des Bêtes

### US-0923 · Les Anneaux, de la Couronne au Cœur sauvage
**En tant que** joueur, **je veux** que le Monde soit plus sauvage à mesure qu'on approche du Cœur sauvage, **afin de** trouver des Bêtes plus rares en m'aventurant plus loin.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Chaque Case appartient à l'un des 6 Anneaux, numérotés de la Couronne (Anneau 1) au Cœur sauvage (Anneau 6). Les bandes intermédiaires se partagent en 12, 12, 12 et 11 anneaux de Cases, les plus larges à l'extérieur. L'Anneau se calcule à partir de la distance au centre et de la forme du Monde, sans rien garder en base : la même graine donne les mêmes Anneaux. La fiche d'une Case découverte dit « Couronne · Anneau 1 », « Anneau 3 » ou « Cœur sauvage · Anneau 6 » ; celle d'une Case inconnue n'en dit rien. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : Étape 18
- **Critères d'acceptation** :
  - Chaque Case appartient à un Anneau selon sa distance au Cœur sauvage ; 6 Anneaux (provisoire, `ANNEAUX_DU_MONDE`).
  - La Couronne forme l'Anneau le plus extérieur, le Cœur sauvage le plus intérieur.
  - La même graine donne toujours les mêmes Anneaux.
  - La fiche d'une Case révélée affiche son Anneau (décidé le 2026-10-08).

### US-0924 · Des Espèces d'essai pour chaque Rareté
**En tant que** développeur, **je veux** un petit jeu d'Espèces couvrant les Raretés de commune à légendaire, **afin de** tester les apparitions avant l'arrivée des 200 Espèces.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). 15 Espèces provisoires, dans `donnees/especes-essai.yaml` et sans illustration, couvrent les Raretés de commune à légendaire sur 7 Biomes, eau comprise : écureuil, grenouille, gerboise, lemming, marmotte, suricate, renard, loutre, loup, phoque, crocodile, ours brun, lion, smilodon, mammouth. Elles sont chargées en développement et dans les tests, jamais en production ni en prévisualisation. Supprimer le fichier suffit à les retirer, et un test vérifie qu'aucun code ne les cite. Vérifié sur base.
- **Débloquée par** : Étape 4
- **Critères d'acceptation** :
  - Un petit jeu d'Espèces couvre les Raretés de commune à légendaire dans plusieurs Biomes ; des Espèces provisoires, dans un fichier à part (décidé le 2026-10-08).
  - Ces Espèces ne servent qu'en développement et aux simulations ; en ligne, seules les Espèces déjà chargées apparaissent jusqu'à l'étape 47 (décidé le 2026-10-08).
  - Elles se retirent sans laisser de trace le jour où la liste validée arrive.

### US-0925 · Des Bêtes sauvages apparaissent de temps en temps
**En tant que** joueur, **je veux** que le Monde fasse apparaître des Bêtes sauvages sur ses Cases, **afin de** toujours avoir quelque chose à aller chercher.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Les apparitions sont une fonction pure de la graine du Monde, de la Case et du temps du jeu : un tirage par heure, en loi de Poisson. Rien n'est écrit en base pour une Bête qu'aucune Expédition ne rencontre. En moyenne, une Bête par Case et par jour de jeu ; jamais sur une Case de Territoire. Chaque apparition amène une seule Bête, avec un numéro unique, et rien ne se voit sur la carte. Prouvé par les tests (`src/monde/betes-sauvages.ts`).
- **Débloquée par** : US-0923, US-0924, Étape 3
- **Critères d'acceptation** :
  - Chaque Case hors des Territoires voit apparaître des Bêtes sauvages de temps en temps, selon une fréquence moyenne d'une Bête par Case et par jour de jeu (provisoire, `APPARITIONS_PAR_CASE_PAR_JOUR`) ; les Cases des Territoires n'en voient aucune (décidé le 2026-10-08).
  - Chaque apparition amène une seule Bête, jamais un groupe.
  - Les apparitions ont lieu que les joueurs soient connectés ou non.
  - Plusieurs Bêtes peuvent être présentes en même temps sur une même Case : les apparitions sont indépendantes (décidé le 2026-10-08).
  - Aucune Bête sauvage ne se voit sur la carte : seules les Expéditions présentes sur la Case la voient.

### US-0926 · Une présence limitée dans le temps
**En tant que** joueur, **je veux** que chaque Bête sauvage ne reste qu'un temps sur sa Case, **afin de** sentir qu'il faut être là au bon moment.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Chaque Bête reste 6 heures de jeu sur sa Case, quelle que soit sa Rareté, puis disparaît, et une Bête disparue ne revient jamais. Une Bête qui suit une Expédition est retirée de sa Case pour toujours. Seule `emmenerUneBete` l'écrit, dans la table `bete_partie` (migration 0046). Elle refuse une Bête pas encore arrivée, déjà partie ou déjà emmenée, et deux demandes simultanées n'en emmènent qu'une. Prouvé sur base.
- **Débloquée par** : US-0925
- **Critères d'acceptation** :
  - Chaque Bête apparue reste sur sa Case pendant 6 heures de jeu (provisoire, `PRESENCE_D_UNE_BETE_HEURES`), puis disparaît.
  - La durée est la même pour toutes les Raretés (décidé le 2026-10-08).
  - Une Bête qui suit une Expédition quitte aussitôt sa Case.
  - Une Bête disparue ne revient jamais sur cette Case.

### US-0927 · La Rareté tirée selon l'Anneau
**En tant que** joueur, **je veux** que la Rareté des Bêtes dépende de l'Anneau, **afin de** trouver partout des communes, mais plus de raretés vers le Cœur sauvage.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). La Rareté de chaque apparition est tirée selon une table provisoire par Anneau (`donnees/raretes-par-anneau.yaml`). Les communes y passent de 80 % à la Couronne à 55 % au Cœur sauvage, toujours majoritaires, et chaque Rareté plus haute croît vers le Cœur, de 0,2 à 1 % pour les légendaires. Jamais de mythique. Une table invalide est refusée à la mise en ligne. Une simulation d'environ 32 000 Bêtes par Anneau retrouve la table.
- **Débloquée par** : US-0925
- **Critères d'acceptation** :
  - À chaque apparition, la Rareté est tirée selon les pourcentages de l'Anneau de la Case (provisoires, `donnees/raretes-par-anneau.yaml`).
  - Dans tous les Anneaux, toutes les Raretés de commune à légendaire peuvent apparaître, et les communes restent les plus nombreuses.
  - Plus l'Anneau est proche du Cœur sauvage, plus les Raretés élevées y sont fréquentes.
  - Les Espèces mythiques n'apparaissent jamais ainsi : elles ne viennent que des Apparitions (étape 63).

### US-0928 · L'Espèce tirée selon le Biome
**En tant que** joueur, **je veux** croiser sur chaque Case des Espèces qui vivent dans son Biome, **afin de** savoir où chercher l'animal que je veux.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). L'Espèce est tirée parmi celles de la Rareté tirée qui vivent dans le Biome de la Case, et côte, lac, rivière et mer comptent ensemble comme l'eau. À Rareté égale, chaque Espèce a la même chance. Sans Espèce de cette Rareté, le tirage retombe sur la Rareté inférieure, jusqu'aux communes ; sans commune, aucune Bête. Prouvé sur base.
- **Débloquée par** : US-0927
- **Critères d'acceptation** :
  - L'Espèce est tirée parmi celles de la Rareté tirée dont le Biome d'Habitat est celui de la Case.
  - Côte, lac, rivière et mer sont des variantes d'un même Biome, l'eau : elles comptent ensemble pour ce tirage.
  - À Rareté égale, chaque Espèce a la même chance ; sans pondération par Espèce (décidé le 2026-10-08).
  - Si aucune Espèce de la Rareté tirée n'existe pour ce Biome, le tirage retombe sur la Rareté inférieure, jusqu'aux communes, et sans commune pour ce Biome, aucune Bête n'apparaît (décidé le 2026-10-08).

### US-0929 · La Densité change la fréquence
**En tant que** joueur, **je veux** que certaines Cases soient plus giboyeuses certains jours, **afin de** ne pas toujours viser les mêmes Cases.

- **Statut** : Reportée le 2026-10-05 à l'étape 24 (jalon 5), qui crée la Densité du jour : ce jalon est désormais attaqué avant elle (ADR 0008).
- **Débloquée par** : US-0925, Étape 24
- **Critères d'acceptation** :
  - La Densité de faune de la Case, cachée et changeante chaque jour, augmente ou diminue la fréquence des apparitions (effet : chiffre à régler).
  - La Densité ne change pas les pourcentages de Rareté (à décider).
  - Elle n'est jamais affichée en chiffre ; que le récit en donne une impression, comme « la faune semblait abondante » (à décider).
  - Sur une simulation, une même Case voit plus d'apparitions certains jours que d'autres.

### US-0930 · Des apparitions identiques en direct et au rattrapage
**En tant que** développeur, **je veux** que les apparitions d'une Case se calculent toujours de la même façon, **afin de** garder un Monde juste, qu'on le regarde en direct, au rattrapage ou par la tâche planifiée.

- **Statut** : Livrée le 2026-10-08 (autopilot, par un agent en parallèle). Les mêmes Bêtes (Espèce, moment, durée) apparaissent quel que soit le découpage du temps (5 min, l'heure, le jour, au hasard), et qu'on calcule une Case seule ou tout le Monde. Une heure à vitesse ×100 donne exactement les mêmes Bêtes que 100 heures à vitesse ×1. Le calcul coûte environ 0,007 ms pour une Case et un jour, 56 ms pour les 10 981 Cases d'un Monde. Prouvé par les tests.
- **Débloquée par** : US-0925, Étape 3
- **Critères d'acceptation** :
  - Pour une Case et une période données, les Bêtes apparues (Espèce, moment, durée) sont les mêmes quelle que soit la façon dont le temps a été rattrapé.
  - Les apparitions ne sont calculées que pour les Cases où elles comptent (Expédition présente, Bête restée repérée), sans que le résultat change.
  - La vitesse accélérée accélère aussi les apparitions et leurs durées.

### US-0931 · La simulation des Raretés par Anneau
**En tant que** développeur, **je veux** simuler les apparitions sur une longue période, **afin de** vérifier que les Raretés suivent les pourcentages de chaque Anneau.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1389, Zewed/bestia-2#13). La page /controle/raretes, reliée depuis le contrôle, prend une graine et simule toutes les Cases d'un Monde généré pendant 30 jours de jeu, sans rien lire ni écrire en base. Le résultat du contrôle vient en tête, puis un tableau par Anneau : Cases, apparitions, moyenne par Case et par jour, part obtenue de chaque Rareté à côté de la part attendue. On compte la Rareté tirée avant le choix de l'Espèce, par la même fonction que le jeu. Avec 30 jours et 1 point, le Cœur sauvage échoue par pur hasard pour environ une graine sur quatre ; 120 jours ramèneraient ce taux sous 1 %.
- **Débloquée par** : US-0927, US-0928
- **Critères d'acceptation** :
  - Un outil de la page de contrôle interne simule les apparitions sur une longue période, 30 jours de jeu (décidé le 2026-10-09), Anneau par Anneau.
  - Il affiche, pour chaque Anneau, la part obtenue de chaque Rareté à côté de la part attendue.
  - Le contrôle échoue si un écart dépasse la tolérance, 1 point de pourcentage (décidé le 2026-10-09), ou si les communes ne sont pas majoritaires dans un Anneau.
  - Il donne le nombre moyen d'apparitions par Case et par jour, pour régler le rythme (première peu commune en 3 à 4 jours, rare en un mois).

### US-0975 · Des Bêtes communes à portée de chaque nouveau Foyer
**En tant que** nouveau joueur, **je veux** que quelques Bêtes communes se trouvent à portée de mon Foyer quand je nais, **afin de** pouvoir ramener mes premières Bêtes dès mes premières Expéditions.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1390, Zewed/bestia-2#15). À la naissance d'un Foyer, 3 Bêtes communes se posent sur des Cases libres à 1 à 8 Cases de lui, une par Case, chacune d'une Espèce commune du Biome de sa Case, pour 48 heures de jeu. Elles sont écrites en base (table bete_de_naissance) et réservées à son Territoire. Un chef né avant les reçoit à son retour, une seule fois ; après une bascule de Monde, il en reçoit d'autres autour de son nouveau Foyer. Tant qu'elles sont là, le récit d'arrivée ajoute « Quelques Bêtes rôdent dans les abords. » Un Foyer né plus tard sur leur Case les fait disparaître.
- **Débloquée par** : US-0908, US-0926, US-0928
- **Critères d'acceptation** :
  - À la naissance d'un Foyer, 3 Bêtes sauvages communes (décidé le 2026-10-09) apparaissent sur des Cases libres à portée d'exploration de départ (US-0908), une par Case ; un chef né avant cette story les reçoit aussi, une seule fois.
  - L'Espèce de chacune est tirée au hasard parmi les communes qui vivent dans le Biome de sa Case (US-0928) ; une Case dont le Biome n'en compte aucune n'est pas choisie.
  - Elles restent sur leur Case plus longtemps qu'une apparition ordinaire, 48 heures de jeu, assez pour qu'une première Expédition sans escorte les trouve (décidé le 2026-10-09).
  - Elles sont réservées au nouveau chef : les Expéditions des autres ne les rencontrent pas (décidé le 2026-10-09).
  - Comme toute Bête sauvage, elles ne se voient pas sur la carte ; tant qu'elles sont là, le récit d'arrivée dit que quelques Bêtes rôdent dans les abords, sans dire où (décidé le 2026-10-09).

## Étape 40 · La Rencontre

### US-0932 · La Rencontre
**En tant que** joueur, **je veux** que mon Expédition voie les Bêtes qui se montrent sur sa Case, **afin de** tenter de les apprivoiser.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1392, Zewed/bestia-2#25). Une Expédition en séjour voit chaque Bête qui se montre sur sa Case, à l'instant de son apparition, ou à son arrivée si la Bête est déjà là, tant que ni l'une ni l'autre n'est partie : c'est une Rencontre, retenue en base (table rencontre, migration 0053) par le mécanisme du temps, la même en direct, au rattrapage et par la tâche planifiée. Elle voit les Bêtes sauvages ordinaires comme les Bêtes de naissance de son seul Territoire. Les Cases traversées ne montrent rien, et un joueur sans Expédition sur la Case n'apprend rien.
- **Débloquée par** : US-0915, US-0925
- **Critères d'acceptation** :
  - Quand une Bête apparaît sur une Case où une Expédition séjourne, c'est une Rencontre pour cette Expédition.
  - Une Expédition qui arrive sur une Case où une Bête est encore présente la rencontre dès son arrivée.
  - Une Expédition qui ne fait que traverser une Case pendant son trajet ne voit pas ses Bêtes : seule la Case du séjour compte (décidé le 2026-10-09).
  - Un joueur sans Expédition sur la Case n'apprend rien de la Bête.

### US-0933 · L'Espèce croisée entre au Bestiaire
**En tant que** joueur, **je veux** que chaque Espèce croisée s'inscrive dans mon Bestiaire, **afin de** garder la trace de tout ce que j'ai vu.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1393, Zewed/bestia-2#29). Toute Espèce vue lors d'une Rencontre s'inscrit au Bestiaire du Territoire, « croisée », à l'instant de sa première Rencontre, qu'elle suive l'Expédition ou non, une seule fois ; son état (croisée, apprivoisée, Couple réuni) ne fait qu'avancer, même quand toutes ses Bêtes meurent (table bestiaire, migration 0057). La Rencontre qui l'a inscrite est marquée, pour que les récits disent « Nouvelle Espèce au Bestiaire » (US-0940). La page Bestiaire arrive au jalon 10.
- **Débloquée par** : US-0932
- **Critères d'acceptation** :
  - Toute Espèce vue lors d'une Rencontre s'inscrit au Bestiaire du joueur à l'état « croisée », qu'elle suive l'Expédition ou non.
  - L'inscription se fait une seule fois par Espèce ; la revoir ne change rien.
  - L'état d'une Espèce au Bestiaire ne recule jamais, même si toutes ses Bêtes meurent.
  - Le récit signale « Nouvelle Espèce au Bestiaire » la première fois (la page Bestiaire arrive au jalon 10).

### US-0934 · La Bête à portée suit l'Expédition
**En tant que** joueur, **je veux** qu'une Bête sauvage suive mon Expédition quand mon escorte est assez forte, **afin de** l'apprivoiser.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1394, Zewed/bestia-2#27). Une Bête vue lors d'une Rencontre suit l'Expédition, sans combat, quand la force de l'escorte vaut au moins celle de son Espèce, ou quand elle est commune ; dès cet instant elle a quitté sa Case et personne ne la voit plus. Vue par plusieurs Expéditions, elle suit la première qui la voit et l'a à portée (à égalité, la plus petite), tous Territoires confondus (décidé le 2026-10-09), d'où le même résultat quel que soit l'ordre des rattrapages. Sans escorte, aucune Bête ne suit encore : US-0935 en décidera. La Bête suivie est la Rencontre marquée apprivoisée (migration 0056).
- **Débloquée par** : US-0932, US-0905
- **Critères d'acceptation** :
  - Une Bête est à portée quand la force de l'escorte est au moins égale à la sienne, qui est celle de son Espèce ; une Bête commune l'est toujours, même sans escorte (US-0935).
  - À portée, elle suit l'Expédition sans combat : c'est l'Apprivoisement.
  - Aucune Bête de l'escorte n'est blessée ni tuée lors d'un Apprivoisement.
  - Dès qu'elle suit l'Expédition, la Bête quitte sa Case : personne d'autre ne peut plus la rencontrer.

### US-0935 · Sans escorte, ramener une Bête commune
**En tant que** joueur, **je veux** que mes explorateurs partis seuls puissent ramener une Bête commune, **afin de** trouver mes premières Bêtes avant d'avoir de quoi les escorter.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1395, Zewed/bestia-2#34). Une Bête commune est à portée de toute Expédition, avec ou sans escorte : elle la suit sans combat. Une Bête plus rare n'est jamais à portée d'une Expédition sans escorte, et reste sur sa Case. Les Espèces vues s'inscrivent au Bestiaire et une seule Bête suit par Rencontre. Quand seules des Bêtes plus rares se sont montrées, le récit de retour le dit en nommant leurs Espèces : « Vos explorateurs ont vu Renard roux, mais aucune Bête ne les a suivis. »
- **Débloquée par** : US-0934, US-0909
- **Critères d'acceptation** :
  - Une Bête commune est à portée de toute Expédition, avec ou sans escorte : elle la suit sans combat, c'est un Apprivoisement.
  - Une Bête plus rare n'est jamais à portée d'une Expédition sans escorte, dont la force est nulle : elle reste sur sa Case (étape 41).
  - Comme toute Expédition, elle inscrit au Bestiaire les Espèces qu'elle croise, et ne ramène qu'une Bête par Rencontre (US-0936).
  - Quand seules des Bêtes plus rares se sont montrées, le récit le dit : « vos explorateurs ont vu … mais aucune Bête ne les a suivis ».

### US-0936 · Une Bête à la fois
**En tant que** joueur, **je veux** que les Bêtes me rejoignent une par une, **afin de** faire de chaque Apprivoisement un événement.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1396, Zewed/bestia-2#30). Les règles de la Rencontre et de l'Apprivoisement la tenaient déjà : la story est prouvée par des tests. Une Rencontre ne porte qu'une Bête, chacune est jugée à part dans l'ordre des apparitions, et après un Apprivoisement l'Expédition poursuit son séjour jusqu'à son terme : elle peut en apprivoiser d'autres, une par Rencontre, et rentre à l'heure fixée au départ.
- **Débloquée par** : US-0934
- **Critères d'acceptation** :
  - Un Apprivoisement n'amène jamais qu'une seule Bête.
  - Quand plusieurs Bêtes se montrent pendant un même séjour, chaque Rencontre est jugée à part, dans l'ordre des apparitions.
  - Après un Apprivoisement, l'Expédition poursuit son séjour jusqu'à son terme et peut en apprivoiser d'autres, une par Rencontre (décidé le 2026-10-09).

### US-0937 · Le sexe tiré au hasard
**En tant que** joueur, **je veux** connaître le sexe de chaque Bête apprivoisée, **afin de** savoir s'il me manque un mâle ou une femelle pour réunir le Couple.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1397, Zewed/bestia-2#31). À l'Apprivoisement, la Bête est mâle ou femelle au hasard, à chances égales, tiré comme ses apparitions (de la graine du Monde, de sa Case et de son numéro) : le même en direct, au rattrapage ou par la tâche planifiée ; il est retenu avec sa Rencontre et ne change plus (migration 0058). Sous chaque Espèce du bloc Escorte, l'effectif dit ses mâles et ses femelles (« 2 mâles · 1 femelle »). Sur 10 000 Apprivoisements, les mâles restent à 2 points de la moitié.
- **Débloquée par** : US-0934
- **Critères d'acceptation** :
  - Au moment de l'Apprivoisement, la Bête est mâle ou femelle au hasard, à chances égales, et ne change plus.
  - Tant que le Couple de son Espèce n'est pas réuni, l'effectif de l'Espèce indique combien de mâles et de femelles on possède.
  - Sur une longue simulation, mâles et femelles sont à parts égales, à 2 points de pourcentage près sur 10 000 Apprivoisements (décidé le 2026-10-09).

### US-0938 · La Bête apprivoisée arrive au Foyer
**En tant que** joueur, **je veux** voir ma nouvelle Bête rejoindre mon effectif au retour de l'Expédition, **afin de** pouvoir m'en servir.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1398, Zewed/bestia-2#35). La Bête apprivoisée suit l'Expédition et arrive au Foyer avec elle, à son retour : elle entre alors dans l'effectif de son Espèce, avec son sexe, et son Espèce passe « apprivoisée » au Bestiaire si elle n'avait pas mieux. Jusque-là, elle ne fait pas partie de l'escorte et n'en change pas la force. Elle peut partir en escorte dès l'Expédition suivante. Le récit de retour la nomme : « Bête ramenée au Foyer : Marmotte des Alpes (mâle). » Sans limite de Places, qui arrivent au jalon 8 (US-0939).
- **Débloquée par** : US-0934, US-0916
- **Critères d'acceptation** :
  - La Bête suit l'Expédition et arrive au Foyer avec elle, à son retour.
  - Elle entre alors dans l'effectif de son Espèce, et l'Espèce passe à l'état « apprivoisée » au Bestiaire si elle n'avait pas mieux.
  - Jusqu'au retour, la Bête qui suit ne fait pas partie de l'escorte : elle n'en change pas la force et ne peut pas être perdue dans un combat (décidé le 2026-10-09).
  - Elle peut partir en escorte dès l'Expédition suivante.

### US-0939 · Une Bête apprivoisée sans Place libre
**En tant que** joueur, **je veux** savoir ce que devient une Bête apprivoisée quand mon Habitat est plein, **afin de** ne pas la perdre sans comprendre.

- **Statut** : Reportée le 2026-10-05 à l'étape 35 (jalon 8), où arrivent les Places : ce jalon est désormais attaqué avant elle (ADR 0008).
- **Débloquée par** : US-0938, Étape 35
- **Critères d'acceptation** :
  - Quand l'Habitat du Foyer n'a plus de Place libre pour elle, la Bête rejoint quand même le joueur en surnombre, attend une Place, ou repart au sauvage (à décider).
  - Le récapitulatif avant le départ prévient quand il ne reste aucune Place libre.
  - Le récit dit clairement ce qu'est devenue la Bête.

### US-0940 · Le récit de Rencontre
**En tant que** joueur, **je veux** un récit détaillé de chaque Rencontre, **afin de** revivre ce qui s'est passé sur la Case.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1399, Zewed/bestia-2#37). Le récit de retour garde son texte comme résumé ; dessous se déplie chaque Bête vue, à son heure : vignette, Espèce, Rareté, et ce qu'il en advint : « Apprivoisée, mâle » ou « femelle », « Trop forte, restée sur sa Case : il manquait N de force », ou « Repartie à la fin de sa durée ». Une Bête apprivoisée ou une nouvelle Espèce est mise en avant (« Nouvelle Espèce au Bestiaire »). Sur mobile, les vignettes se réduisent sans que le texte déborde. Les Rencontres sont retenues avec le Récit (migration 0060).
- **Débloquée par** : US-0933, US-0938, US-0917
- **Critères d'acceptation** :
  - Le récit liste chaque Bête vue, à son heure : illustration, Espèce, Rareté.
  - Pour chacune, il dit ce qui s'est passé : apprivoisée (avec son sexe), trop forte et restée, ou repartie à la fin de sa durée.
  - Une Bête apprivoisée ou une nouvelle Espèce est mise en avant.
  - Sur mobile, les illustrations se réduisent sans que le texte déborde.

### US-0941 · Un résumé en tête du récit
**En tant que** joueur, **je veux** lire l'essentiel d'un récit en une ligne, **afin de** faire le point vite pendant une courte session.

- **Statut** : Livrée le 2026-10-10 (autopilot, THE-1400, Zewed/bestia-2#40). Sur la page Récits, chaque retour d'Expédition porte sous son titre et sa date une ligne de résumé, lisible sans le déplier : toujours les Bêtes ramenées (« Aucune Bête ramenée » à zéro), puis les nouvelles Espèces au Bestiaire et les pertes quand il y en a, séparées par « · ». Le détail heure par heure se déplie dessous, le résumé reste en place. Il se calcule à l'affichage depuis les Rencontres du récit (US-0940), sans migration ; les pertes valent 0 tant que le combat (US-0943 à US-0947) n'existe pas, leur libellé est prêt. Vérifié en vrai de 320 à 1 440 px.
- **Débloquée par** : US-0940
- **Critères d'acceptation** :
  - En tête du récit, une ligne résume l'essentiel : Bêtes ramenées, nouvelles Espèces au Bestiaire, pertes.
  - Le détail heure par heure se déplie sous le résumé.
  - La page Récits affiche ce résumé sans qu'il faille ouvrir le récit.

## Étape 41 · La Bête trop forte

### US-0942 · La Bête trop forte reste sur sa Case
**En tant que** joueur, **je veux** qu'une Bête trop forte pour mon escorte reste où elle est, **afin de** pouvoir revenir la chercher.

- **Statut** : Livrée le 2026-10-09 (Armada, THE-1459, Zewed/bestia-2#36). Une Bête plus forte que l'escorte (ou plus rare qu'une commune, sans escorte) ne suit pas : elle reste sur sa Case jusqu'à la fin de sa durée, l'Expédition la voit pendant tout son séjour et son Espèce s'inscrit « croisée ». Le récit de retour le dit, et de combien : « …, mais aucune Bête ne les a suivis : trop forte pour votre escorte, il lui manquait 37 340 de force. », un chiffre par Espèce, ou une ligne à part quand d'autres Bêtes ont suivi.
- **Débloquée par** : US-0934
- **Critères d'acceptation** :
  - Quand la force de l'escorte est inférieure à la sienne, la Bête ne suit pas et reste sur sa Case jusqu'à la fin de sa durée ; une Bête commune n'est jamais dans ce cas (US-0935).
  - L'Expédition la voit pendant tout son séjour, et son Espèce s'inscrit « croisée ».
  - Le récit dit « trop forte pour votre escorte » et de combien : la force qui manquait, en chiffres (décidé le 2026-10-09).

### US-0943 · La Bête trop forte peut attaquer
**En tant que** joueur, **je veux** qu'une Bête trop forte puisse s'en prendre à mon Expédition, **afin de** sentir le risque d'aller chercher plus fort que soi.

- **Statut** : Livrée le 2026-10-12 (autopilot, THE-1461, Zewed/bestia-2#39). Une Bête trop forte pour l'escorte d'une Expédition qui la voit peut l'attaquer pendant son séjour, à un instant tiré selon son régime (migration 0062, colonne `attaque_le`) ; seule l'Expédition désignée par les tirages est attaquée, les autres non, et toutes rentrent à l'heure prévue. Le récit ne dit encore rien de l'attaque (la fuite et les pertes viennent avec US-0945 et l'étape 42). Tranché : chaque Bête attaque au plus une fois chaque Expédition qu'elle voit, et plusieurs Bêtes trop fortes peuvent attaquer la même. Une Expédition qui voit la Bête à l'instant où elle en suit une autre (US-0962) n'a plus le temps d'être attaquée. Vérifié en vrai avec trois Expéditions vers un Loup gris rare.
- **Débloquée par** : US-0942
- **Critères d'acceptation** :
  - Tant que la Bête et l'Expédition sont sur la même Case, la Bête peut attaquer, avec une chance par heure passée ensemble (chiffre à régler).
  - Une Bête qui n'attaque pas laisse l'Expédition finir son séjour normalement.
  - Une chance d'attaque qui dépend de la Rareté ou du régime, un carnivore étant plus agressif (à décider).

### US-0944 · Le combat par la somme des forces
**En tant que** joueur, **je veux** que le combat se règle par la simple somme des forces, **afin de** comprendre d'avance ce que je risque.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#54). Quand une Bête trop forte attaque (US-0943), le combat se livre à l'instant de l'attaque : la force de la Bête contre la simple somme des forces de l'escorte. La Bête l'emporte toujours et ne perd rien ; l'escorte perd des Bêtes, qui quittent aussitôt l'effectif ; jamais les explorateurs, ni les Bêtes restées au Foyer, ni les Couples. Les pertes sont les mêmes page ouverte, d'un bloc ou par la tâche planifiée. Tranché : part perdue = (force de la Bête − force de l'escorte) / force de la Bête × `PERTES_PAR_ECART_DES_FORCES` (1, provisoire), arrondie au-dessus et plafonnée à toute l'escorte ; répartition au prorata des effectifs, aux plus grands restes (à égalité, l'Espèce la plus faible) ; les pertes vont dans une colonne `perdues` (migration 0064), la force de départ reste celle qui décide qui suit qui jusqu'à la fuite (US-0945). Aucun texte de récit encore (US-0947). Vérifié en vrai : une escorte passe de 38 à 37 Souris grises.
- **Débloquée par** : US-0943
- **Critères d'acceptation** :
  - Le combat oppose la force de la Bête à la somme des forces de l'escorte, sans règle de taille.
  - Plus forte que l'escorte, la Bête l'emporte toujours ; la part de l'escorte perdue grandit avec l'écart des forces (chiffre à régler).
  - Seules les Bêtes de l'escorte subissent des pertes : jamais les explorateurs, ni les Bêtes restées au Foyer, ni les Couples.
  - La répartition des pertes entre les Espèces de l'escorte, au prorata des effectifs ou des forces (à décider).
  - La Bête sauvage ne subit aucune perte et reste sur sa Case (à décider).

### US-0945 · Les explorateurs fuient
**En tant que** joueur, **je veux** que mes explorateurs s'enfuient après un combat, **afin de** ne jamais perdre d'Habitants en Expédition.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#65, migration 0067). Après un combat, l'Expédition abandonne son séjour et rentre aussitôt avec tous ses explorateurs et les Bêtes qui lui restent, Blessés compris ; attaquée sans escorte, elle fuit sans rien perdre. Dans la liste et sur la carte : « Retour · en fuite », « rentre dans … » compté jusqu'à sa nouvelle heure ; elle ne peut plus être rappelée. Tranché : la fuite s'écrit comme un rappel (`rappelee_le` à l'instant de l'attaque, colonne `en_fuite`) et le retour dure le temps de l'aller (US-0920) ; plusieurs attaques au même instant font une seule fuite ; le premier demi-tour l'emporte sur l'autre ; le temps s'arrête à la première attaque. Une Expédition en fuite quitte la Case pour tous les joueurs, quel que soit l'ordre des rattrapages : chaque Territoire calcule les fuites de toute la Case des mêmes faits (`src/expeditions/fuites-de-la-case.ts`).
- **Débloquée par** : US-0944
- **Critères d'acceptation** :
  - Après un combat, l'Expédition abandonne son séjour et rentre aussitôt au Foyer avec les Bêtes survivantes.
  - Les explorateurs reviennent tous, sans jamais être blessés ni tués.
  - Attaquée sans escorte, l'Expédition fuit sans aucune perte.
  - Sur la carte et dans la liste, l'Expédition passe en phase « retour » avec la mention « en fuite ».

### US-0946 · Toute l'escorte perdue
**En tant que** joueur, **je veux** savoir clairement quand toute mon escorte a péri, **afin de** mesurer la leçon.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#81). Quand une Bête trop forte emporte toute l'escorte, le récit du retour remplace la ligne des pertes par « Toute votre escorte a été perdue au combat : Poule (1 Blessé) et Souris grise (1 mort, 1 Blessé). », en braise sur la page Récits, puis « Vos explorateurs ont fui et sont tous rentrés au Foyer. » ; l'Expédition rentre normalement, sans escorte, et l'effectif baisse du nombre de mortes, jusqu'à zéro. Tranché : « toute l'escorte perdue » compte les mortes et les Blessés (ce que le code compte déjà comme perdues) : avec la moitié de Blessés arrondie en leur faveur, « toutes mortes » n'arrive jamais, et les explorateurs rentrent « seuls » au sens de sans aucune Bête en état de combattre. Le résumé en tête du récit compte toujours les seules mortes (US-0947). Sans migration.
- **Débloquée par** : US-0945
- **Critères d'acceptation** :
  - Si toutes les Bêtes de l'escorte sont perdues, les explorateurs rentrent seuls et l'Expédition se termine normalement.
  - L'effectif de chaque Espèce concernée baisse du bon nombre, jusqu'à zéro s'il le faut.
  - Le récit l'annonce sans ambiguïté, Espèce par Espèce.

### US-0947 · Le récit du combat
**En tant que** joueur, **je veux** un récit précis du combat, **afin de** savoir quelle force il m'aurait fallu.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#63). Au retour d'une Expédition attaquée, le récit finit par le combat, sans migration : une ligne par combat dans l'ordre du temps (« Combat le 14 octobre à 09:59 : Loup gris, de force 173 205, contre votre escorte, de force 170 280. », ou « Attaque … contre vos explorateurs, sans escorte. »), puis les pertes Espèce par Espèce telles qu'elles ont été retenues (US-0951), puis « Vos explorateurs ont fui et sont tous rentrés au Foyer. ». Le résumé en tête compte les Bêtes perdues. Tranché : la force exacte de la Bête est affichée (celle qu'il aurait fallu) ; le combat vient en fin de récit ; le résumé ne compte que les mortes (les Blessés rentrent), à reprendre avec US-0952 à US-0955. Vérifié en vrai avec 360 Souris grises contre un Loup gris.
- **Débloquée par** : US-0944, US-0940
- **Critères d'acceptation** :
  - Le récit donne l'heure du combat, l'Espèce de la Bête et la force de l'escorte ; afficher aussi la force exacte de la Bête (à décider).
  - Il liste les pertes Espèce par Espèce.
  - Il se termine par la fuite et le retour des explorateurs.

### US-0948 · Repérer la Bête restée sur la carte
**En tant que** joueur, **je veux** voir sur ma carte où une Bête trop forte est restée, **afin de** ne pas oublier de revenir la chercher.

- **Statut** : Livrée le 2026-10-12 (autopilot, THE-1466, Zewed/bestia-2#41). Au retour d'une Expédition qui a vu une Bête trop forte pour son escorte, la Case où elle est restée porte un repère « Bête repérée » (une empreinte sur une pastille pêche), visible du seul joueur dont l'Expédition l'a vue ; le toucher ouvre sa fiche : son Espèce et « jusqu'à 22 h environ ». Tranché : l'heure approximative, arrondie à l'heure la plus proche dans le fuseau du joueur (« minuit » pour 0 h) ; le repère disparaît à la fin de sa durée, ou quand la Bête suit une autre Expédition, sans récit. Vérifié en vrai avec trois chefs d'essai.
- **Débloquée par** : US-0942, US-0917
- **Critères d'acceptation** :
  - Au retour, la Case où la Bête est restée porte un repère « Bête repérée » avec son Espèce, visible du seul joueur dont l'Expédition l'a vue.
  - Le repère indique jusqu'à quand elle devrait rester ; heure exacte ou approximative (à décider).
  - Le repère disparaît à la fin de sa durée, ou dès qu'elle a suivi une autre Expédition ; le joueur l'apprend-il (à décider).

### US-0949 · Revenir la chercher
**En tant que** joueur, **je veux** renvoyer une escorte plus forte vers une Bête repérée, **afin de** l'apprivoiser tant qu'elle est là.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#52). « Revenir la chercher », au pied de la fiche du repère sur la carte et sous une Rencontre « restée » du récit (tant que la Bête est repérée), ouvre l'écran d'Expédition avec sa Case pour destination, sans perdre les choix déjà faits. Le récapitulatif nomme la Bête repérée et sa force, dit si l'escorte est « Assez forte » ou « Trop faible : il manque N de force », et prévient « À l'arrivée : X ne sera plus là » sans empêcher de partir. Revenue à temps et assez forte, l'Expédition la ramène (la règle d'Apprivoisement s'applique) ; sinon le récit dit « X n'était plus sur la Case à votre arrivée. », sans dire pourquoi. Tranché : le récit retient la Case et la Bête dans ses Rencontres, sans migration ; les Récits d'avant n'ont pas le lien. Vérifié en vrai, des Souris (trop faibles) à un Mammouth.
- **Débloquée par** : US-0948, US-0932
- **Critères d'acceptation** :
  - Depuis le repère ou le récit, « Revenir la chercher » ouvre l'écran d'Expédition avec cette Case comme destination.
  - Le récapitulatif compare la force de la nouvelle escorte à celle de la Bête, et prévient si la Bête sera partie avant l'arrivée prévue.
  - Si la Bête est encore là à l'arrivée et que l'escorte est assez forte, elle suit l'Expédition dès son arrivée.
  - Si elle est partie entre-temps, le récit le dit.

### US-0950 · La Bête s'en va pendant le séjour
**En tant que** joueur, **je veux** que la menace cesse quand la Bête trop forte s'en va, **afin de** laisser mon Expédition finir son séjour tranquille.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#49). Quand une Bête trop forte quitte sa Case pendant le séjour, elle n'attaque plus et l'Expédition finit son séjour à l'heure prévue (déjà vrai depuis US-0943, désormais vérifié) ; le récit du retour dit l'heure de son départ, dans le fuseau du joueur : « Repartie à 03:13, à la fin de sa durée », avec le jour s'il a changé depuis la Rencontre. Les Récits écrits avant gardent leur texte, sans migration. Vérifié en vrai avec un Renard roux. Reste : « à la fin de sa durée » quand la Bête est partie avec une autre Expédition (US-0966).
- **Débloquée par** : US-0942
- **Critères d'acceptation** :
  - Quand la durée d'une Bête trop forte s'achève pendant le séjour, elle quitte la Case et ne peut plus attaquer.
  - L'Expédition finit son séjour normalement.
  - Le récit mentionne l'heure à laquelle la Bête est repartie.

## Étape 42 · Blessés et morts

### US-0951 · Des Blessés parmi les pertes
**En tant que** joueur, **je veux** qu'une partie de mes pertes soient seulement blessées, **afin de** ne pas tout perdre après un combat malheureux.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#58). Parmi les Bêtes qu'une Espèce de l'escorte perd au combat, une part ne sont que des Blessés : les mortes quittent l'effectif pour toujours, les Blessés rentrent au Foyer avec l'Expédition (et ne prennent pas part à un second combat). Le récit du retour le dit en une ligne, Espèce par Espèce : « Pertes au combat : Poule (2 morts, 2 Blessés) et Souris grise (6 morts, 6 Blessés). » (colonne `blessees`, migration 0066). Tranché : `PART_DES_BLESSES = 0.5` (provisoire) ; arrondi au plus proche, la demie aux Blessés, sans tirage (1 perdue = 1 Blessé), par combat et par Espèce. Vérifié en vrai contre un Loup gris. Restent les Blessés dans l'effectif, leur soin et leur guérison (US-0952 à US-0955).
- **Débloquée par** : US-0944
- **Critères d'acceptation** :
  - Parmi les pertes d'un combat, une part sont des Blessés (chiffre à régler), les autres meurent.
  - Les morts quittent définitivement l'effectif ; les Blessés rentrent au Foyer avec l'Expédition.
  - Le récit donne, Espèce par Espèce, le nombre de morts et de Blessés.
  - Avec de petits nombres (une seule Bête perdue), arrondi ou tirage au sort (à décider).

### US-0952 · Voir ses Blessés
**En tant que** joueur, **je veux** voir mes Blessés à part dans l'effectif, **afin de** savoir sur quelles Bêtes je peux compter.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#61). Les Blessés au Foyer se lisent à part dans l'effectif de chaque Espèce, un groupe par ligne avec le temps avant sa guérison : page Bêtes (« Poule, Commune, 797 Bêtes, dont 2 Blessés, guéris dans 5 h »), fiche de l'Espèce sous l'Effectif (« dont 6 Blessés, guéris dans 5 h ») et bloc Escorte de l'écran d'Expédition. Sans Blessé, aucune ligne. Tranché : un groupe = les Blessés d'une Espèce rentrés au Foyer au même instant ; guérison 24 h de jeu après le retour (`GUERISON_DES_BLESSES_HEURES`, provisoire, à régler avec US-0954) ; rien ne s'écrit en base, tout se relit du retour ; les Blessés comptent dans l'effectif (« dont ») ; dans l'Escorte, ils restent parmi les disponibles jusqu'à US-0953 ; jamais plus de Blessés affichés que l'Espèce n'en a. Vérifié en vrai après un vrai combat contre un Loup gris.
- **Débloquée par** : US-0951
- **Critères d'acceptation** :
  - L'effectif de chaque Espèce distingue les Bêtes valides et les Blessés.
  - Chaque groupe de Blessés affiche le temps restant avant sa guérison.
  - Sans Blessé, rien de plus ne s'affiche, pas même une ligne vide.

### US-0953 · Les Blessés restent au Foyer
**En tant que** joueur, **je veux** que mes Blessés ne puissent pas repartir, **afin de** ne pas les exposer par erreur.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#66). Les Blessés ne sont plus proposés en escorte avant leur guérison : le bloc Escorte de l'écran d'Expédition dit « Poule · 795 disponibles · 2 Blessés, guéris dans 4 h », « Toutes » ne prend que les valides, et un départ qui en emmènerait un est refusé (le départ relit les disponibles à son propre instant). Ils restent dans l'effectif ; guéris, ils redeviennent disponibles. Une Espèce toute blessée garde sa ligne, à 0 disponible. Tranché : les Blessés ne défendront pas le Foyer (étape 54, aucun code encore) ; jamais plus de Blessés que de Bêtes au Foyer, jamais moins de zéro disponible.
- **Débloquée par** : US-0951, US-0904
- **Critères d'acceptation** :
  - Les Blessés ne sont jamais proposés dans une escorte (ni, plus tard, dans une Attaque).
  - Ils restent dans l'effectif : quand les Bêtes mangeront et occuperont des Places (étape 35), les Blessés aussi.
  - Leur part dans la défense du Foyer, à l'étape 54 (à décider).

### US-0954 · La guérison avec le temps
**En tant que** joueur, **je veux** que mes Blessés guérissent seuls avec le temps, **afin de** retrouver mon effectif sans rien faire.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#77). Un Blessé guérit 24 h de jeu après le retour de son Expédition et redevient une Bête valide, même joueur absent ; à cet instant, la page Récits reçoit une note « 2 Blessés ont guéri » (« 1 Blessé a guéri ») : « De nouveau valides : Souris grise (2). », au médaillon de l'éleveur. Tranché (provisoire) : la même durée pour toutes les Espèces (`GUERISON_DES_BLESSES_HEURES = 24`) ; une note à part plutôt qu'un compteur ; les Blessés rentrés au même instant guérissent dans un seul Récit, les Espèces dans l'ordre du récit de retour ; jamais plus de guéris que l'effectif de l'Espèce. Sans migration : le Récit s'écrit quand le temps du Territoire avance, pas par un événement posé au retour. Limites acceptées : changer la durée en cours de partie peut annoncer deux fois, ou pas du tout, une guérison passée ; une attaque juste après la guérison, dans le même calcul, peut faire compter moins de guéris que la page n'en montrait.
- **Débloquée par** : US-0952
- **Critères d'acceptation** :
  - Un Blessé guérit après une durée (chiffre à régler) ; la même pour toutes les Espèces ou selon l'Espèce (à décider).
  - Guéri, il redevient une Bête valide de l'effectif, même si le joueur est absent.
  - La page Récits signale les guérisons ; note à part ou simple compteur (à décider).

### US-0955 · Soigner plus vite
**En tant que** joueur, **je veux** m'occuper de mes Blessés pour qu'ils guérissent plus vite, **afin de** repartir plus tôt en Expédition.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#83, migration 0069). Les Blessés d'une Expédition qui rentre quand un éleveur libre est au Foyer sont soignés : ils guérissent en 12 h de jeu au lieu de 24, et le temps restant le dit partout (« dont 2 Blessés soignés, guéris dans 11 h 52 » sur la page Bêtes et la fiche, « 2 Blessés soignés, guéris dans 11 h 52 » dans le bloc Escorte) ; le Récit de guérison tombe au retour + 12 h, et ils redeviennent disponibles pour l'escorte à cet instant. L'éleveur « élève les Bêtes d'un Couple réuni et soigne les Blessés ». Tranché (provisoire, à revoir) : aucun des moyens proposés (construction, Poste, Bête à Rôle) n'existe encore, d'où l'éleveur libre (sans Élevage en cours) ; les soins se décident une fois pour toutes au retour (`expedition.blesses_soignes`), sans occuper l'éleveur ; 12 h pour toutes les Espèces (`GUERISON_DES_BLESSES_SOIGNES_HEURES`).
- **Débloquée par** : US-0954
- **Critères d'acceptation** :
  - Un Blessé dont on s'occupe guérit plus vite ; le moyen, construction, Poste ou Bête à Rôle (à décider).
  - Le gain sur la durée de guérison (chiffre à régler).
  - Le temps restant affiché tient compte des soins.

## Étape 43 · Le Couple réuni

### US-0956 · Réunir le Couple
**En tant que** joueur, **je veux** que mon mâle et ma femelle d'une même Espèce forment un Couple, **afin de** pouvoir enfin élever cette Espèce.

- **Statut** : Livrée le 2026-10-10 (autopilot, THE-1469, Zewed/bestia-2#38). Dès que l'effectif d'une Espèce sans Couple compte un mâle et une femelle sûrement au Foyer, ils forment son Couple, à l'heure exacte où cela devient vrai (en direct, au rattrapage ou par la tâche planifiée), sans action du joueur. Les deux Bêtes quittent l'effectif pour la Réserve : elles ne sortent plus en escorte et ne combattent plus ; les autres Bêtes de l'Espèce restent dans l'effectif. L'Espèce passe « Couple réuni » au Bestiaire (migration 0061). L'escorte ne disant pas le sexe de ses Bêtes, une Bête sortie ne compte qu'à son retour ; le cas d'une Bête absente ou Blessée revient à US-0960. Vérifié en vrai sur un retour d'Expédition.
- **Débloquée par** : US-0937, US-0938
- **Critères d'acceptation** :
  - Dès que l'effectif d'une Espèce sans Couple compte un mâle et une femelle au Foyer, ils forment son Couple, sans action du joueur.
  - Les deux Bêtes quittent l'effectif et partent à l'abri, en Réserve ; elles ne combattent plus et ne peuvent plus sortir. La page de la Réserve arrive à l'étape 33.
  - Les autres Bêtes de l'Espèce, s'il y en a, restent dans l'effectif.
  - L'Espèce passe à l'état « Couple réuni » au Bestiaire.

### US-0957 · L'Élevage s'ouvre pour toujours
**En tant que** joueur, **je veux** que l'Élevage d'une Espèce me reste acquis dès son Couple réuni, **afin de** ne jamais perdre ce que j'ai gagné.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#42). L'Élevage d'une Espèce est acquis dès que son Couple est réuni, à l'heure exacte du retour (en direct, au rattrapage ou par la tâche planifiée), et le reste pour toujours, même quand toutes ses Bêtes meurent ou que d'autres entrent dans l'effectif. Tranché : il est noté dans le Couple lui-même (table `couple`, qui ne se défait jamais), sans nouvelle table ni migration ; le sexe des Bêtes élevées n'a rien à décider tant qu'une Espèce élevée a déjà son Couple. Vérifié en vrai avec un Couple de poules.
- **Débloquée par** : US-0956
- **Critères d'acceptation** :
  - Dès le Couple réuni, l'Élevage de l'Espèce est noté comme acquis pour toujours ; on s'en servira, avec un Habitant éleveur, à l'étape 34.
  - Il reste acquis même si toutes les Bêtes de l'Espèce dans l'effectif meurent.
  - Le sexe des Bêtes élevées ne comptera pas : seul le Couple importe.

### US-0958 · Annoncer le Couple réuni
**En tant que** joueur, **je veux** que la réunion d'un Couple soit fêtée, **afin de** savourer le moment le plus important du jeu.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#45). Le Récit « Retour d'Expédition » qui réunit un Couple l'annonce en tête, sans le déplier : l'illustration de l'Espèce en grand, une pastille « Couple réuni » et son nom, sans autre phrase ni « mâle et femelle ». Le menu du chef montre « Couples réunis » et leur nombre (0 dès l'entrée au Foyer). Tranché : sans migration, chaque Couple est rapproché du Retour d'Expédition de son instant ; les Couples réunis avant la story s'annoncent aussi ; un retour qui ramène ensuite une Bête de l'Espèce (US-0959) ne l'annonce pas de nouveau. Vérifié en vrai avec un Couple de poules, de 320×568 à 1 440×900, téléphone couché compris.
- **Débloquée par** : US-0956
- **Critères d'acceptation** :
  - Le récit du retour qui réunit le Couple l'annonce en tête, avec l'illustration de l'Espèce ; un bouton vers son Élevage s'y ajoutera à l'étape 34.
  - Le nombre de Couples réunis du joueur s'affiche et augmente d'un ; il servira au classement principal (étape 60).
  - Sur mobile, l'annonce tient sur un seul écran.

### US-0959 · Après le Couple, les Bêtes rejoignent l'effectif
**En tant que** joueur, **je veux** que les Bêtes apprivoisées après la réunion du Couple renforcent mon effectif, **afin de** ne rien perdre à continuer d'en apprivoiser.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#44). Une fois le Couple d'une Espèce réuni, chaque Bête de cette Espèce qui arrive au Foyer rejoint l'effectif, quel que soit son sexe, même quand une Bête de l'autre sexe attend déjà : aucun second Couple ne se forme, en direct, au rattrapage ou par la tâche planifiée. La règle venait déjà de US-0956 : la story est prouvée par des tests. Au passage, un test instable corrigé : les chefs d'un même Monde d'essai naissent d'abord, avant qu'on choisisse leurs Cases. Vérifié en vrai avec des poules.
- **Débloquée par** : US-0956
- **Critères d'acceptation** :
  - Une fois le Couple réuni, toute nouvelle Bête apprivoisée de l'Espèce rejoint l'effectif, quel que soit son sexe.
  - Aucun second Couple de la même Espèce ne se forme.

### US-0960 · Le mâle ou la femelle n'est pas au Foyer
**En tant que** joueur, **je veux** que le Couple se forme correctement même quand l'une des deux Bêtes est absente ou blessée, **afin de** ne pas être pénalisé par un mauvais moment.

- **Statut** : Livrée le 2026-10-14 (autopilot, Zewed/bestia-2#87, migration 0074). Le Couple se forme dès qu'un mâle et une femelle sont au Foyer, quelles que soient les Bêtes encore dehors ; quand la seule Bête d'un sexe est en escorte, il se forme à son retour, si elle revient vivante (le départ enregistre le sexe de son escorte, `expedition_escorte.males`). Si la seule Bête d'un sexe meurt, aucun Couple ne se forme. Tranché : un Blessé rejoint le Couple aussitôt et guérit en Réserve (les Blessés étaient déjà dans l'effectif) ; le Couple prend d'abord une Bête valide ; un Blessé parti en Réserve ne compte plus comme Blessé au Foyer ; au combat, les morts sont prises dans l'escorte, et la dernière Bête d'un sexe ne meurt jamais avant les autres de son escorte. Vérifié en vrai : deux poules mâles parties, une morte et une Blessée, le Couple réuni au retour.
- **Débloquée par** : US-0956, US-0953
- **Critères d'acceptation** :
  - Si l'une des deux Bêtes est en Expédition, le Couple se forme à son retour, si elle revient vivante.
  - Si l'une est Blessée, le Couple se forme aussitôt et elle guérit en Réserve, ou il attend sa guérison (à décider).
  - Si la seule Bête d'un sexe meurt avant l'arrivée de l'autre, aucun Couple ne se forme ; l'Espèce reste « apprivoisée » au Bestiaire.

### US-0961 · Prévenir avant de risquer une Bête précieuse
**En tant que** joueur, **je veux** être prévenu quand j'envoie en escorte ma seule Bête d'un sexe, **afin de** ne pas perdre bêtement la moitié d'un futur Couple.

- **Débloquée par** : US-0960, US-0910
- **Critères d'acceptation** :
  - Si l'escorte emmène la seule Bête d'un sexe d'une Espèce sans Couple, le récapitulatif le signale ; simple avertissement ou confirmation demandée (à décider).
  - L'avertissement nomme l'Espèce et le sexe concernés.
  - Il ne s'affiche pas pour les Espèces dont le Couple est déjà réuni.

## Étape 44 · Plusieurs Expéditions sur une Case

### US-0962 · Chaque Expédition présente voit la Bête
**En tant que** joueur, **je veux** voir une Bête même si d'autres joueurs ont une Expédition sur la même Case, **afin de** ne pas être privé de la Rencontre.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#43). À l'instant où une Bête se met à suivre une Expédition, toutes les Expéditions présentes sur la Case la voient (celle qui arrive à cet instant comprise) ; la Bête suit toujours celle que désigne US-0934. Tranché : un joueur n'apprend la présence d'autres Expéditions que par son récit de retour, en une ligne (« D'autres Expéditions séjournaient sur la Case. »), qui ne compte que les Expéditions des autres joueurs ayant partagé au moins un instant de séjour, sans nommer leurs chefs ; la carte ne montre que ses propres Expéditions. Le résultat ne dépend plus de l'ordre de mise à l'heure des Territoires. Vérifié en vrai avec deux comptes sur la même Prairie. Reste : le perdant lit encore « Repartie à la fin de sa durée » dans le détail de sa Rencontre (US-0964).
- **Débloquée par** : US-0932
- **Critères d'acceptation** :
  - Quand une Bête apparaît sur une Case où séjournent les Expéditions de plusieurs joueurs, toutes la voient, et son Espèce entre au Bestiaire de chacun.
  - Les Expéditions de joueurs différents ne se combattent jamais.
  - Un joueur n'apprend la présence des autres Expéditions que par le récit du retour (à décider).

### US-0963 · Des chances proportionnelles à la force
**En tant que** joueur, **je veux** que mes chances d'emporter une Bête disputée dépendent de la force de mon escorte, **afin de** tirer profit d'une escorte plus forte.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#51). Une Bête à portée de plusieurs Expéditions au même premier instant suit l'une d'elles, tirée au sort avec des chances proportionnelles à la force de chaque escorte (telle qu'elle est partie) ; le tirage ne dépend que de la Bête, et son résultat est le même quel que soit l'ordre de mise à l'heure des Territoires. Sans escorte, aucune chance face à une Expédition escortée ; entre Expéditions sans escorte, chances égales. Tranché : une Expédition pour qui la Bête est trop forte ne participe pas au tirage (chaque escorte garde sa propre portée, sans coopération entre joueurs, comme US-0962) ; une escorte de force nulle compte comme aucune escorte. Vérifié sur 10 000 tirages et en vrai avec trois comptes sur une même Forêt. Suite : une Bête ne doit jamais finir dans deux Foyers, même si les statistiques d'une Espèce changent entre deux mises à l'heure (correctif à part).
- **Débloquée par** : US-0962, US-0934
- **Critères d'acceptation** :
  - Si la Bête est à portée de plusieurs Expéditions, une seule l'emporte, tirée au sort avec des chances proportionnelles à la force de chaque escorte.
  - Une Expédition pour qui la Bête est trop forte ne participe pas au tirage ; ou la portée se juge sur la somme des escortes présentes (à décider).
  - Le tirage a lieu une seule fois, au moment de la Rencontre, et son résultat ne change plus.
  - Pour une Bête commune, une Expédition sans escorte n'a aucune chance face à une Expédition escortée ; entre Expéditions sans escorte, chacune a la même chance.

### US-0964 · Le récit du perdant
**En tant que** joueur, **je veux** apprendre qu'une Bête m'a échappé au profit d'une autre Expédition, **afin de** comprendre pourquoi je rentre les mains vides.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#59). Une Bête qui a suivi une autre Expédition avant la fin du séjour se lit « Partie à 17:12 avec une autre Expédition » dans la Rencontre du perdant (et non plus « Repartie à la fin de sa durée »), et le récit ajoute « Poule a suivi une autre Expédition. » ; le perdant ne perd rien, garde l'Espèce « croisée », et rentre à l'heure. Tranché : le chef qui l'a emportée n'est pas nommé (comme US-0962) ; la règle vaut pour le perdant du tirage (US-0963) comme pour celui qu'une escorte plus forte arrivée après dépasse (US-0966) ; une Bête emmenée à l'instant même du départ reste « restée ». Sans migration. Vérifié en vrai avec trois comptes sur une Prairie.
- **Débloquée par** : US-0963, US-0940
- **Critères d'acceptation** :
  - Au retour, le perdant reçoit un récit qui dit que la Bête a suivi une autre Expédition.
  - Nommer le chef qui l'a emportée (à décider).
  - Le perdant ne subit aucune perte, garde l'Espèce « croisée » au Bestiaire, et son Expédition a poursuivi son séjour normalement.

### US-0965 · Une Bête trop forte pour toutes
**En tant que** joueur, **je veux** savoir ce qui arrive quand une Bête est trop forte pour toutes les Expéditions présentes, **afin de** mesurer le risque d'une Case disputée.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#84). Les règles en place la font : une Bête trop forte pour toutes les Expéditions de sa Case, de tous les joueurs, y reste et peut les attaquer toutes, chacune au plus une fois, à l'instant de ses propres tirages (comptés depuis sa propre Rencontre, US-0943) ; l'attaquée fuit (US-0945), les autres poursuivent leur séjour, toujours exposées. Tranché : laquelle est attaquée la première tient du hasard de ces tirages, sans préférence pour la plus faible. Prouvée par un essai à trois joueurs sur une Case disputée, rattrapés de quatre manières ; règle écrite en tête de `src/expeditions/attaque.ts`.
- **Débloquée par** : US-0962, US-0943
- **Critères d'acceptation** :
  - Si la Bête est trop forte pour chacune des Expéditions présentes, elle reste sur sa Case et peut attaquer.
  - Laquelle elle attaque (au hasard, la plus faible…), et si elle peut en attaquer plusieurs (à décider).
  - Une Expédition attaquée fuit ; les autres poursuivent leur séjour.

### US-0966 · Une Expédition assez forte arrive ensuite
**En tant que** joueur, **je veux** qu'une Bête restée sur une Case puisse suivre une Expédition plus forte arrivée après, **afin de** récompenser celui qui revient mieux préparé.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#67). Les règles déjà en place la font : une Bête restée trop forte suit une Expédition assez forte arrivée ensuite, dès son arrivée, du même joueur ou d'un autre (US-0934) ; plusieurs assez fortes au même instant passent par le tirage proportionnel à la force (US-0963) ; celle déjà présente l'apprend dans son récit (US-0964). La PR n'ajoute que des essais sur base qui épinglent ces comportements, dans les deux ordres de mise à l'heure et page ouverte. Vérifié en vrai : 2 Souris grises voient un Renard roux trop fort, « Revenir la chercher » renvoie 91 Souris grises, et le Renard les suit.
- **Débloquée par** : US-0963, US-0949
- **Critères d'acceptation** :
  - Si une Bête restée trop forte voit arriver une Expédition assez forte, du même joueur ou d'un autre, elle la suit dès son arrivée.
  - Si plusieurs Expéditions présentes à ce moment sont assez fortes, le tirage proportionnel à la force s'applique.
  - Une Expédition déjà présente qui la perd ainsi l'apprend dans son récit.

### US-0967 · Deux Expéditions du même joueur sur une Case
**En tant que** joueur, **je veux** savoir si je peux envoyer deux Expéditions sur la même Case, **afin de** ne pas gaspiller mes explorateurs.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#72). Un joueur peut envoyer une seconde Expédition vers une Case où il en a déjà une, sans message (US-0919 : aucune limite sauf les explorateurs libres). Ses deux Expéditions passent par le même tirage proportionnel à la force (US-0963), qui ne sait pas à qui elles sont ; celle qui perd lit « X a suivi une autre Expédition. » (US-0964), sans la ligne des autres joueurs. Les règles en place font la story : elle est prouvée par des tests. « Nouvelle Espèce au Bestiaire » reste sur la Rencontre de la première Expédition lancée (US-0933).
- **Débloquée par** : US-0963
- **Critères d'acceptation** :
  - Envoyer une seconde Expédition vers une Case où l'on en a déjà une : autorisé ou refusé avec un message (à décider).
  - Si c'est autorisé, chacune a sa propre chance au tirage selon sa force, et une Bête ne suit jamais qu'une seule d'entre elles.

### US-0968 · La simulation des chances
**En tant que** développeur, **je veux** simuler un grand nombre de Rencontres disputées, **afin de** vérifier que les chances suivent bien les forces.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#70). La page de contrôle interne mène à « Simulation des chances » (/controle/chances) : 10 000 Rencontres disputées jugées par le vrai tirage du jeu (US-0963), un tableau par simulation (forces, victoires, part obtenue et attendue) et le contrôle en tête ; d'emblée 1 et 3 (24,8 % pour 25 % attendus), puis 1, 2 et 3, et des forces saisies. Tranché : tolérance de 2 points à 10 000 Rencontres (`SIMULATION_DES_CHANCES_TOLERANCE_POINTS`, provisoire) ; même protection et même apparence que la simulation des Raretés ; rien n'est lu ni écrit en base.
- **Débloquée par** : US-0963
- **Critères d'acceptation** :
  - Un outil de la page de contrôle interne simule un grand nombre de Rencontres entre plusieurs Expéditions de forces différentes.
  - Avec deux escortes de forces 1 et 3, la plus faible l'emporte environ une fois sur quatre, à la tolérance près (chiffre à régler).
  - Le contrôle couvre aussi le cas de trois Expéditions ou plus.

## Étape 45 · Les pigeons éclaireurs

### US-0976 · Emmener des Éclaireurs
**En tant que** joueur, **je veux** affecter des pigeons à leur Rôle d'Éclaireur au départ d'une Expédition, **afin de** mieux explorer sans les exposer au combat.

- **Débloquée par** : US-0904, US-0945
- **Critères d'acceptation** :
  - Pour une Espèce Éclaireuse (le pigeon), l'écran d'Expédition propose de choisir combien de Bêtes partent comme Éclaireurs, à côté de l'escorte ; une même Bête est l'un ou l'autre, jamais les deux.
  - Un Éclaireur est affecté à son Rôle : il ne combat pas, n'ajoute rien à la force de l'escorte, et fuit avec les explorateurs sans jamais être perdu.
  - Aucune Recherche n'est demandée ici ; si les Rôles en demandent une un jour, ce sera à l'étape 49 (US-1038).
  - Au retour, les Éclaireurs rentrent dans l'effectif, libres pour la sortie suivante.

### US-0969 · Les pigeons lèvent plus de brouillard
**En tant que** joueur, **je veux** que mes pigeons éclaireurs révèlent plus de carte pendant une Expédition, **afin de** découvrir le Monde plus vite que les autres.

- **Débloquée par** : US-0914, US-0976
- **Critères d'acceptation** :
  - Quand l'Expédition emmène des Éclaireurs, le rayon de brouillard levé le long du chemin et autour de la destination s'agrandit (chiffre à régler).
  - L'effet grandit avec le nombre d'Éclaireurs, jusqu'à un plafond (chiffre à régler).
  - Les Cases révélées en plus restent visibles pour toujours.

### US-0970 · Les pigeons gardent les Bêtes en vue
**En tant que** joueur, **je veux** que mes pigeons éclaireurs gardent plus longtemps en vue les Bêtes apparues, **afin de** faire plus de Rencontres.

- **Débloquée par** : US-0932, US-0976
- **Critères d'acceptation** :
  - Avec des Éclaireurs, une Bête apparue sur la Case de l'Expédition lui reste visible et atteignable plus longtemps que sa durée ordinaire (chiffre à régler, avec un plafond).
  - Une Expédition avec Éclaireurs qui arrive peu après le départ d'une Bête peut encore la rencontrer.
  - Cet effet ne vaut que pour l'Expédition qui a les Éclaireurs.
  - La forme exacte de l'effet, présence prolongée ou Bêtes repérées sur les Cases voisines (à décider).

### US-0971 · L'effet des pigeons avant le départ
**En tant que** joueur, **je veux** voir ce que mes pigeons éclaireurs apporteront avant de partir, **afin de** décider combien en emmener.

- **Débloquée par** : US-0969, US-0970, US-0910
- **Critères d'acceptation** :
  - Le récapitulatif indique ce qu'apportent les Éclaireurs choisis : rayon de brouillard en plus, présence prolongée des Bêtes.
  - La force affichée est celle de l'escorte seule : les Éclaireurs n'y comptent pas.
  - Sans Éclaireur, rien ne s'affiche à ce sujet.

### US-0972 · Un pigeon en escorte n'éclaire pas
**En tant que** joueur, **je veux** savoir ce que fait un pigeon que j'envoie en escorte, **afin de** choisir entre sa force et son Rôle.

- **Débloquée par** : US-0969
- **Critères d'acceptation** :
  - Un pigeon parti dans l'escorte combat comme toute Bête : il compte dans la force et risque les mêmes pertes.
  - Il ne lève pas plus de brouillard et ne garde pas les Bêtes en vue : seuls les Éclaireurs le font.
  - Le récit distingue les pigeons partis en escorte de ceux partis comme Éclaireurs.

### US-0973 · Les pigeons dans le récit
**En tant que** joueur, **je veux** que le récit dise ce que mes pigeons ont apporté, **afin de** juger s'ils valent la peine.

- **Débloquée par** : US-0969, US-0970, US-0940
- **Critères d'acceptation** :
  - Le récit indique combien de Cases supplémentaires les Éclaireurs ont révélées.
  - Il signale les Rencontres qui n'ont eu lieu que grâce à eux.

### US-0974 · La simulation des pigeons
**En tant que** développeur, **je veux** comparer des Expéditions avec et sans pigeons sur une longue période, **afin de** vérifier que leur effet se mesure.

- **Débloquée par** : US-0970
- **Critères d'acceptation** :
  - Un outil de la page de contrôle interne compare, sur une longue période, des Expéditions identiques avec et sans pigeons.
  - Celles avec pigeons font mesurablement plus de Rencontres (écart minimal : chiffre à régler).
  - Il mesure aussi le nombre de Cases révélées en plus.
