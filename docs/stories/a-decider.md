# Points à décider

Tous les « (à décider) » laissés dans les stories, jalon par jalon. On les tranche au moment d'attaquer la story concernée, pas avant. Une fois décidé, on remplace la mention dans la story par la règle retenue, et on met à jour [CONTEXT.md](../../CONTEXT.md) si un mot du jeu change.

194 points au total.

## [Jalon 0 · Les fondations](00-fondations.md)

- [US-0005](00-fondations.md) · Mettre le projet en ligne sur Vercel : le nom de domaine du jeu (en attendant : bestia-2.vercel.app).

## [Jalon 2 · Le territoire respire](02-le-territoire-respire.md)


## [Jalon 3 · Les Habitants](03-les-habitants.md)


## [Jalon 4 · La carte du Monde](04-la-carte-du-monde.md)


## [Jalon 5 · Récolter](05-recolter.md)

- [US-0502](05-recolter.md) · Choisir le nombre de bûcherons : par défaut, tous les bûcherons libres sont choisis.
- [US-0504](05-recolter.md) · Calculer le trajet selon la distance : la distance est celle de la carte, en Cases à vol d'oiseau, en traversant l'eau plutôt qu'en la contournant.
- [US-0504](05-recolter.md) · Calculer le trajet selon la distance : le Biome des Cases traversées ne change pas la vitesse.
- [US-0505](05-recolter.md) · Voir le déroulé prévu avant de partir : une estimation du Bois rapporté s'affiche, en valeur moyenne ou en fourchette.
- [US-0510](05-recolter.md) · Déposer le Bois dans les stocks au retour : la limite de stock s'applique : ce qui dépasse est perdu plutôt que gardé en attente au Foyer.
- [US-0516](05-recolter.md) · Mener plusieurs Récoltes à la fois : deux Récoltes du même joueur peuvent viser la même Case en même temps.
- [US-0519](05-recolter.md) · Refuser une Case trop loin : une Recherche pourra allonger cette portée.
- [US-0520](05-recolter.md) · Refuser une Case sous le brouillard : une Récolte ne lève pas le brouillard sur son chemin, ce rôle restant aux Expéditions.
- [US-0521](05-recolter.md) · Récolter sur la Case de son Foyer : récolter sur la Case de son propre Foyer est permis.
- [US-0522](05-recolter.md) · Récolter sur une Case d'un autre joueur : récolter sur une Case qui appartient à un autre joueur est refusé.
- [US-0523](05-recolter.md) · Partager une Case libre avec d'autres joueurs : chacun rapporte comme s'il était seul : une Case ne s'épuise pas.
- [US-0523](05-recolter.md) · Partager une Case libre avec d'autres joueurs : aucun joueur ne voit les Récoltes des autres.
- [US-0525](05-recolter.md) · Traverser une Famine pendant une Récolte : les Habitants partis en Récolte peuvent s'en aller pendant une Famine, au même titre que ceux restés au Foyer.
- [US-0528](05-recolter.md) · Rattacher chaque Métier à ses Biomes : bûcheron : forêt, et peut-être jungle ; mineur : montagne, et peut-être d'autres Biomes ; chasseur et cueilleur : liste de Biomes.
- [US-0528](05-recolter.md) · Rattacher chaque Métier à ses Biomes : les chasseurs peuvent aussi pêcher sur la côte, les lacs et les rivières.
- [US-0535](05-recolter.md) · Nourrir ses Habitants grâce aux Récoltes : le formulaire prévient quand le retour prévu tombe après le début prévu de la Famine.
- [US-0538](05-recolter.md) · Ne plus pouvoir rappeler une fois arrivé : écourter un travail déjà commencé n'est pas possible.
- [US-0542](05-recolter.md) · Relancer la boucle avec les Habitants encore là : s'il en manque (partis pendant une Famine, par exemple), elle repart avec ceux qui restent plutôt que de s'arrêter.
- [US-0544](05-recolter.md) · Gérer une boucle quand le stock est plein : quand le stock de la ressource rapportée est plein, la boucle s'arrête plutôt que de continuer en perdant ce qui dépasse.
- [US-0547](05-recolter.md) · Tirer une Densité du jour pour chaque Case : elle change une fois par jour, au même instant sur tout le Monde, à une heure fixe.
- [US-0547](05-recolter.md) · Tirer une Densité du jour pour chaque Case : une seule Densité par Case sert aux Récoltes et aux apparitions de Bêtes sauvages (US-0929), plutôt qu'une Densité par ressource.
- [US-0548](05-recolter.md) · Moduler les Récoltes par la Densité : la production continue des Cases possédées n'est pas touchée par la Densité.
- [US-0549](05-recolter.md) · Compter la Densité du bon jour : la Densité appliquée est celle du jour où le travail a lieu ; un travail à cheval sur deux jours compte chaque heure au jour où elle tombe, plutôt que tout au jour où il commence.
- [US-0551](05-recolter.md) · Deviner l'abondance dans le récit : le récit qualifie l'abondance du jour en quelques mots, comme « la forêt était généreuse » ou « la forêt était maigre ».

