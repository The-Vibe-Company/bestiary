// La structure de la base. Chaque table arrive avec la story qui en a besoin ;
// tout changement passe par une migration :
//   npm run db:generate   écrit la migration à partir de ce fichier
//   npm run db:migrate    l'applique
import { type AnyPgColumn, bigint, boolean, check, doublePrecision, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Un Monde : il naît une fois et ne se réinitialise jamais (la base refuse de l'effacer). */
export const monde = pgTable(
  "monde",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nom: text("nom").notNull().unique(),
    neLe: timestamp("ne_le", { withTimezone: true }).notNull().defaultNow(),
    /** Le marque-page du temps : l'instant jusqu'auquel le Monde a été calculé. Il ne recule jamais. */
    calculeJusquA: timestamp("calcule_jusqu_a", { withTimezone: true }).notNull().defaultNow(),
    /** US-0151 : sa taille en anneaux, et combien d'anneaux extérieurs forment sa Couronne. Fixées à la préparation de la Couronne, elles ne changent plus. */
    rayon: integer("rayon"),
    anneauxCouronne: integer("anneaux_couronne"),
    /**
     * US-0401 : la graine dont toutes ses Cases sont tirées, un entier de 0 à 2³² − 1 : la même graine
     * redonne le même Monde. Un Monde né sans graine reçoit à la préparation de sa Couronne celle qu'il
     * avait déjà, tirée de son nom.
     */
    graine: bigint("graine", { mode: "number" }),
    /**
     * US-0403 : la taille de son Cœur sauvage : les Cases à moins de `rayon_coeur` Cases du milieu.
     * Fixée à sa naissance (ou à la préparation de sa Couronne), elle ne change plus.
     */
    rayonCoeur: integer("rayon_coeur"),
    /**
     * US-0414 : quand il a été ouvert aux joueurs ; null tant qu'il ne l'a pas été. Le Monde du jeu est le Monde
     * ouvert et pas encore fermé, un seul à la fois : là naissent les chefs. Aube l'est depuis sa naissance ; une
     * bascule (npm run monde:basculer) en ouvre un autre, généré en entier, et ferme l'ancien.
     */
    ouvertLe: timestamp("ouvert_le", { withTimezone: true }),
    /** US-0414 : quand une bascule l'a fermé : plus personne n'y naît. Un Monde fermé ne rouvre pas. */
    fermeLe: timestamp("ferme_le", { withTimezone: true }),
  },
  (t) => [
    check("monde_graine_sur_32_bits", sql`${t.graine} between 0 and 4294967295`),
    uniqueIndex("monde_un_seul_ouvert")
      .on(sql`(true)`)
      .where(sql`${t.ouvertLe} is not null and ${t.fermeLe} is null`),
  ],
);

/**
 * Un événement daté qui touche un élément du jeu (une Attaque qui arrive, une Bête qui guérit…).
 * Le temps qui avance le traite à son instant exact, dans l'ordre des dates, une seule fois.
 */
export const evenement = pgTable(
  "evenement",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    element: text("element").notNull(),
    elementId: integer("element_id").notNull(),
    survientLe: timestamp("survient_le", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    donnees: jsonb("donnees").notNull().default({}),
    traiteLe: timestamp("traite_le", { withTimezone: true }),
  },
  (t) => [index("evenement_a_traiter").on(t.element, t.elementId, t.survientLe)],
);

/** La trace de chaque passage de la tâche planifiée (US-0029), gardée 7 jours. */
export const passageTache = pgTable("passage_tache", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  debut: timestamp("debut", { withTimezone: true }).notNull(),
  dureeMs: integer("duree_ms").notNull(),
  rattrapes: integer("rattrapes").notNull(),
  echecs: integer("echecs").notNull(),
  restants: integer("restants").notNull(),
  erreurs: jsonb("erreurs").notNull().default([]),
});

/**
 * La vitesse du temps du jeu et son point d'ancrage (US-0030), une seule ligne. À chaque
 * changement de vitesse, l'ancre passe à l'heure du jeu du moment : elle ne recule jamais.
 * La production ne la lit pas : son temps passe toujours à vitesse normale.
 */
export const horloge = pgTable(
  "horloge",
  {
    id: integer("id").primaryKey().default(1),
    facteur: doublePrecision("facteur").notNull().default(1),
    reelAncre: timestamp("reel_ancre", { withTimezone: true }).notNull(),
    jeuAncre: timestamp("jeu_ancre", { withTimezone: true }).notNull(),
  },
  (t) => [check("horloge_une_seule_ligne", sql`${t.id} = 1`), check("horloge_facteur_positif", sql`${t.facteur} > 0`)],
);

/** Un Biome : le milieu naturel d'une Case. Son identifiant ne change plus une fois choisi. */
export const biome = pgTable("biome", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  ordre: integer("ordre").notNull(),
});

/** Une variante de Biome : l'eau se décline en côte, lac, rivière et mer, toutes de même Biome. */
export const varianteBiome = pgTable("variante_biome", {
  id: text("id").primaryKey(),
  biomeId: text("biome_id")
    .notNull()
    .references(() => biome.id),
  nom: text("nom").notNull(),
  ordre: integer("ordre").notNull(),
});

