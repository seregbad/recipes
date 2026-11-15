// Хранилище данных. Два режима:
//  • local — всё в браузере (localStorage), пока не подключён Supabase;
//  • cloud — общая база Supabase для двоих, с живым обновлением.
// В облачном режиме приложение работает «сначала у себя»: любое изменение сразу сохраняется на устройстве
// и показывается на экране, а в базу уходит в фоне. Плохая связь ничего не подвешивает: каждый запрос
// ограничен по времени, неотправленное лежит в очереди и досылается само.
// Все записи — объекты с полем id; «kind» — коллекция: recipes, pantry, shopping, preserves, custom_ingredients, menu, settings.
(function () {
  const LOCAL_KEY = 'nasha-kuhnya:v1';
  const CACHE_KEY = 'nasha-kuhnya:cloud-cache:v1';
  const OUTBOX_KEY = 'nasha-kuhnya:outbox:v1';
  const USER_KEY = 'nasha-kuhnya:user';
  const KINDS = ['recipes', 'pantry', 'shopping', 'preserves', 'custom_ingredients', 'menu', 'settings'];

  const Store = {
    mode: 'local',
    client: null,
    session: null,
    data: {},
    listeners: [],
    pending: [],   // неотправленные изменения: {op:'upsert', row:{id,kind,data,updated_at}} | {op:'delete', id}
    net: 'ok',     // ok — связь с базой есть; offline — нет интернета; down — интернет есть, база не отвечает; auth — база не пускает
    syncing: false,
    realtime: '',
  };
  KINDS.forEach((k) => (Store.data[k] = []));

  const cfg = window.APP_CONFIG || {};
  const cloudConfigured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  // в config.js адрес и ключ заданы, а библиотека базы не загрузилась (нет сети при самом первом запуске)
  Store.libMissing = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !window.supabase);

  function emit() { Store.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  Store.onChange = (fn) => Store.listeners.push(fn);
  // сообщения для человека («сервер не принял изменение», «нужно войти заново») — приложение показывает их само
  Store.onProblem = null;
  Store.onSignedOut = null;
  const problem = (text) => { if (Store.onProblem) { try { Store.onProblem(text); } catch (e) { console.error(e); } } };

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  let quotaWarned = false;
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) {
      console.warn('localStorage недоступен или переполнен', e);
      if (!quotaWarned && key !== OUTBOX_KEY) { quotaWarned = true; problem('Память браузера переполнена: копия для работы без интернета не обновляется. Удалите лишние фото из рецептов или сделайте резервную копию'); }
      return false;
    }
  }
  function setAll(obj) {
    KINDS.forEach((k) => (Store.data[k] = Array.isArray(obj && obj[k]) ? obj[k] : []));
  }

  Store.all = (kind) => Store.data[kind] || [];
  Store.get = (kind, id) => Store.all(kind).find((x) => x.id === id);

  // ---------- Сеть ----------
  Store.online = () => navigator.onLine !== false;
  const isNetErr = (e) => !Store.online() || (e && (e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'AuthRetryableFetchError')) ||
    /fetch|network|load failed|timeout|timed out|aborted|нет связи/i.test(String((e && (e.message || e.details)) || e));
  // что за ошибка: net — связь (повторим позже), auth — база не пускает (повторим после входа), bad — сервер отверг сами данные
  function classify(e) {
    const st = e && e.status, msg = String((e && e.message) || e);
    if (isNetErr(e) || st === 0 || st === 408 || st === 429 || st >= 500) return 'net';
    if (st === 401 || st === 403 || (e && (e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST302')) || /jwt|row-level security|permission denied|not authorized/i.test(msg)) return 'auth';
    return 'bad';
  }
  function setNet(v) { if (Store.net !== v) { Store.net = v; emit(); } }
  Store.status = () => ({ mode: Store.mode, online: Store.online(), pending: Store.pending.length, net: Store.online() ? Store.net : 'offline', syncing: Store.syncing });

  // Запрос с ограничением по времени. Обычный fetch может «висеть» минутами, если оператор режет соединение
  // (первые килобайты пришли, дальше тишина), — тогда зависало бы и всё приложение. Тело ответа читаем здесь же,
  // чтобы ограничение действовало и на него.
  async function timedFetch(input, init) {
    const url = String((input && input.url) || input);
    const ms = /\/storage\/v1\//.test(url) ? 90000 : /\/functions\/v1\//.test(url) ? 60000 : 25000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const outer = init && init.signal;
    if (outer) { if (outer.aborted) ctrl.abort(); else outer.addEventListener('abort', () => ctrl.abort(), { once: true }); }
    try {
      const res = await fetch(input, { ...(init || {}), signal: ctrl.signal });
      const empty = [101, 204, 205, 304].includes(res.status) || (init && init.method === 'HEAD');
      const body = empty ? null : await res.arrayBuffer();
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    } catch (e) {
      if (ctrl.signal.aborted && !(outer && outer.aborted)) throw new TypeError('Failed to fetch: timeout');
      throw e;
    } finally { clearTimeout(timer); }
  }

  // ---------- Вход ----------
  // ok — можно работать с базой; net — сейчас не узнать (нет связи); out — вход потерян, нужен пароль
  Store.sessionTimeout = 30000;
  async function ensureSession() {
    try {
      // проверка входа сама ходит в сеть (обновляет ключ) — не даём ей держать очередь дольше полминуты
      const { data, error } = await Promise.race([
        Store.client.auth.getSession(),
        new Promise((r) => setTimeout(() => r({ data: null, error: { name: 'AuthRetryableFetchError', message: 'timeout', status: 0 } }), Store.sessionTimeout)),
      ]);
      if (data && data.session) {
        Store.session = data.session;
        try { localStorage.setItem(USER_KEY, Store.session.user.email || '1'); } catch (e) { /* не страшно */ }
        return 'ok';
      }
      if (error && (isNetErr(error) || !error.status || error.status >= 500)) return 'net';
      return 'out';
    } catch (e) { return 'net'; }
  }
  const knownUser = () => { try { return localStorage.getItem(USER_KEY) || ''; } catch (e) { return ''; } };
  function signedOut() {
    Store.session = null;
    Store.loggedOut = true; // фоновые попытки прекращаются до нового входа
    try { localStorage.removeItem(USER_KEY); } catch (e) { /* не страшно */ }
    if (Store.onSignedOut) Store.onSignedOut(); // очередь и копия данных остаются: после входа всё отправится
  }
  Store.userEmail = () => (Store.session && Store.session.user && Store.session.user.email) || (knownUser().includes('@') ? knownUser() : '');

  // ---------- Очередь ----------
  const opId = (op) => (op.op === 'upsert' ? op.row.id : op.id);
  function enqueue(ops) {
    for (const op of ops) {
      Store.pending = Store.pending.filter((p) => opId(p) !== opId(op));
      Store.pending.push(op);
    }
    writeJSON(OUTBOX_KEY, Store.pending);
  }
  // поверх свежих данных с сервера накладываем то, что ещё не отправлено
  function applyPending() {
    for (const p of Store.pending) {
      if (p.op === 'upsert') { if (Store.data[p.row.kind]) upsertLocal(p.row.kind, { ...p.row.data, id: p.row.id }); }
      else KINDS.forEach((k) => (Store.data[k] = Store.data[k].filter((x) => x.id !== p.id)));
    }
  }
  const fail = (error, status) => Object.assign(new Error(error.message || String(error)), { code: error.code, details: error.details, status });
  async function sendOps(ops) {
    const rows = ops.filter((o) => o.op === 'upsert').map((o) => o.row);
    for (let i = 0; i < rows.length; i += 200) {
      const { error, status } = await Store.client.from('items').upsert(rows.slice(i, i + 200));
      if (error) throw fail(error, status);
    }
    const ids = ops.filter((x) => x.op === 'delete').map((o) => o.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { error, status } = await Store.client.from('items').delete().in('id', ids.slice(i, i + 100));
      if (error) throw fail(error, status);
    }
  }
  const sent = (batch) => { Store.pending = Store.pending.filter((p) => !batch.includes(p)); writeJSON(OUTBOX_KEY, Store.pending); };

  let flushTimer = null, backoff = 0;
  function scheduleFlush(delay) {
    if (Store.mode !== 'cloud') return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { Store.flush().catch((e) => console.error(e)); }, delay || 0);
  }
  function retryLater() { backoff = Math.min(60000, Math.max(4000, backoff * 2)); scheduleFlush(backoff); }

  // Отправить накопленное. Не бросает ошибок: итог виден по Store.pending и Store.net.
  Store.flush = async () => {
    if (Store.mode !== 'cloud' || Store._flushing || !Store.pending.length || Store.loggedOut) return;
    if (!Store.online()) { setNet('offline'); return; }
    Store._flushing = true;
    let rejected = 0;
    try {
      const s = await ensureSession();
      if (s === 'out') { signedOut(); return; }
      if (s !== 'ok') { setNet('down'); retryLater(); return; }
      while (Store.pending.length) {
        const batch = Store.pending.slice(0, 200);
        try {
          await sendOps(batch);
          sent(batch);
        } catch (e) {
          const kind = classify(e);
          if (kind !== 'bad') { setNet(kind === 'net' ? 'down' : 'auth'); retryLater(); return; }
          // сервер не принимает что-то из пачки — шлём по одной и отбрасываем только то, что он отверг
          for (const op of batch) {
            try { await sendOps([op]); } catch (err) {
              const k = classify(err);
              if (k !== 'bad') { setNet(k === 'net' ? 'down' : 'auth'); retryLater(); return; }
              console.error('Сервер не принял изменение, оно отброшено', op, err);
              rejected++;
            }
            sent([op]);
          }
        }
      }
      backoff = 0;
      setNet('ok');
    } finally {
      Store._flushing = false;
      emit();
      if (rejected) {
        problem(`База не приняла ${rejected} изменение — оно отменено`);
        Store.loadCloud().catch(() => {});
      }
    }
  };

  // Перечитать базу целиком
  Store.loadCloud = async () => {
    if (Store._loading) return Store._loading;
    Store._loading = (async () => {
      const s = await ensureSession();
      if (s === 'out') { signedOut(); throw new Error('Нужно войти заново'); }
      if (s !== 'ok') { setNet(Store.online() ? 'down' : 'offline'); throw new TypeError('Failed to fetch: нет связи с базой'); }
      const rows = [];
      try {
        for (let from = 0; ; from += 1000) {
          const { data, error, status } = await Store.client.from('items').select('id, kind, data').order('id').range(from, from + 999);
          if (error) throw fail(error, status);
          rows.push(...data);
          if (data.length < 1000) break;
        }
      } catch (e) {
        const kind = classify(e);
        setNet(kind === 'net' ? (Store.online() ? 'down' : 'offline') : kind === 'auth' ? 'auth' : Store.net);
        throw e;
      }
      const obj = {};
      KINDS.forEach((k) => (obj[k] = []));
      rows.forEach((r) => { if (obj[r.kind]) obj[r.kind].push({ ...r.data, id: r.id }); });
      setAll(obj);
      applyPending();
      writeJSON(CACHE_KEY, Store.data);
      Store.lastSync = new Date().toISOString();
      writeJSON('nasha-kuhnya:last-sync', Store.lastSync);
      Store.net = 'ok';
      emit();
    })();
    try { return await Store._loading; } finally { Store._loading = null; }
  };

  async function sync() {
    if (Store.loggedOut) return;
    Store.syncing = true;
    try {
      await Store.flush();
      await Store.loadCloud();
    } finally { Store.syncing = false; emit(); }
  }
  const syncQuiet = () => sync().catch((e) => { if (classify(e) === 'bad') console.error(e); });
  const sinceSync = () => (Store.lastSync ? Date.now() - new Date(Store.lastSync).getTime() : Infinity);

  // Синхронизация по кнопке: отправить накопленное и перечитать базу прямо сейчас.
  // Возвращает число отправленных изменений; при проблеме бросает понятную ошибку.
  Store.lastSync = readJSON('nasha-kuhnya:last-sync') || '';
  Store.syncNow = async () => {
    if (Store.mode !== 'cloud') return 0;
    if (!Store.online()) throw new Error('Нет интернета. Изменения сохранены на устройстве и отправятся, когда сеть появится');
    const before = Store.pending.length;
    backoff = 0;
    Store.syncing = true; emit();
    try {
      await Store.flush();
      if (Store.pending.length) {
        throw new Error(Store.net === 'auth'
          ? 'База не пускает: выйдите и войдите заново (изменения сохранены на устройстве)'
          : `База не отвечает: не отправлено ${Store.pending.length}. Изменения сохранены на устройстве и отправятся сами. Если так всегда без VPN — откройте «Настройки → Проверить связь»`);
      }
      try { await Store.loadCloud(); } catch (e) {
        throw new Error(classify(e) === 'net' ? 'База не отвечает. Попробуйте ещё раз; если так всегда без VPN — откройте «Настройки → Проверить связь»' : e.message || String(e));
      }
      return before;
    } finally { Store.syncing = false; emit(); }
  };

  // ---------- Инициализация ----------
  Store.init = async () => {
    if (!cloudConfigured) {
      Store.mode = 'local';
      setAll(readJSON(LOCAL_KEY));
      return { needLogin: false };
    }
    Store.mode = 'cloud';
    Store.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { global: { fetch: timedFetch } });
    Store.pending = readJSON(OUTBOX_KEY) || [];
    setAll(readJSON(CACHE_KEY)); // мгновенно показываем последнюю копию
    applyPending();
    // Проверка входа может потребовать сеть (обновление ключа). Кто уже входил на этом устройстве, того не держим:
    // открываем сохранённую копию сразу, а вход и свежие данные подтянутся в фоне.
    const known = !!knownUser();
    const check = ensureSession();
    const s = await Promise.race([check, new Promise((r) => setTimeout(() => r('slow'), known ? 2500 : 15000))]);
    if (s === 'out' || (!known && s !== 'ok')) { Store.loggedOut = true; return { needLogin: true }; }
    if (s !== 'ok') { setNet(Store.online() ? 'down' : 'offline'); check.then((late) => { if (late === 'out') signedOut(); }); }
    Store.subscribe();
    syncQuiet();
    return { needLogin: false };
  };

  Store.login = async (email, password) => {
    if (!Store.online()) throw new Error('Нет интернета, войти не получится');
    let res;
    try { res = await Store.client.auth.signInWithPassword({ email, password }); } catch (e) { res = { error: e }; }
    if (res.error) {
      if (isNetErr(res.error) || !res.error.status) throw new Error('База не отвечает. Проверьте интернет; если без VPN так всегда — см. «Проверить связь» в инструкции');
      throw res.error;
    }
    Store.session = res.data.session;
    Store.loggedOut = false;
    try { localStorage.setItem(USER_KEY, email); } catch (e) { /* не страшно */ }
    Store.subscribe();
    await sync().catch((e) => { if (classify(e) === 'bad') throw e; });
  };

  Store.logout = async () => {
    if (Store.pending.length && !confirm(`Есть неотправленные изменения (${Store.pending.length}). Если выйти, они пропадут. Выйти?`)) return;
    if (Store.client) await Promise.race([Store.client.auth.signOut().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    [CACHE_KEY, OUTBOX_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
    // ключ входа supabase-js хранит сам; если сеть не ответила, убираем его вручную
    Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  Store.subscribe = () => {
    if (Store._channel) return;
    Store._channel = Store.client
      .channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old && payload.old.id;
          KINDS.forEach((k) => (Store.data[k] = Store.data[k].filter((x) => x.id !== id)));
        } else {
          const r = payload.new;
          if (!Store.data[r.kind]) return;
          upsertLocal(r.kind, { ...r.data, id: r.id });
        }
        applyPending();
        writeJSON(CACHE_KEY, Store.data);
        emit();
      })
      .subscribe((status) => {
        const was = Store.realtime;
        Store.realtime = status;
        // живое обновление восстановилось после обрыва — могли что-то пропустить, перечитываем
        if (status === 'SUBSCRIBED' && was && was !== 'SUBSCRIBED') syncQuiet();
      });
    // после возврата во вкладку или появления сети — отправить накопленное и перечитать
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Store.pending.length || Store.realtime !== 'SUBSCRIBED' || sinceSync() > 30000) syncQuiet();
    });
    window.addEventListener('online', () => { backoff = 0; emit(); syncQuiet(); });
    window.addEventListener('offline', () => { setNet('offline'); emit(); });
    // страховка: если живое обновление не работает (оператор режет соединение), раз в минуту перечитываем сами
    setInterval(() => {
      if (document.visibilityState !== 'visible' || !Store.online()) return;
      if (Store.pending.length && !Store._flushing) scheduleFlush(0);
      if (Store.realtime !== 'SUBSCRIBED' ? sinceSync() > 55000 : sinceSync() > 10 * 60000) syncQuiet();
    }, 60000);
  };

  function upsertLocal(kind, obj) {
    const list = Store.data[kind];
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = obj; else list.push(obj);
  }
  function persist() { writeJSON(Store.mode === 'local' ? LOCAL_KEY : CACHE_KEY, Store.data); }

  // ---------- Запись ----------
  // Сохраняется сразу на устройстве; в базу уходит в фоне (без сети — когда она появится).
  Store.save = async (kind, obj) => {
    const item = { ...obj };
    if (!item.id) { item.id = U.uuid(); item.created_at = new Date().toISOString(); }
    item.updated_at = new Date().toISOString();
    upsertLocal(kind, item);
    if (Store.mode === 'cloud') {
      const { id, ...data } = item;
      enqueue([{ op: 'upsert', row: { id, kind, data, updated_at: item.updated_at } }]);
      scheduleFlush(0);
    }
    persist();
    emit();
    return item;
  };

  Store.saveMany = async (kind, objs) => {
    const now = new Date().toISOString();
    const items = objs.map((o) => ({ ...o, id: o.id || U.uuid(), created_at: o.created_at || now, updated_at: now }));
    items.forEach((it) => upsertLocal(kind, it));
    if (Store.mode === 'cloud') {
      enqueue(items.map(({ id, ...data }) => ({ op: 'upsert', row: { id, kind, data, updated_at: now } })));
      scheduleFlush(0);
    }
    persist();
    emit();
    return items;
  };

  Store.remove = async (kind, id) => {
    Store.data[kind] = Store.data[kind].filter((x) => x.id !== id);
    if (Store.mode === 'cloud') { enqueue([{ op: 'delete', id }]); scheduleFlush(0); }
    persist();
    emit();
  };

  // ---------- Резервная копия ----------
  Store.exportJSON = () => JSON.stringify({ app: 'nasha-kuhnya', version: 1, exported_at: new Date().toISOString(), data: Store.data }, null, 2);

  Store.importJSON = async (text) => {
    const parsed = JSON.parse(text);
    const src = parsed.data || parsed;
    let count = 0;
    for (const k of KINDS) {
      if (Array.isArray(src[k]) && src[k].length) { await Store.saveMany(k, src[k]); count += src[k].length; }
    }
    return count;
  };

  // ---------- Фото блюд ----------
  // Облако: хранилище Supabase «photos» → публичная ссылка. Локально: картинка внутри данных.
  Store.uploadPhoto = async (blob) => {
    if (Store.mode === 'local') {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    }
    if (!Store.online()) throw new Error('Нет интернета: фото загрузится, когда появится сеть. Попробуйте позже');
    const path = `${U.uuid()}.jpg`;
    const bucket = Store.client.storage.from('photos');
    const { error } = await bucket.upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' });
    if (error) {
      if (/bucket not found/i.test(error.message)) throw new Error('Хранилище фото не создано: выполните supabase/photos.sql (см. инструкцию)');
      if (isNetErr(error)) throw new Error('Фото не загрузилось: база не отвечает. Попробуйте ещё раз позже');
      throw error;
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  };

  // ---------- Импорт рецепта по ссылке (через функцию Supabase) ----------
  Store.canImport = () => Store.mode === 'cloud';
  Store.importRecipe = async (url) => {
    if (!Store.online()) throw new Error('Нет интернета: загрузить рецепт по ссылке сейчас не получится');
    const { data, error } = await Store.client.functions.invoke(cfg.importFunction || 'import-recipe', { body: { url } });
    if (error) {
      let msg = error.message;
      try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (e) { /* нет тела */ }
      if (isNetErr(error) && !/[а-яё]/i.test(msg)) msg = 'База не отвечает: загрузить рецепт по ссылке не получилось. Попробуйте ещё раз';
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  // ---------- Проверка связи ----------
  // Что работает с этого устройства прямо сейчас: сайт, маленький и большой запрос к базе, Cloudflare, библиотеки.
  // Нужна, чтобы понять, почему без VPN «не синхронизируется»: частая причина — оператор обрывает
  // соединения с Cloudflare (на нём работает Supabase) после первых ~16 КБ.
  Store.diagnose = async (onStep) => {
    const out = [];
    const probe = async (name, url, opts, ms) => {
      const ctrl = new AbortController(), t0 = performance.now();
      const timer = setTimeout(() => ctrl.abort(), ms || 15000);
      const row = { name, ok: false, ms: 0, kb: 0, note: '' };
      try {
        const res = await fetch(url, { cache: 'no-store', ...(opts || {}), signal: ctrl.signal });
        const buf = await res.arrayBuffer();
        row.kb = Math.round(buf.byteLength / 102.4) / 10;
        row.ok = res.status < 500;
        if (!row.ok) row.note = 'ошибка ' + res.status;
      } catch (e) { row.note = ctrl.signal.aborted ? 'не дождались ответа' : 'нет соединения'; }
      clearTimeout(timer);
      row.ms = Math.round(performance.now() - t0);
      out.push(row);
      if (onStep) onStep(out.slice());
      return row;
    };
    const t = Date.now();
    await probe('Сайт приложения (GitHub)', `./manifest.webmanifest?nocache=${t}`);
    if (cloudConfigured) {
      const h = { apikey: cfg.supabaseAnonKey };
      await probe('База: короткий запрос', `${cfg.supabaseUrl}/auth/v1/settings`, { headers: h });
      const token = Store.session && Store.session.access_token;
      if (token) await probe('База: все данные', `${cfg.supabaseUrl}/rest/v1/items?select=id,kind,data`, { headers: { ...h, Authorization: 'Bearer ' + token } }, 25000);
    }
    await probe('Cloudflare: 100 КБ', `https://speed.cloudflare.com/__down?bytes=100000&nocache=${t}`);
    await probe('Библиотеки (jsDelivr)', `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js?nocache=${t}`);
    return out;
  };

  window.Store = Store;
})();
