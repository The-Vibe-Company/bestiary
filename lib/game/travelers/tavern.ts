/**
 * Stay duration multiplier by tavern level.
 *
 * The tavern extends how long travelers remain at the village gates,
 * giving the player more time to welcome and assign them.
 *
 * - Level 0 (no tavern): normal stay (1×)
 * - Level 1: +50% stay duration (1.5×)
 * - Level 2: +100% stay duration (2×)
 * - Level 3: +150% stay duration (2.5×)
 */
export const TAVERN_STAY_MULTIPLIER: Record<number, number> = {
  0: 1,
  1: 1.5,
  2: 2,
  3: 2.5,
}
