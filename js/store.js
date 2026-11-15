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
  // Посредник (например, Yandex Cloud API Gateway): если в config.js задан proxyUrl, все запросы к базе идут через него.
  // Нужен, когда оператор режет соединения с Supabase/Cloudflare и без VPN синхронизация не работает.
  const PROXY = String(cfg.proxyUrl || '').trim().replace(/\/+$/, '');
  const BASE = PROXY || cfg.supabaseUrl;
  Store.proxied = !!PROXY;
  // ключ входа оставляем прежним, чтобы после включения посредника не пришлось входить заново
  let STORAGE_KEY;
  try { STORAGE_KEY = `sb-${new URL(cfg.supabaseUrl).hostname.split('.')[0]}-auth-token`; } catch (e) { /* адреса нет — локальный режим */ }
  // ссылки на фото в данных хранятся с адресом Supabase, а показываются через посредника
  Store.mediaUrl = (u) => (PROXY && typeof u === 'string' && cfg.supabaseUrl && u.startsWith(cfg.supabaseUrl) ? PROXY + u.slice(cfg.supabaseUrl.length) : u);
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
      // через посредника ответ не больше 2,5 МБ — читаем меньшими порциями
      const PAGE = PROXY ? 150 : 1000;
      try {
        for (let from = 0; ; from += PAGE) {
          const { data, error, status } = await Store.client.from('items').select('id, kind, data, updated_at').order('id').range(from, from + PAGE - 1);
          if (error) throw fail(error, status);
          rows.push(...data);
          if (data.length < PAGE) break;
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
      fingerprint = `${rows.length}|${rows.reduce((m, r) => (String(r.updated_at || '') > m ? String(r.updated_at) : m), '')}`;
      lastFull = Date.now();
      markSynced();
      Store.net = 'ok';
      emit();
    })();
    try { return await Store._loading; } finally { Store._loading = null; }
  };
  function markSynced() {
    Store.lastSync = new Date().toISOString();
    writeJSON('nasha-kuhnya:last-sync', Store.lastSync);
  }

  // Лёгкая проверка «изменилось ли что-то в базе»: число записей и время последней правки (ответ — пара сотен байт).
  // Нужна, когда живое обновление не работает (через посредника его нет): базу целиком перечитываем, только если она изменилась.
  let fingerprint = '', lastFull = 0;
  async function poll() {
    if (Store.loggedOut || Store._loading) return;
    await Store.flush();
    const s = await ensureSession();
    if (s === 'out') { signedOut(); return; }
    if (s !== 'ok') { setNet(Store.online() ? 'down' : 'offline'); return; }
    const { data, count, error, status } = await Store.client.from('items').select('updated_at', { count: 'exact' }).order('updated_at', { ascending: false }).limit(1);
    if (error) throw fail(error, status);
    const top = data && data[0] ? String(data[0].updated_at || '') : '';
    const [fc, ft] = fingerprint.split('|');
    // если число записей не пришло (посредник не передал заголовок), удаления ловим полной сверкой раз в 3 минуты
    const changed = top !== ft || (count != null ? String(count) !== fc : Date.now() - lastFull > 180000);
    if (changed) { await Store.loadCloud(); return; }
    markSynced();
    if (Store.net !== 'ok') setNet('ok'); else emit();
  }
  Store.poll = poll;
  const pollQuiet = () => poll().catch((e) => {
    const kind = classify(e);
    if (kind === 'net') setNet(Store.online() ? 'down' : 'offline'); else if (kind === 'auth') setNet('auth'); else console.error(e);
  });

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
    Store.client = window.supabase.createClient(BASE, cfg.supabaseAnonKey, { global: { fetch: timedFetch }, auth: { storageKey: STORAGE_KEY } });
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
    // через посредника живое обновление (WebSocket) не проходит — вместо него частая лёгкая проверка
    if (PROXY) { Store._channel = 'off'; Store.realtime = 'OFF'; } else Store._channel = Store.client
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
      if (Store.pending.length || Store.realtime !== 'SUBSCRIBED' || sinceSync() > 30000) pollQuiet();
    });
    window.addEventListener('online', () => { backoff = 0; emit(); syncQuiet(); });
    window.addEventListener('offline', () => { setNet('offline'); emit(); });
    // страховка: если живое обновление не работает (посредник или оператор режет соединение), каждые 30 секунд
    // проверяем, изменилось ли что-то; с живым обновлением — полная сверка раз в 10 минут
    setInterval(() => {
      if (document.visibilityState !== 'visible' || !Store.online()) return;
      if (Store.pending.length && !Store._flushing) scheduleFlush(0);
      if (Store.realtime !== 'SUBSCRIBED') { if (sinceSync() > 25000) pollQuiet(); } else if (sinceSync() > 10 * 60000) syncQuiet();
    }, 30000);
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
    // в данные записываем постоянный адрес Supabase (а не посредника): показ сам пойдёт через посредника, если он включён
    const url = bucket.getPublicUrl(path).data.publicUrl;
    return PROXY && url.startsWith(PROXY) ? cfg.supabaseUrl + url.slice(PROXY.length) : url;
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
        row.ok = res.status < 400;
        if (!row.ok) row.note = 'ответ с ошибкой ' + res.status + (res.status === 404 ? ' (адрес не найден)' : res.status === 401 || res.status === 403 ? ' (нет доступа)' : '');
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
      const token = Store.session && Store.session.access_token;
      const all = '/rest/v1/items?select=id,kind,data&limit=150';
      if (PROXY) {
        await probe('Посредник: короткий запрос', `${PROXY}/auth/v1/settings`, { headers: h });
        if (token) await probe('Посредник: данные', `${PROXY}${all}`, { headers: { ...h, Authorization: 'Bearer ' + token } }, 25000);
      }
      await probe('База напрямую: короткий запрос', `${cfg.supabaseUrl}/auth/v1/settings`, { headers: h });
      // с посредником прямой доступ — только для сравнения, долго его не ждём
      if (token) await probe('База напрямую: данные', `${cfg.supabaseUrl}${all}`, { headers: { ...h, Authorization: 'Bearer ' + token } }, PROXY ? 10000 : 25000);
    }
    await probe('Cloudflare: 100 КБ', `https://speed.cloudflare.com/__down?bytes=100000&nocache=${t}`);
    await probe('Библиотеки (jsDelivr)', `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js?nocache=${t}`);
    return out;
  };

  window.Store = Store;
})();
