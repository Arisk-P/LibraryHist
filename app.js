'use strict';

/* =========================================================
   LibraryHist — keeps the latest chapter / volume you read.
   All data is stored in this browser (localStorage).
   ========================================================= */

const STORE_KEY = 'libraryhist.v1';
const DB_VERSION = 2;
const DAY = 24 * 60 * 60 * 1000;
const TRASH_DAYS = 30;
/* Screen sizes (match styles.css): tablet ≥700px, PC ≥1100px with a permanent sidebar */
const mqTablet = matchMedia('(min-width: 700px)');
const mqPC = matchMedia('(min-width: 1100px)');
const favPerPage = () => (mqPC.matches ? 6 : mqTablet.matches ? 5 : 3);
const HISTORY_MAX = 1000;
const NONE = 'none'; // built-in "None" category (never stored in db.categories)

const TAG_TYPES = [
  { id: 'publisher', label: 'Publisher' },
  { id: 'author', label: 'Author' },
  { id: 'general', label: 'General' },
];
const tagTypeLabel = (id) => TAG_TYPES.find((t) => t.id === id)?.label || 'General';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
const norm = (s) => String(s || '').trim().toLowerCase();

/* ---------- Icons ---------- */
const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const I = {
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  /* Brand emblem: book stack + hourglass. Details are cut out with a mask so it sits on any theme.
     "-ID" is replaced per use so each copy has its own mask id. */
  logo: `<svg viewBox="156 100 450 422" aria-hidden="true"><defs><mask id="logoMask-ID" maskUnits="userSpaceOnUse" x="156" y="100" width="450" height="422">
<g fill="#fff"><rect x="200" y="202" width="362" height="74" rx="8"/><rect x="160" y="288" width="442" height="152" rx="10"/><rect x="187" y="453" width="400" height="65" rx="8"/>
<rect x="475" y="105" width="87" height="11" rx="4"/><rect x="475" y="189" width="87" height="11" rx="4"/></g>
<g stroke="#000" stroke-width="5" stroke-linecap="round"><path d="M222 213v52M233 213v52M529 213v52M540 213v52M183 303v122M195 303v122M567 303v122M579 303v122M208 465v42M219 465v42M555 465v42M566 465v42M273 486h227"/></g>
<g fill="#000" font-family="Oswald, sans-serif" text-anchor="middle"><text x="378" y="261" font-size="54" font-weight="500" letter-spacing="7">LIBRARY</text><text x="381" y="418" font-size="150" font-weight="700" letter-spacing="4">HIST</text></g>
</mask></defs><rect x="156" y="100" width="450" height="422" fill="currentColor" mask="url(#logoMask-ID)"/>
<path d="M492 116h53l-26.5 36 26.5 37h-53l26.5-37z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
<path d="M503 128h31l-15.5 17zM518.5 166l17 18h-34z" fill="currentColor"/></svg>`,
  book: svg('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>', 'stroke-width="1.5"'),
  chevL: svg('<path d="m15 18-6-6 6-6"/>'),
  chevR: svg('<path d="m9 18 6-6-6-6"/>'),
  chevDown: svg('<path d="m6 9 6 6 6-6"/>'),
  kebab: svg('<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>', 'stroke-width="2.4"'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  filter: svg('<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  brush: svg('<path d="m14.622 17.897-10.68-2.913"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 'stroke-width="3"'),
  checkSquare: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  pencil: svg('<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
  editNote: svg('<path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  minus: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  publisher: svg('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>'),
  author: svg('<path d="M20.2 3.8a6 6 0 0 0-8.5 0L5 10.5V19h8.5l6.7-6.7a6 6 0 0 0 0-8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>'),
  library: svg('<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>'),
  download: svg('<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/>'),
  upload: svg('<path d="M12 21V9m0 0 5 5m-5-5-5 5M4 3h16"/>'),
  home: svg('<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  gear: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
};
$$('[data-icon]').forEach((el, n) => { el.insertAdjacentHTML('afterbegin', (I[el.dataset.icon] || '').replaceAll('-ID', `-${n}`)); });

/* =========================================================
   Data
   ========================================================= */
const freshDb = () => ({ version: DB_VERSION, titles: [], categories: [], tags: [], trash: [], history: [] });
const isValidDb = (d) => d && Array.isArray(d.titles) && Array.isArray(d.categories) && Array.isArray(d.tags);

/** Upgrade older saved data: drop unused starter categories/tags, add new fields. */
function migrate(d) {
  if (!d.version || d.version < 2) {
    const usedCats = new Set(d.titles.map((t) => t.categoryId));
    const usedTags = new Set(d.titles.flatMap((t) => t.tags || []));
    d.categories = d.categories.filter((c) => usedCats.has(c.id));
    d.tags = d.tags.filter((t) => usedTags.has(t.id));
  }
  d.tags.forEach((t) => { t.type = TAG_TYPES.some((x) => x.id === t.type) ? t.type : 'general'; });
  const fixTitle = (t) => {
    if ('retro' in t) { t.themed = t.themed || !!t.retro; delete t.retro; } // renamed field
    const c = d.categories.find((x) => x.id === t.categoryId);
    if (c) t.unit = c.unit;
    else { t.categoryId = NONE; t.unit = t.unit || 'Chapter'; }
    t.tags = (t.tags || []).filter((id) => d.tags.some((x) => x.id === id));
  };
  d.titles.forEach(fixTitle);
  d.trash = Array.isArray(d.trash) ? d.trash : [];
  d.trash.forEach(fixTitle);
  d.history = Array.isArray(d.history) ? d.history : [];
  d.version = DB_VERSION;
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (isValidDb(d)) return migrate(d);
    }
  } catch { /* fall through to empty db */ }
  return freshDb();
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch {
    alert('Could not save. Browser storage is full — try smaller images or remove some titles.');
    return false;
  }
}

/** Apply a change to db; roll it back if it can't be persisted. */
function commit(mutate) {
  const snapshot = JSON.stringify(db);
  mutate();
  if (save()) { renderDrawer(); return true; }
  db = JSON.parse(snapshot);
  return false;
}

/** Recently Deleted keeps titles for 30 days. */
function purgeTrash() {
  const cutoff = Date.now() - TRASH_DAYS * DAY;
  const before = db.trash.length;
  db.trash = db.trash.filter((t) => t.deletedAt > cutoff);
  return db.trash.length !== before;
}

let db = load();
purgeTrash();
save();

const NONE_CAT = { id: NONE, name: 'None', unit: null };
const realCat = (id) => db.categories.find((c) => c.id === id);
const catById = (id) => (id === NONE ? NONE_CAT : realCat(id));
const tagById = (id) => db.tags.find((t) => t.id === id);
const unitOfTitle = (t) => realCat(t.categoryId)?.unit || t.unit || 'Chapter';
const fmtNum = (unit, n) => (n == null || n === '' ? '' : `${unit === 'Volume' ? 'Vol.' : 'Ch.'} ${n}`);
const catCount = (id) => db.titles.filter((t) => t.categoryId === id).length;
const tagCount = (id) => db.titles.filter((t) => t.tags.includes(id)).length;
const sortedCats = () => [...db.categories].sort(byName);

const categoryItems = (withNone) => [
  ...(withNone ? [{ id: NONE, label: 'None', count: catCount(NONE) }] : []),
  ...sortedCats().map((c) => ({ id: c.id, label: c.name, sub: c.unit, count: catCount(c.id) })),
];
const tagItems = () => [...db.tags].sort(byName)
  .map((t) => ({ id: t.id, label: t.name, sub: tagTypeLabel(t.type), type: t.type, count: tagCount(t.id) }));

const ACTIONS = { added: 'Added', read: 'Read', edited: 'Edited', deleted: 'Deleted', restored: 'Restored' };
function logHistory(t, action) {
  db.history.unshift({
    id: uid(), titleId: t.id, name: t.name, unit: unitOfTitle(t), number: t.number ?? null, action, at: Date.now(),
  });
  if (db.history.length > HISTORY_MAX) db.history.length = HISTORY_MAX;
}

/* =========================================================
   UI state
   ========================================================= */
const SORTS = [
  { id: 'modified', label: 'Date modified' },
  { id: 'az', label: 'A–Z' },
  { id: 'most', label: 'Most chapter/volume' },
  { id: 'least', label: 'Least chapter/volume' },
];

const newListState = () => ({
  search: '', sort: 'modified', filter: { category: null, tags: [], exclude: [] }, selectMode: false, selected: new Set(),
});

const ui = {
  scope: null,          // null = home ("All"), otherwise the category id of the category page
  lastCat: null,
  home: newListState(),
  cat: newListState(),
  favPage: 0,
  trashSearch: '',
  trashSelect: false,
  trashSelected: new Set(),
};
const L = () => (ui.scope ? ui.cat : ui.home);

let form = null;   // working copy of the title being created / edited
let cform = null;  // working copy of the category being created / edited

/* =========================================================
   Searchable dropdown
   - shows max 8 rows; slide (scroll) the list to see more
   - for typed items (tags): "@author", "@publish", "@general" filter by type
   ========================================================= */
const openDropdowns = new Set();

function createDropdown(mount, opts) {
  const {
    placeholder = 'Select',
    searchable = true,
    searchPlaceholder = 'Search…',
    showCount = true,
    closeOnSelect = true,
    emptyText = 'Nothing here yet',
    getItems,
    getLabel = () => null,
    isSelected = () => false,
    onSelect,
  } = opts;

  const root = document.createElement('div');
  root.className = 'dd';
  root.innerHTML = `
    <button type="button" class="dd-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="dd-label"></span>${I.chevDown}
    </button>
    <div class="dd-panel" hidden>
      ${searchable ? `<div class="dd-search-wrap">${I.search}<input class="dd-search" type="search" placeholder="${esc(searchPlaceholder)}" autocomplete="off" aria-label="Search"></div>` : ''}
      <ul class="dd-list" role="listbox"></ul>
      <div class="dd-more" hidden>Slide to see more ↓</div>
    </div>`;
  mount.replaceChildren(root);

  const trigger = $('.dd-trigger', root);
  const label = $('.dd-label', root);
  const panel = $('.dd-panel', root);
  const search = $('.dd-search', root);
  const list = $('.dd-list', root);
  const more = $('.dd-more', root);

  const api = { root, open, close, refresh };

  function renderLabel() {
    const l = getLabel();
    label.textContent = l || placeholder;
    label.classList.toggle('is-placeholder', !l);
  }

  function updateMore() {
    const scrollable = list.scrollHeight > list.clientHeight + 2;
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
    more.hidden = !scrollable || atEnd;
  }

  function filterItems(all, q) {
    const ql = q.toLowerCase();
    const typed = ql.match(/^@(\S*)\s*(.*)$/);
    if (typed && all.some((i) => i.type)) {
      const [, typeQ, nameQ] = typed;
      return all.filter((i) => i.type && i.type.startsWith(typeQ) && i.label.toLowerCase().includes(nameQ.trim()));
    }
    return ql ? all.filter((i) => i.label.toLowerCase().includes(ql)) : all;
  }

  function renderList() {
    const all = getItems();
    const items = filterItems(all, search ? search.value.trim() : '');
    const html = items.map((i) => {
      const sel = isSelected(i.id);
      return `<li><button type="button" class="dd-item${sel ? ' is-selected' : ''}" data-id="${esc(i.id)}" role="option" aria-selected="${sel}">
        <span class="dd-item-label">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span>
        ${showCount && i.count != null ? `<span class="dd-count">${i.count}</span>` : ''}
      </button></li>`;
    }).join('');
    list.innerHTML = html || `<li class="dd-empty">${esc(all.length ? 'No matches' : emptyText)}</li>`;
    list.scrollTop = 0;
    updateMore();
  }

  function open() {
    openDropdowns.forEach((d) => d !== api && d.close());
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openDropdowns.add(api);
    if (search) search.value = '';
    renderList();
    if (search && matchMedia('(hover: hover)').matches) search.focus();
  }

  function close() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openDropdowns.delete(api);
  }

  function refresh() {
    renderLabel();
    if (!panel.hidden) renderList();
  }

  trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
  search?.addEventListener('input', renderList);
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      list.querySelector('.dd-item')?.click();
    }
  });
  list.addEventListener('scroll', updateMore, { passive: true });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.dd-item');
    if (!btn) return;
    onSelect(btn.dataset.id);
    renderLabel();
    if (closeOnSelect) close();
    else {
      if (search) search.value = '';
      renderList();
    }
  });

  renderLabel();
  return api;
}

