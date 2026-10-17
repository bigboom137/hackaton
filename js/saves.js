/* Named save slots kept in localStorage, separate from the autosave in state.js. */
const SAVES_KEY = 'npc-dialogue-studio-saves-v1';
const savesModal = $('#savesModal'), savesList = $('#savesList'), saveForm = $('#saveForm'), saveName = $('#saveName');

function readSaves() {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || []; } catch (e) { return []; }
}
function writeSaves(saves) {
  try { localStorage.setItem(SAVES_KEY, JSON.stringify(saves)); return true; }
  catch (e) { alert('Could not save: browser storage is full or blocked.'); return false; }
}

function saveSlot(name) {
  const saves = readSaves();
  const existing = saves.find(s => s.name === name);
  if (existing && !confirm(`Overwrite the save "${name}"?`)) return;
  const slot = { name, savedAt: Date.now(), data: JSON.parse(JSON.stringify(data)) };
  if (existing) Object.assign(existing, slot); else saves.unshift(slot);
  if (writeSaves(saves)) renderSaves();
}

function loadSlot(i) {
  const slot = readSaves()[i]; if (!slot) return;
  const inStudio = !studio.hidden;
  if (inStudio && !confirm(`Load "${slot.name}"? Unsaved changes to the current story will be lost.`)) return;
  data = JSON.parse(JSON.stringify(slot.data));
  resetView();
  closeSaves();
  if (inStudio) { render(); restart(); } else openStudio();
}

function deleteSlot(i) {
  const saves = readSaves();
  if (!saves[i] || !confirm(`Delete the save "${saves[i].name}"?`)) return;
  saves.splice(i, 1);
  if (writeSaves(saves)) renderSaves();
}

function renderSaves() {
  const saves = readSaves();
  savesList.innerHTML = saves.length ? saves.map((s, i) => `
    <li>
      <div><strong>${esc(s.name)}</strong>
        <small>${new Date(s.savedAt).toLocaleString()} · ${Object.keys(s.data.nodes || {}).length} nodes</small></div>
      <button data-load="${i}">Load</button>
      <button class="ghost" data-delete="${i}" title="Delete save">✕</button>
    </li>`).join('') : `<li class="empty">No saves yet.</li>`;
}

function openSaves() {
  saveForm.hidden = studio.hidden; // saving only makes sense from the studio
  renderSaves();
  savesModal.hidden = false;
  if (!saveForm.hidden) { saveName.value = ''; saveName.focus(); }
}
function closeSaves() { savesModal.hidden = true; }

saveForm.onsubmit = e => {
  e.preventDefault();
  const name = saveName.value.trim(); if (!name) return;
  saveSlot(name); saveName.value = '';
};
savesList.onclick = e => {
  if (e.target.dataset.load) loadSlot(+e.target.dataset.load);
  else if (e.target.dataset.delete) deleteSlot(+e.target.dataset.delete);
};
savesModal.onclick = e => { if (e.target === savesModal) closeSaves(); };
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !savesModal.hidden) closeSaves(); });
$('#savesClose').onclick = closeSaves;
$('#savesBtn').onclick = openSaves;
$('#menuLoad').onclick = openSaves;
