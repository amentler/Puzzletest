// ============================================================
// placements.js – Enumerate every valid placement of every piece
// ============================================================
// A placement = { pieceId, cells: [[x,y,z],...], mask: BigInt }
// mask = 125-bit BigInt with a 1 for every occupied cell
// cell index = x*25 + y*5 + z  (x,y,z ∈ [0,4])
//
// Returns:
//   placements[]          – all valid placement objects
//   placementsByCell[]    – for cell index i, list of placement indices
// ============================================================

import { SHAPE_A, SHAPE_B, PIECES_PER_SHAPE, PIECE_COUNT } from './pieces.js';
import { uniqueOrientations } from './rotations.js';

export const GRID = 5;
export const TOTAL_CELLS = GRID * GRID * GRID; // 125

export function cellIndex(x, y, z) { return x*25 + y*5 + z; }
export function cellCoord(idx)     {
  const x = (idx / 25) | 0;
  const y = ((idx % 25) / 5) | 0;
  const z = idx % 5;
  return [x, y, z];
}

function cellMask(cells) {
  let m = 0n;
  for (const [x,y,z] of cells) m |= (1n << BigInt(cellIndex(x,y,z)));
  return m;
}

function buildForShape(shape, pieceIdStart, pieceIdEnd) {
  const orientations = uniqueOrientations(shape);
  const result = [];

  for (const orient of orientations) {
    // Bounding box of this orientation
    const maxX = Math.max(...orient.map(c=>c[0]));
    const maxY = Math.max(...orient.map(c=>c[1]));
    const maxZ = Math.max(...orient.map(c=>c[2]));

    // Slide across all valid offsets
    for (let ox = 0; ox + maxX < GRID; ox++)
    for (let oy = 0; oy + maxY < GRID; oy++)
    for (let oz = 0; oz + maxZ < GRID; oz++) {
      const cells = orient.map(([x,y,z]) => [x+ox, y+oy, z+oz]);
      const mask  = cellMask(cells);

      // Add one placement per pieceId in range
      for (let pid = pieceIdStart; pid < pieceIdEnd; pid++) {
        result.push({ pieceId: pid, cells, mask });
      }
    }
  }
  return result;
}

export function buildPlacements() {
  const placements = [];

  // Shape A → pieceIds 0..5
  placements.push(...buildForShape(SHAPE_A, 0, PIECES_PER_SHAPE));
  // Shape B → pieceIds 6..11
  placements.push(...buildForShape(SHAPE_B, PIECES_PER_SHAPE, PIECE_COUNT));

  // Pre-index: for each cell, which placements cover it?
  const placementsByCell = Array.from({length: TOTAL_CELLS}, () => []);
  for (let i = 0; i < placements.length; i++) {
    for (const [x,y,z] of placements[i].cells) {
      placementsByCell[cellIndex(x,y,z)].push(i);
    }
  }

  return { placements, placementsByCell };
}
