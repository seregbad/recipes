// «Наша кухня» — интерфейс приложения.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = U.esc;
  const CFG = window.APP_CONFIG || {};
  const REMIND_DAYS = CFG.remindDays || 7;

  const RECIPE_CATS = ['Завтраки', 'Супы', 'Основные блюда', 'Гарниры', 'Салаты', 'Закуски', 'Выпечка', 'Десерты',
    'Напитки', 'Соусы', 'Детское (Савва)', 'Заготовки', 'Другое'];
  const STATUS = { new: 'Не пробовали', liked: 'Понравилось', meh: 'Не зашло' };
  const UNITS = ['шт', 'г', 'кг', 'мл', 'л', 'уп.', 'пачка', 'пакет', 'банка', 'бутылка', 'коробка', 'пучок', 'головка', 'зубчик', 'кусок', 'ст. л.', 'ч. л.', 'стакан', 'порция', 'контейнер'];
  // выпадающий список единиц; незнакомая единица (например, из импортированного рецепта) сохраняется как вариант
  const unitSelect = (value = '') => {
    const v = value || '';
    const opts = UNITS.includes(v) || !v ? UNITS : [v, ...UNITS];
    return `<select name="unit" aria-label="Единица"><option value="">ед.</option>${opts.map((u) => `<option ${u === v ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>`;
  };
  const PLACES = ['Морозилка', 'Холодильник', 'Кладовка', 'Балкон'];

  const I = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    fridge: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14"/><path d="M9 5v2"/><path d="M9 13v3"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2M4 10.5l1-3.5-3.5-1M20 13.5l-1 3.5 3.5 1M4 13.5l1 3.5-3.5 1M20 10.5l-1-3.5 3.5-1"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    jar: '<path d="M8 2h8M7 5h10M6 5h12v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M6 11h12"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;

  // ---------- Состояние интерфейса (запоминается в этом браузере) ----------
  const UI_KEY = 'nasha-kuhnya:ui';
  const ui = Object.assign({
    rq: '', rStatus: 'all', rCat: '',
    matchMode: 'home', matchExtra: [], ignoreStaples: true,
    prodTab: 'home', prodQ: '',
    shopTab: 'todo', shopQ: '',
    presOwner: 'family', presKind: 'all',
    menuWeek: 0,
  },(() => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } })());
  let installPrompt = null; // событие «установить приложение» (Android/Chrome)
  const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* приватный режим */ } };

  // ---------- Справочник ----------
  let catalogCache = null, catalogSig = '';
  function catalog() {
    const custom = Store.all('custom_ingredients');
    const sig = custom.map((c) => c.id + c.name).join('|');
    if (!catalogCache || sig !== catalogSig) {
      catalogCache = U.catalogList(custom);
      catalogSig = sig;
      const dl = $('#dl-ing');
      if (dl) dl.innerHTML = catalogCache.map((c) => `<option value="${esc(c.name)}">`).join('');
    }
    return catalogCache;
  }
  // категория продукта: точное название → прежнее название → ближайший продукт справочника («Сыр Гауда 45%» → «Сыры»)
  const catMemo = new Map();
  let catMemoFor = null;
  const catOf = (name) => {
    const list = catalog();
    if (catMemoFor !== list) { catMemo.clear(); catMemoFor = list; }
    const n = U.norm(name);
    if (catMemo.has(n)) return catMemo.get(n);
    const legacy = Object.keys(window.INGREDIENT_LEGACY || {}).find((k) => U.norm(k) === n);
    const exact = (x) => list.find((c) => U.norm(c.name) === U.norm(x));
    let hit = exact(name) || (legacy && exact(window.INGREDIENT_LEGACY[legacy]));
    if (!hit) { const key = U.ingKey(name, list); hit = list.find((c) => c.name === key); }
    const cat = hit ? hit.cat : 'Другое';
    catMemo.set(n, cat);
    return cat;
  };
  const ingLabel = (i) => i.key || i.name;

  // ---------- Наличие продуктов ----------
  const pantry = () => Store.all('pantry');
  function hasAmong(names, ing) {
    return names.some((n) => U.sameIng(n, ingLabel(ing)) || U.sameIng(n, ing.name));
  }
  function analyze(recipe, names) {
    const ings = (recipe.ingredients || []).filter((i) => !(ui.ignoreStaples && (U.isStaple(ingLabel(i)) || i.unit === 'по вкусу')));
    const missing = ings.filter((i) => !hasAmong(names, i));
    return { total: ings.length, have: ings.length - missing.length, missing };
  }

  // ---------- Сроки годности ----------
  function expiryInfo(p) {
    if (!p.expires_on) return { cls: '', text: 'срок не указан', days: Infinity };
    const d = U.daysLeft(p.expires_on);
    if (d < 0) return { cls: 'bad', text: `просрочено ${U.daysWord(-d)} назад`, days: d };
    if (d === 0) return { cls: 'bad', text: 'истекает сегодня', days: d };
    if (d <= REMIND_DAYS) return { cls: 'warn', text: `осталось ${U.daysWord(d)}`, days: d };
    return { cls: 'ok', text: `до ${U.fmtDate(p.expires_on)}`, days: d };
  }
  const activePreserves = () => Store.all('preserves').filter((p) => !p.finished);
  function expiringSoon() {
    return activePreserves().filter((p) => p.expires_on && U.daysLeft(p.expires_on) <= REMIND_DAYS)
      .sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  }

  // ---------- Уведомления и модальные окна ----------
  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 3200);
  }
  const fail = (e) => { console.error(e); toast('Ошибка: ' + (e && e.message ? e.message : e), 'err'); };

  function openModal(html) {
    const d = $('#modal');
    d.innerHTML = `<div class="modal-inner">${html}</div>`;
    delete d.dataset.dirty;
    if (!d.open) d.showModal();
    const first = d.querySelector('[autofocus]');
    if (first) first.focus();
    return d;
  }
  function closeModal() {
    const d = $('#modal');
    if (!d.open) return;
    const rc = rcBeforeClose();
    d.close();
    if (rc && route().name === 'shopping') refresh();
  }

  function confirmBox(text, okLabel = 'Удалить') {
    return new Promise((resolve) => {
      const d = openModal(`
        <p class="confirm-text">${esc(text)}</p>
        <div class="form-actions">
          <button type="button" class="btn" data-c="0">Отмена</button>
          <button type="button" class="btn danger" data-c="1">${esc(okLabel)}</button>
        </div>`);
      const done = (v) => { d.removeEventListener('click', h); closeModal(); resolve(v); };
      const h = (e) => { const b = e.target.closest('[data-c]'); if (b) done(b.dataset.c === '1'); };
      d.addEventListener('click', h);
      d.addEventListener('close', () => resolve(false), { once: true });
    });
  }

  // ---------- Маршрутизация ----------
  const route = () => {
    const parts = (location.hash || '#/recipes').replace(/^#\/?/, '').split('/');
    return { name: parts[0] || 'recipes', id: parts[1] ? decodeURIComponent(parts[1]) : null };
  };
  // версия для компьютера (desktop.html) подключает свои страницы и «крючки» через window.App
  const isDesktop = document.documentElement.dataset.app === 'desktop';
  const extraViews = {};
  const hooks = { recipeRowStart: null, recipeListTop: null, recipeActions: null, menuActions: null, shoppingActions: null };
  const hook = (name, ...args) => (hooks[name] ? hooks[name](...args) : '');
  const readyHooks = [];

  const NAV = [
    { r: 'recipes', label: 'Рецепты', ic: 'book' },
    { r: 'menu', label: 'Меню', ic: 'cal' },
    { r: 'match', label: 'Подбор', ic: 'bulb' },
    { r: 'products', label: 'Продукты', ic: 'fridge' },
    { r: 'shopping', label: 'Покупки', ic: 'cart' },
    { r: 'preserves', label: 'Заготовки', ic: 'snow' },
  ];

  let needLogin = false;
  function render() {
    const main = $('#view');
    const a = document.activeElement;
    const focusId = a && main.contains(a) && a.id;
    const selStart = focusId && a.selectionStart;
    const scrollY = window.scrollY;

    const st = Store.status();
    const modeEl = $('#mode');
    // изменения уходят в базу в фоне; значок появляется, только когда что-то не так
    const netText = { offline: 'нет сети', down: 'база не отвечает', auth: 'нет доступа к базе' }[st.net] || '';
    const modeText = st.mode === 'local' ? 'локально' : netText ? `${netText}${st.pending ? ` · не отправлено: ${st.pending}` : ''} ↻` : '';
    if (!modeEl.classList.contains('busy')) modeEl.textContent = modeText;
    modeEl.hidden = !modeText || needLogin;
    modeEl.classList.toggle('local', st.mode === 'local');
    modeEl.title = st.mode === 'local' ? '' : 'Нажмите, чтобы отправить изменения и обновить данные сейчас';

    $('#tabbar').hidden = $('#topnav').hidden = $('#settings-btn').hidden = needLogin;
    if (needLogin) { main.innerHTML = viewLogin(); $('#alert').innerHTML = ''; return; }
    catalog();
    const r = route();
    const nav = r.name === 'recipe' || r.name === 'cook' ? 'recipes' : r.name;
    document.body.classList.toggle('cooking', r.name === 'cook');
    keepAwake(r.name === 'cook');
    document.querySelectorAll('#tabbar a, #topnav a').forEach((el) => el.classList.toggle('active', el.dataset.r === nav));
    const shopCount = Store.all('shopping').filter((s) => s.status !== 'bought').length;
    document.querySelectorAll('[data-badge="shopping"]').forEach((el) => { el.textContent = shopCount || ''; el.hidden = !shopCount; });

    renderAlert(r.name);
    const views = Object.assign({ recipes: viewRecipes, recipe: viewRecipe, cook: viewCook, menu: viewMenu, match: viewMatch, products: viewProducts, shopping: viewShopping, preserves: viewPreserves, settings: viewSettings }, extraViews);
    main.innerHTML = (views[r.name] || viewRecipes)(r.id);

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch (e) { /* не текстовое поле */ } }
    }
    if (render.keepScroll) window.scrollTo(0, scrollY);
    render.keepScroll = false;
    if (sug.input && !document.contains(sug.input)) hideSuggest();
  }
  // перерисовка без прыжка страницы (после действий на той же странице)
  const refresh = () => { render.keepScroll = true; render(); };

  function renderAlert(rname) {
    const soon = expiringSoon();
    const box = $('#alert');
    if (!soon.length || rname === 'preserves') { box.innerHTML = ''; return; }
    const bad = soon.filter((p) => U.daysLeft(p.expires_on) < 0).length;
    const names = soon.slice(0, 3).map((p) => p.name + (p.owner === 'savva' ? ' (Савва)' : '')).join(', ');
    box.innerHTML = `<a class="alert" href="#/preserves">${icon('alert')}
      <span><b>Скоро конец срока: ${soon.length}</b>${bad ? ` · просрочено: ${bad}` : ''}<br><small>${esc(names)}${soon.length > 3 ? '…' : ''}</small></span></a>`;
  }

  // =====================================================================
  // РЕЦЕПТЫ
  // =====================================================================
  function filteredRecipes() {
    const q = U.norm(ui.rq);
    return Store.all('recipes')
      .filter((r) => ui.rStatus === 'all' || (r.status || 'new') === ui.rStatus)
      .filter((r) => !ui.rCat || r.category === ui.rCat)
      .filter((r) => !q || U.norm(r.title).includes(q) || (r.ingredients || []).some((i) => U.norm(i.name).includes(q) || U.norm(i.key).includes(q)))
      .sort((a, b) => (b.status === 'liked') - (a.status === 'liked') || String(a.title).localeCompare(String(b.title), 'ru'));
  }

  function viewRecipes() {
    const all = Store.all('recipes');
    const cnt = (s) => all.filter((r) => (r.status || 'new') === s).length;
    const chips = [['all', `Все · ${all.length}`], ['new', `Не пробовали · ${cnt('new')}`], ['liked', `Понравилось · ${cnt('liked')}`], ['meh', `Не зашло · ${cnt('meh')}`]];
    return `
      <div class="page-head">
        <h1>Рецепты</h1>
        <label class="btn grow-0" title="txt, pdf, Word или фото страницы; можно несколько файлов сразу">${icon('upload')}<span>Из файла</span><input type="file" accept="${RECIPE_FILE_TYPES}" multiple data-act-change="recipe-files" hidden></label>
        <button class="btn primary" data-act="recipe-new">${icon('plus')}<span>Рецепт</span></button>
      </div>
      <div class="toolbar">
        <label class="search">${icon('search')}<input id="rq" type="search" placeholder="Название или ингредиент" value="${esc(ui.rq)}" data-input="rq"></label>
        <select id="rcat" data-change="rCat" aria-label="Категория">
          <option value="">Все категории</option>
          ${RECIPE_CATS.map((c) => `<option ${ui.rCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="chips">${chips.map(([v, l]) => `<button class="chip ${ui.rStatus === v ? 'on' : ''}" data-act="set" data-k="rStatus" data-v="${v}">${esc(l)}</button>`).join('')}</div>
      <div id="list">${recipesList()}</div>`;
  }

  function recipesList() {
    const list = filteredRecipes();
    if (!Store.all('recipes').length) {
      return `<div class="empty">${icon('book', 'big')}<h3>Пока нет ни одного рецепта</h3>
        <p>Нажмите «Рецепт» и вставьте ссылку на понравившийся рецепт.<br>Новые рецепты попадают в «Не пробовали». Когда приготовите, отметьте «Понравилось».</p>
        <div class="row wrap center">
          <button class="btn primary" data-act="seed">${icon('download')}<span>Добавить наши блюда из «Меню недели» (${(window.SEED_RECIPES || []).length})</span></button>
          <button class="btn" data-act="recipe-new">${icon('plus')}<span>Добавить рецепт</span></button>
        </div></div>`;
    }
    if (!list.length) return `<div class="empty small">Ничего не нашлось</div>`;
    const names = pantry().map((p) => p.name);
    return `${hook('recipeListTop', list)}<div class="rtable" role="table">
      <div class="rrow rhead" role="row">${hook('recipeRowStart', null, list)}<span></span><span>Название</span><span>Категория</span><span>Есть дома</span><span>Статус</span></div>
      ${list.map((r) => {
        const a = analyze(r, names);
        const pct = a.total ? Math.round((a.have / a.total) * 100) : 0;
        const host = r.url ? safeHost(r.url) : '';
        return `<a class="rrow" role="row" href="#/recipe/${encodeURIComponent(r.id)}">
          ${hook('recipeRowStart', r)}<span class="thumb">${r.image ? `<img src="${esc(Store.mediaUrl(r.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icon('book')}</span>
          <span class="rtitle"><b>${esc(r.title)}</b>${host || lastCooked(r) ? `<small>${esc([host, lastCooked(r) ? 'готовили ' + U.ago(lastCooked(r)) : ''].filter(Boolean).join(' · '))}</small>` : ''}</span>
          <span class="rcat">${esc(r.category || '')}</span>
          <span class="rhave">${a.total ? `<span class="meter"><i style="width:${pct}%"></i></span><small>${a.have} из ${a.total}</small>` : '<small>—</small>'}</span>
          <span class="rstatus">${statusBadge(r.status)}</span>
        </a>`;
      }).join('')}
    </div>`;
  }
  const statusBadge = (s) => {
    s = s || 'new';
    return `<span class="badge st-${s}">${s === 'liked' ? icon('heart', 'fill') : ''}${esc(STATUS[s])}</span>`;
  };
  function safeHost(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  // ---------- Пересчёт рецепта ----------
  // f — общий множитель (порции или «подогнать под продукт»), over — правки отдельных ингредиентов.
  // Живёт, пока открыто приложение; сохранить в рецепт можно при «Приготовили».
  const adj = {};
  const baseServings = (r) => { const m = String(r.servings || '').match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : 0; };
  const scaleOf = (r) => (adj[r.id] ? adj[r.id].f : 1);
  const adjOf = (r) => (adj[r.id] = adj[r.id] || { f: 1, over: {} });
  const hasAdj = (r) => !!adj[r.id] && (Math.abs(adj[r.id].f - 1) > 0.001 || Object.keys(adj[r.id].over).length > 0);
  const servWord = (n) => `${U.fmtNum(n)} ${Number.isInteger(n) ? U.plural(n, 'порция', 'порции', 'порций') : 'порции'}`;
  // как называть продукт в строке: «200 г муки» → «мука» (из справочника), иначе как написано
  const nameOf = (i) => (i.raw && /^\s*\d/.test(i.raw) && i.key ? i.key : i.name || i.raw || '');
  // количество с учётом пересчёта и правок
  function effIng(r, i, n) {
    const a = adj[r.id];
    if (a && a.over[n]) return { ...i, qty: a.over[n].qty, unit: a.over[n].unit, changed: true, was: Measures.scaleQty(i.qty, a.f, i.unit, ingLabel(i)) };
    const f = scaleOf(r);
    return f === 1 || !i.qty ? i : { ...i, qty: Measures.scaleQty(i.qty, f, i.unit, ingLabel(i)), scaled: true };
  }
  const gram = (i, qty, unit) => { const h = Measures.gramHint(ingLabel(i), qty, unit); return h ? ` <small class="gram">(${esc(h)})</small>` : ''; };
  // строка ингредиента: название — количество (кнопка «изменить») (≈ граммы)
  function ingLineHTML(r, i, n, clickable = true) {
    const e = effIng(r, i, n);
    if (!e.qty) return esc(i.raw || [i.name, i.unit].filter(Boolean).join(' — '));
    const amount = Measures.fmt(e.qty, e.unit);
    const was = e.changed ? `<s class="was">${esc(Measures.fmt(e.was, i.unit))}</s> ` : '';
    const amt = clickable
      ? `<button class="amt ${e.changed ? 'changed' : e.scaled ? 'scaled' : ''}" data-act="ing-amt" data-id="${esc(r.id)}" data-i="${n}" title="Сколько у вас? Нажмите, чтобы изменить">${esc(amount)}</button>`
      : `<b class="amt-t">${esc(amount)}</b>`;
    return `${esc(nameOf(i))} — ${was}${amt}${gram(i, e.qty, e.unit)}`;
  }
  // текст строки для печати и списков: «мука — 4 ст. л. (≈100 г)»
  function ingPlain(r, i, n) {
    const e = effIng(r, i, n);
    if (!e.qty) return i.raw || i.name;
    const h = Measures.gramHint(ingLabel(i), e.qty, e.unit);
    return `${nameOf(i)} — ${Measures.fmt(e.qty, e.unit)}${h ? ` (${h})` : ''}`;
  }
  const ingText = (i, f = 1) => (f !== 1 && i.qty ? [nameOf(i), Measures.fmt(Measures.scaleQty(i.qty, f, i.unit, ingLabel(i)), i.unit)].join(' — ') : i.raw || [i.name, Measures.fmt(i.qty, i.unit)].filter(Boolean).join(' — '));
  function servingsStepper(r) {
    const b = baseServings(r), f = scaleOf(r);
    const reset = hasAdj(r) ? `<button class="linklike small" data-act="adj-reset" data-id="${esc(r.id)}">вернуть как в рецепте</button>` : '';
    if (!b) return f !== 1 || reset ? `<div class="serv-row"><span class="badge">×${U.roundNice(f)}</span> ${reset}</div>` : '';
    const cur = Math.round(b * f * 2) / 2;
    return `<div class="serv-row"><div class="serv" role="group" aria-label="Порции">
      <button class="icon-btn" data-act="serv" data-id="${esc(r.id)}" data-d="-1" ${cur <= 1 ? 'disabled' : ''} aria-label="Меньше порций">${icon('minus')}</button>
      <span>${servWord(cur)}</span>
      <button class="icon-btn" data-act="serv" data-id="${esc(r.id)}" data-d="1" aria-label="Больше порций">${icon('plus')}</button></div> ${reset}</div>`;
  }
  // продукт, которого дома меньше всего относительно рецепта (если из-за него рецепт целиком не получится)
  function limiting(r) {
    let best = null;
    (r.ingredients || []).forEach((i, n) => {
      if (!i.qty || i.unit === 'по вкусу' || U.isStaple(ingLabel(i))) return;
      const p = pantry().find((x) => U.sameIng(x.name, ingLabel(i)) || U.sameIng(x.name, i.name));
      if (!p || !p.qty) return;
      const ratio = Measures.ratioHaveNeed(ingLabel(i), p.qty, p.unit, i.qty, i.unit);
      if (ratio && ratio > 0 && (!best || ratio < best.ratio)) best = { i, n, p, ratio };
    });
    return best && best.ratio < scaleOf(r) - 0.01 ? best : null;
  }
  function limitHTML(r) {
    const l = limiting(r);
    if (!l) return '';
    const b = baseServings(r);
    const enough = b ? `хватит примерно на ${servWord(Math.max(0.5, Math.floor(b * l.ratio * 2) / 2))}` : `хватит на ${Math.round(l.ratio * 100)}% рецепта`;
    return `<div class="limit">${icon('alert')}<span><b>${esc(l.p.name)}</b>: дома ${esc(Measures.fmt(l.p.qty, l.p.unit))}, а нужно ${esc(Measures.fmt(effIng(r, l.i, l.n).qty, l.i.unit))}${gram(l.i, effIng(r, l.i, l.n).qty, l.i.unit)} — ${enough}.</span>
      <button class="btn small" data-act="adj-limit" data-id="${esc(r.id)}" data-f="${l.ratio}">Пересчитать под ${esc(Measures.fmt(l.p.qty, l.p.unit))}</button></div>`;
  }
  // шаги с пересчитанными граммовками (если включено)
  const stepHTML = (r, t) => (ui.scaleSteps === false ? esc(t) : Measures.scaleStepHTML(t, scaleOf(r), esc));
  const scaleStepsToggle = (r) => (scaleOf(r) !== 1 && /\d\s*(г|кг|мл|л|ст\.|ч\.|стакан)/i.test(r.steps || '')
    ? `<label class="check small"><input type="checkbox" data-act="toggle-scale-steps" ${ui.scaleSteps === false ? '' : 'checked'}> Пересчитывать граммовки и в тексте шагов</label>` : '');
  const qtyNum = (s) => String(s || '').trim().replace(/\s+/g, '').replace(',', '.');
  function adjSummary(r) {
    const a = adj[r.id], b = baseServings(r), parts = [];
    if (Math.abs(a.f - 1) > 0.001) parts.push(b ? servWord(Math.round(b * a.f * 2) / 2) : `×${U.roundNice(a.f)}`);
    const k = Object.keys(a.over).length;
    if (k) parts.push(`изменено ${k} ${U.plural(k, 'продукт', 'продукта', 'продуктов')}`);
    return parts.join(', ');
  }
  // рецепт с моими количествами (для «Сохранить в рецепт»)
  function adjustedRecipe(r) {
    const a = adj[r.id], b = baseServings(r), old = [];
    const ingredients = (r.ingredients || []).map((i, n) => {
      const e = effIng(r, i, n);
      if (!i.qty || e.qty === i.qty && e.unit === i.unit) return i;
      old.push(i.raw || [i.name, Measures.fmt(i.qty, i.unit)].join(' — '));
      return { ...i, qty: e.qty, unit: e.unit, raw: `${nameOf(i)} — ${Measures.fmt(e.qty, e.unit)}` };
    });
    const out = { ingredients };
    if (b && Math.abs(a.f - 1) > 0.001) out.servings = servWord(Math.round(b * a.f * 2) / 2);
    if (Math.abs(a.f - 1) > 0.001 && ui.scaleSteps !== false && r.steps) {
      out.steps = Measures.scaleStepHTML(r.steps, a.f, (x) => x).replace(/<mark[^>]*>|<\/mark>/g, '');
    }
    if (old.length) out.notes = [r.notes, `Было в рецепте до правки (${U.fmtDate ? U.fmtDate(U.today()) : U.today()}${r.servings ? `, ${r.servings}` : ''}):\n` + old.map((x) => '• ' + x).join('\n')].filter(Boolean).join('\n\n');
    return out;
  }
  // окно «сколько у вас?» по одному ингредиенту
  function adjForm(r, n) {
    const i = r.ingredients[n], e = effIng(r, i, n), name = ingLabel(i);
    const units = [i.unit];
    if (Measures.gramsPerUnit(name, i.unit)) units.push('г', 'кг');
    if (i.unit === 'мл' || i.unit === 'л') units.push('мл', 'л');
    const opts = [...new Set(units)].map((u) => `<option value="${esc(u)}" ${u === e.unit ? 'selected' : ''}>${esc(u || 'шт')}</option>`).join('');
    const h = Measures.gramHint(name, i.qty, i.unit);
    const p = pantry().find((x) => U.sameIng(x.name, name) || U.sameIng(x.name, i.name));
    return `<form class="form" data-form="adj">
      <div class="form-head"><h2>${esc(nameOf(i))}: сколько у вас?</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="id" value="${esc(r.id)}"><input type="hidden" name="i" value="${n}">
      <p class="muted small">По рецепту: <b>${esc(Measures.fmt(i.qty, i.unit))}</b>${h ? ` (${esc(h)})` : ''}${r.servings ? ` на ${esc(r.servings)}` : ''}.${p && p.qty ? ` Дома записано: ${esc(Measures.fmt(p.qty, p.unit))}.` : ''}</p>
      <div class="grid2"><label>Количество<input name="qty" inputmode="decimal" autocomplete="off" value="${esc(String(e.qty).replace('.', ','))}" required></label>
        <label>Единица<select name="unit">${opts}</select></label></div>
      <div class="adj-btns">
        <button class="btn primary block" data-adj="scale">${icon('repeat')}<span>Пересчитать весь рецепт под это количество</span></button>
        <button type="button" class="btn block" data-act="adj-one">Изменить только этот продукт</button>
        ${adj[r.id] && adj[r.id].over[n] ? `<button type="button" class="btn block danger-ghost" data-act="adj-one-reset">Вернуть как в рецепте</button>` : ''}
      </div>
    </form>`;
  }
  const adjRead = (f) => { const fd = new FormData(f); return { r: Store.get('recipes', fd.get('id')), n: +fd.get('i'), qty: qtyNum(fd.get('qty')), unit: fd.get('unit') || '' }; };
  function adjScale(f) {
    const { r, n, qty, unit } = adjRead(f);
    const i = r.ingredients[n];
    const ratio = Measures.ratioHaveNeed(ingLabel(i), qty, unit, i.qty, i.unit);
    if (!ratio || !isFinite(ratio) || ratio <= 0) { toast('Не получилось сравнить с рецептом — проверьте число'); return; }
    const k = Math.min(20, Math.max(0.05, Math.round(ratio * 100) / 100));
    adj[r.id] = { f: k, over: unit !== i.unit ? { [n]: { qty, unit } } : {} };
    closeModal(); refresh();
    const b = baseServings(r);
    toast(b ? `Пересчитали: получится ${servWord(Math.round(b * k * 2) / 2)}` : `Пересчитали: ×${U.roundNice(k)}`);
  }

  const lastCooked = (r) => (r.cooked && r.cooked.length ? r.cooked.reduce((m, d) => (d > m ? d : m)) : '');
  function cookedText(r) {
    const n = (r.cooked || []).length;
    return n ? `готовили ${n} ${U.plural(n, 'раз', 'раза', 'раз')}, последний раз ${U.ago(lastCooked(r))}` : 'ещё не готовили';
  }

  function viewRecipe(id) {
    const r = Store.get('recipes', id);
    if (!r) return `<a class="back" href="#/recipes">${icon('back')}Рецепты</a><div class="empty">Рецепт не найден (возможно, его удалили)</div>`;
    const names = pantry().map((p) => p.name);
    const a = analyze(r, names);
    const missingSet = new Set(a.missing);
    const steps = String(r.steps || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const s = r.status || 'new';
    return `
      <a class="back" href="#/recipes">${icon('back')}Рецепты</a>
      <article class="recipe">
        ${r.image ? `<div class="hero"><img src="${esc(Store.mediaUrl(r.image))}" alt="" referrerpolicy="no-referrer">
          <label class="hero-btn" title="Заменить фото">${icon('camera')}<input type="file" accept="image/*" data-act-change="photo-recipe" data-id="${esc(r.id)}" hidden></label></div>` : ''}
        <h1>${esc(r.title)}</h1>
        ${r.image ? '' : `<label class="btn small add-photo">${icon('camera')}<span>Добавить фото блюда</span><input type="file" accept="image/*" data-act-change="photo-recipe" data-id="${esc(r.id)}" hidden></label>`}
        <div class="meta">
          ${r.category ? `<span>${esc(r.category)}</span>` : ''}
          ${r.servings ? `<span>${icon('users')}${esc(r.servings)}</span>` : ''}
          ${r.time ? `<span>${icon('clock')}${esc(r.time)}</span>` : ''}
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${icon('ext')}${esc(safeHost(r.url) || 'источник')}</a>` : ''}
        </div>
        <div class="status-row" role="group" aria-label="Статус">
          <button class="btn ${s === 'liked' ? 'liked' : ''}" data-act="recipe-status" data-id="${esc(r.id)}" data-v="${s === 'liked' ? 'new' : 'liked'}">${icon('heart', s === 'liked' ? 'fill' : '')}<span>${s === 'liked' ? 'Понравилось' : 'Понравилось?'}</span></button>
          <button class="btn ${s === 'meh' ? 'meh' : ''}" data-act="recipe-status" data-id="${esc(r.id)}" data-v="${s === 'meh' ? 'new' : 'meh'}"><span>Не зашло</span></button>
          <span class="muted small">${s === 'new' ? 'ещё не пробовали' : ''}</span>
        </div>
        <div class="cook-row">
          <a class="btn primary" href="#/cook/${encodeURIComponent(r.id)}">${icon('flame')}<span>Готовлю</span></a>
          <button class="btn" data-act="cooked-open" data-id="${esc(r.id)}">${icon('check')}<span>Приготовили</span></button>
          <span class="muted small">${esc(cookedText(r))}${(r.cooked || []).length ? ` · <button class="linklike" data-act="cooked-undo" data-id="${esc(r.id)}">отменить последнее</button>` : ''}</span>
        </div>

        <section class="card ings-card">
          <div class="card-head"><h2>Ингредиенты</h2>
            ${a.total ? `<span class="muted small">дома есть ${a.have} из ${a.total}</span>` : ''}</div>
          ${servingsStepper(r)}
          ${limitHTML(r)}
          <p class="muted small hint-amt">Нажмите на количество, если у вас продукта больше или меньше.</p>
          <ul class="ings">
            ${(r.ingredients || []).map((i, n) => {
              const ignored = ui.ignoreStaples && (U.isStaple(ingLabel(i)) || i.unit === 'по вкусу');
              const miss = missingSet.has(i);
              const listed = miss && inShoppingList(ingLabel(i));
              return `<li class="${ignored ? 'staple' : miss ? 'miss' : 'have'}">
                <span class="dot">${ignored ? '' : miss ? icon('x') : icon('check')}</span>
                <span class="ing-t">${ingLineHTML(r, i, n)}</span>
                ${miss ? `<span class="ing-acts">
                  <button class="mini" data-act="ing-home" data-id="${esc(r.id)}" data-i="${n}" title="Это есть дома">дома</button>
                  ${listed ? '<em class="tag">в списке</em>' : `<button class="mini" data-act="ing-shop" data-id="${esc(r.id)}" data-i="${n}" title="Добавить в покупки">${icon('cart')}</button>`}
                </span>` : ''}</li>`;
            }).join('') || '<li class="muted">Ингредиенты не указаны</li>'}
          </ul>
          ${a.missing.length ? `<button class="btn primary block" data-act="recipe-to-shop" data-id="${esc(r.id)}">${icon('cart')}<span>Не хватает ${a.missing.length}: выбрать, что купить</span></button>` : a.total ? `<p class="ok-line">${icon('check')} Всё есть дома, можно готовить</p>` : ''}
        </section>

        ${steps.length ? `<section class="card steps-card"><h2>Приготовление</h2>
          ${scaleStepsToggle(r)}
          ${steps.length > 1 ? `<ol class="steps">${steps.map((t) => `<li>${stepHTML(r, t)}</li>`).join('')}</ol>` : `<p class="pre">${stepHTML(r, steps[0])}</p>`}</section>` : ''}
        ${r.notes ? `<section class="card notes-card"><h2>Заметки</h2><p class="pre">${esc(r.notes)}</p></section>` : ''}

        <div class="actions-row">
          <button class="btn" data-act="recipe-edit" data-id="${esc(r.id)}">${icon('edit')}<span>Изменить</span></button>
          <button class="btn" data-act="recipe-to-menu" data-id="${esc(r.id)}">${icon('cal')}<span>В меню</span></button>
          <button class="btn" data-act="preserve-from-recipe" data-id="${esc(r.id)}">${icon('snow')}<span>Сделали заготовку</span></button>
          ${hook('recipeActions', r)}
          <button class="btn danger-ghost" data-act="recipe-delete" data-id="${esc(r.id)}">${icon('trash')}<span>Удалить</span></button>
        </div>
      </article>`;
  }

  function recipeForm(r) {
    r = r || { status: 'new' };
    const lines = (r.ingredients || []).map((i) => i.raw || [U.fmtQty(i.qty, i.unit), i.name].filter(Boolean).join(' ')).join('\n');
    const importHint = Store.canImport()
      ? 'Вставьте ссылку и нажмите «Загрузить»: название, ингредиенты и шаги заполнятся сами.'
      : 'Автозагрузка по ссылке заработает после подключения Supabase (см. инструкцию). Пока ссылку можно сохранить, а ингредиенты вставить вручную.';
    return `
      <form data-form="recipe" class="form">
        <div class="form-head"><h2>${r.id ? 'Изменить рецепт' : 'Новый рецепт'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
        <input type="hidden" name="id" value="${esc(r.id || '')}">
        <label>Ссылка на рецепт
          <div class="row"><input name="url" id="f-url" type="url" inputmode="url" placeholder="https://…" value="${esc(r.url || '')}">
          <button type="button" class="btn" data-act="recipe-import">${icon('download')}<span>Загрузить</span></button></div>
          <small class="muted">${importHint}</small>
        </label>
        <div id="rf-pick"></div>
        <div class="file-import">
          <label class="btn">${icon('upload')}<span>Из файла</span><input type="file" accept="${RECIPE_FILE_TYPES}" data-act-change="recipe-file" hidden></label>
          <small class="muted" id="rf-status">txt, pdf, Word (docx) или фото страницы из книги: текст разберётся сам</small>
        </div>
        <input type="hidden" name="link_menu" value="${esc(r.linkMenu || '')}">
        <label>Название*<input name="title" required value="${esc(r.title || '')}" ${r.id ? '' : 'autofocus'}></label>
        <div class="grid2">
          <label>Категория<select name="category"><option value=""></option>${RECIPE_CATS.map((c) => `<option ${r.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label>Статус<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(r.status || 'new') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>Порций<input name="servings" value="${esc(r.servings || '')}"></label>
          <label>Время<input name="time" placeholder="например, 40 мин" value="${esc(r.time || '')}"></label>
        </div>
        <label>Ингредиенты <small class="muted">(по одному в строке, например «200 г муки» или «Яйца — 2 шт»)</small>
          <textarea name="ingredients" rows="8">${esc(lines)}</textarea></label>
        <label>Приготовление <small class="muted">(каждый шаг с новой строки)</small><textarea name="steps" rows="6">${esc(r.steps || '')}</textarea></label>
        <label>Заметки<textarea name="notes" rows="2" placeholder="что поменяли, кому понравилось…">${esc(r.notes || '')}</textarea></label>
        <div class="photo-field">
          <input type="hidden" name="image" value="${esc(r.image || '')}">
          <div class="photo-prev">${r.image ? `<img src="${esc(Store.mediaUrl(r.image))}" alt="" referrerpolicy="no-referrer">` : icon('camera')}</div>
          <div class="row wrap">
            <label class="btn">${icon('camera')}<span>${r.image ? 'Заменить фото' : 'Добавить фото'}</span><input type="file" accept="image/*" data-act-change="photo-form" hidden></label>
            <button type="button" class="btn danger-ghost" data-act="photo-clear" ${r.image ? '' : 'hidden'}>Убрать</button>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" data-act="close">Отмена</button>
          <button class="btn primary" type="submit">Сохранить</button>
        </div>
      </form>`;
  }

  // ---------- Рецепты из файлов ----------
  const RECIPE_FILE_TYPES = '.txt,.md,.pdf,.docx,.doc,.rtf,.html,.htm,text/plain,application/pdf,image/*';
  // заполнить открытую форму рецепта разобранным файлом
  function fillRecipeForm(f, d) {
    if (!f.title.value.trim() || f.title.value === d.fallback) f.title.value = d.title;
    if (d.servings && !f.servings.value) f.servings.value = d.servings;
    if (d.time && !f.time.value) f.time.value = d.time;
    if (d.ingredients.length) f.ingredients.value = d.ingredients.join('\n');
    if (d.steps.length) f.steps.value = d.steps.join('\n');
    const cat = guessCategory(d.title);
    if (cat && !f.category.value) f.category.value = cat;
  }
  // ---------- Рецепт по ссылке: заполнить форму; страница с несколькими рецептами — список для выбора ----------
  let pickPage = null; // { source, items: [{ kind: 'recipe' | 'link', title, url?, image, ingredients?, steps? }] }
  const servText = (s) => (/^\d+$/.test(String(s || '').trim()) ? `${+s} ${U.plural(+s, 'порция', 'порции', 'порций')}` : String(s || ''));
  const catFromImport = (d) => {
    if (d.category) { const hit = RECIPE_CATS.find((c) => U.norm(d.category).includes(U.norm(c).slice(0, 5))); if (hit) return hit; }
    return guessCategory(d.title || '');
  };
  // replace — заменить всё в форме (при переключении между рецептами из списка), иначе только заполнить найденное
  function fillFromImport(form, d, replace) {
    const ing = d.ingredients || [], st = d.steps || [];
    if (d.title || replace) form.title.value = d.title || '';
    if (d.image) setFormPhoto(form, d.image); else if (replace) setFormPhoto(form, '');
    if (d.servings || replace) form.servings.value = servText(d.servings);
    if (d.time || replace) form.time.value = d.time || '';
    if (ing.length || replace) form.ingredients.value = ing.join('\n');
    if (st.length || replace) form.steps.value = st.join('\n');
    const cat = catFromImport(d);
    if (cat && (replace || !form.category.value)) form.category.value = cat;
  }
  function recipeFromImport(d, url, host) {
    return { title: d.title || 'Рецепт', url: url || '', image: d.image || '', status: 'new', category: catFromImport(d),
      servings: servText(d.servings), time: d.time || '', ingredients: parseIngredients((d.ingredients || []).join('\n')),
      steps: (d.steps || []).join('\n'), notes: host ? `Со страницы ${host}` : '' };
  }
  function updatePickCount(box) {
    const n = box.querySelectorAll('input[data-pi]:checked').length, b = box.querySelector('[data-act="pick-save"]');
    if (b) { b.disabled = !n; b.textContent = n ? `Добавить отмеченные (${n})` : 'Отметьте рецепты'; }
  }
  function renderPickPage(form, open) {
    const box = form.querySelector('#rf-pick');
    if (!box || !pickPage) return;
    const items = pickPage.items, recipes = items[0] && items[0].kind === 'recipe';
    if (!open) {
      box.innerHTML = `<p class="small muted">На этой странице есть ссылки ещё на ${items.length} ${U.plural(items.length, 'рецепт', 'рецепта', 'рецептов')}. <button type="button" class="linklike" data-act="pick-show">Показать список</button></p>`;
      return;
    }
    box.innerHTML = `<div class="pick-page">
      <p class="small"><b>${recipes ? `На странице ${items.length} ${U.plural(items.length, 'рецепт', 'рецепта', 'рецептов')}` : `Список рецептов: ${items.length}`}.</b>
        Отметьте нужные и добавьте их сразу, или нажмите «В форму», чтобы проверить один рецепт перед сохранением.${recipes ? '' : ' Ингредиенты и шаги подтянутся с каждой страницы.'}</p>
      <div class="pick-list">${items.map((it, i) => `<div class="pick-row">
        <input type="checkbox" data-pi="${i}" aria-label="Выбрать">
        ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="pick-noimg">${icon('book')}</span>`}
        <span class="pick-title">${esc(it.title)}<small class="muted">${it.kind === 'recipe' ? `${it.ingredients.length} ${U.plural(it.ingredients.length, 'ингредиент', 'ингредиента', 'ингредиентов')} · ${(it.steps || []).length} ${U.plural((it.steps || []).length, 'шаг', 'шага', 'шагов')}` : esc(it.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</small></span>
        <button type="button" class="btn small" data-act="pick-one" data-i="${i}">В форму</button>
      </div>`).join('')}</div>
      <div class="row wrap">
        <button type="button" class="btn small" data-act="pick-all">Отметить все / снять</button>
        <button type="button" class="btn primary small" data-act="pick-save" disabled>Отметьте рецепты</button>
      </div>
    </div>`;
  }
  function guessCategory(title) {
    const t = U.norm(title);
    const rules = [['Завтраки', /завтрак/], ['Супы', /суп|борщ|щи |солянк|бульон|уха|окрошк|рассольник/], ['Салаты', /салат|винегрет|оливье|цезарь|шуба|мимоза|нисуаз|греческий/], ['Десерты', /торт|пирожн|десерт|мусс|печенье|кекс|маффин|тирамису|запеканк[аи] творож|сырник/],
      ['Выпечка', /пирог|пирожк|хлеб|булоч|пицц|блин|оладь|лепёшк|лепешк|ватруш/], ['Завтраки', /каша|омлет|яичниц|гранол|мюсли|тост/], ['Соусы', /соус|заправк|подлив/], ['Напитки', /компот|морс|смузи|коктейл|какао|лимонад/],
      ['Гарниры', /гарнир|пюре|рис отварн|гречк|булгур|кускус/]];
    const hit = rules.find(([, re]) => re.test(t + ' '));
    return hit ? hit[0] : '';
  }
  async function importRecipeFiles(files) {
    if (files.length === 1) {
      toast('Читаю файл…');
      const d = await RecipeImport.fromFile(files[0], (p) => toast(`Распознаю текст… ${Math.round(p * 100)}%`));
      openModal(recipeForm({
        title: d.title, servings: d.servings, time: d.time, status: 'new', category: guessCategory(d.title),
        ingredients: parseIngredients(d.ingredients.join('\n')), steps: d.steps.join('\n'), notes: `Из файла «${d.source}»`,
      }));
      toast(d.ingredients.length ? 'Проверьте рецепт и сохраните' : 'Ингредиенты не нашлись, допишите их вручную');
      return;
    }
    // несколько файлов — сразу в «Не пробовали»
    const done = [], failed = [];
    for (let i = 0; i < files.length; i++) {
      toast(`Читаю файлы: ${i + 1} из ${files.length}…`);
      try {
        const d = await RecipeImport.fromFile(files[i]);
        done.push({ title: d.title, servings: d.servings, time: d.time, status: 'new', category: guessCategory(d.title), url: '', image: '',
          ingredients: parseIngredients(d.ingredients.join('\n')), steps: d.steps.join('\n'), notes: `Из файла «${d.source}»` });
      } catch (e) { failed.push(files[i].name); }
    }
    if (done.length) await Store.saveMany('recipes', done);
    toast(`Добавлено рецептов: ${done.length}${failed.length ? `. Не прочитались: ${failed.join(', ')}` : ''}`, failed.length ? 'err' : '');
    if (done.length) { ui.rStatus = 'new'; saveUI(); location.hash = '#/recipes'; refresh(); }
  }

  // ---------- Фото: сжатие перед загрузкой ----------
  async function compressImage(file) {
    const local = Store.mode === 'local';
    const max = local ? 720 : 1280, quality = local ? 0.7 : 0.82;
    let src;
    try { src = await createImageBitmap(file); } catch (e) {
      src = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Не получилось открыть картинку'));
        img.src = URL.createObjectURL(file);
      });
    }
    const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Не получилось сжать фото'))), 'image/jpeg', quality));
  }
  function setFormPhoto(form, url) {
    form.image.value = url || '';
    const prev = form.querySelector('.photo-prev');
    if (prev) prev.innerHTML = url ? `<img src="${esc(Store.mediaUrl(url))}" alt="" referrerpolicy="no-referrer">` : icon('camera');
    const clear = form.querySelector('[data-act="photo-clear"]');
    if (clear) clear.hidden = !url;
  }

  function parseIngredients(text) {
    const cat = catalog();
    return String(text || '').split(/\n+/).map(U.parseIngredientLine).filter(Boolean)
      .map((i) => ({ ...i, key: U.ingKey(i.name, cat) }));
  }

  // =====================================================================
  // ПОДБОР (п.5)
  // =====================================================================
  function viewMatch() {
    const home = pantry();
    const extra = ui.matchExtra || [];
    const modeHome = ui.matchMode === 'home';
    return `
      <div class="page-head"><h1>Что приготовить</h1></div>
      <div class="seg" role="tablist">
        <button class="${modeHome ? 'on' : ''}" data-act="set" data-k="matchMode" data-v="home">Из того, что есть</button>
        <button class="${!modeHome ? 'on' : ''}" data-act="set" data-k="matchMode" data-v="with">С выбранными продуктами</button>
      </div>
      <p class="muted small">${modeHome
        ? `Учитываем продукты из раздела <a href="#/products">«Дома»</a> (${home.length}) и добавленные ниже. Сверху рецепты, для которых меньше всего нужно докупить.`
        : 'Выберите продукты, которые хотите использовать (например, кабачок, который скоро испортится), и увидите рецепты, где они есть.'}</p>
      <form class="row add-row" data-form="match-add">
        <input id="m-add" name="name" data-suggest placeholder="${modeHome ? 'Добавить продукт к имеющимся' : 'Выберите продукт'}" autocomplete="off">
        <button class="btn" type="submit">${icon('plus')}<span>Добавить</span></button>
      </form>
      <div class="chips">
        ${extra.map((n, idx) => `<span class="chip on">${esc(n)}<button data-act="match-del" data-i="${idx}" aria-label="Убрать">${icon('x')}</button></span>`).join('')}
        ${extra.length ? `<button class="chip ghost" data-act="match-clear">Очистить</button>` : ''}
      </div>
      <label class="check"><input type="checkbox" data-act="toggle-staples" ${ui.ignoreStaples ? 'checked' : ''}> Не учитывать соль, сахар, воду, перец, растительное масло и «по вкусу»</label>
      <div id="list">${matchList()}</div>`;
  }

  function matchList() {
    const recipes = Store.all('recipes').filter((r) => r.status !== 'meh');
    if (!recipes.length) return `<div class="empty small">Сначала добавьте рецепты</div>`;
    const extra = ui.matchExtra || [];
    let rows;
    if (ui.matchMode === 'home') {
      const names = [...pantry().map((p) => p.name), ...extra];
      if (!names.length) return `<div class="empty small">Отметьте, что есть дома, в разделе <a href="#/products">«Продукты»</a> или добавьте продукты выше</div>`;
      rows = recipes.map((r) => ({ r, a: analyze(r, names) })).filter((x) => x.a.total && x.a.have > 0)
        .sort((x, y) => x.a.missing.length - y.a.missing.length || y.a.have / y.a.total - x.a.have / x.a.total);
    } else {
      if (!extra.length) return `<div class="empty small">Добавьте хотя бы один продукт</div>`;
      const names = [...pantry().map((p) => p.name), ...extra];
      rows = recipes.filter((r) => extra.every((n) => (r.ingredients || []).some((i) => U.sameIng(n, ingLabel(i)) || U.sameIng(n, i.name))))
        .map((r) => ({ r, a: analyze(r, names) }))
        .sort((x, y) => x.a.missing.length - y.a.missing.length);
    }
    if (!rows.length) return `<div class="empty small">Подходящих рецептов не нашлось</div>`;
    return `<div class="mlist">${rows.map(({ r, a }) => {
      const pct = a.total ? Math.round((a.have / a.total) * 100) : 100;
      return `<div class="mrow">
        <a href="#/recipe/${encodeURIComponent(r.id)}" class="mmain">
          <b>${esc(r.title)}</b> ${r.status === 'liked' ? icon('heart', 'fill tiny') : ''}
          <span class="meter wide"><i style="width:${pct}%"></i></span>
          <small>${a.missing.length ? `не хватает: ${esc(a.missing.map(ingLabel).join(', '))}` : 'всё есть'}</small>
        </a>
        ${a.missing.length ? `<button class="icon-btn" title="Недостающее в покупки" aria-label="Недостающее в покупки" data-act="recipe-to-shop" data-id="${esc(r.id)}">${icon('cart')}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  // =====================================================================
  // ПРОДУКТЫ: дома + справочник (п.4)
  // =====================================================================
  function viewProducts() {
    const home = pantry();
    return `
      <div class="page-head"><h1>Продукты</h1></div>
      <div class="seg">
        <button class="${ui.prodTab === 'home' ? 'on' : ''}" data-act="set" data-k="prodTab" data-v="home">Есть дома · ${home.length}</button>
        <button class="${ui.prodTab === 'catalog' ? 'on' : ''}" data-act="set" data-k="prodTab" data-v="catalog">Справочник · ${catalog().length}</button>
      </div>
      ${ui.prodTab === 'home' ? `
        <form class="add-row qty-row" data-form="pantry-add">
          <input id="p-name" name="name" data-suggest placeholder="Что есть дома" required autocomplete="off">
          <input name="qty" placeholder="Кол-во" inputmode="decimal">
          ${unitSelect()}
          <button class="btn primary" type="submit" aria-label="Добавить">${icon('plus')}</button>
        </form>` : `
        <label class="search">${icon('search')}<input id="prodq" type="search" placeholder="Найти в справочнике" value="${esc(ui.prodQ)}" data-input="prodQ"></label>`}
      <div id="list">${ui.prodTab === 'home' ? pantryList() : catalogList()}</div>`;
  }

  // ---------- Стрелочки «больше / меньше» у количества (Есть дома, Купить) ----------
  // шаг зависит от единицы и от того, сколько уже есть: 1 кг → 1,5 кг, 0,3 кг → 0,4 кг, 200 г → 250 г
  const qNum = (q) => { const v = parseFloat(String(q || '').replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
  function qtyStep(v, unit) {
    const u = U.norm(unit || '');
    if (u === 'кг' || u === 'л') return v < 1 ? (u === 'л' ? 0.25 : 0.1) : 0.5;
    if (u === 'г' || u === 'мл') return v < 100 ? 10 : v < 500 ? 50 : 100;
    if (/стакан/.test(u)) return 0.5;
    return 1; // штуки, пачки, банки…
  }
  function stepQty(q, unit, dir) {
    const v = qNum(q);
    if (!v) return dir > 0 ? (/^(г|мл)$/.test(U.norm(unit || '')) ? 100 : /^(кг|л)$/.test(U.norm(unit || '')) ? 0.5 : 2) : 0;
    const s = qtyStep(dir > 0 ? v : v - 1e-9, unit);
    // ½ кочана → 1 → 2: дробное количество штук сначала доводим до целого
    const n = dir > 0 ? Math.floor(v / s + 1e-9) * s + s : Math.ceil(v / s - 1e-9) * s - s;
    return Math.max(0, Math.round(n * 1000) / 1000);
  }
  const qtyStepper = (kind, it) => `<span class="qstep">
      <button type="button" data-act="qty-step" data-kind="${kind}" data-id="${esc(it.id)}" data-d="1" aria-label="Больше" title="Больше">${icon('up')}</button>
      <button type="button" data-act="qty-step" data-kind="${kind}" data-id="${esc(it.id)}" data-d="-1" aria-label="Меньше" title="Меньше">${icon('down')}</button></span>`;

  function pantryList() {
    const home = pantry();
    if (!home.length) return `<div class="empty">${icon('fridge', 'big')}<h3>Пока пусто</h3><p>Добавьте продукты, которые есть дома (выше или из справочника), и в «Подборе» появятся рецепты из них. Купленное из списка покупок попадает сюда само.</p></div>`;
    const groups = {};
    home.forEach((p) => { const c = catOf(p.name); (groups[c] = groups[c] || []).push(p); });
    return Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ru')).map((c) => `
      <h3 class="group">${esc(c)}</h3>
      <ul class="plist">${groups[c].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((p) => `
        <li>
          <button class="pname" data-act="pantry-edit" data-id="${esc(p.id)}"><b>${esc(p.name)}</b>${p.qty || p.unit ? `<small>${esc(U.fmtQty(p.qty, p.unit))}</small>` : ''}</button>
          ${qtyStepper('pantry', p)}
          <button class="icon-btn" title="Закончилось: в покупки" aria-label="Закончилось, добавить в покупки" data-act="pantry-out" data-id="${esc(p.id)}">${icon('cart')}</button>
          <button class="icon-btn" title="Убрать" aria-label="Убрать" data-act="pantry-del" data-id="${esc(p.id)}">${icon('trash')}</button>
        </li>`).join('')}</ul>`).join('');
  }

  function catalogList() {
    const q = U.norm(ui.prodQ);
    const home = pantry().map((p) => U.norm(p.name));
    const todo = Store.all('shopping').filter((s) => s.status !== 'bought').map((s) => U.norm(s.name));
    const cats = {};
    catalog().forEach((c) => { if (!q || U.norm(c.name).includes(q)) (cats[c.cat] = cats[c.cat] || []).push(c); });
    const keys = Object.keys(cats);
    const addCustom = `
      <form class="card add-custom" data-form="custom-add">
        <b>Добавить свой ингредиент</b>
        <div class="row wrap"><input name="name" required placeholder="Название" value="${esc(ui.prodQ && !keys.length ? ui.prodQ : '')}">
        <select name="cat">${[...window.INGREDIENT_CATEGORIES, 'Другое'].map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <button class="btn primary" type="submit">${icon('plus')}<span>В справочник</span></button></div>
      </form>`;
    if (!keys.length) return `<div class="empty small">В справочнике нет «${esc(ui.prodQ)}»</div>${addCustom}`;
    return keys.map((c) => `
      <details class="cat" ${q ? 'open' : ''}>
        <summary>${esc(c)} <small>${cats[c].length}</small></summary>
        <ul class="clist">${cats[c].map((it) => {
          const n = U.norm(it.name), atHome = home.includes(n), inShop = todo.includes(n);
          return `<li><span>${esc(it.name)}${atHome ? ' <em class="tag ok">дома</em>' : ''}${inShop ? ' <em class="tag">купить</em>' : ''}</span>
            <span class="btns">
              ${atHome ? '' : `<button class="mini" data-act="cat-home" data-n="${esc(it.name)}">+ дома</button>`}
              ${inShop ? '' : `<button class="mini" data-act="cat-shop" data-n="${esc(it.name)}">+ купить</button>`}
              ${it.custom ? `<button class="mini danger-ghost" data-act="custom-del" data-id="${esc(it.id)}" aria-label="Удалить из справочника">${icon('trash')}</button>` : ''}
            </span></li>`;
        }).join('')}</ul>
      </details>`).join('') + addCustom;
  }

  const inShoppingList = (name) => Store.all('shopping').some((s) => s.status !== 'bought' && (U.norm(s.name) === U.norm(name) || U.sameIng(s.name, name)));

  // Выбор по пунктам: для каждой строки «купить» / «есть дома» / «пропустить», с количеством.
  // items: [{ name, qty, unit, note, src }]
  let pickItemsData = [];
  function openPickItems(title, items) {
    pickItemsData = items;
    openModal(`<form class="form pick-items" data-form="pick-items">
      <div class="form-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <div class="row wrap"><small class="muted grow">Для каждой строки выберите, что сделать.</small>
        <button type="button" class="mini" data-act="pi-all" data-v="buy">всё купить</button>
        <button type="button" class="mini" data-act="pi-all" data-v="home">всё есть</button></div>
      <div class="pi-rows">${items.map((it, i) => {
        const listed = inShoppingList(it.name);
        const def = listed ? 'skip' : 'buy';
        return `<div class="pi-row" data-i="${i}">
          <div class="pi-top"><b>${esc(it.name)}</b>${listed ? ' <em class="tag">уже в списке</em>' : ''}${it.note ? `<small>${esc(it.note)}</small>` : ''}</div>
          <div class="pi-ctl">
            <input name="q${i}" inputmode="decimal" value="${esc(it.qty || '')}" placeholder="кол-во" aria-label="Количество">
            ${unitSelect(it.unit).replace('name="unit"', `name="u${i}"`)}
            <div class="seg3" role="radiogroup" aria-label="Что сделать">
              ${[['buy', 'Купить'], ['home', 'Есть'], ['skip', '—']].map(([v, l]) => `<label><input type="radio" name="a${i}" value="${v}" ${v === def ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div>
          </div></div>`;
      }).join('')}</div>
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Готово</button></div>
    </form>`);
  }

  // Окно «сколько?» при добавлении из справочника
  function openQtyDialog(name, target) {
    const n = U.norm(name);
    const home = pantry().find((p) => U.norm(p.name) === n);
    const inShop = Store.all('shopping').find((s) => s.status !== 'bought' && U.norm(s.name) === n);
    // единица по умолчанию — как в прошлый раз
    const last = [home, ...Store.all('shopping').filter((s) => U.norm(s.name) === n).reverse()].find((x) => x && x.unit);
    const have = target === 'home' ? home : inShop;
    openModal(`<form class="form" data-form="cat-qty">
      <div class="form-head"><h2>${target === 'home' ? 'Есть дома' : 'Купить'}: ${esc(name)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="name" value="${esc(name)}"><input type="hidden" name="target" value="${target}">
      ${have ? `<p class="muted small">${target === 'home' ? 'Уже дома' : 'Уже в списке'}${have.qty || have.unit ? ': ' + esc(U.fmtQty(have.qty, have.unit)) : ''}. Количество прибавится.</p>` : ''}
      <div class="grid2">
        <label>Количество<input name="qty" inputmode="decimal" placeholder="можно не указывать" autofocus></label>
        <label>Единица${unitSelect(last ? last.unit : '')}</label>
      </div>
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Добавить</button></div>
    </form>`);
  }

  async function addToPantry(name, qty, unit) {
    const n = U.norm(name);
    const ex = pantry().find((p) => U.norm(p.name) === n);
    if (ex) {
      const sameUnit = (ex.unit || '') === (unit || '');
      return Store.save('pantry', { ...ex, qty: sameUnit ? U.addQty(ex.qty, qty) : (qty || ex.qty), unit: sameUnit ? ex.unit : (unit || ex.unit), updated_on: U.today() });
    }
    return Store.save('pantry', { name: name.trim(), qty: qty || '', unit: unit || '', updated_on: U.today() });
  }

  // Добавить в покупки. Если продукт уже в списке — количества складываются
  // (300 г + 300 г = 600 г). src — откуда добавлено (рецепт, меню недели): повторное
  // нажатие той же кнопки не удваивает количество.
  async function addToShopping(items) {
    const todo = Store.all('shopping').filter((s) => s.status !== 'bought');
    const byName = new Map(); // norm → запись (новая или копия существующей)
    const fresh = [], changed = new Set();
    for (const it of items) {
      const n = U.norm(it.name);
      if (!n) continue;
      let t = byName.get(n);
      if (!t) {
        const ex = todo.find((x) => U.norm(x.name) === n);
        if (ex) { t = { ...ex, srcs: [...(ex.srcs || [])] }; byName.set(n, t); }
      }
      if (t) {
        if (it.src && t.srcs && t.srcs.includes(it.src)) continue;
        if (it.qty) {
          const s = t.qty ? U.sumQty([t, it]) : { qty: it.qty, unit: it.unit || '' };
          if (s.qty) { t.qty = s.qty; t.unit = s.unit; }
        }
        if (it.src) t.srcs = [...(t.srcs || []), it.src];
        if (it.note && !String(t.note || '').includes(it.note)) t.note = [t.note, it.note].filter(Boolean).join('; ');
        if (t.id) changed.add(t);
        continue;
      }
      t = { name: it.name, qty: it.qty || '', unit: it.unit || '', note: it.note || '', status: 'todo', created_on: U.today(), srcs: it.src ? [it.src] : [] };
      byName.set(n, t);
      fresh.push(t);
    }
    if (fresh.length) await Store.saveMany('shopping', fresh);
    if (changed.size) await Store.saveMany('shopping', [...changed]);
    return fresh.length + changed.size;
  }

  // =====================================================================
  // ПОКУПКИ (п.6)
  // =====================================================================
  function viewShopping() {
    const all = Store.all('shopping');
    const todo = all.filter((s) => s.status !== 'bought');
    return `
      <div class="page-head"><h1>Покупки</h1>
        <label class="btn">${icon('camera')}<span>Чек</span><input type="file" accept="image/*" multiple data-act-change="receipt" hidden></label></div>
      ${scanCrashNote ? `<div class="card warn-card"><p class="small">${esc(scanCrashNote)}</p><button type="button" class="btn small" data-act="scan-note-ok">Понятно</button></div>` : ''}
      ${rcDraftNote()}
      <div class="seg">
        <button class="${ui.shopTab === 'todo' ? 'on' : ''}" data-act="set" data-k="shopTab" data-v="todo">Купить · ${todo.length}</button>
        <button class="${ui.shopTab === 'history' ? 'on' : ''}" data-act="set" data-k="shopTab" data-v="history">История</button>
        <button class="${ui.shopTab === 'money' ? 'on' : ''}" data-act="set" data-k="shopTab" data-v="money">Расходы</button>
      </div>
      ${ui.shopTab === 'money' ? `<div id="list">${expensesView()}</div>` : ui.shopTab === 'todo' ? `
        <form class="add-row qty-row" data-form="shop-add">
          <input id="s-name" name="name" data-suggest placeholder="Что купить" required autocomplete="off">
          <input name="qty" placeholder="Кол-во" inputmode="decimal">
          ${unitSelect()}
          <button class="btn primary" type="submit" aria-label="Добавить">${icon('plus')}</button>
        </form>
        <div id="list">${shopTodo()}</div>` : `
        <label class="search">${icon('search')}<input id="shopq" type="search" placeholder="Когда покупали…" value="${esc(ui.shopQ)}" data-input="shopQ"></label>
        <div id="list">${shopHistory()}</div>`}`;
  }

  function frequent() {
    const todo = new Set(Store.all('shopping').filter((s) => s.status !== 'bought').map((s) => U.norm(s.name)));
    const freq = {};
    Store.all('shopping').filter((s) => s.status === 'bought' && !s.lump).forEach((s) => {
      const n = U.norm(s.name);
      if (!todo.has(n)) freq[n] = freq[n] || { name: s.name, unit: s.unit, qty: s.qty, c: 0 }, freq[n].c++;
    });
    return Object.values(freq).sort((a, b) => b.c - a.c).slice(0, 10);
  }

  function shopTodo() {
    const todo = Store.all('shopping').filter((s) => s.status !== 'bought')
      .sort((a, b) => catOf(a.name).localeCompare(catOf(b.name), 'ru') || a.name.localeCompare(b.name, 'ru'));
    const fr = frequent();
    const freqHtml = fr.length ? `<div class="freq"><small class="muted">Часто покупаем:</small> ${fr.map((f) =>
      `<button class="chip" data-act="shop-again" data-n="${esc(f.name)}" data-q="${esc(f.qty || '')}" data-u="${esc(f.unit || '')}">+ ${esc(f.name)}</button>`).join('')}</div>` : '';
    if (!todo.length) return `<div class="empty">${icon('cart', 'big')}<h3>Список покупок пуст</h3><p>Добавляйте продукты сверху или кнопкой «Не хватает…» в рецепте. Отмеченное купленным попадает в «Есть дома» и в историю с датой.</p></div>${freqHtml}`;
    let lastCat = '';
    return `<ul class="slist">${todo.map((s) => {
      const c = catOf(s.name);
      const head = c !== lastCat ? `<li class="group">${esc((lastCat = c))}</li>` : '';
      return `${head}<li>
        <button class="checkbox" data-act="shop-buy" data-id="${esc(s.id)}" aria-label="Купили">${icon('check')}</button>
        <button class="pname" data-act="shop-edit" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc([U.fmtQty(s.qty, s.unit), s.note].filter(Boolean).join(' · '))}</small></button>
        ${qtyStepper('shopping', s)}
        <button class="icon-btn" aria-label="Удалить" data-act="shop-del" data-id="${esc(s.id)}">${icon('trash')}</button>
      </li>`;
    }).join('')}</ul>
    <div class="row wrap shop-actions">
      <button class="btn grow" data-act="shop-share">${icon('share')}<span>Отправить список</span></button>
      <button class="btn grow" data-act="shop-buy-all">${icon('check')}<span>Купили всё (${todo.length})</span></button>
      ${hook('shoppingActions')}
    </div>
    ${freqHtml}`;
  }

  function shopHistory() {
    const q = U.norm(ui.shopQ);
    const bought = Store.all('shopping').filter((s) => s.status === 'bought' && (!q || U.norm(s.name).includes(q)))
      .sort((a, b) => String(b.bought_on).localeCompare(String(a.bought_on)) || a.name.localeCompare(b.name, 'ru'));
    if (!bought.length) return `<div class="empty small">${q ? 'Не покупали' : 'Здесь будет история: что, сколько и когда купили'}</div>`;
    const groups = {};
    bought.forEach((s) => (groups[s.bought_on] = groups[s.bought_on] || []).push(s));
    return `<p class="muted small">Впишите цену в поле «₽» справа, и покупка попадёт в «Расходы».</p>` + Object.keys(groups).map((d) => {
      const sum = groups[d].reduce((t, s) => t + priceOf(s), 0);
      return `
      <h3 class="group">${esc(U.fmtDate(d))} <small>${groups[d].length}${sum ? ' · ' + rub(sum) : ''}</small></h3>
      <ul class="slist">${groups[d].map((s) => `<li>
        <button class="pname" data-act="shop-edit" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc(U.fmtQty(s.qty, s.unit))}</small></button>
        <input class="price" id="pr-${esc(s.id)}" type="text" inputmode="decimal" placeholder="₽" value="${esc(s.price || '')}" data-price="${esc(s.id)}" aria-label="Цена, ₽">
        <button class="icon-btn" title="Купить снова" aria-label="Купить снова" data-act="shop-again" data-n="${esc(s.name)}" data-q="${esc(s.qty || '')}" data-u="${esc(s.unit || '')}">${icon('repeat')}</button>
        <button class="icon-btn" aria-label="Удалить из истории" data-act="shop-del" data-id="${esc(s.id)}">${icon('trash')}</button>
      </li>`).join('')}</ul>`;
    }).join('');
  }

  // ---------- Чеки: фото → QR + распознавание → проверка → покупки ----------
  let receiptDraft = null, receiptScanId = 0;
  // незаконченный чек переживает закрытие окна и перезапуск приложения (только на этом устройстве)
  const RC_DRAFT_KEY = 'kuhnya-receipt-draft';
  function rcKeepDraft() {
    try { if (receiptDraft) localStorage.setItem(RC_DRAFT_KEY, JSON.stringify(receiptDraft)); else localStorage.removeItem(RC_DRAFT_KEY); } catch (e) { /* память недоступна — черновик живёт до перезапуска */ }
  }
  try { const s = localStorage.getItem(RC_DRAFT_KEY); if (s) receiptDraft = JSON.parse(s); } catch (e) { receiptDraft = null; }
  // окно с чеком закрывается, а чек не сохранён — правки из формы остаются в черновике, к нему можно вернуться из «Покупок»
  function rcBeforeClose() {
    const f = $('#modal form.receipt');
    if (!f || !receiptDraft) return false;
    readReceiptForm(f); rcKeepDraft();
    return true;
  }
  function rcDraftNote() {
    const d = receiptDraft;
    if (!d || !d.items || $('#modal').open) return '';
    const on = d.items.filter((i) => i.on), sum = on.reduce((s, i) => s + num2(i.total), 0);
    const when = d.date || (d.qr && d.qr.date) || (d.stamp && d.stamp.date);
    return `<div class="card rc-draft"><div><b>Чек не сохранён</b><br><small class="muted">${when ? esc(U.fmtDate(when)) + ' · ' : ''}${on.length} поз. на ${money(sum)} ₽. Правки на месте.</small></div>
      <div class="row-actions"><button type="button" class="btn primary small" data-act="rc-resume">Вернуться к чеку</button><button type="button" class="btn small" data-act="rc-drop">Отбросить</button></div></div>`;
  }
  const num2 = (v) => { const n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

  // «ХЛЕБ БОРОДИНСКИЙ 400Г» → «хлеб бородинский»: без фасовки, процентов и сортов
  const productName = (s) => String(s || '').toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт|%)\.?(?![а-яё])/g, ' ')
    .replace(/(?:^|\s)с[0о1-3](?![а-яё])/g, ' ')
    .replace(/[^а-яёa-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // с чем сверять позиции: сумма из QR-кода, а если он не прочитался — «Итог», напечатанный на чеке
  const rcTarget = (d) => (d.qr ? d.qr.sum : d.ocrTotal || 0);
  // Память названий: как вы назвали строку чека в прошлый раз («Свинина охл лопатка н.к» → «свинина»),
  // так она и подставится в следующий. Ищем с допуском на ошибки распознавания.
  const RC_NAMES_ID = 'settings-receipt-names';
  const rcKey = (s) => U.norm(s).replace(/[^а-яa-z0-9]/g, '');
  function rcLookup(orig) {
    const k = rcKey(orig), map = (Store.get('settings', RC_NAMES_ID) || {}).map || {};
    if (k.length < 4) return null;
    if (map[k]) return map[k];
    let best = null, bd = Infinity;
    for (const key of Object.keys(map)) {
      if (Math.abs(key.length - k.length) > 4) continue;
      const d = Receipt.lev(key, k);
      if (d < bd) { bd = d; best = key; }
    }
    return best && bd <= Math.max(2, Math.round(k.length * 0.2)) ? map[best] : null;
  }
  async function rcLearn(rows) {
    const cur = Store.get('settings', RC_NAMES_ID) || { id: RC_NAMES_ID, map: {} };
    const map = { ...cur.map };
    let changed = false;
    for (const r of rows) {
      const k = rcKey(r.orig);
      if (k.length < 4 || !r.name || (map[k] && map[k].name === r.name)) continue;
      map[k] = { name: r.name };
      changed = true;
    }
    const keys = Object.keys(map);
    if (keys.length > 1500) keys.slice(0, keys.length - 1500).forEach((k) => delete map[k]);
    if (changed) await Store.save('settings', { ...cur, id: RC_NAMES_ID, map });
  }
  // Словарь «правильных» слов (справочник, покупки, запасы): по нему чинятся опечатки распознавания («нолоко» → «молоко»)
  function rcVocab() {
    const set = new Set();
    const add = (s) => (U.norm(s).match(/[а-я]{4,}/g) || []).forEach((w) => set.add(w));
    catalog().forEach((c) => add(c.name));
    Store.all('shopping').forEach((s) => add(s.name));
    Store.all('pantry').forEach((s) => add(s.name));
    Object.values((Store.get('settings', RC_NAMES_ID) || {}).map || {}).forEach((v) => add(v.name));
    ['фрукт', 'овощ', 'паста', 'спагетти', 'рожки', 'сырок', 'салфетки', 'пакет', 'напиток', 'конфеты', 'печенье', 'шоколад', 'йогурт', 'творожок', 'батон', 'охлажденная', 'пастеризованное'].forEach((w) => set.add(w));
    return { set, list: [...set] };
  }
  // Строка чека → продукт. Главное слово в чеке стоит первым («Молоко Пискар. 2.5%», «Сырок глаз. какао»),
  // поэтому продукт из справочника ищем по первым словам, а не по всей строке (иначе сырок с какао стал бы «какао»).
  const RC_GENERIC = new Set(['фрукт', 'фрукты', 'овощ', 'овощи', 'продукт', 'напиток', 'изделие', 'набор', 'бзмж', 'охл', 'охлажденная', 'охлажденный', 'охлажденное',
    'зам', 'замороженный', 'замороженная', 'свежий', 'свежая', 'свежее', 'вес', 'весовой', 'весовая', 'фас', 'фасованный', 'фасованная', 'упак', 'халяль', 'гост', 'пэт', 'пюр-пак', 'пюрпак', 'пастер', 'пастериз', 'ультрапаст']);
  // Разные написания одного и того же в чеках: «свиная», «свин.» → свинина; «цыплёнка-бройлера», «ЦБ» → курица; «томаты» → помидор
  const RC_CANON = [
    [/^(свинина|свинины|свиная|свиной|свиные|свиное|свиную|свин|свино)$/, 'свинина'],
    [/^(говядина|говядины|говяжья|говяжий|говяжьи|говяжье|говяжью|гов|говяж)$/, 'говядина'],
    [/^(курица|курицы|куриная|куриный|куриные|куриное|куриную|кур|курин|цыпленок|цыпленка|цыплят|цыплята|цыпл|бройлер|бройлера|бройлеров|цб)$/, 'курица'],
    [/^(индейка|индейки|индюшиная|индюшиный|индюшиное|индюшиные|индюшка|индюшки|инд)$/, 'индейка'],
    [/^(баранина|баранины|баранья|бараний|бараньи|баранье)$/, 'баранина'],
    [/^(телятина|телятины|телячья|телячий|телячьи|телячье)$/, 'телятина'],
    [/^(утка|утки|утиная|утиный|утиные|утиное)$/, 'утка'],
    [/^(томаты|томат|томатов)$/, 'помидор'],
    [/^(глаз|глазир|глазированные|глазированный)$/, 'глазированный'],
    [/^(окорочок|окорочка|окорочки|окорочек)$/, 'окорочка'],
    [/^(бедрышки|бедрышко|бедрышек|бедро|бедра)$/, 'бедра'],
    [/^(крыло|крылья|крылышки|крылышко|крылышек)$/, 'крылья'],
    [/^(яйцо|яйца|яиц)$/, 'яйца'],
    [/^(коса|косичка|косички)$/, 'косичка'],
    [/^(сырок|сырки|сырка|сырков|сырочек|сырочки)$/, 'сырок'],
  ];
  const rcCanon = (w) => { const hit = RC_CANON.find(([re]) => re.test(w)); return hit ? hit[1] : w; };
  const rcStems = (s) => U.stems(U.norm(s).split(/[\s-]+/).map(rcCanon).join(' '));
  let rcCatFor = null, rcCatList = [];
  const rcCat = (cat) => { if (rcCatFor !== cat) { rcCatFor = cat; rcCatList = cat.map((c) => ({ name: c.name, cs: rcStems(c.name) })).filter((c) => c.cs.length); } return rcCatList; };
  // основа из чека подходит к основе из справочника (как в общем сопоставлении продуктов)
  const rcFits = (a, b) => a === b || (b.length >= 3 && a.startsWith(b)) || (a.length >= 5 && b.startsWith(a) && a.length / b.length >= 0.7);
  // …и строгое совпадение для главного слова: «салфетки» не должны стать «салом», а «сырок» — «сыром»
  // (длинные слова в чеке обрезают сильнее: «сервел» → «сервелат»)
  const rcSame = (a, b) => (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= (Math.min(a.length, b.length) >= 5 ? 2 : 1);
  // Строка чека → самый точный продукт справочника: «Свинина охл Лопатка н.к» → «свинина лопатка», «Шея свиная» → «свинина шея»,
  // «Филе цыплёнка-бройлера» → «куриное филе», «Сыр Гауда 48%» → «сыр гауда». Главное слово в чеке стоит первым или вторым,
  // поэтому продукт обязан совпасть с одним из них (иначе сырок с какао стал бы «какао»).
  function rcProduct(name, cat, vocab) {
    const words = productName(Receipt.fixName(name, vocab.list)).split(/[\s-]+/).filter((w) => (w.length >= 3 || /^[a-z]{2,}$/.test(w) || w === 'цб') && !RC_GENERIC.has(w));
    const ts = rcStems(words.join(' '));
    let best = null, bs = 0;
    if (ts.length) {
      for (const it of rcCat(cat)) {
        let pos = 0;
        const all = it.cs.every((s) => { const at = ts.findIndex((t) => rcFits(t, s)); if (at < 0) return false; pos += ts.length - at; return true; });
        if (!all) continue;
        const h0 = it.cs.some((s) => rcSame(s, ts[0])), h1 = ts.length > 1 && it.cs.some((s) => rcSame(s, ts[1]));
        if (!h0 && !h1) continue;
        // точное совпадение главного слова важнее длины: «нектар» — это нектар, а не «нектарин»
        const exact = it.cs.includes(ts[0]) || (ts.length > 1 && it.cs.includes(ts[1]));
        const score = (h0 ? 1000 : 0) + it.cs.length * 100 + (exact ? 50 : 0) + pos * 5 + it.cs.join('').length;
        if (score > bs) { bs = score; best = it; }
      }
    }
    return best ? best.name : words.slice(0, 3).join(' ') || productName(name);
  }
  // Строка чека и позиция из «Купить» — одно и то же? Сравниваем и с подставленным названием, и с текстом чека:
  // «колбаса» из списка подходит к «Колбаса халяль сервел» → «сервелат», «курица» — к «куриным бёдрам».
  // Главное слово должно совпасть строго: «сыр» не равен «сырку», «сало» — «салфеткам».
  function rcListScore(listName, row) {
    if (U.norm(listName) === U.norm(row.name)) return 100;
    const ls = rcStems(listName);
    if (!ls.length) return 0;
    let best = 0;
    for (const src of [row.name, row.orig]) {
      const ss = src ? rcStems(src) : [];
      if (!ss.length || !ss.some((s) => rcSame(s, ls[0]))) continue;
      if (ls.every((l) => ss.some((s) => rcFits(s, l) || rcSame(s, l)))) best = Math.max(best, src === row.name ? 70 : 60);
      else if (src === row.name && ss.every((s) => ls.some((l) => rcFits(l, s) || rcSame(l, s)))) best = Math.max(best, 50);
    }
    return best;
  }
  // для каждой отмеченной строки чека — позиция из «Купить», которую она закрывает (каждая позиция — один раз)
  function rcListMatches(rows) {
    const todo = Store.all('shopping').filter((s) => s.status !== 'bought'), used = new Set();
    return rows.map((r) => {
      if (!r.on || !r.name) return null;
      let best = null, bs = 0;
      for (const t of todo) {
        if (used.has(t.id)) continue;
        const sc = rcListScore(t.name, r);
        if (sc > bs) { bs = sc; best = t; }
      }
      if (best) used.add(best.id);
      return best;
    });
  }
  // что подставить в строку чека: запомненное название или продукт справочника.
  // Если раньше строку назвали общо («свинина»), а в справочнике есть точнее («свинина лопатка») — берём точное.
  function rcName(orig, cat, vocab) {
    const product = rcProduct(orig, cat, vocab), learned = rcLookup(orig);
    if (!learned) return product;
    const inCat = cat.some((c) => c.name === product);
    return inCat && U.sameIng(learned.name, product) && U.stems(product).length > U.stems(learned.name).length ? product : learned.name;
  }
  // Если iPhone перезапустил приложение посреди распознавания (не хватило памяти) или пока была открыта камера,
  // после запуска объясняем, что случилось, и включаем экономный режим распознавания.
  const SCAN_MARK = 'kuhnya-scan-pending', PICK_MARK = 'kuhnya-pick-pending';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* без памяти */ } };
  let scanCrashNote = '';
  (function checkScanCrash() {
    const fresh = (k) => { const t = +lsGet(k); return t && Date.now() - t < 15 * 60 * 1000; };
    if (fresh(SCAN_MARK)) {
      // после каждого вылета — следующая ступень экономии (меньше фото и куски для нейросети)
      const lvl = Math.min(3, (+lsGet('kuhnya-ocr-lowmem') || 0) + 1);
      lsSet('kuhnya-ocr-lowmem', String(lvl));
      scanCrashNote = lvl < 3
        ? `Распознавание чека прервалось: телефону не хватило памяти, и он перезапустил приложение. Включён экономный режим (ступень ${lvl} из 3), попробуйте ещё раз. Помогает закрыть другие приложения, а длинный чек снять двумя фото.`
        : 'Распознавание снова прервалось из-за памяти. Включена самая экономная ступень. Перезагрузите телефон (выключить и включить) и попробуйте ещё раз; длинный чек снимайте двумя-тремя фото по частям.';
    } else if (fresh(PICK_MARK)) {
      scanCrashNote = 'Пока была открыта камера, телефон перезапустил приложение (так iPhone иногда освобождает память). Надёжнее сфотографировать чек обычной камерой, а потом в «Чек» выбрать фото из галереи.';
    }
    lsSet(SCAN_MARK, null); lsSet(PICK_MARK, null);
  })();
  async function openReceiptScan(files) {
    lsSet(PICK_MARK, null);
    lsSet(SCAN_MARK, String(Date.now()));
    try { await openReceiptScanInner(files); } finally { lsSet(SCAN_MARK, null); }
  }
  async function openReceiptScanInner(files) {
    const id = ++receiptScanId;
    const setStage = (text, p) => {
      if (id !== receiptScanId || !$('#modal').open) return;
      const t = $('#rc-stage'), bar = $('#rc-bar');
      if (t) t.textContent = text;
      if (bar) bar.style.width = Math.round((p || 0) * 100) + '%';
    };
    openModal(`<div class="form" data-keep>
      <div class="form-head"><h2>Читаю чек…</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <p id="rc-stage">Открываю фото…</p>
      <div class="progress"><i id="rc-bar"></i></div>
      <p class="muted small">Всё распознаётся прямо на устройстве, фото никуда не отправляется. В первый раз загрузится модель распознавания (около 20 МБ, лучше по Wi-Fi), дальше она берётся из памяти и работает без интернета. Обычно 10–30 секунд.</p>
    </div>`);
    try {
      const res = await Receipt.scan(files, ({ stage, p }) => {
        if (stage === 'qr') setStage('Ищу QR-код…', 0.05);
        else if (stage === 'prep') setStage('Готовлю фото…', 0.1);
        else if (stage === 'load') setStage(`Загружаю распознавание… ${Math.round(p * 100)}%`, 0.1 + p * 0.2);
        else if (stage === 'ocr') setStage(`Читаю чек… ${Math.round(p * 100)}%`, 0.3 + p * 0.7);
        else if (stage === 'ocr2') setStage(`Сумма не сошлась, перепроверяю другим способом… ${Math.round(p * 100)}%`, 0.8 + p * 0.2);
      });
      if (id !== receiptScanId || !$('#modal').open) return; // окно закрыли — результат не нужен
      const cat = catalog(), words = rcVocab();
      receiptDraft = {
        qr: res.qr, text: res.text, ocrTotal: res.ocrTotal, stamp: res.stamp, info: res.info || {},
        date: !res.qr && res.stamp && res.stamp.date <= U.today() ? res.stamp.date : undefined,
        items: res.items.map((it) => {
          // название с чека чиним по полному словарю (справочник, прошлые покупки), а не только по встроенному
          const orig = it.raw ? Receipt.fixName(it.raw, words.list) : it.name;
          // 1) так уже называли эту строку чека раньше; 2) продукт из справочника; 3) название с чека без фасовки
          return { name: rcName(orig, cat, words), orig, qty: it.qty, unit: it.unit, total: it.total, on: true, fixed: it.fixed, doubt: it.doubt };
        }),
      };
      // скидка из чека сходится с итогом — сразу разносим её по позициям
      const sum = receiptDraft.items.reduce((s, i) => s + i.total, 0), target = rcTarget(receiptDraft);
      if (res.discount && target && Math.abs(sum - res.discount - target) < 1 && sum > 0) {
        const k = target / sum;
        receiptDraft.items.forEach((i) => { i.total = Math.round(i.total * k * 100) / 100; });
        const rest = Math.round((target - receiptDraft.items.reduce((s, i) => s + i.total, 0)) * 100) / 100;
        if (rest) { const big = receiptDraft.items.reduce((a, b) => (b.total > a.total ? b : a)); big.total = Math.round((big.total + rest) * 100) / 100; }
        receiptDraft.discountApplied = res.discount;
      }
      receiptDraft.qrraw = res.qrraw;
      rcKeepDraft();
      // есть токен и реквизиты — берём точные данные из ФНС
      if (fnsToken() && res.qrraw) {
        setStage('Сверяю с базой ФНС…', 0.98);
        await rcAskFns(receiptDraft);
        if (id !== receiptScanId || !$('#modal').open) return;
      }
      rcKeepDraft();
      openModal(receiptForm(receiptDraft));
    } catch (e) {
      if (id === receiptScanId) { closeModal(); fail(e); }
    }
  }

  // ---------- Чек из базы ФНС (proverkacheka.com) ----------
  const FNS_ID = 'settings-fns', OCR_LOG_ID = 'settings-ocr-log';
  const fnsToken = () => String((Store.get('settings', FNS_ID) || {}).token || '').trim();
  // запросить чек в ФНС и заменить распознанные позиции точными; распознанное запомнить для статистики
  async function rcAskFns(d) {
    try {
      const f = await Receipt.fns(d.qrraw, fnsToken());
      if (!f.items.length) throw new Error('в ответе ФНС нет позиций');
      const cat = catalog(), words = rcVocab();
      const ocr = d.ocrItems || d.items.map((i) => ({ name: i.orig, raw: i.orig, total: i.total }));
      d.ocrItems = ocr;
      d.items = f.items.map((it) => {
        return { name: rcName(it.name, cat, words), orig: it.name, qty: it.qty, unit: it.unit, total: it.total, on: true };
      });
      const m = d.qrraw.match(/fn=(\d+).*?i=(\d+).*?fp=(\d+)/);
      d.qr = { ...(d.qr || {}), date: f.date || (d.qr && d.qr.date) || (d.stamp && d.stamp.date), time: f.time || (d.qr && d.qr.time) || (d.stamp && d.stamp.time) || '', sum: f.total || (d.qr && d.qr.sum), key: (d.qr && d.qr.key) || (m ? `${m[1]}-${m[2]}-${m[3]}` : ''), raw: d.qrraw };
      d.date = undefined; d.discountApplied = 0; d.fns = true; d.fnsError = '';
      if (ocr.length) await rcLog(Receipt.compare(ocr, f.items), d);
    } catch (e) {
      d.fnsError = String((e && e.message) || e);
    }
  }
  // журнал «распознанное против ФНС»: из него видно, как часто и где ошибается распознавание
  async function rcLog(cmp, d) {
    const cur = Store.get('settings', OCR_LOG_ID) || { id: OCR_LOG_ID, list: [] };
    const entry = { at: new Date().toISOString(), date: d.qr && d.qr.date, sum: d.qr && d.qr.sum, amounts: cmp.amounts, of: cmp.of, extra: cmp.extra,
      names: Math.round(cmp.names * 100), engine: d.info && d.info.engine, textH: d.info && d.info.textH,
      misses: cmp.rows.filter((r) => !r.ocr || r.sim < 0.8).slice(0, 8).map((r) => ({ ref: r.ref, ocr: r.ocr, total: r.total })) };
    await Store.save('settings', { ...cur, id: OCR_LOG_ID, list: [entry, ...(cur.list || [])].slice(0, 40) });
  }
  async function runOcrBench(files) {
    const out = () => $('#bench-out');
    const results = [];
    const pct = (v) => `${Math.round(v * 100)}%`;
    const render = (status) => {
      if (!out()) return;
      out().innerHTML = `${status ? `<p>${esc(status)}</p>` : ''}
        <table class="bench"><thead><tr><th>Чек</th><th>Суммы</th><th>Названия</th><th>Итог</th></tr></thead><tbody>
        ${results.map((r) => `<tr class="${r.bad ? 'bad' : ''}"><td>${esc(r.file)}<br><small class="muted">${esc(r.note)}</small></td><td>${esc(r.amounts)}</td><td>${esc(r.names)}</td><td>${esc(r.total)}</td></tr>
          ${r.misses && r.misses.length ? `<tr><td colspan="4"><details><summary class="small">Где ошибки (${r.misses.length})</summary><ul class="small">${r.misses.map((x) => `<li><b>${esc(x.ref)}</b> ${money(x.total)} ₽<br>распознано: ${esc(x.ocr || '— не найдено')}</li>`).join('')}</ul></details></td></tr>` : ''}`).join('')}
        </tbody></table>${results.length && !status ? ocrStatsHtml() : ''}`;
    };
    for (const [n, file] of files.entries()) {
      render(`Чек ${n + 1} из ${files.length}: распознаю…`);
      const row = { file: file.name || `фото ${n + 1}`, note: '', amounts: '—', names: '—', total: '—' };
      try {
        const t0 = performance.now();
        const res = await Receipt.scan([file], () => {});
        const sum = res.items.reduce((s, i) => s + i.total, 0);
        const target = res.qr ? res.qr.sum : res.ocrTotal;
        row.total = target ? (Math.abs(sum - target) < 0.05 ? 'сошёлся ✓' : `${money(sum)} из ${money(target)}`) : 'итог не найден';
        row.note = `${res.items.length} поз., ${res.info.engine === 'nn' ? 'нейросеть' : 'запасной способ'}, ${Math.round((performance.now() - t0) / 1000)} с${res.info.textH ? `, буквы ${res.info.textH} px` : ''}`;
        if (fnsToken() && res.qrraw) {
          render(`Чек ${n + 1} из ${files.length}: сверяю с ФНС…`);
          try {
            const f = await Receipt.fns(res.qrraw, fnsToken());
            const cmp = Receipt.compare(res.items, f.items);
            row.amounts = `${cmp.amounts} из ${cmp.of}${cmp.extra ? ` (+${cmp.extra} лишн.)` : ''}`;
            row.names = pct(cmp.names);
            row.misses = cmp.rows.filter((r) => !r.ocr || r.sim < 0.8).map((r) => ({ ref: r.ref, ocr: r.ocr, total: r.total }));
            row.bad = cmp.amounts < cmp.of;
            await rcLog(cmp, { qr: { date: f.date, sum: f.total }, info: res.info });
          } catch (e) { row.note += ` · ФНС: ${e.message}`; }
        } else if (fnsToken()) row.note += ' · реквизиты чека (ФН/ФД/ФП) не прочитались — сверить с ФНС нельзя';
        if (!fnsToken()) row.bad = !(target && Math.abs(sum - target) < 0.05);
      } catch (e) { row.note = 'ошибка: ' + e.message; row.bad = true; }
      results.push(row);
    }
    render('');
  }
  function ocrStatsHtml() {
    const list = ((Store.get('settings', OCR_LOG_ID) || {}).list || []);
    if (!list.length) return '<p class="muted small">Сверок с ФНС пока не было: статистика появится после первых чеков.</p>';
    const a = list.reduce((s, e) => s + e.amounts, 0), of = list.reduce((s, e) => s + e.of, 0);
    const n = Math.round(list.reduce((s, e) => s + e.names, 0) / list.length);
    return `<p class="small">Последние ${list.length} ${U.plural(list.length, 'чек', 'чека', 'чеков')}, сверенных с ФНС: суммы распознаны верно в <b>${Math.round((a / Math.max(1, of)) * 100)}%</b> позиций, названия совпадают в среднем на <b>${n}%</b>.</p>`;
  }

  function receiptForm(d) {
    const qr = d.qr;
    const date = d.date || (qr && qr.date) || U.today();
    const lastShop = (Store.all('shopping').filter((s) => s.shop).sort((a, b) => String(b.bought_on).localeCompare(String(a.bought_on)))[0] || {}).shop || '';
    const shops = [...new Set(['Пловдив', ...Store.all('shopping').map((s) => s.shop).filter(Boolean)])];
    const lm = rcListMatches(d.items);
    return `<form class="form receipt" data-form="receipt">
      <div class="form-head"><h2>Проверьте чек</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      ${d.fns ? `<p class="small ok-text">${icon('check', 'tiny')} <b>Проверено по базе ФНС</b>: ${esc(U.fmtDate(qr.date))}${qr.time ? `, ${esc(qr.time)}` : ''} · <b>${money(qr.sum)} ₽</b>. Названия, количества и цены — точные из чека.</p>`
        : d.fnsError ? `<p class="small warn-text">Запрос в ФНС не удался: ${esc(d.fnsError)}. Ниже — распознанное с фото. <button type="button" class="linklike" data-act="rc-fns">Повторить запрос</button></p>`
        : !fnsToken() && d.qrraw ? `<p class="muted small">Реквизиты чека прочитаны. Если указать токен proverkacheka.com в настройках, позиции будут подставляться точно из базы ФНС.</p>` : ''}
      ${d.fns ? '' : `<p class="small ${qr ? '' : 'warn-text'}">${qr
        ? `${icon('check', 'tiny')} QR-код: ${esc(U.fmtDate(qr.date))}, ${esc(qr.time)} · <b>${money(qr.sum)} ₽</b>${qr.refund ? ' · <b>возврат</b>' : ''}`
        : d.stamp && d.ocrTotal
          ? `QR-код не прочитался, дата и итог взяты из текста чека: ${esc(U.fmtDate(d.stamp.date))}, ${esc(d.stamp.time)} · <b>${money(d.ocrTotal)} ₽</b>. Проверьте их.`
          : 'QR-код не нашёлся: проверьте дату. Сумму считаю по позициям.'}
        ${d.discountApplied ? `<br>${icon('check', 'tiny')} Скидка ${money(d.discountApplied)} ₽ из чека уже разнесена по позициям.` : ''}
        ${d.items.some((i) => i.fixed) ? `<br>${icon('check', 'tiny')} В ${d.items.filter((i) => i.fixed).length} поз. цифра прочиталась неточно — исправлена по проверке «количество × цена = сумма».` : ''}</p>`}
      ${d.fns ? '' : d.info && d.info.engine === 'tess' ? `<p class="small warn-text">Чек прочитан <b>запасным способом</b> (он заметно хуже): нейросеть на этом устройстве не сработала — ${esc(d.info.nnError || 'причина неизвестна')}. Пришлите снимок этого окна, разберёмся.</p>` : d.info && d.info.engine ? `<p class="muted small">Распознавание: нейросеть${d.info.conf ? `, уверенность ${d.info.conf}%` : ''}.</p>` : ''}
      ${!d.fns && d.info && d.info.textH && d.info.textH < 13 ? `<p class="small warn-text">Чек снят мелко (буквы около ${d.info.textH} px), названия могли прочитаться с ошибками. Длинный чек лучше снимать двумя-тремя фото по частям с небольшим перекрытием и выбирать их все сразу — приложение склеит.</p>` : ''}
      <div class="grid2">
        <label>Дата покупки<input type="date" name="date" value="${esc(date)}" max="${U.today()}" required></label>
        <label>Магазин<input name="shop" list="dl-shops" value="${esc(d.shop != null ? d.shop : lastShop)}" placeholder="необязательно"></label>
      </div>
      <datalist id="dl-shops">${shops.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      ${d.items.length ? `<div class="rc-head"><span></span><span>Продукт</span><span>Кол-во</span><span>₽</span><span></span></div>
      <div class="rc-rows">${d.items.map((it, i) => `<div class="rc-row ${it.on ? '' : 'off'}" data-i="${i}">
        <input type="checkbox" name="on" ${it.on ? 'checked' : ''} aria-label="Учитывать">
        <div class="rc-name"><input name="n" data-suggest value="${esc(it.name)}" aria-label="Продукт">${it.orig && U.norm(it.orig) !== U.norm(it.name) ? `<small>${esc(it.orig)}</small>` : ''}${it.doubt ? '<small class="warn-text">цифры в строке не сходятся — проверьте сумму</small>' : ''}${lm[i] ? `<small class="ok-text rc-inlist">${icon('cart', 'tiny')} в «Купить»: ${esc(lm[i].name)} → куплено</small>` : ''}</div>
        <div class="rc-qty"><input name="q" inputmode="decimal" value="${esc(it.qty)}" aria-label="Количество">${unitSelect(it.unit)}</div>
        <input name="p" class="rc-price" inputmode="decimal" value="${esc(money(it.total))}" aria-label="Сумма, ₽">
        <button type="button" class="icon-btn" data-act="rc-del" data-i="${i}" aria-label="Удалить строку">${icon('trash')}</button>
      </div>`).join('')}</div>`
      : `<p class="muted">Позиции распознать не получилось: попробуйте переснять ровнее и при хорошем свете. Или сохраните чек одной суммой.</p>`}
      <button type="button" class="btn small" data-act="rc-add">${icon('plus')}<span>Добавить строку</span></button>
      <div class="rc-sum" id="rc-sum">${receiptSumHtml(d)}</div>
      <label class="check"><input type="checkbox" name="tolist" checked> Что было в «Купить» — отметить купленным${lm.filter(Boolean).length ? ` (${lm.filter(Boolean).length})` : ''}</label>
      <label class="check"><input type="checkbox" name="topantry" checked> Добавить в «Есть дома»</label>
      ${d.text ? `<details class="rc-raw"><summary>Распознанный текст</summary><textarea readonly rows="8">${esc(d.text)}</textarea></details>` : ''}
      <div class="form-actions wrap">
        ${rcTarget(d) || !d.items.length ? `<button type="button" class="btn" data-act="rc-lump">Одной суммой</button>` : ''}
        <button type="button" class="btn" data-act="close">Отмена</button>
        <button class="btn primary" ${d.items.length ? '' : 'disabled'}>Сохранить</button>
      </div>
    </form>`;
  }

  function receiptSumHtml(d) {
    const sum = d.items.filter((i) => i.on).reduce((s, i) => s + num2(i.total), 0);
    const target = rcTarget(d);
    if (!target) return `Итого по позициям: <b>${money(sum)} ₽</b>`;
    const diff = Math.round((sum - target) * 100) / 100;
    const ok = Math.abs(diff) < 0.5;
    // позиции дороже чека — это скидки, их можно разнести по позициям;
    // дешевле — какая-то строка не распозналась, её надо дописать, а не раздувать цены
    const hint = ok ? '' : diff > 0
      ? (diff <= target * 0.3 ? `<button type="button" class="linklike" data-act="rc-fit">Учесть скидку ${money(diff)} ₽: разнести по позициям</button>` : '<small>Похоже, лишняя строка: снимите галочку у неё.</small>')
      : `<small>Не хватает позиций на ${money(-diff)} ₽: добавьте строку или посмотрите «Распознанный текст».</small>`;
    return `<span class="${ok ? 'ok-text' : 'warn-text'}">Позиции: <b>${money(sum)} ₽</b> · ${d.qr ? 'по чеку' : '«итог» на чеке'}: <b>${money(target)} ₽</b>
      ${ok ? ' · сходится ✓' : ` · ${diff > 0 ? 'больше' : 'меньше'} на ${money(Math.abs(diff))} ₽`}</span>${hint}`;
  }

  // перенести то, что человек поправил в форме, обратно в черновик
  function readReceiptForm(f) {
    const d = receiptDraft;
    d.date = f.date.value; d.shop = f.shop.value;
    f.querySelectorAll('.rc-row').forEach((row) => {
      const it = d.items[+row.dataset.i];
      if (!it) return;
      it.on = row.querySelector('[name="on"]').checked;
      it.name = row.querySelector('[name="n"]').value.trim();
      it.qty = row.querySelector('[name="q"]').value.trim();
      it.unit = row.querySelector('[name="unit"]').value;
      it.total = num2(row.querySelector('[name="p"]').value);
    });
    return d;
  }

  async function saveReceipt(f, lump) {
    const d = readReceiptForm(f);
    const date = d.date || U.today();
    // чек узнаём по QR-коду, а без него — по дате, времени и итогу из текста
    const key = d.qr ? d.qr.key : d.stamp && d.ocrTotal ? `t-${d.stamp.date}-${d.stamp.time}-${money(d.ocrTotal)}` : '';
    // Один и тот же чек бывает в двух видах: бумажный (или «копия чека») и электронный с почты, и ключи у них разные.
    // Поэтому ещё сверяем день и итог чека.
    const total = rcTarget(d), totalKey = total ? money(total) : '';
    const dup = Store.all('shopping').some((s) => s.receipt && ((key && s.receipt === key) || (totalKey && s.receipt_sum === totalKey && s.bought_on === date)));
    if (dup && !(await confirmBox(`Чек от ${U.fmtDate(date)}${totalKey ? ` на ${totalKey} ₽` : ''} уже добавляли (может быть, его бумажную или электронную копию). Добавить ещё раз?`, 'Добавить'))) {
      openModal(receiptForm(d));
      return;
    }
    const base = { status: 'bought', bought_on: date, shop: d.shop || '', receipt: key || (totalKey ? `s-${date}-${totalKey}` : ''), receipt_sum: totalKey, created_on: U.today() };
    if (lump) {
      const sum = rcTarget(d) || d.items.filter((i) => i.on).reduce((s, i) => s + num2(i.total), 0);
      if (!sum) { toast('Нет суммы: впишите позиции или переснимите чек с QR-кодом'); return; }
      await Store.save('shopping', { ...base, name: d.shop ? `Чек: ${d.shop}` : 'Чек', qty: '', unit: '', price: money(sum), lump: true });
      receiptDraft = null; rcKeepDraft();
      closeModal();
      toast(`Чек сохранён одной суммой: ${money(sum)} ₽`);
      return;
    }
    const rows = d.items.filter((i) => i.on && i.name && num2(i.total) > 0);
    if (!rows.length) { toast('Нет отмеченных позиций'); return; }
    const toList = f.tolist.checked, toPantry = f.topantry.checked;
    // позиции из «Купить», которые есть в чеке, отмечаются купленными (уходят в историю), а продукт — в «Есть дома»
    const matches = toList ? rcListMatches(rows) : rows.map(() => null);
    const used = new Set(), out = [];
    rows.forEach((r, i) => {
      const t = matches[i];
      const rec = { ...base, name: r.name, qty: r.qty, unit: r.unit, price: money(num2(r.total)), note: d.shop ? 'чек: ' + d.shop : 'чек' };
      if (t) { used.add(t.id); out.push({ ...t, ...rec, name: t.name, from_list: true }); } else out.push(rec);
    });
    await Store.saveMany('shopping', out);
    if (toPantry) for (const r of rows) await addToPantry(r.name, r.unit === 'шт' && !r.qty ? '1' : r.qty, r.unit);
    await rcLearn(rows.filter((r) => r.orig)); // запоминаем, как вы назвали строки чека
    receiptDraft = null; rcKeepDraft();
    closeModal();
    const sum = rows.reduce((s, r) => s + num2(r.total), 0);
    toast(`Чек сохранён: ${rows.length} поз. на ${money(sum)} ₽${used.size ? `. Из «Купить» отмечено купленным: ${used.size}${toPantry ? ', они теперь в «Есть дома»' : ''}` : ''}`);
  }

  // ---------- Расходы ----------
  const priceOf = (s) => { const v = parseFloat(String(s.price || '').replace(/\s/g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : 0; };
  const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
  const monthIn = (ym) => MONTHS_IN[Number(ym.split('-')[1]) - 1];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const monthLabel = (ym, full) => { const [y, m] = ym.split('-').map(Number); return (full ? MONTHS_FULL : MONTHS_SHORT)[m - 1] + (full && y !== new Date().getFullYear() ? ' ' + y : ''); };

  function expensesView() {
    const bought = Store.all('shopping').filter((s) => s.status === 'bought' && s.bought_on);
    const thisMonth = U.today().slice(0, 7);
    // последние 6 месяцев
    const months = [];
    const d0 = U.parseDate(thisMonth + '-01');
    for (let i = 5; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push(U.toISODate(d).slice(0, 7)); }
    const sel = months.includes(ui.expMonth) ? ui.expMonth : thisMonth;
    const byMonth = Object.fromEntries(months.map((m) => [m, 0]));
    bought.forEach((s) => { const m = s.bought_on.slice(0, 7); if (m in byMonth) byMonth[m] += priceOf(s); });
    const inSel = bought.filter((s) => s.bought_on.slice(0, 7) === sel);
    const priced = inSel.filter((s) => priceOf(s));
    const total = byMonth[sel];
    const prevIdx = months.indexOf(sel) - 1;
    const prev = prevIdx >= 0 ? byMonth[months[prevIdx]] : 0;
    const noPrice = inSel.length - priced.length;

    if (!bought.some((s) => priceOf(s))) {
      return `<div class="empty">${icon('wallet', 'big')}<h3>Пока нет цен</h3><p>Откройте вкладку «История» и впишите цену в поле «₽» у купленных продуктов. Здесь появятся расходы по месяцам и по отделам магазина.</p></div>`;
    }

    const maxM = Math.max(...Object.values(byMonth), 1);
    const monthBars = `<div class="mbars" role="img" aria-label="Расходы по месяцам">${months.map((m) => {
      const v = byMonth[m], h = Math.round((v / maxM) * 100);
      return `<button class="mbar ${m === sel ? 'on' : ''}" data-act="set" data-k="expMonth" data-v="${m}" title="${esc(monthLabel(m, true))}: ${rub(v)}">
        <span class="mv">${v ? rub(v).replace(' ₽', '') : ''}</span><span class="col"><i style="height:${Math.max(h, v ? 3 : 0)}%"></i></span><span class="ml">${monthLabel(m)}</span></button>`;
    }).join('')}</div>`;

    const byCat = {};
    priced.forEach((s) => { const c = s.lump ? 'Чеки без разбивки' : catOf(s.name); byCat[c] = (byCat[c] || 0) + priceOf(s); });
    const byShop = {};
    priced.forEach((s) => { if (s.shop) byShop[s.shop] = (byShop[s.shop] || 0) + priceOf(s); });
    const shopsTop = Object.entries(byShop).sort((a, b) => b[1] - a[1]);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxC = cats.length ? cats[0][1] : 1;
    const byProd = {};
    priced.filter((s) => !s.lump).forEach((s) => { const n = U.norm(s.name); byProd[n] = byProd[n] || { name: s.name, sum: 0, n: 0 }; byProd[n].sum += priceOf(s); byProd[n].n++; });
    const top = Object.values(byProd).sort((a, b) => b.sum - a.sum).slice(0, 10);

    return `
      <div class="stats">
        <div class="stat"><small>${esc(cap(monthLabel(sel, true)))}</small><b>${rub(total)}</b>
          ${prev ? `<small class="muted">${total >= prev ? 'больше' : 'меньше'}, чем в ${esc(monthIn(months[prevIdx]))} (${rub(prev)})</small>` : ''}</div>
        <div class="stat"><small>Покупок с ценой</small><b>${priced.length} из ${inSel.length}</b>
          ${noPrice ? `<small class="muted">${noPrice} без цены: впишите в «Истории»</small>` : ''}</div>
      </div>
      <section class="card"><h2>По месяцам</h2>${monthBars}<p class="muted small">Нажмите на месяц, чтобы посмотреть подробности.</p></section>
      ${cats.length ? `<section class="card"><h2>По отделам в ${esc(monthIn(sel))}</h2>
        <ul class="hbars">${cats.map(([c, v]) => `<li title="${esc(c)}: ${rub(v)}"><span class="hl">${esc(c)}</span>
          <span class="track"><i style="width:${Math.max(2, Math.round((v / maxC) * 100))}%"></i></span><b>${rub(v)}</b></li>`).join('')}</ul></section>` : ''}
      ${shopsTop.length > 1 ? `<section class="card"><h2>По магазинам в ${esc(monthIn(sel))}</h2>
        <ul class="toplist">${shopsTop.map(([s, v]) => `<li><span>${esc(s)}</span><b>${rub(v)}</b></li>`).join('')}</ul></section>` : ''}
      ${top.length ? `<section class="card"><h2>Больше всего потратили на</h2>
        <ul class="toplist">${top.map((p) => `<li><span>${esc(p.name)}${p.n > 1 ? ` <small class="muted">×${p.n}</small>` : ''}</span><b>${rub(p.sum)}</b></li>`).join('')}</ul></section>` : ''}`;
  }

  function shopForm(s) {
    const bought = s.status === 'bought';
    return `<form class="form" data-form="shop-edit">
      <div class="form-head"><h2>${bought ? 'Покупка' : 'Купить'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="id" value="${esc(s.id)}">
      <label>Продукт<input name="name" data-suggest required value="${esc(s.name)}"></label>
      <div class="grid2">
        <label>Количество<input name="qty" inputmode="decimal" value="${esc(s.qty || '')}"></label>
        <label>Единица${unitSelect(s.unit)}</label>
        ${bought ? `<label>Дата покупки<input name="bought_on" type="date" value="${esc(s.bought_on || '')}"></label>
        <label>Цена, ₽<input name="price" inputmode="decimal" value="${esc(s.price || '')}"></label>` : ''}
      </div>
      <label>Заметка<input name="note" value="${esc(s.note || '')}"></label>
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div>
    </form>`;
  }

  // =====================================================================
  // ЗАГОТОВКИ И ЗАМОРОЗКА (п.7–9)
  // =====================================================================
  function viewPreserves() {
    const act = activePreserves();
    const cnt = (o) => act.filter((p) => (p.owner || 'family') === o).length;
    const soonCnt = (o) => act.filter((p) => (p.owner || 'family') === o && p.expires_on && U.daysLeft(p.expires_on) <= REMIND_DAYS).length;
    const tab = (o, label) => `<button class="${ui.presOwner === o ? 'on' : ''}" data-act="set" data-k="presOwner" data-v="${o}">${label} · ${cnt(o)}${soonCnt(o) ? ` <i class="dot-warn" title="есть со сроком"></i>` : ''}</button>`;
    return `
      <div class="page-head"><h1>Заготовки и заморозка</h1>
        <button class="btn primary" data-act="preserve-new">${icon('plus')}<span>Добавить</span></button></div>
      <div class="seg">${tab('family', 'Для нас')}${tab('savva', 'Для Саввы')}</div>
      <div class="chips">${[['all', 'Всё'], ['freeze', 'Заморозка'], ['jar', 'Заготовки']].map(([v, l]) =>
        `<button class="chip ${ui.presKind === v ? 'on' : ''}" data-act="set" data-k="presKind" data-v="${v}">${l}</button>`).join('')}</div>
      <div id="list">${preservesList()}</div>`;
  }

  function preservesList() {
    const mine = Store.all('preserves').filter((p) => (p.owner || 'family') === ui.presOwner && (ui.presKind === 'all' || p.kind === ui.presKind));
    const act = mine.filter((p) => !p.finished).sort((a, b) => String(a.expires_on || '9999').localeCompare(String(b.expires_on || '9999')));
    const done = mine.filter((p) => p.finished).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const who = ui.presOwner === 'savva' ? 'для Саввы' : '';
    let html = act.length ? `<div class="plist-cards">${act.map(presCard).join('')}</div>`
      : `<div class="empty">${icon('snow', 'big')}<h3>Пока ничего ${who}</h3><p>Добавляйте заморозку и заготовки с датой изготовления. Срок годности посчитается сам, а когда он будет подходить к концу, появится предупреждение.</p></div>`;
    if (done.length) {
      html += `<details class="cat"><summary>Израсходовано <small>${done.length}</small></summary><ul class="clist">${done.slice(0, 50).map((p) => `
        <li><span>${esc(p.name)} <small class="muted">сделано ${esc(U.fmtDate(p.made_on))}</small></span><span class="btns">
          <button class="mini" data-act="preserve-restore" data-id="${esc(p.id)}">вернуть</button>
          <button class="mini" data-act="preserve-copy" data-id="${esc(p.id)}">сделать ещё</button>
          <button class="mini danger-ghost" data-act="preserve-del" data-id="${esc(p.id)}" aria-label="Удалить">${icon('trash')}</button></span></li>`).join('')}</ul></details>`;
    }
    return html;
  }

  function presCard(p) {
    const e = expiryInfo(p);
    const total = p.made_on && p.expires_on ? U.daysBetween(p.made_on, p.expires_on) : 0;
    const left = total ? Math.max(0, Math.min(100, Math.round((U.daysLeft(p.expires_on) / total) * 100))) : 100;
    return `<div class="pcard ${e.cls}">
      <div class="pc-top">
        <span class="kind">${icon(p.kind === 'jar' ? 'jar' : 'snow')}</span>
        <button class="pc-name" data-act="preserve-edit" data-id="${esc(p.id)}"><b>${esc(p.name)}</b>
          <small>${p.kind === 'jar' ? 'заготовка' : 'заморозка'} · сделано ${esc(U.fmtDate(p.made_on))}${p.place ? ' · ' + esc(p.place) : ''}</small></button>
        <span class="exp ${e.cls}">${esc(e.text)}</span>
      </div>
      <span class="meter life ${e.cls}"><i style="width:${left}%"></i></span>
      ${p.notes ? `<p class="small muted">${esc(p.notes)}</p>` : ''}
      <div class="pc-bottom">
        <div class="stepper">
          <button class="icon-btn" data-act="preserve-dec" data-id="${esc(p.id)}" aria-label="Взяли одну">${icon('minus')}</button>
          <span><b>${esc(p.qty || '0')}</b> ${esc(p.unit || '')}</span>
          <button class="icon-btn" data-act="preserve-inc" data-id="${esc(p.id)}" aria-label="Добавили одну">${icon('plus')}</button>
        </div>
        ${p.expires_on ? `<a class="icon-btn" title="Напоминание в Google Календарь" aria-label="Напоминание в Google Календарь" target="_blank" rel="noopener" href="${esc(calendarLink(p))}">${icon('cal')}</a>` : ''}
        <button class="btn small" data-act="preserve-finish" data-id="${esc(p.id)}">Закончилось</button>
      </div>
    </div>`;
  }

  function calendarLink(p) {
    const d = p.expires_on.replace(/-/g, '');
    const d2 = U.addDays(p.expires_on, 1).replace(/-/g, '');
    const text = `Истекает срок: ${p.name}${p.owner === 'savva' ? ' (Савва)' : ''}`;
    const details = `Сделано ${U.fmtDate(p.made_on)}. Осталось: ${U.fmtQty(p.qty, p.unit)}. ${p.place || ''}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${d}/${d2}&details=${encodeURIComponent(details)}`;
  }

  const SHELF_PRESETS = [['1н', 7, 0], ['2н', 14, 0], ['1м', 0, 1], ['2м', 0, 2], ['3м', 0, 3], ['6м', 0, 6], ['1 год', 0, 12]];
  const defaultShelf = (kind, owner) => (kind === 'jar' ? 12 : owner === 'savva' ? 1 : 3); // в месяцах

  function preserveForm(p) {
    const isNew = !p.id;
    p = Object.assign({ kind: 'freeze', owner: ui.presOwner, made_on: U.today(), qty: '1', unit: 'порция', place: 'Морозилка' }, p);
    if (!p.expires_on) p.expires_on = U.addMonths(p.made_on, defaultShelf(p.kind, p.owner));
    return `<form class="form" data-form="preserve">
      <div class="form-head"><h2>${isNew ? 'Новая заготовка' : 'Изменить'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="id" value="${esc(p.id || '')}">
      <input type="hidden" name="recipe_id" value="${esc(p.recipe_id || '')}">
      <label>Что это*<input name="name" required value="${esc(p.name || '')}" placeholder="например, пюре кабачок-брокколи" ${isNew ? 'autofocus' : ''}></label>
      <div class="grid2">
        <label>Тип<select name="kind" data-shelf-src><option value="freeze" ${p.kind === 'freeze' ? 'selected' : ''}>Заморозка</option><option value="jar" ${p.kind === 'jar' ? 'selected' : ''}>Заготовка (банки)</option></select></label>
        <label>Для кого<select name="owner" data-shelf-src><option value="family" ${p.owner !== 'savva' ? 'selected' : ''}>Для нас</option><option value="savva" ${p.owner === 'savva' ? 'selected' : ''}>Для Саввы</option></select></label>
        <label>Дата изготовления<input name="made_on" type="date" required value="${esc(p.made_on)}" data-shelf-src></label>
        <label>Годен до<input name="expires_on" type="date" value="${esc(p.expires_on)}" ${isNew ? 'data-auto="1"' : ''}></label>
      </div>
      <div class="presets"><small class="muted">Срок хранения:</small>${SHELF_PRESETS.map(([l, d, m]) => `<button type="button" class="chip" data-act="shelf" data-d="${d}" data-m="${m}">${l}</button>`).join('')}</div>
      <div class="grid3">
        <label>Количество<input name="qty" inputmode="decimal" value="${esc(p.qty || '')}"></label>
        <label>Единица${unitSelect(p.unit)}</label>
        <label>Где лежит<input name="place" list="dl-places" value="${esc(p.place || '')}"></label>
      </div>
      <label>Заметка<input name="notes" value="${esc(p.notes || '')}" placeholder="состав, с какого возраста, как разогревать…"></label>
      <p class="muted small">${ui.presOwner === 'savva' || p.owner === 'savva' ? 'Для детского пюре по умолчанию ставится 1 месяц. Поменяйте, если считаете иначе.' : 'По умолчанию: заморозка 3 месяца, банки 1 год.'}</p>
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div>
    </form>`;
  }

  // =====================================================================
  // РЕЖИМ «ГОТОВЛЮ»: экран не гаснет, крупные шаги, таймеры
  // =====================================================================
  let cookState = { id: null, done: new Set(), step: 0 };
  let wakeLock = null, wantAwake = false;
  async function keepAwake(on) {
    wantAwake = on;
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      } else if (!on && wakeLock) {
        const w = wakeLock; wakeLock = null; await w.release();
      }
    } catch (e) { /* браузер не разрешил — просто работаем дальше */ }
  }
  // после сворачивания браузер снимает блокировку — возвращаем
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });

  const recipeSteps = (r) => String(r.steps || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

  // «варить 20 минут», «1,5 часа», «30–40 мин»
  function stepTimers(text) {
    const out = [];
    const re = /(\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*(\d+(?:[.,]\d+)?))?\s*(минут[ауы]?|мин\.?|час(?:а|ов)?|ч\.?(?=\s|$|[,;)])|секунд[ауы]?|сек\.?)/gi;
    for (const m of String(text).matchAll(re)) {
      const n = parseFloat(m[1].replace(',', '.'));
      const u = m[3].toLowerCase();
      const sec = u.startsWith('с') ? n : u.startsWith('ч') ? n * 3600 : n * 60;
      if (sec >= 10 && sec <= 12 * 3600) out.push({ sec: Math.round(sec), label: m[0].replace(/\s+/g, ' ') });
    }
    return out;
  }

  function viewCook(id) {
    const r = Store.get('recipes', id);
    if (!r) return `<a class="back" href="#/recipes">${icon('back')}Рецепты</a><div class="empty">Рецепт не найден</div>`;
    if (cookState.id !== id) cookState = { id, done: new Set(), step: 0 };
    const steps = recipeSteps(r);
    const cur = Math.min(cookState.step, Math.max(steps.length - 1, 0));
    const awakeNote = 'wakeLock' in navigator ? 'экран не погаснет' : 'на этом устройстве экран может гаснуть';
    return `<div class="cook">
      <div class="cook-head">
        <a class="icon-btn" href="#/recipe/${encodeURIComponent(r.id)}" aria-label="Выйти из режима готовки">${icon('x')}</a>
        <div><h1>${esc(r.title)}</h1><small class="muted">${awakeNote}</small></div>
      </div>
      ${(r.ingredients || []).length ? `<section class="cook-ings"><h2>Ингредиенты <small class="muted">нажмите, когда положили</small></h2>
        ${servingsStepper(r)}
        ${limitHTML(r)}
        <div class="cook-ing-list">${r.ingredients.map((i, n) => `<div class="cing ${cookState.done.has(n) ? 'done' : ''}" role="button" tabindex="0" data-act="cook-ing" data-i="${n}">
          <span class="dot">${icon('check')}</span><span class="ing-t">${ingLineHTML(r, i, n)}</span></div>`).join('')}</div>
        <p class="muted small hint-amt">Количество можно нажать и поправить под то, что есть.</p></section>` : ''}
      <section class="cook-steps">
        ${scaleStepsToggle(r)}
        ${steps.length ? steps.map((t, n) => `<div class="cstep ${n === cur ? 'cur' : ''} ${n < cur ? 'past' : ''}" data-act="cook-step" data-i="${n}">
          <b>Шаг ${n + 1} из ${steps.length}</b><p>${stepHTML(r, t)}</p>
          ${stepTimers(t).map((tm) => `<button class="btn small timer-btn" data-act="timer-start" data-sec="${tm.sec}" data-label="${esc(`${r.title}: ${tm.label}`)}">${icon('clock')}<span>${esc(tm.label)}</span></button>`).join('')}
        </div>`).join('') : `<div class="empty small">Шаги приготовления не записаны.${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Открыть рецепт на сайте</a>` : ''}</div>`}
      </section>
      <div class="cook-nav">
        ${steps.length > 1 ? `<button class="btn" data-act="cook-go" data-d="-1" ${cur === 0 ? 'disabled' : ''} aria-label="Предыдущий шаг">${icon('back')}</button>` : ''}
        ${!steps.length || cur === steps.length - 1
          ? `<button class="btn primary grow" data-act="cooked-open" data-id="${esc(r.id)}">${icon('check')}<span>Готово, приготовили</span></button>`
          : `<button class="btn primary grow" data-act="cook-go" data-d="1"><span>Дальше</span>${icon('next')}</button>`}
      </div>
    </div>`;
  }
  function scrollToCurrentStep() {
    const el = $('.cstep.cur');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---------- Таймеры (работают на любой странице) ----------
  let timers = [];
  let timerTick = null;
  function fmtLeft(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) { /* без звука */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
  function renderTimers() {
    const box = $('#timers');
    const now = Date.now();
    timers.forEach((t) => { if (!t.rang && t.end <= now) { t.rang = true; beep(); toast(`Таймер: ${t.label}, готово!`); } });
    box.innerHTML = timers.map((t) => `<div class="timer ${t.rang ? 'rang' : ''}">${icon('clock')}<span>${esc(t.label)}</span>
      <b>${t.rang ? 'готово!' : fmtLeft((t.end - now) / 1000)}</b><button data-act="timer-stop" data-id="${t.id}" aria-label="Убрать таймер">${icon('x')}</button></div>`).join('');
    if (!timers.length && timerTick) { clearInterval(timerTick); timerTick = null; }
  }
  function startTimer(sec, label) {
    timers.push({ id: Date.now() + Math.random(), label, end: Date.now() + sec * 1000 });
    if (!timerTick) timerTick = setInterval(renderTimers, 1000);
    renderTimers();
  }

  // ---------- «Приготовили»: история + списание продуктов ----------
  function writeOffPlan(r) {
    const plan = [];
    const used = new Set();
    for (const [n, i0] of (r.ingredients || []).entries()) {
      const i = effIng(r, i0, n); // фактическое количество — с пересчётом и правками
      const p = pantry().find((x) => !used.has(x.id) && (U.sameIng(x.name, ingLabel(i)) || U.sameIng(x.name, i.name)));
      if (!p) continue;
      used.add(p.id);
      const left = Measures.subtractSmart(ingLabel(i), p.qty, p.unit, i.qty, i.unit);
      if (left !== null && left > 0) plan.push({ p, mode: 'sub', left, checked: true, text: `${U.fmtQty(p.qty, p.unit)} → ${U.fmtQty(U.fmtNum(left), p.unit)}` });
      else if (left !== null) plan.push({ p, mode: 'remove', checked: true, text: 'закончится' });
      else plan.push({ p, mode: 'remove', checked: false, text: 'закончилось?' });
    }
    return plan;
  }

  function cookedForm(r) {
    const plan = writeOffPlan(r);
    const s = r.status || 'new';
    return `<form class="form" data-form="cooked">
      <div class="form-head"><h2>Приготовили: ${esc(r.title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="id" value="${esc(r.id)}">
      <label>Когда<input type="date" name="date" value="${U.today()}" max="${U.today()}" required></label>
      <fieldset class="rate"><legend>Как вам?</legend>
        ${[['liked', '❤ Понравилось'], ['meh', 'Не зашло'], ['new', 'Пока не решили']].map(([v, l]) =>
          `<label class="chip ${s === v ? 'on' : ''}"><input type="radio" name="status" value="${v}" ${s === v ? 'checked' : ''}>${l}</label>`).join('')}
      </fieldset>
      ${plan.length ? `<div class="wo"><b>Списать из «Есть дома»</b>
        <small class="muted">Количество вычитается, где его можно посчитать. Отметьте то, что закончилось.</small>
        ${plan.map((x) => `<label class="check"><input type="checkbox" name="wo" value="${esc(x.p.id)}" data-mode="${x.mode}" data-left="${x.mode === 'sub' ? x.left : ''}" ${x.checked ? 'checked' : ''}>
          <span><b>${esc(x.p.name)}</b> <span class="muted">${esc(x.text)}</span></span></label>`).join('')}
        <label class="check"><input type="checkbox" name="toshop" checked> То, что закончилось, добавить в покупки</label>
      </div>` : `<p class="muted small">Продуктов этого рецепта в «Есть дома» нет, списывать нечего.</p>`}
      ${hasAdj(r) ? `<label class="check"><input type="checkbox" name="saveqty"> <span>Сохранить мои количества в рецепт <small class="muted">(${esc(adjSummary(r))}; старые запишутся в заметки)</small></span></label>` : ''}
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div>
    </form>`;
  }

  async function saveCooked(f) {
    const fd = new FormData(f);
    const r = Store.get('recipes', fd.get('id'));
    const date = fd.get('date') || U.today();
    let upd = { ...r, cooked: [...(r.cooked || []), date].sort(), status: fd.get('status') || r.status || 'new' };
    if (fd.get('saveqty') && hasAdj(r)) { upd = { ...upd, ...adjustedRecipe(r) }; delete adj[r.id]; }
    await Store.save('recipes', upd);
    const finished = [];
    for (const cb of f.querySelectorAll('input[name="wo"]:checked')) {
      const p = Store.get('pantry', cb.value);
      if (!p) continue;
      if (cb.dataset.mode === 'sub' && parseFloat(cb.dataset.left) > 0) {
        await Store.save('pantry', { ...p, qty: String(cb.dataset.left), updated_on: U.today() });
      } else {
        await Store.remove('pantry', p.id);
        finished.push({ name: p.name, unit: p.unit });
      }
    }
    let shop = 0;
    if (finished.length && fd.get('toshop')) shop = await addToShopping(finished);
    closeModal();
    if (route().name === 'cook') location.hash = '#/recipe/' + encodeURIComponent(r.id);
    toast(`Записали${finished.length ? `, закончилось: ${finished.length}` : ''}${shop ? `, в покупки: ${shop}` : ''}`);
  }

  // =====================================================================
  // МЕНЮ НЕДЕЛИ
  // =====================================================================
  const SLOTS = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин']];
  const SLOT_CATS = { breakfast: ['Завтраки'], lunch: ['Супы'], dinner: ['Основные блюда', 'Гарниры'] };
  const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  function weekDays(offset) {
    const t = U.parseDate(U.today());
    const mon = U.addDays(U.today(), -((t.getDay() + 6) % 7) + 7 * offset);
    return [...Array(7)].map((_, i) => U.addDays(mon, i));
  }
  const menuId = (date) => 'menu-' + date;
  const menuDay = (date) => Store.get('menu', menuId(date)) || { id: menuId(date), date, breakfast: [], lunch: [], dinner: [] };
  const dishTitle = (d) => {
    if (d.rid) { const r = Store.get('recipes', d.rid); return r ? r.title : '(рецепт удалён)'; }
    return d.text || '';
  };
  // заморозка, подходящая к блюду: связана с рецептом или совпадает по названию (так же считает вечерний бот)
  const inFreezer = (rid, title) => activePreserves().find((p) => p.kind !== 'jar' && (parseFloat(p.qty) || 0) > 0 &&
    ((rid && p.recipe_id === rid) || (title && U.sameIng(p.name, title))));
  const freezerBadge = (p) => (p ? `<span class="fz" title="В морозилке: ${esc(U.fmtQty(p.qty, p.unit))}">${icon('snow')}</span>` : '');
  const weekDishes = (days) => {
    const out = [];
    days.forEach((d) => SLOTS.forEach(([k]) => (menuDay(d)[k] || []).forEach((x) => out.push(x))));
    return out;
  };

  function viewMenu() {
    const days = weekDays(ui.menuWeek || 0);
    const today = U.today();
    const filled = weekDishes(days).length;
    return `
      <div class="page-head"><h1>Меню недели</h1></div>
      <div class="weeknav">
        <button class="icon-btn" data-act="week" data-d="-1" aria-label="Предыдущая неделя">${icon('back')}</button>
        <b>${esc(U.fmtDate(days[0]))} – ${esc(U.fmtDate(days[6]))}</b>
        <button class="icon-btn flip" data-act="week" data-d="1" aria-label="Следующая неделя">${icon('back')}</button>
        ${ui.menuWeek ? `<button class="chip" data-act="week" data-d="0">к этой неделе</button>` : ''}
      </div>
      <div class="row wrap">
        <button class="btn" data-act="menu-autofill">${icon('bulb')}<span>Заполнить пустое</span></button>
        <button class="btn primary" data-act="menu-shop" ${filled ? '' : 'disabled'}>${icon('cart')}<span>Продукты на неделю в покупки</span></button>
        ${filled ? `<button class="btn danger-ghost" data-act="menu-clear">${icon('trash')}<span>Очистить неделю</span></button>` : ''}
        ${hook('menuActions')}
      </div>
      <p class="muted small">«Заполнить пустое» подставляет на завтрак завтрак, на обед суп, на ужин второе с гарниром. Чаще выбираются понравившиеся блюда, те, что давно не готовили, и те, для которых продукты уже есть дома. Повторов за неделю нет, прошедшие дни не трогаются.</p>
      ${filled ? `<p class="muted small">Чтобы перенести блюдо на другой день или приём пищи, потяните его за точки ${icon('grip', 'tiny')} слева.</p>` : ''}
      <div class="week">${days.map((d, i) => {
        const day = menuDay(d);
        return `<section class="day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">
          <h3>${WD[i]}, ${esc(U.fmtDate(d))}${d === today ? ' <em class="tag ok">сегодня</em>' : ''}</h3>
          ${SLOTS.map(([k, l]) => `<div class="slot" data-date="${d}" data-slot="${k}"><span class="slot-l">${l}</span><div class="dishes">
            ${(day[k] || []).map((x, j) => `<span class="dish" data-j="${j}"><span class="grip" data-grip data-date="${d}" data-slot="${k}" data-j="${j}" title="Потяните, чтобы перенести" aria-label="Перенести блюдо">${icon('grip')}</span>${freezerBadge(inFreezer(x.rid, dishTitle(x)))}${x.rid ? `<a href="#/recipe/${encodeURIComponent(x.rid)}">${esc(dishTitle(x))}</a>` : `<button class="dish-text" data-act="menu-text-dish" data-date="${d}" data-slot="${k}" data-j="${j}" title="Блюдо без рецепта">${esc(dishTitle(x))}</button>`}<button data-act="menu-del" data-date="${d}" data-slot="${k}" data-j="${j}" aria-label="Убрать">${icon('x')}</button></span>`).join('')}
            <button class="dish add" data-act="menu-pick" data-date="${d}" data-slot="${k}" aria-label="Добавить блюдо: ${l}">${icon('plus')}</button>
          </div></div>`).join('')}
        </section>`;
      }).join('')}</div>`;
  }

  function openPicker(date, slot) {
    const cats = RECIPE_CATS.filter((c) => Store.all('recipes').some((r) => r.category === c));
    const def = SLOT_CATS[slot].find((c) => cats.includes(c)) || '';
    openModal(`<div class="form picker" data-date="${date}" data-slot="${slot}" data-cat="${esc(def)}">
      <div class="form-head"><h2>${SLOTS.find((s) => s[0] === slot)[1]}, ${esc(U.fmtDate(date))}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <form class="pick-form" data-form="menu-text">
        <label class="search">${icon('search')}<input id="pick-q" name="text" type="search" placeholder="Найдите рецепт или впишите любое блюдо" autocomplete="off" enterkeyhint="done"></label>
        <div id="pick-add"></div>
      </form>
      <div class="chips">${['', ...cats].map((c) => `<button type="button" class="chip ${c === def ? 'on' : ''}" data-act="pick-cat" data-cat="${esc(c)}">${esc(c || 'Все')}</button>`).join('')}</div>
      <div id="pick-list" class="pick-list"></div>
    </div>`);
    renderPickList();
  }
  // блюда без рецепта, которые уже ставили в меню, — чтобы не набирать заново
  const pastTextDishes = () => {
    const seen = new Map();
    Store.all('menu').forEach((d) => SLOTS.forEach(([k]) => (d[k] || []).forEach((x) => { if (x.text) seen.set(U.norm(x.text), x.text); })));
    return [...seen.values()];
  };
  function renderPickList() {
    const box = $('#modal .picker');
    if (!box) return;
    const raw = $('#pick-q', box).value.trim();
    const q = U.norm(raw);
    const cat = box.dataset.cat;
    const names = pantry().map((p) => p.name);
    const list = Store.all('recipes')
      .filter((r) => r.status !== 'meh' && (q ? U.norm(r.title).includes(q) : !cat || r.category === cat))
      .sort((a, b) => (b.status === 'liked') - (a.status === 'liked') || String(a.title).localeCompare(String(b.title), 'ru'));
    const texts = pastTextDishes().filter((t) => q && U.norm(t).includes(q) && U.norm(t) !== q);
    const exact = list.some((r) => U.norm(r.title) === q);
    $('#pick-add', box).innerHTML = raw && !exact
      ? `<button class="btn primary block" type="submit">${icon('plus')}<span>Добавить «${esc(raw)}» без рецепта</span></button>` : '';
    $('#pick-list', box).innerHTML = (texts.map((t) => `<button type="button" class="pick-item" data-act="pick-text" data-text="${esc(t)}"><b>${esc(t)}</b><small>без рецепта, уже было в меню</small></button>`).join('') +
      list.map((r) => {
        const a = analyze(r, names);
        const fz = inFreezer(r.id, r.title);
        return `<button type="button" class="pick-item" data-act="pick" data-rid="${esc(r.id)}"><b>${esc(r.title)}</b>
          <small>${esc(r.category || '')}${fz ? ` · ❄ в морозилке ${esc(U.fmtQty(fz.qty, fz.unit))}` : a.total ? ` · дома ${a.have} из ${a.total}` : ''}</small></button>`;
      }).join('')) || `<div class="empty small">${raw ? 'Рецептов с таким названием нет: добавьте блюдо кнопкой выше' : 'Нет блюд в этой категории'}</div>`;
  }

  async function addDish(date, slot, dish) {
    const day = menuDay(date);
    await Store.save('menu', { ...day, [slot]: [...(day[slot] || []), dish] });
  }

  async function autofillWeek() {
    const days = weekDays(ui.menuWeek || 0).filter((d) => d >= U.today());
    const names = pantry().map((p) => p.name);
    const recipes = Store.all('recipes').filter((r) => r.status !== 'meh');
    const used = new Set(weekDishes(weekDays(ui.menuWeek || 0)).map((x) => x.rid).filter(Boolean));
    const pick = (cat) => {
      const pool = recipes.filter((r) => r.category === cat);
      if (!pool.length) return null;
      let fresh = pool.filter((r) => !used.has(r.id));
      if (!fresh.length) fresh = pool;
      const w = fresh.map((r) => {
        const a = analyze(r, names);
        const last = lastCooked(r);
        const since = last ? U.daysBetween(last, U.today()) : null;
        // давно не готовили — чаще, готовили на днях — реже
        const recency = since === null ? 1.3 : since < 4 ? 0.2 : Math.min(1 + since / 30, 3);
        const frozen = inFreezer(r.id, r.title) ? 1.5 : 1; // есть в морозилке — пора использовать
        return (r.status === 'liked' ? 2 : 1) * (1 + (a.total ? a.have / a.total : 0)) * recency * frozen;
      });
      let x = Math.random() * w.reduce((s, v) => s + v, 0);
      let chosen = fresh[fresh.length - 1];
      for (let i = 0; i < fresh.length; i++) { x -= w[i]; if (x <= 0) { chosen = fresh[i]; break; } }
      used.add(chosen.id);
      return chosen;
    };
    const docs = [];
    for (const d of days) {
      const day = { ...menuDay(d) };
      let changed = false;
      for (const [k] of SLOTS) {
        if ((day[k] || []).length) continue;
        const dishes = SLOT_CATS[k].map(pick).filter(Boolean).map((r) => ({ rid: r.id }));
        if (dishes.length) { day[k] = dishes; changed = true; }
      }
      if (changed) docs.push(day);
    }
    if (docs.length) await Store.saveMany('menu', docs);
    return docs.length;
  }

  async function weekToShopping() {
    const names = pantry().map((p) => p.name);
    const days = weekDays(ui.menuWeek || 0);
    const need = new Map(); // продукт → { количества, блюда }
    weekDishes(days).forEach((x) => {
      const r = x.rid && Store.get('recipes', x.rid);
      if (!r || inFreezer(r.id, r.title)) return; // из морозилки — готовить не нужно
      analyze(r, names).missing.forEach((i) => {
        const n = ingLabel(i);
        if (!need.has(n)) need.set(n, { qtys: [], titles: new Set() });
        const e = need.get(n);
        e.qtys.push({ qty: i.qty, unit: i.unit });
        e.titles.add(r.title);
      });
    });
    return [...need].map(([name, e]) => ({ name, ...U.sumQty(e.qtys), note: 'меню: ' + [...e.titles].join(', '), src: 'week:' + days[0] }));
  }

  // =====================================================================
  // НАСТРОЙКИ И ВХОД
  // =====================================================================
  function viewSettings() {
    const cloud = Store.mode === 'cloud';
    const c = (k) => Store.all(k).length;
    return `
      <div class="page-head"><h1>Настройки</h1></div>
      <section class="card">
        <h2>Где хранятся данные</h2>
        ${cloud
          ? `<p>${icon('check')} Общая база Supabase: изменения сразу видны вам обоим.<br><span class="muted small">Вы вошли как ${esc(Store.userEmail())}</span></p>
             <p class="small">${Store.status().pending ? `<b>Не отправлено: ${Store.status().pending}</b>` : 'Все изменения отправлены'}${Store.lastSync ? ` · данные обновлены ${esc(U.ago(U.toISODate(new Date(Store.lastSync))))} в ${new Date(Store.lastSync).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}${{ offline: ' · <b>нет сети</b>', down: ' · <b>база не отвечает</b>', auth: ' · <b>нет доступа к базе</b>' }[Store.status().net] || ''}${Store.proxied ? ' · через посредника (Яндекс Облако), изменения проверяются каждые 30 секунд' : Store.realtime && Store.realtime !== 'SUBSCRIBED' ? ' · живое обновление не подключено, изменения проверяются каждые 30 секунд' : ''}</p>
             <div class="row wrap">
               <button class="btn primary" data-act="sync">${icon('repeat')}<span>Синхронизировать сейчас</span></button>
               <button class="btn" data-act="diag">${icon('search')}<span>Проверить связь</span></button>
               <button class="btn" data-act="logout">Выйти</button>
             </div>`
          : `<p><b>Локально, только в этом браузере.</b> Чтобы пользоваться вдвоём с телефонов, подключите Supabase по инструкции (файл <code>ИНСТРУКЦИЯ.md</code>). Данные отсюда можно будет перенести: сохраните копию ниже и загрузите её после подключения.</p>`}
      </section>
      ${isDesktop ? '' : `<section class="card">
        <h2>Версия для компьютера</h2>
        <p class="small">На компьютере откройте <a href="desktop.html">${esc(location.origin + location.pathname.replace(/[^/]*$/, ''))}desktop.html</a>. Там меню недели таблицей с перетаскиванием, вставка рецептов и чеков через Ctrl+V, закладка для Instagram, печать, Excel и аналитика расходов. Данные те же.</p>
      </section>`}
      <section class="card">
        <h2>${isDesktop ? 'Установить на компьютер' : 'Установить на телефон'}</h2>
        ${matchMedia('(display-mode: standalone)').matches || navigator.standalone
          ? `<p>${icon('check')} Приложение уже установлено.</p>`
          : `${installPrompt ? `<button class="btn primary" data-act="install">${icon('download')}<span>Установить приложение</span></button>` : ''}
             <p class="small"><b>iPhone:</b> откройте сайт в Safari → кнопка «Поделиться» → «На экран „Домой“».<br>
             <b>Android:</b> Chrome → меню ⋮ → «Установить приложение» (или «Добавить на главный экран»).<br>
             <span class="muted">Установка работает, когда сайт открыт по адресу https://… (после публикации на GitHub Pages).</span></p>`}
      </section>
      <section class="card">
        <h2>Резервная копия</h2>
        <p class="muted small">Рецептов: ${c('recipes')} · дома: ${c('pantry')} · покупок: ${c('shopping')} · заготовок: ${c('preserves')} · своих ингредиентов: ${c('custom_ingredients')}</p>
        <div class="row wrap">
          <button class="btn" data-act="export">${icon('download')}<span>Сохранить копию (.json)</span></button>
          <label class="btn">${icon('upload')}<span>Загрузить копию</span><input type="file" accept=".json,application/json" data-act-change="import" hidden></label>
          <button class="btn" data-act="seed">${icon('book')}<span>Добавить блюда из «Меню недели»</span></button>
          ${seedTargets().length ? `<button class="btn primary" data-act="seed-full">${icon('book')}<span>Дополнить наши блюда полными рецептами (${seedTargets().length})</span></button>` : ''}
          ${(() => {
            const seeds = new Set((window.SEED_RECIPES || []).map((s) => U.norm(s[0])));
            const n = Store.all('recipes').filter((r) => seeds.has(U.norm(r.title)) && !(r.ingredients || []).some((i) => i.qty)).length;
            return n ? `<button class="btn primary" data-act="seed-qty">${icon('plus')}<span>Добавить количества в наши блюда (${n})</span></button>` : '';
          })()}
        </div>
      </section>
      <section class="card">
        <h2>Напоминания о сроках</h2>
        <p class="small">Предупреждение в приложении появляется за <b>${REMIND_DAYS}</b> ${U.plural(REMIND_DAYS, 'день', 'дня', 'дней')} до конца срока (меняется в <code>js/config.js</code>).
        ${cloud ? 'Ежедневные сообщения в Telegram настраиваются в GitHub (см. инструкцию).' : 'После подключения Supabase и GitHub будут приходить сообщения в Telegram.'}
        У каждой заготовки есть кнопка ${icon('cal', 'tiny')}: добавить напоминание в Google Календарь.</p>
      </section>
      <section class="card">
        <h2>Чеки: точные данные из ФНС</h2>
        <p class="small">С токеном сервиса <a href="https://proverkacheka.com" target="_blank" rel="noopener noreferrer">proverkacheka.com</a> приложение после фото само запрашивает чек в базе ФНС — по QR-коду или по реквизитам ФН/ФД/ФП внизу чека — и подставляет точные названия, количества и цены. Бесплатно — ограниченное число чеков в сутки. Как получить токен — в «ИНСТРУКЦИЯ.md», раздел «Чеки».</p>
        <form class="form" data-form="fns-token">
          <label>Токен<input name="token" type="password" autocomplete="off" value="${esc(fnsToken())}" placeholder="вставьте токен из личного кабинета"></label>
          <div class="row wrap"><button class="btn primary">Сохранить</button>${fnsToken() ? '<button type="button" class="btn" data-act="fns-clear">Убрать</button>' : ''}</div>
        </form>
        <p class="small ${fnsToken() ? 'ok-text' : 'muted'}">${fnsToken() ? `${icon('check', 'tiny')} Токен сохранён. Он хранится в вашей общей базе и виден только вам двоим.` : 'Токен не указан: позиции берутся только из распознавания фото.'}</p>
        ${ocrStatsHtml()}
        <button class="btn" data-act="ocr-bench">${icon('search')}<span>Проверить распознавание на своих чеках</span></button>
      </section>`;
  }

  // ---------- Наши блюда из «Меню недели»: состав (seed.js) + шаги (seed-steps.js) ----------
  const SEED_NOTE = 'Из нашей таблицы «Меню недели». Состав и количества типовые, поправьте под себя.';
  const seedMap = () => new Map((window.SEED_RECIPES || []).map((s) => [U.norm(s[0]), s]));
  const seedFull = (s) => {
    const x = (window.SEED_STEPS || {})[s[0]] || [];
    return { time: x[0] || '', ings: s[3] + (x[1] ? '; ' + x[1] : ''), steps: (x[2] || []).join('\n'), note: x[3] || '', url: (window.SEED_SOURCES || {})[s[0]] || '' };
  };
  const ingSig = (list) => (list || []).map((i) => U.norm(`${i.name} ${i.qty || ''} ${i.unit || ''}`)).join('|');
  // блюдо из таблицы для рецепта: по названию, а если его слегка переименовали — по тем же словам в любом порядке
  const titleKey = (s) => U.stems(String(s).replace(/\(.*?\)/g, ' ')).slice().sort().join(' ');
  let seedKeys = null;
  function seedFor(r) {
    const m = seedMap();
    const exact = m.get(U.norm(r.title));
    if (exact) return exact;
    if (!seedKeys) seedKeys = new Map((window.SEED_RECIPES || []).map((s) => [titleKey(s[0]), s]));
    const byWords = seedKeys.get(titleKey(r.title));
    if (byWords) return byWords;
    // опечатка или ё/е: «Голубцы ленивыe», «Ежики в томатно сметанном соусе»
    const n = U.norm(r.title).replace(/[^а-яa-z0-9]/g, '');
    if (n.length < 5) return null;
    let best = null, bd = Infinity;
    for (const s of window.SEED_RECIPES || []) {
      const k = U.norm(s[0]).replace(/[^а-яa-z0-9]/g, '');
      if (Math.abs(k.length - n.length) > 3) continue;
      const d = Receipt.lev(k, n);
      if (d < bd) { bd = d; best = s; }
    }
    return best && bd <= Math.max(1, Math.floor(n.length * 0.12)) ? best : null;
  }
  // наши блюда, в которых ещё нет шагов приготовления (auto — кроме тех, где шаги уже дописывались и их убрали)
  function seedTargets(auto) {
    return Store.all('recipes').filter((r) => {
      if (String(r.steps || '').trim() || (auto && r.seedSteps)) return false;
      const s = seedFor(r);
      return !!(s && seedFull(s).steps);
    });
  }
  // дописать шаги, время и недостающие ингредиенты; состав обновляется только там, где его не меняли
  async function applySeedSteps(targets) {
    let kept = 0;
    await Store.saveMany('recipes', targets.map((r) => {
      const s = seedFor(r), f = seedFull(s);
      const untouched = ingSig(r.ingredients) === ingSig(parseIngredients(s[3].split(';').join('\n')));
      if (!untouched) kept++;
      const notes = [String(r.notes || '').replace(SEED_NOTE, 'Рецепт типовой: количества и шаги можно поправить под себя.'), f.note].filter((x) => x && x.trim()).join('\n');
      return { ...r, steps: f.steps, time: r.time || f.time, servings: r.servings || servWord(s[2]), notes, seedSteps: true, url: r.url || f.url,
        ingredients: untouched ? parseIngredients(f.ings.split(';').join('\n')) : r.ingredients };
    }));
    return kept;
  }
  // Автоматически, один раз для каждого блюда: как только данные сверены с базой, дописываем шаги в наши блюда без шагов
  let seedBusy = false;
  async function autoSeedSteps() {
    if (seedBusy || needLogin || !Store.fresh || Store.status().pending) return;
    // наши блюда, где шаги уже есть, но ещё нет ссылки на рецепт-источник: добавляем её один раз
    const noLink = Store.all('recipes').filter((r) => !r.url && !r.seedUrl && String(r.steps || '').trim() && seedFor(r) && seedFull(seedFor(r)).url);
    if (noLink.length) {
      seedBusy = true;
      try { await Store.saveMany('recipes', noLink.map((r) => ({ ...r, url: seedFull(seedFor(r)).url, seedUrl: true }))); } catch (e) { console.error(e); } finally { seedBusy = false; }
    }
    const targets = seedTargets(true);
    if (!targets.length) return;
    seedBusy = true;
    try {
      await applySeedSteps(targets);
      toast(`В ${targets.length} ${U.plural(targets.length, 'блюдо', 'блюда', 'блюд')} из «Меню недели» дописаны шаги приготовления`);
    } catch (e) { console.error(e); } finally { seedBusy = false; }
  }

  // вывод по результатам проверки связи — простыми словами
  function diagVerdict(rows) {
    const by = (s) => rows.find((r) => r.name.startsWith(s));
    const site = by('Сайт'), small = by('База напрямую: короткий'), big = by('База напрямую: данные'), cf = by('Cloudflare'), lib = by('Библиотеки');
    const pSmall = by('Посредник: короткий'), pBig = by('Посредник: данные');
    const howTo = ' Решение — посредник в Яндекс Облаке (файл «ИНСТРУКЦИЯ Яндекс Облако.md»).';
    if (site && !site.ok && (!small || !small.ok) && (!pSmall || !pSmall.ok)) return '<b>Нет интернета.</b> Изменения сохраняются на устройстве и отправятся, когда сеть появится.';
    // посредник включён: синхронизация идёт через него, прямой доступ к базе уже не важен
    if (pSmall) {
      if (!pSmall.ok) return `<b>Посредник не отвечает</b> (${esc(pSmall.note)}). Проверьте адрес proxyUrl в js/config.js и спецификацию шлюза в Яндекс Облаке — по шагам в «ИНСТРУКЦИЯ Яндекс Облако.md», раздел «Если не заработало».`;
      if (pBig && !pBig.ok) return `<b>Посредник отвечает, но данные через него не идут</b> (${esc(pBig.note)}). Скорее всего, в спецификации шлюза не передаются заголовки или запрос с параметрами — см. «Если не заработало» в инструкции.`;
      return '<b>Посредник работает.</b> Синхронизация идёт через Яндекс Облако, VPN не нужен. Изменения второго человека появляются в течение 30 секунд.';
    }
    if (small && !small.ok) return '<b>База недоступна с этого интернета.</b> Сайт открывается, а Supabase не отвечает: похоже на блокировку у оператора. Без VPN синхронизация работать не будет; изменения копятся на устройстве и уйдут, когда связь с базой появится.' + howTo;
    if ((big && !big.ok) || (cf && !cf.ok)) return '<b>Оператор обрывает большие ответы от Cloudflare</b> (на нём работает Supabase): короткие запросы проходят, а загрузка данных — нет. Поэтому без VPN кажется, что синхронизации нет.' + howTo;
    if (lib && !lib.ok) return '<b>База доступна</b>, но не загружаются библиотеки с jsDelivr (нужны для загрузки рецептов из файлов). Синхронизации это не мешает.';
    const slow = rows.some((r) => r.ok && r.ms > 6000 && !r.name.startsWith('Распознавание'));
    return slow ? '<b>Связь есть, но медленная.</b> Синхронизация работает, просто дольше обычного.' : '<b>Всё доступно.</b> Синхронизация должна работать. Если сейчас включён VPN — повторите проверку без него.';
  }

  function viewLogin() {
    return `<div class="login card">
      <h1>Наша кухня</h1>
      <p class="muted">Войдите, чтобы открыть общие рецепты и списки</p>
      <form class="form" data-form="login">
        <label>Почта<input name="email" type="email" autocomplete="username" required autofocus></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="err" id="login-err"></p>
        <button class="btn primary block">Войти</button>
      </form>
    </div>`;
  }

  // =====================================================================
  // ДЕЙСТВИЯ
  // =====================================================================
  const actions = {
    close: () => closeModal(),
    set: (el) => { ui[el.dataset.k] = el.dataset.v; saveUI(); refresh(); },
    'toggle-staples': (el) => { ui.ignoreStaples = el.checked; saveUI(); refresh(); },

    'recipe-new': () => openModal(recipeForm(null)),
    'recipe-edit': (el) => openModal(recipeForm(Store.get('recipes', el.dataset.id))),
    'recipe-status': async (el) => {
      const r = Store.get('recipes', el.dataset.id);
      await Store.save('recipes', { ...r, status: el.dataset.v });
      if (el.dataset.v === 'liked') toast('Отмечено: понравилось');
    },
    'recipe-delete': async (el) => {
      const r = Store.get('recipes', el.dataset.id);
      if (!(await confirmBox(`Удалить рецепт «${r.title}»?`))) return;
      await Store.remove('recipes', r.id);
      location.hash = '#/recipes';
      toast('Рецепт удалён');
    },
    'recipe-to-shop': async (el) => {
      const r = Store.get('recipes', el.dataset.id);
      const a = analyze(r, [...pantry().map((p) => p.name), ...(route().name === 'match' ? ui.matchExtra || [] : [])]);
      const src = `r:${r.id}:${hasAdj(r) ? U.roundNice(scaleOf(r)) : ''}`;
      openPickItems(`Не хватает для «${r.title}»`, a.missing.map((i) => {
        const e = effIng(r, i, r.ingredients.indexOf(i));
        return { name: ingLabel(i), qty: e.qty, unit: e.unit === 'по вкусу' ? '' : e.unit, note: Measures.gramHint(ingLabel(i), e.qty, e.unit), src };
      }));
    },
    // один ингредиент рецепта: «есть дома» или «купить»
    'ing-home': async (el) => {
      const r = Store.get('recipes', el.dataset.id), i = r.ingredients[+el.dataset.i];
      await addToPantry(ingLabel(i), '', '');
      toast(`«${ingLabel(i)}»: есть дома`);
    },
    'ing-shop': async (el) => {
      const r = Store.get('recipes', el.dataset.id), i = r.ingredients[+el.dataset.i], e = effIng(r, i, +el.dataset.i);
      const g = Measures.gramHint(ingLabel(i), e.qty, e.unit);
      await addToShopping([{ name: ingLabel(i), qty: e.qty, unit: e.unit === 'по вкусу' ? '' : e.unit, note: [r.title, g].filter(Boolean).join(', '), src: `r:${r.id}:${hasAdj(r) ? U.roundNice(scaleOf(r)) : ''}` }]);
      toast(`«${ingLabel(i)}» в покупках`);
    },
    'pi-all': (el) => {
      el.closest('form').querySelectorAll(`input[type="radio"][value="${el.dataset.v}"]`).forEach((x) => { x.checked = true; });
    },
    'photo-clear': (el) => setFormPhoto(el.closest('form'), ''),
    'rc-del': (el) => {
      const f = el.closest('form');
      readReceiptForm(f);
      receiptDraft.items.splice(+el.dataset.i, 1);
      openModal(receiptForm(receiptDraft));
    },
    'rc-add': (el) => {
      readReceiptForm(el.closest('form'));
      receiptDraft.items.push({ name: '', orig: '', qty: '1', unit: 'шт', total: 0, on: true });
      openModal(receiptForm(receiptDraft));
      const rows = document.querySelectorAll('#modal .rc-row [name="n"]');
      if (rows.length) rows[rows.length - 1].focus();
    },
    'rc-fns': async (el) => {
      const d = readReceiptForm(el.closest('form'));
      el.disabled = true; el.textContent = 'запрашиваю…';
      await rcAskFns(d);
      openModal(receiptForm(d));
      toast(d.fns ? 'Позиции взяты из базы ФНС' : `ФНС: ${d.fnsError}`, d.fns ? '' : 'err');
    },
    'fns-clear': async () => {
      const cur = Store.get('settings', FNS_ID);
      if (cur) await Store.save('settings', { ...cur, token: '' });
      toast('Токен убран');
    },
    // проверка распознавания на своих чеках: выбрать фото → распознать → сверить с ФНС (или с «Итогом»)
    'ocr-bench': () => openModal(`<div class="form">
      <div class="form-head"><h2>Проверка распознавания</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <p class="small">Выберите фото нескольких чеков (каждое фото — отдельный чек). Приложение распознает их и сравнит ${fnsToken() ? 'с точными данными из ФНС' : 'с «Итогом» на чеке (с токеном ФНС сравнение будет точнее — по каждой позиции)'}. В покупки ничего не записывается.</p>
      ${fnsToken() ? '<p class="muted small">Каждый чек — один запрос к сервису проверки (бесплатно ограниченное число в сутки).</p>' : ''}
      <label class="btn primary block">${icon('camera')}<span>Выбрать фото чеков</span><input type="file" accept="image/*" multiple data-act-change="ocr-bench-files" hidden></label>
      <div id="bench-out">${ocrStatsHtml()}</div>
    </div>`),
    'rc-fit': (el) => {
      const f = el.closest('form');
      const d = readReceiptForm(f);
      const on = d.items.filter((i) => i.on && num2(i.total) > 0);
      const sum = on.reduce((s, i) => s + num2(i.total), 0);
      const target = rcTarget(d);
      if (!target || !sum || sum <= target) return;
      const k = target / sum;
      on.forEach((i) => { i.total = Math.round(num2(i.total) * k * 100) / 100; });
      // копейки от округления — на самую дорогую позицию
      const rest = Math.round((target - on.reduce((s, i) => s + i.total, 0)) * 100) / 100;
      if (rest) { const big = on.reduce((a, b) => (b.total > a.total ? b : a)); big.total = Math.round((big.total + rest) * 100) / 100; }
      openModal(receiptForm(d));
      toast('Скидка распределена по позициям');
    },
    'rc-lump': (el) => saveReceipt(el.closest('form'), true),
    'scan-note-ok': () => { scanCrashNote = ''; refresh(); },
    'rc-resume': () => { if (receiptDraft) { openModal(receiptForm(receiptDraft)); refresh(); } },
    'rc-drop': async () => {
      if (!(await confirmBox('Отбросить несохранённый чек? Правки в нём пропадут.', 'Отбросить'))) return;
      receiptDraft = null; rcKeepDraft(); refresh();
    },
    serv: (el) => {
      const r = Store.get('recipes', el.dataset.id), b = baseServings(r);
      if (!b) return;
      const cur = Math.round(b * scaleOf(r) * 2) / 2;
      const next = Math.max(1, Number(el.dataset.d) > 0 ? Math.floor(cur) + 1 : Math.ceil(cur) - 1);
      adjOf(r).f = next / b;
      refresh();
    },
    // ----- правка количеств -----
    'ing-amt': (el) => openModal(adjForm(Store.get('recipes', el.dataset.id), +el.dataset.i)),
    'adj-one': (el) => {
      const f = el.closest('form');
      const { r, n, qty, unit } = adjRead(f);
      if (!/^\d+(?:\.\d+)?(?:[-–]\d+(?:\.\d+)?)?$|^\d+\/\d+$/.test(qty)) { toast('Впишите число, например 150 или 1,5'); return; }
      adjOf(r).over[n] = { qty, unit };
      closeModal(); refresh();
    },
    'adj-one-reset': (el) => {
      const { r, n } = adjRead(el.closest('form'));
      if (adj[r.id]) delete adj[r.id].over[n];
      closeModal(); refresh();
    },
    'adj-reset': (el) => { delete adj[el.dataset.id]; refresh(); toast('Количества как в рецепте'); },
    'adj-limit': (el) => {
      const r = Store.get('recipes', el.dataset.id);
      adj[r.id] = { f: Math.max(0.05, Math.floor(parseFloat(el.dataset.f) * 100) / 100), over: {} };
      refresh();
    },
    'toggle-scale-steps': (el) => { ui.scaleSteps = el.checked; saveUI(); refresh(); },
    // дописать в наши блюда шаги приготовления, время и недостающие ингредиенты
    'seed-full': async () => {
      const targets = seedTargets();
      if (!targets.length) { toast('Все наши блюда уже с рецептами'); return; }
      if (!(await confirmBox(`Дописать шаги приготовления и время в ${targets.length} ${U.plural(targets.length, 'блюдо', 'блюда', 'блюд')} из «Меню недели»? Состав обновится только там, где вы его не меняли. Блюда, в которых шаги уже записаны, не изменятся.`, 'Дополнить'))) return;
      const kept = await applySeedSteps(targets);
      toast(`Рецепты дополнены: ${targets.length}${kept ? `. В ${kept} состав оставлен вашим` : ''}`);
    },
    'seed-qty': async () => {
      const seeds = new Map((window.SEED_RECIPES || []).map((s) => [U.norm(s[0]), s]));
      const targets = Store.all('recipes').filter((r) => seeds.has(U.norm(r.title)) && !(r.ingredients || []).some((i) => i.qty));
      if (!targets.length) { toast('Во всех наших блюдах количества уже есть'); return; }
      if (!(await confirmBox(`Добавить типовые количества в ${targets.length} ${U.plural(targets.length, 'блюдо', 'блюда', 'блюд')}? Рецепты, где вы уже вписали количества сами, не изменятся.`, 'Добавить'))) return;
      await Store.saveMany('recipes', targets.map((r) => {
        const s = seeds.get(U.norm(r.title));
        return { ...r, servings: r.servings || servWord(s[2]), ingredients: parseIngredients(s[3].split(';').join('\n')) };
      }));
      toast(`Количества добавлены: ${targets.length}`);
    },
    'recipe-import': async (el) => {
      const form = el.closest('form');
      const url = form.url.value.trim();
      if (!url) { toast('Сначала вставьте ссылку'); form.url.focus(); return; }
      if (!Store.canImport()) { toast('Загрузка по ссылке заработает после подключения Supabase. Пока заполните вручную.'); return; }
      el.disabled = true; el.classList.add('loading');
      try {
        const d = await Store.importRecipe(url);
        const many = (d.many || []).filter((r) => r.ingredients && r.ingredients.length);
        const links = d.links || [];
        const found = d.ingredients && d.ingredients.length >= 2;
        // на странице подборка рецептов — сразу предлагаем выбрать
        if (many.length >= 2) {
          pickPage = { source: url, items: many.map((r) => ({ ...r, kind: 'recipe' })) };
          renderPickPage(form, true);
          toast(`На странице ${many.length} ${U.plural(many.length, 'рецепт', 'рецепта', 'рецептов')}: выберите нужные`);
          return;
        }
        if (!found && links.length >= 3) {
          pickPage = { source: url, items: links.map((l) => ({ ...l, kind: 'link' })) };
          renderPickPage(form, true);
          toast('Это страница со списком рецептов: выберите нужные');
          return;
        }
        fillFromImport(form, d);
        // одиночный рецепт, но на странице есть ссылки на другие — можно открыть список
        if (links.length >= 3) { pickPage = { source: url, items: links.map((l) => ({ ...l, kind: 'link' })) }; renderPickPage(form, false); } else $('#rf-pick').innerHTML = '';
        toast(found ? 'Рецепт загружен, проверьте и сохраните' : 'Нашёл только название: ингредиенты на этом сайте не размечены, вставьте их вручную');
      } catch (e) { fail(e); } finally { el.disabled = false; el.classList.remove('loading'); }
    },
    'pick-show': (el) => renderPickPage(el.closest('form'), true),
    'pick-all': (el) => {
      const box = el.closest('#rf-pick'), all = [...box.querySelectorAll('input[data-pi]')];
      const on = !all.every((x) => x.checked);
      all.forEach((x) => { x.checked = on; });
      updatePickCount(box);
    },
    // один рецепт из списка — в открытую форму, чтобы проверить и сохранить
    'pick-one': async (el) => {
      const form = el.closest('form'), it = pickPage && pickPage.items[+el.dataset.i];
      if (!it) return;
      el.disabled = true; el.classList.add('loading');
      try {
        const d = it.kind === 'link' ? await Store.importRecipe(it.url) : it;
        fillFromImport(form, { ...d, image: d.image || it.image, title: d.title || it.title }, true);
        form.url.value = it.kind === 'link' ? it.url : pickPage.source;
        $('#rf-pick').innerHTML = `<p class="small muted">«${esc(form.title.value)}» в форме. <button type="button" class="linklike" data-act="pick-show">Вернуться к списку</button></p>`;
        form.title.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (e) { fail(e); } finally { el.disabled = false; el.classList.remove('loading'); }
    },
    // отмеченные — сразу в «Не пробовали»
    'pick-save': async (el) => {
      const box = el.closest('#rf-pick');
      const chosen = [...box.querySelectorAll('input[data-pi]:checked')].map((x) => pickPage.items[+x.dataset.pi]).filter(Boolean);
      if (!chosen.length) { toast('Отметьте рецепты галочками'); return; }
      el.disabled = true;
      const done = [], failed = [];
      let host = '';
      try { host = new URL(pickPage.source).hostname.replace(/^www\./, ''); } catch (e) { /* без адреса */ }
      for (const [n, it] of chosen.entries()) {
        el.textContent = `Добавляю ${n + 1} из ${chosen.length}…`;
        try {
          const d = it.kind === 'link' ? await Store.importRecipe(it.url) : it;
          if (!d.ingredients || !d.ingredients.length) { failed.push(it.title); continue; }
          done.push(recipeFromImport({ ...d, title: d.title || it.title, image: d.image || it.image }, it.kind === 'link' ? it.url : pickPage.source, host));
        } catch (e) { failed.push(it.title); }
      }
      if (done.length) await Store.saveMany('recipes', done);
      closeModal();
      toast(`Добавлено рецептов: ${done.length}${failed.length ? `. Не получилось: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}` : ''}`, failed.length && !done.length ? 'err' : '');
      if (done.length) { ui.rStatus = 'new'; saveUI(); location.hash = '#/recipes'; refresh(); }
    },

    'cooked-open': (el) => openModal(cookedForm(Store.get('recipes', el.dataset.id))),
    'cooked-undo': async (el) => {
      const r = Store.get('recipes', el.dataset.id);
      const last = lastCooked(r);
      if (!(await confirmBox(`Убрать запись «готовили ${U.fmtDate(last)}»? Списанные продукты не вернутся, их можно добавить в «Есть дома» вручную.`, 'Убрать'))) return;
      const cooked = [...r.cooked];
      cooked.splice(cooked.lastIndexOf(last), 1);
      await Store.save('recipes', { ...r, cooked });
    },
    'cook-ing': (el) => {
      const n = +el.dataset.i;
      if (cookState.done.has(n)) cookState.done.delete(n); else cookState.done.add(n);
      el.classList.toggle('done');
    },
    'cook-step': (el, e) => {
      if (e.target.closest('.timer-btn')) return;
      cookState.step = +el.dataset.i; refresh();
    },
    'cook-go': (el) => {
      const r = Store.get('recipes', cookState.id);
      const max = recipeSteps(r).length - 1;
      cookState.step = Math.max(0, Math.min(max, cookState.step + Number(el.dataset.d)));
      refresh(); scrollToCurrentStep();
    },
    'timer-start': (el) => { startTimer(+el.dataset.sec, el.dataset.label); toast('Таймер запущен'); },
    'timer-stop': (el) => { timers = timers.filter((t) => String(t.id) !== el.dataset.id); renderTimers(); },
    'shop-share': async () => {
      const todo = Store.all('shopping').filter((s) => s.status !== 'bought')
        .sort((a, b) => catOf(a.name).localeCompare(catOf(b.name), 'ru') || a.name.localeCompare(b.name, 'ru'));
      let text = `🛒 Купить (${todo.length})\n`, last = '';
      for (const s of todo) {
        const c = catOf(s.name);
        if (c !== last) { text += `\n${c}\n`; last = c; }
        text += `• ${s.name}${s.qty || s.unit ? ' — ' + U.fmtQty(s.qty, s.unit) : ''}\n`;
      }
      text = text.trim();
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(text); toast('Список скопирован, вставьте его в мессенджер'); }
      catch (e) {
        openModal(`<div class="form"><div class="form-head"><h2>Список покупок</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
          <textarea rows="14" readonly>${esc(text)}</textarea><p class="muted small">Выделите текст и скопируйте.</p></div>`);
      }
    },
    'recipe-to-menu': (el) => {
      const r = Store.get('recipes', el.dataset.id);
      const slot = r.category === 'Завтраки' ? 'breakfast' : r.category === 'Супы' ? 'lunch' : 'dinner';
      openModal(`<form class="form" data-form="recipe-menu">
        <div class="form-head"><h2>В меню: ${esc(r.title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
        <input type="hidden" name="rid" value="${esc(r.id)}">
        <div class="grid2"><label>День<input type="date" name="date" value="${U.today()}" required></label>
        <label>Когда<select name="slot">${SLOTS.map(([k, l]) => `<option value="${k}" ${k === slot ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Добавить</button></div></form>`);
    },
    seed: async () => {
      const existing = new Set(Store.all('recipes').map((r) => U.norm(r.title)));
      const list = (window.SEED_RECIPES || []).filter(([t]) => !existing.has(U.norm(t))).map((s) => {
        const f = seedFull(s);
        return { title: s[0], category: s[1], status: 'liked', url: f.url, image: '', servings: servWord(s[2]), time: f.time, steps: f.steps, seedSteps: true,
          notes: [SEED_NOTE, f.note].filter(Boolean).join('\n'), ingredients: parseIngredients(f.ings.split(';').join('\n')) };
      });
      if (!list.length) { toast('Все блюда из таблицы уже добавлены'); return; }
      await Store.saveMany('recipes', list);
      toast(`Добавлено блюд: ${list.length}`);
    },

    week: (el) => { ui.menuWeek = el.dataset.d === '0' ? 0 : (ui.menuWeek || 0) + Number(el.dataset.d); saveUI(); refresh(); },
    'menu-pick': (el) => openPicker(el.dataset.date, el.dataset.slot),
    'pick-cat': (el) => {
      const box = el.closest('.picker');
      box.dataset.cat = el.dataset.cat;
      box.querySelectorAll('[data-act="pick-cat"]').forEach((b) => b.classList.toggle('on', b === el));
      $('#pick-q', box).value = '';
      renderPickList();
    },
    'pick-text': async (el) => {
      const box = el.closest('.picker');
      await addDish(box.dataset.date, box.dataset.slot, { text: el.dataset.text });
      closeModal();
    },
    // блюдо без рецепта в меню: можно сразу завести рецепт, и в меню оно станет ссылкой
    'menu-text-dish': (el) => {
      const day = menuDay(el.dataset.date);
      const x = (day[el.dataset.slot] || [])[+el.dataset.j];
      if (!x) return;
      openModal(`<div class="form">
        <div class="form-head"><h2>${esc(x.text)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
        <p class="muted">Блюдо без рецепта. Можно завести для него рецепт, и в меню оно станет ссылкой на рецепт.</p>
        <div class="form-actions"><button type="button" class="btn" data-act="close">Закрыть</button>
          <button type="button" class="btn primary" data-act="menu-text-to-recipe" data-date="${el.dataset.date}" data-slot="${el.dataset.slot}" data-j="${el.dataset.j}">${icon('plus')}<span>Создать рецепт</span></button></div>
      </div>`);
    },
    'menu-text-to-recipe': (el) => {
      const x = (menuDay(el.dataset.date)[el.dataset.slot] || [])[+el.dataset.j];
      openModal(recipeForm({ title: x ? x.text : '', status: 'new', linkMenu: `${el.dataset.date}|${el.dataset.slot}|${el.dataset.j}` }));
    },
    pick: async (el) => {
      const box = el.closest('.picker');
      await addDish(box.dataset.date, box.dataset.slot, { rid: el.dataset.rid });
      closeModal();
    },
    'menu-del': async (el) => {
      const day = menuDay(el.dataset.date);
      const list = [...(day[el.dataset.slot] || [])];
      list.splice(+el.dataset.j, 1);
      await Store.save('menu', { ...day, [el.dataset.slot]: list });
    },
    'menu-autofill': async () => {
      if (!Store.all('recipes').length) { toast('Сначала добавьте блюда в «Рецепты»'); return; }
      const n = await autofillWeek();
      toast(n ? `Заполнено дней: ${n}` : 'Пустых мест нет (или нет блюд нужных категорий)');
    },
    'menu-shop': async () => {
      const items = await weekToShopping();
      if (!items.length) { toast('Для меню всё есть дома'); return; }
      openPickItems(`Продукты для меню (${items.length})`, items);
    },
    'menu-clear': async () => {
      const days = weekDays(ui.menuWeek || 0);
      if (!(await confirmBox('Очистить меню этой недели?', 'Очистить'))) return;
      for (const d of days) if (Store.get('menu', menuId(d))) await Store.remove('menu', menuId(d));
    },

    'match-del': (el) => { ui.matchExtra.splice(+el.dataset.i, 1); saveUI(); refresh(); },
    'match-clear': () => { ui.matchExtra = []; saveUI(); refresh(); },

    'pantry-edit': (el) => {
      const p = Store.get('pantry', el.dataset.id);
      openModal(`<form class="form" data-form="pantry-edit">
        <div class="form-head"><h2>Есть дома</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
        <input type="hidden" name="id" value="${esc(p.id)}">
        <label>Продукт<input name="name" data-suggest required value="${esc(p.name)}"></label>
        <div class="grid2"><label>Количество<input name="qty" inputmode="decimal" value="${esc(p.qty || '')}" autofocus></label>
        <label>Единица${unitSelect(p.unit)}</label></div>
        <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
    },
    'pantry-out': async (el) => {
      const p = Store.get('pantry', el.dataset.id);
      await addToShopping([{ name: p.name, unit: p.unit }]);
      await Store.remove('pantry', p.id);
      toast(`«${p.name}» закончилось, добавлено в покупки`);
    },
    'pantry-del': async (el) => { await Store.remove('pantry', el.dataset.id); },
    'cat-home': (el) => openQtyDialog(el.dataset.n, 'home'),
    'cat-shop': (el) => openQtyDialog(el.dataset.n, 'shop'),
    sync: async (el) => {
      if (Store.mode !== 'cloud') return;
      const badge = $('#mode');
      badge.classList.add('busy'); badge.textContent = 'синхронизация…';
      if (el !== badge) el.disabled = true;
      try {
        const n = await Store.syncNow();
        toast(n ? `Отправлено изменений: ${n}. Данные обновлены` : 'Данные обновлены');
      } catch (e) { toast(e.message || String(e), 'err'); }
      finally { badge.classList.remove('busy'); el.disabled = false; refresh(); }
    },
    // что с этого устройства доступно прямо сейчас (чтобы понять, почему без VPN не синхронизируется)
    diag: async () => {
      const rowsHtml = (rows, done) => `<div class="form">
        <div class="form-head"><h2>Проверка связи</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
        <ul class="diag">${rows.map((r) => `<li class="${r.ok ? (r.ms > (r.name.startsWith('Распознавание') ? 30000 : 6000) ? 'slow' : 'ok') : 'bad'}"><span class="dot">${icon(r.ok ? 'check' : 'x')}</span>
          <span><b>${esc(r.name)}</b><br><small>${r.ok ? `${(r.ms / 1000).toFixed(1).replace('.', ',')} с${r.kb ? ` · ${String(r.kb).replace('.', ',')} КБ` : ''}${r.ms > (r.name.startsWith('Распознавание') ? 30000 : 6000) ? ' · медленно' : ''}` : esc(r.note)}</small></span></li>`).join('')}</ul>
        <p class="${done ? '' : 'muted'}">${done ? diagVerdict(rows) : 'Проверяю… это до минуты.'}</p>
        ${done ? `<p class="muted small">Сделайте проверку без VPN и с VPN — по разнице видно, что режет оператор.</p>` : ''}
      </div>`;
      openModal(rowsHtml([], false));
      const rows = await Store.diagnose((part) => { if ($('#modal').open && $('.diag')) openModal(rowsHtml(part, false)); });
      // распознавание чеков: загрузить нейросеть и прочитать короткую строку
      if (window.OCR) {
        if ($('#modal').open && $('.diag')) openModal(rowsHtml(rows, false));
        const row = { name: 'Распознавание чеков (нейросеть)', ok: false, ms: 0, kb: 0, note: '' }, t0 = performance.now();
        try {
          await OCR.load();
          const c = document.createElement('canvas'); c.width = 520; c.height = 80;
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = '#111'; x.font = '34px monospace'; x.fillText('МОЛОКО 2.5% 85.99', 16, 52);
          const r = await OCR.read(c);
          const text = r.lines.map((L) => L.parts.map((b) => b.text).join(' ')).join(' ');
          row.ok = /85[.,]99/.test(text);
          row.note = row.ok ? '' : `прочитано неверно: «${text || 'пусто'}»`;
        } catch (e) { row.note = String((e && e.message) || e); }
        row.ms = Math.round(performance.now() - t0);
        rows.push(row);
      }
      if ($('#modal').open && $('.diag')) openModal(rowsHtml(rows, true));
    },
    'custom-del': async (el) => {
      const c = Store.get('custom_ingredients', el.dataset.id);
      if (await confirmBox(`Удалить «${c.name}» из справочника?`)) await Store.remove('custom_ingredients', c.id);
    },

    'shop-buy': async (el) => {
      const s = Store.get('shopping', el.dataset.id);
      el.classList.add('done');
      await Store.save('shopping', { ...s, status: 'bought', bought_on: U.today() });
      await addToPantry(s.name, s.qty, s.unit);
      toast(`Куплено: ${s.name}`);
    },
    'shop-buy-all': async () => {
      const todo = Store.all('shopping').filter((s) => s.status !== 'bought');
      if (!(await confirmBox(`Отметить купленным всё (${todo.length})?`, 'Да, купили'))) return;
      await Store.saveMany('shopping', todo.map((s) => ({ ...s, status: 'bought', bought_on: U.today() })));
      for (const s of todo) await addToPantry(s.name, s.qty, s.unit);
      toast('Всё куплено и добавлено в «Есть дома»');
    },
    'shop-edit': (el) => openModal(shopForm(Store.get('shopping', el.dataset.id))),
    'shop-del': async (el) => { await Store.remove('shopping', el.dataset.id); },
    'shop-again': async (el) => {
      const n = await addToShopping([{ name: el.dataset.n, qty: el.dataset.q, unit: el.dataset.u }]);
      toast(n ? `«${el.dataset.n}» в покупках` : 'Уже есть в списке');
    },

    'preserve-new': () => openModal(preserveForm({})),
    'preserve-edit': (el) => openModal(preserveForm(Store.get('preserves', el.dataset.id))),
    'preserve-from-recipe': (el) => {
      const r = Store.get('recipes', el.dataset.id);
      const savva = r.category === 'Детское (Савва)';
      if (savva) ui.presOwner = 'savva';
      openModal(preserveForm({ name: r.title, recipe_id: r.id, owner: savva ? 'savva' : 'family', kind: r.category === 'Заготовки' ? 'jar' : 'freeze' }));
    },
    'qty-step': async (el) => {
      const kind = el.dataset.kind, it = Store.get(kind, el.dataset.id);
      if (!it) return;
      const dir = Number(el.dataset.d), next = stepQty(it.qty, it.unit, dir);
      if (next <= 0) {
        if (kind === 'pantry') {
          if (await confirmBox(`«${it.name}» закончилось? Убрать из «Есть дома»?`, 'Убрать')) await Store.remove('pantry', it.id);
        } else toast('Меньше уже некуда. Чтобы убрать из списка, нажмите корзину');
        return;
      }
      await Store.save(kind, { ...it, qty: U.fmtNum(next) });
    },
    'preserve-dec': async (el) => {
      const p = Store.get('preserves', el.dataset.id);
      const q = Math.max(0, (parseFloat(p.qty) || 0) - 1);
      if (q === 0) {
        if (!(await confirmBox(`«${p.name}» закончилось?`, 'Да, закончилось'))) return;
        await Store.save('preserves', { ...p, qty: '0', finished: true });
      } else await Store.save('preserves', { ...p, qty: String(q) });
    },
    'preserve-inc': async (el) => {
      const p = Store.get('preserves', el.dataset.id);
      await Store.save('preserves', { ...p, qty: String((parseFloat(p.qty) || 0) + 1) });
    },
    'preserve-finish': async (el) => {
      const p = Store.get('preserves', el.dataset.id);
      await Store.save('preserves', { ...p, finished: true });
      toast(`«${p.name}» перенесено в «Израсходовано»`);
    },
    'preserve-restore': async (el) => {
      const p = Store.get('preserves', el.dataset.id);
      await Store.save('preserves', { ...p, finished: false, qty: parseFloat(p.qty) > 0 ? p.qty : '1' });
    },
    'preserve-copy': (el) => {
      const p = Store.get('preserves', el.dataset.id);
      openModal(preserveForm({ name: p.name, kind: p.kind, owner: p.owner, unit: p.unit, place: p.place, notes: p.notes, recipe_id: p.recipe_id }));
    },
    'preserve-del': async (el) => {
      const p = Store.get('preserves', el.dataset.id);
      if (await confirmBox(`Удалить «${p.name}» насовсем?`)) await Store.remove('preserves', p.id);
    },
    shelf: (el) => {
      const f = el.closest('form');
      const made = f.made_on.value || U.today();
      f.expires_on.value = +el.dataset.d ? U.addDays(made, +el.dataset.d) : U.addMonths(made, +el.dataset.m);
      f.expires_on.removeAttribute('data-auto');
      f.querySelectorAll('[data-act="shelf"]').forEach((b) => b.classList.toggle('on', b === el));
    },

    export: () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nasha-kuhnya-${U.today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    logout: () => Store.logout(),
    install: async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      refresh();
    },
  };

  const forms = {
    recipe: async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      const prev = fd.id ? Store.get('recipes', fd.id) : {};
      const rec = {
        ...prev,
        id: fd.id || undefined,
        title: fd.title.trim(), url: fd.url.trim(), category: fd.category, status: fd.status || 'new',
        servings: fd.servings.trim(), time: fd.time.trim(), image: fd.image.trim(),
        ingredients: parseIngredients(fd.ingredients), steps: fd.steps.trim(), notes: fd.notes.trim(),
      };
      const saved = await Store.save('recipes', rec);
      // рецепт заведён для блюда из меню — в меню ставим ссылку на него вместо текста
      if (fd.link_menu) {
        const [date, slot, j] = fd.link_menu.split('|');
        const src = (menuDay(date)[slot] || [])[+j];
        // все одноимённые блюда без рецепта во всём меню становятся ссылкой на новый рецепт
        const names = new Set([U.norm(saved.title), src && src.text ? U.norm(src.text) : ''].filter(Boolean));
        const changed = Store.all('menu').map((day) => {
          let hit = false;
          const upd = { ...day };
          SLOTS.forEach(([k]) => { upd[k] = (day[k] || []).map((x) => (x.text && names.has(U.norm(x.text)) ? (hit = true, { rid: saved.id }) : x)); });
          return hit ? upd : null;
        }).filter(Boolean);
        if (changed.length) await Store.saveMany('menu', changed);
      }
      closeModal();
      location.hash = '#/recipe/' + encodeURIComponent(saved.id);
      toast('Рецепт сохранён');
    },
    cooked: (f) => saveCooked(f),
    adj: (f) => adjScale(f),
    'fns-token': async (f) => {
      const token = f.token.value.trim();
      if (token && !/^[\w.-]{8,}$/.test(token)) { toast('Похоже, это не токен: вставьте его целиком, без пробелов', 'err'); return; }
      await Store.save('settings', { ...(Store.get('settings', FNS_ID) || {}), id: FNS_ID, token });
      toast(token ? 'Токен сохранён: следующие чеки будут сверяться с ФНС' : 'Токен убран');
    },
    'pick-items': async (f) => {
      const buy = [], home = [];
      pickItemsData.forEach((it, i) => {
        const act = (f.querySelector(`input[name="a${i}"]:checked`) || {}).value;
        const qty = f[`q${i}`].value.trim().replace('.', ','), unit = f[`u${i}`].value;
        if (act === 'buy') buy.push({ ...it, qty, unit });
        else if (act === 'home') home.push({ ...it, qty, unit });
      });
      const n = buy.length ? await addToShopping(buy) : 0;
      // количество в строке — сколько нужно купить; для «есть дома» его не записываем
      for (const it of home) await addToPantry(it.name, '', '');
      closeModal();
      toast([n ? `в покупки: ${n}` : '', home.length ? `есть дома: ${home.length}` : ''].filter(Boolean).join(', ') || 'Ничего не выбрано');
    },
    receipt: (f) => saveReceipt(f, false),
    'cat-qty': async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      const qty = fd.qty.trim().replace('.', ',');
      if (fd.target === 'home') await addToPantry(fd.name, qty, fd.unit);
      else await addToShopping([{ name: fd.name, qty, unit: fd.unit }]);
      closeModal();
      toast(`«${fd.name}»${qty ? ' ' + U.fmtQty(qty, fd.unit) : ''}: ${fd.target === 'home' ? 'есть дома' : 'в покупках'}`);
    },
    'menu-text': async (f) => {
      const box = f.closest('.picker');
      const text = f.text.value.trim();
      if (!text) return;
      // если такой рецепт есть — ставим рецепт, иначе просто текст
      const r = Store.all('recipes').find((x) => U.norm(x.title) === U.norm(text));
      await addDish(box.dataset.date, box.dataset.slot, r ? { rid: r.id } : { text });
      closeModal();
    },
    'recipe-menu': async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      await addDish(fd.date, fd.slot, { rid: fd.rid });
      closeModal();
      toast(`Добавлено в меню на ${U.fmtDate(fd.date)}`);
    },
    'match-add': (f) => {
      const n = f.name.value.trim();
      if (!n) return;
      ui.matchExtra = [...(ui.matchExtra || []).filter((x) => U.norm(x) !== U.norm(n)), n];
      saveUI(); f.reset(); refresh();
    },
    'pantry-add': async (f) => {
      await addToPantry(f.name.value, f.qty.value.trim(), f.unit.value.trim());
      f.reset();
      $('#p-name') && $('#p-name').focus();
    },
    'pantry-edit': async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      const p = Store.get('pantry', fd.id);
      await Store.save('pantry', { ...p, name: fd.name.trim(), qty: fd.qty.trim(), unit: fd.unit.trim(), updated_on: U.today() });
      closeModal();
    },
    'custom-add': async (f) => {
      const name = f.name.value.trim();
      if (catalog().some((c) => U.norm(c.name) === U.norm(name))) { toast('Такой уже есть в справочнике'); return; }
      await Store.save('custom_ingredients', { name, cat: f.cat.value });
      ui.prodQ = name; saveUI();
      toast(`«${name}» добавлен в справочник`);
    },
    'shop-add': async (f) => {
      const n = await addToShopping([{ name: f.name.value.trim(), qty: f.qty.value.trim(), unit: f.unit.value.trim() }]);
      if (!n) toast('Уже есть в списке');
      f.reset();
      $('#s-name') && $('#s-name').focus();
    },
    'shop-edit': async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      const s = Store.get('shopping', fd.id);
      await Store.save('shopping', { ...s, ...fd, name: fd.name.trim() });
      closeModal();
    },
    preserve: async (f) => {
      const fd = Object.fromEntries(new FormData(f));
      const prev = fd.id ? Store.get('preserves', fd.id) : {};
      const p = { ...prev, ...fd, id: fd.id || undefined, name: fd.name.trim(), finished: prev.finished || false };
      if (!p.recipe_id) delete p.recipe_id;
      await Store.save('preserves', p);
      ui.presOwner = p.owner; saveUI();
      closeModal();
      if (route().name !== 'preserves') location.hash = '#/preserves';
      toast('Сохранено');
    },
    login: async (f) => {
      const err = $('#login-err');
      err.textContent = '';
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        await Store.login(f.email.value.trim(), f.password.value);
        needLogin = false;
        render();
      } catch (e) {
        err.textContent = /invalid/i.test(e.message) ? 'Неверная почта или пароль' : e.message;
      } finally { btn.disabled = false; }
    },
  };

  // ---------- Делегирование событий ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' && el.type === 'file') return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'INPUT') e.preventDefault();
    Promise.resolve(fn(el, e)).catch(fail);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    const fn = forms[f.dataset.form];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(f)).catch(fail);
  });
  let inputTimer;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input) {
      ui[el.dataset.input] = el.value; saveUI();
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => {
        const r = route().name;
        const list = $('#list');
        if (!list) return;
        if (r === 'recipes') list.innerHTML = recipesList();
        else if (r === 'products') list.innerHTML = catalogList();
        else if (r === 'shopping') list.innerHTML = shopHistory();
      }, 120);
    }
    if (el.id === 'pick-q') renderPickList();
    // экран проверки чека: сумма пересчитывается на лету
    const rf = el.closest && el.closest('form.receipt');
    if (rf && receiptDraft && (el.name === 'p' || el.name === 'on')) {
      readReceiptForm(rf);
      const row = el.closest('.rc-row');
      if (row) row.classList.toggle('off', !row.querySelector('[name="on"]').checked);
      const box = $('#rc-sum');
      if (box) box.innerHTML = receiptSumHtml(receiptDraft);
    }
    if (el.name === 'expires_on') el.removeAttribute('data-auto');
    if (el.dataset.pi !== undefined) updatePickCount(el.closest('#rf-pick'));
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.change) { ui[el.dataset.change] = el.value; saveUI(); refresh(); }
    if (el.hasAttribute('data-shelf-src')) {
      const f = el.form, exp = f.expires_on;
      if (exp.dataset.auto) exp.value = U.addMonths(f.made_on.value || U.today(), defaultShelf(f.kind.value, f.owner.value));
    }
    if (el.dataset.actChange === 'recipe-files' && el.files.length) {
      const files = [...el.files];
      el.value = '';
      importRecipeFiles(files).catch(fail);
    }
    if (el.dataset.actChange === 'recipe-file' && el.files.length) {
      const file = el.files[0], f = el.form, st = $('#rf-status');
      el.value = '';
      const label = el.closest('label'); if (label) label.classList.add('loading');
      if (st) st.textContent = 'Читаю файл…';
      RecipeImport.fromFile(file, (p) => { if (st) st.textContent = `Распознаю текст… ${Math.round(p * 100)}%`; })
        .then((d) => {
          fillRecipeForm(f, d);
          if (st) st.textContent = `Из «${file.name}»: ингредиентов ${d.ingredients.length}, шагов ${d.steps.length}. Проверьте и сохраните.`;
        })
        .catch((e) => { if (st) st.textContent = e.message || String(e); fail(e); })
        .finally(() => { if (label) label.classList.remove('loading'); });
    }
    if (el.dataset.actChange === 'ocr-bench-files' && el.files.length) {
      const files = [...el.files];
      el.value = '';
      runOcrBench(files).catch(fail);
    }
    if (el.dataset.actChange === 'receipt' && el.files.length) {
      const files = [...el.files];
      el.value = '';
      openReceiptScan(files);
    }
    if (el.dataset.price) {
      const s = Store.get('shopping', el.dataset.price);
      const v = el.value.trim().replace(/\s/g, '').replace('.', ',');
      if (s && v !== String(s.price || '')) Store.save('shopping', { ...s, price: v }).catch(fail);
    }
    if ((el.dataset.actChange === 'photo-form' || el.dataset.actChange === 'photo-recipe') && el.files[0]) {
      const file = el.files[0];
      const label = el.closest('label');
      if (label) label.classList.add('loading');
      toast('Загружаю фото…');
      compressImage(file)
        .then((blob) => Store.uploadPhoto(blob))
        .then(async (url) => {
          if (el.dataset.actChange === 'photo-form') setFormPhoto(el.form, url);
          else {
            const r = Store.get('recipes', el.dataset.id);
            await Store.save('recipes', { ...r, image: url });
          }
          toast('Фото добавлено');
        })
        .catch(fail)
        .finally(() => { if (label) label.classList.remove('loading'); el.value = ''; });
    }
    if (el.dataset.actChange === 'import' && el.files[0]) {
      el.files[0].text().then(async (txt) => {
        if (!(await confirmBox('Загрузить данные из копии? Совпадающие записи обновятся, остальные добавятся.', 'Загрузить'))) return;
        const n = await Store.importJSON(txt);
        toast(`Загружено записей: ${n}`);
      }).catch(fail).finally(() => (el.value = ''));
    }
  });
  // ---------- Подсказки из справочника при вводе продукта (поля с data-suggest) ----------
  // Свой список вместо <datalist>: на телефонах datalist показывается плохо или не показывается.
  const sug = { box: null, input: null, items: [], idx: -1 };
  function suggestFor(q) {
    const n = U.norm(q);
    if (!n) return [];
    const scored = [];
    for (const c of catalog()) {
      const cn = U.norm(c.name);
      let s = -1;
      if (cn.startsWith(n)) s = 0;                                  // «майо» → майонез
      else if (cn.split(/[\s-]+/).some((w) => w.startsWith(n))) s = 1; // «сливоч» → масло сливочное
      else if (cn.includes(n)) s = 2;
      if (s >= 0) scored.push({ c, s, len: cn.length });
    }
    return scored.sort((a, b) => a.s - b.s || a.len - b.len).slice(0, 8).map((x) => x.c);
  }
  function markMatch(name, q) {
    const i = U.norm(name).indexOf(U.norm(q));
    if (i < 0 || !q) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
  }
  function hideSuggest() {
    if (sug.box) sug.box.remove();
    sug.box = null; sug.input = null; sug.items = []; sug.idx = -1;
  }
  function placeSuggest() {
    if (!sug.box || !sug.input) return;
    if (!document.contains(sug.input)) { hideSuggest(); return; }
    const r = sug.input.getBoundingClientRect();
    Object.assign(sug.box.style, { left: r.left + 'px', top: r.bottom + 4 + 'px', width: Math.max(r.width, 220) + 'px' });
  }
  function showSuggest(input) {
    const items = suggestFor(input.value);
    if (!items.length || (items.length === 1 && U.norm(items[0].name) === U.norm(input.value))) { hideSuggest(); return; }
    if (sug.input !== input) { hideSuggest(); sug.input = input; }
    sug.items = items;
    sug.idx = Math.min(sug.idx, items.length - 1);
    if (!sug.box) {
      sug.box = document.createElement('div');
      sug.box.className = 'suggest';
      sug.box.setAttribute('role', 'listbox');
      sug.box.addEventListener('pointerdown', (e) => e.preventDefault()); // не терять фокус поля
      sug.box.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pickSuggest(+b.dataset.i); });
      (input.closest('dialog') || document.body).appendChild(sug.box);
    }
    const homeMap = new Map(pantry().map((p) => [U.norm(p.name), p]));
    sug.box.innerHTML = items.map((c, i) => {
      const h = homeMap.get(U.norm(c.name));
      return `<button type="button" role="option" data-i="${i}" class="${i === sug.idx ? 'on' : ''}">
        <span>${markMatch(c.name, input.value.trim())}</span><small>${esc(c.cat)}${h ? ' · дома' + (h.qty || h.unit ? ': ' + esc(U.fmtQty(h.qty, h.unit)) : '') : ''}</small></button>`;
    }).join('');
    placeSuggest();
  }
  function pickSuggest(i) {
    const input = sug.input, c = sug.items[i];
    if (!input || !c) return;
    input.value = c.name;
    hideSuggest();
    // курсор сразу в количество, если оно есть рядом
    const next = input.form && input.form.elements.qty;
    if (next) next.focus(); else input.focus();
  }
  document.addEventListener('input', (e) => { if (e.target.hasAttribute && e.target.hasAttribute('data-suggest')) showSuggest(e.target); });
  document.addEventListener('focusin', (e) => { if (e.target.hasAttribute && e.target.hasAttribute('data-suggest') && e.target.value) showSuggest(e.target); });
  document.addEventListener('focusout', (e) => { if (e.target === sug.input) setTimeout(() => { if (document.activeElement !== sug.input) hideSuggest(); }, 200); });
  document.addEventListener('keydown', (e) => {
    if (!sug.box || e.target !== sug.input) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = sug.items.length;
      if (e.key === 'ArrowDown') sug.idx = sug.idx + 1 >= n ? -1 : sug.idx + 1;
      else sug.idx = sug.idx - 1 < -1 ? n - 1 : sug.idx - 1;
      showSuggest(sug.input);
    } else if (e.key === 'Enter' && sug.idx >= 0) {
      e.preventDefault(); pickSuggest(sug.idx);
    } else if (e.key === 'Escape') hideSuggest();
  });
  window.addEventListener('scroll', placeSuggest, true);
  window.addEventListener('resize', placeSuggest);
  $('#modal').addEventListener('close', hideSuggest);

  // клик по фону закрывает окно — но не форму, в которой уже что-то правили, и не проверку чека:
  // на телефоне по фону часто тыкают, чтобы убрать клавиатуру, и правки терялись
  $('#modal').addEventListener('input', () => { $('#modal').dataset.dirty = '1'; });
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id !== 'modal') return;
    const d = $('#modal');
    if (d.dataset.dirty || d.querySelector('form.receipt, [data-keep]')) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    closeModal();
  });
  // Enter в полях чека переходит к следующему полю, а не сохраняет чек раньше времени
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    const el = e.target, f = el.closest && el.closest('form.receipt');
    if (!f || el.tagName !== 'INPUT') return;
    e.preventDefault();
    const fields = [...f.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]):not([readonly]), select')].filter((x) => !x.disabled && x.offsetParent);
    const next = fields[fields.indexOf(el) + 1];
    if (next && next.tagName === 'INPUT') next.focus(); else el.blur();
  });
  // окно закрыли клавишей Esc (на компьютере) — тоже сохраняем черновик чека
  $('#modal').addEventListener('cancel', (e) => {
    // пока читается чек, «Назад» на Android не должен выбрасывать результат
    if ($('#modal [data-keep]')) { e.preventDefault(); return; }
    if (rcBeforeClose()) setTimeout(() => { if (route().name === 'shopping') refresh(); }, 0); });

  // открыли выбор фото чека: если телефон перезапустит приложение, пока открыта камера, после запуска это объясним
  document.addEventListener('click', (e) => {
    const lb = e.target.closest && e.target.closest('label');
    if (lb && lb.querySelector('input[data-act-change="receipt"]')) lsSet(PICK_MARK, String(Date.now()));
  }, true);
  // вернулись в приложение и что-то нажимаем — значит, перезапуска не было
  document.addEventListener('pointerdown', () => { const t = +lsGet(PICK_MARK); if (t && Date.now() - t > 1500) lsSet(PICK_MARK, null); }, true);
  if (scanCrashNote) setTimeout(() => toast('Телефон перезапустил приложение во время чека: подробности в «Покупках»', 'err'), 1200);

  // ---------- Меню недели: перетаскивание блюд пальцем (за точки слева от названия) ----------
  // Работает и на телефоне: обычное перетаскивание браузера на iPhone ненадёжно, поэтому ведём палец сами.
  async function moveDish(src, dst) {
    if (src.date === dst.date && src.slot === dst.slot && (dst.idx == null || dst.idx === src.j || dst.idx === src.j + 1)) return;
    const from = menuDay(src.date), list = [...(from[src.slot] || [])];
    const [dish] = list.splice(src.j, 1);
    if (!dish) return;
    const same = src.date === dst.date;
    const base = same ? { ...from, [src.slot]: list } : menuDay(dst.date);
    const target = [...(base[dst.slot] || [])];
    let at = dst.idx == null ? target.length : dst.idx;
    if (same && src.slot === dst.slot && at > src.j) at--; // строка уже вынута — индекс сдвинулся
    target.splice(Math.min(at, target.length), 0, dish);
    if (same) await Store.save('menu', { ...base, [dst.slot]: target });
    else await Store.saveMany('menu', [{ ...from, [src.slot]: list }, { ...base, [dst.slot]: target }]);
    const sl = SLOTS.find((s) => s[0] === dst.slot);
    if (!same || src.slot !== dst.slot) toast(`«${dishTitle(dish)}» → ${WD[(U.parseDate(dst.date).getDay() + 6) % 7]}, ${sl ? sl[1].toLowerCase() : ''}`);
  }
  let drag = null;
  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    const slot = el && el.closest('.slot[data-date]');
    if (!slot) return null;
    // куда именно в ячейке: перед блюдом, над которым палец, иначе в конец
    let idx = null;
    for (const d of slot.querySelectorAll('.dish[data-j]')) {
      const r = d.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom && x < r.left + r.width / 2) { idx = +d.dataset.j; break; }
      if (y >= r.top && y <= r.bottom && x >= r.left + r.width / 2) idx = +d.dataset.j + 1;
    }
    return { slot, date: slot.dataset.date, slotKey: slot.dataset.slot, idx };
  }
  function dragEnd(commit) {
    if (!drag) return;
    const d = drag; drag = null;
    cancelAnimationFrame(d.raf);
    d.ghost.remove();
    d.chip.classList.remove('dragging');
    document.body.classList.remove('dish-dragging');
    document.querySelectorAll('.slot.drop-over').forEach((s) => s.classList.remove('drop-over'));
    if (commit && d.over) moveDish(d.src, { date: d.over.date, slot: d.over.slotKey, idx: d.over.idx }).catch(fail);
  }
  document.addEventListener('pointerdown', (e) => {
    const g = e.target.closest && e.target.closest('[data-grip]');
    if (!g || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const chip = g.closest('.dish'), r = chip.getBoundingClientRect();
    const ghost = chip.cloneNode(true);
    ghost.classList.add('dish-ghost');
    Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
    document.body.appendChild(ghost);
    chip.classList.add('dragging');
    document.body.classList.add('dish-dragging');
    drag = { src: { date: g.dataset.date, slot: g.dataset.slot, j: +g.dataset.j }, chip, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, over: null, id: e.pointerId };
    try { g.setPointerCapture(e.pointerId); } catch (err) { /* не страшно */ }
    // у края экрана список прокручивается сам
    const tick = () => {
      if (!drag) return;
      const edge = 70, h = window.innerHeight;
      const v = drag.y < edge ? -(edge - drag.y) / 4 : drag.y > h - edge ? (drag.y - (h - edge)) / 4 : 0;
      if (v) { window.scrollBy(0, v); updateOver(); }
      drag.raf = requestAnimationFrame(tick);
    };
    drag.raf = requestAnimationFrame(tick);
  });
  function updateOver() {
    if (!drag) return;
    drag.ghost.style.left = drag.x - drag.dx + 'px';
    drag.ghost.style.top = drag.y - drag.dy + 'px';
    const t = dropTarget(drag.x, drag.y);
    document.querySelectorAll('.slot.drop-over').forEach((s) => { if (!t || s !== t.slot) s.classList.remove('drop-over'); });
    if (t) t.slot.classList.add('drop-over');
    drag.over = t;
  }
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag.x = e.clientX; drag.y = e.clientY;
    updateOver();
  }, { passive: false });
  document.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) dragEnd(true); });
  document.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) dragEnd(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) dragEnd(false); });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  Store.onChange(() => { if (!needLogin) { render.keepScroll = true; render(); setTimeout(fixRecipeKeys, 0); setTimeout(autoSeedSteps, 0); } });

  // Рецепты, добавленные через Telegram-бота, приходят без связи со справочником —
  // связываем здесь, где есть полный справочник продуктов.
  let fixingKeys = false;
  async function fixRecipeKeys() {
    if (fixingKeys || needLogin) return;
    const list = Store.all('recipes').filter((r) => (r.ingredients || []).some((i) => !i.key && i.name));
    if (!list.length) return;
    fixingKeys = true;
    try {
      const cat = catalog();
      await Store.saveMany('recipes', list.map((r) => ({ ...r, ingredients: r.ingredients.map((i) => (i.key || !i.name ? i : { ...i, key: U.ingKey(i.name, cat) })) })));
    } catch (e) { console.error(e); } finally { fixingKeys = false; }
  }

  // ---------- Открытые функции для версии на компьютере ----------
  function renderNav() {
    document.querySelectorAll('[data-nav]').forEach((navEl) => {
      navEl.innerHTML = NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${icon(n.ic)}<span>${n.label}</span>${n.r === 'shopping' ? '<i class="nbadge" data-badge="shopping" hidden></i>' : ''}</a>`).join('');
    });
  }
  window.App = {
    isDesktop, ui, saveUI, render, refresh, route, actions, forms, views: extraViews, hooks, NAV, renderNav, icons: I,
    onReady: (fn) => readyHooks.push(fn),
    openModal, closeModal, toast, fail, confirmBox, icon, esc,
    recipeForm, parseIngredients, fillRecipeForm, guessCategory, importRecipeFiles, productName, rcProduct, rcVocab,
    openReceiptScan, addToShopping, addToPantry, openPickItems, openPicker, addDish,
    catalog, catOf, pantry, analyze, ingLabel, ingText, scaleOf, effIng, ingPlain, ingLineHTML, nameOf, stepHTML, recipeSteps, statusBadge, safeHost, lastCooked, cookedText,
    menuDay, menuId, weekDays, weekDishes, SLOTS, SLOT_CATS, WD, dishTitle, autofillWeek, weekToShopping, inFreezer,
    priceOf, rub, money, num2, monthLabel, monthIn, unitSelect, servWord, RECIPE_CATS, STATUS, UNITS,
    install: async () => { if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return true; } return false; },
    canInstall: () => !!installPrompt,
    needLogin: () => needLogin,
  };

  // ---------- Запуск ----------
  $('#dl-places').innerHTML = PLACES.map((u) => `<option value="${u}">`).join('');
  renderNav();
  $('#settings-btn').innerHTML = icon('sliders');

  // старт — когда загружены все скрипты страницы (версия для компьютера подключает свои страницы после app.js)
  const start = async () => {
    // Адрес базы задан, а её библиотека не загрузилась (плохая связь при первом запуске). Работать «локально»
    // в таком случае нельзя: записи остались бы только на этом устройстве и не попали бы в общую базу.
    if (Store.libMissing) {
      $('#view').innerHTML = `<div class="empty">${icon('alert', 'big')}<h3>Не удалось загрузить приложение целиком</h3>
        <p>Не загрузилась часть, которая отвечает за общую базу. Проверьте интернет и попробуйте ещё раз.</p>
        <button class="btn primary" onclick="location.reload()">Обновить страницу</button></div>`;
      return;
    }
    Store.onProblem = (text) => toast(text, 'err');
    Store.onSignedOut = () => { if (!needLogin) { needLogin = true; closeModal(); render(); toast('Нужно войти заново. Несохранённого нет: изменения на устройстве и отправятся после входа'); } };
    try {
      const res = await Store.init();
      needLogin = res.needLogin;
    } catch (e) { fail(e); }
    render();
    fixRecipeKeys();
    autoSeedSteps();
    readyHooks.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else setTimeout(start, 0);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (route().name === 'settings') refresh();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
