/* Node canvas: rendering, editing, links and dragging. */
const canvas = $('#canvas'), svg = $('#links');

function render() {
  canvas.querySelectorAll('.node').forEach(n => n.remove());
  const ids = Object.keys(data.nodes);
  for (const id of ids) {
    const n = data.nodes[id];
    const el = document.createElement('div');
    el.className = 'node' + (id === data.start ? ' start' : '') + (id === activeId ? ' active' : '');
    el.id = 'el-' + id;
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    const opts = (sel) => `<option value="">— end —</option>` +
      ids.map(o => `<option value="${o}" ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
    el.innerHTML = `
      <div class="head" data-drag="${id}">
        <span class="id">${id}</span>
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
  let html = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#7c8cff"/></marker></defs>`;
  for (const [id, n] of Object.entries(data.nodes)) {
    const a = $('#el-' + id);
    n.choices.forEach((c, i) => {
      const b = c.to && $('#el-' + c.to);
      if (!a || !b) return;
      const row = a.querySelectorAll('.choice')[i];
      const x1 = a.offsetLeft + a.offsetWidth, y1 = a.offsetTop + (row ? row.offsetTop + row.offsetHeight / 2 : 20);
      const x2 = b.offsetLeft, y2 = b.offsetTop + 20;
      const dx = Math.max(40, Math.abs(x2 - x1) / 2);
      html += `<path d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}" fill="none" stroke="#7c8cff" stroke-width="2" marker-end="url(#ah)"/>`;
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
  const id = 'n' + (++data.counter);
  data.nodes[id] = { speaker: 'NPC', text: '', x, y, choices: [] };
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

canvas.addEventListener('click', e => {
  const act = e.target.dataset.act; if (!act) return;
  const el = e.target.closest('.node'), id = el.dataset.id, n = data.nodes[id];
  if (act === 'start') data.start = id;
  else if (act === 'addchoice') n.choices.push({ text: '', to: '' });
  else if (act === 'addlinked') {
    const to = newNode(n.x + 320, n.y + n.choices.length * 120);
    n.choices.push({ text: '', to });
  }
  else if (act === 'rmchoice') n.choices.splice(+e.target.closest('.choice').dataset.i, 1);
  else if (act === 'del') {
    if (!confirm(`Delete node ${id}?`)) return;
    delete data.nodes[id];
    for (const o of Object.values(data.nodes)) o.choices.forEach(c => { if (c.to === id) c.to = ''; });
    if (data.start === id) data.start = Object.keys(data.nodes)[0] || '';
  }
  render();
});

/* drag nodes */
let drag = null;
canvas.addEventListener('mousedown', e => {
  const h = e.target.closest('.head');
  if (!h || e.target.closest('input,button')) return;
  e.preventDefault(); // don't start a text selection while dragging
  const el = h.parentElement, n = data.nodes[el.dataset.id];
  drag = { el, n, mx: e.clientX, my: e.clientY, x0: n.x, y0: n.y };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  drag.n.x = drag.x0 + (e.clientX - drag.mx) / zoom; drag.n.y = drag.y0 + (e.clientY - drag.my) / zoom;
  drag.el.style.left = drag.n.x + 'px'; drag.el.style.top = drag.n.y + 'px';
  updateBounds();
  drawLinks();
});
window.addEventListener('mouseup', () => { if (drag) { drag = null; save(); } });
