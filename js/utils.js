// Вспомогательные функции: даты, экранирование, разбор строк ингредиентов, сопоставление продуктов.
(function () {
  const U = {};

  U.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  U.uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  // ---------- Даты (храним как YYYY-MM-DD) ----------
  U.today = () => U.toISODate(new Date());
  U.toISODate = (d) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  U.parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  U.addDays = (iso, n) => { const d = U.parseDate(iso); d.setDate(d.getDate() + n); return U.toISODate(d); };
  U.addMonths = (iso, n) => { const d = U.parseDate(iso); d.setMonth(d.getMonth() + n); return U.toISODate(d); };
  U.daysBetween = (fromIso, toIso) => Math.round((U.parseDate(toIso) - U.parseDate(fromIso)) / 86400000);
  U.daysLeft = (iso) => U.daysBetween(U.today(), iso);
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  U.fmtDate = (iso) => {
    if (!iso) return '';
    const d = U.parseDate(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
  };
  U.plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  U.daysWord = (n) => `${n} ${U.plural(n, 'день', 'дня', 'дней')}`;
  // «вчера», «5 дней назад», «3 недели назад», «12 октября»
  U.ago = (iso) => {
    const d = U.daysBetween(iso, U.today());
    if (d <= 0) return 'сегодня';
    if (d === 1) return 'вчера';
    if (d < 7) return `${U.daysWord(d)} назад`;
    if (d < 35) { const w = Math.round(d / 7); return `${w} ${U.plural(w, 'неделю', 'недели', 'недель')} назад`; }
    return U.fmtDate(iso);
  };

  // Количество в базовых единицах (для списания: 1,5 кг − 300 г)
  const UNIT_BASE = { 'г': ['g', 1], 'кг': ['g', 1000], 'мл': ['ml', 1], 'л': ['ml', 1000] };
  U.qtyNum = (q) => (/^\s*\d+(?:[.,]\d+)?\s*$/.test(String(q || '')) ? parseFloat(String(q).replace(',', '.')) : NaN);
  // сколько останется в pantry после списания need; null — посчитать нельзя
  U.subtractQty = (haveQty, haveUnit, needQty, needUnit) => {
    const h = U.qtyNum(haveQty), n = U.qtyNum(needQty);
    if (!isFinite(h) || !isFinite(n)) return null;
    const hu = haveUnit || '', nu = needUnit || '';
    if (hu === nu) return Math.round((h - n) * 1000) / 1000;
    const a = UNIT_BASE[hu], b = UNIT_BASE[nu];
    if (!a || !b || a[0] !== b[0]) return null;
    return Math.round(((h * a[1] - n * b[1]) / a[1]) * 1000) / 1000;
  };
  U.fmtNum = (n) => String(n).replace('.', ',');

  // ---------- Нормализация и «стемминг» для сопоставления ----------
  const ENDINGS = ['ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ий', 'ый',
    'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ь', 'й'];
  U.norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(['для', 'или', 'по', 'на', 'из', 'со', 'с', 'в', 'и', 'без', 'вкусу', 'свежий', 'свежая', 'свежие',
    'свежего', 'свежей', 'крупный', 'крупная', 'крупные', 'мелкий', 'мелкая', 'мелкие', 'средний', 'средняя', 'средние', 'небольшой', 'небольшая']);
  U.stem = (w) => {
    for (const e of ENDINGS) {
      if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
    }
    return w;
  };
  const stemCache = new Map();
  U.stems = (s) => {
    const key = String(s || '');
    let v = stemCache.get(key);
    if (!v) {
      v = U.norm(key).split(/[\s-]+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^\d/.test(w)).map(U.stem);
      stemCache.set(key, v);
    }
    return v;
  };

  const stemMatch = (a, b) => a === b || (b.length >= 3 && a.startsWith(b)) || (a.length >= 3 && b.startsWith(a));
  // все основы из small встречаются среди основ big
  const covers = (big, small) => small.length > 0 && small.every((s) => big.some((b) => stemMatch(b, s)));

  // Справочник: базовый + свои ингредиенты
  U.catalogList = (custom) => {
    const list = [];
    for (const cat of Object.keys(window.INGREDIENT_CATALOG)) {
      for (const name of window.INGREDIENT_CATALOG[cat]) list.push({ name, cat });
    }
    for (const c of custom || []) list.push({ name: c.name, cat: c.cat || 'Другое', custom: true, id: c.id });
    return list;
  };

  // Ключ ингредиента: название из справочника, если удалось сопоставить, иначе нормализованный текст
  U.ingKey = (name, catalog) => {
    const ts = U.stems(name);
    if (!ts.length) return U.norm(name);
    let best = null, bestScore = 0;
    for (const item of catalog) {
      const cs = item._stems || (item._stems = U.stems(item.name));
      if (covers(ts, cs)) {
        const score = cs.join('').length;
        if (score > bestScore) { best = item; bestScore = score; }
      }
    }
    return best ? best.name : U.norm(name);
  };

  // Совпадают ли два продукта («лук» и «лук репчатый» считаем одним)
  U.sameIng = (a, b) => {
    const sa = U.stems(a), sb = U.stems(b);
    if (!sa.length || !sb.length) return false;
    return covers(sa, sb) || covers(sb, sa);
  };

  U.STAPLES = ['соль', 'сахар', 'вода', 'перец чёрный молотый', 'перец', 'масло подсолнечное', 'масло растительное'];
  U.isStaple = (key) => U.STAPLES.some((s) => U.norm(s) === U.norm(key));

  // ---------- Разбор строки ингредиента ----------
  const UNIT_RE = '(кг|килограмм[а-я]*|г|гр|грамм[а-я]*|мг|мл|миллилитр[а-я]*|л|литр[а-я]*|шт|штук[а-я]*|ст\\.?\\s?л|ч\\.?\\s?л|стол[а-я]*\\s+ложк[а-я]*|чайн[а-я]*\\s+ложк[а-я]*|ложк[а-я]*|стакан[а-я]*|чашк[а-я]*|щепотк[а-я]*|зубч[а-я]*|пуч[а-я]*|банк[а-я]*|упаковк[а-я]*|уп|пачк[а-я]*|кусоч[а-я]*|кус[а-я]*|ломтик[а-я]*|веточ[а-я]*|лист[а-я]*|головк[а-я]*|кочан[а-я]*|горст[а-я]*|бан|пакет[а-я]*)\\.?';
  const NUM_RE = '(\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\s*\\/\\s*\\d+|\\d+\\s+\\d\\/\\d|[½¼¾⅓⅔])';
  const reStart = new RegExp(`^${NUM_RE}\\s*(?:${UNIT_RE})?\\s+(.+)$`, 'i');
  const reEnd = new RegExp(`^(.+?)\\s*[—–:,-]?\\s*${NUM_RE}\\s*(?:${UNIT_RE})?\\s*(?:\\(.*\\))?$`, 'i');
  const FRACT = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3' };

  U.normUnit = (u) => {
    if (!u) return '';
    const s = u.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
    if (/^(г|гр|грамм)/.test(s)) return 'г';
    if (/^(кг|килограмм)/.test(s)) return 'кг';
    if (/^(мл|миллилитр)/.test(s)) return 'мл';
    if (/^(л|литр)$|^литр/.test(s)) return 'л';
    if (/^(шт|штук)/.test(s)) return 'шт';
    if (/^(ст\.? ?л|стол)/.test(s)) return 'ст. л.';
    if (/^(ч\.? ?л|чайн)/.test(s)) return 'ч. л.';
    if (/^стакан/.test(s)) return 'стакан';
    if (/^зубч/.test(s)) return 'зубчик';
    if (/^пуч/.test(s)) return 'пучок';
    if (/^(уп|упаковк|пачк|пакет)/.test(s)) return 'уп.';
    if (/^банк|^бан$/.test(s)) return 'банка';
    if (/^щепотк/.test(s)) return 'щепотка';
    return s;
  };

  U.parseIngredientLine = (line) => {
    let raw = String(line || '').trim().replace(/^\d+\)\s+/, '').replace(/^[•·*–—-]\s*/, '').trim();
    if (!raw) return null;
    let s = raw.replace(/[½¼¾⅓⅔]/g, (c) => FRACT[c]);
    let toTaste = /по вкусу|для подачи|опционально/i.test(s);
    s = s.replace(/\(?\s*(по вкусу|для подачи|опционально)\s*\)?/ig, '').replace(/\s+/g, ' ').trim().replace(/[,;.]$/, '');
    let name = s, qty = '', unit = '';
    let m = s.match(reStart);
    if (m) { qty = m[1]; unit = m[2] || ''; name = m[3]; }
    else if ((m = s.match(reEnd))) { name = m[1]; qty = m[2]; unit = m[3] || ''; }
    name = name.replace(/^[\s—–:,-]+|[\s—–:,-]+$/g, '').trim();
    qty = qty.replace(',', '.').replace(/\s+/g, '');
    unit = U.normUnit(unit);
    if (!qty && toTaste) unit = 'по вкусу';
    return { raw, name, qty, unit };
  };

  U.fmtQty = (qty, unit) => [String(qty || '').replace(/^(\d+)\.(\d+)$/, '$1,$2'), unit].filter(Boolean).join(' ');

  // Сложение количеств одной единицы (для «Дома» после покупки)
  U.addQty = (a, b) => {
    const na = parseFloat(String(a).replace(',', '.')), nb = parseFloat(String(b).replace(',', '.'));
    if (isFinite(na) && isFinite(nb) && /^[\d.,]+$/.test(String(a)) && /^[\d.,]+$/.test(String(b))) {
      return String(Math.round((na + nb) * 100) / 100);
    }
    return b || a;
  };

  window.U = U;
})();
