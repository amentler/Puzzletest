// ============================================================
// stepview.js – Bottom-to-top step-by-step build view
// ============================================================
// Pieces are sorted by their lowest y-coordinate (gravity order).
// The slider controls how many pieces are visible (0..12).
// ============================================================

export class StepView {
  constructor(renderer) {
    this._renderer = renderer;
    this._solution = null;
    this._order    = []; // pieceIds sorted by min-y (ascending)
    this._step     = 12;
  }

  /** Load a new solution and reset to show all pieces */
  setSolution(solution) {
    this._solution = solution;

    // Sort pieces: lowest min-y (most bottom) first.
    // Within same min-y, sort by pieceId for determinism.
    this._order = solution.slice().sort((a, b) => {
      const minYa = Math.min(...a.cells.map(c => c[2])); // puzzle z = scene height
      const minYb = Math.min(...b.cells.map(c => c[2]));
      return minYa - minYb || a.pieceId - b.pieceId;
    });

    this._step = this._order.length;
    this._apply();
  }

  /** Set how many pieces to show (0 = none, 12 = all) */
  setStep(n) {
    this._step = Math.max(0, Math.min(n, this._order.length));
    this._apply();
  }

  get step()  { return this._step; }
  get total() { return this._order.length; }

  _apply() {
    if (!this._solution) return;
    const visible = new Set(
      this._order.slice(0, this._step).map(p => p.pieceId)
    );
    this._renderer.showPieces(visible, this._solution);
  }
}
