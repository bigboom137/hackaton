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
  return { start: 'n1', counter: 1, nodes: { n1: { speaker: 'NPC', text: '', x: 40, y: 40, choices: [] } } };
}

function load() {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
  return sample();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

let data = load();
let activeId = null;
