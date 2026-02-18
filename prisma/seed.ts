import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const inhabitantTypes = [
  {
    key: 'lumberjack',
    title: 'Bûcheron',
    description:
      'Abat les arbres des forêts et jungles environnantes pour fournir le bois nécessaire au village.',
    image: '/assets/habitants/bucheron.png',
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
    image: '/assets/habitants/mineur.png',
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
    image: '/assets/habitants/explorateur.png',
    order: 3,
    consumeCereales: 1.2,
    consumeViande: 0.8,
  },
  {
    key: 'hunter',
    title: 'Chasseur',
    description:
      'Traque le gibier sur la carte pour ramener de la nourriture au village.',
    image: '/assets/habitants/chasseur.png',
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
    image: '/assets/habitants/cueilleur.png',
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
    image: '/assets/habitants/eleveur.png',
    order: 6,
    consumeCereales: 0.8,
    consumeViande: 0.5,
  },
  {
    key: 'farmer',
    title: 'Agriculteur',
    description:
      'Cultive les champs du village pour produire fruits et légumes.',
    image: '/assets/habitants/agriculteur.png',
    order: 7,
    consumeCereales: 0.5,
    consumeViande: 0.8,
  },
  {
    key: 'researcher',
    title: 'Chercheur',
    description:
      'Étudie les mystères du monde pour faire progresser le savoir du village.',
    image: '/assets/habitants/chercheur.png',
    order: 8,
    consumeCereales: 1.2,
    consumeViande: 0.6,
  },
  {
    key: 'builder',
    title: 'Bâtisseur',
    description:
      'Construit et améliore les bâtiments du village grâce à son expertise.',
    image: '/assets/habitants/batisseur.png',
    order: 9,
    consumeCereales: 1.0,
    consumeViande: 1.2,
  },
]

const buildingTypes = [
  {
    key: 'cabane_en_bois',
    title: 'Cabane en bois',
    description:
      'Une petite cabane en bois permettant d\'accueillir un habitant supplémentaire dans le village.',
    image: '/assets/batiments/cabane_en_bois.png',
    order: 1,
    costBois: 50,
    costPierre: 0,
    costCereales: 0,
    costViande: 0,
    buildSeconds: 30,
    capacityBonus: 1,
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
        costBois: type.costBois,
        costPierre: type.costPierre,
        costCereales: type.costCereales,
        costViande: type.costViande,
        buildSeconds: type.buildSeconds,
        capacityBonus: type.capacityBonus,
      },
      create: {
        key: type.key,
        title: type.title,
        description: type.description,
        image: type.image,
        order: type.order,
        costBois: type.costBois,
        costPierre: type.costPierre,
        costCereales: type.costCereales,
        costViande: type.costViande,
        buildSeconds: type.buildSeconds,
        capacityBonus: type.capacityBonus,
      },
    })
    console.log(`  - ${type.title}`)
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
