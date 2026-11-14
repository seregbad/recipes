// Меры и веса: сколько граммов в ложке, стакане (250 мл) и штуке.
// Основа — таблицы gotovim-doma.ru/massa и food.ru/encyclopedia/tablitsa-vesov (средние значения).
// Сыпучие — ложка с небольшой горкой, как обычно в рецептах. Значения ориентировочные.
(function () {
  // [шаблон названия, ч. л., ст. л., стакан 250 мл]  — порядок важен: частное раньше общего
  const SPOONS = [
    [/сахарн\S* пудр/, 10, 25, 180], [/ванильн\S* сахар/, 8, 25, 200], [/сахар/, 8, 25, 200],
    [/рисов\S* мук/, 10, 30, 170], [/кукурузн\S* мук/, 10, 30, 160], [/мук/, 8, 25, 160],
    [/морск\S* сол|сол/, 10, 30, 320], [/сод/, 12, 28, 0], [/разрыхлител/, 5, 15, 0], [/крахмал/, 10, 30, 180],
    [/какао/, 7, 20, 200], [/желатин|агар/, 5, 15, 0], [/сух\S* дрожж|дрожжи сух/, 3, 9, 0], [/дрожж/, 9, 22, 0],
    [/лимонн\S* кислот/, 8, 25, 0], [/ванилин/, 2, 6, 0],
    [/м[её]д/, 12, 35, 325], [/сгущ/, 12, 30, 300], [/варень|джем|повидл/, 20, 45, 320], [/сироп/, 5, 15, 0],
    [/масло сливоч|сливочн\S* масл|топлен\S* масл/, 8, 20, 240], [/масл/, 5, 17, 230],
    [/сметан/, 10, 25, 250], [/майонез/, 10, 25, 250], [/сливк/, 5, 15, 250], [/йогурт/, 6, 18, 250],
    [/кефир|ряженк|простокваш/, 8, 20, 255], [/сух\S* молок|молоко сух/, 7, 20, 130], [/молок/, 5, 20, 250],
    [/вод|бульон|сок|вин|квас|пиво/, 5, 18, 250], [/уксус/, 5, 15, 250], [/соев\S* соус/, 5, 15, 250],
    [/томатн\S* паст/, 10, 30, 300], [/кетчуп/, 7, 22, 0], [/горчиц/, 5, 20, 0], [/аджик|хрен/, 7, 20, 0],
    [/творожн\S* сыр|маскарпоне|рикотт/, 7, 20, 250], [/творог/, 5, 17, 250], [/сыр/, 5, 20, 100],
    [/рис/, 8, 25, 230], [/гречк|гречнев/, 7, 25, 210], [/манк|манн/, 8, 25, 200], [/пшен/, 8, 20, 220],
    [/овсян|геркулес/, 4, 14, 100], [/булгур/, 8, 21, 235], [/кускус/, 8, 20, 200], [/киноа/, 8, 20, 190],
    [/кукурузн\S* круп/, 5, 20, 180], [/перловк|ячнев/, 8, 25, 230], [/чечевиц/, 4, 12, 180], [/горох|нут/, 5, 25, 230], [/фасол/, 4, 15, 190],
    [/изюм/, 7, 25, 190], [/кунжут/, 4, 10, 150], [/сем\S* льн|семена льн/, 3, 7, 170], [/чиа/, 4, 12, 0], [/мак/, 5, 15, 150],
    [/кокосов\S* стружк/, 3, 8, 80], [/орех|фундук|миндал|кешью|арахис/, 10, 30, 170], [/арахисов\S* паст/, 12, 35, 260],
    [/панировочн|сухар/, 5, 15, 125], [/кофе раствор/, 3, 7, 120], [/кофе/, 7, 20, 210], [/чай/, 3, 8, 0],
    [/корица/, 3, 8, 0], [/паприк/, 2, 7, 0], [/куркум/, 3, 7, 0], [/перец/, 2, 6, 0], [/зира|кориандр|карри|хмели|приправ|трав|специ/, 2, 6, 0],
    [/икр/, 8, 25, 220], [/зелен|укроп|петрушк|кинз|лук зел/, 1, 4, 40],
  ];
  // вес одной штуки, г
  const PIECES = [
    [/перепел/, 12], [/яйц|яйко/, 55], [/лук\S* порей|порей/, 200], [/лук/, 90], [/морков/, 80], [/картоф|картошк/, 100],
    [/помидоры черри|черри/, 15], [/помидор|томат/, 100], [/огурц\S* сол|огурц\S* марин|корнишон/, 60], [/огур/, 100],
    [/перец чили|чили/, 15], [/перец/, 150], [/кабач|цукини/, 300], [/баклажан/, 250], [/св[её]кл/, 200], [/реп/, 150],
    [/редис/, 15], [/редьк|дайкон/, 300], [/капуст\S* цветн/, 700], [/брокколи/, 400], [/капуст/, 1500], [/тыкв/, 2000],
    [/зубч|чеснок/, 5], [/лимон/, 120], [/лайм/, 70], [/апельсин/, 200], [/мандарин/, 80], [/грейпфрут/, 350],
    [/яблок/, 160], [/груш/, 150], [/банан/, 120], [/авокадо/, 170], [/киви/, 75], [/персик|нектарин/, 150], [/хурм/, 200],
    [/шампиньон|гриб/, 20], [/сосиск/, 50], [/сардельк/, 90], [/бедр|голен/, 150], [/окороч/, 300], [/крыл/, 90],
    [/куриное филе|филе куриц|грудк/, 250], [/булочк/, 60], [/тортиль|лаваш/, 80], [/печень\S* савоярди|савоярди/, 10],
    [/скумбри/, 350], [/сельд/, 300], [/форел/, 400],
  ];
  // единица «штучного» вида → вес по названию или фиксированный
  const UNIT_WEIGHT = { 'зубчик': 5, 'головка': 50, 'пучок': 50, 'кусок': 30, 'ломтик': 20, 'лист': 10, 'веточка': 2, 'щепотка': 0.5 };
  const SPOON_UNITS = { 'ч. л.': 1, 'ст. л.': 2, 'стакан': 3 };

  const find = (table, name) => { const n = U.norm(name); const row = table.find(([re]) => re.test(n)); return row || null; };
  const rangeOf = (q) => {
    const s = String(q || '').replace(/,/g, '.').replace(/\s/g, '');
    let m = s.match(/^(\d+(?:\.\d+)?)[-–](\d+(?:\.\d+)?)$/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) return [m[1] / m[2], m[1] / m[2]];
    m = s.match(/^\d+(?:\.\d+)?$/);
    return m ? [parseFloat(s), parseFloat(s)] : null;
  };
  // граммы в одной единице для этого продукта (или null)
  function gramsPerUnit(name, unit) {
    const u = unit || '';
    if (u === 'г') return 1;
    if (u === 'кг') return 1000;
    if (SPOON_UNITS[u]) { const row = find(SPOONS, name); const v = row && row[SPOON_UNITS[u]]; return v || null; }
    if (u === 'шт' || u === '') { const row = find(PIECES, name); return row ? row[1] : null; }
    if (u === 'головка' && /лук/.test(U.norm(name))) return 90;
    if (u === 'пучок' && /лук/.test(U.norm(name))) return 50;
    if (u === 'кусок' && /сыр|масл/.test(U.norm(name))) return 20;
    return UNIT_WEIGHT[u] || null;
  }
  // «4 ст. л. муки» → [100, 100]; «2-3 шт картофеля» → [200, 300]; не знаем → null
  function toGrams(name, qty, unit) {
    const r = rangeOf(qty);
    const k = gramsPerUnit(name, unit);
    if (!r || !k) return null;
    return [r[0] * k, r[1] * k];
  }
  // красивые граммы: 2 · 15 · 85 · 240 · 1,2 кг
  function niceG(g) {
    if (g >= 1000) return U.roundNice(Math.round(g / 50) * 50 / 1000) + ' кг';
    const v = g < 3 ? Math.round(g * 2) / 2 : g < 20 ? Math.round(g) : g < 100 ? Math.round(g / 5) * 5 : Math.round(g / 10) * 10;
    return String(v).replace('.', ',') + ' г';
  }
  // подсказка в скобках: «≈100 г» (только когда единица — не граммы и вес известен)
  function gramHint(name, qty, unit) {
    if (unit === 'г' || unit === 'кг' || unit === 'мл' || unit === 'л' || unit === 'по вкусу') return '';
    const g = toGrams(name, qty, unit);
    if (!g || g[1] < 1) return '';
    return '≈' + (g[0] === g[1] ? niceG(g[0]) : niceG(g[0]).replace(/ (к?г)$/, '') + '–' + niceG(g[1]));
  }

  // Пересчёт количества с кухонным округлением: яйца — целые, штуки и ложки — половинки, граммы — до 5/10
  function scaleQty(q, f, unit = '', name = '') {
    if (!q || f === 1) return q;
    const isEgg = /яйц|яйко/.test(U.norm(name));
    const round = (v) => {
      if (unit === 'г' || unit === 'мл') return v < 20 ? Math.round(v) : v < 100 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10;
      if (unit === 'кг' || unit === 'л') return Math.round(v * 20) / 20;
      if (isEgg || unit === 'зубчик') return Math.max(1, Math.round(v));
      if (unit === 'стакан') return Math.max(0.25, Math.round(v * 4) / 4);
      if (unit === 'шт' || unit === '' || unit === 'ст. л.' || unit === 'ч. л.' || unit === 'стакан' || unit === 'пучок' || unit === 'головка') return Math.max(0.5, Math.round(v * 2) / 2);
      return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    };
    return String(q).replace(/(\d+)\s*\/\s*(\d+)|\d+(?:[.,]\d+)?/g, (m, a, b) => String(round((a ? a / b : parseFloat(m.replace(',', '.'))) * f)).replace('.', ','));
  }

  // Сколько останется дома после списания, с переводом через граммы («1 кг муки − 4 ст. л.» → 0,9 кг)
  function subtractSmart(name, haveQty, haveUnit, needQty, needUnit) {
    const direct = U.subtractQty(haveQty, haveUnit, needQty, needUnit);
    if (direct !== null) return direct;
    const have = toGrams(name, haveQty, haveUnit), need = toGrams(name, needQty, needUnit);
    const per = gramsPerUnit(name, haveUnit);
    if (!have || !need || !per) return null;
    const leftUnits = (have[0] - need[1]) / per;
    if (haveUnit === 'шт' || haveUnit === '') return Math.round(leftUnits * 2) / 2;
    return Math.round(leftUnits * 1000) / 1000;
  }
  // во сколько раз продукта дома больше/меньше, чем нужно (через граммы, если единицы разные)
  function ratioHaveNeed(name, haveQty, haveUnit, needQty, needUnit) {
    const h = rangeOf(haveQty), n = rangeOf(needQty);
    if (h && n && (haveUnit || '') === (needUnit || '') && n[1] > 0) return h[0] / n[1];
    const hg = toGrams(name, haveQty, haveUnit), ng = toGrams(name, needQty, needUnit);
    if (hg && ng && ng[1] > 0) return hg[0] / ng[1];
    const a = U.subtractQty(haveQty, haveUnit, needQty, needUnit); // г ↔ кг, мл ↔ л
    if (a !== null && n) { const base = { 'г': 1, 'кг': 1000, 'мл': 1, 'л': 1000 }; const hv = h ? h[0] * (base[haveUnit] || 1) : 0, nv = n[1] * (base[needUnit] || 1); return nv ? hv / nv : null; }
    return null;
  }

  // Граммовки в тексте шага: «добавьте 200 г муки» → «250 г» при пересчёте ×1,25.
  // Только вес и объём; время и температура не трогаются.
  const STEP_RE = /(\d+(?:[.,]\d+)?)(\s*[-–]\s*\d+(?:[.,]\d+)?)?(\s*)(кг|гр?|грамм\S*|мл|л|литр\S*|ст\.\s?л\.?|ч\.\s?л\.?|стакан\S*|столов\S+ ложк\S*|чайн\S+ ложк\S*)(?![а-яё])/gi;
  function scaleStepHTML(text, f, esc) {
    if (f === 1) return esc(text);
    let out = '', last = 0;
    String(text).replace(STEP_RE, (m, a, b, sp, unit, idx) => {
      // то же кухонное округление, что и в списке ингредиентов
      const lu = unit.toLowerCase();
      const u = /^кг/.test(lu) ? 'кг' : /^мл/.test(lu) ? 'мл' : /^л/.test(lu) ? 'л' : /^г/.test(lu) ? 'г'
        : /^ст\.|^столов/.test(lu) ? 'ст. л.' : /^ч\.|^чайн/.test(lu) ? 'ч. л.' : 'стакан';
      const sc = (x) => scaleQty(x, f, u);
      const bb = b ? b.replace(/\d+(?:[.,]\d+)?/, (y) => sc(y)) : '';
      const na = sc(a);
      const word = /^стакан/.test(lu) ? unitWord(b ? bb : na, 'стакан') : unit;
      out += esc(text.slice(last, idx)) + `<mark class="scaled" title="было: ${esc(m)}">${esc(na + bb + sp + word)}</mark>`;
      last = idx + m.length;
      return m;
    });
    return out + esc(text.slice(last));
  }

  // «2 стакан» → «2 стакана», «5 зубчик» → «5 зубчиков», «1,5 стакан» → «1,5 стакана»
  const FORMS = {
    'стакан': ['стакан', 'стакана', 'стаканов'], 'зубчик': ['зубчик', 'зубчика', 'зубчиков'], 'пучок': ['пучок', 'пучка', 'пучков'],
    'головка': ['головка', 'головки', 'головок'], 'кусок': ['кусок', 'куска', 'кусков'], 'ломтик': ['ломтик', 'ломтика', 'ломтиков'],
    'лист': ['лист', 'листа', 'листов'], 'веточка': ['веточка', 'веточки', 'веточек'], 'щепотка': ['щепотка', 'щепотки', 'щепоток'],
    'банка': ['банка', 'банки', 'банок'], 'пачка': ['пачка', 'пачки', 'пачек'], 'упаковка': ['упаковка', 'упаковки', 'упаковок'],
  };
  function unitWord(qty, unit) {
    const f = FORMS[unit];
    if (!f) return unit;
    const nums = String(qty || '').match(/\d+(?:[.,]\d+)?/g);
    if (!nums) return unit;
    const last = nums[nums.length - 1];
    if (/[.,]/.test(last) || /\//.test(String(qty))) return f[1];
    return U.plural(+last, f[0], f[1], f[2]);
  }
  const fmt = (qty, unit) => U.fmtQty(qty, unitWord(qty, unit));

  window.Measures = { unitWord, fmt, gramsPerUnit, toGrams, gramHint, niceG, scaleQty, subtractSmart, ratioHaveNeed, scaleStepHTML };
})();
