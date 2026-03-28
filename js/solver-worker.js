// ============================================================
// solver-worker.js – ES-module Web Worker
//
// Receives:  { start: true, slice?: { sliceA:[lo,hi], sliceB:[lo,hi] } }
// Posts:
//   { type:'status',   text }
//   { type:'solution', solution:[{pieceId,cells},...], index }
//   { type:'progress', nodeCount }
//   { type:'done',     total, nodeCount }
//   { type:'error',    message }
// ============================================================

import { buildTypePlacements } from './placements.js';
import { Solver }              from './solver.js';

let solutionCount = 0;

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ type: 'status', text: 'Berechne Platzierungen…' });

    const { placementsA, placementsB, cellToA, cellToB, coordsA, coordsB } =
      buildTypePlacements();

    self.postMessage({
      type: 'status',
      text: `${placementsA.length} A-Platzierungen, ${placementsB.length} B-Platzierungen. Starte Solver…`,
    });

    const solver = new Solver(
      placementsA, placementsB,
      cellToA, cellToB,
      coordsA, coordsB,
    );

    const slice = data.slice ?? null;   // optional parallel-slice restriction

    const nodeCount = await solver.search(
      async (pieces) => {
        solutionCount++;
        self.postMessage({ type: 'solution', solution: pieces, index: solutionCount });
      },
      (n) => {
        self.postMessage({ type: 'progress', nodeCount: n });
      },
      slice,
    );

    self.postMessage({ type: 'done', total: solutionCount, nodeCount });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message + '\n' + err.stack });
  }
};
