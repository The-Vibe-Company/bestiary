import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const inhabitantTypes = [
  {
    key: 'lumberjack',
    title: 'Bûcheron',
    description:
      'Abat les arbres des forêts et jungles environnantes pour fournir le bois nécessaire au village.',
    image: '/assets/habitants/bucheron.webp',
    order: 1,
    speed: 2,
    gatherRate: 10,
    maxCapacity: 30,
    consumeCereales: 1.0,
    consumeViande: 1.2,
  },
  {
    key: 'miner',
    title: 'Mineur',
    description:
      'Extrait la pierre des montagnes pour approvisionner le village en matériaux de construction.',
    image: '/assets/habitants/mineur.webp',
    order: 2,
    speed: 2,
    gatherRate: 8,
    maxCapacity: 25,
    consumeCereales: 1.0,
    consumeViande: 1.2,
  },
  {
    key: 'explorer',
    title: 'Explorateur',
    description:
      'Parcourt la carte à la recherche d\'objets rares et de connaissances anciennes. Ramène du savoir au village.',
    image: '/assets/habitants/explorateur.webp',
    order: 3,
    consumeCereales: 1.2,
    consumeViande: 0.8,
  },
  {
    key: 'hunter',
    title: 'Chasseur',
    description:
      'Traque le gibier sur la carte pour ramener de la nourriture au village.',
    image: '/assets/habitants/chasseur.webp',
    order: 4,
    speed: 2,
    gatherRate: 8,
    maxCapacity: 25,
    consumeCereales: 0.8,
    consumeViande: 0.5,
  },
  {
    key: 'gatherer',
    title: 'Cueilleur',
    description:
      'Récolte fruits et légumes sur la carte pour nourrir la communauté.',
    image: '/assets/habitants/cueilleur.webp',
    order: 5,
    speed: 2,
    gatherRate: 8,
    maxCapacity: 25,
    consumeCereales: 0.8,
    consumeViande: 0.8,
  },
  {
    key: 'breeder',
    title: 'Éleveur',
    description:
      'Élève les animaux du village pour produire viande et œufs.',
    image: '/assets/habitants/eleveur.webp',
    order: 6,
    consumeCereales: 0.8,
    consumeViande: 0.5,
  },
  {
    key: 'farmer',
    title: 'Agriculteur',
    description:
      'Cultive les champs du village pour produire fruits et légumes.',
    image: '/assets/habitants/agriculteur.webp',
    order: 7,
    consumeCereales: 0.5,
    consumeViande: 0.8,
  },
  {
    key: 'researcher',
    title: 'Chercheur',
    description:
      'Étudie les mystères du monde pour faire progresser le savoir du village.',
    image: '/assets/habitants/chercheur.webp',
    order: 8,
    consumeCereales: 1.2,
    consumeViande: 0.6,
  },
  {
    key: 'builder',
    title: 'Bâtisseur',
    description:
      'Construit et améliore les bâtiments du village grâce à son expertise.',
    image: '/assets/habitants/batisseur.webp',
    order: 9,
    consumeCereales: 1.0,
    consumeViande: 1.2,
  },
  {
    key: 'watchman',
    title: 'Guetteur',
    description:
      'Stationné dans la tour de guet, il scrute l\'horizon pour repérer les voyageurs en approche. Plus ils sont nombreux, plus la détection est efficace.',
    image: '/assets/habitants/guetteur.webp',
    order: 10,
    consumeCereales: 0.8,
    consumeViande: 0.6,
  },
  {
    key: 'tavernkeeper',
    title: 'Tavernier',
    description:
      'Tient la taverne du village et s\'occupe des voyageurs de passage. Plus ils sont nombreux, plus les voyageurs prolongent leur séjour.',
    image: '/assets/habitants/tavernier.webp',
    order: 11,
    consumeCereales: 0.6,
    consumeViande: 0.8,
  },
]