## [Jalon 6 · Construire](06-construire.md)

- [US-0612](06-construire.md) · Annuler un chantier : ce qui dépasserait la limite de stock est perdu, et la confirmation le signale.
- [US-0616](06-construire.md) · Bâtir plus vite avec plus de bâtisseurs : un nombre maximum de bâtisseurs par chantier (chiffre à régler), au-delà duquel un bâtisseur de plus n'accélère plus rien.
- [US-0618](06-construire.md) · Savoir ce que devient un chantier sans bâtisseur : sans aucun bâtisseur, le chantier avance à une vitesse réduite (chiffre à régler), ou il s'arrête.
- [US-0621](06-construire.md) · Répartir les bâtisseurs entre plusieurs chantiers : le joueur choisit combien de bâtisseurs vont sur chaque chantier, ou ils se partagent d'eux-mêmes à parts égales.
- [US-0625](06-construire.md) · Agrandir les huttes niveau par niveau : les huttes forment une seule construction qui monte en niveau, ou l'on peut en bâtir plusieurs.
- [US-0626](06-construire.md) · Savoir si une construction sert pendant son amélioration : pendant le chantier du niveau suivant, la construction garde l'effet de son niveau actuel, ou elle cesse de servir.
- [US-0627](06-construire.md) · Atteindre le niveau maximum : chaque construction a un niveau maximum (chiffre à régler), ou ses niveaux ne s'arrêtent pas.
- [US-0634](06-construire.md) · Voir les Postes d'une construction : le nombre de Postes vient de la liste des constructions (chiffre à régler) ; il grandit avec le niveau.
- [US-0638](06-construire.md) · Mesurer ce qu'apporte chaque employé : chaque employé apporte autant que le précédent, ou un peu moins.
- [US-0641](06-construire.md) · Bâtir la tour de guet : la tour de guet a des Postes, et ne repère alors rien sans personnel.
- [US-0642](06-construire.md) · Voir un Voyageur approcher : on peut accueillir un Voyageur encore en approche, ou seulement une fois arrivé aux portes.
- [US-0644](06-construire.md) · Bâtir la taverne : la taverne a des Postes, et ne retient alors personne sans personnel.
- [US-0645](06-construire.md) · Retenir les Voyageurs plus longtemps : l'allongement vaut aussi pour les Voyageurs déjà aux portes au moment où la taverne est finie.

## [Jalon 7 · La Recherche](07-la-recherche.md)

- [US-0707](07-la-recherche.md) · Savoir ce que devient une Recherche sans chercheur : sans chercheur, on ne peut pas lancer de Recherche, ou elle avance à une vitesse réduite (chiffre à régler) ; la règle est la même que pour les chantiers sans bâtisseur (étape 26).
- [US-0708](07-la-recherche.md) · Ne mener qu'une Recherche à la fois : une seule Recherche en cours pour tout le Territoire, ou une par branche.
- [US-0715](07-la-recherche.md) · Améliorer le cercle des sages : ce qu'apporte un niveau de plus (plus de chercheurs utiles, des Recherches plus avancées, ou des Recherches plus rapides).
- [US-0715](07-la-recherche.md) · Améliorer le cercle des sages : une Recherche en cours continue pendant l'amélioration du cercle.
- [US-0719](07-la-recherche.md) · Voir les prérequis d'une Recherche : un prérequis peut venir d'une autre branche, ou d'un niveau du cercle des sages.
- [US-0727](07-la-recherche.md) · Voir ce que débloque chaque Recherche : si les Rôles demandent une Recherche, leurs Recherches apparaissent déjà dans l'arbre à ce jalon, ou seulement à l'étape 49, quand leur effet existe.

## [Jalon 8 · Les Bêtes à la maison](08-les-betes-a-la-maison.md)

