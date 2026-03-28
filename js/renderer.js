// ============================================================
// renderer.js – Three.js 3D scene
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PIECE_COUNT } from './pieces.js';

// 12 visually distinct colors (HSL, spread across hue wheel)
export const PIECE_COLORS = Array.from({ length: PIECE_COUNT }, (_, i) => {
  const hue = (i / PIECE_COUNT) * 360;
  return new THREE.Color(`hsl(${hue}, 75%, 55%)`);
});

export class Renderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._scene    = new THREE.Scene();
    this._camera   = null;
    this._renderer = null;
    this._controls = null;
    this._meshGroups = []; // one Group per piece
    this._init();
  }

  _init() {
    const canvas = this._canvas;
    const W = canvas.clientWidth  || 800;
    const H = canvas.clientHeight || 600;

    // Renderer
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(W, H, false);
    this._renderer.setClearColor(0x0f1117);

    // Camera
    this._camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    this._camera.position.set(9, 9, 9);
    this._camera.lookAt(2.5, 2.5, 2.5);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 15, 10);
    this._scene.add(ambient, dir);

    // Grid helper at y = -0.5 (beneath the cube)
    const grid = new THREE.GridHelper(6, 6, 0x2d3148, 0x2d3148);
    grid.position.set(2, -0.5, 2);
    this._scene.add(grid);

    // Orbit controls
    this._controls = new OrbitControls(this._camera, canvas);
    this._controls.target.set(2.5, 2.5, 2.5);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.update();

    // Resize observer
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(canvas.parentElement);

    this._animate();
  }

  _onResize() {
    const el = this._canvas.parentElement;
    const W = el.clientWidth;
    const H = el.clientHeight;
    this._renderer.setSize(W, H, false);
    this._camera.aspect = W / H;
    this._camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._controls.update();
    this._renderer.render(this._scene, this._camera);
  }

  // ── Public API ─────────────────────────────────────────────

  /** Replace scene content with the given solution.
   *  solution = [{ pieceId, cells: [[x,y,z],...] }, ...]
   *  visiblePieces = Set of pieceIds to show (undefined → show all)
   */
  renderSolution(solution, visiblePieces) {
    // Remove old piece groups
    for (const g of this._meshGroups) this._scene.remove(g);
    this._meshGroups = [];

    if (!solution) return;

    const showAll = visiblePieces === undefined;
    const geo = new THREE.BoxGeometry(0.88, 0.88, 0.88);

    for (const { pieceId, cells } of solution) {
      if (!showAll && !visiblePieces.has(pieceId)) continue;

      const mat = new THREE.MeshLambertMaterial({ color: PIECE_COLORS[pieceId] });
      const group = new THREE.Group();

      for (const [x, y, z] of cells) {
        const mesh = new THREE.Mesh(geo, mat);
        // Map grid coords to scene: x→x, y→z(height), z→y(depth)
        // We treat puzzle-y as depth (Z in scene) and puzzle-z as height (Y in scene)
        mesh.position.set(x, z, y);
        group.add(mesh);
      }
      this._scene.add(group);
      this._meshGroups.push(group);
    }
  }

  /** Show only pieces whose IDs are in the provided Set */
  showPieces(visibleSet, solution) {
    this.renderSolution(solution, visibleSet);
  }
}
