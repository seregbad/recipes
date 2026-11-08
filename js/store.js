// Хранилище данных. Два режима:
//  • local — всё в браузере (localStorage), пока не подключён Supabase;
//  • cloud — общая база Supabase для двоих, с живым обновлением.
//    Без интернета изменения копятся в «очереди» и отправляются, когда сеть появится.
// Все записи — объекты с полем id; «kind» — коллекция: recipes, pantry, shopping, preserves, custom_ingredients, menu.
(function () {
  const LOCAL_KEY = 'nasha-kuhnya:v1';
  const CACHE_KEY = 'nasha-kuhnya:cloud-cache:v1';
  const OUTBOX_KEY = 'nasha-kuhnya:outbox:v1';
  const KINDS = ['recipes', 'pantry', 'shopping', 'preserves', 'custom_ingredients', 'menu'];

  const Store = {
    mode: 'local',
    client: null,
    session: null,
    data: {},
    listeners: [],
    pending: [], // неотправленные изменения: {op:'upsert', row:{id,kind,data,updated_at}} | {op:'delete', id}
  };
  KINDS.forEach((k) => (Store.data[k] = []));

  const cfg = window.APP_CONFIG || {};
  const cloudConfigured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);

  function emit() { Store.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  Store.onChange = (fn) => Store.listeners.push(fn);

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('localStorage недоступен', e); }
  }
  function setAll(obj) {
    KINDS.forEach((k) => (Store.data[k] = Array.isArray(obj && obj[k]) ? obj[k] : []));
  }

  Store.all = (kind) => Store.data[kind] || [];
  Store.get = (kind, id) => Store.all(kind).find((x) => x.id === id);

  // ---------- Сеть и очередь ----------
  Store.online = () => navigator.onLine !== false;
  const isNetErr = (e) => !Store.online() || /fetch|network|load failed|timeout|aborted/i.test(String((e && (e.message || e.details)) || e));
  Store.status = () => ({ mode: Store.mode, online: Store.online(), pending: Store.pending.length });

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
  async function sendOps(ops) {
    const rows = ops.filter((o) => o.op === 'upsert').map((o) => o.row);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await Store.client.from('items').upsert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    for (const o of ops.filter((x) => x.op === 'delete')) {
      const { error } = await Store.client.from('items').delete().eq('id', o.id);
      if (error) throw error;
    }
  }
  // запись в облако: сразу, а без сети — в очередь
  async function write(ops) {
    if (Store.pending.length || !Store.online()) { enqueue(ops); return; }
    try {
      await sendOps(ops);
    } catch (e) {
      if (isNetErr(e)) { enqueue(ops); return; }
      await Store.loadCloud().catch(() => {});
      throw e;
    }
  }

  // отправить накопленное
  Store.flush = async () => {
    if (Store.mode !== 'cloud' || !Store.session || !Store.pending.length || Store._flushing || !Store.online()) return;
    Store._flushing = true;
    try {
      try {
        await sendOps(Store.pending.slice());
        Store.pending = [];
      } catch (e) {
        if (isNetErr(e)) return;
        // по одной, чтобы отбросить только то, что сервер не принимает
        while (Store.pending.length) {
          try { await sendOps([Store.pending[0]]); } catch (err) {
            if (isNetErr(err)) return;
            console.error('Сервер не принял изменение, оно отброшено', Store.pending[0], err);
          }
          Store.pending.shift();
          writeJSON(OUTBOX_KEY, Store.pending);
        }
      }
    } finally {
      writeJSON(OUTBOX_KEY, Store.pending);
      Store._flushing = false;
      emit();
    }
  };

  async function sync() {
    await Store.flush();
    await Store.loadCloud();
  }
  const syncQuiet = () => sync().catch((e) => { if (!isNetErr(e)) console.error(e); });

  // ---------- Инициализация ----------
  Store.init = async () => {
    if (!cloudConfigured) {
      Store.mode = 'local';
      setAll(readJSON(LOCAL_KEY));
      return { needLogin: false };
    }
    Store.mode = 'cloud';
    Store.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    Store.pending = readJSON(OUTBOX_KEY) || [];
    setAll(readJSON(CACHE_KEY)); // мгновенно показываем последнюю копию
    applyPending();
    const { data } = await Store.client.auth.getSession();
    Store.session = data.session;
    if (!Store.session) return { needLogin: true };
    try { await sync(); } catch (e) { if (!isNetErr(e)) throw e; }
    Store.subscribe();
    return { needLogin: false };
  };

  Store.login = async (email, password) => {
    if (!Store.online()) throw new Error('Нет интернета, войти не получится');
    const { data, error } = await Store.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    Store.session = data.session;
    await sync();
    Store.subscribe();
  };

  Store.logout = async () => {
    if (Store.pending.length && !confirm(`Есть неотправленные изменения (${Store.pending.length}). Если выйти, они пропадут. Выйти?`)) return;
    if (Store.client) await Store.client.auth.signOut();
    [CACHE_KEY, OUTBOX_KEY].forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  Store.userEmail = () => (Store.session && Store.session.user && Store.session.user.email) || '';

  Store.loadCloud = async () => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await Store.client.from('items').select('id, kind, data').range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const obj = {};
    KINDS.forEach((k) => (obj[k] = []));
    rows.forEach((r) => { if (obj[r.kind]) obj[r.kind].push({ ...r.data, id: r.id }); });
    setAll(obj);
    applyPending();
    writeJSON(CACHE_KEY, Store.data);
    emit();
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
      .subscribe();
    // после возврата во вкладку или появления сети — отправить накопленное и перечитать
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncQuiet(); });
    window.addEventListener('online', () => { emit(); syncQuiet(); });
    window.addEventListener('offline', emit);
  };

  function upsertLocal(kind, obj) {
    const list = Store.data[kind];
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = obj; else list.push(obj);
  }
  function persist() { writeJSON(Store.mode === 'local' ? LOCAL_KEY : CACHE_KEY, Store.data); }

  // ---------- Запись ----------
  Store.save = async (kind, obj) => {
    const item = { ...obj };
    if (!item.id) { item.id = U.uuid(); item.created_at = new Date().toISOString(); }
    item.updated_at = new Date().toISOString();
    upsertLocal(kind, item);
    if (Store.mode === 'cloud') {
      const { id, ...data } = item;
      await write([{ op: 'upsert', row: { id, kind, data, updated_at: item.updated_at } }]);
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
      await write(items.map(({ id, ...data }) => ({ op: 'upsert', row: { id, kind, data, updated_at: now } })));
    }
    persist();
    emit();
    return items;
  };

  Store.remove = async (kind, id) => {
    Store.data[kind] = Store.data[kind].filter((x) => x.id !== id);
    if (Store.mode === 'cloud') await write([{ op: 'delete', id }]);
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

  // ---------- Импорт рецепта по ссылке (через функцию Supabase) ----------
  Store.canImport = () => Store.mode === 'cloud';
  Store.importRecipe = async (url) => {
    if (!Store.online()) throw new Error('Нет интернета: загрузить рецепт по ссылке сейчас не получится');
    const { data, error } = await Store.client.functions.invoke(cfg.importFunction || 'import-recipe', { body: { url } });
    if (error) {
      let msg = error.message;
      try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (e) { /* нет тела */ }
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  window.Store = Store;
})();
