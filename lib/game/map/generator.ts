import { WorldMap, MapFeature } from './types'

const WORLD_SEED = 123456789
const MAP_SIZE = 100
const FEATURE_CHANCE = 0.065 // ~6.5% des cases reçoivent une feature

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
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.random() < FEATURE_CHANCE) {
          const featureIndex = Math.floor(this.random() * FEATURES.length)
          this.map[y][x].feature = FEATURES[featureIndex]
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
