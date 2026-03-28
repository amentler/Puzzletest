// ============================================================
// solver.js – Custom recursive 3-D puzzle solver
// ============================================================
//
// Optimisations implemented
// ─────────────────────────
// 1. Type-based counting (symmetry breaking)
//    Track remA / remB instead of 12 individual piece IDs.
//    Eliminates 6!×6! = 518 400 identical-piece permutations per
//    geometrically unique solution.
//
// 2. Cell-first branching
//    Always fill the FIRST free cell in scan order (cell 0 → 124).
//    Branching factor = placements covering that one cell, which is
//    much smaller than "all placements of all remaining pieces".
//    Dead ends are detected immediately when no piece covers the
//    first free cell and no empty allowance remains.
//
// 3. Transposition table (dead-end cache)
//    Board state is hashed with Zobrist hashing (two independent
//    32-bit values for a 64-bit effective key).  States proven to
//    have no solution are stored; future visits return instantly.
//
// 4. Precomputed cell→placements index (Int32Array per cell)
//    From buildTypePlacements() in placements.js.
//    O(1) candidate lookup per cell; no scans across all placements.
//
// 5. TypedArray flat storage
//    Placements and cell-index lists are Int32Array / Uint8Array.
//    Avoids JS object overhead and improves CPU cache utilisation.
//
// 6. Parallel workers
//    The search() method accepts an optional { sliceA, sliceB }
//    parameter that restricts which candidates are tried for the
//    very first free cell.  main.js spawns N workers each with a
//    disjoint slice, spreading top-level work across CPU cores.
// ============================================================

import { cellCoord } from './placements.js';

const YIELD_INTERVAL = 20_000;   // yield to event loop every N nodes
const EMPTY_PIECES   = 5;        // cells allowed to stay unoccupied
const PIECES_PER_TYPE = 6;

// ── Zobrist tables (seeded once, module-level) ────────────────────────────
// Four Int32Arrays of 125 entries:
//   ZOC_H/L  – cell occupied (by any piece type)
//   ZEM_H/L  – cell explicitly marked empty
function makeZobrist() {
  const a = new Int32Array(125);
  for (let i = 0; i < 125; i++) a[i] = (Math.random() * 0x100000000) | 0;
  return a;
}
const ZOC_H = makeZobrist();
const ZOC_L = makeZobrist();
const ZEM_H = makeZobrist();
const ZEM_L = makeZobrist();

// ── Solver class ─────────────────────────────────────────────────────────

export class Solver {
  /**
   * @param {Int32Array[]} placementsA  – flat cell-index arrays for shape A
   * @param {Int32Array[]} placementsB  – flat cell-index arrays for shape B
   * @param {Int32Array[]} cellToA      – per-cell lists of placementsA indices
   * @param {Int32Array[]} cellToB      – per-cell lists of placementsB indices
   * @param {Array}        coordsA      – [[x,y,z],...] per A placement (for rendering)
   * @param {Array}        coordsB      – [[x,y,z],...] per B placement (for rendering)
   */
  constructor(placementsA, placementsB, cellToA, cellToB, coordsA, coordsB) {
    this._pA = placementsA;
    this._pB = placementsB;
    this._cA = cellToA;
    this._cB = cellToB;
    this._coordsA = coordsA;
    this._coordsB = coordsB;
  }

