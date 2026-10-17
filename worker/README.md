# Questline AI worker

A small Cloudflare Worker that lets the studio generate dialogue with Google's Gemini API.
It keeps your Gemini API key secret: the website talks to this worker, and only the worker talks to Gemini.

It powers two studio features:

- **☰ Menu → ✨ Generate with AI…**: describe an NPC and situation, get a whole branching conversation.
- **Right-click a node → ✨ Expand with AI…**: get 2–3 new player replies (and the answers to them) for that node.

Both use Gemini's free tier and cost nothing within its limits.

## Setup (about 10 minutes)

You need [Node.js](https://nodejs.org) and two free accounts: Google (for Gemini) and Cloudflare (to host the worker).

1. **Get a Gemini API key.** Sign in to [Google AI Studio](https://aistudio.google.com), choose **Get API key**, and create one. No credit card needed for the free tier.

2. **Deploy the worker.** From this `worker/` folder:

   ```sh
   npx wrangler login                    # opens the browser to sign in to Cloudflare
   npx wrangler secret put GEMINI_API_KEY  # paste the key when asked
   npx wrangler deploy
   ```

   `deploy` prints the worker's URL, like `https://questline-ai.<your-name>.workers.dev`.

3. **Connect the studio.** Open the site, go to **Settings → AI**, and paste the URL into **AI server URL**.

## Settings (`wrangler.toml`)

| Variable | What it does |
|---|---|
| `ALLOWED_ORIGINS` | Sites allowed to call the worker, comma-separated. Set to your GitHub Pages address. |
| `MODEL` | The Gemini model. `gemini-3.8-flash` is Google's recommended free model; `gemini-3.5-flash-lite` is faster with lower quality. |

After changing either, run `npx wrangler deploy` again.

### Testing locally

Pages opened straight from disk (`file://`) send the origin `null`, which the worker rejects. Serve the site instead, for example `npx serve ..` from this folder (it prints the address, usually `http://localhost:3000`), and add that address to `ALLOWED_ORIGINS`.

To run the worker itself locally, put `GEMINI_API_KEY=your-key` in a `.dev.vars` file here (it's gitignored) and run `npx wrangler dev`.

## Good to know

- **Free-tier prompts are used by Google to improve its products.** Don't type anything private into the AI prompts.
- **Rate limits:** the free tier limits requests per minute and per day. You can see your limits in Google AI Studio. If you hit one, the studio shows Gemini's error message.
- **Abuse:** the worker only answers your site's origin and caps prompt and story sizes, but a determined person can fake an origin. If your URL gets abused, delete the key in AI Studio and make a new one (`npx wrangler secret put GEMINI_API_KEY` again).
- The studio checks everything the AI returns: it fixes invalid or duplicate ids and turns links to nodes that don't exist into conversation endings, so a generated tree never loads broken.