- [US-0819](08-les-betes-a-la-maison.md) · Ajouter un Élevage à la file : une longueur maximale de file (chiffre à régler) ; chaque éleveur a la sienne (US-0844).
- [US-0820](08-les-betes-a-la-maison.md) · Annuler un Élevage : ce qui dépasserait la limite de stock est perdu, et la confirmation le signale.
- [US-0824](08-les-betes-a-la-maison.md) · Occuper des Places selon la taille : les Bêtes du Couple en Réserve occupent des Places, ou non.
- [US-0826](08-les-betes-a-la-maison.md) · Payer l'Entretien chaque heure : ce que mange un omnivore (l'une ou l'autre selon les stocks, ou un partage fixe entre les deux).
- [US-0826](08-les-betes-a-la-maison.md) · Payer l'Entretien chaque heure : les Bêtes du Couple en Réserve mangent un Entretien, ou non.
- [US-0832](08-les-betes-a-la-maison.md) · Voir des Bêtes affamées retourner à l'état sauvage : combien partent à chaque heure : autant qu'il faut pour que l'Entretien de celles qui restent soit payé, ou (chiffre à régler) Bêtes par heure de Famine, comme pour les Habitants (étape 16).
- [US-0832](08-les-betes-a-la-maison.md) · Voir des Bêtes affamées retourner à l'état sauvage : un Élevage en cours continue pendant la Famine, ou se suspend.
- [US-0832](08-les-betes-a-la-maison.md) · Voir des Bêtes affamées retourner à l'état sauvage : les Bêtes parties réapparaissent comme Bêtes sauvages sur la carte, ou disparaissent.
- [US-0836](08-les-betes-a-la-maison.md) · Partager la Nourriture entre Habitants et Bêtes : quand la Nourriture ne suffit pas pour tous, les Habitants mangent d'abord, les Bêtes d'abord, ou chacun reçoit une part égale.
- [US-0838](08-les-betes-a-la-maison.md) · Nourrir le Territoire avec les poules : les poules produisent de la Viande, des Végétaux, ou les deux.
- [US-0838](08-les-betes-a-la-maison.md) · Nourrir le Territoire avec les poules : une poule rapporte plus de Nourriture qu'elle ne coûte d'Entretien.

## [Jalon 9 · Explorer et apprivoiser](09-explorer-et-apprivoiser.md)

- [US-0929](09-explorer-et-apprivoiser.md) · La Densité change la fréquence : la Densité ne change pas les pourcentages de Rareté.
- [US-0929](09-explorer-et-apprivoiser.md) · La Densité change la fréquence : elle n'est jamais affichée en chiffre ; que le récit en donne une impression, comme « la faune semblait abondante ».
- [US-0939](09-explorer-et-apprivoiser.md) · Une Bête apprivoisée sans Place libre : quand l'Habitat du Foyer n'a plus de Place libre pour elle, la Bête rejoint quand même le joueur en surnombre, attend une Place, ou repart au sauvage.
- [US-0961](09-explorer-et-apprivoiser.md) · Prévenir avant de risquer une Bête précieuse : si l'escorte emmène la seule Bête d'un sexe d'une Espèce sans Couple, le récapitulatif le signale ; simple avertissement ou confirmation demandée.
- [US-0970](09-explorer-et-apprivoiser.md) · Les pigeons gardent les Bêtes en vue : la forme exacte de l'effet, présence prolongée ou Bêtes repérées sur les Cases voisines.

## [Jalon 10 · Le Bestiaire](10-le-bestiaire.md)

