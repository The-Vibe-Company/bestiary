// Inhabitant types in display order (DB field names in English)
export const INHABITANT_TYPES = [
  'lumberjack',   // Bûcheron
  'stonemason',   // Tailleur de Pierre
  'explorer',     // Explorateur
  'hunter',       // Chasseur
  'gatherer',     // Cueilleur
  'breeder',      // Éleveur
  'farmer',       // Agriculteur
] as const

export type InhabitantType = (typeof INHABITANT_TYPES)[number]

// Metadata for display (French UI)
export const INHABITANT_METADATA: Record<
  InhabitantType,
  {
    title: string
    image: string
    description: string
  }
> = {
  lumberjack: {
    title: 'Bûcheron',
    image: '/assets/habitants/bucheron.png',
    description:
      'Abat les arbres des forêts environnantes pour fournir le bois nécessaire aux constructions et au chauffage. Sa force et son endurance sont légendaires.',
  },
  stonemason: {
    title: 'Tailleur de Pierre',
    image: '/assets/habitants/tailleur_de_pierre.png',
    description:
      'Sculpte et façonne la roche pour ériger les bâtiments du village. Son art ancestral transforme la pierre brute en fondations solides et durables.',
  },
  explorer: {
    title: 'Explorateur',
    image: '/assets/habitants/explorateur.png',
    description:
      'Brave les dangers des terres inconnues pour découvrir de nouvelles créatures et ressources. Son courage et sa curiosité repoussent les frontières du monde connu.',
  },
  hunter: {
    title: 'Chasseur',
    image: '/assets/habitants/chasseur.png',
    description:
      'Traque le gibier dans les forêts et les plaines pour approvisionner le village en viande et en fourrures. Son œil aiguisé et sa patience font de lui un pisteur redoutable.',
  },
  gatherer: {
    title: 'Cueilleur',
    image: '/assets/habitants/cueilleur.png',
    description:
      'Parcourt les plaines et les sous-bois à la recherche de baies, champignons et plantes médicinales. Ses connaissances botaniques sont précieuses pour le village.',
  },
  breeder: {
    title: 'Éleveur',
    image: '/assets/habitants/eleveur.png',
    description:
      'Prend soin des créatures domestiquées du village. Il veille à leur bien-être et assure la production de lait, œufs et laine pour la communauté.',
  },
  farmer: {
    title: 'Agriculteur',
    image: '/assets/habitants/agriculteur.png',
    description:
      'Cultive les terres fertiles du village pour produire céréales et légumes. Son travail assidu nourrit la communauté et assure des réserves pour les temps difficiles.',
  },
}

export interface VillageInhabitants {
  id: string
  villageId: string
  lumberjack: number
  stonemason: number
  explorer: number
  hunter: number
  gatherer: number
  breeder: number
  farmer: number
  createdAt: Date
  updatedAt: Date
}
