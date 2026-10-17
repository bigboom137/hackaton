/* Toolbar: add node, import/export, reset. */
$('#addNode').onclick = () => {
  const w = $('#canvasWrap');
  newNode(bx + (w.scrollLeft + 40) / zoom + Math.random() * 60, by + (w.scrollTop + 40) / zoom + Math.random() * 60);
  render();
};

function exportData() {
  const out = { start: data.start, nodes: {} };
  for (const [id, n] of Object.entries(data.nodes))
    out.nodes[id] = { speaker: n.speaker, text: n.text, choices: n.choices.map(c => ({ text: c.text, next: c.to || null })) };
  return out;
}

$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' }));
  a.download = 'dialogue.json'; a.click(); URL.revokeObjectURL(a.href);
};

$('#exportJs').onclick = async () => {
  const code = 'const dialogue = ' + JSON.stringify(exportData(), null, 2) + ';\n';
  try { await navigator.clipboard.writeText(code); $('#status').textContent = 'Copied!'; } catch (e) { prompt('Copy:', code); }
};

$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), nodes = {}; let i = 0;
    for (const [id, n] of Object.entries(j.nodes)) {
      nodes[id] = { speaker: n.speaker || '', text: n.text || '', x: n.x ?? 40 + (i % 4) * 320, y: n.y ?? 40 + Math.floor(i / 4) * 260,
        choices: (n.choices || []).map(c => ({ text: c.text || '', to: c.next || c.to || '' })) };
      i++;
    }
    const nums = Object.keys(nodes).map(k => parseInt(k.replace(/\D/g, '')) || 0);
    data = { start: j.start, nodes, counter: Math.max(0, ...nums) + Object.keys(nodes).length };
    resetView(); render(); restart();
  } catch (err) { alert('Invalid file: ' + err.message); }
  e.target.value = '';
};

function replaceStory(fresh, question) {
  if (!confirm(question)) return;
  data = fresh(); resetView(); render(); restart();
}
$('#newBtn').onclick = () => replaceStory(blank, 'Start a blank story? Unsaved changes will be lost.');
$('#resetBtn').onclick = () => replaceStory(sample, 'Load the example story? Unsaved changes will be lost.');

/* Toolbar dropdown: opens on click, closes on item pick, outside click or Esc. */
const menuToggle = $('#menuToggle'), menuPanel = $('#menuPanel');
function setMenu(open) { menuPanel.hidden = !open; menuToggle.setAttribute('aria-expanded', open); }
menuToggle.onclick = e => { e.stopPropagation(); setMenu(menuPanel.hidden); };
menuPanel.addEventListener('click', e => { if (e.target.closest('button')) setMenu(false); });
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) setMenu(false); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
