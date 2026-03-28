// ============================================================
// solver-worker.js – ES-module Web Worker
// Runs DLX search, streams solutions back to main thread.
// ============================================================

import { buildPlacements } from './placements.js';
import { DLX } from './dlx.js';

let solutionCount = 0;

self.onmessage = async () => {
  try {
    self.postMessage({ type: 'status', text: 'Berechne Platzierungen…' });

    const { placements } = buildPlacements();
    self.postMessage({
      type: 'status',
      text: `${placements.length} Platzierungen gefunden. Starte DLX…`
    });

    const dlx = new DLX(placements);

    await dlx.search(async (rowIds) => {
      solutionCount++;
      // Decode solution: map rowId → placement info
      const pieces = rowIds.map(rid => {
        const { pieceId, cells } = placements[rid];
        return { pieceId, cells };
      });
      self.postMessage({ type: 'solution', solution: pieces, index: solutionCount });
    });

    self.postMessage({ type: 'done', total: solutionCount });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