/**
 * Une Rareté : le rang d'une Espèce, qui dit à la fois sa puissance et la difficulté à la
 * trouver. Le rang permet de comparer deux Raretés ; les mythiques ne s'élèvent pas.
 */
export const rarete = pgTable("rarete", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  rang: integer("rang").notNull().unique(),
  selevent: boolean("s_elevent").notNull(),
});

/** Un Rôle : un usage particulier qu'ont certaines Espèces en plus du combat. */
export const role = pgTable("role", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  phrase: text("phrase").notNull(),
  ordre: integer("ordre").notNull(),
});

export const regime = pgEnum("regime", ["carnivore", "herbivore", "omnivore"]);

export const familleDeRessource = pgEnum("famille_de_ressource", ["nourriture", "materiaux"]);

/**
 * Une Ressource (US-0201) : la Viande et les Végétaux sont de la Nourriture, le Bois et la Pierre
 * des Matériaux. L'ordre est celui de l'affichage.
 */
export const ressource = pgTable(
  "ressource",
  {
    id: text("id").primaryKey(),
    nom: text("nom").notNull(),
    famille: familleDeRessource("famille").notNull(),
    ordre: integer("ordre").notNull(),
    /** US-0202 : ce que reçoit un Territoire à sa naissance. */
    auDepart: numeric("au_depart", { precision: 24, scale: 6 }).notNull().default("0"),
    /** US-0220 : la limite du Stock d'un Territoire à sa naissance ; les constructions de stockage la relèveront. */
    limiteAuDepart: numeric("limite_au_depart", { precision: 24, scale: 6 }).notNull().default("0"),
  },
  (t) => [check("ressource_au_depart_positif", sql`${t.auDepart} >= 0`), check("ressource_limite_positive", sql`${t.limiteAuDepart} > 0`)],
);

/**
 * US-0209 : ce qu'une Case d'un Biome produit par heure de chaque Ressource, réglé dans
 * donnees/biomes.yaml. Le Foyer produit comme une Case ordinaire de son Biome.
 */
export const productionBiome = pgTable(
  "production_biome",
  {
    biomeId: text("biome_id")
      .notNull()
      .references(() => biome.id),
    ressourceId: text("ressource_id")
      .notNull()
      .references(() => ressource.id),
    parHeure: numeric("par_heure", { precision: 24, scale: 6 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.biomeId, t.ressourceId] }), check("production_jamais_negative", sql`${t.parHeure} >= 0`)],
);

/**
 * Une Espèce : la fiche commune à toutes ses Bêtes, qui sont identiques. Ses chiffres
 * sont calqués sur l'animal réel (la source peut être notée).
 */
export const espece = pgTable(
  "espece",
  {
    id: text("id").primaryKey(),
    nom: text("nom").notNull(),
    attaque: doublePrecision("attaque").notNull(),
    vie: doublePrecision("vie").notNull(),
    vitesse: doublePrecision("vitesse").notNull(),
    charge: doublePrecision("charge").notNull(),
    /** Le nombre de Places qu'une Bête occupe dans un Habitat. */
    taille: doublePrecision("taille").notNull(),
    regime: regime("regime").notNull(),
    /** La Nourriture qu'une Bête consomme chaque heure. */
    entretienParHeure: doublePrecision("entretien_par_heure").notNull(),
    biomeId: text("biome_id")
      .notNull()
      .references(() => biome.id),
    rareteId: text("rarete_id")
      .notNull()
      .references(() => rarete.id),
    /** Au plus un Rôle, ou aucun. */
    roleId: text("role_id").references(() => role.id),
    /** Les mesures réelles d'où le barème tire les caractéristiques (ADR 0007). */
    masseG: doublePrecision("masse_g"),
    facteurArme: doublePrecision("facteur_arme"),
    illustration: text("illustration"),
    source: text("source"),
  },
  (t) => [
    check("espece_attaque_positive", sql`${t.attaque} >= 0`),
    check("espece_vie_positive", sql`${t.vie} > 0`),
    check("espece_vitesse_positive", sql`${t.vitesse} > 0`),
    check("espece_charge_positive", sql`${t.charge} >= 0`),
    check("espece_taille_positive", sql`${t.taille} > 0`),
    check("espece_entretien_positif", sql`${t.entretienParHeure} >= 0`),
  ],
);

/**
 * Les Espèces autrefois proposées comme Couple de départ. Plus lue depuis le retrait du Couple de
 * départ (ADR 0008), mais gardée : une table ne se supprime pas.
 */
export const coupleDeDepart = pgTable("couple_de_depart", {
  especeId: text("espece_id")
    .primaryKey()
    .references(() => espece.id),
  ordre: integer("ordre").notNull().unique(),
  style: text("style").notNull(),
  phrase: text("phrase").notNull(),
});

/**
 * Un compte : son adresse e-mail et l'empreinte de son mot de passe (US-0107), jamais le mot
 * de passe lui-même. La base refuse une adresse avec des majuscules ou des espaces (US-0104) : elle est
 * toujours enregistrée sous sa forme normale, donc deux écritures d'une même adresse
 * tombent sur le même compte, et l'unicité vaut sans tenir compte des majuscules.
 */
