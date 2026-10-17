/* Custom right-click menu. showContextMenu(x, y, items): each item is '-' (divider)
   or { label, action, hint?, danger?, disabled? }. */
const ctxMenu = document.createElement('div');
ctxMenu.className = 'ctx-menu';
ctxMenu.setAttribute('role', 'menu');
ctxMenu.hidden = true;
document.body.appendChild(ctxMenu);
let ctxItems = [];

function showContextMenu(x, y, items) {
  ctxItems = items;
  ctxMenu.innerHTML = items.map((it, i) => it === '-' ? '<hr>' :
    `<button role="menuitem" data-i="${i}"${it.danger ? ' class="danger-text"' : ''}${it.disabled ? ' disabled' : ''}>
      <span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`).join('');
  ctxMenu.style.left = ctxMenu.style.top = '0px';
  ctxMenu.hidden = false;
  // Keep the menu on screen near the edges.
  const r = ctxMenu.getBoundingClientRect();
  ctxMenu.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
  ctxMenu.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  ctxMenu.querySelector('button:not(:disabled)')?.focus();
}
function hideContextMenu() { ctxMenu.hidden = true; }

ctxMenu.addEventListener('click', e => {
  const btn = e.target.closest('button'); if (!btn || btn.disabled) return;
  hideContextMenu();
  ctxItems[+btn.dataset.i].action();
});
ctxMenu.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousedown', e => { if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) hideContextMenu(); }, true);
window.addEventListener('keydown', e => {
  if (ctxMenu.hidden) return;
  const btns = [...ctxMenu.querySelectorAll('button:not(:disabled)')];
  const i = btns.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideContextMenu(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
  else if (e.key === 'Tab') hideContextMenu();
}, true);
['resize', 'blur'].forEach(ev => window.addEventListener(ev, hideContextMenu));
document.addEventListener('scroll', hideContextMenu, true);