function chipsHtml(ids, lookup, kind = '') {
  return ids.map((id) => {
    const item = lookup(id);
    if (!item) return '';
    return `<span class="chip ${kind}">${esc(item.name)}<button type="button" data-remove="${esc(id)}" aria-label="Remove ${esc(item.name)}">${I.x}</button></span>`;
  }).join('');
}

/* =========================================================
   Popover menu (all ⋮ buttons) and dialogs
   ========================================================= */
const pop = $('#popMenu');
let popAnchor = null;
let popItems = [];

function hideMenu() {
  if (pop.hidden) return;
  pop.hidden = true;
  popAnchor?.setAttribute('aria-expanded', 'false');
  popAnchor = null;
}

function toggleMenu(anchor, items) {
  if (popAnchor === anchor) return hideMenu();
  hideMenu();
  popItems = items;
  pop.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${I[it.icon] || ''}<span>${esc(it.label)}</span></button>`).join('');
  pop.hidden = false;
  popAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
  let top = r.bottom + 4;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

pop.addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const item = popItems[Number(b.dataset.i)];
  hideMenu();
  item.action();
});
window.addEventListener('scroll', hideMenu, { passive: true, capture: true });

const dlg = $('#dlg');

/**
 * Show a modal dialog. `submit(formEl)` returns an error string to keep it open,
 * or a value to resolve with. Resolves null when cancelled.
 */
function modal({ title, body = '', confirmText = 'Confirm', danger = false, init, submit }) {
  return new Promise((resolve) => {
    dlg.innerHTML = `<form class="dlg-form" novalidate>
      <h2 id="dlgTitle">${esc(title)}</h2>
      <div class="dlg-body">${body}</div>
      <p class="form-error" role="alert" hidden></p>
      <div class="dlg-actions">
        <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(confirmText)}</button>
      </div>
    </form>`;
    dlg.setAttribute('aria-labelledby', 'dlgTitle');
    const formEl = $('form', dlg);
    const err = $('.form-error', dlg);

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = submit ? submit(formEl) : true;
      if (typeof r === 'string') {
        err.textContent = r;
        err.hidden = false;
        return;
      }
      resolve(r); // a promise settles once, so the later 'close' resolve is ignored
      dlg.close();
    });
    $('[data-cancel]', dlg).addEventListener('click', () => { resolve(null); dlg.close(); });
    // Esc or navigation. A late 'close' from a previous dialog arrives while this one is open: ignore it.
    const onClose = () => {
      if (dlg.open) return;
      dlg.removeEventListener('close', onClose);
      resolve(null);
    };
    dlg.addEventListener('close', onClose);
    dlg.showModal();
    init?.(formEl);
  });
}

const confirmBox = (title, message, confirmText = 'Delete', danger = true) =>
  modal({ title, body: `<p class="dlg-msg">${esc(message)}</p>`, confirmText, danger }).then(Boolean);

/* =========================================================
   Router: home, category, titleForm, categoryForm, tags, settings, history, trash
   ========================================================= */
const VIEW_EL = {
  home: 'listView', category: 'listView', titleForm: 'titleFormView', categoryForm: 'categoryFormView',
  tags: 'tagsView', settings: 'settingsView', theme: 'themeView', history: 'historyView', trash: 'trashView', browse: 'browseView',
};
let current = { view: 'home', depth: 0 };
const scrollMem = {};

function go(view, params = {}, replace = false) {
  const st = { view, ...params, depth: replace ? current.depth : current.depth + 1 };
  if (replace) history.replaceState(st, '');
  else history.pushState(st, '');
  show(st, false);
}

function back() {
  if (current.depth > 0) history.back();
  else go('home', {}, true);
}

window.addEventListener('popstate', (e) => show(e.state || { view: 'home', depth: 0 }, true));

function show(st, restoreScroll) {
  scrollMem[current.depth] = window.scrollY;
  openDropdowns.forEach((d) => d.close());
  hideMenu();
  closePanels();
  if (dlg.open) dlg.close();

  current = st;
  const target = VIEW_EL[st.view] ? st.view : 'home';
  new Set(Object.values(VIEW_EL)).forEach((id) => { $(`#${id}`).hidden = true; });
  $(`#${VIEW_EL[target]}`).hidden = false;
  if (ENTER[target](st) === false) return; // view redirected elsewhere
  renderDrawer(); // keeps the PC sidebar's active item in sync
  window.scrollTo(0, restoreScroll ? scrollMem[st.depth] || 0 : 0);
}

const ENTER = {
  home() { enterList(null); },
  category(st) {
    if (!realCat(st.id)) { go('home', {}, true); return false; }
    enterList(st.id);
  },
  titleForm(st) { return openForm(st.id, st.cat); },
  categoryForm(st) { return openCatForm(st.id); },
  tags() { renderTags(); },
  browse(st) {
    if (!BROWSE[st.kind]) { go('home', {}, true); return false; }
    renderBrowse(st.kind);
  },
  settings() {
    $('#backupStatus').textContent = '';
    renderSettings();
  },
  theme() { renderThemes(); },
  history() { renderHistory(); },
  trash() {
    if (purgeTrash()) save();
    ui.trashSelect = false;
    ui.trashSelected.clear();
    $('#trashSearch').value = ui.trashSearch;
    renderTrash();
  },
};

$$('[data-back]').forEach((b) => b.addEventListener('click', back));
$('#brandBtn').addEventListener('click', () => { if (current.view !== 'home') go('home'); });

/* =========================================================
   List view (Home "All" and Category page)
   ========================================================= */
const el = {
  favSection: $('#favSection'),
  favTrack: $('#favTrack'),
  favPrev: $('#favPrev'),
  favNext: $('#favNext'),
  favPager: $('#favPager'),
  listTitle: $('#listTitle'),
  listSub: $('#listSub'),
  listBack: $('#listBack'),
  listKebab: $('#listKebab'),
  allCount: $('#allCount'),
  grid: $('#grid'),
  search: $('#searchInput'),
  filterBtn: $('#filterBtn'),
  filterBadge: $('#filterBadge'),
  selectBar: $('#selectBar'),
  selCount: $('#selCount'),
  scrim: $('#scrim'),
  filterPanel: $('#filterPanel'),
  drawer: $('#drawer'),
};