export const compte = pgTable(
  "compte",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull().unique(),
    /** L'empreinte scrypt du mot de passe (src/comptes/empreinte.ts). */
    empreinteMotDePasse: text("empreinte_mot_de_passe").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    /** US-0114 : quand l'adresse a été confirmée, ou null tant qu'elle ne l'est pas. */
    emailConfirmeLe: timestamp("email_confirme_le", { withTimezone: true }),
    /** US-0116 : la dernière connexion, ou null avant la première. */
    derniereConnexionLe: timestamp("derniere_connexion_le", { withTimezone: true }),
  },
  (t) => [
    check("compte_email_normalise", sql`${t.email} = lower(${t.email}) and ${t.email} !~ '[[:space:]]'`),
    // Garde-fou : rien d'autre qu'une empreinte ne peut entrer, jamais un mot de passe en clair.
    check("compte_empreinte_scrypt", sql`${t.empreinteMotDePasse} ~ '^scrypt\\$[0-9]+\\$[0-9]+\\$[0-9]+\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$'`),
  ],
);

/**
 * Les inscriptions de la dernière heure, par empreinte de connexion (US-0112), pour freiner
 * les inscriptions en rafale. Jamais l'adresse réseau elle-même ; une ligne vit une heure.
 */
export const inscriptionRecente = pgTable(
  "inscription_recente",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    empreinteReseau: text("empreinte_reseau").notNull(),
    le: timestamp("le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inscription_recente_par_connexion").on(t.empreinteReseau, t.le)],
);

/**
 * Un lien de confirmation d'adresse (US-0114) : à usage unique, valable un temps limité. Le
 * jeton du lien n'est jamais gardé, seulement son empreinte.
 */
export const lienConfirmation = pgTable(
  "lien_confirmation",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    compteId: integer("compte_id")
      .notNull()
      .references(() => compte.id, { onDelete: "cascade" }),
    empreinteJeton: text("empreinte_jeton").notNull().unique(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseLe: timestamp("utilise_le", { withTimezone: true }),
  },
  (t) => [index("lien_confirmation_par_compte").on(t.compteId, t.creeLe)],
);

/**
 * Une session (US-0116) : ce qui garde un joueur connecté. Le navigateur garde un jeton tiré
 * au hasard dans un cookie ; la base n'en garde que l'empreinte.
 */
export const session = pgTable(
  "session",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    compteId: integer("compte_id")
      .notNull()
      .references(() => compte.id, { onDelete: "cascade" }),
    empreinteJeton: text("empreinte_jeton").notNull().unique(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  },
  (t) => [index("session_par_compte").on(t.compteId)],
);

/**
 * Les échecs de connexion récents par adresse essayée (US-0118), pour freiner les essais de
 * mot de passe à répétition. L'adresse n'est gardée que sous son empreinte chiffrée ; une ligne
 * s'efface au premier succès, ou un jour après le dernier échec.
 */
export const echecConnexion = pgTable("echec_connexion", {
  empreinteAdresse: text("empreinte_adresse").primaryKey(),
  echecs: integer("echecs").notNull(),
  dernierEchec: timestamp("dernier_echec", { withTimezone: true }).notNull().defaultNow(),
  bloqueJusqua: timestamp("bloque_jusqua", { withTimezone: true }),
});

/**
 * Un lien pour changer de mot de passe (US-0126) : à usage unique, valable peu de temps. Le jeton
 * du lien n'est jamais gardé, seulement son empreinte.
 */
export const lienReinitialisation = pgTable(
  "lien_reinitialisation",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    compteId: integer("compte_id")
      .notNull()
      .references(() => compte.id, { onDelete: "cascade" }),
    empreinteJeton: text("empreinte_jeton").notNull().unique(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseLe: timestamp("utilise_le", { withTimezone: true }),
  },
  (t) => [index("lien_reinitialisation_par_compte").on(t.compteId, t.creeLe)],
);

/**
 * Le Chef d'un compte dans un Monde (US-0131), sous le nom que voient les autres joueurs. Un
 * compte a au plus un Chef par Monde ; tant qu'il n'en a pas, il ne peut que choisir son nom. Deux
 * Chefs d'un même Monde ne portent jamais des noms jugés identiques (US-0135).
 */
export const chef = pgTable(
  "chef",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    compteId: integer("compte_id")
      .notNull()
      .references(() => compte.id, { onDelete: "cascade" }),
    mondeId: integer("monde_id")
      .notNull()
      .references(() => monde.id),
    /** Le nom tel que le joueur l'a choisi, majuscules comprises. */
    nom: text("nom").notNull(),
    /** US-0135 : sa forme de comparaison (src/chefs/nom.ts, cleDuNom), unique dans le Monde. */
    cleNom: text("cle_nom").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("chef_un_par_monde").on(t.compteId, t.mondeId),
    unique("chef_nom_unique_dans_le_monde").on(t.mondeId, t.cleNom),
    check("chef_cle_nom_a_plat", sql`${t.cleNom} ~ '^[a-z0-9]+$'`),
  ],
);

/**
 * Les mots interdits dans un nom de chef (US-0138), sous leur forme de comparaison (minuscules,
 * sans accents ni signes). Un mot « entier » n'est refusé que seul, pas caché dans un autre mot
 * (« con » refuse « Le Con », pas « Faucon ») ; les autres sont refusés où qu'ils soient. La liste
 * se modifie directement en base, sans nouvelle version du jeu.
 */
