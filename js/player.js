/* Preview Player: walks the dialogue tree as a chat. */
const preview = $('#preview');
let typing = null; // { stop(), finish() } while a line is being typed out

function clearPreview() { typing?.stop(); preview.innerHTML = ''; }

function restart() {
  clearPreview();
  if (!Object.keys(data.nodes).length) {
    preview.innerHTML = '<div class="end">No dialogue yet. Add a node to begin.</div>';
    return;
  }
  visit(data.start);
}

/* Restart the preview at a given node instead of the start. */
function previewFrom(id) { clearPreview(); visit(id); }

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
// Click to skip the typing. Not for reply buttons: their click starts the next line,
// then bubbles up here and would skip it instantly.
preview.addEventListener('click', e => { if (!e.target.closest('button')) typing?.finish(); });

function visit(id) {
  const n = data.nodes[id];
  activeId = id;
  document.querySelectorAll('.node').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  preview.querySelectorAll('.opts').forEach(o => o.remove());
  if (!n) { preview.insertAdjacentHTML('beforeend', `<div class="end">(missing node)</div>`); return; }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<div class="who">${esc(n.speaker || '???')}</div><span class="line"></span>`;
  preview.appendChild(bubble);

  const opts = document.createElement('div'); opts.className = 'opts';
  if (!n.choices.length) opts.innerHTML = `<div class="end">— end of conversation —</div>`;
  n.choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'opt' + (c.to && data.nodes[c.to] ? '' : ' dead');
    btn.textContent = c.text || '(empty reply)';
    btn.onclick = () => {
      btn.closest('.opts').remove();
      preview.insertAdjacentHTML('beforeend', `<div class="bubble you">${esc(c.text)}</div>`);
      if (c.to) visit(c.to); else preview.insertAdjacentHTML('beforeend', `<div class="end">— end of conversation —</div>`);
      preview.scrollTop = preview.scrollHeight;
    };
    opts.appendChild(btn);
  });

  typeLine(bubble.querySelector('.line'), n.text || '…', () => {
    preview.appendChild(opts);
    preview.scrollTop = preview.scrollHeight;
  });
  preview.scrollTop = preview.scrollHeight;
}

$('#restart').onclick = () => restart();
