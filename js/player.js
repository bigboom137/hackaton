/* Preview Player: walks the dialogue tree as a chat. */
const preview = $('#preview');
let typing = null; // { stop(), finish() } while a line is being typed out
let previewTrail = []; // visited nodes and the choice taken from each one

function clearPreview() { typing?.stop(); preview.innerHTML = ''; }

function restart() {
  previewTrail = [];
  clearPreview();
  if (!Object.keys(data.nodes).length) {
    preview.innerHTML = '<div class="end">No dialogue yet. Add a node to begin.</div>';
    return;
  }
  visit(data.start);
}

/* Restart the preview at a given node instead of the start. */
function previewFrom(id) { previewTrail = []; clearPreview(); visit(id); }

function appendReply(text) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble you';
  bubble.textContent = text;
  preview.appendChild(bubble);
}

function showChoices(id, n) {
  const opts = document.createElement('div'); opts.className = 'opts';
  if (!n.choices.length) opts.innerHTML = '<div class="end">No choices (end of conversation)</div>';
  n.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt' + (c.to && data.nodes[c.to] ? '' : ' dead');
    btn.textContent = c.text || '(empty reply)';
    btn.onclick = () => {
      const step = previewTrail[previewTrail.length - 1];
      if (step?.id === id) step.choiceIndex = i;
      opts.remove();
      appendReply(c.text);
      if (c.to) visit(c.to); else preview.insertAdjacentHTML('beforeend', '<div class="end">End of conversation</div>');
      preview.scrollTop = preview.scrollHeight;
    };
    opts.appendChild(btn);
  });
  preview.appendChild(opts);
}

/* Show text in el, typed out letter by letter if the setting is on; then call done. */
function typeLine(el, text, done) {
  if (!settings.typewriter || text.length < 2) { el.textContent = text; done(); return; }
  let i = 0;
  const timer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    preview.scrollTop = preview.scrollHeight;
    if (i >= text.length) typing.finish();
  }, 1000 / settings.textSpeed);
  typing = {
    stop() { clearInterval(timer); typing = null; },
    finish() { this.stop(); el.textContent = text; done(); },
  };
}
// Click to skip typing, except when clicking a reply button to continue the story.
preview.addEventListener('click', e => { if (!e.target.closest('button')) typing?.finish(); });

function visit(id) {
  const n = data.nodes[id];
  previewTrail.push({ id, choiceIndex: null });
  activeId = id;
  document.querySelectorAll('.node').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  preview.querySelectorAll('.opts').forEach(o => o.remove());
  if (!n) { preview.insertAdjacentHTML('beforeend', '<div class="end">(missing node)</div>'); return; }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<div class="who">${esc(n.speaker || '???')}</div><span class="line"></span>`;
  preview.appendChild(bubble);
  typeLine(bubble.querySelector('.line'), n.text || '...', () => {
    showChoices(id, n);
    preview.scrollTop = preview.scrollHeight;
  });
  preview.scrollTop = preview.scrollHeight;
}

/* Rebuild the transcript from live story data while retaining the previewed route. */
function refreshPreview() {
  if (!previewTrail.length) return;
  const route = previewTrail.map(step => ({ ...step }));
  if (!data.nodes[route[0].id]) { restart(); return; }
  clearPreview();
  previewTrail = [];
  let id = route[0].id;
  for (let i = 0; i < 1000; i++) {
    const n = data.nodes[id];
    if (!n) {
      activeId = id;
      previewTrail.push({ id, choiceIndex: null });
      preview.insertAdjacentHTML('beforeend', `<div class="end">(missing node: ${esc(id)})</div>`);
      break;
    }
    activeId = id;
    document.querySelectorAll('.node').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `<div class="who">${esc(n.speaker || '???')}</div><span class="line">${esc(n.text || '...')}</span>`;
    preview.appendChild(bubble);

    const savedStep = route[i]?.id === id ? route[i] : { id, choiceIndex: null };
    const choiceIndex = savedStep.choiceIndex;
    const choice = choiceIndex == null ? null : n.choices[choiceIndex];
    if (!choice) {
      previewTrail.push({ id, choiceIndex: null });
      showChoices(id, n);
      break;
    }

    previewTrail.push({ id, choiceIndex });
    appendReply(choice.text);
    if (!choice.to) {
      preview.insertAdjacentHTML('beforeend', '<div class="end">End of conversation</div>');
      break;
    }
    id = choice.to;
  }
  preview.scrollTop = preview.scrollHeight;
}

$('#restart').onclick = () => restart();
