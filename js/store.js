// Хранилище данных. Два режима:
//  • local — всё в браузере (localStorage), пока не подключён Supabase;
//  • cloud — общая база Supabase для двоих, с живым обновлением.
// Все записи — объекты с полем id; «kind» — коллекция: recipes, pantry, shopping, preserves, custom_ingredients, menu.
(function () {
  const LOCAL_KEY = 'nasha-kuhnya:v1';
  const CACHE_KEY = 'nasha-kuhnya:cloud-cache:v1';
  const KINDS = ['recipes', 'pantry', 'shopping', 'preserves', 'custom_ingredients', 'menu'];

  const Store = {
    mode: 'local',
    client: null,
    session: null,
    data: {},
    listeners: [],
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

  // ---------- Инициализация ----------
  Store.init = async () => {
    if (!cloudConfigured) {
      Store.mode = 'local';
      setAll(readJSON(LOCAL_KEY));
      return { needLogin: false };
    }
    Store.mode = 'cloud';
    Store.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    setAll(readJSON(CACHE_KEY)); // мгновенно показываем последнюю копию
    const { data } = await Store.client.auth.getSession();
    Store.session = data.session;
    if (!Store.session) return { needLogin: true };
    await Store.loadCloud();
    Store.subscribe();
    return { needLogin: false };
  };

  Store.login = async (email, password) => {
    const { data, error } = await Store.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    Store.session = data.session;
    await Store.loadCloud();
    Store.subscribe();
  };

  Store.logout = async () => {
    if (Store.client) await Store.client.auth.signOut();
    localStorage.removeItem(CACHE_KEY);
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
        writeJSON(CACHE_KEY, Store.data);
        emit();
      })
      .subscribe();
    // после возврата во вкладку — перечитать (телефон мог «уснуть» и пропустить изменения)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Store.loadCloud().catch(console.error);
    });
  };

  function upsertLocal(kind, obj) {
    const list = Store.data[kind];
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = obj; else list.push(obj);
  }

  // ---------- Запись ----------
  Store.save = async (kind, obj) => {
    const item = { ...obj };
    if (!item.id) { item.id = U.uuid(); item.created_at = new Date().toISOString(); }
    item.updated_at = new Date().toISOString();
    upsertLocal(kind, item);
    if (Store.mode === 'local') {
      writeJSON(LOCAL_KEY, Store.data);
    } else {
      const { id, ...data } = item;
      const { error } = await Store.client.from('items').upsert({ id, kind, data, updated_at: item.updated_at });
      if (error) { await Store.loadCloud(); throw error; }
      writeJSON(CACHE_KEY, Store.data);
    }
    emit();
    return item;
  };

  Store.saveMany = async (kind, objs) => {
    const now = new Date().toISOString();
    const items = objs.map((o) => ({ ...o, id: o.id || U.uuid(), created_at: o.created_at || now, updated_at: now }));
    items.forEach((it) => upsertLocal(kind, it));
    if (Store.mode === 'local') writeJSON(LOCAL_KEY, Store.data);
    else {
      const rows = items.map(({ id, ...data }) => ({ id, kind, data, updated_at: now }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await Store.client.from('items').upsert(rows.slice(i, i + 500));
        if (error) { await Store.loadCloud(); throw error; }
      }
      writeJSON(CACHE_KEY, Store.data);
    }
    emit();
    return items;
  };

  Store.remove = async (kind, id) => {
    Store.data[kind] = Store.data[kind].filter((x) => x.id !== id);
    if (Store.mode === 'local') writeJSON(LOCAL_KEY, Store.data);
    else {
      const { error } = await Store.client.from('items').delete().eq('id', id);
      if (error) { await Store.loadCloud(); throw error; }
      writeJSON(CACHE_KEY, Store.data);
    }
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
    const { data, error } = await Store.client.functions.invoke('import-recipe', { body: { url } });
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