- [US-1003](10-le-bestiaire.md) · Ranger les Espèces par Biome et par Rareté : les Espèces sont groupées par Biome, chaque groupe portant le nom et le pictogramme de son Biome ; l'ordre des Biomes.
- [US-1003](10-le-bestiaire.md) · Ranger les Espèces par Biome et par Rareté : dans chaque Biome, elles vont de commune à mythique ; l'ordre au sein d'une même Rareté, alphabétique ou du plus faible au plus fort.
- [US-1004](10-le-bestiaire.md) · La silhouette d'une Espèce jamais vue : silhouette générique ou contour réel de l'animal, tant qu'elle ne permet pas de reconnaître l'Espèce.
- [US-1006](10-le-bestiaire.md) · L'état « croisée » : elle se distingue d'un coup d'œil d'une Espèce apprivoisée ; par quel moyen, illustration adoucie, cadre ou autre.
- [US-1009](10-le-bestiaire.md) · Signaler les nouvelles inscriptions : la marque disparaît à l'ouverture de la page ou à celle de la fiche.
- [US-1011](10-le-bestiaire.md) · La fiche d'une Espèce seulement croisée : les caractéristiques d'une Espèce seulement croisée : visibles, partielles ou cachées jusqu'à l'Apprivoisement.
- [US-1016](10-le-bestiaire.md) · Filtrer par Biome et par Rareté : les compteurs suivent les filtres ou restent globaux.
- [US-1022](10-le-bestiaire.md) · Une illustration pour chaque Espèce : une Espèce dont l'illustration n'est pas prête est chargée avec une image d'attente, ou tenue hors du Monde jusqu'à son arrivée.
- [US-1025](10-le-bestiaire.md) · Garder ce que les joueurs ont déjà : ce que deviennent des Bêtes ou des inscriptions d'Espèces d'essai qui existeraient en ligne.
- [US-1028](10-le-bestiaire.md) · Ce que « compléter » veut dire : l'état demandé : « Couple réuni » (« apprivoisée » pour une mythique), ou une récompense à chaque étape, croiser toutes, apprivoiser toutes, réunir tous les Couples.
- [US-1029](10-le-bestiaire.md) · La nature des récompenses : chaque Biome et chaque Rareté a sa récompense, annoncée à l'avance ; sa nature, ressources, Voyageurs, embellissement du Foyer ou autre ; son montant (chiffre à régler).
- [US-1035](10-le-bestiaire.md) · Une récompense quand les stocks sont pleins : si la récompense contient des ressources et que le stock est plein, le surplus est perdu, gardé au-delà de la limite, ou mis de côté à réclamer plus tard.
- [US-1036](10-le-bestiaire.md) · La Rareté mythique : la Rareté mythique se complète en possédant une Bête de chacune de ses Espèces.
- [US-1036](10-le-bestiaire.md) · La Rareté mythique : un Biome qui compte une Espèce mythique exige-t-il de l'avoir pour être complet.
- [US-1037](10-le-bestiaire.md) · Une nouvelle Espèce dans un Biome déjà complet : le compléter à nouveau donne une nouvelle récompense ou non.
- [US-1038](10-le-bestiaire.md) · Les Rôles et la Recherche : qu'une Recherche soit demandée avant d'affecter une Bête à son Rôle, pour chacun des quatre Rôles (Porteur, Éclaireur, Nourricier, Bâtisseur) ou pour certains seulement, et dans quelle branche.
- [US-1042](10-le-bestiaire.md) · Emmener des Porteurs dans une Récolte : le trajet se fait au pas du Porteur le plus lent s'il est plus lent que les Habitants.
- [US-1043](10-le-bestiaire.md) · Tous les Éclaireurs : la force de l'effet, la même pour toutes ou propre à chaque Espèce (un aigle voit plus loin qu'un pigeon).
- [US-1044](10-le-bestiaire.md) · Tous les Nourriciers : viande ou Végétaux selon l'Espèce.
- [US-1046](10-le-bestiaire.md) · Les Bâtisseurs pendant et après le chantier : si les castors meurent ensuite, la construction terminée continue de fonctionner ou s'arrête.

## [Jalon 11 · S'étendre](11-s-etendre.md)