const buildingTypes = [
  {
    key: 'hotel_de_ville',
    title: 'Hôtel de Ville',
    description:
      'Le centre administratif du village. Permet d\'accueillir plus d\'habitants et de développer le village.',
    image: '/assets/batiments/hotel_de_ville.webp',
    order: 1,
    category: 'centre',
    costBois: 80,
    costPierre: 60,
    costCereales: 20,
    costViande: 10,
    buildSeconds: 120,
    capacityBonus: 6,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'cabane_en_bois',
    title: 'Cabane en bois',
    description:
      'Une petite cabane en bois permettant d\'accueillir un habitant supplémentaire dans le village.',
    image: '/assets/batiments/cabane_en_bois.webp',
    order: 2,
    category: 'centre',
    costBois: 50,
    costPierre: 0,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 30,
    capacityBonus: 1,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: null,
    maxLevel: 1,
    requiredTechnology: null,
  },
  {
    key: 'laboratoire',
    title: 'Laboratoire',
    description:
      'Un atelier dédié à la recherche et à l\'étude des mystères du monde. Permet d\'accéder aux technologies avancées.',
    image: '/assets/batiments/laboratoire.webp',
    order: 3,
    category: 'savoir',
    costBois: 100,
    costPierre: 80,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 120,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'entrepot_bois',
    title: 'Bûcher',
    description:
      'Un abri couvert où le bois est empilé et séché avant d\'être utilisé. Augmente la capacité de stockage de bois du village.',
    image: '/assets/batiments/bucher.webp',
    order: 4,
    category: 'ressources',
    costBois: 40,
    costPierre: 30,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 60,
    capacityBonus: 0,
    storageBonusBois: 200,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'entrepot_pierre',
    title: 'Taillerie',
    description:
      'Un atelier où la pierre est taillée, triée et entreposée. Augmente la capacité de stockage de pierre du village.',
    image: '/assets/batiments/taillerie.webp',
    order: 5,
    category: 'ressources',
    costBois: 40,
    costPierre: 30,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 60,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 200,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'entrepot_cereales',
    title: 'Cellier',
    description:
      'Une réserve fraîche et ventilée pour conserver fruits, légumes et céréales. Augmente la capacité de stockage de nourriture du village.',
    image: '/assets/batiments/cellier.webp',
    order: 6,
    category: 'ressources',
    costBois: 35,
    costPierre: 20,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 45,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 100,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'entrepot_viande',
    title: 'Fumoir',
    description:
      'Un bâtiment où la viande est fumée et séchée pour être conservée longtemps. Augmente la capacité de stockage de viande du village.',
    image: '/assets/batiments/fumoir.webp',
    order: 7,
    category: 'ressources',
    costBois: 35,
    costPierre: 20,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 45,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 100,
    maxCount: 1,
    maxLevel: 5,
    requiredTechnology: null,
  },
  {
    key: 'tour_de_guet',
    title: 'Tour de guet',
    description:
      'Une haute tour en bois et pierre offrant une vue dégagée sur les environs. Permet de détecter les voyageurs en approche avant leur arrivée.',
    image: '/assets/batiments/tour_de_guet.webp',
    order: 8,
    category: 'militaire',
    costBois: 80,
    costPierre: 60,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 90,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 3,
    requiredTechnology: 'optique_rudimentaire',
  },
  {
    key: 'taverne',
    title: 'Taverne',
    description:
      'Un lieu chaleureux où les voyageurs peuvent se restaurer et prolonger leur séjour au village grâce aux boissons fermentées.',
    image: '/assets/batiments/taverne.webp',
    order: 9,
    category: 'social',
    costBois: 60,
    costPierre: 40,
    costCereales: 20,
    costViande: 0,
    buildSeconds: 90,
    capacityBonus: 0,
    storageBonusBois: 0,
    storageBonusPierre: 0,
    storageBonusCereales: 0,
    storageBonusViande: 0,
    maxCount: 1,
    maxLevel: 3,
    requiredTechnology: 'boissons_fermentees',
  },
]

