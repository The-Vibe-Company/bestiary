// US-0807 : ce que veut dire chaque caractéristique de la fiche d'une Espèce, une phrase chacune, que le joueur ouvre en
// touchant son nom (Explication.tsx). Côté serveur comme dans le navigateur.

/** US-0807 : l'explication d'une phrase de l'effectif et de chaque caractéristique, dans l'ordre de la fiche. */
export const EXPLICATIONS = {
  Effectif: "Les Bêtes de l'Espèce que compte le Territoire, au Foyer comme en Expédition, sans celles du Couple en Réserve.",
  Attaque: "Les coups que porte une Bête au combat ; avec sa Vie, elle fait sa force.",
  Vie: "Ce qu'une Bête encaisse au combat ; avec son Attaque, elle fait sa force.",
  Vitesse: "Une Expédition avance au pas de la Bête la plus lente de son escorte, jamais plus vite que ses explorateurs.",
  Charge: "Ce qu'une Bête peut porter.",
  Taille: "Les Places qu'une Bête prend dans l'Habitat du Foyer.",
  Régime: "Ce que mange l'Espèce, et donc la Nourriture de son Entretien.",
  Entretien: "La Nourriture qu'une Bête mange chaque heure.",
  Habitat: "Le Biome où vit l'Espèce à l'état sauvage.",
  Rôle: "Un usage qu'ont certaines Espèces en plus du combat.",
} as const;

/** US-0807 : le nom d'une caractéristique de la fiche, ou l'effectif. */
export type NomExplique = keyof typeof EXPLICATIONS;