function enterList(scope) {
  if (scope && scope !== ui.lastCat) ui.cat = newListState(); // fresh search/filter per category
  if (scope) ui.lastCat = scope;
  ui.scope = scope;
  L().selectMode = false;
  L().selected.clear();

  const c = scope ? realCat(scope) : null;
  el.favSection.hidden = !!scope;
  $('#browseSection').hidden = !!scope;
  el.listBack.hidden = !scope;
  el.listTitle.textContent = c ? c.name : 'All';
  el.listSub.hidden = !c;
  el.listSub.textContent = c ? `Counted by ${c.unit.toLowerCase()}` : '';
  el.search.value = L().search;
  $('#filterCatPara').hidden = !!scope;
  sortDD.refresh();
  renderHome();
}

/** Cover image; "themed" titles get the current theme's filter (Retro: sepia + grain, Manga: black & white + screentone). */
function imageHtml(src, themed, attrs = 'alt="" loading="lazy" decoding="async"') {
  return themed
    ? `<img class="is-themed" src="${esc(src)}" ${attrs}><span class="theme-fx" aria-hidden="true"></span>`
    : `<img src="${esc(src)}" ${attrs}>`;
}
function coverHtml(t) {
  return t.image ? imageHtml(t.image, t.themed) : `<div class="cover-ph">${I.book}</div>`;
}

const scopeTitles = () => (ui.scope ? db.titles.filter((t) => t.categoryId === ui.scope) : db.titles);

function visibleTitles() {
  const S = L();
  const q = norm(S.search);
  const { category, tags, exclude } = S.filter;
  const list = scopeTitles().filter((t) =>
    (ui.scope || !category || t.categoryId === category)
    && tags.every((id) => t.tags.includes(id))
    && !exclude.some((id) => t.tags.includes(id))
    && (!q || t.name.toLowerCase().includes(q)));

  const num = (t) => (t.number == null || t.number === '' ? null : Number(t.number));
  switch (S.sort) {
    case 'az': list.sort(byName); break;
    case 'most': list.sort((a, b) => (num(b) ?? -Infinity) - (num(a) ?? -Infinity) || byName(a, b)); break;
    case 'least': list.sort((a, b) => (num(a) ?? Infinity) - (num(b) ?? Infinity) || byName(a, b)); break;
    default: list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return list;
}

function activeFilterCount() {
  const f = L().filter;
  return (!ui.scope && f.category ? 1 : 0) + f.tags.length + f.exclude.length;
}

function renderFavorites() {
  const favs = db.titles.filter((t) => t.favorite).sort(byName);
  const per = favPerPage();
  el.favTrack.style.setProperty('--fav-n', per);
  const pages = Math.max(1, Math.ceil(favs.length / per));
  ui.favPage = Math.min(Math.max(ui.favPage, 0), pages - 1);
  const slice = favs.slice(ui.favPage * per, ui.favPage * per + per);

  el.favTrack.innerHTML = favs.length
    ? slice.map((t) => `<button type="button" class="fav-item" data-id="${t.id}">
        <div class="cover">${coverHtml(t)}</div>
        <span class="fav-name">${esc(t.name)}</span>
        <span class="muted small">${esc(fmtNum(unitOfTitle(t), t.number))}</span>
      </button>`).join('')
    : '<p class="fav-empty">Tap the ☆ on a title to add it here.</p>';

  el.favPrev.disabled = ui.favPage === 0;
  el.favNext.disabled = ui.favPage >= pages - 1;
  el.favPager.textContent = favs.length > per ? `${ui.favPage + 1} / ${pages}` : '';
}

function cardHtml(t) {
  const S = L();
  const unit = unitOfTitle(t);
  const cat = ui.scope ? null : realCat(t.categoryId);
  const sel = S.selected.has(t.id);
  const badge = S.selectMode
    ? `<span class="check">${sel ? I.check : ''}</span>`
    : `<button type="button" class="star${t.favorite ? ' on' : ''}" data-act="fav" aria-pressed="${!!t.favorite}" aria-label="${t.favorite ? 'Remove from' : 'Add to'} favorites">${I.star}</button>`;
  // Cover image opens the title's URL (if it has one).
  const cover = t.url && !S.selectMode
    ? `<a class="cover has-link" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(t.name)} link">${coverHtml(t)}<span class="link-badge" aria-hidden="true">${I.external}</span></a>`
    : `<div class="cover">${coverHtml(t)}</div>`;
  return `<article class="card${sel ? ' is-selected' : ''}${S.selectMode ? ' is-selecting' : ''}" data-id="${t.id}" ${S.selectMode ? 'tabindex="0"' : ''}>
    <div class="cover-wrap">${cover}${badge}</div>
    <div class="card-body">
      <div class="card-title-row">
        <h3 title="${esc(t.name)}">${esc(t.name)}</h3>
        ${S.selectMode ? '' : `<button type="button" class="edit-btn" data-act="edit" aria-label="Edit ${esc(t.name)}" title="Edit">${I.editNote}</button>`}
      </div>
      <div class="meta">
        <span class="num">${esc(fmtNum(unit, t.number)) || '—'}</span>
        ${S.selectMode ? '' : `<span class="inc-btns">
          <button type="button" class="plus1" data-act="inc" data-step="0.1" aria-label="Add 0.1 ${unit.toLowerCase()}">+0.1</button>
          <button type="button" class="plus1" data-act="inc" data-step="1" aria-label="Add 1 ${unit.toLowerCase()}">+1</button>
        </span>`}
      </div>
      ${cat ? `<span class="cat">${esc(cat.name)}</span>` : ''}
    </div>
  </article>`;
}

function renderList() {
  const S = L();
  const list = visibleTitles();
  const base = scopeTitles();
  el.allCount.textContent = list.length;

  const n = activeFilterCount();
  el.filterBadge.hidden = !n;
  el.filterBadge.textContent = n;
  el.filterBtn.classList.toggle('is-active', n > 0);

  if (!base.length) {
    el.grid.innerHTML = `<div class="grid-empty">${ui.scope ? 'No titles in this category yet.' : 'No titles yet.'}<br>
      <button type="button" class="btn btn-primary" data-act="add">${I.plus}Add title</button></div>`;
  } else if (!list.length) {
    el.grid.innerHTML = '<div class="grid-empty">No titles match your search or filters.</div>';
  } else {
    el.grid.innerHTML = list.map(cardHtml).join('');
  }

  el.selectBar.hidden = !S.selectMode;
  el.selCount.textContent = `${S.selected.size} selected`;
  $('#selRemove').hidden = !ui.scope;
  $('#selDelete').hidden = !!ui.scope;
  $('#filterResult').textContent = `${list.length} of ${base.length} titles shown`;
}

function renderHome() {
  if (!ui.scope) {
    renderFavorites();
    renderBrowseTiles();
  }
  renderList();
}

const addTitle = () => go('titleForm', ui.scope ? { cat: ui.scope } : {});

function updateTitle(id, patch, { touch = true, log = null } = {}) {
  commit(() => {
    const t = db.titles.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if (touch) t.updatedAt = Date.now();
    if (log) logHistory(t, log);
  });
  renderHome();
}

/* --- favorites carousel --- */
el.favPrev.addEventListener('click', () => { ui.favPage -= 1; renderFavorites(); });
el.favNext.addEventListener('click', () => { ui.favPage += 1; renderFavorites(); });
el.favTrack.addEventListener('click', (e) => {
  const item = e.target.closest('.fav-item');
  if (item) go('titleForm', { id: item.dataset.id });
});

/* --- grid --- */
el.grid.addEventListener('click', (e) => {
  const actBtn = e.target.closest('[data-act]');
  if (actBtn?.dataset.act === 'add') return addTitle();

  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  const t = db.titles.find((x) => x.id === id);
  if (!t) return;
  const S = L();

  if (S.selectMode) {
    e.preventDefault();
    if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
    return renderList();
  }
  const act = actBtn?.dataset.act;
  if (act === 'fav') return updateTitle(id, { favorite: !t.favorite }, { touch: false });
  if (act === 'inc') {
    const n = t.number == null || t.number === '' ? 0 : Number(t.number);
    const step = Number(actBtn.dataset.step) || 1;
    return updateTitle(id, { number: Math.round((n + step) * 10) / 10 }, { log: 'read' });
  }
  if (act === 'edit') go('titleForm', { id });
  // cover link opens the URL natively; anything else on the card does nothing
});
el.grid.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('is-selecting')) {
    e.preventDefault();
    e.target.click();
  }
});

/* --- header: back, ⋮ --- */
el.listBack.addEventListener('click', back);
el.listKebab.addEventListener('click', () => {
  const items = [
    { label: 'Add title', icon: 'plus', action: addTitle },
    { label: 'Select', icon: 'checkSquare', action: () => setSelectMode(true) },
  ];
  if (ui.scope) items.push({ label: 'Edit', icon: 'pencil', action: () => go('categoryForm', { id: ui.scope }) });
  toggleMenu(el.listKebab, items);
});

/* --- search & sort --- */
el.search.addEventListener('input', () => { L().search = el.search.value; renderList(); });

const sortDD = createDropdown($('#sortMount'), {
  searchable: false,
  showCount: false,
  getItems: () => SORTS.map((s) => ({ id: s.id, label: s.label })),
  getLabel: () => SORTS.find((s) => s.id === L().sort)?.label,
  isSelected: (id) => id === L().sort,
  onSelect: (id) => { L().sort = id; renderList(); },
});

/* --- select mode --- */
function setSelectMode(on) {
  L().selectMode = on;
  L().selected.clear();
  renderList();
}
const selectedTitles = () => db.titles.filter((t) => L().selected.has(t.id));

