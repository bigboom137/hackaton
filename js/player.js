/* Preview Player: walks the dialogue tree as a chat. */
const preview = $('#preview');

function restart() { preview.innerHTML = ''; visit(data.start); }

function visit(id) {
  const n = data.nodes[id];
  activeId = id;
  document.querySelectorAll('.node').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  preview.querySelectorAll('.opts').forEach(o => o.remove());
  if (!n) { preview.insertAdjacentHTML('beforeend', `<div class="end">(missing node)</div>`); return; }
  const b = document.createElement('div');
  b.innerHTML = `<div class="bubble"><div class="who">${esc(n.speaker || '???')}</div>${esc(n.text || '…')}</div>`;
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
  preview.append(...b.children, opts);
  preview.scrollTop = preview.scrollHeight;
}

$('#restart').onclick = () => restart();
