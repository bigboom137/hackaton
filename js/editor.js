/* Node canvas: rendering, editing, links and dragging. */
const canvas = $('#canvas'), svg = $('#links');

function render() {
  canvas.querySelectorAll('.node').forEach(n => n.remove());
  const ids = Object.keys(data.nodes);
  for (const id of ids) {
    const n = data.nodes[id];
    const el = document.createElement('div');
    el.className = 'node' + (id === data.start ? ' start' : '') + (id === activeId ? ' active' : '') + (id === selectedId ? ' selected' : '');
    el.id = 'el-' + id;
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    const opts = (sel) => `<option value="">— end —</option>` +
      ids.map(o => `<option value="${o}" ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
    el.innerHTML = `
      <div class="head" data-drag="${id}">
        <span class="id" title="Double-click to rename">${esc(id)}</span>
        <input data-f="speaker" value="${esc(n.speaker)}" placeholder="Speaker">
        <button class="mini" data-act="start" title="Set as start">▶</button>
        <button class="mini" data-act="del" title="Delete node">✕</button>
      </div>
      <div class="body">
        <textarea data-f="text" placeholder="What does the NPC say?">${esc(n.text)}</textarea>
        ${n.choices.map((c, i) => `
          <div class="choice" data-i="${i}">
            <input data-c="text" value="${esc(c.text)}" placeholder="Player reply">
            <select data-c="to">${opts(c.to)}</select>
            <button class="mini" data-act="rmchoice">−</button>
          </div>`).join('')}
        <div><button class="ghost" data-act="addchoice">+ Choice</button>
        <button class="ghost" data-act="addlinked" title="Add choice leading to a new node">+ Choice → new node</button></div>
      </div>`;
    el.dataset.id = id;
    canvas.appendChild(el);
  }
  updateBounds();
  drawLinks();
  validate();
  save();
}

function drawLinks() {
  let html = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" style="fill:var(--line)"/></marker></defs>`;
  for (const [id, n] of Object.entries(data.nodes)) {
    const a = $('#el-' + id);
    n.choices.forEach((c, i) => {
      const b = c.to && $('#el-' + c.to);
      if (!a || !b) return;
      const row = a.querySelectorAll('.choice')[i];
      const x1 = a.offsetLeft + a.offsetWidth, y1 = a.offsetTop + (row ? row.offsetTop + row.offsetHeight / 2 : 20);
      const x2 = b.offsetLeft, y2 = b.offsetTop + 20;
      const dx = Math.max(40, Math.abs(x2 - x1) / 2);
      html += `<path d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}" fill="none" style="stroke:var(--line)" stroke-width="2" marker-end="url(#ah)"/>`;
    });
  }
  svg.innerHTML = html;
}

function validate() {
  const msgs = [];
  if (!data.nodes[data.start]) msgs.push('No start node');
  for (const [id, n] of Object.entries(data.nodes))
    n.choices.forEach(c => { if (c.to && !data.nodes[c.to]) msgs.push(`${id} links to missing ${c.to}`); });
  $('#status').textContent = msgs.join(' · ');
}

function newNode(x, y) {
  let id;
  do id = 'n' + (++data.counter); while (data.nodes[id]); // skip ids taken by renamed nodes
  data.nodes[id] = { speaker: defaultSpeaker(), text: '', x, y, choices: [] };
  if (!data.start) data.start = id;
  return id;
}

canvas.addEventListener('input', e => {
  const el = e.target.closest('.node'); if (!el) return;
  const n = data.nodes[el.dataset.id];
  if (e.target.dataset.f) n[e.target.dataset.f] = e.target.value;
  if (e.target.dataset.c) n.choices[+e.target.closest('.choice').dataset.i][e.target.dataset.c] = e.target.value;
  save();
});
canvas.addEventListener('change', e => { if (e.target.dataset.c === 'to') render(); });

/* Selection: follows the mouse press and keyboard focus; cleared by empty-canvas click or Esc. */
function selectNode(id) {
  selectedId = id;
  canvas.querySelectorAll('.node').forEach(node => node.classList.toggle('selected', node.dataset.id === id));
}
canvas.addEventListener('focusin', e => { const el = e.target.closest('.node'); if (el) selectNode(el.dataset.id); });
$('#canvasWrap').addEventListener('pointerdown', e => {
  const el = e.target.closest('.node');
  if (el) selectNode(el.dataset.id);
  else if (e.button === 0) selectNode(null);
});
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('.modal:not([hidden])') || $('#studio').hidden) return;
  if (canvas.contains(document.activeElement)) document.activeElement.blur();
  selectNode(null);
});

