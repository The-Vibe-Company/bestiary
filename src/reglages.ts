// Les chiffres réglables du jeu, rassemblés ici. Chaque valeur renvoie à la story qui la fixe.

/**
 * US-0025 : la tâche planifiée passe toutes les heures (planning dans vercel.json) tant que le jeu n'est pas ouvert aux
 * joueurs, pour que la base de production dorme entre deux passages et reste dans le plan gratuit de Neon (décidé le
 * 2026-10-09) ; toutes les 5 minutes à l'ouverture.
 */
export const TACHE_TEMPS_TOUTES_LES_MINUTES = 60;
/** US-0025 : elle rattrape tout élément qui n'a pas été calculé depuis plus de 5 minutes. */
export const RATTRAPER_APRES_MINUTES = 5;
/** US-0025 : elle travaille par lots de cette taille… */
export const TAILLE_LOT = 50;
/** … et s'arrête au bout de ce temps, pour rester sous la durée permise par Vercel. */
export const BUDGET_TACHE_MS = 45_000;
/** US-0029 : les passages de la tâche planifiée restent consultables 7 jours. */
export const JOURNAL_TACHE_JOURS = 7;
/** US-0029 : sans passage depuis ce délai (trois passages manqués), la tâche est signalée en retard. */
export const TACHE_EN_RETARD_MINUTES = 3 * TACHE_TEMPS_TOUTES_LES_MINUTES;
/** US-0105 : un mot de passe compte au moins 12 caractères, sans autre contrainte (longueur plutôt que complexité)… */
export const MOT_DE_PASSE_MIN = 12;
/** … et au plus 128, assez pour une phrase de passe. */
export const MOT_DE_PASSE_MAX = 128;
/** US-0111 : sans réponse du jeu au bout de ce délai, l'inscription prévient qu'il est injoignable. */
export const INSCRIPTION_DELAI_MAX_MS = 15_000;
/** US-0112 : au plus 5 comptes créés en une heure depuis une même connexion. */
export const INSCRIPTIONS_PAR_HEURE_MAX = 5;
/** US-0113 : l'adresse d'où partent les e-mails du jeu (domaine à vérifier chez Resend, voir Zewed/bestia-2#1). */
export const EXPEDITEUR_EMAILS = "Bestia <bonjour@bestia.thevibecompany.co>";
/** US-0113 : au-delà, l'envoi d'un e-mail est abandonné et noté comme raté. */
export const ENVOI_EMAIL_DELAI_MAX_MS = 10_000;
/** US-0114 : un lien de confirmation d'adresse reste valable 24 heures… */
export const LIEN_CONFIRMATION_HEURES = 24;
/** … et on n'en renvoie pas un nouveau plus d'une fois par minute, pour ne pas inonder une boîte. */
export const NOUVEAU_LIEN_ATTENTE_SECONDES = 60;
/** US-0119 : une session dure 30 jours, prolongés à chaque visite… */
export const SESSION_JOURS = 30;
/** … au plus une fois par jour, pour ne pas écrire en base à chaque page. */
export const SESSION_PROLONGEE_APRES_HEURES = 24;
/** US-0118 : après 5 échecs de connexion d'affilée sur une même adresse… */
export const ECHECS_CONNEXION_MAX = 5;
/** … les essais sont bloqués 15 minutes. */
export const BLOCAGE_CONNEXION_MINUTES = 15;
/** US-0126, US-0127 : un lien pour changer de mot de passe reste valable 60 minutes… */
export const LIEN_REINITIALISATION_MINUTES = 60;
/** … et on n'en envoie pas plus d'un par minute pour une même adresse, pour ne pas inonder une boîte. */
export const NOUVELLE_REINITIALISATION_ATTENTE_SECONDES = 60;
/** US-0130 : … ni plus de 5 en une heure. */
export const REINITIALISATIONS_PAR_HEURE_MAX = 5;
/** US-0132 : un nom de chef compte de 3 à 16 caractères, tels qu'on les voit (« É » en vaut un). */
export const NOM_DE_CHEF_MIN = 3;
export const NOM_DE_CHEF_MAX = 16;
/** US-0136 : la disponibilité du nom est cherchée après une demi-seconde sans frappe. */
export const NOM_DE_CHEF_PAUSE_MS = 500;

/**
 * US-0151, US-0402 : le Monde est un grand hexagone de 60 Cases de rayon (valeur provisoire, à régler en
 * jouant) : 60 anneaux autour du Cœur sauvage, 10 981 Cases en tout…
 */
