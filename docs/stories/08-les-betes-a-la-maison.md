# Jalon 8 · Les Bêtes à la maison

Le joueur retrouve dans la Réserve les Couples réunis en explorant, découvre la fiche complète de chaque Espèce, confie à un éleveur l'Élevage d'un Couple réuni, et apprend à loger et à nourrir ses Bêtes : si elles ont faim, elles retournent à l'état sauvage. Il affecte enfin des Bêtes à leur Rôle. Étapes couvertes : 33 à 37 de l'ordre d'attaque, attaquées juste après le jalon 9 (ADR 0008) ; US-0939, reportée du jalon 9, se fait avec l'étape 35.

## Étape 33 · La Réserve

### US-0801 · Ouvrir la Réserve
**En tant que** joueur, **je veux** ouvrir la Réserve de mon Territoire, **afin de** voir les Couples que j'ai réunis.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#47). Une entrée « Réserve » de la navigation, entre « Expéditions » et « Habitants », ouvre /jeu/reserve : son titre, une phrase (« Le lieu protégé de votre Territoire : vos Couples y vivent à l'abri, loin des combats. ») et le nombre de Couples en grand. Sans Couple, la page dit désormais « Aucun Couple pour l'instant » (US-0809) ; sur mobile, six onglets égaux, noms en 11 px. La refonte AEOM de la navigation devra reprendre cette entrée.
- **Débloquée par** : Étape 4, US-0956
- **Critères d'acceptation** :
  - Une entrée « Réserve » de la navigation ouvre la page, sur ordinateur comme sur mobile.
  - La page présente la Réserve comme le lieu protégé où vivent les Couples, qui ne combattent plus.
  - La page affiche le nombre de Couples qu'elle abrite.

