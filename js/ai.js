/* AI dialogue generation via the Questline AI worker (see worker/README.md).
   The worker holds the Gemini key; this file asks it for dialogue, then checks and lays out
   whatever comes back, since a model can return ids that don't line up. */

const AI_DEFAULT_URL = 'https://questline-ai.questline-ai.workers.dev'; // used when Settings → AI is blank
let aiRunning = false;
const aiToast = document.createElement('div');
aiToast.className = 'ai-toast';
aiToast.setAttribute('role', 'status');
aiToast.hidden = true;
aiToast.innerHTML = '<span class="ai-spinner" aria-hidden="true"></span><span>AI is writing…</span>';
document.body.appendChild(aiToast);

const clip = (v, max) => String(v ?? '').trim().slice(0, max);

/* Run an AI request: straight to Gemini with the user's own key if they set one (it never
   leaves this browser except to Google), otherwise through the worker.
   Returns the parsed JSON, or null after showing the problem to the user. */
async function callAI(body) {
  if (aiRunning) return null;
  // Own key: from Settings, else from the gitignored js/local-config.js (local testing only).
  const key = settings.geminiKey.trim() || window.QUESTLINE_LOCAL?.geminiKey || '';
  const url = settings.aiUrl.trim() || AI_DEFAULT_URL;
  aiRunning = true; aiToast.hidden = false;
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 90000);
  try {
    if (key) {
      return await QuestlineAI.callGemini(key, settings.aiModel || QuestlineAI.DEFAULT_MODEL, QuestlineAI.buildRequest(body), abort.signal);
    }
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: abort.signal,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `The AI server returned HTTP ${res.status}.`);
    return out;
  } catch (err) {
    const where = key ? 'Google' : 'the AI server';
    const msg = err.name === 'AbortError' ? 'The AI took too long to answer. Try again.'
      : err instanceof TypeError ? `Couldn't reach ${where}. Check your connection${key ? '' : ' and the URL in Settings → AI'}. (${err.message})`
      : key && /api key|permission|unauthenticated/i.test(err.message) ? `${err.message}\n\nCheck the Gemini API key in Settings → AI.`
      : err.message;
    notify('AI request failed', msg);
    return null;
  } finally {
    clearTimeout(timer); aiRunning = false; aiToast.hidden = true;
  }
}

/* ---------- whole story ---------- */

/* Turn the AI's { start, nodes: [...] } into a studio story: clean ids, drop broken links, lay it out. */
function storyFromAI(tree) {
  const raw = (Array.isArray(tree?.nodes) ? tree.nodes : []).slice(0, 40);
  if (!raw.length) throw new Error('The AI returned no dialogue.');
  const idMap = new Map(), used = new Set();
  raw.forEach((n, i) => {
    const base = String(n.id ?? '').replace(/[^\w-]/g, '_').slice(0, 32) || `n${i + 1}`;
    let id = base, k = 2;
    while (used.has(id)) id = `${base.slice(0, 28)}_${k++}`;
    used.add(id);
    if (!idMap.has(String(n.id))) idMap.set(String(n.id), id);
    n._id = id;
  });
  const nodes = {};
  for (const n of raw) {
    nodes[n._id] = {
      speaker: clip(n.speaker, 40) || defaultSpeaker(), text: clip(n.text, 600), x: 0, y: 0,
      choices: (Array.isArray(n.choices) ? n.choices : []).slice(0, 6)
        .map(c => ({ text: clip(c.text, 200), to: idMap.get(String(c.to)) || '' })),
    };
  }
  const start = idMap.get(String(tree.start)) || raw[0]._id;
  layoutTree(nodes, start);
  return { start, counter: Object.keys(nodes).length, nodes };
}

/* Columns by distance from the start; nodes the start can't reach go in a final column. */
function layoutTree(nodes, start) {
  const depth = { [start]: 0 }, queue = [start];
  while (queue.length) {
    const id = queue.shift();
    for (const c of nodes[id].choices) if (c.to && !(c.to in depth)) { depth[c.to] = depth[id] + 1; queue.push(c.to); }
  }
  const last = Math.max(0, ...Object.values(depth)) + 1, columnY = {};
  for (const [id, n] of Object.entries(nodes)) {
    const d = id in depth ? depth[id] : last;
    n.x = 40 + d * 340;
    n.y = columnY[d] ?? 40;
    columnY[d] = n.y + 230 + n.choices.length * 32; // rough node height plus a gap
  }
}

