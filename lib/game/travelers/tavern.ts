/**
 * Stay duration multiplier by effective tavern level.
 *
 * Effective level = building level + assigned tavernkeepers (0 tavernkeepers → level 0).
 * The tavern extends how long travelers remain at the village gates,
 * giving the player more time to welcome and assign them.
 *
 * - Level 0: normal stay (1×)
 * - Level 1: +50% stay duration (1.5×)
 * - Level 2: +100% stay duration (2×)
 * - Level 3: +150% stay duration (2.5×)
 * - Level 4: +200% stay duration (3×)
 * - Level 5: +250% stay duration (3.5×)
 * - Level 6: +300% stay duration (4×)
 */
export const TAVERN_STAY_MULTIPLIER: Record<number, number> = {
  0: 1,
  1: 1.5,
  2: 2,
  3: 2.5,
  4: 3,
  5: 3.5,
  6: 4,
}