export const MONDE_RAYON = 60;
/**
 * … dont les 6 anneaux extérieurs, les Cases à moins de 6 Cases du bord, forment la Couronne, où naissent
 * les joueurs (US-0152, US-0404 : valeur provisoire, à régler en jouant). Elle peut s'élargir vers
 * l'intérieur, jamais rétrécir : une Case créée reste.
 */
export const COURONNE_ANNEAUX = 6;
/** US-0152, US-0413 : deux Foyers sont toujours à au moins 4 Cases l'un de l'autre (valeur provisoire, à régler en jouant). */
export const ECART_ENTRE_FOYERS = 4;
/** US-0153 : un nouveau chef naît au hasard parmi les 5 emplacements libres les plus proches du dernier arrivé. */
export const NAISSANCE_PARMI_LES_PLUS_PROCHES = 5;
/** US-0159 : sous 10 places de Foyer restantes dans un Monde, chaque naissance donne l'alerte. */
export const ALERTE_PLACES_DE_FOYER = 10;
/**
 * La part de chaque Biome sur la Couronne, en régions d'un seul tenant. La prairie domine : les
 * Foyers n'y naissent que là. L'eau de la Couronne est faite de lacs.
 */
export const BIOMES_DE_LA_COURONNE = { prairie: 0.4, foret: 0.25, montagne: 0.1, savane: 0.1, eau: 0.1, desert: 0.05 } as const;
/** La taille des régions de Biome, en Cases à peu près : plus le nombre est grand, plus elles s'étendent. */
export const TAILLE_DES_REGIONS = 16;

/** US-0206 : à partir de cette quantité, la barre du haut abrège les nombres (123 k, 1,2 M). */
export const ABREGER_A_PARTIR_DE = 100_000;
/** US-0213 : page ouverte, la barre du haut se recale sur les quantités exactes du jeu toutes les 5 minutes. */
export const RECALER_LA_BARRE_MINUTES = 5;
/** US-0216 : après au moins 2 heures d'absence, le Foyer résume ce qu'il a produit entre-temps. */
export const RECAP_ABSENCE_HEURES = 2;
/** US-0227 : à partir de 90 % de sa limite, un Stock se signale comme presque plein. */
export const PRESQUE_PLEIN_POURCENT = 90;

/**
 * US-0316 : chaque Habitant, qu'il ait un Métier ou non, prend 2 Nourriture par heure dans les Stocks
 * (valeur provisoire, à régler en jouant), à parts égales sur la Viande et les Végétaux tant que les
 * deux en ont ; quand l'un est vide, tout l'Entretien est pris sur l'autre.
 */
export const ENTRETIEN_HABITANT_PAR_HEURE = 2;

/**
 * US-0305 : le Foyer offre 5 places d'Habitant (valeur provisoire, à régler en jouant). C'est pour
 * l'instant la seule source de place du Territoire ; les huttes en ajouteront à l'étape 25.
 */
export const PLACES_DU_FOYER = 5;

/**
 * US-0331 : un Voyageur se présente en moyenne toutes les 8 heures de jeu (valeur provisoire, à régler en
 * jouant), à des moments irréguliers : l'écart entre deux arrivées va de la moitié à une fois et demie la
 * moyenne. La base tire la première arrivée d'un Territoire avec la même moyenne (fonction
 * ecart_avant_voyageur) : la changer demande une migration qui la change aussi.
 */
export const VOYAGEUR_TOUTES_LES_HEURES = 8;
/** US-0331 : au plus 3 Voyageurs attendent aux portes en même temps (valeur provisoire, à régler en jouant). */
export const VOYAGEURS_EN_ATTENTE_MAX = 3;

/**
 * US-0333 : un Voyageur attend 12 heures de jeu aux portes avant de repartir (valeur provisoire, à régler en
 * jouant). La tour de guet et la taverne changeront cette durée à l'étape 30.
 */
export const VOYAGEUR_ATTEND_HEURES = 12;
/** US-0333 : sous 60 minutes d'attente restante, son compte à rebours passe dans la couleur d'alerte (valeur provisoire, à régler en jouant). */
export const VOYAGEUR_ALERTE_MINUTES = 60;

/**
 * US-0403 : les Cases à moins de 8 Cases du milieu du Monde (les anneaux 0 à 7, 169 Cases) forment le
 * Cœur sauvage, où aucun Foyer ne naît (valeur provisoire, à régler en jouant). Sa taille est fixée sur la
 * fiche du Monde à sa naissance : la changer ici ne touche pas un Monde déjà né.
 */