canvas.addEventListener('click', e => {
  const act = e.target.dataset.act; if (!act) return;
  const el = e.target.closest('.node'), id = el.dataset.id, n = data.nodes[id];
  if (act === 'start') data.start = id;
  else if (act === 'addchoice') n.choices.push({ text: '', to: '' });
  else if (act === 'addlinked') { addLinked(id); return; }
  else if (act === 'rmchoice') n.choices.splice(+e.target.closest('.choice').dataset.i, 1);
  else if (act === 'del') { deleteNode(id); return; }
  render();
});

async function deleteNode(id) {
  if (settings.confirmDelete && !await ask(`Delete node ${id}?`, 'Choices that lead here will become conversation endings.', { ok: 'Delete', danger: true })) return;
  delete data.nodes[id];
  if (selectedId === id) selectedId = null;
  for (const o of Object.values(data.nodes)) o.choices.forEach(c => { if (c.to === id) c.to = ''; });
  if (data.start === id) data.start = Object.keys(data.nodes)[0] || '';
  render();
}

function addLinked(id) {
  const n = data.nodes[id];
  const to = newNode(n.x + 320, n.y + n.choices.length * 120);
  n.choices.push({ text: '', to });
  render();
}

function duplicateNode(id) {
  const n = data.nodes[id], copy = newNode(n.x + 30, n.y + 30);
  Object.assign(data.nodes[copy], { speaker: n.speaker, text: n.text, choices: n.choices.map(c => ({ ...c })) });
  selectedId = copy;
  render();
}

/* Renaming changes the node's id, so every reference to it is updated too. */
function renameNode(oldId, newId) {
  if (oldId === newId) return;
  const nodes = {};
  for (const [k, v] of Object.entries(data.nodes)) nodes[k === oldId ? newId : k] = v; // keep order
  data.nodes = nodes;
  for (const n of Object.values(nodes)) n.choices.forEach(c => { if (c.to === oldId) c.to = newId; });
  if (data.start === oldId) data.start = newId;
  if (selectedId === oldId) selectedId = newId;
  if (activeId === oldId) activeId = newId;
  render();
}

async function promptRename(id) {
  const name = await askText('Rename node', 'The id is used by links and in the exported JSON.', {
    value: id, ok: 'Rename',
    validate: v => !v ? 'Enter a name.'
      : v.length > 32 ? 'Keep it to 32 characters or fewer.'
      : !/^[\w-]+$/.test(v) ? 'Use letters, numbers, - or _ only (no spaces).'
      : v !== id && data.nodes[v] ? `"${v}" is already used by another node.` : '',
  });
  if (name !== null) renameNode(id, name);
}
canvas.addEventListener('dblclick', e => {
  const label = e.target.closest('.id');
  if (label) promptRename(label.closest('.node').dataset.id);
});

