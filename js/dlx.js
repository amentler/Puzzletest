// ============================================================
// dlx.js – Dancing Links (Algorithm X) exact-cover solver
// ============================================================
// Primary columns   (must be covered exactly once):
//   125..136  → piece-presence constraints (12 pieces)
//
// Secondary columns (at-most-once, enforce non-overlap):
//   0..124    → cell-occupancy constraints (125 cells)
//
// 6×8 + 6×12 = 120 cells are placed; 5 cells remain empty.
// Using secondary columns for cells allows the solver to leave
// those 5 cells uncovered while still preventing overlaps.
//
// Optimisations:
//  • S-heuristic  – always choose the piece column with fewest rows
//  • Dead-end     – piece column reaches size 0 → backtrack immediately
//  • Periodic yield so the worker stays responsive
// ============================================================

import { PIECE_COUNT } from './pieces.js';
import { TOTAL_CELLS, buildPlacements } from './placements.js';

const NUM_COLS      = TOTAL_CELLS + PIECE_COUNT; // 137
const YIELD_INTERVAL = 20_000;

class DLX {
  constructor(placements) {
    this._placements = placements;
    this._nodes = [];
    this._cols  = [];
    this._head  = -1;
    this._build(placements);
  }

  _newNode(C = -1, rowId = -1) {
    const idx = this._nodes.length;
    this._nodes.push({ L: idx, R: idx, U: idx, D: idx, C, rowId, size: 0 });
    return idx;
  }

  _build(placements) {
    const N = this._nodes;

    // Master header
    this._head = this._newNode();
    const head = this._head;

    // Column headers linked horizontally: head ↔ col0 ↔ … ↔ col136 ↔ head
    let prev = head;
    for (let c = 0; c < NUM_COLS; c++) {
      const col = this._newNode(c); // N[col].C = column ID c
      N[col].L = prev;
      N[col].R = head;
      N[prev].R = col;
      N[head].L = col;
      prev = col;
      this._cols.push(col);
    }

    // Add one row per placement
    for (let ri = 0; ri < placements.length; ri++) {
      const { pieceId, cells } = placements[ri];

      // Column IDs this row covers: cell columns + piece column
      const colIds = cells.map(([x, y, z]) => x * 25 + y * 5 + z);
      colIds.push(TOTAL_CELLS + pieceId);

      let firstNode = -1;
      let prevNode  = -1;
      for (const cid of colIds) {
        const col = this._cols[cid];    // column header node index
        const nd  = this._newNode(col, ri); // N[nd].C = col header node index

        // Insert nd at the bottom of col's vertical list
        const colTop = N[col].U;
        N[nd].U    = colTop;
        N[nd].D    = col;
        N[colTop].D = nd;
        N[col].U   = nd;
        N[col].size++;

        // Link nd horizontally within row (circular doubly-linked list)
        if (firstNode === -1) {
          firstNode = nd;
          prevNode  = nd;
        } else {
          N[nd].L      = prevNode;
          N[nd].R      = firstNode;
          N[prevNode].R = nd;
          N[firstNode].L = nd;
          prevNode = nd;
        }
      }
    }
  }

  // Remove column c and all rows that cover it from the matrix
  _cover(c) {
    const N = this._nodes;
    N[N[c].R].L = N[c].L;
    N[N[c].L].R = N[c].R;
    for (let i = N[c].D; i !== c; i = N[i].D) {
      for (let j = N[i].R; j !== i; j = N[j].R) {
        N[N[j].D].U = N[j].U;
        N[N[j].U].D = N[j].D;
        N[N[j].C].size--;
      }
    }
  }

  // Reverse of _cover (must be called in reverse order of cover)
  _uncover(c) {
    const N = this._nodes;
    for (let i = N[c].U; i !== c; i = N[i].U) {
      for (let j = N[i].L; j !== i; j = N[j].L) {
        N[N[j].C].size++;
        N[N[j].D].U = j;
        N[N[j].U].D = j;
      }
    }
    N[N[c].R].L = c;
    N[N[c].L].R = c;
  }

  // S-heuristic: choose the PRIMARY piece column with fewest rows.
  // Cell columns (C < TOTAL_CELLS) are secondary – skip them here.
  _chooseCol() {
    const N = this._nodes;
    let best = -1, bestSize = Infinity;
    for (let c = N[this._head].R; c !== this._head; c = N[c].R) {
      if (N[c].C < TOTAL_CELLS) continue; // secondary cell column – skip
      if (N[c].size < bestSize) {
        bestSize = N[c].size;
        best = c;
        if (bestSize === 0) break; // can't do better; also signals dead end
      }
    }
    // best === -1 means no piece columns remain → solution found
    return { col: best, size: bestSize };
  }

  // Async search: calls onSolution(rowIds[]) for every complete solution.
  // Optionally calls onProgress(nodeCount) every YIELD_INTERVAL nodes.
  async search(onSolution, onProgress = null) {
    const N        = this._nodes;
    const solution = [];
    let nodeCount  = 0;

    const recurse = async () => {
      const { col, size } = this._chooseCol();

      if (col === -1) {
        // All 12 piece columns covered → valid placement of all pieces
        await onSolution(solution.slice());
        return;
      }

      if (size === 0) return; // this piece has no remaining valid placements

      nodeCount++;
      if (nodeCount % YIELD_INTERVAL === 0) {
        if (onProgress) onProgress(nodeCount);
        await new Promise(r => setTimeout(r, 0)); // yield to event loop
      }

      this._cover(col);
      for (let r = N[col].D; r !== col; r = N[r].D) {
        solution.push(N[r].rowId);
        // Cover all other columns (cell columns) used by this placement
        for (let j = N[r].R; j !== r; j = N[j].R) this._cover(N[j].C);

        await recurse();

        // Backtrack
        for (let j = N[r].L; j !== r; j = N[j].L) this._uncover(N[j].C);
        solution.pop();
      }
      this._uncover(col);
    };

    await recurse();
  }
}

export { DLX };
