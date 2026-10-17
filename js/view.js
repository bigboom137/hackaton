/* Viewport: canvas sized to fit the nodes, zoom, and panning. */
const wrap = $('#canvasWrap'), sizer = $('#sizer');
const PAD = 200, GRID = 20, MIN_ZOOM = 0.2, MAX_ZOOM = 2;
let zoom = 1, bx = null, by = null; // bx/by: canvas coordinate shown at the sizer's top-left

/* Recompute the canvas extent from the node positions. Keeps the view steady
   when the top/left edge moves, so nodes don't jump while dragging. */
function updateBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  canvas.querySelectorAll('.node').forEach(el => {
    const n = data.nodes[el.dataset.id];
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + el.offsetWidth); maxY = Math.max(maxY, n.y + el.offsetHeight);
  });
  if (minX === Infinity) minX = minY = maxX = maxY = 0;

  const nbx = minX - PAD, nby = minY - PAD;
  const dx = bx === null ? 0 : (bx - nbx) * zoom, dy = by === null ? 0 : (by - nby) * zoom;
  bx = nbx; by = nby;

  const w = (maxX - minX + 2 * PAD) * zoom, h = (maxY - minY + 2 * PAD) * zoom;
  sizer.style.width = Math.max(w, wrap.clientWidth) + 'px';
  sizer.style.height = Math.max(h, wrap.clientHeight) + 'px';
  sizer.style.backgroundSize = `${GRID * zoom}px ${GRID * zoom}px`;
  sizer.style.backgroundPosition = `${-bx * zoom}px ${-by * zoom}px`;
  canvas.style.transform = `scale(${zoom}) translate(${-bx}px, ${-by}px)`;
  wrap.scrollLeft += dx; wrap.scrollTop += dy;
}

/* Zoom, keeping the point under (mx, my) — relative to the viewport — fixed. */
function setZoom(z, mx = wrap.clientWidth / 2, my = wrap.clientHeight / 2) {
  z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const cx = (wrap.scrollLeft + mx) / zoom, cy = (wrap.scrollTop + my) / zoom;
  zoom = z;
  updateBounds();
  wrap.scrollLeft = cx * zoom - mx; wrap.scrollTop = cy * zoom - my;
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
}

function fitView() {
  const w = parseFloat(sizer.style.width) / zoom, h = parseFloat(sizer.style.height) / zoom;
  setZoom(Math.min(1, wrap.clientWidth / w, wrap.clientHeight / h));
  wrap.scrollLeft = wrap.scrollTop = 0;
}

/* Forget the old origin, e.g. after loading a different tree. */
function resetView() { bx = by = null; wrap.scrollLeft = wrap.scrollTop = 0; }

/* Ctrl + wheel (and trackpad pinch) zooms; plain wheel scrolls as usual. */
wrap.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  setZoom(zoom * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

/* Drag empty space to pan. */
let pan = null;
wrap.addEventListener('mousedown', e => {
  if (e.button !== 0 || e.target.closest('.node')) return;
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
window.addEventListener('resize', updateBounds);

$('#zoomIn').onclick = () => setZoom(zoom * 1.2);
$('#zoomOut').onclick = () => setZoom(zoom / 1.2);
$('#zoomLabel').onclick = () => setZoom(1);
$('#zoomFit').onclick = fitView;
