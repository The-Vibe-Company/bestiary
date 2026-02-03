import { generateWorldMap } from '../lib/game/map/generator'
import { BiomeType } from '../lib/game/map/types'

const worldMap = generateWorldMap()

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
console.log('\n=== MAP GENERATION STATISTICS ===\n')
console.log(`Total cells: ${total}\n`)

Object.entries(counts).forEach(([biome, count]) => {
  const percentage = (count / total * 100).toFixed(2)
  console.log(`${biome.padEnd(10)} : ${count.toString().padStart(4)} cells (${percentage}%)`)
})

console.log('\n=================================\n')
