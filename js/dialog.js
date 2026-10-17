/* In-page replacements for confirm()/alert()/prompt(). Each returns a Promise. */
const dialogEl = document.createElement('div');
dialogEl.className = 'modal dialog';
dialogEl.hidden = true;
dialogEl.innerHTML = `
  <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="dialogTitle" aria-describedby="dialogMsg">
    <h2 id="dialogTitle"></h2>
    <p id="dialogMsg" class="dialog-msg"></p>
    <input id="dialogInput" class="dialog-input" autocomplete="off" spellcheck="false" hidden>
    <p id="dialogError" class="dialog-error" role="alert" hidden></p>
    <textarea id="dialogText" class="dialog-text" readonly hidden></textarea>
    <div class="dialog-actions">
      <button class="ghost" id="dialogCancel"></button>
      <button id="dialogOk"></button>
    </div>
  </div>`;
document.body.appendChild(dialogEl);

const dlg = {
  title: $('#dialogTitle'), msg: $('#dialogMsg'), text: $('#dialogText'),
  input: $('#dialogInput'), error: $('#dialogError'),
  ok: $('#dialogOk'), cancel: $('#dialogCancel'), resolve: null, returnFocus: null, validate: null,
};

function openDialog({ title, message = '', text = null, input = null, validate = null, ok = 'OK', cancel = null, danger = false }) {
  if (dlg.resolve) cancelDialog(); // only one dialog at a time
  dlg.title.textContent = title;
  dlg.msg.textContent = message; dlg.msg.hidden = !message;
  dlg.text.hidden = text === null; dlg.text.value = text ?? '';
  dlg.input.hidden = input === null; dlg.input.value = input ?? '';
  dlg.error.hidden = true; dlg.validate = validate;
  dlg.ok.textContent = ok; dlg.ok.className = danger ? 'danger' : '';
  dlg.cancel.textContent = cancel || ''; dlg.cancel.hidden = !cancel;
  dlg.returnFocus = document.activeElement;
  dialogEl.hidden = false;
  const first = input !== null ? dlg.input : text !== null ? dlg.text : dlg.ok;
  first.focus(); first.select?.();
  return new Promise(resolve => { dlg.resolve = resolve; });
}

function closeDialog(result) {
  if (!dlg.resolve) return;
  const resolve = dlg.resolve; dlg.resolve = null;
  dialogEl.hidden = true;
  dlg.returnFocus?.focus?.();
  resolve(result);
}

/* OK: text dialogs resolve with the (validated) value, others with true. */
function submitDialog() {
  if (dlg.input.hidden) return closeDialog(true);
  const value = dlg.input.value.trim();
  const err = dlg.validate?.(value);
  if (err) { dlg.error.textContent = err; dlg.error.hidden = false; dlg.input.focus(); return; }
  closeDialog(value);
}
/* Cancel: text dialogs resolve with null, others with false. */
function cancelDialog() { closeDialog(dlg.input.hidden ? false : null); }

/* Yes/no question → true/false. */
function ask(title, message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return openDialog({ title, message, ok, cancel, danger });
}
/* Plain notice. */
function notify(title, message) { return openDialog({ title, message }); }
/* Show text the user can copy. */
function showText(title, message, text) { return openDialog({ title, message, text, ok: 'Done' }); }
/* Ask for a line of text → the string, or null if cancelled. validate(value) returns an error message or ''. */
function askText(title, message, { value = '', ok = 'OK', validate = null } = {}) {
  return openDialog({ title, message, input: value, validate, ok, cancel: 'Cancel' });
}

dlg.ok.onclick = submitDialog;
dlg.cancel.onclick = cancelDialog;
dlg.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitDialog(); } });
dlg.input.addEventListener('input', () => { dlg.error.hidden = true; });
dialogEl.addEventListener('mousedown', e => { if (e.target === dialogEl) cancelDialog(); });

/* While open, the dialog owns the keyboard: Esc cancels, Tab stays inside. Runs in the
   capture phase so the studio's own Esc handlers don't also fire. */
window.addEventListener('keydown', e => {
  if (dialogEl.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelDialog(); }
  else if (e.key === 'Tab') {
    const items = [dlg.input, dlg.text, dlg.cancel, dlg.ok].filter(x => !x.hidden);
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
  }
}, true);
