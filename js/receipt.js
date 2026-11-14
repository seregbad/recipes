// Распознавание чеков прямо в телефоне, без внешних сервисов:
//  • QR-код чека (ФНС) → точные сумма, дата и время;
//  • текст чека (Tesseract, русский словарь) → позиции и цены.
// Библиотеки подгружаются только при первом сканировании (~4 МБ), дальше берутся из кэша.
(function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const LIBS = {
    tesseract: CDN + 'tesseract.js@5.1.1/dist/tesseract.min.js',
    jsqr: CDN + 'jsqr@1.4.0/dist/jsQR.js',
  };
  const TESS = {
    workerPath: CDN + 'tesseract.js@5.1.1/dist/worker.min.js',
    corePath: CDN + 'tesseract.js-core@5.1.1',
    langPath: CDN + '@tesseract.js-data/rus@1.0.0/4.0.0_best_int',
  };

  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve;
        s.onerror = () => { delete loaded[src]; reject(new Error('Не удалось загрузить распознавание. Нужен интернет при первом запуске')); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  // ---------- Картинки ----------
  async function loadImage(file) {
    try { return await createImageBitmap(file); } catch (e) {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Не получилось открыть фото'));
        img.src = URL.createObjectURL(file);
      });
    }
  }
  function toCanvas(img, maxSide, crop) {
    const sx = crop ? crop.x : 0, sy = crop ? crop.y : 0;
    const sw = crop ? crop.w : img.width, sh = crop ? crop.h : img.height;
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- QR-код чека ----------
  // Формат ФНС: t=20261108T1530&s=1234.00&fn=…&i=…&fp=…&n=1
  function parseQR(text) {
    const s = String(text || '').trim();
    const m = s.match(/t=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/i);
    const sum = s.match(/(?:^|&)s=(\d+(?:[.,]\d+)?)/i);
    if (!m || !sum) return null;
    const p = (k) => (s.match(new RegExp('(?:^|&)' + k + '=([^&]+)', 'i')) || [])[1] || '';
    return {
      raw: s,
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: `${m[4]}:${m[5]}`,
      sum: parseFloat(sum[1].replace(',', '.')),
      refund: p('n') === '2' || p('n') === '4',
      key: [p('fn'), p('i'), p('fp')].join('-'),
    };
  }
  async function findQR(img) {
    // 1) встроенный сканер (Android Chrome)
    if ('BarcodeDetector' in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const found = await det.detect(img);
        for (const f of found) { const q = parseQR(f.rawValue); if (q) return q; }
      } catch (e) { /* нет поддержки — дальше jsQR */ }
    }
    // 2) jsQR: целиком в нескольких масштабах, потом нижняя половина (QR обычно внизу чека)
    await loadScript(LIBS.jsqr);
    const half = { x: 0, y: Math.floor(img.height / 2), w: img.width, h: Math.ceil(img.height / 2) };
    const tries = [[1600], [2400], [1000], [2000, half], [1200, half]];
    for (const [side, crop] of tries) {
      const c = toCanvas(img, side, crop);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      const code = window.jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (code) { const q = parseQR(code.data); if (q) return q; }
    }
    return null;
  }

  // ---------- Подготовка фото ----------
  // Цепочка: найти чек на фоне → выровнять наклон → привести к нужному размеру →
  // два варианта для распознавания: контрастный ч/б (адаптивный порог) и мягкий серый.
  function toGray(c) {
    const { width: w, height: h } = c;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    return { g, w, h };
  }
  function otsu(g) {
    const hist = new Float64Array(256);
    for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, t = 127;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = g.length - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; t = i; }
    }
    return t;
  }
  // Светлый чек на тёмном столе: ищем полосу столбцов и строк, где преобладает бумага
  function paperBox(img) {
    const c = toCanvas(img, 600);
    const { g, w, h } = toGray(c);
    const t = otsu(g);
    const col = new Float32Array(w), row = new Float32Array(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x] > t) { col[x]++; row[y]++; }
    const smooth = (a, n) => a.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 3); j <= Math.min(a.length - 1, i + 3); j++) { s += a[j]; k++; } return s / k / n; });
    const cs = smooth(col, h), rs = smooth(row, w);
    const run = (a, thr) => { let best = [0, -1], s = -1; for (let i = 0; i <= a.length; i++) { if (i < a.length && a[i] > thr) { if (s < 0) s = i; } else if (s >= 0) { if (i - 1 - s > best[1] - best[0]) best = [s, i - 1]; s = -1; } } return best; };
    const [x1, x2] = run(cs, 0.3), [y1, y2] = run(rs, 0.12);
    if (x2 - x1 < w * 0.15 || y2 - y1 < h * 0.2) return null;              // не нашли
    if (x2 - x1 > w * 0.92 && y2 - y1 > h * 0.92) return null;             // чек и так во весь кадр
    const k = img.width / w, mx = (x2 - x1) * 0.03, my = (y2 - y1) * 0.015;
    const X = Math.max(0, (x1 - mx) * k), Y = Math.max(0, (y1 - my) * k);
    return { x: X, y: Y, w: Math.min(img.width - X, (x2 - x1 + 2 * mx) * k), h: Math.min(img.height - Y, (y2 - y1 + 2 * my) * k) };
  }
  // Наклон строк (±10°) методом проекций: при правильном угле строки текста дают самые «резкие» полосы
  function skewAngle(c) {
    const { g, w, h } = toGray(toCanvas(c, 900));
    // тёмная тема (светлый текст на тёмном) — переворачиваем яркость
    let mean = 0; for (let i = 0; i < g.length; i++) mean += g[i]; mean /= g.length;
    if (mean < 110) for (let i = 0; i < g.length; i++) g[i] = 255 - g[i];
    const T = otsu(g);
    // средняя яркость окрестности через интегральное изображение
    const integ = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) { let row = 0; for (let x = 1; x <= w; x++) { row += g[(y - 1) * w + x - 1]; integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + row; } }
    const R = Math.max(4, Math.round(Math.min(w, h) / 50));
    const xs = [], ys = [];
    for (let y = R; y < h - R; y += 2) {
      for (let x = R; x < w - R; x += 2) {
        const sum = integ[(y + R + 1) * (w + 1) + x + R + 1] - integ[(y - R) * (w + 1) + x + R + 1] - integ[(y + R + 1) * (w + 1) + x - R] + integ[(y - R) * (w + 1) + x - R];
        const m = sum / ((2 * R + 1) * (2 * R + 1)), v = g[y * w + x];
        // точка буквы: вокруг светлая бумага, сама заметно темнее (тёмный стол и шум не учитываются)
        if (m > T && v < m * 0.8 && m - v > 15) { xs.push(x - w / 2); ys.push(y - h / 2); }
      }
    }
    if (xs.length < 300) return 0;
    // полосы шириной 2 px = шагу выборки, иначе угол 0° получает ложное преимущество (все точки в чётных полосах)
    const size = Math.ceil(Math.hypot(w, h) / 2) + 4, off = Math.hypot(w, h) / 2 + 2;
    const score = (deg) => {
      const r = (deg * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r), hist = new Float32Array(size);
      for (let i = 0; i < xs.length; i++) hist[Math.round((ys[i] * cs - xs[i] * sn + off) / 2)]++;
      let s2 = 0; for (let i = 0; i < size; i++) s2 += hist[i] * hist[i];
      return s2;
    };
    let best = 0, bs = score(0);
    for (let a = -10; a <= 10; a += 0.5) { const v = score(a); if (v > bs) { bs = v; best = a; } }
    for (let a = best - 0.4; a <= best + 0.4; a += 0.1) { const v = score(a); if (v > bs) { bs = v; best = a; } }
    return Math.abs(best) < 0.3 ? 0 : Math.round(best * 10) / 10;
  }
  function rotate(c, deg, fill = '#222') {
    if (!deg) return c;
    const r = (deg * Math.PI) / 180, w = c.width, h = c.height;
    const W = Math.ceil(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), H = Math.ceil(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const ctx = o.getContext('2d');
    // углы заливаем тёмным, как стол: тогда повторная обрезка по светлой бумаге их отрежет
    ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.rotate(r); ctx.drawImage(c, -w / 2, -h / 2);
    return o;
  }
  // Tesseract лучше всего читает буквы высотой ~30 px: чек приводим к ширине ~1400 px
  function resizeTo(c, width, maxH) {
    let k = width / c.width;
    if (c.height * k > maxH) k = maxH / c.height;
    const o = document.createElement('canvas');
    o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
    const ctx = o.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, o.width, o.height);
    return o;
  }
  // Мягкий вариант: серый с растянутым контрастом; тёмная тема (светлый текст на тёмном) инвертируется
  function grayVariant(c) {
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d'); ctx.drawImage(c, 0, 0);
    const id = ctx.getImageData(0, 0, o.width, o.height), d = id.data;
    const { g } = toGray(o);
    const hist = new Uint32Array(256); let mean = 0;
    for (let i = 0; i < g.length; i++) { hist[g[i]]++; mean += g[i]; }
    mean /= g.length;
    let lo = 0, hi = 255, acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > g.length * 0.02) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > g.length * 0.02) { hi = i; break; } }
    // текста мало (почти пустой скриншот) — 2% самых тёмных точек это уже фон; растягивать нельзя
    if (hi - lo < 80) { lo = 0; hi = 255; }
    const inv = mean < 110, span = Math.max(1, hi - lo);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      let v = Math.max(0, Math.min(255, ((g[j] - lo) * 255) / span));
      if (inv) v = 255 - v;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return o;
  }
  // Подготовить фото чека: { bin, gray, base, crop, angle }
  function prepareReceipt(img) {
    // 1) наклон считаем по чеку с большим запасом вокруг (тесная рамка срезала бы углы наклонённого чека)
    const box = paperBox(img);
    const wide = box && {
      x: Math.max(0, box.x - box.w * 0.15), y: Math.max(0, box.y - box.h * 0.05),
      w: Math.min(img.width, box.w * 1.3), h: Math.min(img.height, box.h * 1.1),
    };
    if (wide) { wide.w = Math.min(wide.w, img.width - wide.x); wide.h = Math.min(wide.h, img.height - wide.y); }
    let full = toCanvas(img, 3200, wide || undefined);
    const angle = skewAngle(full);
    // 2) поворачиваем, 3) обрезаем уже ровный чек
    if (angle) full = rotate(full, -angle);
    const box2 = paperBox(full);
    let base = box2 ? toCanvas(full, 3200, box2) : full;
    base = resizeTo(base, 1400, 7000);
    return { base, gray: grayVariant(base), bin: binarize(grayVariant(base)), crop: !!(box || box2), angle };
  }
  // Для страниц и скриншотов (рецепты): без обрезки, но с выравниванием, масштабом и учётом тёмной темы
  function prepForOCR(img) {
    let c = toCanvas(img, 3200);
    c = rotate(c, -skewAngle(c), '#fff');
    if (c.width < 1200) c = resizeTo(c, 1400, 9000);
    return binarize(grayVariant(c));
  }

  // Адаптивный порог (метод Брэдли): тени и неравномерный свет не мешают.
  function binarize(src) {
    const c = toCanvas(src, 100000);
    const ctx = c.getContext('2d');
    const { width: w, height: h } = c;
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    const integ = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) { row += gray[(y - 1) * w + (x - 1)]; integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + row; }
    }
    const s = Math.max(8, Math.round(Math.max(w, h) / 24)), t = 0.15;
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - s), y2 = Math.min(h - 1, y + s);
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - s), x2 = Math.min(w - 1, x + s);
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = integ[(y2 + 1) * (w + 1) + (x2 + 1)] - integ[y1 * (w + 1) + (x2 + 1)] - integ[(y2 + 1) * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
        // темнее окрестности на 15% и хотя бы на 12 единиц яркости — иначе на тёмном фоне шум становится «текстом»
        const px = gray[y * w + x], mean = sum / count;
        const v = px < mean * (1 - t) && mean - px > 12 ? 0 : 255;
        const k = (y * w + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  async function makeWorker(onProgress, stage = 'ocr') {
    await loadScript(LIBS.tesseract);
    onProgress && onProgress({ stage: 'load', p: 0 });
    const state = { stage };
    const worker = await window.Tesseract.createWorker('rus', 1, {
      ...TESS,
      logger: (m) => {
        if (!onProgress) return;
        if (m.status === 'recognizing text') onProgress({ stage: state.stage, p: m.progress });
        else onProgress({ stage: 'load', p: m.progress || 0 });
      },
    });
    worker.state = state;
    return worker;
  }
  // распознать набор картинок одним режимом; вернуть текст и среднюю уверенность
  async function recognizeAll(worker, canvases, psm) {
    await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    let text = '', conf = 0;
    for (const c of canvases) { const { data } = await worker.recognize(c); text += data.text + '\n'; conf += data.confidence || 0; }
    return { text, conf: conf / Math.max(1, canvases.length) };
  }

  // ---------- Разбор текста чека в позиции ----------
  // \b и \W в JS не понимают кириллицу — граница слова через (?![а-яё])
  const W = (s) => s + '(?![а-яё])';
  const SKIP = new RegExp([
    '(?:^|\\s)(?:ооо|оао|зао|пао|ао|ип)(?=\\s|«|"|$)',
    'инн', 'кассир', W('касса'), 'ккт', 'рн\\s', 'зн\\s', W('фн'), W('фд'), W('фп'), 'смена', 'кассовый', W('чек'),
    'приход', 'возврат', 'сайт', 'nalog', 'офд', 'www', 'http', 'спасибо', 'адрес', 'место расч', W('сно'), W('осн'), W('усн'),
    'продавец', 'покупател', 'телефон', 'e-?mail', 'бонус', 'балл', W('карт[аы]'), 'оплат', 'получено', 'сдача', 'наличн',
    'безнал', 'электрон', 'скидк', 'ндс', 'сумма', 'признак', 'способ', 'предмет', W('товар'), W('код'), 'штрих', 'дисконт',
    'экономия', 'округл', 'номер', W('qr'), 'ждём', 'ждем',
  ].join('|'), 'i');
  const TOTAL = /^[^а-яёa-z0-9]*(итого|итог|всего|подытог)(?![а-яё])/i;
  const MONEY = '\\d{1,6}[.,]\\d{2}';

  const toNum = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  // частые ошибки распознавания внутри чисел: О→0, З→3, б→6, l/I/|→1
  function fixNumbers(line) {
    return line.replace(/[\dОоOЗзбlI|SВ]+[.,]?[\dОоOЗзбlI|SВ]*/g, (tok) => {
      if (!/\d/.test(tok) || /[а-яё]{2,}/i.test(tok.replace(/[ОоЗзбВ]/g, ''))) return tok;
      const digits = tok.replace(/[^\d.,]/g, '').length;
      if (digits < tok.length / 2 && !/^\d/.test(tok)) return tok;
      return tok.replace(/[ОоO]/g, '0').replace(/[Зз]/g, '3').replace(/б/g, '6').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/В/g, '8');
    });
  }
  function cleanName(s) {
    let n = String(s || '')
      .replace(/^\s*\d{1,3}\s*[.)]?\s+(?=\D)/, '')   // номер позиции
      .replace(/[*#_|~^<>{}[\]\\]+/g, ' ')
      .replace(/\s+(ндс|nds)\s*\d+\s*%?.*$/i, '')
      .replace(/\s+[АБВабв]\s*$/, '')                 // метки налога в конце
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/^[\s.,:;=-]+|[\s.,:;=-]+$/g, '');
    if (n && n === n.toUpperCase() && /[А-ЯЁ]/.test(n)) n = n.charAt(0) + n.slice(1).toLowerCase(); // «МОЛОКО 3,2%» → «Молоко 3,2%»
    return n;
  }
  // «0.452 x 199.99 = 90.40», «1 * 54,99 =54.99», «89.99 x 1»
  function parseCalc(line) {
    // знак умножения бывает распознан дважды: «1 хх 94.99», «1 х х 94.99»
    const m = line.match(/(\d{1,6}(?:[.,]\d{1,3})?)\s*(?:шт|кг|л|г)?\.?\s*[xх×*](?:\s*[xх×*])?\s*(\d{1,6}(?:[.,]\d{1,3})?)\s*(?:шт|кг|л|руб|р)?\.?(?:[^\dа-яё]{0,6}(\d{1,6}[.,]\d{2}))?/i);
    if (!m) return null;
    const dec = (s) => (s.split(/[.,]/)[1] || '').length;
    const a = toNum(m[1]), b = toNum(m[2]);
    let qty, price;
    if (dec(m[1]) === 2 && dec(m[2]) !== 2) { price = a; qty = b; } else { qty = a; price = b; }
    let total = m[3] ? toNum(m[3]) : Math.round(qty * price * 100) / 100;
    if (m[3] && Math.abs(qty * price - total) > Math.max(1, total * 0.05)) {
      // одно из чисел распознано неверно — доверяем сумме строки, цену пересчитываем
      if (qty > 0) price = Math.round((total / qty) * 100) / 100;
    }
    if (!(total > 0) || total > 1e6) return null;
    return { qty, price, total, rest: line.slice(0, m.index).trim() };
  }

  function parseText(text) {
    const lines = String(text || '').split(/\n+/).map((l) => fixNumbers(l.replace(/\s+/g, ' ').trim())).filter(Boolean);
    const items = [];
    let pending = [], last = null, total = null, discount = 0;
    lines.forEach((line, idx) => {
      if (total !== null) return;
      // «Скидка -10.00», «Скидка по карте 15,50» — запоминаем, чтобы сверить с суммой чека
      if (/скидк|дисконт|экономия/i.test(line)) {
        const m = line.match(new RegExp('(' + MONEY + ')\\s*\\S?$'));
        if (m && toNum(m[1]) < 1e5) discount += toNum(m[1]);
        pending = [];
        return;
      }
      if (TOTAL.test(line)) {
        const m = line.match(new RegExp('(' + MONEY + ')\\s*\\S?$'));
        total = m ? toNum(m[1]) : 0;
        return;
      }
      const letters = (line.match(/[а-яёa-z]/gi) || []).length;
      if (SKIP.test(line) && !parseCalc(line)) { pending = []; return; }

      const calc = parseCalc(line);
      if (calc) {
        // позиция была строкой выше с той же суммой — это её расшифровка «кол-во × цена»
        if (last && last.line === idx - 1 && !pending.length && Math.abs(last.total - calc.total) < 0.01) {
          last.qty = calc.qty; last.price = calc.price; last.line = idx;
          return;
        }
        const name = cleanName([...pending.slice(-2), calc.rest].filter(Boolean).join(' '));
        last = { name, qty: calc.qty, price: calc.price, total: calc.total, line: idx };
        items.push(last);
        pending = [];
        return;
      }
      const end = line.match(new RegExp('^(.*[а-яёa-z].*?)\\s+(' + MONEY + ')\\s*[=*\\S]?$', 'i'));
      if (end && letters >= 2) {
        let name = end[1], qty = 1, price = null;
        // «ХЛЕБ 1 54.99 54.99» / «ХЛЕБ 2 109.98» — числа перед суммой: кол-во и цена
        const tail = name.match(/(?:\s+(\d{1,4}(?:[.,]\d{1,3})?))(?:\s+(\d{1,6}[.,]\d{2}))?\s*$/);
        if (tail && name.slice(0, tail.index).match(/[а-яёa-z]{2,}/i)) {
          qty = toNum(tail[1]) || 1;
          if (tail[2]) price = toNum(tail[2]);
          name = name.slice(0, tail.index);
        }
        const tot = toNum(end[2]);
        if (!price || Math.abs(price * qty - tot) > Math.max(1, tot * 0.05)) price = Math.round((tot / (qty || 1)) * 100) / 100;
        last = { name: cleanName([...pending.slice(-1), name].join(' ')), qty, price, total: tot, line: idx };
        items.push(last);
        pending = [];
        return;
      }
      if (letters >= 3) { pending.push(line); if (pending.length > 3) pending.shift(); }
    });
    return {
      items: items.filter((i) => i.total > 0).map((i) => ({
        name: i.name, total: i.total, price: i.price,
        qty: String(Math.round(i.qty * 1000) / 1000).replace('.', ','),
        unit: i.qty % 1 ? 'кг' : 'шт',
      })),
      total: total || null,
      discount: Math.round(discount * 100) / 100,
    };
  }

  // ---------- Всё вместе ----------
  // насколько распознанные позиции сходятся с суммой из QR (0 — идеально)
  function mismatch(parsed, qr) {
    const sum = parsed.items.reduce((s, i) => s + i.total, 0) - (parsed.discount || 0);
    return qr ? Math.abs(sum - qr.sum) : Infinity;
  }

  async function scan(files, onProgress) {
    const imgs = [];
    for (const f of files) imgs.push(await loadImage(f));
    onProgress && onProgress({ stage: 'qr', p: 0 });
    let qr = null;
    for (const img of imgs) { qr = await findQR(img).catch(() => null); if (qr) break; }
    onProgress && onProgress({ stage: 'prep', p: 0 });
    const prepared = imgs.map(prepareReceipt);
    // QR не нашёлся на исходном фото — пробуем на обрезанном и выровненном
    if (!qr) for (const p of prepared) { qr = await findQR(p.base).catch(() => null); if (qr) break; }

    const worker = await makeWorker(onProgress, 'ocr');
    try {
      // попытка 1: контрастный ч/б, строки одним блоком
      const r1 = await recognizeAll(worker, prepared.map((p) => p.bin), '6');
      let best = { ...r1, parsed: parseText(r1.text), pass: 1 };
      const okEnough = (b) => qr && mismatch(b.parsed, qr) <= Math.max(1, qr.sum * 0.01);
      // попытка 2 — только если первая не сошлась: мягкий серый, колонки переменной ширины
      if (!okEnough(best)) {
        worker.state.stage = 'ocr2';
        const r2 = await recognizeAll(worker, prepared.map((p) => p.gray), '4');
        const alt = { ...r2, parsed: parseText(r2.text), pass: 2 };
        const better = qr
          ? mismatch(alt.parsed, qr) < mismatch(best.parsed, qr) - 0.01 ||
            (Math.abs(mismatch(alt.parsed, qr) - mismatch(best.parsed, qr)) < 0.01 && alt.parsed.items.length > best.parsed.items.length)
          : alt.parsed.items.length * (alt.conf + 1) > best.parsed.items.length * (best.conf + 1);
        if (better) best = alt;
      }
      return {
        qr, text: best.text, items: best.parsed.items, ocrTotal: best.parsed.total, discount: best.parsed.discount,
        info: { pass: best.pass, conf: Math.round(best.conf), cropped: prepared.some((p) => p.crop), angle: prepared[0] ? prepared[0].angle : 0 },
      };
    } finally {
      worker.terminate();
    }
  }

  // Распознать текст с любых картинок (фото страницы рецепта, скриншот и т.п.)
  async function ocrText(sources, onProgress, psm = '4') {
    const canvases = [];
    for (const s of sources) canvases.push(prepForOCR(s instanceof HTMLCanvasElement ? s : await loadImage(s)));
    const worker = await makeWorker(onProgress ? (e) => { if (e.stage === 'ocr') onProgress(e.p); } : null);
    try {
      return (await recognizeAll(worker, canvases, psm)).text;
    } finally { worker.terminate(); }
  }

  window.Receipt = { scan, parseQR, parseText, prepForOCR, prepareReceipt, skewAngle, paperBox, findQR, ocrText, loadScript, loadImage, binarize, grayVariant, toCanvas, rotate };
})();