- [US-1101](11-s-etendre.md) · Débloquer l'Avant-poste : ouvert d'emblée ou par une Recherche de la branche Bâtir ; s'il est verrouillé, il dit quelle Recherche l'ouvre, avec un lien vers elle.
- [US-1104](11-s-etendre.md) · Les Cases qu'on ne peut pas revendiquer : les Cases du Cœur sauvage, revendicables ou non.
- [US-1104](11-s-etendre.md) · Les Cases qu'on ne peut pas revendiquer : les Cases d'eau : côte, lac et rivière revendicables, la mer revendicable ou non.
- [US-1106](11-s-etendre.md) · Annuler un Avant-poste en chantier : les Matériaux rendus : tout, une partie ou rien.
- [US-1107](11-s-etendre.md) · Un coût qui grandit avec le Territoire : un nombre maximal de Cases par Territoire.
- [US-1111](11-s-etendre.md) · Un Territoire d'un seul tenant : ce que devient une partie du Territoire coupée du Foyer par la prise d'une Marche à l'étape 59.
- [US-1112](11-s-etendre.md) · Deux joueurs visent la même Case : deux joueurs peuvent lancer un Avant-poste sur la même Case libre, ou le premier chantier lancé bloque l'autre.
- [US-1112](11-s-etendre.md) · Deux joueurs visent la même Case : si les deux chantiers existent, le premier terminé emporte la Case et l'autre s'arrête ; le perdant récupère ses Matériaux, tout ou partie, et reçoit un récit.
- [US-1114](11-s-etendre.md) · Abandonner une Case : pouvoir abandonner une Case de son Territoire.
- [US-1115](11-s-etendre.md) · Une Bête ou une Expédition sur la Case revendiquée : une Bête sauvage encore présente sur la Case reste jusqu'à la fin de sa durée, ou disparaît aussitôt.
- [US-1115](11-s-etendre.md) · Une Bête ou une Expédition sur la Case revendiquée : l'Expédition d'un autre joueur qui y séjourne finit son séjour normalement, ou rentre aussitôt.
- [US-1116](11-s-etendre.md) · Partir de plus loin : la portée d'exploration se compte depuis le Foyer, ou depuis la Case du Territoire la plus proche de la destination.
- [US-1116](11-s-etendre.md) · Partir de plus loin : les trajets des Expéditions et des Récoltes partent du Foyer, ou de la Case la plus proche.
- [US-1122](11-s-etendre.md) · Débloquer les constructions d'Habitat : les constructions d'Habitat forment la famille Habitats, ouverte par des Recherches ; lesquelles.
- [US-1124](11-s-etendre.md) · La glacière : la glacière ajoute des Places pour la toundra (chiffre à régler) ; pour la banquise aussi.
- [US-1125](11-s-etendre.md) · La volière : la volière ajoute des Places pour un Biome (chiffre à régler) ; lequel.
- [US-1126](11-s-etendre.md) · Une construction d'Habitat pour chaque Biome qui manque : la liste des constructions prévoit une construction d'Habitat pour chaque Biome, ou seulement pour certains.
- [US-1126](11-s-etendre.md) · Une construction d'Habitat pour chaque Biome qui manque : deux constructions d'Habitat différentes ne reproduisent jamais le même Biome.
- [US-1127](11-s-etendre.md) · Les niveaux d'une construction d'Habitat : des Postes dans les constructions d'Habitat.
- [US-1130](11-s-etendre.md) · Les Bêtes déjà là quand la règle arrive : les Bêtes logées au Foyer hors de leur Biome restent en surnombre, ou gardent une Place d'exception.
- [US-1131](11-s-etendre.md) · Une Bête apprivoisée sans Habitat : une Bête apprivoisée d'un Biome où le joueur n'a aucun Habitat le rejoint quand même en surnombre, attend en Réserve, ou repart au sauvage.
- [US-1132](11-s-etendre.md) · Les Couples en Réserve et les Places : la règle de l'étape 35 s'applique : les Bêtes des Couples en Réserve occupent des Places, ou non.
- [US-1134](11-s-etendre.md) · Des Places perdues : quand un Biome perd des Places (Case abandonnée, plus tard Marche prise), les Bêtes déjà là restent en surnombre.
- [US-1135](11-s-etendre.md) · Le Foyer autour de la hutte du chef : la distance se compte en Cases, à vol d'oiseau ou par un chemin à travers le Territoire.
- [US-1136](11-s-etendre.md) · Les Marches au-delà : un moyen d'agrandir le Foyer, niveau de la hutte du chef ou Recherche.

## [Jalon 12 · Les Épreuves](12-les-epreuves.md)

- [US-1201](12-les-epreuves.md) · Décrire les Épreuves dans les données du jeu : la suite décrite dans ce jalon (US-1215 à US-1230) est une première proposition, à valider en jouant.
- [US-1207](12-les-epreuves.md) · Une récompense qui déborde des stocks : la part qui dépasse la limite est perdue ou gardée au-dessus de la limite.
- [US-1212](12-les-epreuves.md) · Une Épreuve déjà accomplie : un objectif qui porte sur une action (une Récolte revenue) compte aussi les actions faites avant l'Épreuve.
- [US-1213](12-les-epreuves.md) · Les chefs installés avant les Épreuves : les récompenses des Épreuves qu'il a ainsi sautées lui sont versées ou non.
- [US-1230](12-les-epreuves.md) · Épreuve 9 « Chacun son Rôle » : affecter une Bête à son Rôle : sa place dans la suite, et ce qu'elle devient tant que le chef n'a aucune Bête à Rôle.
- [US-1221](12-les-epreuves.md) · Épreuve 12 « Des mains en plus » : accueillir un Voyageur : pendant cette Épreuve, un Voyageur arrive à coup sûr aux portes dans un délai court (chiffre à régler).
- [US-1232](12-les-epreuves.md) · Passer les Épreuves : le choix de passer les Épreuves est proposé, comme dans le prototype.

## [Jalon 13 · Le danger sauvage](13-le-danger-sauvage.md)

