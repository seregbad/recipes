// «Наша кухня» — версия для компьютера (desktop.html).
// Использует то же приложение (app.js) и ту же базу, добавляет:
//  вставку Ctrl+V и перетаскивание файлов, закладку «В Нашу кухню» для браузера,
//  меню недели таблицей с перетаскиванием, печать/PDF, Excel, аналитику расходов,
//  массовую правку рецептов, горячие клавиши и страницу «Инструменты».
(function () {
  const App = window.App;
  if (!App || !App.isDesktop) return;
  const { esc, icon, toast, fail, ui } = App;
  const $ = (s, r = document) => r.querySelector(s);
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  // дополнительные иконки
  Object.assign(App.icons, {
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  });

  // ---------- Разделы ----------
  App.NAV.push({ r: 'stats', label: 'Аналитика', ic: 'chart' }, { r: 'tools', label: 'Инструменты', ic: 'tool' });
  App.renderNav();

  // =====================================================================
  // ВХОДЯЩЕЕ: вставка Ctrl+V и перетаскивание файлов
  // =====================================================================
  const isImage = (f) => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp|gif)$/i.test(f.name || '');
  const isSheet = (f) => /\.(xlsx|xls|csv)$/i.test(f.name || '');
  const recipeFormOpen = () => $('#modal').open && $('#modal form[data-form="recipe"]');

  function openRecipeDraft(d, extra = {}) {
    App.openModal(App.recipeForm({
      title: d.title, servings: d.servings || '', time: d.time || '', status: 'new', category: App.guessCategory(d.title || ''),
      ingredients: App.parseIngredients((d.ingredients || []).join('\n')), steps: (d.steps || []).join('\n'),
      url: extra.url || '', image: extra.image || '', notes: extra.notes || '',
    }));
  }
  // дописать к уже открытой форме рецепта (второй скриншот длинного описания и т.п.)
  function appendToForm(f, d) {
    if (!d.titleFromText) d = { ...d, title: '' };
    if (!f.title.value.trim() && d.title) f.title.value = d.title;
    if (!f.servings.value && d.servings) f.servings.value = d.servings;
    if (!f.time.value && d.time) f.time.value = d.time;
    const have = new Set(f.ingredients.value.split('\n').map((l) => U.norm(l)).filter(Boolean));
    const ing = (d.ingredients || []).filter((l) => !have.has(U.norm(l)));
    if (ing.length) f.ingredients.value = [f.ingredients.value.trim(), ...ing].filter(Boolean).join('\n');
    // заголовок второго куска текста — скорее всего продолжение, а не название
    const steps = [...(d.steps || [])];
    if (d.title && f.title.value.trim() !== d.title && !have.has(U.norm(d.title))) steps.unshift(d.title);
    if (steps.length) f.steps.value = [f.steps.value.trim(), ...steps].filter(Boolean).join('\n');
    const st = $('#rf-status');
    if (st) st.textContent = `Добавлено: ингредиентов ${ing.length}, строк приготовления ${steps.length}. Можно вставить ещё.`;
  }

  async function textFromFiles(files) {
    let text = '';
    for (let i = 0; i < files.length; i++) {
      toast(files.length > 1 ? `Распознаю ${i + 1} из ${files.length}…` : 'Читаю…');
      text += (await RecipeImport.extractText(files[i], (p) => toast(`Распознаю текст… ${Math.round(p * 100)}%`))) + '\n';
    }
    return text;
  }

  const receiptQueue = [];
  function nextReceipt() { if (receiptQueue.length && !$('#modal').open) App.openReceiptScan(receiptQueue.shift()); }
  $('#modal').addEventListener('close', () => setTimeout(nextReceipt, 300));

  async function handleIncoming({ files = [], text = '' }) {
    try {
      // форма рецепта открыта — дописываем в неё
      const f = recipeFormOpen();
      if (f) {
        const t = files.length ? await textFromFiles(files.filter((x) => !isSheet(x))) : text;
        if (t.trim()) appendToForm(f, RecipeImport.parseRecipeText(t, ''));
        return;
      }
      if ($('#modal').open) return; // другое окно (чек, заготовка) — не мешаем
      if (!files.length) {
        const s = text.trim();
        if (/^https?:\/\/\S+$/.test(s)) { // вставили ссылку
          App.openModal(App.recipeForm({ url: s, status: 'new' }));
          if (Store.canImport()) { const b = $('#modal [data-act="recipe-import"]'); if (b) b.click(); }
          else toast('Ссылка вставлена. Загрузка по ссылке работает с подключённой базой');
          return;
        }
        openRecipeDraft(RecipeImport.parseRecipeText(s, 'Рецепт'), { notes: 'Вставлено из буфера обмена' });
        return;
      }
      const sheets = files.filter(isSheet), images = files.filter(isImage), docs = files.filter((x) => !isSheet(x) && !isImage(x));
      for (const s of sheets) await importExcel(s);
      if (images.length) {
        // картинки с QR-кодом чека — это чеки
        toast('Смотрю, что на картинках…');
        const groups = new Map(), plain = [];
        for (const im of images) {
          const qr = await Receipt.findQR(await Receipt.loadImage(im)).catch(() => null);
          if (qr) { if (!groups.has(qr.key)) groups.set(qr.key, []); groups.get(qr.key).push(im); } else plain.push(im);
        }
        if (groups.size === 1) {
          // один чек: фото без QR — его продолжение (длинный чек частями)
          App.openReceiptScan([...groups.values()][0].concat(plain));
        } else if (groups.size > 1) {
          receiptQueue.push(...groups.values());
          toast(`Чеков: ${groups.size}. Обработаю по очереди`);
          nextReceipt();
          if (plain.length) toast('Картинки без QR-кода пропущены: добавьте их отдельно');
        } else {
          // скриншоты рецепта — один рецепт из всех картинок
          const t = await textFromFiles(plain);
          openRecipeDraft(RecipeImport.parseRecipeText(t, 'Рецепт'), { notes: `Из ${plain.length > 1 ? plain.length + ' картинок' : 'картинки'}` });
        }
      }
      if (docs.length) await App.importRecipeFiles(docs);
    } catch (e) { fail(e); }
  }

  document.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.files];
    const text = cd.getData('text/plain') || '';
    const inField = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (inField && !files.length) return; // обычная вставка текста в поле
    if (!files.length && !text.trim()) return;
    if (App.needLogin()) return;
    e.preventDefault();
    handleIncoming({ files, text });
  });

  // перетаскивание файлов в окно
  const overlay = document.createElement('div');
  overlay.id = 'drop-overlay';
  overlay.innerHTML = `<div>${icon('upload')}<b>Отпустите файлы</b><span>рецепты (txt, pdf, Word, скриншоты), фото чеков, Excel</span></div>`;
  document.body.appendChild(overlay);
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  document.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; overlay.classList.add('on'); } });
  document.addEventListener('dragleave', (e) => { if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('on'); } });
  document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0; overlay.classList.remove('on');
    if (App.needLogin()) return;
    handleIncoming({ files: [...e.dataTransfer.files] });
  });

  // =====================================================================
  // ЗАКЛАДКА «В НАШУ КУХНЮ»: страница → #/import?d=…
  // =====================================================================
  const appUrl = () => location.origin + location.pathname;
  function bookmarkletCode() {
    // выполняется на чужой странице: берёт выделенный текст, описание поста Instagram,
    // разметку рецепта (JSON-LD) или текст статьи, и открывает приложение с этими данными
    const src = `(()=>{const A=${JSON.stringify(appUrl())};const q=s=>document.querySelector(s);const m=n=>((q('meta[property="'+n+'"]')||q('meta[name="'+n+'"]')||{}).content||'');const sel=String(getSelection()).trim();const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).filter(t=>/Recipe/.test(t)).map(t=>t.slice(0,60000));let x=sel;if(!x&&/instagram\\.com/.test(location.host)){const h=q('article h1')||q('main h1')||q('h1');x=h?h.innerText:m('og:description');}if(!x&&!ld.length){const a=q('article')||q('main')||document.body;x=a.innerText;}const d={u:location.href,t:m('og:title')||document.title,i:m('og:image'),x:(x||'').slice(0,15000),l:ld};const b=btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');window.open(A+'#/import?d='+b,'kuhnya');})()`;
    return 'javascript:' + encodeURIComponent(src);
  }

  // разметка рецепта schema.org, переданная закладкой
  function findRecipe(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
    const t = node['@type'];
    if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
    return findRecipe(node['@graph']) || findRecipe(node.mainEntity);
  }
  const strOf = (x) => (x == null ? '' : typeof x === 'string' ? x : typeof x === 'number' ? String(x) : x.text || x.name || '');
  const stripTags = (s) => { const d = document.createElement('div'); d.innerHTML = String(s); return d.textContent.replace(/\s+/g, ' ').trim(); };
  function stepsOf(x) {
    if (!x) return [];
    if (typeof x === 'string') return stripTags(x.replace(/<br\s*\/?>|<\/p>/gi, '\n')).split(/\n+/);
    if (Array.isArray(x)) return x.flatMap(stepsOf);
    if (x.itemListElement) return stepsOf(x.itemListElement);
    return [stripTags(strOf(x))];
  }
  const imageOf = (x) => (!x ? '' : typeof x === 'string' ? x : Array.isArray(x) ? imageOf(x[0]) : x.url || '');
  const isoTime = (s) => { const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(s || ''); return m && (m[1] || m[2]) ? [m[1] ? m[1] + ' ч' : '', m[2] ? m[2] + ' мин' : ''].filter(Boolean).join(' ') : ''; };
  // Instagram: «123 likes, 4 comments - user on …: "текст"» → текст; строки из одних хэштегов убираем
  function cleanCaption(x) {
    let t = String(x || '');
    const m = t.slice(0, 200).match(/(likes?|comments?|отмет|коммент)/i) && t.match(/:\s*["«]([\s\S]+)["»]\s*\.?\s*$/);
    if (m) t = m[1];
    return t.split('\n').filter((l) => !/^\s*(#[\wа-яё_]+\s*)+$/i.test(l)).join('\n');
  }
  function openFromPage(d) {
    let rec = null;
    for (const block of d.l || []) { try { rec = findRecipe(JSON.parse(block)); } catch (e) { /* битый JSON */ } if (rec) break; }
    const host = (() => { try { return new URL(d.u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
    if (rec) {
      openRecipeDraft({
        title: stripTags(strOf(rec.name)) || d.t,
        ingredients: (Array.isArray(rec.recipeIngredient) ? rec.recipeIngredient : []).map(stripTags),
        steps: stepsOf(rec.recipeInstructions).map((s) => s.trim()).filter(Boolean),
        servings: (strOf(Array.isArray(rec.recipeYield) ? rec.recipeYield[0] : rec.recipeYield).match(/\d+/) || [''])[0] && App.servWord(+(strOf(Array.isArray(rec.recipeYield) ? rec.recipeYield[0] : rec.recipeYield).match(/\d+/)[0])),
        time: isoTime(strOf(rec.totalTime)) || isoTime(strOf(rec.cookTime)),
      }, { url: d.u, image: imageOf(rec.image) || d.i, notes: `С сайта ${host}` });
      toast('Рецепт со страницы: проверьте и сохраните');
      return;
    }
    const text = cleanCaption(d.x);
    if (!text.trim()) { toast('На странице не нашлось текста. Выделите текст рецепта мышкой и нажмите закладку ещё раз', 'err'); return; }
    const parsed = RecipeImport.parseRecipeText(text, (d.t || '').replace(/\s+on Instagram.*$/i, '').slice(0, 80) || 'Рецепт');
    openRecipeDraft(parsed, { url: d.u, image: /^https?:/.test(d.i || '') ? d.i : '', notes: `Из ${host || 'браузера'}` });
    toast(parsed.ingredients.length ? 'Проверьте рецепт и сохраните' : 'Ингредиенты не распознались: допишите их или выделите текст рецепта и нажмите закладку снова');
  }
  let pendingImport = null;
  function checkImportHash() {
    const m = location.hash.match(/^#\/import\?d=([A-Za-z0-9_-]+)/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + '#/recipes');
    try {
      let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      pendingImport = JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { toast('Не получилось прочитать данные со страницы', 'err'); return; }
    App.render();
    processPending();
  }
  function processPending() {
    if (!pendingImport || App.needLogin()) return;
    const d = pendingImport; pendingImport = null;
    openFromPage(d);
  }
  window.addEventListener('hashchange', checkImportHash);
  Store.onChange(() => setTimeout(processPending, 0));

  // =====================================================================
  // МЕНЮ НЕДЕЛИ ТАБЛИЦЕЙ С ПЕРЕТАСКИВАНИЕМ
  // =====================================================================
  App.views.menu = function viewMenuDesk() {
    const days = App.weekDays(ui.menuWeek || 0);
    const today = U.today();
    const filled = App.weekDishes(days).length;
    return `
      <div class="page-head"><h1>Меню недели</h1>
        <div class="weeknav">
          <button class="icon-btn" data-act="week" data-d="-1" aria-label="Предыдущая неделя" title="Предыдущая неделя (←)">${icon('back')}</button>
          <b>${esc(U.fmtDate(days[0]))} – ${esc(U.fmtDate(days[6]))}</b>
          <button class="icon-btn flip" data-act="week" data-d="1" aria-label="Следующая неделя" title="Следующая неделя (→)">${icon('back')}</button>
          ${ui.menuWeek ? `<button class="chip" data-act="week" data-d="0">к этой неделе</button>` : ''}
        </div></div>
      <div class="row wrap">
        <button class="btn" data-act="menu-autofill">${icon('bulb')}<span>Заполнить пустое</span></button>
        <button class="btn primary" data-act="menu-shop" ${filled ? '' : 'disabled'}>${icon('cart')}<span>Продукты на неделю</span></button>
        <button class="btn" data-act="print-menu">${icon('print')}<span>Печать</span></button>
        ${filled ? `<button class="btn danger-ghost" data-act="menu-clear">${icon('trash')}<span>Очистить неделю</span></button>` : ''}
        <small class="muted grow">Перетаскивайте блюда из списка слева в ячейки и между днями. Чтобы убрать, перетащите обратно в список или нажмите ×.</small>
      </div>
      <div class="mgrid-wrap">
        <aside class="mside" data-drop="trash">
          <label class="search">${icon('search')}<input id="mside-q" type="search" placeholder="Найти блюдо" value="${esc(ui.msideQ || '')}"></label>
          <div class="chips">${['', ...App.RECIPE_CATS.filter((c) => Store.all('recipes').some((r) => r.category === c))].map((c) =>
            `<button class="chip ${(ui.msideCat || '') === c ? 'on' : ''}" data-act="mside-cat" data-cat="${esc(c)}">${esc(c || 'Все')}</button>`).join('')}</div>
          <div id="mside-list" class="mside-list">${msideList()}</div>
        </aside>
        <div class="mgrid-scroll"><table class="mgrid">
          <thead><tr><th></th>${days.map((d, i) => `<th class="${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">${App.WD[i]}<small>${esc(U.fmtDate(d))}</small></th>`).join('')}</tr></thead>
          <tbody>${App.SLOTS.map(([k, l]) => `<tr><th>${l}</th>${days.map((d) => {
            const day = App.menuDay(d);
            return `<td class="mcell ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}" data-date="${d}" data-slot="${k}">
              ${(day[k] || []).map((x, j) => {
                const fz = App.inFreezer(x.rid, App.dishTitle(x));
                return `<div class="mdish ${x.rid ? '' : 'text'}" draggable="true" data-drag="dish" data-date="${d}" data-slot="${k}" data-j="${j}" title="${esc(App.dishTitle(x))}">
                  ${fz ? `<span class="fz" title="В морозилке: ${esc(U.fmtQty(fz.qty, fz.unit))}">${icon('snow')}</span>` : ''}
                  ${x.rid ? `<a href="#/recipe/${encodeURIComponent(x.rid)}" draggable="false">${esc(App.dishTitle(x))}</a>` : `<button class="dish-text" data-act="menu-text-dish" data-date="${d}" data-slot="${k}" data-j="${j}">${esc(x.text)}</button>`}
                  <button class="x" data-act="menu-del" data-date="${d}" data-slot="${k}" data-j="${j}" aria-label="Убрать">${icon('x')}</button></div>`;
              }).join('')}
              <button class="madd" data-act="menu-pick" data-date="${d}" data-slot="${k}" aria-label="Добавить блюдо">${icon('plus')}</button></td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  };
  function msideList() {
    const q = U.norm(ui.msideQ || ''), cat = ui.msideCat || '';
    const list = Store.all('recipes').filter((r) => r.status !== 'meh' && (!cat || r.category === cat) && (!q || U.norm(r.title).includes(q)))
      .sort((a, b) => (b.status === 'liked') - (a.status === 'liked') || String(a.title).localeCompare(String(b.title), 'ru'));
    if (!list.length) return '<div class="empty small">Нет блюд</div>';
    return list.map((r) => {
      const last = App.lastCooked(r), fz = App.inFreezer(r.id, r.title);
      return `<div class="mside-item" draggable="true" data-drag="rid" data-rid="${esc(r.id)}">
        <b>${esc(r.title)}</b><small>${esc([r.category, fz ? '❄ в морозилке' : '', last ? 'готовили ' + U.ago(last) : ''].filter(Boolean).join(' · '))}</small></div>`;
    }).join('');
  }
  App.actions['mside-cat'] = (el) => { ui.msideCat = el.dataset.cat; App.saveUI(); App.refresh(); };
  document.addEventListener('input', (e) => {
    if (e.target.id === 'mside-q') { ui.msideQ = e.target.value; App.saveUI(); const l = $('#mside-list'); if (l) l.innerHTML = msideList(); }
  });

  // перетаскивание блюд
  let dragData = null;
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-drag]');
    if (!el) return;
    dragData = el.dataset.drag === 'rid' ? { type: 'rid', rid: el.dataset.rid } : { type: 'dish', date: el.dataset.date, slot: el.dataset.slot, j: +el.dataset.j };
    e.dataTransfer.setData('text/plain', el.textContent.trim());
    e.dataTransfer.effectAllowed = 'copyMove';
    el.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => {
    const el = e.target.closest && e.target.closest('[data-drag]');
    if (el) el.classList.remove('dragging');
    document.querySelectorAll('.drop-over').forEach((x) => x.classList.remove('drop-over'));
    dragData = null;
  });
  document.addEventListener('dragover', (e) => {
    if (!dragData) return;
    const cell = e.target.closest('.mcell, [data-drop="trash"]');
    if (!cell || (cell.dataset.drop === 'trash' && dragData.type !== 'dish')) return;
    e.preventDefault();
    document.querySelectorAll('.drop-over').forEach((x) => x !== cell && x.classList.remove('drop-over'));
    cell.classList.add('drop-over');
  });
  document.addEventListener('drop', async (e) => {
    if (!dragData) return;
    const cell = e.target.closest('.mcell, [data-drop="trash"]');
    if (!cell) return;
    e.preventDefault();
    const dd = dragData; dragData = null;
    cell.classList.remove('drop-over');
    try {
      if (dd.type === 'rid') { await App.addDish(cell.dataset.date, cell.dataset.slot, { rid: dd.rid }); return; }
      // перенос блюда: убрать из исходной ячейки, добавить в новую
      const src = App.menuDay(dd.date);
      const list = [...(src[dd.slot] || [])];
      const [dish] = list.splice(dd.j, 1);
      if (!dish) return;
      if (cell.dataset.drop === 'trash') { await Store.save('menu', { ...src, [dd.slot]: list }); toast('Убрано из меню'); return; }
      const { date, slot } = cell.dataset;
      if (date === dd.date && slot === dd.slot) return;
      if (date === dd.date) {
        await Store.save('menu', { ...src, [dd.slot]: list, [slot]: [...(src[slot] || []), dish] });
      } else {
        const dst = App.menuDay(date);
        await Store.saveMany('menu', [{ ...src, [dd.slot]: list }, { ...dst, [slot]: [...(dst[slot] || []), dish] }]);
      }
    } catch (err) { fail(err); }
  });

  // =====================================================================
  // ПЕЧАТЬ (и сохранение в PDF через окно печати)
  // =====================================================================
  function printHTML(title, html) {
    let area = $('#print-area');
    if (!area) { area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
    area.innerHTML = html;
    const old = document.title;
    document.title = title; // имя файла при «Сохранить как PDF»
    setTimeout(() => { window.print(); document.title = old; }, 50);
  }
  const ingLine = (i, f = 1) => esc(App.ingText(i, f));
  function recipeHTML(r) {
    const steps = App.recipeSteps(r);
    return `<article class="p-recipe">
      <h1>${esc(r.title)}</h1>
      <p class="p-meta">${esc([r.category, r.servings, r.time].filter(Boolean).join(' · '))}${r.url ? `<br><small>${esc(r.url)}</small>` : ''}</p>
      ${r.image ? `<img class="p-photo" src="${esc(r.image)}" alt="">` : ''}
      <div class="p-cols">
        <section><h2>Ингредиенты</h2><ul>${(r.ingredients || []).map((i) => `<li>${ingLine(i, App.scaleOf(r))}</li>`).join('') || '<li>—</li>'}</ul></section>
        <section><h2>Приготовление</h2>${steps.length ? `<ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p>—</p>'}
          ${r.notes ? `<h2>Заметки</h2><p>${esc(r.notes)}</p>` : ''}</section>
      </div></article>`;
  }
  function printRecipe(r) { printHTML(r.title, recipeHTML(r)); }
  function printCookbook(list, title = 'Наши рецепты') {
    if (!list.length) { toast('Нет рецептов для печати'); return; }
    const sorted = [...list].sort((a, b) => App.RECIPE_CATS.indexOf(a.category) - App.RECIPE_CATS.indexOf(b.category) || String(a.title).localeCompare(String(b.title), 'ru'));
    const toc = sorted.map((r, i) => `<li>${esc(r.title)} <small>${esc(r.category || '')}</small></li>`).join('');
    printHTML(title, `<section class="p-cover"><h1>${esc(title)}</h1><p>${sorted.length} ${U.plural(sorted.length, 'рецепт', 'рецепта', 'рецептов')} · ${esc(U.fmtDate(U.today()))}</p><ol class="p-toc">${toc}</ol></section>` +
      sorted.map((r) => `<div class="p-page">${recipeHTML(r)}</div>`).join(''));
  }
  async function printMenu() {
    const days = App.weekDays(ui.menuWeek || 0);
    const need = await App.weekToShopping();
    printHTML(`Меню ${U.fmtDate(days[0])} – ${U.fmtDate(days[6])}`, `
      <h1>Меню на неделю: ${esc(U.fmtDate(days[0]))} – ${esc(U.fmtDate(days[6]))}</h1>
      <table class="p-menu"><thead><tr><th></th>${App.SLOTS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
      <tbody>${days.map((d, i) => { const day = App.menuDay(d); return `<tr><th>${App.WD[i]}<br><small>${esc(U.fmtDate(d))}</small></th>${App.SLOTS.map(([k]) => `<td>${(day[k] || []).map((x) => esc(App.dishTitle(x))).join('<br>')}</td>`).join('')}</tr>`; }).join('')}</tbody></table>
      ${need.length ? `<h2>Купить для меню</h2><ul class="p-check">${need.map((n) => `<li>☐ ${esc(n.name)}${n.qty ? ' — ' + esc(U.fmtQty(n.qty, n.unit)) : ''}</li>`).join('')}</ul>` : ''}`);
  }
  function printShopping() {
    const todo = Store.all('shopping').filter((s) => s.status !== 'bought');
    if (!todo.length) { toast('Список покупок пуст'); return; }
    const groups = {};
    todo.forEach((s) => { const c = App.catOf(s.name); (groups[c] = groups[c] || []).push(s); });
    printHTML('Список покупок', `<h1>Купить · ${esc(U.fmtDate(U.today()))}</h1><div class="p-shop">${Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ru')).map((c) =>
      `<section><h2>${esc(c)}</h2><ul class="p-check">${groups[c].map((s) => `<li>☐ ${esc(s.name)}${s.qty || s.unit ? ' — ' + esc(U.fmtQty(s.qty, s.unit)) : ''}</li>`).join('')}</ul></section>`).join('')}</div>`);
  }
  function printContext() {
    const r = App.route();
    if (r.name === 'recipe' || r.name === 'cook') { const rec = Store.get('recipes', r.id); if (rec) return printRecipe(rec); }
    if (r.name === 'menu') return printMenu();
    if (r.name === 'shopping') return printShopping();
    if (r.name === 'recipes' && selected.size) return printCookbook(Store.all('recipes').filter((x) => selected.has(x.id)), 'Выбранные рецепты');
    toast('Печать есть для рецепта, меню и списка покупок. Остальное — в «Инструментах»');
  }
  Object.assign(App.actions, {
    'print-menu': () => printMenu().catch(fail),
    'print-shopping': () => printShopping(),
    'print-recipe': (el) => printRecipe(Store.get('recipes', el.dataset.id)),
    'print-liked': () => printCookbook(Store.all('recipes').filter((r) => r.status === 'liked'), 'Наши любимые рецепты'),
    'print-all': () => printCookbook(Store.all('recipes'), 'Все наши рецепты'),
  });
  App.hooks.recipeActions = (r) => `<button class="btn" data-act="print-recipe" data-id="${esc(r.id)}">${icon('print')}<span>Печать</span></button>`;
  App.hooks.shoppingActions = () => `<button class="btn grow" data-act="print-shopping">${icon('print')}<span>Печать</span></button>`;

  // =====================================================================
  // EXCEL
  // =====================================================================
  async function loadXLSX() { await Receipt.loadScript(XLSX_URL); return window.XLSX; }
  async function exportExcel() {
    const X = await loadXLSX();
    const wb = X.utils.book_new();
    const add = (name, rows, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map((w) => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    add('Рецепты', [['Название', 'Категория', 'Статус', 'Порций', 'Время', 'Ингредиенты', 'Приготовление', 'Заметки', 'Ссылка', 'Готовили раз', 'Последний раз']]
      .concat(Store.all('recipes').map((r) => [r.title, r.category || '', App.STATUS[r.status || 'new'], r.servings || '', r.time || '',
        (r.ingredients || []).map((i) => i.raw || [i.name, U.fmtQty(i.qty, i.unit)].filter(Boolean).join(' ')).join('\n'), r.steps || '', r.notes || '', r.url || '',
        (r.cooked || []).length, App.lastCooked(r)])), [34, 16, 14, 10, 10, 40, 60, 30, 30, 8, 12]);
    const menu = Store.all('menu').filter((m) => m.date).sort((a, b) => a.date.localeCompare(b.date));
    add('Меню', [['Дата', 'День', 'Завтрак', 'Обед', 'Ужин']].concat(menu.map((m) => [m.date, App.WD[(U.parseDate(m.date).getDay() + 6) % 7],
      ...App.SLOTS.map(([k]) => (m[k] || []).map(App.dishTitle).join(', '))])), [12, 6, 30, 30, 40]);
    add('Покупки', [['Дата', 'Продукт', 'Кол-во', 'Ед.', 'Цена, ₽', 'Магазин']].concat(Store.all('shopping').filter((s) => s.status === 'bought')
      .sort((a, b) => String(b.bought_on).localeCompare(String(a.bought_on))).map((s) => [s.bought_on || '', s.name, s.qty || '', s.unit || '', App.priceOf(s) || '', s.shop || ''])), [12, 30, 8, 8, 10, 16]);
    add('Купить', [['Продукт', 'Кол-во', 'Ед.', 'Заметка']].concat(Store.all('shopping').filter((s) => s.status !== 'bought').map((s) => [s.name, s.qty || '', s.unit || '', s.note || ''])), [30, 8, 8, 40]);
    add('Есть дома', [['Продукт', 'Кол-во', 'Ед.']].concat(App.pantry().map((p) => [p.name, p.qty || '', p.unit || ''])), [30, 8, 8]);
    add('Заготовки', [['Название', 'Тип', 'Для кого', 'Сделано', 'Годен до', 'Кол-во', 'Ед.', 'Где', 'Израсходовано']].concat(Store.all('preserves').map((p) =>
      [p.name, p.kind === 'jar' ? 'заготовка' : 'заморозка', p.owner === 'savva' ? 'Савва' : 'мы', p.made_on || '', p.expires_on || '', p.qty || '', p.unit || '', p.place || '', p.finished ? 'да' : ''])), [30, 12, 10, 12, 12, 8, 10, 14, 12]);
    X.writeFile(wb, `nasha-kuhnya-${U.today()}.xlsx`);
    toast('Файл Excel сохранён');
  }

  const CAT_FROM_HEADER = [[/завтрак/, 'Завтраки'], [/суп/, 'Супы'], [/втор|основн|горяч/, 'Основные блюда'], [/гарнир/, 'Гарниры'], [/салат/, 'Салаты'],
    [/закуск/, 'Закуски'], [/выпечк/, 'Выпечка'], [/десерт|сладк/, 'Десерты'], [/напит/, 'Напитки'], [/соус/, 'Соусы'], [/детск|савв/, 'Детское (Савва)']];
  const excelDate = (X, v) => {
    if (typeof v === 'number') { const d = X.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''; }
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  };
  async function importExcel(file) {
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    const existing = new Set(Store.all('recipes').map((r) => U.norm(r.title)));
    const seeds = new Map((window.SEED_RECIPES || []).map((s) => [U.norm(s[0]), s]));
    const newRecipes = [], menuDays = new Map(), menuSheets = [];
    let skipped = 0;
    // id назначаем сразу, чтобы меню из той же таблицы могло сослаться на новый рецепт
    const addRecipe = (r) => { const n = U.norm(r.title); if (!n) return; if (existing.has(n)) { skipped++; return; } existing.add(n); newRecipes.push({ ...r, id: U.uuid() }); };
    for (const name of wb.SheetNames) {
      const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }).filter((r) => r.some((c) => String(c).trim()));
      if (!rows.length) continue;
      const head = rows[0].map((h) => U.norm(String(h)));
      const col = (re) => head.findIndex((h) => re.test(h));
      if (col(/^название/) >= 0 && col(/ингредиент/) >= 0) {
        // наш формат «Рецепты»
        const c = { t: col(/^название/), cat: col(/категор/), st: col(/статус/), sv: col(/порци/), tm: col(/время/), ing: col(/ингредиент/), stp: col(/приготов/), nt: col(/заметк/), url: col(/ссылк/) };
        const stOf = (s) => Object.entries(App.STATUS).find(([, v]) => U.norm(v) === U.norm(s))?.[0] || 'new';
        rows.slice(1).forEach((r) => addRecipe({
          title: String(r[c.t]).trim(), category: c.cat >= 0 ? String(r[c.cat]).trim() : '', status: c.st >= 0 ? stOf(r[c.st]) : 'new',
          servings: c.sv >= 0 ? String(r[c.sv]) : '', time: c.tm >= 0 ? String(r[c.tm]) : '', ingredients: App.parseIngredients(String(r[c.ing] || '')),
          steps: c.stp >= 0 ? String(r[c.stp]) : '', notes: c.nt >= 0 ? String(r[c.nt]) : '', url: c.url >= 0 ? String(r[c.url]) : '', image: '',
        }));
      } else if (col(/^дата/) >= 0 && (col(/завтрак/) >= 0 || col(/обед/) >= 0 || col(/ужин/) >= 0)) {
        menuSheets.push({ rows, cd: col(/^дата/), slotCols: { breakfast: col(/завтрак/), lunch: col(/обед/), dinner: col(/ужин/) } });
      } else if (head.some((h) => CAT_FROM_HEADER.some(([re]) => re.test(h)))) {
        // таблица как «Меню недели.xlsx»: столбцы — категории, ячейки — блюда
        head.forEach((h, ci) => {
          const cat = (CAT_FROM_HEADER.find(([re]) => re.test(h)) || [])[1];
          if (!cat) return;
          rows.slice(1).forEach((r) => {
            const title = String(r[ci] || '').trim();
            if (!title) return;
            const s = seeds.get(U.norm(title));
            addRecipe({ title, category: cat, status: 'liked', url: '', image: '', time: '', steps: '', notes: `Из таблицы «${file.name}»`,
              servings: s ? App.servWord(s[2]) : '', ingredients: s ? App.parseIngredients(s[3].split(';').join('\n')) : [] });
          });
        });
      }
    }
    // меню по датам — после рецептов, чтобы блюда ссылались и на только что добавленные
    const byTitle = new Map([...Store.all('recipes'), ...newRecipes].map((r) => [U.norm(r.title), r.id]));
    for (const { rows, cd, slotCols } of menuSheets) {
      rows.slice(1).forEach((r) => {
        const date = excelDate(X, r[cd]);
        if (!date) return;
        const day = menuDays.get(date) || { ...App.menuDay(date) };
        Object.entries(slotCols).forEach(([k, ci]) => {
          if (ci < 0) return;
          String(r[ci] || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach((t) => {
            const rid = byTitle.get(U.norm(t));
            const dish = rid ? { rid } : { text: t };
            if (!(day[k] || []).some((x) => (x.rid && x.rid === dish.rid) || (x.text && U.norm(x.text) === U.norm(t)))) day[k] = [...(day[k] || []), dish];
          });
        });
        menuDays.set(date, day);
      });
    }
    if (!newRecipes.length && !menuDays.size) { toast(skipped ? `Новых рецептов нет: все ${skipped} уже есть` : 'В таблице не нашлось рецептов или меню'); return; }
    const ok = await App.confirmBox(`Из «${file.name}»: рецептов ${newRecipes.length}${skipped ? ` (ещё ${skipped} уже есть — пропущу)` : ''}${menuDays.size ? `, дней меню ${menuDays.size}` : ''}. Добавить?`, 'Добавить');
    if (!ok) return;
    if (newRecipes.length) await Store.saveMany('recipes', newRecipes);
    if (menuDays.size) await Store.saveMany('menu', [...menuDays.values()]);
    toast(`Добавлено: рецептов ${newRecipes.length}${menuDays.size ? `, дней меню ${menuDays.size}` : ''}`);
  }
  Object.assign(App.actions, { 'excel-export': () => exportExcel().catch(fail) });

  // =====================================================================
  // МАССОВАЯ ПРАВКА РЕЦЕПТОВ
  // =====================================================================
  const selected = new Set();
  let visibleIds = [];
  App.hooks.recipeListTop = (list) => {
    visibleIds = list.map((r) => r.id);
    [...selected].forEach((id) => { if (!Store.get('recipes', id)) selected.delete(id); });
    if (!selected.size) return '';
    return `<div class="bulkbar">
      <b>Выбрано: ${selected.size}</b>
      <select id="bulk-cat" aria-label="Категория"><option value="">Категория…</option>${App.RECIPE_CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      <select id="bulk-status" aria-label="Статус"><option value="">Статус…</option>${Object.entries(App.STATUS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
      <button class="btn small primary" data-act="bulk-apply">Применить</button>
      <button class="btn small" data-act="bulk-print">${icon('print')}<span>Печать</span></button>
      <button class="btn small danger-ghost" data-act="bulk-del">${icon('trash')}<span>Удалить</span></button>
      <button class="btn small" data-act="bulk-clear">Снять выбор</button>
    </div>`;
  };
  App.hooks.recipeRowStart = (r) => (r
    ? `<span class="rsel ${selected.has(r.id) ? 'on' : ''}" role="checkbox" aria-checked="${selected.has(r.id)}" aria-label="Выбрать" data-act="rsel" data-id="${esc(r.id)}">${icon('check')}</span>`
    : `<span class="rsel ${visibleIds.length && visibleIds.every((id) => selected.has(id)) ? 'on' : ''}" role="checkbox" aria-label="Выбрать все" title="Выбрать все" data-act="rsel-all">${icon('check')}</span>`);
  Object.assign(App.actions, {
    rsel: (el) => { const id = el.dataset.id; if (selected.has(id)) selected.delete(id); else selected.add(id); App.refresh(); },
    'rsel-all': () => { const all = visibleIds.length && visibleIds.every((id) => selected.has(id)); visibleIds.forEach((id) => (all ? selected.delete(id) : selected.add(id))); App.refresh(); },
    'bulk-clear': () => { selected.clear(); App.refresh(); },
    'bulk-apply': async () => {
      const cat = $('#bulk-cat').value, st = $('#bulk-status').value;
      if (!cat && !st) { toast('Выберите категорию или статус'); return; }
      const list = [...selected].map((id) => Store.get('recipes', id)).filter(Boolean).map((r) => ({ ...r, ...(cat ? { category: cat } : {}), ...(st ? { status: st } : {}) }));
      await Store.saveMany('recipes', list);
      toast(`Изменено рецептов: ${list.length}`);
    },
    'bulk-print': () => printCookbook([...selected].map((id) => Store.get('recipes', id)).filter(Boolean), 'Выбранные рецепты'),
    'bulk-del': async () => {
      if (!(await App.confirmBox(`Удалить выбранные рецепты (${selected.size})? Это нельзя отменить.`))) return;
      for (const id of [...selected]) await Store.remove('recipes', id);
      toast(`Удалено: ${selected.size}`);
      selected.clear(); App.refresh();
    },
  });

  // =====================================================================
  // АНАЛИТИКА РАСХОДОВ
  // =====================================================================
  const BUDGET_ID = 'settings-budget';
  const budget = () => Number((Store.get('settings', BUDGET_ID) || {}).monthly) || 0;
  const unitBase = (unit) => ({ 'г': ['кг', 0.001], 'кг': ['кг', 1], 'мл': ['л', 0.001], 'л': ['л', 1] })[unit] || [unit || 'шт', 1];
  App.views.stats = function viewStats() {
    const bought = Store.all('shopping').filter((s) => s.status === 'bought' && s.bought_on && App.priceOf(s));
    const month = U.today().slice(0, 7);
    const inMonth = bought.filter((s) => s.bought_on.startsWith(month));
    const spent = inMonth.reduce((t, s) => t + App.priceOf(s), 0);
    const d = new Date(), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), day = d.getDate();
    const forecast = day ? (spent / day) * dim : 0, b = budget();
    const state = !b ? '' : forecast > b * 1.05 ? 'bad' : forecast > b * 0.9 ? 'warn' : 'ok';
    // по неделям, 12 недель
    const mon0 = App.weekDays(0)[0];
    const weeks = [...Array(12)].map((_, i) => U.addDays(mon0, -7 * (11 - i)));
    const wsum = weeks.map((w) => bought.filter((s) => s.bought_on >= w && s.bought_on < U.addDays(w, 7)).reduce((t, s) => t + App.priceOf(s), 0));
    const wmax = Math.max(1, ...wsum);
    // магазины
    const shops = {};
    bought.forEach((s) => { const k = s.shop || 'не указан'; shops[k] = shops[k] || { sum: 0, checks: new Set(), month: 0 }; shops[k].sum += App.priceOf(s); shops[k].checks.add(s.receipt || s.bought_on); if (s.bought_on.startsWith(month)) shops[k].month += App.priceOf(s); });
    // динамика цен: цена за единицу по покупкам одного продукта
    const series = {};
    bought.filter((s) => !s.lump).forEach((s) => {
      const q = U.qtyVal(s.qty); const [bu, k] = unitBase(s.unit);
      const qty = isFinite(q) && q > 0 ? q * k : (s.qty ? NaN : 1);
      if (!isFinite(qty) || qty <= 0) return;
      const key = U.norm(s.name) + '|' + bu;
      (series[key] = series[key] || { name: s.name, unit: bu, pts: [] }).pts.push({ date: s.bought_on, p: App.priceOf(s) / qty, shop: s.shop || '' });
    });
    const dyn = Object.values(series).filter((x) => x.pts.length >= 2).map((x) => {
      const pts = x.pts.sort((a, b) => a.date.localeCompare(b.date)), last = pts[pts.length - 1], prev = pts[pts.length - 2];
      const min = pts.reduce((a, b) => (b.p < a.p ? b : a)), max = Math.max(...pts.map((p) => p.p));
      return { ...x, last, prev, change: (last.p - prev.p) / prev.p, min, max, n: pts.length };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 40);
    const pr = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('ru-RU') + ' ₽';
    if (!bought.length) return `<div class="page-head"><h1>Аналитика</h1></div><div class="empty">${icon('chart', 'big')}<h3>Пока нет покупок с ценами</h3><p>Сканируйте чеки (Покупки → «Чек» или перетащите фото чека в окно) или вписывайте цены в истории покупок.</p></div>`;
    return `
      <div class="page-head"><h1>Аналитика</h1></div>
      <div class="stats stats-3">
        <div class="stat ${state}"><small>${esc(App.monthLabel(month, true).replace(/^./, (c) => c.toUpperCase()))}: потрачено</small><b>${App.rub(spent)}</b>
          <small class="muted">${b ? `из бюджета ${App.rub(b)} · ${Math.round((spent / b) * 100)}%` : 'бюджет не задан'}</small></div>
        <div class="stat ${state}"><small>Прогноз на месяц</small><b>${App.rub(forecast)}</b>
          <small class="muted">${b ? (state === 'bad' ? '⚠ превысим бюджет на ' + App.rub(forecast - b) : state === 'warn' ? 'почти впритык к бюджету' : 'укладываемся в бюджет') : 'при текущем темпе трат'}</small></div>
        <form class="stat" data-form="budget"><small>Бюджет на продукты в месяц</small>
          <div class="row"><input name="monthly" inputmode="numeric" value="${b || ''}" placeholder="например, 40000"><button class="btn small primary">OK</button></div>
          <small class="muted">Общий для вас обоих</small></form>
      </div>
      <section class="card"><h2>По неделям</h2>
        <div class="wbars" role="img" aria-label="Расходы по неделям">${weeks.map((w, i) => `<div class="wbar" title="Неделя с ${esc(U.fmtDate(w))}: ${App.rub(wsum[i])}">
          <span class="mv">${wsum[i] ? Math.round(wsum[i] / 1000 * 10) / 10 + 'к' : ''}</span><span class="col"><i style="height:${Math.round((wsum[i] / wmax) * 100)}%"></i></span><span class="ml">${w.slice(8, 10)}.${w.slice(5, 7)}</span></div>`).join('')}</div></section>
      <div class="two-col">
        <section class="card"><h2>Магазины</h2>
          <table class="dtable"><thead><tr><th>Магазин</th><th>Этот месяц</th><th>Всего</th><th>Покупок</th><th>Средний чек</th></tr></thead>
          <tbody>${Object.entries(shops).sort((a, b) => b[1].sum - a[1].sum).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${App.rub(v.month)}</td><td>${App.rub(v.sum)}</td><td>${v.checks.size}</td><td>${App.rub(v.sum / v.checks.size)}</td></tr>`).join('')}</tbody></table></section>
        <section class="card"><h2>Динамика цен</h2>
          ${dyn.length ? `<table class="dtable"><thead><tr><th>Продукт</th><th>Сейчас</th><th>Было</th><th>Изменение</th><th>Дешевле всего</th></tr></thead>
          <tbody>${dyn.map((x) => `<tr title="Покупок: ${x.n}, от ${pr(x.min.p)} до ${pr(x.max)} за ${esc(x.unit)}"><td>${esc(x.name)}</td><td>${pr(x.last.p)}/${esc(x.unit)}</td><td>${pr(x.prev.p)}</td>
            <td class="${x.change > 0.005 ? 'up' : x.change < -0.005 ? 'down' : ''}">${x.change > 0 ? '▲' : x.change < 0 ? '▼' : ''} ${Math.abs(Math.round(x.change * 100))}%</td>
            <td>${pr(x.min.p)}${x.min.shop ? ' · ' + esc(x.min.shop) : ''}</td></tr>`).join('')}</tbody></table>`
          : '<p class="muted">Появится, когда один и тот же продукт будет куплен хотя бы дважды с ценой.</p>'}</section>
      </div>`;
  };
  App.forms.budget = async (f) => {
    const v = Number(String(f.monthly.value).replace(/\s/g, '')) || 0;
    await Store.save('settings', { ...(Store.get('settings', BUDGET_ID) || {}), id: BUDGET_ID, monthly: v });
    toast(v ? `Бюджет: ${App.rub(v)} в месяц` : 'Бюджет убран');
  };

  // =====================================================================
  // ГОРЯЧИЕ КЛАВИШИ
  // =====================================================================
  const HOTKEYS = [
    ['Ctrl + V', 'вставить рецепт: текст, скриншот или ссылку; фото чека с QR — как чек'],
    ['N', 'новый рецепт'], ['/', 'поиск на странице'], ['Alt + 1…8', 'разделы по порядку'],
    ['← →', 'неделя назад / вперёд в меню'], ['Ctrl + Enter или Ctrl + S', 'сохранить открытое окно'],
    ['Ctrl + P', 'печать: рецепт, меню или список покупок'], ['Esc', 'закрыть окно'], ['?', 'эта подсказка'],
  ];
  const hotkeysHTML = () => `<table class="dtable keys">${HOTKEYS.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  document.addEventListener('keydown', (e) => {
    if (App.needLogin()) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    const modal = $('#modal');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'Enter' || e.code === 'KeyS')) {
      const f = modal.open && $('#modal form');
      if (f) { e.preventDefault(); f.requestSubmit(); }
      return;
    }
    if (mod && e.code === 'KeyP') { e.preventDefault(); printContext(); return; }
    if (typing || modal.open || mod) return;
    if (e.altKey && /^Digit[1-8]$/.test(e.code)) { const n = App.NAV[+e.code.slice(5) - 1]; if (n) { e.preventDefault(); location.hash = '#/' + n.r; } return; }
    if (e.altKey) return;
    const r = App.route().name;
    if (e.code === 'Slash' && e.shiftKey) { e.preventDefault(); App.openModal(`<div class="form"><div class="form-head"><h2>Горячие клавиши</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('x')}</button></div>${hotkeysHTML()}</div>`); return; }
    if (e.code === 'Slash') { const s = $('#view input[type="search"]'); if (s) { e.preventDefault(); s.focus(); s.select(); } return; }
    if (e.code === 'KeyN') { e.preventDefault(); App.actions['recipe-new'](); return; }
    if (r === 'menu' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { ui.menuWeek = (ui.menuWeek || 0) + (e.code === 'ArrowLeft' ? -1 : 1); App.saveUI(); App.refresh(); }
  });

  // =====================================================================
  // ИНСТРУМЕНТЫ
  // =====================================================================
  App.views.tools = function viewTools() {
    const installed = matchMedia('(display-mode: standalone)').matches;
    return `
      <div class="page-head"><h1>Инструменты</h1></div>
      <div class="tools">
        <section class="card"><h2>${icon('upload')} Быстро добавить</h2>
          <p><b>Ctrl + V</b> в любом месте: вставит рецепт из скопированного текста, скриншота или ссылки. Фото чека с QR-кодом распознается как чек.</p>
          <p><b>Перетащите файлы</b> в окно: txt, pdf, Word, скриншоты, фото чеков, таблицы Excel. Несколько скриншотов одного рецепта соберутся в один рецепт. Если форма рецепта уже открыта, вставленное допишется в неё.</p>
          <label class="dropzone">${icon('upload')}<span>или выберите файлы</span><input type="file" multiple data-act-change="desk-files" hidden></label>
        </section>
        <section class="card"><h2>${icon('bookmark')} Закладка «В Нашу кухню»</h2>
          <p>Перетащите эту кнопку на панель закладок браузера (если панели не видно, нажмите Ctrl + Shift + B):</p>
          <p><a class="btn primary bookmarklet" href="${esc(bookmarkletCode())}" title="Перетащите на панель закладок">${icon('bookmark')}<span>В Нашу кухню</span></a></p>
          <ol class="small">
            <li>Откройте рецепт на любом сайте или пост в Instagram (в Instagram нужно быть залогиненным).</li>
            <li>Нажмите закладку: откроется приложение с уже заполненным рецептом. Проверьте и сохраните.</li>
            <li>Если подтянулось не то, <b>выделите мышкой текст рецепта</b> на странице и нажмите закладку ещё раз: возьмётся только выделенное.</li>
          </ol>
        </section>
        <section class="card"><h2>${icon('print')} Печать и PDF</h2>
          <p class="small muted">Откроется окно печати. Чтобы получить файл, выберите принтер «Сохранить как PDF».</p>
          <div class="row wrap">
            <button class="btn" data-act="print-menu">Меню этой недели</button>
            <button class="btn" data-act="print-shopping">Список покупок</button>
            <button class="btn" data-act="print-liked">Книга любимых рецептов</button>
            <button class="btn" data-act="print-all">Все рецепты</button>
          </div>
          <p class="small muted">Отдельный рецепт печатается кнопкой «Печать» в рецепте, несколько выбранных — из списка рецептов (галочки слева).</p>
        </section>
        <section class="card"><h2>${icon('sheet')} Excel</h2>
          <p>Выгрузить всё в таблицу: рецепты, меню, покупки с ценами, «есть дома», заготовки.</p>
          <div class="row wrap">
            <button class="btn primary" data-act="excel-export">${icon('download')}<span>Сохранить в Excel</span></button>
            <label class="btn">${icon('upload')}<span>Загрузить из Excel</span><input type="file" accept=".xlsx,.xls,.csv" data-act-change="excel-import" hidden></label>
          </div>
          <p class="small muted">Загрузка понимает три вида таблиц: выгрузку этого приложения (лист «Рецепты»); таблицу вроде «Меню недели.xlsx», где столбцы — категории (Завтрак, Суп, Вторые…), а в ячейках блюда; меню по датам со столбцами «Дата, Завтрак, Обед, Ужин». Рецепты, которые уже есть, не дублируются.</p>
        </section>
        <section class="card"><h2>${icon('keyboard')} Горячие клавиши</h2>${hotkeysHTML()}</section>
        <section class="card"><h2>${icon('download')} Установить как программу</h2>
          ${installed ? `<p>${icon('check')} Уже установлено и открыто как отдельная программа.</p>` : `
          ${App.canInstall() ? `<p><button class="btn primary" data-act="desk-install">${icon('download')}<span>Установить «Наша кухня» на компьютер</span></button></p>` : ''}
          <p class="small">Chrome или Edge: значок установки справа в адресной строке (монитор со стрелкой) или меню ⋮ → «Сохранить и поделиться» / «Приложения» → «Установить». Появится ярлык на рабочем столе и в меню «Пуск», приложение будет открываться в своём окне.</p>`}
          <p class="small muted">Версия для телефона: <a href="./">${esc(location.origin + location.pathname.replace(/desktop\.html$/, ''))}</a></p>
        </section>
      </div>`;
  };
  App.actions['desk-install'] = async () => { if (await App.install()) App.refresh(); };
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.actChange === 'desk-files' && el.files.length) { const files = [...el.files]; el.value = ''; handleIncoming({ files }); }
    if (el.dataset.actChange === 'excel-import' && el.files.length) { const f = el.files[0]; el.value = ''; importExcel(f).catch(fail); }
  });
  // закладку нельзя «нажать» в самом приложении — подсказываем
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.bookmarklet');
    if (a) { e.preventDefault(); toast('Перетащите кнопку на панель закладок браузера'); }
  });

  App.onReady(() => {
    checkImportHash();
    // установленная программа: файлы, открытые через «Открыть с помощью → Наша кухня»
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (params) => {
        if (!params.files || !params.files.length) return;
        const files = await Promise.all(params.files.map((h) => h.getFile()));
        handleIncoming({ files });
      });
    }
  });
})();