export const COEUR_SAUVAGE_RAYON = 8;

/**
 * US-0404 : la Couronne d'un Monde garde assez de terre pour 90 joueurs, chacun son Foyer à au moins
 * ECART_ENTRE_FOYERS Cases des autres (valeur provisoire, à régler en jouant).
 */
export const JOUEURS_PAR_MONDE = 90;

/**
 * US-0321 : l'avertissement « famine imminente » paraît dans la barre du haut quand la Nourriture ne couvre
 * plus que 12 heures d'Entretien (valeur provisoire, à régler en jouant).
 */
export const FAMINE_IMMINENTE_HEURES = 12;

/**
 * US-0406 : dans un Monde généré, chaque Biome de terre forme des régions d'un seul tenant d'au moins 6 Cases
 * (valeur provisoire, à régler en jouant)…
 */
export const REGION_BIOME_MIN_CASES = 6;
/** … et au plus 20 Cases de tout le Monde n'ont aucune voisine de leur Biome (idéalement aucune ; valeur provisoire). */
export const CASES_ISOLEES_MAX = 20;
/** US-0406 : chaque Biome de terre couvre de 4 % à 30 % de la terre d'un Monde généré (valeurs provisoires)… */
export const PART_BIOME_MIN = 0.04;
export const PART_BIOME_MAX = 0.3;
/** … autour de la part visée pour chacun (valeurs provisoires, à régler en jouant). */
export const PARTS_DES_BIOMES = { prairie: 0.2, foret: 0.17, jungle: 0.1, savane: 0.12, desert: 0.1, montagne: 0.11, toundra: 0.12, banquise: 0.08 } as const;

/**
 * US-0407 : les montagnes d'un Monde généré forment des chaînes : chacune au moins 3 fois plus longue que
 * large (valeur provisoire, à régler en jouant). Sa longueur est le plus long chemin de proche en proche
 * qu'on y trouve, sa largeur ses Cases divisées par sa longueur.
 */
export const CHAINE_ALLONGEMENT_MIN = 3;

/**
 * US-0408 : la mer couvre 15 % des Cases d'un Monde généré, à 2 points près (valeur provisoire, à régler en
 * jouant)…
 */
export const MER_PART = 0.15;
/** … en une à trois mers (valeur provisoire)… */
export const MERS_MAX = 3;
/** … chacune d'au moins 300 Cases d'un seul tenant (valeur provisoire). */
export const MER_MIN_CASES = 300;

/**
 * US-0410 : un Monde généré compte 8 lacs à l'intérieur des terres (valeur provisoire, à régler en jouant ;
 * jamais moins de 6 quand la place manque)…
 */
export const LACS_PAR_MONDE = 8;
/** … chacun de 3 à 12 Cases d'un seul tenant (valeurs provisoires). */
export const LAC_MIN_CASES = 3;
export const LAC_MAX_CASES = 12;

/**
 * US-0411 : un Monde généré compte 12 rivières (valeur provisoire, à régler en jouant ; jamais moins de 8
 * quand la place manque)…
 */
export const RIVIERES_PAR_MONDE = 12;
/** … chacune coulant seule au moins 5 Cases depuis sa source, avant de finir ou d'en rejoindre une autre (valeur provisoire). */
export const RIVIERE_MIN_CASES = 5;

/**
 * US-0342 : l'historique des Voyageurs montre ceux dont le sort est tombé dans les 7 derniers jours de jeu
 * (valeur provisoire, à régler en jouant).
 */
export const HISTORIQUE_VOYAGEURS_JOURS = 7;

/**
 * US-0413 : la Couronne d'un Monde généré garde 24 poches de prairie, régulièrement réparties sur tout son
 * tour, où naissent les joueurs (valeur provisoire, à régler en jouant)…
 */
export const POCHES_DE_PRAIRIE = 24;
/** … chacune de 40 Cases d'un seul tenant (valeur provisoire). Elles comptent dans la part de la prairie. */
export const POCHE_DE_PRAIRIE_CASES = 40;

/**
 * US-0323 : une fois paru, l'avertissement « famine imminente » ne disparaît que quand la Nourriture est assurée
 * ou qu'elle couvre plus de FAMINE_IMMINENTE_HEURES + 1 heures d'Entretien (valeur provisoire, à régler en
 * jouant) : entre 12 et 13 heures, il garde son état, pour ne pas apparaître et disparaître sans cesse au seuil.
 */
export const FAMINE_IMMINENTE_MARGE_HEURES = 1;

