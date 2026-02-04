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

  // Distance depuis le bord le plus proche en X et en Y
  const distX = Math.min(x, maxCoord - x)
  const distY = Math.min(y, maxCoord - y)

  // Les deux distances doivent être entre 3 et 10
  const xInZone = distX >= MIN_BORDER_DISTANCE && distX <= MAX_BORDER_DISTANCE
  const yInZone = distY >= MIN_BORDER_DISTANCE && distY <= MAX_BORDER_DISTANCE

  return xInZone && yInZone
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

  // Trouver toutes les prairies libres
  const freePrairies = prairieCells.filter(cell => !takenSet.has(`${cell.x},${cell.y}`))

  if (freePrairies.length === 0) {
    throw new Error('Aucune prairie disponible dans la zone de bordure')
  }

  // Choisir une prairie aléatoirement
  const randomIndex = Math.floor(Math.random() * freePrairies.length)
  const freePrairie = freePrairies[randomIndex]

  // Créer le village
  return prisma.village.create({
    data: {
      x: freePrairie.x,
      y: freePrairie.y,
      ownerId: userId
    }
  })
}