$('#selCancel').addEventListener('click', () => setSelectMode(false));
$('#selAll').addEventListener('click', () => {
  const S = L();
  const ids = visibleTitles().map((t) => t.id);
  const allSelected = ids.length && ids.every((id) => S.selected.has(id));
  S.selected = new Set(allSelected ? [] : ids);
  renderList();
});
$('#selFav').addEventListener('click', () => {
  const chosen = selectedTitles();
  if (!chosen.length) return;
  const makeFav = !chosen.every((t) => t.favorite);
  commit(() => chosen.forEach((t) => { t.favorite = makeFav; }));
  setSelectMode(false);
  renderHome();
});
$('#selRemove').addEventListener('click', () => {
  const chosen = selectedTitles();
  if (!chosen.length) return;
  const now = Date.now();
  commit(() => chosen.forEach((t) => {
    t.unit = unitOfTitle(t); // keep showing Ch./Vol. after leaving the category
    t.categoryId = NONE;
    t.updatedAt = now;
  }));
  setSelectMode(false);
  renderHome();
});
$('#selDelete').addEventListener('click', async () => {
  const ids = [...L().selected];
  if (!ids.length) return;
  const ok = await confirmBox(
    `Delete ${ids.length} title${ids.length > 1 ? 's' : ''}?`,
    `They will be moved to Recently Deleted and permanently deleted after ${TRASH_DAYS} days.`,
  );
  if (!ok) return;
  commit(() => moveToTrash(ids));
  setSelectMode(false);
  renderHome();
});

function moveToTrash(ids) {
  const now = Date.now();
  const set = new Set(ids);
  db.titles.filter((t) => set.has(t.id)).forEach((t) => {
    t.unit = unitOfTitle(t);
    logHistory(t, 'deleted');
    db.trash.unshift({ ...t, deletedAt: now });
  });
  db.titles = db.titles.filter((t) => !set.has(t.id));
}

/* =========================================================
   Side panels (filter + hamburger drawer)
   ========================================================= */
let openPanel = null;

function showPanel(panel) {
  closePanels();
  openPanel = panel;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  el.scrim.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closePanels() {
  if (!openPanel) return;
  openDropdowns.forEach((d) => d.close());
  [el.filterPanel, el.drawer].forEach((p) => {
    p.classList.remove('open');
    p.setAttribute('aria-hidden', String(!(p === el.drawer && mqPC.matches)));
  });
  openPanel = null;
  el.scrim.hidden = true;
  document.body.style.overflow = '';
}
el.scrim.addEventListener('click', closePanels);

/* --- filter panel --- */
const TAG_SEARCH_HINT = 'Search… (@author, @publisher, @general)';
const NO_TAGS = 'No tags yet. Create them in Menu → Tags.';

const filterDD = {
  cat: createDropdown($('#filterCatMount'), {
    placeholder: 'All categories',
    getItems: () => categoryItems(true),
    getLabel: () => catById(L().filter.category)?.name,
    isSelected: (id) => id === L().filter.category,
    onSelect: (id) => { const f = L().filter; f.category = f.category === id ? null : id; renderFilters(); },
  }),
  tag: createDropdown($('#filterTagMount'), {
    placeholder: 'Select tags',
    searchPlaceholder: TAG_SEARCH_HINT,
    emptyText: NO_TAGS,
    closeOnSelect: false,
    getItems: tagItems,
    isSelected: (id) => L().filter.tags.includes(id),
    onSelect: (id) => { toggleFilterTag('tags', 'exclude', id); renderFilters(); },
  }),
  ex: createDropdown($('#filterExMount'), {
    placeholder: 'Select tags to exclude',
    searchPlaceholder: TAG_SEARCH_HINT,
    emptyText: NO_TAGS,
    closeOnSelect: false,
    getItems: tagItems,
    isSelected: (id) => L().filter.exclude.includes(id),
    onSelect: (id) => { toggleFilterTag('exclude', 'tags', id); renderFilters(); },
  }),
};

function toggleFilterTag(key, otherKey, id) {
  const f = L().filter;
  f[key] = f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id];
  f[otherKey] = f[otherKey].filter((x) => x !== id); // a tag can't be both included and excluded
}

function renderFilters() {
  const f = L().filter;
  $('#filterCatChips').innerHTML = f.category ? chipsHtml([f.category], catById) : '';
  $('#filterTagChips').innerHTML = chipsHtml(f.tags, tagById);
  $('#filterExChips').innerHTML = chipsHtml(f.exclude, tagById, 'exclude');
  Object.values(filterDD).forEach((d) => d.refresh());
  renderList();
}

$('#filterCatChips').addEventListener('click', (e) => {
  if (e.target.closest('[data-remove]')) { L().filter.category = null; renderFilters(); }
});
$('#filterTagChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (b) { L().filter.tags = L().filter.tags.filter((x) => x !== b.dataset.remove); renderFilters(); }
});
$('#filterExChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (b) { L().filter.exclude = L().filter.exclude.filter((x) => x !== b.dataset.remove); renderFilters(); }
});

el.filterBtn.addEventListener('click', () => { renderFilters(); showPanel(el.filterPanel); });
$('#filterClose').addEventListener('click', closePanels);
$('#filterReset').addEventListener('click', () => {
  L().filter = { category: null, tags: [], exclude: [] };
  renderFilters();
});

/* --- hamburger drawer --- */
function renderDrawer() {
  $('#drawerHome').classList.toggle('is-active', current.view === 'home');
  $('#drawerAdd').classList.toggle('is-active', current.view === 'titleForm' && !current.id);
  const cats = sortedCats();
  $('#drawerCats').innerHTML = cats.length
    ? cats.map((c) => `<li><button type="button" class="drawer-cat${current.view === 'category' && current.id === c.id ? ' is-active' : ''}" data-cat="${c.id}">
        <span class="drawer-cat-name">${esc(c.name)}</span><span class="dd-count">${catCount(c.id)}</span>
      </button></li>`).join('')
    : '<li class="drawer-empty muted small">No categories yet. Tap + to create one.</li>';

  const tags = [...db.tags].sort(byName);
  const MAX = 18;
  $('#drawerTags').innerHTML = tags.length
    ? tags.slice(0, MAX).map((t) => `<span class="mini-chip">${esc(t.name)}</span>`).join('')
      + (tags.length > MAX ? `<span class="mini-chip">+${tags.length - MAX}</span>` : '')
    : '<span class="muted small">No tags yet. Tap the edit button to create one.</span>';
}

$('#menuBtn').addEventListener('click', () => { renderDrawer(); showPanel(el.drawer); });
$('#drawerClose').addEventListener('click', closePanels);
$('#drawerHome').addEventListener('click', () => (current.view === 'home' ? closePanels() : go('home')));
// From a category page the new title starts in that category
$('#drawerAdd').addEventListener('click', () => {
  if (current.view === 'titleForm' && !current.id) closePanels();
  else go('titleForm', current.view === 'category' ? { cat: current.id } : {});
});
$('#drawerCatAdd').addEventListener('click', () => go('categoryForm'));
$('#drawerCats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  if (current.view === 'category' && current.id === b.dataset.cat) closePanels();
  else go('category', { id: b.dataset.cat });
});
$('#drawerTagEdit').addEventListener('click', () => go('tags'));
$('#drawerSettings').addEventListener('click', () => go('settings'));

/* =========================================================
   New / Edit title
   ========================================================= */
const f = {
  heading: $('#formHeading'),
  form: $('#titleForm'),
  name: $('#fName'),
  image: $('#fImage'),
  preview: $('#imagePreview'),
  imageRemove: $('#imageRemove'),
  catField: $('#fCategoryField'),
  number: $('#fNumber'),
  numberLabel: $('#fNumberLabel'),
  unitSeg: $('#fUnitSeg'),
  tagChips: $('#fTagChips'),
  url: $('#fUrl'),
  urlOpen: $('#fUrlOpen'),
  styleRow: $('#fStyleRow'),
  themed: $('#fThemed'),
  themedName: $('#fThemedName'),
  error: $('#formError'),
  del: $('#formDelete'),
  submit: $('#formSubmit'),
};

const formCatDD = createDropdown($('#fCategoryMount'), {
  placeholder: 'Select category',
  getItems: () => categoryItems(true),
  getLabel: () => catById(form?.categoryId)?.name,
  isSelected: (id) => id === form?.categoryId,
  onSelect: (id) => { form.categoryId = id; renderUnit(); },
});

const formTagDD = createDropdown($('#fTagMount'), {
  placeholder: 'Select tags',
  searchPlaceholder: TAG_SEARCH_HINT,
  emptyText: NO_TAGS,
  closeOnSelect: false,
  getItems: tagItems,
  getLabel: () => (form?.tags.length ? `${form.tags.length} selected` : null),
  isSelected: (id) => form?.tags.includes(id),
  onSelect: (id) => {
    form.tags = form.tags.includes(id) ? form.tags.filter((x) => x !== id) : [...form.tags, id];
    renderFormTags();
  },
});

const formUnit = () => realCat(form.categoryId)?.unit || form.unit || 'Chapter';

/** Chapter/Volume follows the category; with "None" the user picks it. */
function renderUnit() {
  const unit = formUnit();
  f.numberLabel.textContent = unit;
  f.unitSeg.hidden = !!realCat(form.categoryId);
  $$('button', f.unitSeg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
  formCatDD.refresh();
}
f.unitSeg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-unit]');
  if (b) { form.unit = b.dataset.unit; renderUnit(); }
});

