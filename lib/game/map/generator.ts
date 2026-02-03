import { WorldMap, BiomeType } from './types'

const WORLD_SEED = 123456789
const MAP_SIZE = 100

class MapGenerator {
  private random: () => number
  private map: WorldMap
  private seed: number

  constructor(seed: number = WORLD_SEED) {
    this.seed = seed
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
        row.push({ x, y, biome: 'prairie' as BiomeType })
      }
      map.push(row)
    }
    return map
  }

  private selectBiomeWeighted(): BiomeType {
    const rand = this.random() * 100
    let cumulative = 0

    const allBiomes: BiomeType[] = ['prairie', 'foret', 'desert', 'savane', 'jungle', 'banquise', 'montagne', 'eau']
    const weights = [50, 9, 9, 9, 9, 9, 2.5, 2.5] // Total = 100

    for (let i = 0; i < allBiomes.length; i++) {
      cumulative += weights[i]
      if (rand <= cumulative) return allBiomes[i]
    }

    return 'prairie'
  }

  private generateRandomCells(): void {
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const biome = this.selectBiomeWeighted()
        this.map[y][x] = { x, y, biome }
      }
    }
  }

  public generate(): WorldMap {
    this.generateRandomCells()
    return this.map
  }

  public getStatistics() {
    const counts: Record<BiomeType, number> = {
      prairie: 0, foret: 0, desert: 0, savane: 0,
      jungle: 0, banquise: 0, montagne: 0, eau: 0
    }

    for (const row of this.map) {
      for (const cell of row) {
        counts[cell.biome]++
      }
    }

    const total = MAP_SIZE * MAP_SIZE
    const percentages = Object.entries(counts).map(([biome, count]) => ({
      biome,
      count,
      percentage: (count / total * 100).toFixed(2) + '%'
    }))

    return percentages
  }
}

export function generateWorldMap(): WorldMap {
  const generator = new MapGenerator()
  return generator.generate()
}
