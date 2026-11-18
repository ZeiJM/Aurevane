/** Visible working outskirts, separate from immutable town safety/collision.
 * Each offset joins the existing 3x3 core; river towns and walled towns keep
 * their own asymmetric approaches rather than acquiring another square ring. */
export const TOWN_OUTSKIRTS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'aureth-crown': [
    [-2, -1],
    [-2, 0],
    [-2, 1],
    [2, 0],
    [2, 1],
  ],
  'verdant-expanse': [
    [-2, -1],
    [-2, 0],
    [-2, 1],
  ],
  emberreach: [[2, 1]],
  frostmere: [],
  'glasswind-desert': [
    [0, -2],
    [1, -2],
  ],
  'hollow-coast': [
    [2, -1],
    [2, 0],
    [2, 1],
    [1, 2],
  ],
  'starfall-highlands': [[-1, -2]],
  'umbral-march': [
    [-1, 2],
    [0, 2],
    [1, 2],
  ],
}