function renderFormTags() {
  f.tagChips.innerHTML = chipsHtml(form.tags, tagById);
  formTagDD.refresh();
}
function renderFormImage() {
  f.preview.querySelectorAll('img, .cover-ph, .theme-fx').forEach((n) => n.remove());
  f.preview.insertAdjacentHTML('afterbegin', form.image ? imageHtml(form.image, form.themed, 'alt="Title image preview"') : `<div class="cover-ph">${I.book}</div>`);
  f.imageRemove.hidden = !form.image;
  // Original / <current theme> switch only matters when there is an image
  f.styleRow.hidden = !form.image;
  f.themedName.textContent = themeById(currentTheme()).name;
  f.themed.setAttribute('aria-checked', String(form.themed));
  $$('.switch-opt', f.styleRow).forEach((o) => o.classList.toggle('is-on', (o.dataset.style === 'themed') === form.themed));
}
function normalizeUrl(u) {
  const s = u.trim();
  if (!s) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
}
function renderUrlOpen() {
  const u = normalizeUrl(f.url.value);
  const ok = /^https?:\/\//i.test(u);
  f.urlOpen.hidden = !ok;
  if (ok) f.urlOpen.href = u;
}

function openForm(id, presetCat) {
  const t = id ? db.titles.find((x) => x.id === id) : null;
  if (id && !t) { go('home', {}, true); return false; }

  const lockedCat = !t && presetCat && realCat(presetCat) ? presetCat : null;
  form = t
    ? { id: t.id, name: t.name, image: t.image || null, themed: !!t.themed, categoryId: realCat(t.categoryId) ? t.categoryId : NONE, unit: unitOfTitle(t), number: t.number ?? '', tags: [...t.tags], url: t.url || '' }
    : { id: null, name: '', image: null, themed: false, categoryId: lockedCat || ui.home.filter.category || NONE, unit: 'Chapter', number: '', tags: [], url: '' };
  if (form.categoryId !== NONE && !realCat(form.categoryId)) form.categoryId = NONE;

  f.heading.textContent = t ? 'Edit Title' : 'New Title';
  f.submit.textContent = t ? 'Save' : 'Create';
  f.del.hidden = !t;
  f.catField.hidden = !!lockedCat; // adding from a category page: category is already chosen
  f.name.value = form.name;
  f.number.value = form.number;
  f.url.value = form.url;
  f.error.hidden = true;
  renderFormImage();
  renderUnit();
  renderFormTags();
  renderUrlOpen();
  if (!t && matchMedia('(hover: hover)').matches) f.name.focus();
  return true;
}

f.url.addEventListener('input', renderUrlOpen);

/* image: downscale so many covers fit in browser storage */
function readImage(file, maxSide = 600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
    img.src = url;
  });
}

f.image.addEventListener('change', async () => {
  const file = f.image.files[0];
  f.image.value = '';
  if (!file || !form) return;
  try {
    form.image = await readImage(file);
    renderFormImage();
  } catch {
    alert('Could not read that image.');
  }
});
f.imageRemove.addEventListener('click', () => { form.image = null; renderFormImage(); });
f.themed.addEventListener('click', () => { form.themed = !form.themed; renderFormImage(); });
f.styleRow.addEventListener('click', (e) => {
  const o = e.target.closest('.switch-opt');
  if (o) { form.themed = o.dataset.style === 'themed'; renderFormImage(); }
});

f.tagChips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  form.tags = form.tags.filter((x) => x !== b.dataset.remove);
  renderFormTags();
});

function showError(box, msg, focusEl) {
  box.textContent = msg;
  box.hidden = false;
  focusEl?.focus();
}

f.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = f.name.value.trim();
  if (!name) return showError(f.error, 'Please enter a title name.', f.name);
  const rawNum = f.number.value.trim();
  const number = rawNum === '' ? null : Number(rawNum);
  if (number != null && (!Number.isFinite(number) || number < 0)) {
    return showError(f.error, `${formUnit()} must be a positive number.`, f.number);
  }

  const now = Date.now();
  const data = {
    name, image: form.image, themed: !!(form.image && form.themed), categoryId: form.categoryId, unit: formUnit(), number,
    tags: form.tags.filter((id) => tagById(id)), url: normalizeUrl(f.url.value),
  };
  const ok = commit(() => {
    const existing = form.id && db.titles.find((t) => t.id === form.id);
    if (existing) {
      const numberChanged = (existing.number ?? null) !== number;
      Object.assign(existing, data, { updatedAt: now });
      logHistory(existing, numberChanged ? 'read' : 'edited');
    } else {
      const t = { id: uid(), ...data, favorite: false, createdAt: now, updatedAt: now };
      db.titles.push(t);
      logHistory(t, 'added');
    }
  });
  if (ok) back();
});

f.del.addEventListener('click', async () => {
  if (!form?.id) return;
  const ok = await confirmBox(
    `Delete “${f.name.value.trim() || 'this title'}”?`,
    `It will be moved to Recently Deleted and permanently deleted after ${TRASH_DAYS} days.`,
  );
  if (!ok) return;
  const id = form.id;
  if (commit(() => moveToTrash([id]))) back();
});

/* =========================================================
   New / Edit category
   ========================================================= */
const cf = {
  heading: $('#cfHeading'),
  form: $('#catForm'),
  name: $('#cfName'),
  error: $('#cfError'),
  del: $('#cfDelete'),
  submit: $('#cfSubmit'),
};

const cfUnitDD = createDropdown($('#cfUnitMount'), {
  searchable: false,
  showCount: false,
  getItems: () => [{ id: 'Chapter', label: 'Chapter' }, { id: 'Volume', label: 'Volume' }],
  getLabel: () => cform?.unit,
  isSelected: (id) => id === cform?.unit,
  onSelect: (id) => { cform.unit = id; },
});

function openCatForm(id) {
  const c = id ? realCat(id) : null;
  if (id && !c) { go('home', {}, true); return false; }
  cform = { id: c?.id || null, unit: c?.unit || 'Chapter' };
  cf.heading.textContent = c ? 'Edit Category' : 'New Category';
  cf.submit.textContent = c ? 'Save' : 'Create';
  cf.del.hidden = !c;
  cf.name.value = c?.name || '';
  cf.error.hidden = true;
  cfUnitDD.refresh();
  if (matchMedia('(hover: hover)').matches) cf.name.focus();
  return true;
}

cf.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = cf.name.value.trim();
  if (!name) return showError(cf.error, 'Please enter a category name.', cf.name);
  if (norm(name) === NONE) return showError(cf.error, '“None” is reserved. Please choose another name.', cf.name);
  if (db.categories.some((c) => c.id !== cform.id && norm(c.name) === norm(name))) {
    return showError(cf.error, 'A category with this name already exists.', cf.name);
  }
  const ok = commit(() => {
    const c = cform.id && realCat(cform.id);
    if (c) Object.assign(c, { name, unit: cform.unit });
    else db.categories.push({ id: uid(), name, unit: cform.unit });
  });
  if (ok) back();
});

cf.del.addEventListener('click', async () => {
  const c = realCat(cform?.id);
  if (!c) return;
  const n = catCount(c.id);
  if (n > 0) {
    const ok = await confirmBox(
      `Delete “${c.name}”?`,
      `${n} title${n > 1 ? 's are' : ' is'} in this category. After deleting, ${n > 1 ? 'they' : 'it'} will be moved to the “None” category.`,
    );
    if (!ok) return;
  }
  const done = commit(() => {
    [...db.titles, ...db.trash].forEach((t) => {
      if (t.categoryId === c.id) { t.unit = c.unit; t.categoryId = NONE; }
    });
    db.categories = db.categories.filter((x) => x.id !== c.id);
  });
  if (!done) return;
  if (ui.home.filter.category === c.id) ui.home.filter.category = null;
  back(); // the category page underneath no longer exists and redirects home
});

/* =========================================================
   Tags page
   ========================================================= */
function renderTags() {
  const tags = [...db.tags].sort(byName);
  $('#tagsCount').textContent = `${tags.length} tag${tags.length === 1 ? '' : 's'}`;
  if (!tags.length) {
    $('#tagGroups').innerHTML = '<div class="empty-box">No tags yet. Tap “New tag” to create one.</div>';
    return;
  }
  $('#tagGroups').innerHTML = TAG_TYPES.map((type) => {
    const group = tags.filter((t) => t.type === type.id);
    if (!group.length) return '';
    return `<section class="tag-group">
      <h3>${esc(type.label)} · ${group.length}</h3>
      <div class="tag-list">${group.map((t) => `<span class="tag-chip">
        <span>${esc(t.name)}</span><span class="tag-count">${tagCount(t.id)}</span>
        <button type="button" class="tag-more" data-tag="${t.id}" aria-label="Options for ${esc(t.name)}" aria-haspopup="menu" aria-expanded="false">${I.kebab}</button>
      </span>`).join('')}</div>
    </section>`;
  }).join('');
}

