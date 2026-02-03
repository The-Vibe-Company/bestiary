import { prisma } from '@/lib/prisma'
import { generateWorldMap } from '@/lib/game/map/generator'
import { MapCell } from '@/lib/game/map/types'

const MAP_SIZE = 100
const MIN_BORDER_DISTANCE = 3
const MAX_BORDER_DISTANCE = 10

// Vérifie si une cellule est dans la zone de bordure (entre 3 et 10 cases des bords)
function isInBorderZone(cell: MapCell): boolean {
  const { x, y } = cell
  const maxCoord = MAP_SIZE - 1 // 99

  // Distance depuis chaque bord
  const distFromLeft = x
  const distFromRight = maxCoord - x
  const distFromTop = y
  const distFromBottom = maxCoord - y

  // Vérifie si proche d'au moins un bord (entre 3 et 10 cases)
  const nearLeft = distFromLeft >= MIN_BORDER_DISTANCE && distFromLeft <= MAX_BORDER_DISTANCE
  const nearRight = distFromRight >= MIN_BORDER_DISTANCE && distFromRight <= MAX_BORDER_DISTANCE
  const nearTop = distFromTop >= MIN_BORDER_DISTANCE && distFromTop <= MAX_BORDER_DISTANCE
  const nearBottom = distFromBottom >= MIN_BORDER_DISTANCE && distFromBottom <= MAX_BORDER_DISTANCE

  return nearLeft || nearRight || nearTop || nearBottom
}

export async function assignVillageToUser(userId: string) {
  // Vérifier si l'user a déjà un village
  const existing = await prisma.village.findUnique({
    where: { ownerId: userId }
  })
  if (existing) return existing

  // Générer la map et trouver les prairies dans la zone de bordure
  const map = generateWorldMap()
  const prairieCells = map.flat().filter(cell =>
    cell.biome === 'prairie' && isInBorderZone(cell)
  )

  // Récupérer les coordonnées déjà prises
  const takenVillages = await prisma.village.findMany({
    select: { x: true, y: true }
  })
  const takenSet = new Set(takenVillages.map(v => `${v.x},${v.y}`))

  // Trouver une prairie libre
  const freePrairie = prairieCells.find(cell => !takenSet.has(`${cell.x},${cell.y}`))

  if (!freePrairie) {
    throw new Error('Aucune prairie disponible dans la zone de bordure')
  }

  // Créer le village
  return prisma.village.create({
    data: {
      x: freePrairie.x,
      y: freePrairie.y,
      ownerId: userId
    }
  })
}
