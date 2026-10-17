/* User settings, stored in localStorage and applied live. */
const SETTINGS_KEY = 'npc-dialogue-studio-settings-v1';
const DEFAULT_SETTINGS = {
  snap: false, grid: true, confirmDelete: true, defaultSpeaker: 'NPC',
  typewriter: false, textSpeed: 45, accent: '#7c8cff', textSize: 14, theme: 'system',
  aiUrl: '', // Questline AI worker URL (worker/README.md); blank = built-in
  geminiKey: '', aiModel: 'gemini-3.5-flash-lite', // own-key mode: calls Gemini directly from this browser
  hideAi: false, // hides every .ai-only element and the AI right-click entries
};
const ACCENTS = { Periwinkle: '#7c8cff', Violet: '#a77cff', Teal: '#3cc7b4', Gold: '#d6a84f', Rose: '#ff7aa2' };

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }
let settings = loadSettings();

function defaultSpeaker() { return settings.defaultSpeaker.trim() || 'NPC'; }

function applySettings() {
  // 'system' follows the OS (prefers-color-scheme); light/dark force it. See the tokens in styles.css.
  if (settings.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
  const root = document.documentElement.style;
  root.setProperty('--accent', settings.accent);
  root.setProperty('--line', settings.accent);
  document.body.style.fontSize = settings.textSize + 'px';
  document.body.classList.toggle('no-grid', !settings.grid);
  document.body.classList.toggle('no-ai', settings.hideAi);
  // Node sizes depend on text size, so re-measure the canvas if it's showing.
  if (!$('#studio').hidden) { updateBounds(); drawLinks(); }
}

/* ---------- settings window ---------- */
const settingsModal = $('#settingsModal'), swatches = $('#swatches');
swatches.innerHTML = Object.entries(ACCENTS).map(([name, c]) =>
  `<button type="button" class="swatch" data-color="${c}" title="${name}" aria-label="${name}" style="background:${c}"></button>`).join('');

function fillSettings() {
  settingsModal.querySelectorAll('[data-set]').forEach(el => {
    const v = settings[el.dataset.set];
    if (el.type === 'checkbox') el.checked = v; else el.value = v;
  });
  swatches.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.color === settings.accent));
}
function openSettings() { fillSettings(); settingsModal.hidden = false; settingsModal.querySelector('input, select')?.focus(); }
function closeSettings() { settingsModal.hidden = true; }

settingsModal.addEventListener('input', e => {
  const el = e.target, key = el.dataset.set; if (!key) return;
  settings[key] = el.type === 'checkbox' ? el.checked : 'num' in el.dataset ? +el.value : el.value;
  saveSettings(); applySettings();
});
swatches.addEventListener('click', e => {
  const s = e.target.closest('.swatch'); if (!s) return;
  settings.accent = s.dataset.color;
  saveSettings(); applySettings(); fillSettings();
});
$('#resetSettings').onclick = async () => {
  if (!await ask('Reset settings?', 'All settings go back to their defaults. Your stories are not affected.', { ok: 'Reset' })) return;
  settings = { ...DEFAULT_SETTINGS };
  saveSettings(); applySettings(); fillSettings();
};
$('#clearData').onclick = async () => {
  if (!await ask('Delete all saved data?', 'This permanently deletes your current story, every named save and your settings from this browser.', { ok: 'Delete everything', danger: true })) return;
  try { [KEY, SAVES_KEY, SETTINGS_KEY].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  location.reload(); // start completely fresh
};

$('#settingsClose').onclick = closeSettings;
settingsModal.addEventListener('mousedown', e => { if (e.target === settingsModal) closeSettings(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !settingsModal.hidden) closeSettings(); });
$('#settingsBtn').onclick = openSettings;
$('#menuSettings').onclick = openSettings;

applySettings();