- [US-1302](13-le-danger-sauvage.md) · Composer une Incursion : les Espèces sont tirées parmi celles des Biomes proches du Territoire visé.
- [US-1302](13-le-danger-sauvage.md) · Composer une Incursion : la force totale d'une Incursion tient compte ou non de la force du Territoire visé.
- [US-1305](13-le-danger-sauvage.md) · Ce que dit l'annonce : ce qu'elle révèle de sa composition (Espèces, nombre, force estimée) dépend de la tour de guet ou non.
- [US-1309](13-le-danger-sauvage.md) · Rentrer à temps pour défendre : le rappel d'une Expédition pour défendre le Foyer est possible ou non.
- [US-1310](13-le-danger-sauvage.md) · Résoudre le combat d'une Incursion : l'issue d'une égalité parfaite de force.
- [US-1313](13-le-danger-sauvage.md) · Une Incursion qui l'emporte : ce que les Bêtes sauvages emportent ou abîment en plus (Nourriture, constructions).
- [US-1315](13-le-danger-sauvage.md) · Le récit d'une Incursion : les Espèces sauvages affrontées s'inscrivent au Bestiaire comme croisées.
- [US-1317](13-le-danger-sauvage.md) · Pas d'Incursion pour les tout nouveaux chefs : aucune Incursion ne vise un chef pendant une durée après sa naissance (chiffre à régler).
- [US-1317](13-le-danger-sauvage.md) · Pas d'Incursion pour les tout nouveaux chefs : les premières Incursions d'un chef sont plus faibles que les suivantes.
- [US-1318](13-le-danger-sauvage.md) · Bâtir une palissade : elle se bâtit au Foyer ; en bâtir sur d'autres Cases du Territoire.
- [US-1319](13-le-danger-sauvage.md) · Creuser des fosses : ce qui distingue les fosses de la palissade dans le combat.
- [US-1322](13-le-danger-sauvage.md) · Les défenses après le combat : elles s'usent au combat et se réparent, ou restent intactes.
- [US-1322](13-le-danger-sauvage.md) · Les défenses après le combat : si elles s'usent, leur force baisse jusqu'à leur remise en état, et le coût de la remise en état s'affiche.
- [US-1324](13-le-danger-sauvage.md) · Les défenses dans le récit : s'il existe une usure des défenses, le récit l'indique.

## [Jalon 14 · Les autres joueurs](14-les-autres-joueurs.md)

- [US-1411](14-les-autres-joueurs.md) · Rappeler une Attaque en chemin : le rappel d'une Attaque pendant l'aller est possible, comme pour une Récolte.
- [US-1414](14-les-autres-joueurs.md) · Piller dans la limite de la charge : le butin total ne dépasse jamais la charge totale des Bêtes survivantes ; la charge des Blessés compte ou non.
- [US-1415](14-les-autres-joueurs.md) · Répartir le butin entre les ressources : le butin se prend selon une règle fixe : à parts égales, en proportion des stocks du chef attaqué, ou au choix de l'attaquant.
- [US-1416](14-les-autres-joueurs.md) · Une part des stocks à l'abri : une part des stocks ne peut jamais être pillée (chiffre à régler).
- [US-1416](14-les-autres-joueurs.md) · Une part des stocks à l'abri : une construction peut augmenter cette part.
- [US-1418](14-les-autres-joueurs.md) · Le retour avec le butin : à leur arrivée, le butin s'ajoute à mes stocks dans la limite de stock ; ce qui dépasse est perdu.
- [US-1422](14-les-autres-joueurs.md) · Le récit du chef attaqué : l'Attaque subie révèle ou non sur ma carte le Territoire de l'attaquant.
- [US-1425](14-les-autres-joueurs.md) · Rien ne passe d'un chef à l'autre hors du butin : une Attaque repoussée ne laisse pas de Viande au chef attaqué, pour qu'on ne puisse pas nourrir un ami en l'attaquant.
- [US-1428](14-les-autres-joueurs.md) · Ce que l'annonce révèle de l'Attaque : l'annonce montre le nombre de Bêtes, leurs Espèces ou une force estimée, selon la tour de guet ou non.
- [US-1429](14-les-autres-joueurs.md) · Le Bouclier des débutants : le Bouclier dure un temps fixe, ou s'arrête aussi selon la progression du chef.
- [US-1432](14-les-autres-joueurs.md) · Attaquer pendant son Bouclier : un débutant sous Bouclier peut attaquer, ou non.
- [US-1432](14-les-autres-joueurs.md) · Attaquer pendant son Bouclier : s'il le peut, lancer une Attaque met fin à son Bouclier, après une confirmation.
- [US-1433](14-les-autres-joueurs.md) · Limiter les Attaques par cible et par jour : une Attaque compte dès son départ, même rappelée ou perdue.
- [US-1433](14-les-autres-joueurs.md) · Limiter les Attaques par cible et par jour : une limite sur le total des Attaques qu'un chef peut subir par jour, tous attaquants confondus, s'ajoute ou non.
- [US-1434](14-les-autres-joueurs.md) · Voir combien d'Attaques il me reste contre une cible : un « jour » est une période glissante de 24 heures ou un jour du calendrier.
- [US-1436](14-les-autres-joueurs.md) · La Case change de main après la victoire : d'autres conditions que la victoire (un nombre de survivants, un Habitant ou un Avant-poste).
- [US-1438](14-les-autres-joueurs.md) · Un Territoire coupé en deux : si la prise coupe mon Territoire, la partie séparée du Foyer redevient libre ou passe à l'attaquant.
- [US-1438](14-les-autres-joueurs.md) · Un Territoire coupé en deux : la carte signale les Cases dont la perte couperait mon Territoire.
- [US-1439](14-les-autres-joueurs.md) · Ce que devient la Case prise : les constructions de la Case passent au vainqueur ou sont détruites.
- [US-1439](14-les-autres-joueurs.md) · Ce que devient la Case prise : si l'ancien propriétaire a désormais plus de Bêtes que de Places, le sort des Bêtes en trop.
- [US-1444](14-les-autres-joueurs.md) · Le classement de la puissance de l'armée : les Blessés comptent ou non.
- [US-1447](14-les-autres-joueurs.md) · Départager les égalités : en cas d'égalité, les chefs partagent le même rang ou sont départagés, par exemple par le premier arrivé au total.

