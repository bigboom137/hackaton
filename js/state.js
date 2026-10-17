/* Shared state, persistence and helpers. Loaded first. */
const KEY = 'npc-dialogue-studio-v1';
const $ = s => document.querySelector(s);

function sample() {
  return {
    start: 'n1', counter: 4,
    nodes: {
      n1: { speaker: 'Guard', text: 'Halt! State your business in Eldoria.', x: 40, y: 40,
            choices: [{ text: 'I seek the king.', to: 'n2' }, { text: 'Just passing through.', to: 'n3' }] },
      n2: { speaker: 'Guard', text: 'The king sees no one today. Come back tomorrow.', x: 400, y: 20, choices: [] },
      n3: { speaker: 'Guard', text: 'Then move along, traveler. And keep your sword sheathed.', x: 400, y: 240, choices: [] },
    }
  };
}

/* A fresh story: one empty start node, ready to write. */
function blank() {
  return { start: 'n1', counter: 1, nodes: { n1: { speaker: defaultSpeaker(), text: '', x: 40, y: 40, choices: [] } } };
}

function load() {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
  return sample();
}
let historyUndoStack = [], historyRedoStack = [], historyCurrent = '';
let historyGroup = null, historyGroupTime = 0, historyRestoring = false;
let actionToastTimer = null;

function setSaveStatus(message, state) {
  const el = $('#saveStatus');
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}
function showActionToast(message) {
  const el = $('#actionToast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(actionToastTimer);
  actionToastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function initializeHistory() {
  historyCurrent = JSON.stringify(data);
  updateHistoryControls();
}
function updateHistoryControls() {
  const undo = $('#undoBtn'), redo = $('#redoBtn');
  if (undo) undo.disabled = historyUndoStack.length === 0;
  if (redo) redo.disabled = historyRedoStack.length === 0;
}
function recordHistory(group = null) {
  if (historyRestoring) return;
  const next = JSON.stringify(data);
  if (next === historyCurrent) {
    if (!group) historyGroup = null;
    return;
  }
  const now = Date.now();
  const coalesce = group && group === historyGroup && now - historyGroupTime < 900;
  if (!coalesce) historyUndoStack.push(historyCurrent);
  historyRedoStack.length = 0;
  historyCurrent = next;
  historyGroup = group;
  historyGroupTime = now;
  updateHistoryControls();
}
function restoreHistory(snapshot) {
  historyRestoring = true;
  try {
    data = JSON.parse(snapshot);
    historyCurrent = snapshot;
    historyGroup = null;
    if (selectedId && !data.nodes[selectedId]) selectedId = null;
    if (activeId && !data.nodes[activeId]) activeId = null;
    if (typeof render === 'function') render();
    if (typeof restart === 'function') restart();
  } finally {
    historyRestoring = false;
  }
  updateHistoryControls();
}
function undo() {
  if (!historyUndoStack.length) return;
  historyRedoStack.push(historyCurrent);
  restoreHistory(historyUndoStack.pop());
}
function redo() {
  if (!historyRedoStack.length) return;
  historyUndoStack.push(historyCurrent);
  restoreHistory(historyRedoStack.pop());
}
function save(group = null) {
  if (!historyRestoring) recordHistory(group);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    setSaveStatus('Saved in this browser', 'saved');
  } catch (e) { setSaveStatus('Could not save locally', 'error'); }
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

let data = load();
let activeId = null;
let selectedId = null;
initializeHistory();

$('#undoBtn').onclick = undo;
$('#redoBtn').onclick = redo;
const shortcutsModal = $('#shortcutsModal');
let shortcutsReturnFocus = null;
function closeShortcuts() {
  shortcutsModal.hidden = true;
  shortcutsReturnFocus?.focus?.();
}
$('#shortcutsBtn').onclick = () => {
  shortcutsReturnFocus = document.activeElement;
  shortcutsModal.hidden = false;
  $('#shortcutsClose').focus();
};
$('#shortcutsClose').onclick = closeShortcuts;
shortcutsModal.addEventListener('click', e => { if (e.target === shortcutsModal) closeShortcuts(); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !shortcutsModal.hidden) { closeShortcuts(); return; }
  if ($('#studio').hidden || !(e.ctrlKey || e.metaKey) || e.altKey || document.querySelector('.modal:not([hidden])')) return;
  const key = e.key.toLowerCase();
  if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (key === 'y') { e.preventDefault(); redo(); }
});
