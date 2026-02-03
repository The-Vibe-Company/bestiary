import { generateWorldMap } from '../lib/game/map/generator'

console.log('\n=== Testing Map Determinism ===\n')

// Generate the map 3 times
const map1 = generateWorldMap()
const map2 = generateWorldMap()
const map3 = generateWorldMap()

let differences = 0

// Compare all cells
for (let y = 0; y < 100; y++) {
  for (let x = 0; x < 100; x++) {
    const biome1 = map1[y][x].biome
    const biome2 = map2[y][x].biome
    const biome3 = map3[y][x].biome

    if (biome1 !== biome2 || biome2 !== biome3) {
      differences++
      console.log(`❌ Difference at (${x}, ${y}): ${biome1} vs ${biome2} vs ${biome3}`)
    }
  }
}

if (differences === 0) {
  console.log('✅ SUCCESS: All 3 maps are identical!')
  console.log('   The generation is deterministic.')
} else {
  console.log(`❌ FAIL: Found ${differences} differences between maps.`)
  console.log('   The generation is NOT deterministic.')
}

// Sample a few cells to verify
console.log('\n=== Sample Cells (should be identical) ===')
const samples = [
  { x: 0, y: 0 },
  { x: 50, y: 50 },
  { x: 99, y: 99 },
  { x: 25, y: 75 }
]

samples.forEach(({ x, y }) => {
  console.log(`(${x}, ${y}): Map1=${map1[y][x].biome}, Map2=${map2[y][x].biome}, Map3=${map3[y][x].biome}`)
})

console.log('\n')