## [Jalon 15 · Le Monde vivant](15-le-monde-vivant.md)

- [US-1501](15-le-monde-vivant.md) · Lancer une Migration : les Raretés possibles pour une Migration : rare seulement, ou aussi peu commune et épique.
- [US-1503](15-le-monde-vivant.md) · Une Migration qui avance : la région se décale chaque jour dans une direction, ou reste fixe pendant toute la Migration.
- [US-1503](15-le-monde-vivant.md) · Une Migration qui avance : le trajet ne passe jamais par le Cœur sauvage.
- [US-1504](15-le-monde-vivant.md) · Être prévenu d'une Migration proche : le message nomme l'Espèce, même si le chef ne l'a jamais croisée, ou la montre en silhouette.
- [US-1505](15-le-monde-vivant.md) · Voir la Migration sur la carte : elle reste visible sous le brouillard, sans en révéler les Cases (Biome, propriétaire).
- [US-1508](15-le-monde-vivant.md) · Faire tourner les Saisons du Monde : le Monde suit un cycle de Saisons, dont l'hiver ; la liste des autres Saisons.
- [US-1511](15-le-monde-vivant.md) · La Saison change les Récoltes : la production continue des Cases change aussi avec la Saison, ou non.
- [US-1514](15-le-monde-vivant.md) · Une Récolte à cheval sur deux Saisons : le rendement se calcule selon le temps passé dans chaque Saison, ou selon la Saison du départ.
- [US-1515](15-le-monde-vivant.md) · La carte aux couleurs de la Saison : la carte et l'illustration du Foyer prennent une teinte propre à chaque Saison, selon ce que permet le chantier des illustrations.
- [US-1516](15-le-monde-vivant.md) · Faire surgir une Apparition : une seule Apparition à la fois par Monde.
- [US-1517](15-le-monde-vivant.md) · Annoncer une Apparition : l'annonce part vers tous les chefs du Monde, ou seulement vers ceux assez proches du Cœur sauvage.
- [US-1517](15-le-monde-vivant.md) · Annoncer une Apparition : elle désigne la Case exacte, ou seulement une région du Cœur sauvage.
- [US-1521](15-le-monde-vivant.md) · Des chances décroissantes pour les suivants : deux victoires au même instant sont départagées selon une règle.
- [US-1523](15-le-monde-vivant.md) · Une seule Bête mythique par Espèce et par chef : il peut quand même l'affronter ; sa victoire prend un rang parmi les vainqueurs, ou non.
- [US-1525](15-le-monde-vivant.md) · Garder sa Bête mythique : un chef qui l'a perdue peut en apprivoiser une autre de la même Espèce lors d'une Apparition suivante.
- [US-1527](15-le-monde-vivant.md) · Le tableau des vainqueurs : la liste reste consultable après la fin de l'Apparition.

## [Jalon 16 · Le confort](16-le-confort.md)

