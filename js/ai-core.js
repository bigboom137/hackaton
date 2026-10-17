/* Shared AI request logic: prompts, output schemas and the Gemini call.
   Used by the studio (classic <script>, for "use my own key") and bundled into the
   Cloudflare worker (worker/src/index.js imports this file), so both paths send the
   same requests. Exposed as globalThis.QuestlineAI. */
(() => {
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

  const generateInput = prompt => `Write a branching conversation: ${prompt}

Rules:
- 5 to 12 nodes. Each node is one NPC line.
- Each node has 0 to 3 player choices. A choice's "to" is the id of the node it leads to, or "" to end the conversation there.
- Every non-empty "to" must match an id in "nodes".
- Give the player real decisions: at least two branches should end differently.
- "start" is the id of the first node.`;

  const expandInput = (nodeId, prompt, story) => `Here is the conversation leading up to node "${nodeId}" (JSON):
${JSON.stringify(story)}

Write 2 or 3 new player replies to node "${nodeId}", each with the line spoken in response.
They must be different from that node's existing choices.${prompt ? `\nDirection from the writer: ${prompt}` : ''}`;

  class RequestError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }

  /* Validate a studio request ({ mode, prompt, nodeId, story }) and turn it into { input, schema }. */
  function buildRequest(body) {
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length > MAX_PROMPT) throw new RequestError(`Keep the description under ${MAX_PROMPT} characters.`);
    if (body?.mode === 'generate') {
      if (!prompt) throw new RequestError('Describe the conversation to generate.');
      return { input: generateInput(prompt), schema: TREE_SCHEMA };
    }
    if (body?.mode === 'expand') {
      const nodeId = typeof body.nodeId === 'string' ? body.nodeId.slice(0, 64) : '';
      if (!nodeId) throw new RequestError('Missing nodeId.');
      if (JSON.stringify(body.story ?? null).length > MAX_STORY) throw new RequestError('That conversation is too long to send.', 413);
      return { input: expandInput(nodeId, prompt, body.story), schema: EXPAND_SCHEMA };
    }
    throw new RequestError('mode must be "generate" or "expand".');
  }

  /* One structured-output call to Gemini; resolves to the parsed JSON. */
  async function callGemini(apiKey, model, { input, schema }, signal) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      // system_instruction and store:false return "The caller does not have permission" on a
      // free-tier key, so the instructions go at the top of the input instead.
      body: JSON.stringify({
        model,
        input: `${SYSTEM}\n\n${input}`,
        response_format: { type: 'text', mime_type: 'application/json', schema },
        generation_config: { max_output_tokens: 8192 },
      }),
      signal,
    });
    const out = await res.json().catch(() => null);
    if (!res.ok) {
      const err = Array.isArray(out) ? out[0]?.error : out?.error; // errors sometimes come wrapped in an array
      throw new Error(err?.message || `Gemini returned HTTP ${res.status}`);
    }

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

  globalThis.QuestlineAI = { DEFAULT_MODEL: 'gemini-3.5-flash-lite', RequestError, buildRequest, callGemini };
})();