export const motInterdit = pgTable(
  "mot_interdit",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    mot: text("mot").notNull().unique(),
    entier: boolean("entier").notNull().default(false),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("mot_interdit_a_plat", sql`${t.mot} ~ '^[a-z0-9]+$'`)],
);

/**
 * Une Case du Monde (US-0151) : un hexagone repéré par (q, r), le Cœur sauvage en (0, 0), avec son
 * Biome. Une Case créée ne change plus de Biome : la génération du reste du Monde ne fait qu'ajouter
 * les Cases qui manquent.
 */
export const caseDuMonde = pgTable(
  "case_du_monde",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    mondeId: integer("monde_id")
      .notNull()
      .references(() => monde.id),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    /** La distance au Cœur sauvage, en Cases. */
    anneau: integer("anneau").notNull(),
    /** Si la Case fait partie de la Couronne, où naissent les joueurs. */
    couronne: boolean("couronne").notNull(),
    /** US-0403 : si la Case fait partie du Cœur sauvage, au milieu du Monde, où aucun Foyer ne naît. */
    coeur: boolean("coeur").notNull().default(false),
    /**
     * US-0405 : sa distance au Cœur sauvage, en Cases (eloignementDuCoeur, src/monde/hex.ts) : 0 pour les
     * siennes. Elle se déduit de l'anneau et de la taille du Cœur, fixée sur la fiche du Monde.
     */
    eloignement: integer("eloignement").notNull(),
    biomeId: text("biome_id")
      .notNull()
      .references(() => biome.id),
    varianteId: text("variante_id").references(() => varianteBiome.id),
    /** US-0153 : le chef à qui la Case appartient, un seul ; null tant qu'elle est libre. */
    chefId: integer("chef_id").references(() => chef.id, { onDelete: "set null" }),
    /** US-0155 : la Case ne peut pas être prise par un autre joueur (un Foyer). La règle joue à l'étape 59. */
    imprenable: boolean("imprenable").notNull().default(false),
  },
  (t) => [
    unique("case_unique_dans_le_monde").on(t.mondeId, t.q, t.r),
    index("case_par_anneau").on(t.mondeId, t.anneau),
    index("case_par_chef").on(t.chefId),
    // US-0402 : la même formule que distance (src/monde/hex.ts), la seule mesure des distances du jeu, ici pour vérifier l'anneau.
    check("case_anneau_exact", sql`${t.anneau} = greatest(abs(${t.q}), abs(${t.r}), abs(${t.q} + ${t.r}))`),
    // US-0405 : les Cases du Cœur sauvage sont à 0 de lui, et seulement elles.
    check("case_coeur_a_zero", sql`${t.eloignement} >= 0 and ${t.coeur} = (${t.eloignement} = 0)`),
  ],
);

/**
 * Le Territoire d'un chef (US-0155) : l'ensemble de ses Cases, d'un seul tenant, autour de son
 * Foyer. Ses Cases sont celles qui portent son chef ; il naît avec une seule, son Foyer.
 */
export const territoire = pgTable("territoire", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id")
    .notNull()
    .unique()
    .references(() => chef.id, { onDelete: "cascade" }),
  /** La Case du Foyer, autour de la hutte du chef. */
  foyerCaseId: integer("foyer_case_id")
    .notNull()
    .unique()
    .references(() => caseDuMonde.id),
  neLe: timestamp("ne_le", { withTimezone: true }).notNull().defaultNow(),
  /** US-0156 : le marque-page du temps, réglé sur sa naissance ; il ne recule jamais. */
  calculeJusquA: timestamp("calcule_jusqu_a", { withTimezone: true }).notNull().defaultNow(),
  /** US-0158 : quand le récit d'arrivée a été montré ; null tant qu'il ne l'a pas été. Il ne l'est qu'une fois. */
  recitLuLe: timestamp("recit_lu_le", { withTimezone: true }),
  /** US-0216 : la dernière fois que le joueur avait une page du jeu ouverte ; null avant sa première visite notée. */
  vuLe: timestamp("vu_le", { withTimezone: true }),
  /**
   * US-0322 : l'instant exact du jeu où la famine est devenue imminente, la Nourriture ne couvrant plus que
   * FAMINE_IMMINENTE_HEURES heures d'Entretien ; null tant qu'elle ne l'est pas. Le mécanisme du temps le tient à jour.
   */
  famineImminenteDepuis: timestamp("famine_imminente_depuis", { withTimezone: true }),
  /**
   * US-0325 : l'instant exact du jeu où la Famine a commencé, la Nourriture ne suffisant plus à payer l'Entretien ;
   * null hors Famine. Le mécanisme du temps le tient à jour, comme famineImminenteDepuis.
   */
  famineDepuis: timestamp("famine_depuis", { withTimezone: true }),
  /**
   * US-0975 : l'instant du jeu où ses Bêtes de naissance se sont posées autour de son Foyer (table bete_de_naissance) ;
   * null tant qu'il ne les a pas reçues : un chef né avant cette story les reçoit à son retour, une seule fois.
   */
  betesDeNaissanceLe: timestamp("betes_de_naissance_le", { withTimezone: true }),
});

