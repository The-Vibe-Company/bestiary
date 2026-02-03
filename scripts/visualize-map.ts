import { generateWorldMap } from '../lib/game/map/generator'
import { BIOME_CONFIGS } from '../lib/game/map/biomes'
import { BiomeType } from '../lib/game/map/types'

const worldMap = generateWorldMap()

// Create a simple text visualization
console.log('\n=== MAP VISUALIZATION (Sample 20x20 from center) ===\n')

const biomeSymbols: Record<BiomeType, string> = {
  prairie: '🟩',
  foret: '🌲',
  desert: '🟨',
  savane: '🟫',
  jungle: '🌴',
  banquise: '🧊',
  montagne: '⛰️',
  eau: '🌊'
}

// Show a 20x20 sample from the center
const startX = 40
const startY = 40
const size = 20

for (let y = startY; y < startY + size; y++) {
  let row = ''
  for (let x = startX; x < startX + size; x++) {
    const cell = worldMap[y][x]
    row += biomeSymbols[cell.biome] + ' '
  }
  console.log(row)
}

console.log('\n=== Legend ===')
Object.entries(biomeSymbols).forEach(([biome, symbol]) => {
  const config = BIOME_CONFIGS[biome as BiomeType]
  console.log(`${symbol} ${biome.padEnd(10)} (${config.baseColor})`)
})

// Statistics
const counts: Record<BiomeType, number> = {
  prairie: 0,
  foret: 0,
  desert: 0,
  savane: 0,
  jungle: 0,
  banquise: 0,
  montagne: 0,
  eau: 0
}

for (const row of worldMap) {
  for (const cell of row) {
    counts[cell.biome]++
  }
}

const total = 100 * 100
console.log('\n=== Distribution ===')
Object.entries(counts).forEach(([biome, count]) => {
  const percentage = (count / total * 100).toFixed(2)
  const bar = '█'.repeat(Math.floor(Number(percentage) / 2))
  console.log(`${biome.padEnd(10)} : ${percentage.padStart(6)}% ${bar}`)
})

console.log('\n')