  /**
   * Run the search.
   *
   * @param {function} onSolution  called with [{pieceId, cells},...] per solution
   * @param {function} onProgress  called with (nodeCount) periodically
   * @param {object}   [slice]     { workerIndex:k, numWorkers:N }
   *                               stride-based split for parallel workers:
   *                               worker k handles candidates at indices k, k+N, k+2N, …
   *                               for the very first free cell only (depth 0)
   */
  async search(onSolution, onProgress = null, slice = null) {
    const pA = this._pA, pB = this._pB;
    const cA = this._cA, cB = this._cB;
    const coordsA = this._coordsA, coordsB = this._coordsB;

    // ── Board state ────────────────────────────────────────────
    const board = new Uint8Array(125); // 0=free 1=occupied 2=empty-marker

    // ── Zobrist running hash ───────────────────────────────────
    let zH = 0, zL = 0;

    // ── Dead-end cache (2-level, 64-bit effective key) ─────────
    // Map<hi:uint32, Set<lo:uint32>>
    const deadEnds = new Map();

    // ── Solution accumulator ───────────────────────────────────
    // Each entry: { type:'A'|'B', pi: placement-index }
    const stack  = new Array(12);
    let   depth  = 0;

    // ── Counters ───────────────────────────────────────────────
    let nodeCount     = 0;
    let solutionCount = 0;

    // ── Helpers ────────────────────────────────────────────────

    const fits = (placement) => {
      for (let k = 0; k < placement.length; k++)
        if (board[placement[k]] !== 0) return false;
      return true;
    };

    const placeOn = (placement) => {
      for (let k = 0; k < placement.length; k++) {
        board[placement[k]] = 1;
        zH ^= ZOC_H[placement[k]];
        zL ^= ZOC_L[placement[k]];
      }
    };

    const unplace = (placement) => {
      for (let k = 0; k < placement.length; k++) {
        board[placement[k]] = 0;
        zH ^= ZOC_H[placement[k]]; // XOR again = undo
        zL ^= ZOC_L[placement[k]];
      }
    };

    const markEmpty = (cell) => {
      board[cell] = 2;
      zH ^= ZEM_H[cell];
      zL ^= ZEM_L[cell];
    };

    const unmarkEmpty = (cell) => {
      board[cell] = 0;
      zH ^= ZEM_H[cell];
      zL ^= ZEM_L[cell];
    };

    const isDead = (hi, lo) => {
      const inner = deadEnds.get(hi);
      return inner !== undefined && inner.has(lo);
    };

    const addDead = (hi, lo) => {
      let inner = deadEnds.get(hi);
      if (inner === undefined) { inner = new Set(); deadEnds.set(hi, inner); }
      inner.add(lo);
    };

    // ── Emit a solution ────────────────────────────────────────
    const emitSolution = async () => {
      solutionCount++;
      let aIdx = 0, bIdx = 0;
      const pieces = [];
      for (let d = 0; d < depth; d++) {
        const { type, pi } = stack[d];
        const coords = type === 'A' ? coordsA[pi] : coordsB[pi];
        pieces.push({
          pieceId: type === 'A' ? aIdx++ : (PIECES_PER_TYPE + bIdx++),
          cells:   coords,
        });
      }
      await onSolution(pieces);
    };

    // ── Main recursive search ──────────────────────────────────
    const recurse = async (remA, remB, emptyLeft) => {
      // Dead-end cache check
      // Encode remA (0-6), remB (0-6), emptyLeft (0-5) into 9 bits
      const meta = (remA << 6) | (remB << 3) | emptyLeft;
      const hi   = ((zH ^ meta) >>> 0);
      const lo   = (zL >>> 0);
      if (isDead(hi, lo)) return;

      // Find first free cell
      let firstFree = -1;
      for (let i = 0; i < 125; i++) {
        if (board[i] === 0) { firstFree = i; break; }
      }

      // Base case: all pieces placed
      if (remA === 0 && remB === 0) {
        await emitSolution();
        return;
      }

      // No free cells but pieces remain → dead end
      if (firstFree === -1) {
        addDead(hi, lo);
        return;
      }

      const beforeCount = solutionCount;

      // At depth 0 only, apply optional stride-based parallel split:
      //   slice = { workerIndex: k, numWorkers: N }
      //   Worker k handles every N-th candidate (index ≡ k mod N).
      //   Subsequent depths are unconstrained → workers explore disjoint subtrees.
      const stride = (slice !== null && depth === 0) ? slice.numWorkers : 1;
      const offset = (slice !== null && depth === 0) ? slice.workerIndex : 0;

      // ── Try shape-A placements covering firstFree ──────────
      if (remA > 0) {
        const candidates = cA[firstFree];
        for (let k = offset; k < candidates.length; k += stride) {
          const pi = candidates[k];
          if (!fits(pA[pi])) continue;
          placeOn(pA[pi]);
          stack[depth++] = { type: 'A', pi };
          await recurse(remA - 1, remB, emptyLeft);
          depth--;
          unplace(pA[pi]);
        }
      }

      // ── Try shape-B placements covering firstFree ──────────
      if (remB > 0) {
        const candidates = cB[firstFree];
        for (let k = offset; k < candidates.length; k += stride) {
          const pi = candidates[k];
          if (!fits(pB[pi])) continue;
          placeOn(pB[pi]);
          stack[depth++] = { type: 'B', pi };
          await recurse(remA, remB - 1, emptyLeft);
          depth--;
          unplace(pB[pi]);
        }
      }

      // ── Option: leave firstFree explicitly empty ───────────
      // Only allowed if we still have empty allowance.
      if (emptyLeft > 0) {
        markEmpty(firstFree);
        await recurse(remA, remB, emptyLeft - 1);
        unmarkEmpty(firstFree);
      }

      // If no solution was found in ANY branch, cache this as a dead end
      if (solutionCount === beforeCount) addDead(hi, lo);

      // Yield / progress reporting
      nodeCount++;
      if (nodeCount % YIELD_INTERVAL === 0) {
        if (onProgress) onProgress(nodeCount);
        await new Promise(r => setTimeout(r, 0));
      }
    };

    await recurse(PIECES_PER_TYPE, PIECES_PER_TYPE, EMPTY_PIECES);
    return nodeCount;
  }
}