/**
 * Le Stock d'une Ressource dans un Territoire (US-0201). Chaque Territoire en a un par Ressource,
 * créé par la base à sa naissance avec la quantité de départ de la Ressource (US-0202). La quantité garde ses fractions au millionième, sans arrondi
 * flottant, et la base la refuse négative.
 */
export const stock = pgTable(
  "stock",
  {
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    ressourceId: text("ressource_id")
      .notNull()
      .references(() => ressource.id),
    quantite: numeric("quantite", { precision: 24, scale: 6 }).notNull().default("0"),
    /** US-0216 : ce que le Territoire a produit de cette Ressource depuis la dernière visite du joueur. */
    produitDepuisVisite: numeric("produit_depuis_visite", { precision: 24, scale: 6 }).notNull().default("0"),
    /**
     * US-0219 : la part de production pas encore assez grande pour un millionième, gardée exacte
     * (en unités × microsecondes par heure, de 0 à 3 600) pour le calcul suivant : rien ne se perd.
     */
    reste: numeric("reste", { precision: 30, scale: 6 }).notNull().default("0"),
    /** US-0220 : la limite de ce Stock, propre au Territoire, pour que ses constructions la relèvent (étape 28). */
    limite: numeric("limite", { precision: 24, scale: 6 }).notNull(),
    /** US-0228 : l'instant du jeu où le Stock a atteint sa limite ; null tant qu'il est en dessous. */
    pleinDepuis: timestamp("plein_depuis", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.territoireId, t.ressourceId] }), check("stock_jamais_negatif", sql`${t.quantite} >= 0`)],
);

/**
 * Un Habitant (US-0301) : un humain du Territoire, qui ne combat jamais et exerce un Métier (null tant
 * qu'il n'en a pas ; US-0307 : l'un de la table metier). Chaque Territoire en reçoit trois à sa naissance,
 * donnés par la base, chacun avec un prénom tiré au hasard (US-0303).
 */
export const habitant = pgTable(
  "habitant",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    metier: text("metier").references(() => metier.id),
    arriveLe: timestamp("arrive_le", { withTimezone: true }).notNull().defaultNow(),
    /** US-0303 : tiré au hasard dans la table prenom à son arrivée, puis le sien pour toujours. */
    prenom: text("prenom").notNull(),
    /**
     * US-0911 : l'Expédition où l'explorateur est parti ; null tant qu'il est au Foyer. Posée sur sa ligne même, pour
     * qu'un changement de Métier ou un renvoi envoyé au même instant que le départ la voie.
     */
    expeditionId: integer("expedition_id").references((): AnyPgColumn => expedition.id, { onDelete: "set null" }),
  },
  (t) => [index("habitant_par_territoire").on(t.territoireId), index("habitant_par_expedition").on(t.expeditionId)],
);

/** US-0303 : les prénoms que peuvent recevoir les Habitants, réglés dans donnees/prenoms.yaml. */
export const prenom = pgTable("prenom", {
  nom: text("nom").primaryKey(),
  ordre: integer("ordre").notNull(),
});

/**
 * Un Métier (US-0307) : ce qu'un Habitant fait pour le Territoire, réglé dans donnees/metiers.yaml avec la
 * phrase qui dit à quoi il sert. `servira` dit ce qu'il attend pour servir ; null quand il sert.
 */
export const metier = pgTable("metier", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  phrase: text("phrase").notNull(),
  servira: text("servira"),
  ordre: integer("ordre").notNull(),
});

/**
 * Un Récit (US-0324) : le compte rendu daté d'un événement du Territoire (retour d'une Récolte ou d'une
 * Expédition, Attaque, Incursion, Famine), que le joueur lit après coup sur la page Récits. Les
 * événements l'écrivent par ecrireUnRecit (src/monde/recits.ts).
 */
export const recit = pgTable(
  "recit",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    texte: text("texte").notNull(),
    /** L'heure du jeu où l'événement est survenu. */
    survenuLe: timestamp("survenu_le", { withTimezone: true }).notNull(),
    /** L'heure du jeu où le joueur l'a ouvert ; null tant qu'il ne l'a pas lu. */
    luLe: timestamp("lu_le", { withTimezone: true }),
    /**
     * US-0940 : le récit de Rencontre d'un retour d'Expédition : chaque Bête vue, à son heure, et ce qu'il en advint
     * (RencontreRacontee, src/monde/recits.ts), dans l'ordre des apparitions ; null pour les autres Récits, qui restent du
     * texte.
     */
    rencontres: jsonb("rencontres"),
  },
  (t) => [index("recit_par_territoire").on(t.territoireId, t.survenuLe)],
);

/**
 * Un Voyageur (US-0331) : un humain de passage qui attend aux portes du Territoire. Il se présente de temps
 * en temps (événement arrivee_voyageur, src/monde/voyageurs.ts), avec un prénom tiré comme ceux des
 * Habitants. US-0337 : il ne s'efface plus une fois parti ; son sort le dit, et les portes ne comptent que
 * ceux qui n'en ont pas encore.
 */
