export interface ShelfBookPlacement {
  readonly colorIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly thicknessScale: number;
  readonly lean: number;
}

const SHELF_FLOORS = [0.38, 0.66, 0.94, 1.22, 1.51, 1.79] as const;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function createShelfBookLayout(seed = 1930): ReadonlyArray<ShelfBookPlacement> {
  const random = seededRandom(seed);
  const placements: ShelfBookPlacement[] = [];
  for (let row = 0; row < SHELF_FLOORS.length; row += 1) {
    const count = 4 + Math.floor(random() * 3);
    const split = Math.ceil(count / 2);
    const cursors = [0.07 + random() * 0.05, 0.54 + random() * 0.05];
    for (let index = 0; index < count; index += 1) {
      const cluster = index < split ? 0 : 1;
      const scale = 0.103 + random() * 0.014;
      const thicknessScale = 1.45 + random() * 0.55;
      const thickness = 0.232 * scale * thicknessScale;
      const x = cursors[cluster]! + thickness / 2;
      cursors[cluster] = x + thickness / 2 + 0.009 + random() * 0.018;
      placements.push({
        colorIndex: (placements.length + Math.floor(random() * 4)) % 4,
        x,
        y: SHELF_FLOORS[row]! + 1.86 * scale / 2 + 0.006,
        z: 0.145 + random() * 0.026,
        scale,
        thicknessScale,
        lean: (random() - 0.5) * 0.11,
      });
    }
  }
  return placements;
}
