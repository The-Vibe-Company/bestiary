import { prisma } from '@/lib/prisma'
import { generateWorldMap } from '@/lib/game/map/generator'
import { MapCell, MapFeature, WorldMap } from '@/lib/game/map/types'

const MAP_SIZE = 100
const MIN_BORDER_DISTANCE = 3
const MAX_BORDER_DISTANCE = 10
const MAX_FEATURE_DISTANCE = 3

// Vérifie si une cellule est dans la zone de bordure (entre 3 et 10 cases des bords)
function isInBorderZone(cell: MapCell): boolean {
  const { x, y } = cell
  const maxCoord = MAP_SIZE - 1

  const distX = Math.min(x, maxCoord - x)
  const distY = Math.min(y, maxCoord - y)

  const xInZone = distX >= MIN_BORDER_DISTANCE && distX <= MAX_BORDER_DISTANCE
  const yInZone = distY >= MIN_BORDER_DISTANCE && distY <= MAX_BORDER_DISTANCE

  return xInZone && yInZone
}

// Vérifie si une feature donnée existe dans un rayon de `maxDist` cases (distance de Chebyshev)
function hasFeatureNearby(map: WorldMap, x: number, y: number, feature: MapFeature, maxDist: number): boolean {
  const minX = Math.max(0, x - maxDist)
  const maxX = Math.min(MAP_SIZE - 1, x + maxDist)
  const minY = Math.max(0, y - maxDist)
  const maxY = Math.min(MAP_SIZE - 1, y + maxDist)

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (map[cy][cx].feature === feature) return true
    }
  }
  return false
}

export async function assignVillageToUser(userId: string) {
  // Vérifier si l'user a déjà un village
  const existing = await prisma.village.findUnique({
    where: { ownerId: userId }
  })
  if (existing) return existing

  // Générer la map et trouver les cases vides proches d'une forêt ET d'une montagne
  const map = generateWorldMap()
  const prairieCells = map.flat().filter(cell =>
    cell.feature === null &&
    isInBorderZone(cell) &&
    hasFeatureNearby(map, cell.x, cell.y, 'foret', MAX_FEATURE_DISTANCE) &&
    hasFeatureNearby(map, cell.x, cell.y, 'montagne', MAX_FEATURE_DISTANCE)
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