export const voyageur = pgTable(
  "voyageur",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    prenom: text("prenom").notNull(),
    /** L'heure du jeu où il s'est présenté. */
    arriveLe: timestamp("arrive_le", { withTimezone: true }).notNull(),
    /**
     * US-0337 : ce qu'il est devenu : null tant qu'il attend aux portes ; « accueilli » (US-0334), « refuse »
     * (US-0336) ou « reparti » de lui-même au bout de son attente (événement depart_voyageur).
     */
    sort: text("sort"),
    /** US-0337 : l'heure du jeu de son sort, donnée dès qu'il en a un. */
    sortLe: timestamp("sort_le", { withTimezone: true }),
  },
  (t) => [
    index("voyageur_par_territoire").on(t.territoireId),
    // US-0337 : ceux qui attendent aux portes, que le jeu lit et compte à chaque page et à chaque arrivée.
    index("voyageur_aux_portes")
      .on(t.territoireId)
      .where(sql`${t.sort} is null`),
    check("voyageur_sort_connu", sql`${t.sort} in ('accueilli', 'refuse', 'reparti')`),
    check("voyageur_sort_date", sql`(${t.sort} is null) = (${t.sortLe} is null)`),
  ],
);

/**
 * Le brouillard d'un Territoire (US-0436, US-0440) : une ligne par Case qu'il a découverte, à lui seul ; toute Case
 * sans ligne est pour lui sous le brouillard. Il naît avec les abords de son Foyer (src/monde/brouillard.ts), et
 * ses lignes partent avec lui. US-0441 : seul le fait d'être découverte est gardé, jamais un instantané de la Case :
 * son Biome et son propriétaire se lisent toujours en direct, et une Case découverte le reste pour toujours. US-0914 :
 * `expedition_id`, l'Expédition qui l'a sortie du brouillard (la première), null pour les abords du Foyer ; le Récit de
 * son retour (US-0917) en compte les Cases (casesLeveesParLExpedition, src/expeditions/brouillard.ts).
 */
export const caseDecouverte = pgTable(
  "case_decouverte",
  {
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    caseId: integer("case_id")
      .notNull()
      .references(() => caseDuMonde.id),
    expeditionId: integer("expedition_id").references((): AnyPgColumn => expedition.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.territoireId, t.caseId] }),
    index("case_decouverte_par_expedition").on(t.expeditionId).where(sql`${t.expeditionId} is not null`),
  ],
);

/**
 * Une Bête sauvage partie de sa Case avant la fin de sa présence (US-0926), en suivant une Expédition : elle n'y est plus
 * à partir de `partie_le`, un instant du jeu, pour toujours. Rien d'autre n'est écrit des Bêtes sauvages : leurs
 * apparitions se recalculent à la demande (src/monde/betes-sauvages.ts), et leur numéro, propre à leur Case et jamais
 * réutilisé, les désigne.
 */
export const betePartie = pgTable(
  "bete_partie",
  {
    caseId: integer("case_id")
      .notNull()
      .references(() => caseDuMonde.id),
    numero: bigint("numero", { mode: "number" }).notNull(),
    partieLe: timestamp("partie_le", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.caseId, t.numero] })],
);

/** US-0904 : le sexe d'une Bête apprivoisée, dû au hasard (Apprivoisement, US-0937). */
export const sexe = pgEnum("sexe", ["male", "femelle"]);

/**
 * L'effectif d'un Territoire (US-0904) : ses Bêtes apprivoisées, comptées et non désignées, puisque toutes les Bêtes
 * d'une Espèce sont identiques (ADR 0002) : une ligne par Espèce et par sexe, avec leur nombre, jamais négatif. Elle part
 * avec le Territoire. Personne n'a de Bête à sa naissance (ADR 0008) : la Bête apprivoisée y entre à son arrivée au Foyer
 * (US-0938), et l'Élevage des Couples réunis (jalon 8) la remplira aussi ; l'écran d'Expédition y lit les Bêtes
 * disponibles (src/monde/effectif.ts). US-0956 : le mâle et la femelle d'un Couple réuni la quittent pour la Réserve
 * (couple), d'où ils ne sortent plus.
 */
export const effectif = pgTable(
  "effectif",
  {
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    sexe: sexe("sexe").notNull(),
    nombre: integer("nombre").notNull(),
  },
  (t) => [primaryKey({ columns: [t.territoireId, t.especeId, t.sexe] }), check("effectif_jamais_negatif", sql`${t.nombre} >= 0`)],
);

/**
 * Une Bête de naissance (US-0975) : une Bête sauvage commune posée à la naissance d'un Foyer sur une Case libre à portée
 * d'exploration de départ, une par Case, réservée à son Territoire : les Expéditions des autres ne la rencontrent pas.
 * Contrairement aux apparitions ordinaires, qui se recalculent à la demande (src/monde/betes-sauvages.ts), elle est
 * écrite, avec son Espèce et sa présence, de son arrivée à son départ (exclu), pour que l'étape 40 la fasse rencontrer.
 * Elle part avec le Territoire.
 */
