/* Questline AI proxy (Cloudflare Worker).
   Holds the Gemini API key so the static site never sees it, and turns two requests
   into Gemini structured-output calls:
     POST { mode: "generate", prompt }                  -> { start, nodes: [...] }
     POST { mode: "expand", nodeId, prompt, story }     -> { replies: [...] }
   The studio (js/ai.js) validates and lays out whatever comes back. */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MAX_PROMPT = 500;     // characters of user direction
const MAX_STORY = 20000;    // characters of story context sent with "expand"

const SYSTEM = `You write branching NPC dialogue for 2D RPG games.
Write natural, characterful lines that fit a fantasy RPG unless the writer asks for another setting.
Keep NPC lines under 40 words and player replies under 12 words.
Return only data that matches the schema.`;

const TREE_SCHEMA = {
  type: 'object',
  properties: {
    start: { type: 'string', description: 'id of the first node' },
    nodes: {
      type: 'array', minItems: 1, maxItems: 16,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'short snake_case id, e.g. guard_greeting' },
          speaker: { type: 'string' },
          text: { type: 'string', description: 'what the NPC says' },
          choices: {
            type: 'array', maxItems: 4,
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'what the player says' },
                to: { type: 'string', description: 'id of the node this leads to, or "" to end' },
              },
              required: ['text', 'to'],
            },
          },
        },
        required: ['id', 'speaker', 'text', 'choices'],
      },
    },
  },
  required: ['start', 'nodes'],
};

const EXPAND_SCHEMA = {
  type: 'object',
  properties: {
    replies: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          reply: { type: 'string', description: 'what the player says' },
          speaker: { type: 'string', description: 'who answers' },
          line: { type: 'string', description: 'what they say back' },
        },
        required: ['reply', 'speaker', 'line'],
      },
    },
  },
  required: ['replies'],
};

function generateInput(prompt) {
  return `Write a branching conversation: ${prompt}

Rules:
- 5 to 12 nodes. Each node is one NPC line.
- Each node has 0 to 3 player choices. A choice's "to" is the id of the node it leads to, or "" to end the conversation there.
- Every non-empty "to" must match an id in "nodes".
- Give the player real decisions: at least two branches should end differently.
- "start" is the id of the first node.`;
}

function expandInput(nodeId, prompt, story) {
  return `Here is the conversation leading up to node "${nodeId}" (JSON):
${JSON.stringify(story)}

Write 2 or 3 new player replies to node "${nodeId}", each with the line spoken in response.
They must be different from that node's existing choices.${prompt ? `\nDirection from the writer: ${prompt}` : ''}`;
}

async function callGemini(env, input, schema) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    // system_instruction and store:false return "The caller does not have permission" on a
    // free-tier key, so the instructions go at the top of the input instead.
    body: JSON.stringify({
      model: env.MODEL || 'gemini-3.5-flash-lite',
      input: `${SYSTEM}\n\n${input}`,
      response_format: { type: 'text', mime_type: 'application/json', schema },
      generation_config: { max_output_tokens: 8192 },
    }),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok) throw new Error(out?.error?.message || `Gemini returned HTTP ${res.status}`);

  // The text is in steps[type=model_output].content[type=text].text.
  const text = out?.output_text ?? (out?.steps || [])
    .filter(s => s.type === 'model_output')
    .flatMap(s => s.content || [])
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');
  if (!text) throw new Error(`Gemini returned no text (status: ${out?.status || 'unknown'}).`);
  return JSON.parse(text);
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    // Only answer pages from the allowed origins (comma-separated; empty = allow all).
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const originOk = !allowed.length || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Send a POST request.' }, 405, cors);
    if (!originOk) return json({ error: 'This site is not allowed to use the AI server.' }, 403, cors);
    if (!env.GEMINI_API_KEY) return json({ error: 'The AI server has no GEMINI_API_KEY secret set.' }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be JSON.' }, 400, cors); }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length > MAX_PROMPT) return json({ error: `Keep the description under ${MAX_PROMPT} characters.` }, 400, cors);

    try {
      if (body.mode === 'generate') {
        if (!prompt) return json({ error: 'Describe the conversation to generate.' }, 400, cors);
        return json(await callGemini(env, generateInput(prompt), TREE_SCHEMA), 200, cors);
      }
      if (body.mode === 'expand') {
        const nodeId = typeof body.nodeId === 'string' ? body.nodeId.slice(0, 64) : '';
        const storyText = JSON.stringify(body.story ?? null);
        if (!nodeId) return json({ error: 'Missing nodeId.' }, 400, cors);
        if (storyText.length > MAX_STORY) return json({ error: 'That conversation is too long to send.' }, 413, cors);
        return json(await callGemini(env, expandInput(nodeId, prompt, body.story), EXPAND_SCHEMA), 200, cors);
      }
      return json({ error: 'mode must be "generate" or "expand".' }, 400, cors);
    } catch (err) {
      return json({ error: err.message || 'The AI request failed.' }, 502, cors);
    }
  },
};
