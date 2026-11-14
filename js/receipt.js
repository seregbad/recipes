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

  // ---------- Подготовка к распознаванию текста ----------
  // Серый + адаптивный порог (метод Брэдли): тени и неравномерный свет не мешают.
  function prepForOCR(img) {
    const c = toCanvas(img, 2400);
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
        const v = gray[y * w + x] * count < sum * (1 - t) ? 0 : 255;
        const k = (y * w + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  async function ocr(canvases, onProgress) {
    await loadScript(LIBS.tesseract);
    onProgress && onProgress({ stage: 'load', p: 0 });
    const worker = await window.Tesseract.createWorker('rus', 1, {
      ...TESS,
      logger: (m) => {
        if (!onProgress) return;
        if (m.status === 'recognizing text') onProgress({ stage: 'ocr', p: m.progress });
        else onProgress({ stage: 'load', p: m.progress || 0 });
      },
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      let text = '';
      for (const c of canvases) { const { data } = await worker.recognize(c); text += data.text + '\n'; }
      return text;
    } finally {
      worker.terminate();
    }
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
    let pending = [], last = null, total = null;
    lines.forEach((line, idx) => {
      if (total !== null) return;
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
    };
  }

  // ---------- Всё вместе ----------
  async function scan(files, onProgress) {
    const imgs = [];
    for (const f of files) imgs.push(await loadImage(f));
    onProgress && onProgress({ stage: 'qr', p: 0 });
    let qr = null;
    for (const img of imgs) { qr = await findQR(img).catch(() => null); if (qr) break; }
    onProgress && onProgress({ stage: 'prep', p: 0 });
    const canvases = imgs.map(prepForOCR);
    const text = await ocr(canvases, onProgress);
    const parsed = parseText(text);
    return { qr, text, items: parsed.items, ocrTotal: parsed.total };
  }

  // Распознать текст с любых картинок (фото страницы рецепта и т.п.)
  async function ocrText(sources, onProgress, psm = '4') {
    const canvases = [];
    for (const s of sources) canvases.push(prepForOCR(s instanceof HTMLCanvasElement ? s : await loadImage(s)));
    await loadScript(LIBS.tesseract);
    const worker = await window.Tesseract.createWorker('rus', 1, {
      ...TESS,
      logger: (m) => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
      let text = '';
      for (const c of canvases) { const { data } = await worker.recognize(c); text += data.text + '\n'; }
      return text;
    } finally { worker.terminate(); }
  }

  window.Receipt = { scan, parseQR, parseText, prepForOCR, findQR, ocrText, loadScript };
})();