async function tagDialog(tag = null) {
  const body = `
    <label class="field">
      <span class="field-label">Tag name</span>
      <input name="tagName" class="input" maxlength="60" autocomplete="off" value="${esc(tag?.name || '')}">
    </label>
    <fieldset class="field type-field">
      <legend class="field-label">Type</legend>
      <div class="seg seg-wide">${TAG_TYPES.map((t) => `<label>
        <input type="radio" name="tagType" value="${t.id}" ${(tag?.type || 'general') === t.id ? 'checked' : ''}><span>${t.label}</span>
      </label>`).join('')}</div>
    </fieldset>`;

  const result = await modal({
    title: tag ? 'Edit Tag' : 'New Tag',
    body,
    init: (formEl) => { const i = $('[name="tagName"]', formEl); i.focus(); i.select(); },
    submit: (formEl) => {
      const name = $('[name="tagName"]', formEl).value.trim();
      const type = $('[name="tagType"]:checked', formEl).value;
      if (!name) return 'Please enter a tag name.';
      if (db.tags.some((t) => t.id !== tag?.id && t.type === type && norm(t.name) === norm(name))) {
        return `A ${tagTypeLabel(type).toLowerCase()} tag with this name already exists.`;
      }
      return { name, type };
    },
  });
  if (!result) return;
  commit(() => {
    const existing = tag && tagById(tag.id);
    if (existing) Object.assign(existing, result);
    else db.tags.push({ id: uid(), ...result });
  });
  renderTags();
}

async function deleteTag(tag) {
  const n = tagCount(tag.id);
  if (n > 0) {
    const ok = await confirmBox(
      `Delete tag “${tag.name}”?`,
      `${n} title${n > 1 ? 's use' : ' uses'} this tag. It will be removed from ${n > 1 ? 'them' : 'it'}.`,
    );
    if (!ok) return;
  }
  commit(() => {
    [...db.titles, ...db.trash].forEach((t) => { t.tags = t.tags.filter((id) => id !== tag.id); });
    db.tags = db.tags.filter((t) => t.id !== tag.id);
  });
  [ui.home, ui.cat].forEach((S) => {
    S.filter.tags = S.filter.tags.filter((id) => id !== tag.id);
    S.filter.exclude = S.filter.exclude.filter((id) => id !== tag.id);
  });
  renderTags();
}

$('#tagAdd').addEventListener('click', () => tagDialog());
$('#tagGroups').addEventListener('click', (e) => {
  const b = e.target.closest('.tag-more');
  if (!b) return;
  const tag = tagById(b.dataset.tag);
  if (!tag) return;
  toggleMenu(b, [
    { label: 'Edit', icon: 'pencil', action: () => tagDialog(tag) },
    { label: 'Delete', icon: 'trash', danger: true, action: () => deleteTag(tag) },
  ]);
});

/* =========================================================
   Browse by: Publisher / Author / Categories
   ========================================================= */
const titlesWithTag = (id) => db.titles.filter((t) => t.tags.includes(id)).sort(byName);
const tagGroups = (type) => db.tags.filter((t) => t.type === type).sort(byName)
  .map((t) => ({ id: t.id, name: t.name, titles: titlesWithTag(t.id) }));

const BROWSE = {
  publisher: {
    label: 'Publisher', icon: 'publisher',
    empty: 'No publishers yet. Create a tag with type “Publisher” in Menu → Tags.',
    groups: () => tagGroups('publisher'),
  },
  author: {
    label: 'Author', icon: 'author',
    empty: 'No authors yet. Create a tag with type “Author” in Menu → Tags.',
    groups: () => tagGroups('author'),
  },
  category: {
    label: 'Categories', icon: 'library',
    empty: 'No categories yet. Create one with + next to Categories in the menu.',
    groups: () => {
      const byCat = (id) => db.titles.filter((t) => t.categoryId === id).sort(byName);
      const list = sortedCats().map((c) => ({ id: c.id, name: c.name, titles: byCat(c.id) }));
      const none = byCat(NONE);
      if (none.length) list.push({ id: NONE, name: 'None', titles: none }); // only when it has titles
      return list;
    },
  },
};
const browseOpen = { publisher: new Set(), author: new Set(), category: new Set() };
let browseKind = null;

function renderBrowseTiles() {
  const n = (type) => db.tags.filter((t) => t.type === type).length;
  $('#bcPublisher').textContent = n('publisher');
  $('#bcAuthor').textContent = n('author');
  $('#bcCategory').textContent = db.categories.length;
}

function browseRowHtml(t, kind) {
  const cat = kind === 'category' ? null : realCat(t.categoryId);
  const meta = [fmtNum(unitOfTitle(t), t.number), cat?.name].filter(Boolean).join(' · ');
  const thumb = t.url
    ? `<a class="thumb" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(t.name)} link">${coverHtml(t)}</a>`
    : `<div class="thumb">${coverHtml(t)}</div>`;
  return `<li class="browse-row">
    ${thumb}
    <div class="trash-main"><span class="trash-name">${esc(t.name)}</span><span class="muted small">${esc(meta) || '—'}</span></div>
    <button type="button" class="edit-btn" data-edit="${t.id}" aria-label="Edit ${esc(t.name)}" title="Edit">${I.editNote}</button>
  </li>`;
}

function renderBrowse(kind) {
  browseKind = kind;
  const B = BROWSE[kind];
  $('#browseIcon').innerHTML = I[B.icon];
  $('#browsePageHeading').textContent = B.label;
  const groups = B.groups();
  const box = $('#browseList');
  if (!groups.length) {
    box.innerHTML = `<div class="empty-box">${esc(B.empty)}</div>`;
    return;
  }
  box.innerHTML = `<div class="browse-groups">${groups.map((g) => `
    <details class="browse-group" data-id="${esc(g.id)}" ${browseOpen[kind].has(g.id) ? 'open' : ''}>
      <summary>
        <span class="bg-name">${esc(g.name)}</span>
        <span class="dd-count">${g.titles.length}</span>
        <span class="bg-chev">${I.chevDown}</span>
      </summary>
      <ul class="browse-titles">${g.titles.length
        ? g.titles.map((t) => browseRowHtml(t, kind)).join('')
        : '<li class="browse-none muted small">No titles yet.</li>'}</ul>
    </details>`).join('')}</div>`;
}

$$('[data-browse]').forEach((b) => b.addEventListener('click', () => go('browse', { kind: b.dataset.browse })));
// remember which names are expanded ('toggle' doesn't bubble, so listen in capture phase)
$('#browseList').addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.classList?.contains('browse-group') || !browseKind) return;
  if (d.open) browseOpen[browseKind].add(d.dataset.id);
  else browseOpen[browseKind].delete(d.dataset.id);
}, true);
$('#browseList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit]');
  if (b) go('titleForm', { id: b.dataset.edit });
});

/* =========================================================
   Setting, History
   ========================================================= */
/* --- Theme (saved per device; index.html applies it before first paint) --- */
const THEME_KEY = 'libraryhist.theme';
const THEMES = [
  { id: 'retro', name: 'Retro', desc: 'Kraft paper, ink and olive. Theme images: sepia with paper grain.', color: '#16140f' },
  { id: 'manga', name: 'Manga', desc: 'Black ink on white with screentone. Theme images: black & white.', color: '#f6f6f3' },
];
const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
function currentTheme() {
  return themeById(document.documentElement.dataset.theme).id;
}
function applyTheme(id) {
  const t = themeById(id);
  if (t.id === THEMES[0].id) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t.id;
  $('meta[name="theme-color"]')?.setAttribute('content', t.color);
  try { localStorage.setItem(THEME_KEY, t.id); } catch { /* still applied for this visit */ }
}
function renderThemes() {
  const cur = currentTheme();
  $('#themeList').innerHTML = THEMES.map((t) => `<button type="button" class="theme-opt" role="radio" aria-checked="${t.id === cur}" data-theme-id="${t.id}">
      <span class="theme-swatch swatch-${t.id}" aria-hidden="true"><i class="sw-band"></i><span class="sw-cards"><i></i><i></i><i></i></span></span>
      <span class="theme-info"><span class="theme-name">${esc(t.name)}</span><span class="theme-desc">${esc(t.desc)}</span></span>
      <span class="theme-radio" aria-hidden="true">${t.id === cur ? I.check : ''}</span>
    </button>`).join('');
}
$('#themeList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-id]');
  if (!b) return;
  applyTheme(b.dataset.themeId);
  renderThemes();
});

function renderSettings() {
  $('#themeHint').textContent = themeById(currentTheme()).name;
  $('#histCountLbl').textContent = db.history.length ? String(db.history.length) : '';
  $('#trashCountLbl').textContent = db.trash.length ? String(db.trash.length) : '';
}
$('#settingsView').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

const dayKey = (ts) => new Date(ts).toDateString();
function dayLabel(ts) {
  const today = new Date();
  if (dayKey(ts) === today.toDateString()) return 'Today';
  if (dayKey(ts) === new Date(today.getTime() - DAY).toDateString()) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
const timeLabel = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function renderHistory() {
  const list = [...db.history].sort((a, b) => b.at - a.at);
  const box = $('#histList');
  if (!list.length) {
    box.innerHTML = '<div class="empty-box">No history yet. Adding or updating a title will show up here.</div>';
    return;
  }
  const groups = [];
  list.forEach((h) => {
    const k = dayKey(h.at);
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, at: h.at, items: [] });
    groups[groups.length - 1].items.push(h);
  });
  box.innerHTML = groups.map((g) => `<h3 class="hist-day">${esc(dayLabel(g.at))}</h3>
    <ul class="row-list">${g.items.map((h) => {
      const exists = db.titles.some((t) => t.id === h.titleId);
      const num = fmtNum(h.unit, h.number);
      return `<li><button type="button" class="hist-row" data-title="${esc(h.titleId)}" ${exists ? '' : 'disabled'}>
        <span class="hist-main">
          <span class="hist-name">${esc(h.name)}</span>
          <span class="hist-detail"><span class="act act-${esc(h.action)}">${esc(ACTIONS[h.action] || h.action)}</span>${num ? ` · ${esc(num)}` : ''}</span>
        </span>
        <time datetime="${new Date(h.at).toISOString()}">${esc(timeLabel(h.at))}</time>
      </button></li>`;
    }).join('')}</ul>`).join('');
}
$('#histList').addEventListener('click', (e) => {
  const b = e.target.closest('.hist-row');
  if (b && !b.disabled) go('titleForm', { id: b.dataset.title });
});

