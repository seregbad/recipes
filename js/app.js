// «Наша кухня» — интерфейс приложения.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = U.esc;
  const CFG = window.APP_CONFIG || {};
  const REMIND_DAYS = CFG.remindDays || 7;

  const RECIPE_CATS = ['Завтраки', 'Супы', 'Основные блюда', 'Гарниры', 'Салаты', 'Закуски', 'Выпечка', 'Десерты',
    'Напитки', 'Соусы', 'Детское (Савва)', 'Заготовки', 'Другое'];
  const STATUS = { new: 'Не пробовали', liked: 'Понравилось', meh: 'Не зашло' };
  const UNITS = ['шт', 'г', 'кг', 'мл', 'л', 'уп.', 'банка', 'пучок', 'ст. л.', 'ч. л.', 'стакан', 'порция', 'контейнер', 'пакет'];
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
  const catOf = (name) => {
    const n = U.norm(name);
    const hit = catalog().find((c) => U.norm(c.name) === n);
    return hit ? hit.cat : 'Другое';
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
    if (!d.open) d.showModal();
    const first = d.querySelector('[autofocus]');
    if (first) first.focus();
    return d;
  }
  function closeModal() { const d = $('#modal'); if (d.open) d.close(); }

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

    $('#tabbar').hidden = $('#topnav').hidden = $('#settings-btn').hidden = needLogin;
    if (needLogin) { main.innerHTML = viewLogin(); $('#alert').innerHTML = ''; return; }
    catalog();
    const r = route();
    const nav = r.name === 'recipe' ? 'recipes' : r.name;
    document.querySelectorAll('#tabbar a, #topnav a').forEach((el) => el.classList.toggle('active', el.dataset.r === nav));
    const shopCount = Store.all('shopping').filter((s) => s.status !== 'bought').length;
    document.querySelectorAll('[data-badge="shopping"]').forEach((el) => { el.textContent = shopCount || ''; el.hidden = !shopCount; });

    renderAlert(r.name);
    const views = { recipes: viewRecipes, recipe: viewRecipe, menu: viewMenu, match: viewMatch, products: viewProducts, shopping: viewShopping, preserves: viewPreserves, settings: viewSettings };
    main.innerHTML = (views[r.name] || viewRecipes)(r.id);

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch (e) { /* не текстовое поле */ } }
    }
    if (render.keepScroll) window.scrollTo(0, scrollY);
    render.keepScroll = false;
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
    return `<div class="rtable" role="table">
      <div class="rrow rhead" role="row"><span></span><span>Название</span><span>Категория</span><span>Есть дома</span><span>Статус</span></div>
      ${list.map((r) => {
        const a = analyze(r, names);
        const pct = a.total ? Math.round((a.have / a.total) * 100) : 0;
        const host = r.url ? safeHost(r.url) : '';
        return `<a class="rrow" role="row" href="#/recipe/${encodeURIComponent(r.id)}">
          <span class="thumb">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icon('book')}</span>
          <span class="rtitle"><b>${esc(r.title)}</b>${host ? `<small>${esc(host)}</small>` : ''}</span>
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
        ${r.image ? `<div class="hero"><img src="${esc(r.image)}" alt="" referrerpolicy="no-referrer"></div>` : ''}
        <h1>${esc(r.title)}</h1>
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

        <section class="card">
          <div class="card-head"><h2>Ингредиенты</h2>
            ${a.total ? `<span class="muted small">дома есть ${a.have} из ${a.total}</span>` : ''}</div>
          <ul class="ings">
            ${(r.ingredients || []).map((i) => {
              const ignored = ui.ignoreStaples && (U.isStaple(ingLabel(i)) || i.unit === 'по вкусу');
              const miss = missingSet.has(i);
              return `<li class="${ignored ? 'staple' : miss ? 'miss' : 'have'}">
                <span class="dot">${ignored ? '' : miss ? icon('x') : icon('check')}</span>
                <span>${esc(i.raw || [i.name, U.fmtQty(i.qty, i.unit)].filter(Boolean).join(' — '))}</span></li>`;
            }).join('') || '<li class="muted">Ингредиенты не указаны</li>'}
          </ul>
          ${a.missing.length ? `<button class="btn primary block" data-act="recipe-to-shop" data-id="${esc(r.id)}">${icon('cart')}<span>Не хватает ${a.missing.length}: добавить в покупки</span></button>` : a.total ? `<p class="ok-line">${icon('check')} Всё есть дома, можно готовить</p>` : ''}
        </section>

        ${steps.length ? `<section class="card"><h2>Приготовление</h2>
          ${steps.length > 1 ? `<ol class="steps">${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : `<p class="pre">${esc(steps[0])}</p>`}</section>` : ''}
        ${r.notes ? `<section class="card"><h2>Заметки</h2><p class="pre">${esc(r.notes)}</p></section>` : ''}

        <div class="actions-row">
          <button class="btn" data-act="recipe-edit" data-id="${esc(r.id)}">${icon('edit')}<span>Изменить</span></button>
          <button class="btn" data-act="recipe-to-menu" data-id="${esc(r.id)}">${icon('cal')}<span>В меню</span></button>
          <button class="btn" data-act="preserve-from-recipe" data-id="${esc(r.id)}">${icon('snow')}<span>Сделали заготовку</span></button>
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
        <label>Ссылка на фото<input name="image" type="url" value="${esc(r.image || '')}"></label>
        <div class="form-actions">
          <button type="button" class="btn" data-act="close">Отмена</button>
          <button class="btn primary" type="submit">Сохранить</button>
        </div>
      </form>`;
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
        <input id="m-add" name="name" list="dl-ing" placeholder="${modeHome ? 'Добавить продукт к имеющимся' : 'Выберите продукт'}" autocomplete="off">
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
          <input id="p-name" name="name" list="dl-ing" placeholder="Что есть дома" required autocomplete="off">
          <input name="qty" placeholder="Кол-во" inputmode="decimal">
          <input name="unit" list="dl-units" placeholder="ед.">
          <button class="btn primary" type="submit" aria-label="Добавить">${icon('plus')}</button>
        </form>` : `
        <label class="search">${icon('search')}<input id="prodq" type="search" placeholder="Найти в справочнике" value="${esc(ui.prodQ)}" data-input="prodQ"></label>`}
      <div id="list">${ui.prodTab === 'home' ? pantryList() : catalogList()}</div>`;
  }

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

  async function addToPantry(name, qty, unit) {
    const n = U.norm(name);
    const ex = pantry().find((p) => U.norm(p.name) === n);
    if (ex) {
      const sameUnit = (ex.unit || '') === (unit || '');
      return Store.save('pantry', { ...ex, qty: sameUnit ? U.addQty(ex.qty, qty) : (qty || ex.qty), unit: sameUnit ? ex.unit : (unit || ex.unit), updated_on: U.today() });
    }
    return Store.save('pantry', { name: name.trim(), qty: qty || '', unit: unit || '', updated_on: U.today() });
  }

  async function addToShopping(items) {
    const seen = new Set(Store.all('shopping').filter((s) => s.status !== 'bought').map((t) => U.norm(t.name)));
    const fresh = items.filter((it) => { const n = U.norm(it.name); if (!n || seen.has(n)) return false; seen.add(n); return true; })
      .map((it) => ({ name: it.name, qty: it.qty || '', unit: it.unit || '', note: it.note || '', status: 'todo', created_on: U.today() }));
    if (fresh.length) await Store.saveMany('shopping', fresh);
    return fresh.length;
  }

  // =====================================================================
  // ПОКУПКИ (п.6)
  // =====================================================================
  function viewShopping() {
    const all = Store.all('shopping');
    const todo = all.filter((s) => s.status !== 'bought');
    return `
      <div class="page-head"><h1>Покупки</h1></div>
      <div class="seg">
        <button class="${ui.shopTab === 'todo' ? 'on' : ''}" data-act="set" data-k="shopTab" data-v="todo">Купить · ${todo.length}</button>
        <button class="${ui.shopTab === 'history' ? 'on' : ''}" data-act="set" data-k="shopTab" data-v="history">История покупок</button>
      </div>
      ${ui.shopTab === 'todo' ? `
        <form class="add-row qty-row" data-form="shop-add">
          <input id="s-name" name="name" list="dl-ing" placeholder="Что купить" required autocomplete="off">
          <input name="qty" placeholder="Кол-во" inputmode="decimal">
          <input name="unit" list="dl-units" placeholder="ед.">
          <button class="btn primary" type="submit" aria-label="Добавить">${icon('plus')}</button>
        </form>
        <div id="list">${shopTodo()}</div>` : `
        <label class="search">${icon('search')}<input id="shopq" type="search" placeholder="Когда покупали…" value="${esc(ui.shopQ)}" data-input="shopQ"></label>
        <div id="list">${shopHistory()}</div>`}`;
  }

  function frequent() {
    const todo = new Set(Store.all('shopping').filter((s) => s.status !== 'bought').map((s) => U.norm(s.name)));
    const freq = {};
    Store.all('shopping').filter((s) => s.status === 'bought').forEach((s) => {
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
        <button class="icon-btn" aria-label="Удалить" data-act="shop-del" data-id="${esc(s.id)}">${icon('trash')}</button>
      </li>`;
    }).join('')}</ul>
    <button class="btn block" data-act="shop-buy-all">${icon('check')}<span>Купили всё (${todo.length})</span></button>
    ${freqHtml}`;
  }

  function shopHistory() {
    const q = U.norm(ui.shopQ);
    const bought = Store.all('shopping').filter((s) => s.status === 'bought' && (!q || U.norm(s.name).includes(q)))
      .sort((a, b) => String(b.bought_on).localeCompare(String(a.bought_on)) || a.name.localeCompare(b.name, 'ru'));
    if (!bought.length) return `<div class="empty small">${q ? 'Не покупали' : 'Здесь будет история: что, сколько и когда купили'}</div>`;
    const groups = {};
    bought.forEach((s) => (groups[s.bought_on] = groups[s.bought_on] || []).push(s));
    return Object.keys(groups).map((d) => `
      <h3 class="group">${esc(U.fmtDate(d))} <small>${groups[d].length}</small></h3>
      <ul class="slist">${groups[d].map((s) => `<li>
        <button class="pname" data-act="shop-edit" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc([U.fmtQty(s.qty, s.unit), s.price ? s.price + ' ₽' : ''].filter(Boolean).join(' · '))}</small></button>
        <button class="icon-btn" title="Купить снова" aria-label="Купить снова" data-act="shop-again" data-n="${esc(s.name)}" data-q="${esc(s.qty || '')}" data-u="${esc(s.unit || '')}">${icon('repeat')}</button>
        <button class="icon-btn" aria-label="Удалить из истории" data-act="shop-del" data-id="${esc(s.id)}">${icon('trash')}</button>
      </li>`).join('')}</ul>`).join('');
  }

  function shopForm(s) {
    const bought = s.status === 'bought';
    return `<form class="form" data-form="shop-edit">
      <div class="form-head"><h2>${bought ? 'Покупка' : 'Купить'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>
      <input type="hidden" name="id" value="${esc(s.id)}">
      <label>Продукт<input name="name" list="dl-ing" required value="${esc(s.name)}"></label>
      <div class="grid2">
        <label>Количество<input name="qty" inputmode="decimal" value="${esc(s.qty || '')}"></label>
        <label>Единица<input name="unit" list="dl-units" value="${esc(s.unit || '')}"></label>
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
        <label>Единица<input name="unit" list="dl-units" value="${esc(p.unit || '')}"></label>
        <label>Где лежит<input name="place" list="dl-places" value="${esc(p.place || '')}"></label>
      </div>
      <label>Заметка<input name="notes" value="${esc(p.notes || '')}" placeholder="состав, с какого возраста, как разогревать…"></label>
      <p class="muted small">${ui.presOwner === 'savva' || p.owner === 'savva' ? 'Для детского пюре по умолчанию ставится 1 месяц. Поменяйте, если считаете иначе.' : 'По умолчанию: заморозка 3 месяца, банки 1 год.'}</p>
      <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div>
    </form>`;
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
      </div>
      <p class="muted small">«Заполнить пустое» подставляет на завтрак завтрак, на обед суп, на ужин второе с гарниром. Чаще выбираются понравившиеся блюда и те, для которых продукты уже есть дома. Повторов за неделю нет, прошедшие дни не трогаются.</p>
      <div class="week">${days.map((d, i) => {
        const day = menuDay(d);
        return `<section class="day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">
          <h3>${WD[i]}, ${esc(U.fmtDate(d))}${d === today ? ' <em class="tag ok">сегодня</em>' : ''}</h3>
          ${SLOTS.map(([k, l]) => `<div class="slot"><span class="slot-l">${l}</span><div class="dishes">
            ${(day[k] || []).map((x, j) => `<span class="dish">${x.rid ? `<a href="#/recipe/${encodeURIComponent(x.rid)}">${esc(dishTitle(x))}</a>` : `<span>${esc(dishTitle(x))}</span>`}<button data-act="menu-del" data-date="${d}" data-slot="${k}" data-j="${j}" aria-label="Убрать">${icon('x')}</button></span>`).join('')}
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
      <label class="search">${icon('search')}<input id="pick-q" type="search" placeholder="Найти блюдо" autocomplete="off"></label>
      <div class="chips">${['', ...cats].map((c) => `<button type="button" class="chip ${c === def ? 'on' : ''}" data-act="pick-cat" data-cat="${esc(c)}">${esc(c || 'Все')}</button>`).join('')}</div>
      <div id="pick-list" class="pick-list"></div>
      <form class="row" data-form="menu-text"><input name="text" placeholder="или впишите блюдо без рецепта" required><button class="btn">${icon('plus')}</button></form>
    </div>`);
    renderPickList();
  }
  function renderPickList() {
    const box = $('#modal .picker');
    if (!box) return;
    const q = U.norm($('#pick-q', box).value);
    const cat = box.dataset.cat;
    const names = pantry().map((p) => p.name);
    const list = Store.all('recipes')
      .filter((r) => r.status !== 'meh' && (q ? U.norm(r.title).includes(q) : !cat || r.category === cat))
      .sort((a, b) => (b.status === 'liked') - (a.status === 'liked') || String(a.title).localeCompare(String(b.title), 'ru'));
    $('#pick-list', box).innerHTML = list.length ? list.map((r) => {
      const a = analyze(r, names);
      return `<button type="button" class="pick-item" data-act="pick" data-rid="${esc(r.id)}"><b>${esc(r.title)}</b>
        <small>${esc(r.category || '')}${a.total ? ` · дома ${a.have} из ${a.total}` : ''}</small></button>`;
    }).join('') : `<div class="empty small">Нет подходящих блюд</div>`;
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
      const w = fresh.map((r) => { const a = analyze(r, names); return (r.status === 'liked' ? 2 : 1) * (1 + (a.total ? a.have / a.total : 0)); });
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
    const need = new Map(); // продукт → блюда
    weekDishes(weekDays(ui.menuWeek || 0)).forEach((x) => {
      const r = x.rid && Store.get('recipes', x.rid);
      if (!r) return;
      analyze(r, names).missing.forEach((i) => {
        const n = ingLabel(i);
        if (!need.has(n)) need.set(n, new Set());
        need.get(n).add(r.title);
      });
    });
    return addToShopping([...need].map(([name, titles]) => ({ name, note: 'меню: ' + [...titles].join(', ') })));
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
             <button class="btn" data-act="logout">Выйти</button>`
          : `<p><b>Локально, только в этом браузере.</b> Чтобы пользоваться вдвоём с телефонов, подключите Supabase по инструкции (файл <code>ИНСТРУКЦИЯ.md</code>). Данные отсюда можно будет перенести: сохраните копию ниже и загрузите её после подключения.</p>`}
      </section>
      <section class="card">
        <h2>Установить на телефон</h2>
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
        </div>
      </section>
      <section class="card">
        <h2>Напоминания о сроках</h2>
        <p class="small">Предупреждение в приложении появляется за <b>${REMIND_DAYS}</b> ${U.plural(REMIND_DAYS, 'день', 'дня', 'дней')} до конца срока (меняется в <code>js/config.js</code>).
        ${cloud ? 'Ежедневные сообщения в Telegram настраиваются в GitHub (см. инструкцию).' : 'После подключения Supabase и GitHub будут приходить сообщения в Telegram.'}
        У каждой заготовки есть кнопка ${icon('cal', 'tiny')}: добавить напоминание в Google Календарь.</p>
      </section>`;
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
      const n = await addToShopping(a.missing.map((i) => ({ name: ingLabel(i), qty: i.qty, unit: i.unit === 'по вкусу' ? '' : i.unit, note: r.title })));
      toast(n ? `Добавлено в покупки: ${n}` : 'Всё уже есть в списке покупок');
    },
    'recipe-import': async (el) => {
      const form = el.closest('form');
      const url = form.url.value.trim();
      if (!url) { toast('Сначала вставьте ссылку'); form.url.focus(); return; }
      if (!Store.canImport()) { toast('Загрузка по ссылке заработает после подключения Supabase. Пока заполните вручную.'); return; }
      el.disabled = true; el.classList.add('loading');
      try {
        const d = await Store.importRecipe(url);
        if (d.title) form.title.value = d.title;
        if (d.image) form.image.value = d.image;
        if (d.servings) form.servings.value = d.servings;
        if (d.time) form.time.value = d.time;
        if (d.ingredients && d.ingredients.length) form.ingredients.value = d.ingredients.join('\n');
        if (d.steps && d.steps.length) form.steps.value = d.steps.join('\n');
        if (d.category && !form.category.value) {
          const hit = RECIPE_CATS.find((c) => U.norm(d.category).includes(U.norm(c).slice(0, 5)));
          if (hit) form.category.value = hit;
        }
        toast(d.ingredients && d.ingredients.length ? 'Рецепт загружен, проверьте и сохраните' : 'Нашёл только название: ингредиенты на этом сайте не размечены, вставьте их вручную');
      } catch (e) { fail(e); } finally { el.disabled = false; el.classList.remove('loading'); }
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
      const cat = catalog();
      const list = (window.SEED_RECIPES || []).filter(([t]) => !existing.has(U.norm(t))).map(([title, category, ings]) => ({
        title, category, status: 'liked', url: '', image: '', servings: '', time: '', steps: '',
        notes: 'Из нашей таблицы «Меню недели». Ингредиенты примерные, поправьте под себя.',
        ingredients: ings.split(';').map((s) => s.trim()).filter(Boolean).map((name) => ({ raw: name, name, qty: '', unit: '', key: U.ingKey(name, cat) })),
      }));
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
      const n = await weekToShopping();
      toast(n ? `В покупки добавлено: ${n}` : 'Всё для меню уже есть дома или в списке');
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
        <label>Продукт<input name="name" list="dl-ing" required value="${esc(p.name)}"></label>
        <div class="grid2"><label>Количество<input name="qty" inputmode="decimal" value="${esc(p.qty || '')}" autofocus></label>
        <label>Единица<input name="unit" list="dl-units" value="${esc(p.unit || '')}"></label></div>
        <div class="form-actions"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
    },
    'pantry-out': async (el) => {
      const p = Store.get('pantry', el.dataset.id);
      await addToShopping([{ name: p.name, unit: p.unit }]);
      await Store.remove('pantry', p.id);
      toast(`«${p.name}» закончилось, добавлено в покупки`);
    },
    'pantry-del': async (el) => { await Store.remove('pantry', el.dataset.id); },
    'cat-home': async (el) => { await addToPantry(el.dataset.n, '', ''); toast(`«${el.dataset.n}»: есть дома`); },
    'cat-shop': async (el) => { await addToShopping([{ name: el.dataset.n }]); toast(`«${el.dataset.n}» в покупках`); },
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
      closeModal();
      location.hash = '#/recipe/' + encodeURIComponent(saved.id);
      toast('Рецепт сохранён');
    },
    'menu-text': async (f) => {
      const box = f.closest('.picker');
      await addDish(box.dataset.date, box.dataset.slot, { text: f.text.value.trim() });
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
    if (el.name === 'expires_on') el.removeAttribute('data-auto');
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.change) { ui[el.dataset.change] = el.value; saveUI(); refresh(); }
    if (el.hasAttribute('data-shelf-src')) {
      const f = el.form, exp = f.expires_on;
      if (exp.dataset.auto) exp.value = U.addMonths(f.made_on.value || U.today(), defaultShelf(f.kind.value, f.owner.value));
    }
    if (el.dataset.actChange === 'import' && el.files[0]) {
      el.files[0].text().then(async (txt) => {
        if (!(await confirmBox('Загрузить данные из копии? Совпадающие записи обновятся, остальные добавятся.', 'Загрузить'))) return;
        const n = await Store.importJSON(txt);
        toast(`Загружено записей: ${n}`);
      }).catch(fail).finally(() => (el.value = ''));
    }
  });
  // клик по фону закрывает окно
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  Store.onChange(() => { if (!needLogin) render.keepScroll = true, render(); });

  // ---------- Запуск ----------
  $('#dl-units').innerHTML = UNITS.map((u) => `<option value="${u}">`).join('');
  $('#dl-places').innerHTML = PLACES.map((u) => `<option value="${u}">`).join('');
  document.querySelectorAll('[data-nav]').forEach((navEl) => {
    navEl.innerHTML = NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${icon(n.ic)}<span>${n.label}</span>${n.r === 'shopping' ? '<i class="nbadge" data-badge="shopping" hidden></i>' : ''}</a>`).join('');
  });
  $('#settings-btn').innerHTML = icon('sliders');

  (async () => {
    try {
      const res = await Store.init();
      needLogin = res.needLogin;
      $('#mode').textContent = Store.mode === 'cloud' ? '' : 'локально';
    } catch (e) { fail(e); }
    render();
  })();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (route().name === 'settings') refresh();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