/**
 * US-0420 : on fait glisser la carte du Monde jusqu'à ce que le milieu de l'écran soit à 2 Cases au-delà de la
 * Case la plus éloignée du centre, pas plus loin : on ne perd jamais la carte de vue (valeur provisoire, à régler
 * en jouant).
 */
export const CARTE_DEBORD_CASES = 2;
/** US-0422 : chaque flèche du clavier déplace la carte de 3 Cases (valeur provisoire, à régler en jouant). */
export const CARTE_PAS_CLAVIER_CASES = 3;
/**
 * US-0423 : le zoom de la carte va d'une vue large, où la moitié de sa plus petite dimension à l'écran couvre
 * 40 Cases, à une vue rapprochée où elle n'en couvre que 4 (valeurs provisoires, à régler en jouant).
 */
export const CARTE_ZOOM_LARGE_CASES = 40;
export const CARTE_ZOOM_PROCHE_CASES = 4;
/** US-0425 : chaque appui sur « + » ou « − » zoome la carte d'un cran : ses Cases une fois et demie plus grandes, ou plus petites. */
export const CARTE_CRAN_DE_ZOOM = 1.5;

/**
 * US-0434 : la carte du Monde est utilisable en moins de 3 secondes sur une connexion mobile ordinaire (valeur
 * provisoire, à régler en jouant), mesurée sur le profil « Slow 4G » de Chrome : 150 ms d'aller-retour, 1,6 Mb/s.
 */
export const CARTE_UTILISABLE_SECONDES = 3;

/** US-0426 : le retour de la carte sur le Foyer glisse en 300 ms, en douceur (valeur provisoire, à régler en jouant). */
export const CARTE_RETOUR_AU_FOYER_MS = 300;

/**
 * US-0436 : au départ, un joueur ne découvre que les abords de son Foyer : les Cases à 4 Cases de lui ou moins
 * (valeur provisoire, à régler en jouant). Toutes les autres restent sous le brouillard. La migration 0045 a
 * découvert ceux des Territoires déjà nés avec la même valeur : la changer ne change que les naissances à venir.
 */
export const ABORDS_DU_FOYER_CASES = 4;

/**
 * US-0428 : un appui sur la carte relâché sans avoir bougé de 4 pixels à la souris (ou au stylet), de 8 au doigt, qui
 * bouge davantage en se posant, est un toucher : il ouvre la fiche de la Case. Au-delà, c'est un glissement (US-0420,
 * US-0421), qui n'en ouvre pas (valeurs provisoires, à régler en jouant).
 */
export const CARTE_TOUCHER_PIXELS = { souris: 4, doigt: 8 };
/**
 * US-0431 : sur mobile, la fiche d'une Case qu'on fait glisser vers le bas de plus de 60 pixels se ferme ; en deçà,
 * elle revient (valeur provisoire, à régler en jouant).
 */
export const CARTE_FICHE_FERMETURE_PIXELS = 60;

/**
 * US-0442 : la carte ouverte demande au serveur les Cases découvertes depuis sa lecture toutes les 60 secondes tant
 * que l'onglet est visible, et dès qu'il le redevient (valeur provisoire, à régler en jouant).
 */
export const CARTE_DECOUVERTES_SECONDES = 60;

/**
 * US-0923 : chaque Monde se partage en 6 Anneaux (valeur provisoire, à régler en jouant), de la Couronne, l'Anneau 1, au
 * Cœur sauvage, l'Anneau 6 ; les anneaux de Cases entre les deux se répartissent sur les autres (src/monde/anneaux.ts).
 * Rien n'en est gardé en base : la changer change les Anneaux de tous les Mondes, déjà nés compris.
 */
export const ANNEAUX_DU_MONDE = 6;

/**
 * US-0925 : chaque Case hors des Territoires voit apparaître en moyenne 1 Bête sauvage par jour du jeu (valeur provisoire,
 * à régler en jouant), à des moments au hasard et indépendants : plusieurs peuvent s'y trouver en même temps. La changer
 * change toutes les apparitions qu'aucune Expédition n'a encore vues, passées comme à venir.
 */
export const APPARITIONS_PAR_CASE_PAR_JOUR = 1;

/**
 * US-0926 : une Bête sauvage reste 6 heures de jeu sur sa Case (valeur provisoire, à régler en jouant), quelle que soit
 * sa Rareté, puis disparaît pour toujours ; plus tôt si elle suit une Expédition.
 */
export const PRESENCE_D_UNE_BETE_HEURES = 6;