export const beteDeNaissance = pgTable(
  "bete_de_naissance",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    caseId: integer("case_id")
      .notNull()
      .references(() => caseDuMonde.id),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    /** Les instants du jeu de son arrivée et de son départ. */
    arrivee: timestamp("arrivee", { withTimezone: true }).notNull(),
    depart: timestamp("depart", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("bete_de_naissance_une_par_case").on(t.territoireId, t.caseId),
    check("bete_de_naissance_depart_apres_arrivee", sql`${t.depart} > ${t.arrivee}`),
  ],
);

/**
 * Une Expédition en cours (US-0911) : des explorateurs du Territoire, et peut-être une escorte de Bêtes
 * (expedition_escorte), partis à `part_le`, un instant du jeu, vers la Case `case_id`. Son aller dure `trajet_minutes`
 * minutes de jeu, et son retour autant (US-0912) ; le séjour, `sejour_minutes`, ne commence qu'à l'arrivée (US-0906).
 * Le trajet est chiffré au départ, escorte comprise (US-0912) ; il ne restait null que pour une escorte partie avant,
 * que la migration 0050 a rattrapée. Ses explorateurs la portent sur leur ligne (habitant.expedition_id). Elle part
 * avec le Territoire. US-0916 : rentrée au Foyer à `rentree_le`, un instant du jeu (null tant qu'elle est en cours), elle
 * n'est pas effacée : la présence sur sa Case (src/expeditions/presence.ts) la relit. US-0920 : rappelée par le joueur à
 * `rappelee_le`, un instant du jeu (null sans rappel), elle fait demi-tour aussitôt (src/expeditions/phase.ts).
 */
export const expedition = pgTable(
  "expedition",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    caseId: integer("case_id")
      .notNull()
      .references(() => caseDuMonde.id),
    partLe: timestamp("part_le", { withTimezone: true }).notNull(),
    trajetMinutes: integer("trajet_minutes"),
    sejourMinutes: integer("sejour_minutes").notNull(),
    rentreeLe: timestamp("rentree_le", { withTimezone: true }),
    rappeleeLe: timestamp("rappelee_le", { withTimezone: true }),
  },
  (t) => [
    index("expedition_par_territoire").on(t.territoireId),
    // US-0934 : les Expéditions de tous les Territoires présentes sur une Case, lues à chaque rattrapage d'une Rencontre.
    index("expedition_par_case").on(t.caseId),
    check("expedition_trajet_positif", sql`${t.trajetMinutes} > 0`),
    check("expedition_sejour_positif", sql`${t.sejourMinutes} > 0`),
    // US-0920 : une Expédition ne se rappelle qu'une fois partie.
    check("expedition_rappelee_apres_son_depart", sql`${t.rappeleeLe} >= ${t.partLe}`),
  ],
);

/**
 * L'escorte d'une Expédition (US-0911) : Espèce par Espèce, combien de ses Bêtes l'accompagnent. Elles restent dans
 * l'effectif du Territoire, qui les compte par sexe (ADR 0002) : l'escorte ne choisit pas le sexe, et les Bêtes sorties
 * se retranchent des disponibles (src/monde/effectif.ts). Elle part avec l'Expédition. US-0944 : `perdues`, combien de
 * ces Bêtes l'escorte a perdues au combat (src/expeditions/pertes.ts), sorties de l'effectif à cet instant ; `nombre`
 * reste celui du départ, dont se tire la force de l'escorte face aux Bêtes qu'elle rencontre (US-0934). US-0951 :
 * `blessees`, combien des perdues ne sont que des Blessés : elles restent dans l'effectif et rentrent au Foyer avec
 * l'Expédition ; seules les autres, mortes, en sont sorties.
 */
export const expeditionEscorte = pgTable(
  "expedition_escorte",
  {
    expeditionId: integer("expedition_id")
      .notNull()
      .references(() => expedition.id, { onDelete: "cascade" }),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    nombre: integer("nombre").notNull(),
    perdues: integer("perdues").notNull().default(0),
    blessees: integer("blessees").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.expeditionId, t.especeId] }),
    check("expedition_escorte_au_moins_une", sql`${t.nombre} > 0`),
    check("expedition_escorte_perdues_parmi_elles", sql`${t.perdues} between 0 and ${t.nombre}`),
    check("expedition_escorte_blessees_parmi_les_perdues", sql`${t.blessees} between 0 and ${t.perdues}`),
  ],
);

/**
 * Une Rencontre (US-0932) : une Bête sauvage qu'une Expédition a vue sur sa Case pendant son séjour, à `vue_le`, un
 * instant du jeu : celui de l'apparition de la Bête, ou celui de l'arrivée de l'Expédition si la Bête était déjà là. Une
 * Bête sauvage ordinaire s'y désigne par son numéro sur la Case de l'Expédition (src/monde/betes-sauvages.ts), une Bête
 * de naissance par sa ligne (bete_de_naissance) : l'une ou l'autre, jamais les deux. Son Espèce et l'instant de son
 * apparition sont retenus avec elle : ce que l'Expédition a vu ne change plus. Une Expédition ne rencontre qu'une fois
 * chaque Bête (src/expeditions/rencontres.ts). Elle part avec l'Expédition, ou avec sa Bête de naissance, qui ne s'efface
 * qu'avec son Territoire et ses Expéditions. US-0934 : `apprivoisee`, la Bête, à portée, suit l'Expédition depuis
 * `vue_le` : c'est l'Apprivoisement, et elle a quitté sa Case (src/expeditions/apprivoisement.ts). Une seule Expédition
 * par Bête : une Bête sauvage ordinaire laisse sa trace dans bete_partie, une Bête de naissance ici. US-0937 : `sexe`,
 * celui de la Bête apprivoisée, tiré à chances égales à l'Apprivoisement (src/expeditions/sexe.ts), qui ne change plus ;
 * null pour une Bête restée sur sa Case. US-0943 : `attaque_le`, l'instant du jeu où la Bête, trop forte pour l'escorte et
 * restée sur sa Case, a attaqué l'Expédition, au plus une fois par Bête et par Expédition (src/expeditions/attaque.ts) ;
 * null tant qu'elle ne l'a pas fait. Le combat (US-0944) la lira.
 */
