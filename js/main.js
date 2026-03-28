// ============================================================
// main.js – Entry point: wires worker ↔ renderer ↔ stepview ↔ UI
// ============================================================

import { Renderer, PIECE_COLORS } from './renderer.js';
import { StepView }               from './stepview.js';
import { PIECE_COUNT, PIECES_PER_SHAPE } from './pieces.js';

// ── DOM refs ──────────────────────────────────────────────────
const canvas        = document.getElementById('c');
const spinner       = document.getElementById('spinner');
const statusText    = document.getElementById('status-text');
const solutionCount = document.getElementById('solution-count');
const nodeCountEl   = document.getElementById('node-count');
const solutionNav   = document.getElementById('solution-nav');
const solutionLabel = document.getElementById('solution-label');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const stepControls  = document.getElementById('step-controls');
const stepSlider    = document.getElementById('step-slider');
const stepLabel     = document.getElementById('step-label');
const legendEl      = document.getElementById('legend');

// ── State ─────────────────────────────────────────────────────
const solutions = [];
let currentIdx  = 0;
let renderer    = null;
let stepView    = null;

// ── Renderer & StepView ───────────────────────────────────────
renderer = new Renderer(canvas);
stepView = new StepView(renderer);

// ── Legend ────────────────────────────────────────────────────
function buildLegend() {
  legendEl.innerHTML = '';
  for (let i = 0; i < PIECE_COUNT; i++) {
    const color = '#' + PIECE_COLORS[i].getHexString();
    const type  = i < PIECES_PER_SHAPE ? 'A' : 'B';
    const item  = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML =
      `<span class="legend-swatch" style="background:${color}"></span>` +
      `<span>T${i+1} (${type})</span>`;
    legendEl.appendChild(item);
  }
  legendEl.classList.remove('hidden');
}

// ── Show a solution ───────────────────────────────────────────
function showSolution(idx) {
  currentIdx = idx;
  const sol  = solutions[idx];
  solutionLabel.textContent = `Lösung ${idx + 1} / ${solutions.length}`;
  btnPrev.disabled = idx === 0;
  btnNext.disabled = idx === solutions.length - 1;

  stepView.setSolution(sol);
  stepSlider.max   = stepView.total;
  stepSlider.value = stepView.total;
  updateStepLabel(stepView.total);
}

function updateStepLabel(n) {
  if (n === 0)                 stepLabel.textContent = 'Keine Teile';
  else if (n === stepView.total) stepLabel.textContent = 'Alle Teile';
  else                          stepLabel.textContent = `${n} / ${stepView.total} Teile`;
}

// ── Navigation buttons ────────────────────────────────────────
btnPrev.addEventListener('click', () => {
  if (currentIdx > 0) showSolution(currentIdx - 1);
});
btnNext.addEventListener('click', () => {
  if (currentIdx < solutions.length - 1) showSolution(currentIdx + 1);
});

// ── Step slider ───────────────────────────────────────────────
stepSlider.addEventListener('input', () => {
  const n = parseInt(stepSlider.value, 10);
  stepView.setStep(n);
  updateStepLabel(n);
});

// ── Worker ────────────────────────────────────────────────────
function startWorker() {
  // ES-module workers require type:'module'
  const worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = ({ data }) => {
    switch (data.type) {
      case 'status':
        statusText.textContent = data.text;
        break;

      case 'solution': {
        solutions.push(data.solution);
        solutionCount.textContent = `${solutions.length} Lösung${solutions.length > 1 ? 'en' : ''} gefunden`;

        if (solutions.length === 1) {
          // First solution: set up UI
          spinner.classList.add('hidden');
          solutionNav.classList.remove('hidden');
          stepControls.classList.remove('hidden');
          buildLegend();
          showSolution(0);
          statusText.textContent = 'Erste Lösung angezeigt – suche weitere…';
        } else {
          // Update nav
          solutionLabel.textContent = `Lösung ${currentIdx + 1} / ${solutions.length}`;
          btnNext.disabled = currentIdx === solutions.length - 1;
        }
        break;
      }

      case 'progress':
        nodeCountEl.textContent = `${data.nodeCount.toLocaleString('de-DE')} Knoten versucht`;
        break;

      case 'done':
        statusText.textContent =
          data.total === 0
            ? 'Keine Lösung gefunden.'
            : `Fertig – ${data.total} Lösung${data.total > 1 ? 'en' : ''} gefunden.`;
        solutionLabel.textContent = `Lösung ${currentIdx + 1} / ${solutions.length}`;
        btnNext.disabled = currentIdx === solutions.length - 1;
        break;

      case 'error':
        spinner.classList.add('hidden');
        statusText.textContent = `Fehler: ${data.message}`;
        console.error('Worker error:', data.message);
        break;
    }
  };

  worker.onerror = (e) => {
    spinner.classList.add('hidden');
    statusText.textContent = `Worker-Fehler: ${e.message}`;
    console.error(e);
  };

  // Kick off the solver
  worker.postMessage({ start: true });
}

startWorker();
