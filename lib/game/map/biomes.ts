import { BiomeConfig, BiomeType } from './types'

export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  prairie: {
    name: 'prairie',
    baseColor: '#5d8a3a',
    textureColor: '#6b9c47',
    borderColor: '#4a6e2d',
    probability: 50
  },
  foret: {
    name: 'foret',
    baseColor: '#2d5016',
    textureColor: '#3a6620',
    borderColor: '#1f3b10',
    probability: 10
  },
  desert: {
    name: 'desert',
    baseColor: '#d4a373',
    textureColor: '#e0b589',
    borderColor: '#b88c5f',
    probability: 10
  },
  savane: {
    name: 'savane',
    baseColor: '#c4a661',
    textureColor: '#d2b676',
    borderColor: '#a88d4e',
    probability: 10
  },
  jungle: {
    name: 'jungle',
    baseColor: '#1a472a',
    textureColor: '#255a38',
    borderColor: '#123423',
    probability: 10
  },
  banquise: {
    name: 'banquise',
    baseColor: '#d4e9f7',
    textureColor: '#e3f2fb',
    borderColor: '#b5d4e8',
    probability: 10
  },
  montagne: {
    name: 'montagne',
    baseColor: '#6b6b6b',
    textureColor: '#7e7e7e',
    borderColor: '#4f4f4f',
    probability: 5
  },
  eau: {
    name: 'eau',
    baseColor: '#4a90c2',
    textureColor: '#5ba3d4',
    borderColor: '#3a7aa8',
    probability: 5
  }
}

export const BIOME_TEXTURES: Record<BiomeType, string> = {
  prairie: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)',
  foret: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
  desert: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 1px, transparent 2px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 1px, transparent 2px)',
  savane: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 6px)',
  jungle: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px), repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)',
  banquise: 'linear-gradient(135deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%, transparent)',
  montagne: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
  eau: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 16px)'
}

export const BIOME_IMAGES: Record<BiomeType, string> = {
  prairie: '/assets/prairie.png',
  foret: '/assets/forêt.png',
  desert: '/assets/desert.png',
  savane: '/assets/savane.png',
  jungle: '/assets/jungle.png',
  banquise: '/assets/banquise.png',
  montagne: '/assets/montagne.png',
  eau: '/assets/eau.png'
}
