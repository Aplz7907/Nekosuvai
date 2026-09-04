/**
 * Uniform-grid broadphase over an unbounded world.
 * Cells are hashed into a fixed table, so lookups may return false positives
 * from hash collisions — callers must still do the exact distance test.
 */
const TABLE_BITS = 12;
const TABLE_SIZE = 1 << TABLE_BITS;
const MASK = TABLE_SIZE - 1;

export class SpatialHash {
  private readonly head = new Int32Array(TABLE_SIZE);
  private readonly next: Int32Array;

  constructor(
    private readonly cellSize: number,
    capacity: number,
  ) {
    this.next = new Int32Array(capacity);
    this.clear();
  }

  clear(): void {
    this.head.fill(-1);
  }

  private static key(cx: number, cz: number): number {
    return (Math.imul(cx, 92837111) ^ Math.imul(cz, 689287499)) & MASK;
  }

  insert(index: number, x: number, z: number): void {
    const k = SpatialHash.key(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize));
    this.next[index] = this.head[k];
    this.head[k] = index;
  }

  /** Appends candidate indices near (x,z) into `out`. Returns the count written. */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    const cs = this.cellSize;
    const minX = Math.floor((x - radius) / cs);
    const maxX = Math.floor((x + radius) / cs);
    const minZ = Math.floor((z - radius) / cs);
    const maxZ = Math.floor((z + radius) / cs);
    let n = 0;
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        let i = this.head[SpatialHash.key(cx, cz)];
        while (i !== -1) {
          if (n >= out.length) return n;
          out[n++] = i;
          i = this.next[i];
        }
      }
    }
    return n;
  }
}
