// ============================================================
// pieces.js – Puzzle piece shape definitions
//
// To change the shapes: edit SHAPE_A and/or SHAPE_B.
// Each shape is a list of [x, y, z] cell offsets (0-based,
// relative to an arbitrary origin; they will be normalised).
//
// SHAPE_A → used for pieces 0–5  (6 copies)
// SHAPE_B → used for pieces 6–11 (6 copies)
// ============================================================

// Shape A: 4×2×1 flat block (8 cells)
//
//  z=0:
//   X X X X   (y=0)
//   X X X X   (y=1)
//
export const SHAPE_A = [
  [0,0,0],[1,0,0],[2,0,0],[3,0,0],
  [0,1,0],[1,1,0],[2,1,0],[3,1,0],
];

// Shape B: 4×2×2 with 2×2 cutout in the middle of the top layer (12 cells)
//
//  z=0 (base):       z=1 (top):
//   X X X X           X o o X
//   X X X X           X o o X
//
export const SHAPE_B = [
  // base layer (z=0)
  [0,0,0],[1,0,0],[2,0,0],[3,0,0],
  [0,1,0],[1,1,0],[2,1,0],[3,1,0],
  // top layer (z=1) – only outer columns
  [0,0,1],[3,0,1],
  [0,1,1],[3,1,1],
];

// Derived constants (do not edit)
export const PIECE_COUNT = 12;
export const PIECES_PER_SHAPE = 6;
// pieceId 0–5  → SHAPE_A
// pieceId 6–11 → SHAPE_B
export function shapeForPiece(pieceId) {
  return pieceId < PIECES_PER_SHAPE ? SHAPE_A : SHAPE_B;
}
