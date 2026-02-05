export type MapFeature = 'foret' | 'montagne'

export interface MapCell {
  x: number
  y: number
  feature: MapFeature | null // null = prairie simple
}

export type WorldMap = MapCell[][]
