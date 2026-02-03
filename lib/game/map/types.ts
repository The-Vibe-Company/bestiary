export type BiomeType =
  | 'prairie'
  | 'foret'
  | 'desert'
  | 'savane'
  | 'jungle'
  | 'banquise'
  | 'montagne'
  | 'eau'

export interface MapCell {
  x: number
  y: number
  biome: BiomeType
}

export type WorldMap = MapCell[][]

export interface BiomeConfig {
  name: BiomeType
  baseColor: string
  textureColor: string
  borderColor: string
  probability: number
}