/* Right-click menus. Text fields keep the browser's menu so copy/paste still work. */
function nodeMenu(id) {
  return [
    { label: 'Rename…', hint: 'dbl-click id', action: () => promptRename(id) },
    { label: 'Set as start', disabled: data.start === id, action: () => { data.start = id; render(); } },
    { label: 'Preview from here', action: () => previewFrom(id) },
    '-',
    { label: 'Add choice', action: () => { data.nodes[id].choices.push({ text: '', to: '' }); render(); } },
    { label: 'Add choice → new node', action: () => addLinked(id) },
    { label: 'Duplicate', action: () => duplicateNode(id) },
    '-',
    { label: 'Delete node', danger: true, action: () => deleteNode(id) },
  ];
}
function canvasMenu(x, y) {
  return [
    { label: 'Add node here', action: () => { selectedId = newNode(x, y); render(); } },
    '-',
    { label: 'Fit all nodes', action: fitView },
    { label: 'Reset zoom to 100%', action: () => setZoom(1) },
  ];
}
$('#canvasWrap').addEventListener('contextmenu', e => {
  if (e.target.closest('input, textarea')) return;
  e.preventDefault();
  const el = e.target.closest('.node');
  if (el) { selectNode(el.dataset.id); showContextMenu(e.clientX, e.clientY, nodeMenu(el.dataset.id)); }
  else { const p = clientToCanvas(e.clientX, e.clientY); showContextMenu(e.clientX, e.clientY, canvasMenu(p.x, p.y)); }
});

/* drag nodes */
let drag = null;
canvas.addEventListener('pointerdown', e => {
  const el = e.target.closest('.node');
  if (!el || e.button !== 0 || e.target.closest('input,textarea,select,button')) return;
  e.preventDefault(); // don't start a text selection while dragging
  // preventDefault also stops the browser moving focus, so drop focus left in another node.
  if (!el.contains(document.activeElement)) document.activeElement?.blur();
  const n = data.nodes[el.dataset.id], v = viewOrigin();
  drag = { el, n, pointerId: e.pointerId, mx: e.clientX, my: e.clientY, cx: e.clientX, cy: e.clientY, x0: n.x, y0: n.y, vx0: v.x, vy0: v.y };
  drag.raf = requestAnimationFrame(edgeScroll);
});

/* Node follows the pointer, accounting for any scrolling since the drag began. */
function moveDrag() {
  const v = viewOrigin();
  let x = drag.x0 + (v.x - drag.vx0) + (drag.cx - drag.mx) / zoom;
  let y = drag.y0 + (v.y - drag.vy0) + (drag.cy - drag.my) / zoom;
  if (settings.snap) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; }
  drag.n.x = x; drag.n.y = y;
  drag.el.style.left = drag.n.x + 'px'; drag.el.style.top = drag.n.y + 'px';
  updateBounds();
  drawLinks();
}

/* While dragging near (or past) the viewport edge, scroll that way. */
const EDGE = 40, EDGE_SPEED = 18;
function edgeSpeed(p, lo, hi) {
  if (p < lo + EDGE) return -Math.min(EDGE_SPEED, (lo + EDGE - p) / 3);
  if (p > hi - EDGE) return Math.min(EDGE_SPEED, (p - hi + EDGE) / 3);
  return 0;
}
function edgeScroll() {
  if (!drag) return;
  if (!drag.moved) { drag.raf = requestAnimationFrame(edgeScroll); return; }
  const r = wrap.getBoundingClientRect();
  const sx = edgeSpeed(drag.cx, r.left, r.right), sy = edgeSpeed(drag.cy, r.top, r.bottom);
  if (sx || sy) {
    const v = viewOrigin();
    updateBounds(v.x + sx / zoom, v.y + sy / zoom);
    moveDrag();
  }
  drag.raf = requestAnimationFrame(edgeScroll);
}

window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.cx = e.clientX; drag.cy = e.clientY;
  drag.moved ||= Math.hypot(drag.cx - drag.mx, drag.cy - drag.my) > 5;
  moveDrag();
});
function finishDrag(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  cancelAnimationFrame(drag.raf); drag = null; save();
}
window.addEventListener('pointerup', finishDrag);
window.addEventListener('pointercancel', finishDrag);
