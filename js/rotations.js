// ============================================================
// rotations.js – Generate all 24 axis-aligned 3D rotations
// ============================================================

// Each rotation is a 3×3 matrix stored row-major as a flat array [r00,r01,r02, r10,…, r22].
// Rotation matrices only contain -1, 0, +1 entries (orthogonal integer matrices).

function mat(a,b,c, d,e,f, g,h,i){ return [a,b,c,d,e,f,g,h,i]; }

// Basic 90° rotations around each axis
const Rx90 = mat(1,0,0,  0,0,-1,  0,1,0);
const Ry90 = mat(0,0,1,  0,1,0,  -1,0,0);
const Rz90 = mat(0,-1,0, 1,0,0,   0,0,1);

function mulMat(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[r*3+k] * B[k*3+c];
      C[r*3+c] = s;
    }
  return C;
}

function applyMat(M, x, y, z) {
  return [
    M[0]*x + M[1]*y + M[2]*z,
    M[3]*x + M[4]*y + M[5]*z,
    M[6]*x + M[7]*y + M[8]*z,
  ];
}

// Generate all 24 distinct rotation matrices
function generateAll24() {
  const seen = new Set();
  const result = [];
  const queue = [mat(1,0,0, 0,1,0, 0,0,1)]; // identity
  while (queue.length) {
    const M = queue.pop();
    const key = M.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(M);
    for (const R of [Rx90, Ry90, Rz90]) {
      queue.push(mulMat(R, M));
      queue.push(mulMat(M, R));
    }
  }
  return result; // exactly 24
}

export const ROT_MATRICES = generateAll24();

// Apply a rotation matrix to a list of [x,y,z] cells
export function applyRot(M, cells) {
  return cells.map(([x,y,z]) => applyMat(M, x, y, z));
}

// Translate so minimum coordinate on each axis = 0, then sort for canonical form
export function normalize(cells) {
  const minX = Math.min(...cells.map(c=>c[0]));
  const minY = Math.min(...cells.map(c=>c[1]));
  const minZ = Math.min(...cells.map(c=>c[2]));
  const shifted = cells.map(([x,y,z]) => [x-minX, y-minY, z-minZ]);
  shifted.sort((a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
  return shifted;
}

// Return array of deduplicated orientations (each as normalised cell list)
export function uniqueOrientations(cells) {
  const seen = new Set();
  const result = [];
  for (const M of ROT_MATRICES) {
    const rotated = normalize(applyRot(M, cells));
    const key = rotated.map(c=>c.join(',')).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rotated);
    }
  }
  return result;
}
