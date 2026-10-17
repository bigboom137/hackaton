/* In-page replacements for confirm()/alert()/prompt(). Each returns a Promise. */
const dialogEl = document.createElement('div');
dialogEl.className = 'modal dialog';
dialogEl.hidden = true;
dialogEl.innerHTML = `
  <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="dialogTitle" aria-describedby="dialogMsg">
    <h2 id="dialogTitle"></h2>
    <p id="dialogMsg" class="dialog-msg"></p>
    <textarea id="dialogText" class="dialog-text" readonly hidden></textarea>
    <div class="dialog-actions">
      <button class="ghost" id="dialogCancel"></button>
      <button id="dialogOk"></button>
    </div>
  </div>`;
document.body.appendChild(dialogEl);

const dlg = {
  title: $('#dialogTitle'), msg: $('#dialogMsg'), text: $('#dialogText'),
  ok: $('#dialogOk'), cancel: $('#dialogCancel'), resolve: null, returnFocus: null,
};

function openDialog({ title, message = '', text = null, ok = 'OK', cancel = null, danger = false }) {
  if (dlg.resolve) dlg.resolve(false); // only one dialog at a time
  dlg.title.textContent = title;
  dlg.msg.textContent = message; dlg.msg.hidden = !message;
  dlg.text.hidden = text === null; dlg.text.value = text ?? '';
  dlg.ok.textContent = ok; dlg.ok.className = danger ? 'danger' : '';
  dlg.cancel.textContent = cancel || ''; dlg.cancel.hidden = !cancel;
  dlg.returnFocus = document.activeElement;
  dialogEl.hidden = false;
  if (text !== null) { dlg.text.focus(); dlg.text.select(); } else dlg.ok.focus();
  return new Promise(resolve => { dlg.resolve = resolve; });
}

function closeDialog(result) {
  if (!dlg.resolve) return;
  const resolve = dlg.resolve; dlg.resolve = null;
  dialogEl.hidden = true;
  dlg.returnFocus?.focus?.();
  resolve(result);
}

/* Yes/no question → true/false. */
function ask(title, message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return openDialog({ title, message, ok, cancel, danger });
}
/* Plain notice. */
function notify(title, message) { return openDialog({ title, message }); }
/* Show text the user can copy. */
function showText(title, message, text) { return openDialog({ title, message, text, ok: 'Done' }); }

dlg.ok.onclick = () => closeDialog(true);
dlg.cancel.onclick = () => closeDialog(false);
dialogEl.addEventListener('mousedown', e => { if (e.target === dialogEl) closeDialog(false); });

/* While open, the dialog owns the keyboard: Esc cancels, Tab stays inside. Runs in the
   capture phase so the studio's own Esc handlers don't also fire. */
window.addEventListener('keydown', e => {
  if (dialogEl.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDialog(false); }
  else if (e.key === 'Tab') {
    const items = [dlg.text, dlg.cancel, dlg.ok].filter(x => !x.hidden);
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
  }
}, true);