export const rencontre = pgTable(
  "rencontre",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    expeditionId: integer("expedition_id")
      .notNull()
      .references(() => expedition.id, { onDelete: "cascade" }),
    numero: bigint("numero", { mode: "number" }),
    beteDeNaissanceId: integer("bete_de_naissance_id").references(() => beteDeNaissance.id, { onDelete: "cascade" }),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    /** Les instants du jeu de l'apparition de la Bête, et de la Rencontre. */
    apparueLe: timestamp("apparue_le", { withTimezone: true }).notNull(),
    vueLe: timestamp("vue_le", { withTimezone: true }).notNull(),
    apprivoisee: boolean("apprivoisee").notNull().default(false),
    sexe: sexe("sexe"),
    attaqueLe: timestamp("attaque_le", { withTimezone: true }),
  },
  (t) => [
    unique("rencontre_une_par_bete_sauvage").on(t.expeditionId, t.numero),
    unique("rencontre_une_par_bete_de_naissance").on(t.expeditionId, t.beteDeNaissanceId),
    index("rencontre_par_bete_de_naissance").on(t.beteDeNaissanceId),
    uniqueIndex("rencontre_une_expedition_par_bete_de_naissance").on(t.beteDeNaissanceId).where(sql`${t.apprivoisee}`),
    check("rencontre_une_bete", sql`(${t.numero} is null) <> (${t.beteDeNaissanceId} is null)`),
    check("rencontre_apres_l_apparition", sql`${t.vueLe} >= ${t.apparueLe}`),
    check("rencontre_sexe_de_l_apprivoisee", sql`(${t.sexe} is not null) = ${t.apprivoisee}`),
    // US-0943 : seule une Bête restée sur sa Case attaque, jamais avant sa Rencontre.
    check("rencontre_attaque_de_la_bete_restee", sql`${t.attaqueLe} is null or (not ${t.apprivoisee} and ${t.attaqueLe} >= ${t.vueLe})`),
  ],
);

/**
 * US-0933 : l'état d'une Espèce au Bestiaire, du premier au plus haut : croisée lors d'une Rencontre, apprivoisée
 * (US-0938), son Couple réuni (US-0956). La base compare les états dans cet ordre, celui de leurs valeurs.
 */
export const etatAuBestiaire = pgEnum("etat_au_bestiaire", ["croisee", "apprivoisee", "couple_reuni"]);

/**
 * Le Bestiaire d'un Territoire (US-0933) : une ligne par Espèce que le joueur connaît, avec son état, qui ne fait
 * qu'avancer, jamais reculer, même quand toutes ses Bêtes meurent : il ne se déduit ni de l'effectif ni des Rencontres
 * (src/bestiaire/bestiaire.ts). `croisee_le` est l'instant du jeu où le joueur a vu l'Espèce pour la première fois, et
 * `rencontre_id` la Rencontre qui l'a inscrite : celle que les récits signalent « Nouvelle Espèce au Bestiaire » (null
 * pour une Espèce inscrite autrement, ou si cette Rencontre s'efface). Il part avec le Territoire. La page Bestiaire
 * arrive au jalon 10.
 */
export const bestiaire = pgTable(
  "bestiaire",
  {
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    etat: etatAuBestiaire("etat").notNull(),
    croiseeLe: timestamp("croisee_le", { withTimezone: true }).notNull(),
    rencontreId: integer("rencontre_id").references(() => rencontre.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.territoireId, t.especeId] }), unique("bestiaire_une_espece_par_rencontre").on(t.rencontreId)],
);

/**
 * Le Couple d'une Espèce (US-0956) : un mâle et une femelle du Territoire, réunis à `reuni_le`, un instant du jeu : celui
 * où l'effectif de l'Espèce les a comptés tous deux au Foyer (src/monde/couple.ts). Ils ont quitté l'effectif pour la
 * Réserve, à l'abri : ils ne combattent plus et ne sortent plus. Un seul Couple par Espèce, qui ne se défait pas ; la page
 * de la Réserve arrive à l'étape 33. Il part avec le Territoire.
 */
export const couple = pgTable(
  "couple",
  {
    territoireId: integer("territoire_id")
      .notNull()
      .references(() => territoire.id, { onDelete: "cascade" }),
    especeId: text("espece_id")
      .notNull()
      .references(() => espece.id),
    reuniLe: timestamp("reuni_le", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.territoireId, t.especeId] })],
);