- [US-1601](16-le-confort.md) · Proposer les notifications au bon moment : la proposition n'apparaît jamais à la première visite, mais à un moment où elle a du sens, par exemple à l'approche de la fin du Bouclier des débutants.
- [US-1607](16-le-confort.md) · Être notifié d'une famine imminente : elle n'est pas répétée à chaque heure ; un rappel unique plus proche de la Famine s'ajoute ou non.
- [US-1609](16-le-confort.md) · Régler chaque notification séparément : le choix est gardé d'une visite à l'autre, pour tout le compte ou pour chaque appareil.
- [US-1614](16-le-confort.md) · Quand le Repos est refusé : le Repos est impossible pendant qu'une Attaque ou une Incursion est annoncée contre moi.
- [US-1614](16-le-confort.md) · Quand le Repos est refusé : le Repos est impossible tant qu'une de mes Attaques est en chemin.
- [US-1614](16-le-confort.md) · Quand le Repos est refusé : un délai minimal sépare deux Repos (chiffre à régler).
- [US-1615](16-le-confort.md) · Les sorties en cours au moment du Repos : au moment du Repos, les sorties en cours doivent être rentrées, sont rappelées d'office, ou restent figées là où elles sont.
- [US-1620](16-le-confort.md) · Ce que le chef peut faire pendant le Repos : toute action qui ferait bouger le Territoire (lancer une sortie, construire, élever, changer un Métier) est interdite, ou met fin au Repos après confirmation.
- [US-1621](16-le-confort.md) · Sortir du Repos : le Repos a une durée maximale, au-delà de laquelle il s'arrête de lui-même, ou n'en a pas.
- [US-1623](16-le-confort.md) · Le Monde continue pendant le Repos : les notifications d'Apparition continuent d'arriver pendant le Repos, ou non.
- [US-1626](16-le-confort.md) · Naviguer au pouce entre les écrans : le menu est atteignable avec le pouce, en tenant le téléphone d'une main ; sa forme exacte.
- [US-1633](16-le-confort.md) · Tenir le téléphone en largeur : la tenue en largeur est adaptée, ou simplement tolérée sans casser l'affichage.

## [Jalon 17 · Plus tard](17-plus-tard.md)

- [US-1701](17-plus-tard.md) · Fonder un Clan : les conditions pour fonder un Clan (coût, Recherche, construction).
- [US-1702](17-plus-tard.md) · Rejoindre, quitter et diriger un Clan : on entre dans un Clan sur invitation, sur demande acceptée, ou les deux.
- [US-1702](17-plus-tard.md) · Rejoindre, quitter et diriger un Clan : un délai avant de rejoindre un autre Clan après un départ (chiffre à régler).
- [US-1702](17-plus-tard.md) · Rejoindre, quitter et diriger un Clan : les pouvoirs du fondateur (inviter, exclure, transmettre la direction).
- [US-1703](17-plus-tard.md) · Voir les Bêtes repérées par son Clan : le partage montre seulement la Bête et sa Case, ou lève aussi le brouillard autour.
- [US-1704](17-plus-tard.md) · Envoyer des renforts à un membre : qui paie leur Entretien pendant leur séjour.
- [US-1704](17-plus-tard.md) · Envoyer des renforts à un membre : la durée maximale d'un séjour de renforts (chiffre à régler).
- [US-1705](17-plus-tard.md) · Chasser ensemble une Bête légendaire ou mythique : à qui revient la Bête après une victoire commune : tirage selon la force de chaque escorte, ou autre règle.
- [US-1705](17-plus-tard.md) · Chasser ensemble une Bête légendaire ou mythique : pour une Apparition, la règle d'une Bête mythique au plus par chef et par Espèce reste vraie ; le calcul des chances décroissantes pour une victoire commune.
- [US-1706](17-plus-tard.md) · Pas d'Attaque entre membres d'un Clan : une Attaque contre un membre de son propre Clan est interdite.
- [US-1706](17-plus-tard.md) · Pas d'Attaque entre membres d'un Clan : un délai après avoir quitté un Clan avant de pouvoir attaquer ses anciens membres (chiffre à régler).
- [US-1708](17-plus-tard.md) · Le classement des Clans : l'existence d'un classement des Clans.
- [US-1708](17-plus-tard.md) · Le classement des Clans : s'il existe, il se fonde sur le nombre de Couples réunis par ses membres, comme le classement principal des chefs.
- [US-1709](17-plus-tard.md) · Ajouter un lot de nouvelles Espèces : la taille des lots, leur rythme et leur répartition entre Raretés.
- [US-1711](17-plus-tard.md) · Les récompenses du Bestiaire après un ajout : compléter à nouveau un Biome ou une Rareté après un ajout rapporte une nouvelle récompense, ou non.
- [US-1712](17-plus-tard.md) · Savoir qu'un Monde est plein : le critère de Monde plein : nombre de chefs, Cases libres restantes sur la Couronne, ou les deux.
- [US-1714](17-plus-tard.md) · Arriver dans le bon Monde : un nouveau chef est placé d'office dans le Monde ouvert, ou choisit parmi les Mondes qui accueillent encore.
- [US-1715](17-plus-tard.md) · Jouer dans plusieurs Mondes : un compte peut avoir un chef dans chaque Monde, ou un seul chef en tout.