/* =========================================================
   Recently Deleted
   ========================================================= */
const daysLeft = (t) => Math.max(1, Math.ceil((t.deletedAt + TRASH_DAYS * DAY - Date.now()) / DAY));

function visibleTrash() {
  const q = norm(ui.trashSearch);
  return db.trash.filter((t) => !q || t.name.toLowerCase().includes(q)).sort((a, b) => b.deletedAt - a.deletedAt);
}

function renderTrash() {
  const list = visibleTrash();
  const box = $('#trashList');
  $('#trashSelectBar').hidden = !ui.trashSelect;
  $('#tsCount').textContent = `${ui.trashSelected.size} selected`;
  const empty = $('#trashView .empty-box');
  empty?.remove();
  if (!list.length) {
    box.innerHTML = '';
    box.insertAdjacentHTML('afterend', `<div class="empty-box">${db.trash.length ? 'No deleted titles match your search.' : 'Nothing in Recently Deleted.'}</div>`);
    return;
  }
  box.innerHTML = list.map((t) => {
    const sel = ui.trashSelected.has(t.id);
    const cat = realCat(t.categoryId);
    const meta = [cat?.name, fmtNum(unitOfTitle(t), t.number)].filter(Boolean).join(' · ');
    const d = daysLeft(t);
    return `<li class="trash-row${sel ? ' is-selected' : ''}" data-id="${t.id}" tabindex="0">
      ${ui.trashSelect ? `<span class="check">${sel ? I.check : ''}</span>` : ''}
      <div class="thumb">${coverHtml(t)}</div>
      <div class="trash-main"><span class="trash-name">${esc(t.name)}</span><span class="muted small">${esc(meta)}</span></div>
      <span class="days-left">${d} day${d === 1 ? '' : 's'} left</span>
    </li>`;
  }).join('');
}

function setTrashSelect(on) {
  ui.trashSelect = on;
  ui.trashSelected.clear();
  renderTrash();
}

async function restoreTitles(ids) {
  const items = db.trash.filter((t) => ids.includes(t.id));
  if (!items.length) return;
  const dupes = items.filter((t) => db.titles.some((x) => norm(x.name) === norm(t.name)));
  if (dupes.length) {
    const names = dupes.slice(0, 3).map((t) => `“${t.name}”`).join(', ') + (dupes.length > 3 ? ` and ${dupes.length - 3} more` : '');
    const ok = await confirmBox(
      'Same title already in library',
      `${names} ${dupes.length > 1 ? 'have' : 'has'} the same name as a title in All. Restore anyway?`,
      'Restore', false,
    );
    if (!ok) return;
  }
  commit(() => {
    items.forEach((t) => {
      const { deletedAt, ...title } = t;
      if (!realCat(title.categoryId)) title.categoryId = NONE;
      title.tags = title.tags.filter((id) => tagById(id));
      db.titles.push(title);
      logHistory(title, 'restored');
    });
    db.trash = db.trash.filter((t) => !ids.includes(t.id));
  });
  setTrashSelect(false);
}

async function deleteForever(ids, all = false) {
  if (!ids.length) return;
  const ok = await confirmBox(
    all ? 'Delete all?' : `Delete ${ids.length} title${ids.length > 1 ? 's' : ''} permanently?`,
    all
      ? `All ${ids.length} title${ids.length > 1 ? 's' : ''} in Recently Deleted will be permanently deleted. This cannot be undone.`
      : 'This cannot be undone.',
    all ? 'Delete all' : 'Delete',
  );
  if (!ok) return;
  commit(() => { db.trash = db.trash.filter((t) => !ids.includes(t.id)); });
  setTrashSelect(false);
}

$('#trashSearch').addEventListener('input', (e) => { ui.trashSearch = e.target.value; renderTrash(); });
$('#trashKebab').addEventListener('click', (e) => {
  toggleMenu(e.currentTarget, [
    { label: 'Select', icon: 'checkSquare', disabled: !db.trash.length, action: () => setTrashSelect(true) },
    { label: 'Delete all', icon: 'trash', danger: true, disabled: !db.trash.length, action: () => deleteForever(db.trash.map((t) => t.id), true) },
  ]);
});
$('#trashList').addEventListener('click', (e) => {
  const row = e.target.closest('.trash-row');
  if (!row) return;
  const id = row.dataset.id;
  if (ui.trashSelect) {
    if (ui.trashSelected.has(id)) ui.trashSelected.delete(id); else ui.trashSelected.add(id);
    return renderTrash();
  }
  toggleMenu(row, [
    { label: 'Restore', icon: 'reset', action: () => restoreTitles([id]) },
    { label: 'Delete permanently', icon: 'trash', danger: true, action: () => deleteForever([id]) },
  ]);
});
$('#trashList').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('trash-row')) {
    e.preventDefault();
    e.target.click();
  }
});
$('#tsCancel').addEventListener('click', () => setTrashSelect(false));
$('#tsAll').addEventListener('click', () => {
  const ids = visibleTrash().map((t) => t.id);
  const allSelected = ids.length && ids.every((id) => ui.trashSelected.has(id));
  ui.trashSelected = new Set(allSelected ? [] : ids);
  renderTrash();
});
$('#tsRestore').addEventListener('click', () => restoreTitles([...ui.trashSelected]));
$('#tsDelete').addEventListener('click', () => deleteForever([...ui.trashSelected]));

/* =========================================================
   Backup: export / import a .zip = library.xlsx + images/
   ========================================================= */