function storyHasContent() {
  const nodes = Object.values(data.nodes);
  return nodes.length > 1 || nodes.some(n => n.text.trim() || n.choices.length);
}

async function aiGenerate() {
  const prompt = await askText('Generate a story with AI',
    'Describe the NPC and the situation, e.g. "a nervous innkeeper hiding a fugitive upstairs".', {
      ok: 'Generate',
      validate: v => !v ? 'Describe the conversation you want.' : v.length > 500 ? 'Keep it under 500 characters.' : '',
    });
  if (prompt === null) return;
  if (storyHasContent() && !await ask('Replace the current story?', 'The generated conversation replaces what is on the canvas. Save it first if you want to keep it.', { ok: 'Generate', danger: true })) return;

  const tree = await callAI({ mode: 'generate', prompt });
  if (!tree) return;
  let story;
  try { story = storyFromAI(tree); } catch (err) { notify('AI request failed', err.message); return; }
  data = story; resetView(); render(); restart(); fitView();
}

/* ---------- expand one node ---------- */

/* The conversation path from the start to `id` (plus the node itself), as context for the AI. */
function pathTo(id) {
  const parent = { [data.start]: null }, queue = [data.start];
  while (queue.length) {
    const cur = queue.shift(); if (cur === id) break;
    for (const c of data.nodes[cur]?.choices || []) if (c.to && data.nodes[c.to] && !(c.to in parent)) { parent[c.to] = cur; queue.push(c.to); }
  }
  const path = [];
  for (let cur = (id in parent ? id : null); cur !== null; cur = parent[cur]) path.unshift(cur);
  if (!path.length) path.push(id); // not reachable from the start: send it on its own
  return path.map(nid => {
    const n = data.nodes[nid];
    return { id: nid, speaker: n.speaker, text: n.text, choices: n.choices.map(c => ({ text: c.text, to: c.to })) };
  });
}

async function aiExpand(id) {
  const direction = await askText(`Expand ${id} with AI`,
    'Optional: what could happen next? Leave it blank to let the AI decide.', {
      ok: 'Expand', validate: v => v.length > 300 ? 'Keep it under 300 characters.' : '',
    });
  if (direction === null) return;

  const out = await callAI({ mode: 'expand', nodeId: id, prompt: direction, story: { start: data.start, path: pathTo(id) } });
  if (!out) return;
  const n = data.nodes[id];
  if (!n) return; // deleted while the AI was writing
  const replies = (Array.isArray(out.replies) ? out.replies : []).filter(r => clip(r.reply, 200)).slice(0, 4);
  if (!replies.length) { notify('AI request failed', 'The AI returned no new replies. Try again or add a direction.'); return; }

  const firstRow = n.choices.length;
  replies.forEach((r, i) => {
    const to = newNode(n.x + 340, n.y + (firstRow + i) * 200);
    Object.assign(data.nodes[to], { speaker: clip(r.speaker, 40) || defaultSpeaker(), text: clip(r.line, 600) });
    n.choices.push({ text: clip(r.reply, 200), to });
  });
  render();
}

/* ---------- entry points ---------- */

/* Empty-canvas card: shown while the story is still blank, until dismissed. */
const aiHint = $('#aiHint');
let aiHintDismissed = false;
function updateAiHint() { aiHint.hidden = aiHintDismissed || storyHasContent(); }
canvas.addEventListener('input', updateAiHint);
$('#aiHintClose').onclick = () => { aiHintDismissed = true; updateAiHint(); };

$('#aiToolbarBtn').onclick = aiGenerate;
$('#aiHintBtn').onclick = aiGenerate;
// Home screen: open the studio first (generating needs the canvas visible to lay out), then ask.
$('#menuAi').onclick = () => {
  if (!hasSave()) { data = blank(); resetView(); }
  openStudio();
  aiGenerate();
};
