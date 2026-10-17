/* Viewport: canvas sized to fit the nodes, zoom, and panning. */
const wrap = $('#canvasWrap'), sizer = $('#sizer');
const PAD = 200, GRID = 20, MIN_ZOOM = 0.2, MAX_ZOOM = 2;
let zoom = 1, bx = null, by = null; // bx/by: canvas coordinate shown at the sizer's top-left

/* Extent of all nodes in canvas coordinates, or null if there are none. */
function nodeBounds() {
  let b = null;
  canvas.querySelectorAll('.node').forEach(el => {
    const n = data.nodes[el.dataset.id];
    const r = { x0: n.x, y0: n.y, x1: n.x + el.offsetWidth, y1: n.y + el.offsetHeight };
    b = b ? { x0: Math.min(b.x0, r.x0), y0: Math.min(b.y0, r.y0), x1: Math.max(b.x1, r.x1), y1: Math.max(b.y1, r.y1) } : r;
  });
  return b;
}

/* Canvas coordinate currently at the viewport's top-left. */
function viewOrigin() { return { x: bx + wrap.scrollLeft / zoom, y: by + wrap.scrollTop / zoom }; }

/* Screen (client) point → canvas coordinates. */
function clientToCanvas(cx, cy) {
  const r = wrap.getBoundingClientRect(), v = viewOrigin();
  return { x: v.x + (cx - r.left) / zoom, y: v.y + (cy - r.top) / zoom };
}

/* Size the canvas to the nodes plus padding, always including the area being
   viewed, then scroll so (vx, vy) sits at the viewport's top-left. Because the
   view is part of the extent, growing or shrinking never makes the view jump. */
function updateBounds(vx, vy) {
  const b = nodeBounds() || { x0: 0, y0: 0, x1: 0, y1: 0 };
  if (vx === undefined) {
    if (bx === null) { vx = b.x0 - PAD; vy = b.y0 - PAD; }
    else ({ x: vx, y: vy } = viewOrigin());
  }
  const vw = wrap.clientWidth / zoom, vh = wrap.clientHeight / zoom;
  const x0 = Math.min(b.x0 - PAD, vx), y0 = Math.min(b.y0 - PAD, vy);
  const x1 = Math.max(b.x1 + PAD, vx + vw), y1 = Math.max(b.y1 + PAD, vy + vh);
  bx = x0; by = y0;

  sizer.style.width = (x1 - x0) * zoom + 'px';
  sizer.style.height = (y1 - y0) * zoom + 'px';
  sizer.style.backgroundSize = `${GRID * zoom}px ${GRID * zoom}px`;
  sizer.style.backgroundPosition = `${-bx * zoom}px ${-by * zoom}px`;
  canvas.style.transform = `scale(${zoom}) translate(${-bx}px, ${-by}px)`;
  wrap.scrollLeft = (vx - bx) * zoom; wrap.scrollTop = (vy - by) * zoom;
}

/* Zoom, keeping the point under the cursor fixed. */
function setZoom(z, mx = wrap.clientWidth / 2, my = wrap.clientHeight / 2) {
  z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const v = viewOrigin(), ax = v.x + mx / zoom, ay = v.y + my / zoom;
  zoom = z;
  updateBounds(ax - mx / zoom, ay - my / zoom);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
}

function fitView() {
  const b = nodeBounds(); if (!b) return;
  const w = b.x1 - b.x0 + 2 * PAD, h = b.y1 - b.y0 + 2 * PAD;
  zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min(wrap.clientWidth / w, wrap.clientHeight / h)));
  updateBounds(b.x0 - PAD, b.y0 - PAD);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
}

/* Center one node in the canvas viewport and select it. */
function jumpToNode(id) {
  const el = $('#el-' + id), n = data.nodes[id];
  if (!el || !n) return false;
  selectNode(id);
  const x = n.x + el.offsetWidth / 2 - wrap.clientWidth / zoom / 2;
  const y = n.y + el.offsetHeight / 2 - wrap.clientHeight / zoom / 2;
  updateBounds(x, y);
  return true;
}

/* Forget the old origin and highlights, e.g. after loading a different tree. */
function resetView() { bx = by = null; selectedId = null; activeId = null; }

/* Ctrl + wheel (and trackpad pinch) zooms; plain wheel scrolls as usual. */
wrap.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  setZoom(zoom * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

/* Left-drag empty space or middle-drag anywhere to pan. */
let pan = null;
wrap.addEventListener('mousedown', e => {
  if ((e.button !== 0 && e.button !== 1) || (e.button === 0 && e.target.closest('.node'))) return;
  e.preventDefault(); // don't start a text selection while panning
  pan = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
  wrap.classList.add('panning');
});
window.addEventListener('mousemove', e => {
  if (!pan) return;
  wrap.scrollLeft = pan.sl - (e.clientX - pan.x);
  wrap.scrollTop = pan.st - (e.clientY - pan.y);
});
window.addEventListener('mouseup', () => {
  if (pan) { pan = null; wrap.classList.remove('panning'); }
  updateBounds(); drawLinks(); // also catches textarea resizes
});
window.addEventListener('resize', () => updateBounds());

$('#zoomIn').onclick = () => setZoom(zoom * 1.2);
$('#zoomOut').onclick = () => setZoom(zoom / 1.2);
$('#zoomLabel').onclick = () => setZoom(1);
$('#zoomFit').onclick = fitView;
