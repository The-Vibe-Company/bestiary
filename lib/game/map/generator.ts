import { WorldMap, MapFeature } from './types'

const WORLD_SEED = 123456789
const MAP_SIZE = 100
const CELL_SIZE = 5 // Taille des sous-grilles pour la répartition
const GRID_COUNT = MAP_SIZE / CELL_SIZE // 20x20 sous-grilles

const FEATURES: MapFeature[] = ['foret', 'montagne']

class MapGenerator {
  private random: () => number
  private map: WorldMap

  constructor(seed: number = WORLD_SEED) {
    this.random = this.createSeededRandom(seed)
    this.map = this.initializeMap()
  }

  private createSeededRandom(seed: number): () => number {
    let currentSeed = seed
    return function() {
      currentSeed |= 0
      currentSeed = currentSeed + 0x6D2B79F5 | 0
      let t = Math.imul(currentSeed ^ currentSeed >>> 15, 1 | currentSeed)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  private initializeMap(): WorldMap {
    const map: WorldMap = []
    for (let y = 0; y < MAP_SIZE; y++) {
      const row = []
      for (let x = 0; x < MAP_SIZE; x++) {
        row.push({ x, y, feature: null })
      }
      map.push(row)
    }
    return map
  }

  private placeFeatures(): void {
    const CENTER = MAP_SIZE / 2
    const MAX_DIST = Math.sqrt(CENTER * CENTER + CENTER * CENTER)
    let featureToggle = 0

    for (let gy = 0; gy < GRID_COUNT; gy++) {
      for (let gx = 0; gx < GRID_COUNT; gx++) {
        // Centre de cette sous-grille
        const cx = gx * CELL_SIZE + CELL_SIZE / 2
        const cy = gy * CELL_SIZE + CELL_SIZE / 2

        // Distance au centre de la map, normalisée 0–1
        const dist = Math.sqrt((cx - CENTER) ** 2 + (cy - CENTER) ** 2) / MAX_DIST

        // Densité : faible au centre (~0.4), forte aux bords (~2.2)
        const expected = 0.4 + 1.8 * dist
        const count = Math.floor(expected + this.random())

        for (let i = 0; i < count; i++) {
          const x = gx * CELL_SIZE + Math.floor(this.random() * CELL_SIZE)
          const y = gy * CELL_SIZE + Math.floor(this.random() * CELL_SIZE)

          if (!this.map[y][x].feature) {
            this.map[y][x].feature = FEATURES[featureToggle % FEATURES.length]
            featureToggle++
          }
        }
      }
    }
  }

  public generate(): WorldMap {
    this.placeFeatures()
    return this.map
  }
}

export function generateWorldMap(): WorldMap {
  const generator = new MapGenerator()
  return generator.generate()
}
