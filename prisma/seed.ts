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
  },
  {
    key: 'miner',
    title: 'Mineur',
    description:
      'Extrait la pierre des montagnes pour approvisionner le village en matériaux de construction.',
    image: '/assets/habitants/mineur.png',
    order: 2,
  },
  {
    key: 'explorer',
    title: 'Explorateur',
    description:
      'Parcourt la carte à la recherche d\'objets rares et de trésors cachés.',
    image: '/assets/habitants/explorateur.png',
    order: 3,
  },
  {
    key: 'hunter',
    title: 'Chasseur',
    description:
      'Traque le gibier sur la carte pour ramener de la nourriture au village.',
    image: '/assets/habitants/chasseur.png',
    order: 4,
  },
  {
    key: 'gatherer',
    title: 'Cueilleur',
    description:
      'Récolte fruits et légumes sur la carte pour nourrir la communauté.',
    image: '/assets/habitants/cueilleur.png',
    order: 5,
  },
  {
    key: 'breeder',
    title: 'Éleveur',
    description:
      'Élève les animaux du village pour produire viande et œufs.',
    image: '/assets/habitants/eleveur.png',
    order: 6,
  },
  {
    key: 'farmer',
    title: 'Agriculteur',
    description:
      'Cultive les champs du village pour produire fruits et légumes.',
    image: '/assets/habitants/agriculteur.png',
    order: 7,
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
      },
      create: type,
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
