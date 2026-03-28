// ============================================================
// placements.js – Enumerate valid placements per shape type
// ============================================================

import { SHAPE_A, SHAPE_B, PIECES_PER_SHAPE, PIECE_COUNT } from './pieces.js';
import { uniqueOrientations } from './rotations.js';

export const GRID        = 5;
export const TOTAL_CELLS = GRID * GRID * GRID; // 125

export function cellIndex(x, y, z) { return x * 25 + y * 5 + z; }
export function cellCoord(idx) {
  return [(idx / 25) | 0, ((idx % 25) / 5) | 0, idx % 5];
}

// ── Legacy buildPlacements() (kept for dlx.js compatibility) ──────────────
export function buildPlacements() {
  const placements = [];

  const addShape = (shape, idStart, idEnd) => {
    for (const orient of uniqueOrientations(shape)) {
      const maxX = Math.max(...orient.map(c => c[0]));
      const maxY = Math.max(...orient.map(c => c[1]));
      const maxZ = Math.max(...orient.map(c => c[2]));
      for (let ox = 0; ox + maxX < GRID; ox++)
      for (let oy = 0; oy + maxY < GRID; oy++)
      for (let oz = 0; oz + maxZ < GRID; oz++) {
        const cells = orient.map(([x, y, z]) => [x + ox, y + oy, z + oz]);
        for (let pid = idStart; pid < idEnd; pid++)
          placements.push({ pieceId: pid, cells });
      }
    }
  };

  addShape(SHAPE_A, 0, PIECES_PER_SHAPE);
  addShape(SHAPE_B, PIECES_PER_SHAPE, PIECE_COUNT);

  const placementsByCell = Array.from({ length: TOTAL_CELLS }, () => []);
  for (let i = 0; i < placements.length; i++)
    for (const [x, y, z] of placements[i].cells)
      placementsByCell[cellIndex(x, y, z)].push(i);

  return { placements, placementsByCell };
}

// ── buildTypePlacements() – optimised, type-centric ──────────────────────
//
// Returns flat Int32Arrays (cache-friendly, no object overhead):
//
//   placementsA[i]  Int32Array of cell-indices for placement i of shape A
//   placementsB[i]  Int32Array of cell-indices for placement i of shape B
//   cellToA[c]      Int32Array of placement indices (into placementsA) that cover cell c
//   cellToB[c]      same for shape B
//
// No per-piece-ID duplication: all 6 A-pieces are identical, so we store
// each spatial position only ONCE.  The solver tracks remaining counts.
//
// Also returns coordsA / coordsB: [[x,y,z],...] per placement (for rendering).

export function buildTypePlacements() {
  const { flatPlacements: placementsA, coordsList: coordsA } =
    buildFlatForShape(SHAPE_A);
  const { flatPlacements: placementsB, coordsList: coordsB } =
    buildFlatForShape(SHAPE_B);

  const cellToA = buildCellIndex(placementsA);
  const cellToB = buildCellIndex(placementsB);

  return { placementsA, placementsB, cellToA, cellToB, coordsA, coordsB };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function buildFlatForShape(shape) {
  const flatPlacements = []; // Array of Int32Array
  const coordsList     = []; // Array of [[x,y,z],...]

  for (const orient of uniqueOrientations(shape)) {
    const maxX = Math.max(...orient.map(c => c[0]));
    const maxY = Math.max(...orient.map(c => c[1]));
    const maxZ = Math.max(...orient.map(c => c[2]));

    for (let ox = 0; ox + maxX < GRID; ox++)
    for (let oy = 0; oy + maxY < GRID; oy++)
    for (let oz = 0; oz + maxZ < GRID; oz++) {
      const coords = orient.map(([x, y, z]) => [x + ox, y + oy, z + oz]);
      const flat   = new Int32Array(coords.map(([x, y, z]) => cellIndex(x, y, z)));
      flatPlacements.push(flat);
      coordsList.push(coords);
    }
  }
  return { flatPlacements, coordsList };
}

function buildCellIndex(flatPlacements) {
  // For each cell, collect placement indices covering it
  const raw = Array.from({ length: TOTAL_CELLS }, () => []);
  for (let i = 0; i < flatPlacements.length; i++)
    for (const ci of flatPlacements[i])
      raw[ci].push(i);
  // Convert to Int32Array for cache-friendliness
  return raw.map(arr => new Int32Array(arr));
}