/**
 * US-0906 : le séjour d'une Expédition sur sa Case se choisit de 30 minutes à 24 heures de jeu, par pas de 30 minutes
 * (valeurs provisoires, à régler en jouant). Il ne commence qu'à l'arrivée : le trajet ne le raccourcit pas.
 */
export const SEJOUR_MINUTES = { min: 30, max: 24 * 60, pas: 30 };
/** US-0906 : les durées de séjour toutes prêtes, qui se choisissent d'un doigt sur mobile : 1 h, 4 h, 8 h et 12 h (décidées le 2026-10-08). */
export const SEJOURS_TOUT_PRETS_MINUTES = [60, 4 * 60, 8 * 60, 12 * 60];

/**
 * US-0908 : la portée d'exploration de départ : la destination d'une Expédition est à 8 Cases du Foyer au plus (valeur
 * provisoire, à régler en jouant), comptées par `distance` (src/monde/hex.ts) ; au-delà des abords découverts à la
 * naissance (ABORDS_DU_FOYER_CASES). Des Recherches de la branche Explorer l'agrandiront (US-0731, jalon 7).
 */
export const PORTEE_D_EXPLORATION_CASES = 8;

/**
 * US-0909 : sans escorte, une Expédition avance au pas des explorateurs : 20 minutes de jeu par Case (valeur provisoire,
 * à régler en jouant). La durée du trajet (US-0912) en tire l'aller et le retour (src/expeditions/allure.ts).
 */
export const PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE = 20;

/**
 * US-0931 : la simulation des Raretés de la page de contrôle fait apparaître les Bêtes sauvages d'un Monde pendant 30
 * jours de jeu (valeur provisoire, à régler en jouant), et échoue dès que, dans un Anneau, la part obtenue d'une Rareté
 * s'écarte de plus de 1 point de pourcentage de sa part attendue (valeur provisoire, à régler en jouant).
 */
export const SIMULATION_DES_RARETES_JOURS = 30;
export const SIMULATION_DES_RARETES_TOLERANCE_POINTS = 1;

/**
 * US-0975 : à la naissance d'un Foyer, 3 Bêtes sauvages communes (valeur provisoire, à régler en jouant) se posent sur des
 * Cases libres à portée d'exploration de départ (PORTEE_D_EXPLORATION_CASES), une par Case, réservées au nouveau chef…
 */
export const BETES_DE_NAISSANCE = 3;
/**
 * … et y restent 48 heures de jeu (valeur provisoire, à régler en jouant), bien plus qu'une apparition ordinaire
 * (PRESENCE_D_UNE_BETE_HEURES) : assez pour qu'une première Expédition sans escorte les trouve.
 */
export const PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES = 48;

/**
 * US-0912 : le pas des explorateurs (PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE) est celui d'une marche à 5 km/h (valeur
 * provisoire, à régler en jouant), à laquelle se compare la vitesse réelle de chaque Espèce de l'escorte : une Bête de
 * v km/h, plus lente, met 20 × 5 / v minutes de jeu à passer une Case (src/expeditions/allure.ts).
 */
export const MARCHE_DES_EXPLORATEURS_KMH = 5;

/**
 * US-0914 : là où passe une Expédition, le brouillard se lève à son passage sur 1 Case autour de chaque Case de son chemin,
 * et à son arrivée sur 2 Cases autour de sa destination (valeurs provisoires, à régler en jouant). Les Éclaireurs les
 * agrandiront (US-0969).
 */
export const BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES = 1;
export const BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES = 2;

/**
 * US-0937 : sur une longue simulation de 10 000 Apprivoisements (valeur provisoire, à régler en jouant), mâles et femelles
 * sont à parts égales : la part des mâles s'écarte au plus de 2 points de pourcentage de la moitié (valeur provisoire, à
 * régler en jouant).
 */
export const SIMULATION_DES_SEXES_APPRIVOISEMENTS = 10_000;
export const SIMULATION_DES_SEXES_TOLERANCE_POINTS = 2;

/**
 * US-0943 : tant qu'une Bête trop forte pour l'escorte et l'Expédition qui la voit sont sur la même Case, la Bête a 10 %
 * de chance (valeur provisoire, à régler en jouant) d'attaquer l'Expédition par heure passée ensemble ; doublée pour un
 * carnivore, divisée par deux pour un herbivore, telle quelle pour un omnivore (src/expeditions/attaque.ts).
 */
export const CHANCE_D_ATTAQUE_PAR_HEURE = 0.1;
