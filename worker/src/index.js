/* Questline AI proxy (Cloudflare Worker).
   Holds the Gemini API key so the static site never sees it, and turns two requests
   into Gemini structured-output calls:
     POST { mode: "generate", prompt }                  -> { start, nodes: [...] }
     POST { mode: "expand", nodeId, prompt, story }     -> { replies: [...] }
   The prompts, schemas and Gemini call live in js/ai-core.js, shared with the studio's
   "use my own key" mode. The studio (js/ai.js) validates and lays out what comes back. */

import '../../js/ai-core.js';
const { buildRequest, callGemini, RequestError, DEFAULT_MODEL } = globalThis.QuestlineAI;

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

    try {
      const req = buildRequest(body);
      return json(await callGemini(env.GEMINI_API_KEY, env.MODEL || DEFAULT_MODEL, req), 200, cors);
    } catch (err) {
      if (err instanceof RequestError) return json({ error: err.message }, err.status, cors);
      return json({ error: err.message || 'The AI request failed.' }, 502, cors);
    }
  },
};