### US-0802 · Voir ses Couples réunis
**En tant que** joueur, **je veux** voir dans la Réserve chaque Couple que j'ai réuni, **afin de** retrouver les Espèces que je peux élever.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#48). Dans la Réserve, sous le nombre de Couples, chaque Couple réuni a sa carte : ses deux Bêtes côte à côte, peintes de l'illustration de leur Espèce, puis le nom de l'Espèce et sa Rareté ; aucune étiquette de sexe. Chaque joueur ne voit que sa Réserve. Tranché : la même illustration deux fois (toutes les Bêtes d'une Espèce sont identiques) ; du premier Couple réuni au dernier ; cartes non cliquables (la fiche de l'Espèce est US-0803). Vérifié en vrai avec trois Couples (pigeon, poule, souris), téléphone couché compris.
- **Débloquée par** : US-0801
- **Critères d'acceptation** :
  - Chaque Couple réuni (US-0956) apparaît avec l'illustration de son Espèce, son nom et sa Rareté.
  - Les deux Bêtes du Couple sont visibles.
  - Un joueur ne voit jamais la Réserve d'un autre joueur.

### US-0803 · Ouvrir la fiche d'une Espèce
**En tant que** joueur, **je veux** ouvrir la fiche de l'Espèce d'un Couple, **afin de** tout savoir sur elle.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#55). Dans la Réserve, toute la carte d'un Couple ouvre la fiche de son Espèce (/jeu/reserve/<Espèce>) : l'illustration en grand, le nom et la pastille de Rareté ; « Fermer » ramène à la Réserve. Une fiche n'existe que pour une Espèce dont le joueur a réuni le Couple ; sinon, page introuvable. Tranché : la fiche est une page, pas un panneau ; le repère de chaque Rareté est la pastille existante, sa couleur et son nom écrit (jamais la couleur seule) ; le titre de l'onglet reste « Réserve ». Vérifié en vrai de 320 × 480 à 1 440 px, téléphone couché compris.
- **Débloquée par** : US-0802
- **Critères d'acceptation** :
  - Toucher le Couple ouvre la fiche de son Espèce, avec l'illustration en grand, le nom et la Rareté.
  - La Rareté est l'une des six (commune, peu commune, rare, épique, légendaire, mythique) et porte un repère visuel propre à chacune.
  - Fermer la fiche ramène à la Réserve.

### US-0804 · Lire l'attaque, la vie, la vitesse et la charge
**En tant que** joueur, **je veux** lire les chiffres de combat et de transport d'une Espèce, **afin de** savoir ce que vaut chacune de ses Bêtes.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#56). Sous l'effectif, la fiche d'une Espèce donne son Attaque, sa Vie, sa Vitesse (en km/h) et sa Charge, avec les valeurs de la base, à la française (« 14 953 », « 87,5 »). Tranché : une Espèce sans masse ou sans vitesse ne peut pas entrer en base (les données la refusent) ; la charge s'affiche sans unité, son explication vient avec US-0807. Reste : l'ordre de « Fermer » sur un téléphone couché, à revoir avec US-0807.
- **Débloquée par** : US-0803
- **Critères d'acceptation** :
  - La fiche affiche l'attaque, la vie, la vitesse et la charge de l'Espèce, avec les valeurs enregistrées pour elle.
  - Ces valeurs sont les mêmes pour tous les joueurs, quelles que soient leurs Recherches.
  - Aucune valeur ne manque : une Espèce incomplète est signalée sur la page de contrôle interne (étape 4) plutôt qu'affichée à moitié.

### US-0805 · Lire la taille, le régime et l'Entretien
**En tant que** joueur, **je veux** lire ce qu'une Bête occupe et ce qu'elle mange, **afin de** savoir combien je peux en loger et en nourrir.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#71). La fiche d'une Espèce ajoute sa Taille (« 31,623 Places », « 1 Place »), son Régime (« Omnivore ») et son Entretien (« 5 Viande ou Végétaux / h » ; un carnivore mange de la Viande, un herbivore des Végétaux), dans le bloc des caractéristiques de la refonte. Tranché : « Viande ou Végétaux » pour un omnivore, à reprendre si US-0826 choisit un partage fixe.
- **Débloquée par** : US-0803
- **Critères d'acceptation** :
  - La fiche affiche la taille de l'Espèce, en Places occupées par Bête.
  - Elle affiche le régime : carnivore, herbivore ou omnivore.
  - Elle affiche l'Entretien par heure et par Bête, dans la Nourriture qui correspond au régime.

### US-0806 · Lire le Biome d'Habitat et le Rôle
**En tant que** joueur, **je veux** lire où vit une Espèce et à quoi elle sert en dehors du combat, **afin de** savoir où l'élever et comment l'employer.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#75). La fiche d'une Espèce se termine par son Habitat, le nom du Biome précédé de son pictogramme (« Prairie »), et son Rôle (« Nourricier » pour la poule, « Éclaireur » pour le pigeon, « Aucun Rôle » pour la souris), dans le bloc des caractéristiques de la refonte. Tranché : le pictogramme est la Case du Biome telle que la carte et sa légende la dessinent (même couleur, même motif) ; une Espèce d'eau prend la Case de mer.
- **Débloquée par** : US-0803
- **Critères d'acceptation** :
  - La fiche affiche le Biome d'Habitat de l'Espèce, avec son nom et son pictogramme.
  - Elle affiche le Rôle de l'Espèce (Porteur, Éclaireur, Nourricier ou Bâtisseur), ou « Aucun Rôle ».

### US-0807 · Comprendre une caractéristique
**En tant que** nouveau joueur, **je veux** qu'on m'explique chaque caractéristique d'une Espèce, **afin de** comprendre ce que veulent dire les chiffres.

- **Débloquée par** : US-0804, US-0805, US-0806
- **Critères d'acceptation** :
  - Toucher le nom d'une caractéristique affiche une explication d'une phrase (par exemple, pour la charge : ce qu'une Bête peut porter).
  - Chaque caractéristique de la fiche a son explication.
  - L'explication se ferme d'un toucher ailleurs ou d'un bouton.

### US-0808 · Lire la fiche d'une Espèce sur mobile
**En tant que** joueur, **je veux** lire la fiche d'une Espèce confortablement sur mon téléphone, **afin de** consulter mes Bêtes où que je sois.

- **Débloquée par** : US-0807
- **Critères d'acceptation** :
  - Sur un écran de téléphone (375 pixels de large), l'illustration occupe le haut de la fiche et les caractéristiques se rangent en grille, sans défilement de côté.
  - Toute la fiche se lit sans zoom.
  - Les explications des caractéristiques s'ouvrent et se ferment au pouce.

### US-0809 · Voir une Réserve vide
**En tant que** joueur, **je veux** une Réserve sobre tant que je n'ai réuni aucun Couple, **afin de** savoir d'un coup d'œil qu'elle attend son premier Couple.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#53). Sans Couple, la Réserve n'affiche que son titre, « Aucun Couple pour l'instant » et le bouton « Envoyer une Expédition », qui ouvre l'écran d'Expédition ; dès le premier Couple, la phrase de présentation, le nombre de Couples et leurs cartes prennent sa place. Tranché : « sans autre phrase » pris à la lettre, la phrase de US-0801 et « 0 Couple » ne s'affichent plus sur une Réserve vide.
- **Débloquée par** : US-0801
- **Critères d'acceptation** :
  - Sans Couple, la Réserve affiche « Aucun Couple pour l'instant », sans autre phrase.
  - Un bouton « Envoyer une Expédition » mène à l'écran d'Expédition (US-0901).
  - Dès le premier Couple réuni, ce message laisse place à la liste.

## Étape 34 · L'Élevage

### US-0810 · Voir l'effectif par Espèce
**En tant que** joueur, **je veux** voir combien de Bêtes j'ai de chaque Espèce, **afin de** connaître la taille de mon armée.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#60). Une page Bêtes (/jeu/betes) donne le total en haut, puis une ligne par Espèce, de la plus commune à la plus rare : vignette, nom, Rareté et effectif. Les Bêtes d'un Couple ne comptent pas ; celles en escorte et les Blessés comptent ; les mortes au combat non. Toucher une Espèce ouvre sa fiche, qui rappelle « Effectif N » ; la fiche s'ouvre désormais pour toute Espèce dont le joueur a des Bêtes. Tranché : on y entre par un bloc « Bêtes » sur le Foyer, sous la production (pas de septième onglet) ; la fiche garde son adresse /jeu/reserve/<Espèce> et « Fermer » ramène d'où l'on vient ; la page ne dit jamais « armée ». Vérifié en vrai, téléphone couché compris.
- **Débloquée par** : US-0803, US-0938
- **Critères d'acceptation** :
  - Une page Bêtes liste chaque Espèce dont le joueur a des Bêtes, avec son illustration et son effectif.
  - Les Bêtes du Couple, en Réserve, ne comptent pas dans l'effectif.
  - Le total des Bêtes s'affiche en haut de la page.
  - Toucher une Espèce ouvre sa fiche, qui rappelle aussi l'effectif.

### US-0811 · Voir un effectif vide
**En tant que** nouveau joueur, **je veux** une page Bêtes sobre tant que je n'ai aucune Bête, **afin de** savoir où aller en chercher.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#62). Sans aucune Bête, la page Bêtes dit seulement « Aucune Bête pour l'instant » avec le bouton « Envoyer une Expédition » ; dès la première Bête, le total et la liste reviennent. Tranché : « sans autre phrase » à la lettre, comme US-0809 ; le bloc « Bêtes » du Foyer garde « 0 ».
- **Débloquée par** : US-0810
- **Critères d'acceptation** :
  - Sans aucune Bête, la page Bêtes affiche « Aucune Bête pour l'instant », sans autre phrase.
  - Un bouton « Envoyer une Expédition » mène à l'écran d'Expédition (US-0901).
  - Dès la première Bête ramenée, ce message laisse place à la liste.

### US-0812 · Trouver l'Élevage d'une Espèce
**En tant que** joueur, **je veux** trouver l'Élevage sur la fiche d'une Espèce dont j'ai réuni le Couple, **afin de** produire des Bêtes de cette Espèce.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#64). La fiche d'une Espèce dont le joueur a réuni le Couple montre un bloc « Élever » (ancre #elever) ; aucune autre fiche ne l'a. L'annonce du Couple réuni dans le récit (US-0958) porte un lien « Élever » vers ce bloc. Tranché : le bouton reste grisé tant que l'Élevage ne se lance pas (US-0813 à US-0815) ; l'action serveur `elever` est le seul chemin d'une demande, prend le Territoire de la session, relit l'Élevage acquis et refuse sans Couple (« Pas d'Élevage sans Couple réuni. »), de la même façon pour le Couple d'un autre ou une Espèce inconnue. Le vrai lancement (US-0815) devra relire l'Élevage acquis dans la transaction du paiement.
- **Débloquée par** : US-0803, US-0957
- **Critères d'acceptation** :
  - La fiche d'une Espèce dont le Couple est réuni propose un bloc « Élever ».
  - Seules les Espèces dont le joueur a réuni le Couple proposent ce bloc.
  - Le jeu refuse l'Élevage d'une Espèce sans Couple, même demandé par un autre chemin que le bouton.
  - Le récit d'un Couple réuni (US-0958) mène désormais à ce bloc.

### US-0843 · Confier l'Élevage à un éleveur
**En tant que** joueur, **je veux** confier l'Élevage d'une Espèce à un Habitant éleveur, **afin de** faire naître des Bêtes de son Couple.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#78, migration 0068). Le bloc « Élever » dit quel éleveur libre s'en occupera (« Éleveur : Hael ») ; sans éleveur libre, « Aucun éleveur libre. » avec un lien vers la page Habitants, et « Élever » grisé avec cette raison. Pendant son Élevage, l'éleveur est « à l'Élevage · Poule » sur la page Habitants, son Métier verrouillé comme celui d'un explorateur parti (ni changé, ni retiré, ni renvoyé). L'Élevage reste acquis sans éleveur. Tranché : colonne `habitant.espece_elevee` (null = libre), posée par le lancement (US-0815) ; le premier éleveur libre par prénom, sans choix entre éleveurs (US-0844) ; refus dans l'ordre Couple, éleveur, quantité. Reste à trancher avec US-0815 et US-0834 : une Famine peut encore faire partir un éleveur à l'Élevage.
- **Débloquée par** : US-0812, Étape 14
- **Critères d'acceptation** :
  - Le bloc « Élever » demande un éleveur libre : un Habitant au Métier d'éleveur qui ne s'occupe d'aucun autre Élevage.
  - Sans éleveur libre, « Élever » est grisé et dit pourquoi, avec un lien vers la page Habitants.
  - Pendant son Élevage, l'éleveur est « à l'Élevage » sur la page Habitants, avec l'Espèce qu'il élève ; son Métier ne peut pas être changé avant la fin, comme celui d'un explorateur parti (US-0911).
  - L'Élevage d'une Espèce reste acquis sans éleveur : seul le lancement en demande un.

### US-0813 · Choisir combien de Bêtes élever
**En tant que** joueur, **je veux** choisir le nombre de Bêtes à élever, **afin de** doser ce que j'investis.

- **Statut** : Livrée le 2026-10-13 (autopilot, Zewed/bestia-2#74). Le bloc « Élever » de la fiche propose la quantité : « − », le champ (1 d'abord), « + » et « Max », qui donne le plus grand nombre de Bêtes que les Stocks de Nourriture paient (poule, 1 000 Viande et 1 000 Végétaux : 2). Une quantité nulle, négative ou non entière (« 0 », « -2 », « 2,5 », « deux ») est refusée sous le champ : « La quantité doit être un nombre entier, d'au moins 1. », et par le serveur pour une demande forgée. Le bouton « Élever » reste grisé jusqu'à US-0815. Tranché : une Bête élevée coûte la Nourriture qu'elle mange en 7 jours (`JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE`, provisoire ; poule 840, souris 28) ; un carnivore paie en Viande, un herbivore en Végétaux, un omnivore avec les deux additionnés ; « Max » ne compte pas encore les Places (US-0825) ni les Élevages en cours (US-0819).
- **Débloquée par** : US-0812
- **Critères d'acceptation** :
  - Le bloc « Élever » propose un champ de quantité, des boutons « − » et « + », et un bouton « Max ».
  - « Max » donne le plus grand nombre de Bêtes que les stocks de Nourriture permettent de payer.
  - Une quantité nulle, négative ou non entière est refusée avec un message clair.

### US-0814 · Voir le coût et la durée d'un Élevage
**En tant que** joueur, **je veux** voir ce que coûte un Élevage et combien de temps il prend, **afin de** décider avant de payer.

- **Débloquée par** : US-0813
- **Critères d'acceptation** :
  - Le bloc affiche le coût total en Nourriture : le coût d'une Bête (chiffre à régler par Espèce) fois la quantité choisie.
  - (à décider) : le coût se paie en Viande, en Végétaux, ou selon le régime de l'Espèce.
  - Le bloc affiche la durée d'Élevage d'une Bête (chiffre à régler par Espèce), la durée totale et l'heure où naîtra la dernière Bête.
  - Coût et durée se mettent à jour à chaque changement de quantité.

### US-0815 · Lancer un Élevage
**En tant que** joueur, **je veux** lancer l'Élevage de la quantité choisie, **afin de** voir grandir mon effectif.

- **Débloquée par** : US-0814, US-0843
- **Critères d'acceptation** :
  - Le bouton « Élever » retire aussitôt le coût total des stocks, et la barre du haut se met à jour.
  - L'Élevage démarre à l'heure du clic.
  - Un double clic ne lance qu'un Élevage et ne fait payer qu'une fois.

### US-0816 · Refuser un Élevage faute de Nourriture
**En tant que** joueur, **je veux** qu'on m'empêche de lancer un Élevage que je ne peux pas payer, **afin de** ne jamais me retrouver avec des stocks négatifs.

- **Débloquée par** : US-0815
- **Critères d'acceptation** :
  - Tant que la Nourriture manque pour la quantité choisie, le bouton « Élever » est désactivé et dit ce qui manque.
  - Si les stocks ont baissé entre l'affichage et le clic, le jeu refuse l'Élevage avec un message clair et ne retire rien.
  - Aucun stock ne descend jamais sous zéro.

### US-0817 · Recevoir les Bêtes une à une
**En tant que** joueur, **je veux** voir mes Bêtes naître l'une après l'autre, **afin de** pouvoir compter sur les premières sans attendre la fin de l'Élevage.

- **Débloquée par** : US-0810, US-0815
- **Critères d'acceptation** :
  - Les Bêtes d'un Élevage naissent l'une après l'autre, chacune après la durée d'Élevage de l'Espèce.
  - Chaque Bête née s'ajoute aussitôt à l'effectif de son Espèce.
  - À la fin de l'Élevage, un récit court annonce « N Bêtes de <Espèce> ont rejoint votre effectif » sur la page Récits (étape 16).
  - En vitesse accélérée, le nombre de Bêtes nées au bout d'un temps donné correspond au rythme prévu.

### US-0818 · Suivre l'Élevage en cours
**En tant que** joueur, **je veux** voir où en est mon Élevage, **afin de** savoir quand naîtra la prochaine Bête.

- **Débloquée par** : US-0817
- **Critères d'acceptation** :
  - Le bloc « Élever » montre l'Élevage en cours : Bêtes déjà nées sur quantité demandée, temps avant la prochaine naissance, heure de la dernière.
  - Le décompte avance sans recharger la page, et reste juste après un rechargement ou sur un autre appareil.
  - Un bloc de l'accueil résume les Élevages en cours, un par éleveur, ou affiche « Aucun Élevage en cours ».

### US-0819 · Ajouter un Élevage à la file
**En tant que** joueur, **je veux** commander un nouvel Élevage pendant qu'un autre est en cours, **afin de** ne pas avoir à revenir au bon moment pour relancer.

- **Débloquée par** : US-0818
- **Critères d'acceptation** :
  - Pendant un Élevage, le joueur peut en lancer un autre de la même Espèce, pour le même éleveur : il se paie aussitôt et prend place dans sa file.
  - Les Élevages de la file se suivent dans l'ordre, sans temps mort entre eux.
  - La file affiche chaque Élevage avec sa quantité et son heure de fin prévue.
  - (à décider) : une longueur maximale de file (chiffre à régler) ; chaque éleveur a la sienne (US-0844).

### US-0844 · Un éleveur, un Élevage
**En tant que** joueur, **je veux** élever plusieurs Espèces en même temps grâce à plusieurs éleveurs, **afin de** faire grandir plusieurs Espèces à la fois.

- **Débloquée par** : US-0819, US-0843
- **Critères d'acceptation** :
  - Un éleveur ne s'occupe que d'un Élevage à la fois : tant que sa file n'est pas finie, il n'est proposé pour aucune autre Espèce.
  - Une Espèce n'a qu'un éleveur à la fois : un deuxième éleveur ne double pas son rythme.
  - Avec deux éleveurs libres, on élève deux Espèces en même temps, chacune avec sa file.
  - Quand sa file est finie, ou annulée en entier, l'éleveur redevient libre.

### US-0820 · Annuler un Élevage
**En tant que** joueur, **je veux** annuler un Élevage de la file, **afin de** récupérer de la Nourriture si j'en ai besoin ailleurs.

- **Débloquée par** : US-0819
- **Critères d'acceptation** :
  - Chaque Élevage de la file a un bouton « Annuler » qui demande une confirmation.
  - Les Bêtes déjà nées restent ; celles qui ne sont pas encore nées sont remboursées d'une part de leur coût (chiffre à régler), affichée avant la confirmation.
  - Les Élevages suivants de la file avancent aussitôt d'autant, et leurs heures de fin se mettent à jour.
  - Ce qui dépasserait la limite de stock est perdu, et la confirmation le signale (à décider).

### US-0821 · Retrouver les Bêtes nées pendant l'absence
**En tant que** joueur, **je veux** trouver dans mon effectif les Bêtes nées pendant que j'étais parti, **afin de** ne pas avoir à rester connecté pour élever.

- **Débloquée par** : US-0817, Étape 3
- **Critères d'acceptation** :
  - Au retour, l'effectif compte exactement les Bêtes nées pendant l'absence, au rythme de l'Élevage.
  - Les Élevages avancent même si le joueur ne revient pas : le passage régulier du Monde les fait progresser (étape 3).
  - Un seul récit récapitule les naissances de l'absence (« N Bêtes de <Espèce> sont nées pendant votre absence »).

## Étape 35 · L'Entretien et les Places

### US-0822 · Voir les Places de l'Habitat du Foyer
**En tant que** joueur, **je veux** voir combien de Places offre l'Habitat de mon Foyer et combien sont prises, **afin de** savoir combien de Bêtes je peux encore loger.

- **Statut** : Livrée le 2026-10-12 (autopilot, Zewed/bestia-2#68). La page Bêtes dit, sous le total, « Places : 16 / 500 », et le bloc « Élever » montre le même compteur. Les Places prises sont l'effectif fois la taille de chaque Espèce, arrondies à la Place entière supérieure. Tranché : `PLACES_DE_L_HABITAT_DU_FOYER = 500` (provisoire) ; les Bêtes en escorte et les Blessés gardent leur Place ; le Couple, en Réserve, n'en prend pas (le point « à décider » de US-0824, réglé en un seul endroit) ; un dépassement s'affiche tel quel (US-0939, US-0825).
- **Débloquée par** : US-0810
- **Critères d'acceptation** :
  - La page Bêtes affiche « Places : occupées / total » pour l'Habitat du Foyer.
  - Le nombre total de Places du Foyer vient des réglages du jeu (chiffre à régler).
  - Le même compteur apparaît dans le bloc « Élever ».

### US-0823 · Loger au Foyer les Bêtes de tout Biome
**En tant que** joueur, **je veux** loger au Foyer toutes les Bêtes que je ramène, quel que soit leur Biome, **afin de** ne pas être bloqué avant d'avoir des Habitats.

- **Débloquée par** : US-0822
- **Critères d'acceptation** :
  - Jusqu'aux Habitats par Biome (étape 51), les Places du Foyer accueillent les Bêtes de toutes les Espèces, quel que soit leur Biome d'Habitat.
  - La fiche de l'Espèce affiche quand même son Biome d'Habitat.
  - Le Foyer, toujours en prairie (US-0152), restera l'Habitat des Espèces de prairie ; ce que deviennent les autres au passage aux Habitats se règle à l'étape 51 (US-1130).

### US-0824 · Occuper des Places selon la taille
**En tant que** joueur, **je veux** que chaque Bête occupe des Places selon sa taille, **afin de** comprendre qu'un grand animal se loge moins facilement qu'un petit.

- **Débloquée par** : US-0817, US-0822
- **Critères d'acceptation** :
  - Chaque Bête née occupe autant de Places que la taille de son Espèce.
  - Les Places occupées valent la somme, Espèce par Espèce, de l'effectif fois la taille.
  - Une Bête qui quitte l'effectif libère aussitôt ses Places ; une Bête partie en sortie garde les siennes, pour pouvoir rentrer.
  - (à décider) : les Bêtes du Couple en Réserve occupent des Places, ou non.

### US-0825 · Bloquer l'Élevage quand les Places manquent
**En tant que** joueur, **je veux** qu'on m'empêche d'élever plus de Bêtes que je ne peux en loger, **afin de** ne jamais avoir de Bête sans Place.

- **Débloquée par** : US-0819, US-0824
- **Critères d'acceptation** :
  - Le bouton « Max » tient compte des Places libres : il ne propose jamais plus de Bêtes qu'elles ne peuvent en loger.
  - Les Places des Bêtes pas encore nées sont réservées dès le lancement de l'Élevage, et comptées comme prises.
  - Quand les Places manquent, le bouton « Élever » est désactivé avec le message « Plus assez de Places dans l'Habitat du Foyer ».
  - Le jeu refuse un Élevage qui dépasserait les Places libres, même demandé par un autre chemin que le bouton.

### US-0826 · Payer l'Entretien chaque heure
**En tant que** joueur, **je veux** que mes Bêtes mangent chaque heure selon leur régime, **afin de** sentir le vrai prix d'une armée.

- **Débloquée par** : US-0817
- **Critères d'acceptation** :
  - Chaque heure, chaque Bête de l'effectif, au Foyer ou en sortie, mange l'Entretien de son Espèce, à partir de sa naissance ou de son arrivée.
  - Un carnivore mange de la Viande, un herbivore des Végétaux.
  - (à décider) : ce que mange un omnivore (l'une ou l'autre selon les stocks, ou un partage fixe entre les deux).
  - (à décider) : les Bêtes du Couple en Réserve mangent un Entretien, ou non.
  - Après une absence, les stocks ont baissé exactement de l'Entretien dû, Bête par Bête.

### US-0827 · Voir l'Entretien des Bêtes dans le solde horaire
**En tant que** joueur, **je veux** voir dans la barre du haut ce que mes Bêtes mangent chaque heure, **afin de** savoir si ma Nourriture monte ou descend.

- **Débloquée par** : US-0826, Étape 15
- **Critères d'acceptation** :
  - Le solde horaire de Viande et de Végétaux de la barre du haut (étape 15) retire aussi l'Entretien des Bêtes.
  - Le détail du solde ajoute une ligne par Espèce (« Poules : − N par heure »), à côté de ce que mangent les Habitants.
  - La valeur change dès qu'une Bête naît ou part.

### US-0828 · Prévoir l'Entretien avant d'élever
**En tant que** joueur, **je veux** voir ce que coûteront chaque heure les Bêtes que je m'apprête à élever, **afin de** ne pas lancer un Élevage que je ne pourrai pas nourrir.

- **Débloquée par** : US-0814, US-0826
- **Critères d'acceptation** :
  - Le bloc « Élever » affiche l'Entretien que coûteront les Bêtes demandées (par exemple « + N Végétaux par heure »).
  - Il affiche aussi le solde horaire qu'on aura une fois toutes ces Bêtes nées.
  - Si ce solde devient négatif, un avertissement le dit avant le lancement, sans bloquer le bouton.

## Étape 36 · La Famine des Bêtes

### US-0829 · Être averti d'une famine imminente
**En tant que** joueur, **je veux** être averti avant que mes Bêtes ne manquent de Nourriture, **afin de** réagir à temps.

- **Débloquée par** : US-0827, Étape 15
- **Critères d'acceptation** :
  - L'avertissement « famine imminente » de l'étape 15 tient compte de l'Entretien des Bêtes comme de ce que mangent les Habitants.
  - Il se déclenche aussi quand seul le stock dont dépend une Espèce va manquer (par exemple la Viande pour un carnivore), même si l'autre Nourriture est abondante.
  - Il donne l'heure à laquelle ce stock sera vide, sur ordinateur comme sur mobile.
  - En vitesse accélérée, il apparaît exactement au moment prévu.

### US-0830 · Savoir quelles Bêtes vont avoir faim
**En tant que** joueur, **je veux** savoir quelles Bêtes sont menacées, **afin de** savoir quelle Nourriture aller chercher.

- **Débloquée par** : US-0829
- **Critères d'acceptation** :
  - L'avertissement nomme la Nourriture qui va manquer (Viande ou Végétaux) et les Espèces qui en dépendent.
  - Il donne, pour chaque Espèce, le nombre de Bêtes menacées.

### US-0831 · Recalculer l'avertissement quand l'effectif change
**En tant que** joueur, **je veux** que l'avertissement suive les naissances et les départs de mes Bêtes, **afin de** savoir à tout moment si elles sont tirées d'affaire.

- **Débloquée par** : US-0829
- **Critères d'acceptation** :
  - Une naissance qui fait passer le solde sous le seuil déclenche l'avertissement, sans recharger la page.
  - Des Bêtes qui partent, ou un Élevage annulé, peuvent le lever, selon la même marge qu'à l'étape 15.
  - L'heure à laquelle le stock sera vide se met à jour à chaque changement de l'effectif.

### US-0832 · Voir des Bêtes affamées retourner à l'état sauvage
**En tant que** joueur, **je veux** que des Bêtes que je ne nourris plus s'en aillent, **afin de** sentir le prix d'une armée trop grande pour mes stocks.

- **Débloquée par** : US-0826, US-0829
- **Critères d'acceptation** :
  - Quand le stock dont dépend une Espèce est vide et que son Entretien ne peut pas être payé, des Bêtes affamées quittent l'effectif et retournent à l'état sauvage.
  - (à décider) : combien partent à chaque heure : autant qu'il faut pour que l'Entretien de celles qui restent soit payé, ou (chiffre à régler) Bêtes par heure de Famine, comme pour les Habitants (étape 16).
  - Les Bêtes parties libèrent leurs Places et ne coûtent plus d'Entretien.
  - (à décider) : un Élevage en cours continue pendant la Famine, ou se suspend.
  - (à décider) : les Bêtes parties réapparaissent comme Bêtes sauvages sur la carte, ou disparaissent.

### US-0833 · Lire le récit d'une Famine
**En tant que** joueur, **je veux** un récit de chaque Famine, **afin de** comprendre ce que j'ai perdu et quand.

- **Débloquée par** : US-0832
- **Critères d'acceptation** :
  - Chaque Famine donne un récit : l'heure, la Nourriture qui a manqué, et le nombre de Bêtes parties par Espèce.
  - Le récit reste consultable après coup sur la page Récits (étape 16).
  - Si des Habitants sont partis dans la même Famine (étape 16), le récit les distingue des Bêtes.

### US-0834 · Garder ses Couples et ses Élevages après une Famine
**En tant que** joueur, **je veux** que mes Couples et mes Élevages survivent à une Famine, **afin de** pouvoir tout reconstruire ensuite.

- **Débloquée par** : US-0832
- **Critères d'acceptation** :
  - Les Bêtes des Couples, à l'abri en Réserve, ne retournent jamais à l'état sauvage.
  - L'Élevage d'une Espèce reste acquis même si toutes les Bêtes de l'effectif sont parties.
  - On peut relancer un Élevage dès que la Nourriture le permet.

### US-0835 · Subir une Famine pendant l'absence
**En tant que** joueur, **je veux** que ce qui s'est passé pendant mon absence soit compté comme si j'étais resté, **afin de** pouvoir faire confiance au jeu.

- **Débloquée par** : US-0833, Étape 3
- **Critères d'acceptation** :
  - Le rattrapage du temps calcule la Famine heure par heure : le nombre de Bêtes parties est le même que si le joueur était resté connecté.
  - Au retour, un récapitulatif dit quand la Famine a commencé et combien de Bêtes sont parties.
  - En vitesse accélérée, une Famine provoquée fait partir le bon nombre de Bêtes.

### US-0836 · Partager la Nourriture entre Habitants et Bêtes
**En tant que** joueur, **je veux** savoir qui mange en premier quand la Nourriture manque, **afin de** prévoir qui je risque de perdre.

- **Débloquée par** : US-0832, Étape 16
- **Critères d'acceptation** :
  - (à décider) : quand la Nourriture ne suffit pas pour tous, les Habitants mangent d'abord, les Bêtes d'abord, ou chacun reçoit une part égale.
  - La règle retenue est expliquée dans l'avertissement « famine imminente ».
  - En vitesse accélérée, une Famine qui touche à la fois Habitants et Bêtes fait partir chacun selon cette règle.

## Étape 37 · Affecter une Bête à son Rôle

### US-0837 · Affecter une Bête à son Rôle
**En tant que** joueur, **je veux** affecter des Bêtes à leur Rôle, comme je donne un Métier à un Habitant, **afin de** tirer d'elles autre chose que leur force.

- **Débloquée par** : US-0806, US-0810
- **Critères d'acceptation** :
  - Sur la page Bêtes, une Espèce dont le Rôle sert au Foyer (Nourricier) propose « + » et « − » pour affecter des Bêtes à son Rôle, avec le compte « affectées / effectif » ; un Éclaireur, lui, s'affecte au départ d'une Expédition (US-0976).
  - Une Bête affectée remplit son Rôle aussitôt, sans Recherche ni Poste ; si les Rôles demandent une Recherche un jour, ce sera à l'étape 49 (US-1038).
  - Seules les Bêtes valides au Foyer peuvent être affectées, ni Blessées ni sorties ; une Bête affectée continue de manger et d'occuper ses Places.
  - Les Bêtes d'un Couple en Réserve peuvent être affectées à leur Rôle, ou non (à décider).

### US-0838 · Nourrir le Territoire avec les poules
**En tant que** joueur, **je veux** que mes poules affectées à leur Rôle de Nourricier produisent de la Nourriture sans que j'aie à chasser, **afin de** grandir plus vite.

- **Débloquée par** : US-0826, US-0837
- **Critères d'acceptation** :
  - Chaque poule affectée produit de la Nourriture en continu, heure après heure (chiffre à régler par poule).
  - (à décider) : les poules produisent de la Viande, des Végétaux, ou les deux.
  - Après une absence, la Nourriture produite est exactement celle attendue, poule par poule, de son affectation à son retrait ou à son départ.
  - (à décider) : une poule rapporte plus de Nourriture qu'elle ne coûte d'Entretien.

### US-0839 · Voir la production des poules dans le solde horaire
**En tant que** joueur, **je veux** voir ce que rapportent mes poules chaque heure, **afin de** savoir combien il m'en faut.

- **Débloquée par** : US-0827, US-0838
- **Critères d'acceptation** :
  - Le détail du solde horaire affiche une ligne « Poules nourricières : + N par heure ».
  - La ligne change dès qu'une poule est affectée ou retirée, ou quitte l'effectif.
  - La fiche de la poule affiche ce qu'une poule rapporte par heure.

### US-0840 · Arrêter la production des poules quand le stock est plein
**En tant que** joueur, **je veux** que la production des poules respecte la limite de stock, **afin de** comprendre qu'il faut agrandir mes stockages pour en profiter.

- **Débloquée par** : US-0838, Étape 12
- **Critères d'acceptation** :
  - La Nourriture produite par les poules s'arrête à la limite de stock, comme la production du Foyer (étape 12).
  - La production reprend dès qu'il y a de nouveau de la place dans le stock.
  - Après une absence, rien n'est compté au-delà de la limite.

### US-0841 · Retirer une Bête de son Rôle
**En tant que** joueur, **je veux** retirer une Bête de son Rôle, **afin de** la rendre au combat quand j'en ai besoin.

- **Débloquée par** : US-0837
- **Critères d'acceptation** :
  - Le « − » de la page Bêtes retire une Bête de son Rôle : elle cesse aussitôt de le remplir.
  - Retirée, elle redevient une Bête de l'effectif comme une autre, qui peut escorter, défendre et attaquer.
  - Affecter et retirer sont gratuits et immédiats, autant de fois qu'on veut.

### US-0842 · Une Bête affectée ne combat plus
**En tant que** joueur, **je veux** qu'une Bête affectée à son Rôle reste hors des combats, **afin de** savoir sur quelles Bêtes compter pour me défendre et explorer.

- **Débloquée par** : US-0837
- **Critères d'acceptation** :
  - Une Bête affectée à son Rôle n'est plus proposée en escorte (US-0904), et ne partira pas à l'Attaque (étape 57).
  - Elle ne défendra pas le Foyer contre une Incursion (étape 54), et n'y subira aucune perte.
  - La page Bêtes sépare, Espèce par Espèce, les Bêtes affectées des autres.
  - Les Éclaireurs partis en Expédition (US-0976) suivent la même règle.