const BACKUP_LIBS = { JSZip: 'vendor/jszip.min.js', XLSX: 'vendor/xlsx.mini.min.js' };
const NAME_SEP = '; ';
const TITLE_COLS = ['ID', 'Name', 'Category', 'Unit', 'Number', 'Publisher', 'Author', 'Tags', 'URL', 'Favorite', 'Image', 'Image Style', 'Created', 'Modified'];
const SHEETS = { titles: 'Titles', deleted: 'Recently Deleted', categories: 'Categories', tags: 'Tags', history: 'History' };
const IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const EXT_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}. Make sure the vendor folder is next to index.html.`));
    document.head.append(s);
  });
}
async function loadBackupLibs() {
  for (const [name, src] of Object.entries(BACKUP_LIBS)) {
    if (!window[name]) await loadScript(src);
  }
}

const pad2 = (n) => String(n).padStart(2, '0');
/** Local "YYYY-MM-DD HH:mm:ss" — readable in Excel and parsed back exactly. */
function fmtStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function parseStamp(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'number') return v > 1e11 ? v : Math.round((v - 25569) * DAY + new Date().getTimezoneOffset() * 60000); // epoch ms or Excel serial
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

const normUnit = (u) => (norm(u).startsWith('vol') ? 'Volume' : 'Chapter');
const normType = (t) => { const x = norm(t); return TAG_TYPES.find((k) => k.id === x || x.startsWith(k.id.slice(0, 4)))?.id || 'general'; };
/** Header-insensitive row: { name: ..., 'title id': ... } */
const lowerKeys = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), v]));

function setBackupBusy(busy, msg = '') {
  $('#exportBtn').disabled = busy;
  $('#importBtn').disabled = busy;
  $('#backupStatus').textContent = msg;
}

async function exportZip() {
  setBackupBusy(true, 'Preparing export…');
  try {
    const { blob, images } = await buildBackupZip();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `libraryhist-backup-${fmtStamp(Date.now()).slice(0, 10)}.zip`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setBackupBusy(false, `Exported ${db.titles.length} titles and ${images} images.`);
  } catch (err) {
    setBackupBusy(false, `Export failed: ${err.message || err}`);
  }
}

async function buildBackupZip() {
  await loadBackupLibs();
  const zip = new JSZip();
  let images = 0;

  const titleRow = (t) => {
    const names = (type) => t.tags.map(tagById).filter((x) => x && x.type === type).map((x) => x.name).join(NAME_SEP);
    let image = '';
    const m = t.image && t.image.match(/^data:([^;,]+);base64,(.*)$/);
    if (m) {
      image = `images/${t.id}.${IMG_EXT[m[1]] || 'jpg'}`;
      zip.file(image, m[2], { base64: true, compression: 'STORE' }); // already compressed
      images += 1;
    }
    return {
      ID: t.id, Name: t.name, Category: realCat(t.categoryId)?.name || 'None', Unit: unitOfTitle(t),
      Number: t.number ?? '', Publisher: names('publisher'), Author: names('author'), Tags: names('general'),
      URL: t.url || '', Favorite: t.favorite ? 'Yes' : 'No', Image: image, 'Image Style': t.themed ? 'Theme' : 'Original',
      Created: fmtStamp(t.createdAt), Modified: fmtStamp(t.updatedAt),
    };
  };

  const sheet = (rows, header, widths) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    ws['!cols'] = widths.map((wch) => ({ wch }));
    return ws;
  };
  const titleWidths = [14, 32, 16, 9, 9, 20, 20, 28, 36, 9, 24, 12, 20, 20];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet([...db.titles].sort(byName).map(titleRow), TITLE_COLS, titleWidths), SHEETS.titles);
  XLSX.utils.book_append_sheet(wb, sheet(
    db.trash.map((t) => ({ ...titleRow(t), Deleted: fmtStamp(t.deletedAt) })),
    [...TITLE_COLS, 'Deleted'], [...titleWidths, 20],
  ), SHEETS.deleted);
  XLSX.utils.book_append_sheet(wb, sheet(sortedCats().map((c) => ({ Name: c.name, Unit: c.unit })), ['Name', 'Unit'], [24, 10]), SHEETS.categories);
  XLSX.utils.book_append_sheet(wb, sheet(
    [...db.tags].sort(byName).map((t) => ({ Name: t.name, Type: tagTypeLabel(t.type) })), ['Name', 'Type'], [28, 12],
  ), SHEETS.tags);
  XLSX.utils.book_append_sheet(wb, sheet(db.history.map((h) => ({
    Date: fmtStamp(h.at), Title: h.name, Action: ACTIONS[h.action] || h.action, Unit: h.unit, Number: h.number ?? '', 'Title ID': h.titleId,
  })), ['Date', 'Title', 'Action', 'Unit', 'Number', 'Title ID'], [20, 32, 10, 9, 9, 14]), SHEETS.history);

  zip.file('library.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, images };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Read a backup zip into a new db object (does not touch the current library). */
async function readBackupZip(file) {
  await loadBackupLibs();
  let zip;
  try { zip = await JSZip.loadAsync(file); } catch { throw new Error('That file is not a valid .zip.'); }
  const xf = zip.file(/(^|\/)library\.xlsx$/i)[0] || zip.file(/\.xlsx$/i)[0];
  if (!xf) throw new Error('No .xlsx file found in the zip.');
  const base = xf.name.includes('/') ? xf.name.slice(0, xf.name.lastIndexOf('/') + 1) : '';
  const wb = XLSX.read(await xf.async('arraybuffer'), { type: 'array', cellDates: true });
  const findSheet = (name) => wb.SheetNames.find((n) => norm(n) === norm(name));
  if (!findSheet(SHEETS.titles)) throw new Error('The .xlsx has no “Titles” sheet.');
  const rows = (name) => {
    const n = findSheet(name);
    return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }).map(lowerKeys) : [];
  };

  const next = freshDb();
  const now = Date.now();
  const stats = { titles: 0, deleted: 0, images: 0 };

  // categories & tags are matched by name, so rows typed into Excel by hand work too
  const cats = new Map();
  const ensureCat = (name, unit) => {
    const n = String(name ?? '').trim();
    if (!n || norm(n) === NONE) return NONE;
    if (!cats.has(norm(n))) {
      const c = { id: uid(), name: n, unit: normUnit(unit) };
      next.categories.push(c);
      cats.set(norm(n), c);
    }
    return cats.get(norm(n)).id;
  };
  const tags = new Map();
  const ensureTag = (name, type) => {
    const n = String(name ?? '').trim();
    if (!n) return null;
    const ty = normType(type);
    const key = `${ty}|${norm(n)}`;
    if (!tags.has(key)) {
      const t = { id: uid(), name: n, type: ty };
      next.tags.push(t);
      tags.set(key, t);
    }
    return tags.get(key).id;
  };
  rows(SHEETS.categories).forEach((r) => ensureCat(r.name, r.unit));
  rows(SHEETS.tags).forEach((r) => ensureTag(r.name, r.type));

  const splitNames = (v) => String(v ?? '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const findImage = (path, id) => {
    const p = String(path ?? '').trim().replace(/^\.?\//, '');
    if (p) {
      const f = zip.file(p) || zip.file(base + p);
      if (f) return f;
    }
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return zip.file(new RegExp(`(^|/)images/${esc}\\.(jpe?g|png|webp|gif)$`, 'i'))[0] || null;
  };
  const loadImage = async (path, id) => {
    const f = findImage(path, id);
    if (!f) return null;
    const mime = EXT_MIME[f.name.split('.').pop().toLowerCase()];
    if (!mime) return null;
    const blob = new Blob([await f.async('arraybuffer')], { type: mime });
    stats.images += 1;
    return blob.size > 200 * 1024 ? readImage(blob) : blobToDataUrl(blob); // shrink big images
  };

  const usedIds = new Set();
  const rowToTitle = async (r) => {
    const name = String(r.name ?? '').trim();
    if (!name) return null;
    let id = String(r.id ?? '').trim();
    if (!id || usedIds.has(id)) id = uid();
    usedIds.add(id);
    const categoryId = ensureCat(r.category, r.unit);
    const numRaw = String(r.number ?? '').trim();
    const number = numRaw === '' || !Number.isFinite(Number(numRaw)) ? null : Number(numRaw);
    const tagIds = [
      ...splitNames(r.publisher).map((n) => ensureTag(n, 'publisher')),
      ...splitNames(r.author).map((n) => ensureTag(n, 'author')),
      ...splitNames(r.tags).map((n) => ensureTag(n, 'general')),
    ];
    const createdAt = parseStamp(r.created) ?? now;
    let image = null;
    try { image = await loadImage(r.image, id); } catch { /* skip unreadable image */ }
    return {
      id, name, image, themed: !!image && ['theme', 'themed', 'retro', 'manga'].includes(norm(r['image style'])), categoryId,
      unit: categoryId === NONE ? normUnit(r.unit) : next.categories.find((c) => c.id === categoryId).unit,
      number, tags: [...new Set(tagIds)], url: normalizeUrl(String(r.url ?? '')),
      favorite: /^(yes|y|true|1)$/i.test(String(r.favorite ?? '').trim()),
      createdAt, updatedAt: parseStamp(r.modified) ?? createdAt,
    };
  };

  for (const r of rows(SHEETS.titles)) {
    const t = await rowToTitle(r);
    if (t) { next.titles.push(t); stats.titles += 1; }
  }
  for (const r of rows(SHEETS.deleted)) {
    const t = await rowToTitle(r);
    if (t) { next.trash.push({ ...t, deletedAt: parseStamp(r.deleted) ?? now }); stats.deleted += 1; }
  }

  const actionKey = (a) => Object.keys(ACTIONS).find((k) => k === norm(a) || norm(ACTIONS[k]) === norm(a)) || 'edited';
  next.history = rows(SHEETS.history).map((r) => {
    const name = String(r.title ?? '').trim();
    const tid = String(r['title id'] ?? '').trim();
    const match = (tid && usedIds.has(tid)) ? tid : next.titles.find((t) => norm(t.name) === norm(name))?.id;
    const n = String(r.number ?? '').trim();
    return {
      id: uid(), titleId: match || tid || uid(), name, unit: normUnit(r.unit),
      number: n === '' || !Number.isFinite(Number(n)) ? null : Number(n),
      action: actionKey(r.action), at: parseStamp(r.date) ?? now,
    };
  }).filter((h) => h.name).sort((a, b) => b.at - a.at).slice(0, HISTORY_MAX);

  return { next, stats };
}

async function importZip(file) {
  setBackupBusy(true, 'Reading backup…');
  try {
    const { next, stats } = await readBackupZip(file);
    setBackupBusy(true, '');
    const ok = await confirmBox(
      'Replace your library?',
      `This backup has ${stats.titles} titles, ${next.categories.length} categories, ${next.tags.length} tags and ${stats.images} images`
        + `${stats.deleted ? ` (+${stats.deleted} recently deleted)` : ''}. `
        + `Your current ${db.titles.length} titles and all other data will be replaced.`,
      'Replace',
    );
    if (!ok) return setBackupBusy(false, 'Import cancelled.');
    const prev = db;
    db = next;
    purgeTrash();
    if (!save()) {
      db = prev;
      return setBackupBusy(false, 'Import failed: not enough browser storage for this backup.');
    }
    ui.home = newListState();
    ui.cat = newListState();
    ui.lastCat = null;
    Object.values(browseOpen).forEach((s) => s.clear());
    renderSettings();
    renderDrawer();
    setBackupBusy(false, `Imported ${stats.titles} titles and ${stats.images} images.`);
  } catch (err) {
    setBackupBusy(false, `Import failed: ${err.message || err}`);
  }
}

$('#exportBtn').addEventListener('click', exportZip);
$('#importBtn').addEventListener('click', () => $('#importInput').click());
$('#importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importZip(file);
});

/* =========================================================
   Global listeners + start
   ========================================================= */
document.addEventListener('pointerdown', (e) => {
  openDropdowns.forEach((d) => { if (!d.root.contains(e.target)) d.close(); });
  if (!pop.hidden && !pop.contains(e.target) && !popAnchor?.contains(e.target)) hideMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || dlg.open) return;
  if (openDropdowns.size) return openDropdowns.forEach((d) => d.close());
  if (!pop.hidden) return hideMenu();
  if (openPanel) return closePanels();
  if (current.view === 'trash' && ui.trashSelect) return setTrashSelect(false);
  if (L().selectMode && VIEW_EL[current.view] === 'listView') setSelectMode(false);
});

/* switching between phone / tablet / PC (rotate, resize window) */
function onLayoutChange() {
  closePanels();
  el.drawer.setAttribute('aria-hidden', String(!mqPC.matches));
  if (current.view === 'home') renderFavorites();
}
mqTablet.addEventListener('change', onLayoutChange);
mqPC.addEventListener('change', onLayoutChange);
el.drawer.setAttribute('aria-hidden', String(!mqPC.matches));

const initial = history.state?.view ? history.state : { view: 'home', depth: 0 };
history.replaceState(initial, '');
show(initial, true);