const technologies = [
  {
    key: 'optique_rudimentaire',
    title: 'Optique rudimentaire',
    description:
      'Étudiez les propriétés de la lumière et des lentilles pour observer les environs à grande distance. Permet la construction d\'une tour de guet.',
    image: '/assets/technologies/optique_rudimentaire.webp',
    order: 1,
    costBois: 0,
    costPierre: 20,
    costCereales: 0,
    costViande: 0,
    researchSeconds: 90,
    requiredLabLevel: 1,
    maxLevel: 3,
  },
  {
    key: 'boissons_fermentees',
    title: 'Boissons fermentées',
    description:
      'Maîtrisez l\'art de la fermentation pour produire des boissons qui attirent et retiennent les voyageurs plus longtemps au village.',
    image: '/assets/technologies/boissons_fermentees.webp',
    order: 2,
    costBois: 0,
    costPierre: 0,
    costCereales: 30,
    costViande: 0,
    researchSeconds: 120,
    requiredLabLevel: 1,
    maxLevel: 3,
  },
]

async function main() {
  console.log('Seeding inhabitant types...')

  for (const type of inhabitantTypes) {
    await prisma.inhabitantType.upsert({
      where: { key: type.key },
      update: {
        title: type.title,
        description: type.description,
        image: type.image,
        order: type.order,
        speed: type.speed ?? 0,
        gatherRate: type.gatherRate ?? 0,
        maxCapacity: type.maxCapacity ?? 0,
        consumeCereales: type.consumeCereales ?? 0,
        consumeViande: type.consumeViande ?? 0,
      },
      create: {
        key: type.key,
        title: type.title,
        description: type.description,
        image: type.image,
        order: type.order,
        speed: type.speed ?? 0,
        gatherRate: type.gatherRate ?? 0,
        maxCapacity: type.maxCapacity ?? 0,
        consumeCereales: type.consumeCereales ?? 0,
        consumeViande: type.consumeViande ?? 0,
      },
    })
    console.log(`  - ${type.title}`)
  }

  console.log('Seeding building types...')

  for (const type of buildingTypes) {
    await prisma.buildingType.upsert({
      where: { key: type.key },
      update: {
        title: type.title,
        description: type.description,
        image: type.image,
        order: type.order,
        category: type.category,
        costBois: type.costBois,
        costPierre: type.costPierre,
        costCereales: type.costCereales,
        costViande: type.costViande,
        buildSeconds: type.buildSeconds,
        capacityBonus: type.capacityBonus,
        storageBonusBois: type.storageBonusBois,
        storageBonusPierre: type.storageBonusPierre,
        storageBonusCereales: type.storageBonusCereales,
        storageBonusViande: type.storageBonusViande,
        maxCount: type.maxCount,
        maxLevel: type.maxLevel,
        requiredTechnology: type.requiredTechnology,
      },
      create: {
        key: type.key,
        title: type.title,
        description: type.description,
        image: type.image,
        order: type.order,
        category: type.category,
        costBois: type.costBois,
        costPierre: type.costPierre,
        costCereales: type.costCereales,
        costViande: type.costViande,
        buildSeconds: type.buildSeconds,
        capacityBonus: type.capacityBonus,
        storageBonusBois: type.storageBonusBois,
        storageBonusPierre: type.storageBonusPierre,
        storageBonusCereales: type.storageBonusCereales,
        storageBonusViande: type.storageBonusViande,
        maxCount: type.maxCount,
        maxLevel: type.maxLevel,
        requiredTechnology: type.requiredTechnology,
      },
    })
    console.log(`  - ${type.title}`)
  }

  console.log('Seeding technologies...')

  for (const tech of technologies) {
    await prisma.technology.upsert({
      where: { key: tech.key },
      update: {
        title: tech.title,
        description: tech.description,
        image: tech.image,
        order: tech.order,
        costBois: tech.costBois,
        costPierre: tech.costPierre,
        costCereales: tech.costCereales,
        costViande: tech.costViande,
        researchSeconds: tech.researchSeconds,
        requiredLabLevel: tech.requiredLabLevel,
        maxLevel: tech.maxLevel,
      },
      create: {
        key: tech.key,
        title: tech.title,
        description: tech.description,
        image: tech.image,
        order: tech.order,
        costBois: tech.costBois,
        costPierre: tech.costPierre,
        costCereales: tech.costCereales,
        costViande: tech.costViande,
        researchSeconds: tech.researchSeconds,
        requiredLabLevel: tech.requiredLabLevel,
        maxLevel: tech.maxLevel,
      },
    })
    console.log(`  - ${tech.title}`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
