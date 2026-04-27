export const ITEM_RARITIES = ['commun', 'rare', 'epique', 'legendaire', 'mythique'] as const

export type ItemRarity = (typeof ITEM_RARITIES)[number]

/** Cumulative probability thresholds — normalized from 40/7/2/0.8/0.2 weights */
export const RARITY_THRESHOLDS: { rarity: ItemRarity; cumulative: number }[] = [
  { rarity: 'mythique', cumulative: 0.004 },     // 0.4%
  { rarity: 'legendaire', cumulative: 0.020 },   // 1.6%
  { rarity: 'epique', cumulative: 0.060 },       // 4%
  { rarity: 'rare', cumulative: 0.200 },         // 14%
  { rarity: 'commun', cumulative: 1.000 },       // 80%
]

export const RARITY_LABELS: Record<ItemRarity, string> = {
  commun: 'Commun',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
  mythique: 'Mythique',
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  commun: 'var(--color-rarity-commun)',
  rare: 'var(--color-rarity-rare)',
  epique: 'var(--color-rarity-epique)',
  legendaire: 'var(--color-rarity-legendaire)',
  mythique: 'var(--color-rarity-mythique)',
}

