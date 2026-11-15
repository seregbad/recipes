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
    // 3) на чеке несколько QR (розыгрыши, опросы) и они мелкие — jsQR видит только один и не всегда.
    // Просматриваем фото полосами по четверти высоты с перекрытием, снизу вверх: налоговый QR обычно последний.
    const th = Math.round(img.height / 4);
    for (let y = img.height - th; y > -th / 2; y -= Math.round(th / 2)) {
      const crop = { x: 0, y: Math.max(0, y), w: img.width, h: th };
      tries.push([800, crop], [1200, crop]);
    }
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

  // ---------- Подготовка фото для нейросети (PP-OCR) ----------
  // Где на фото текст: по «точкам букв» (тёмное на светлом). Работает на любом фоне, в том числе когда
  // белый чек лежит на светлом столе и по яркости бумагу от стола не отличить. Рамка — в пикселях источника.
  function textBox(src) {
    const c = toCanvas(src, 1000);
    const { g, w, h } = toGray(c);
    const integ = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) { let row = 0; for (let x = 1; x <= w; x++) { row += g[(y - 1) * w + x - 1]; integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + row; } }
    const R = Math.max(3, Math.round(Math.min(w, h) / 80)), area = (2 * R + 1) * (2 * R + 1);
    const col = new Uint32Array(w), row = new Uint32Array(h);
    let n = 0;
    for (let y = R; y < h - R; y++) {
      for (let x = R; x < w - R; x++) {
        const m = (integ[(y + R + 1) * (w + 1) + x + R + 1] - integ[(y - R) * (w + 1) + x + R + 1] - integ[(y + R + 1) * (w + 1) + x - R] + integ[(y - R) * (w + 1) + x - R]) / area;
        const v = g[y * w + x];
        if (m > 100 && v < m * 0.8 && m - v > 18) { col[x]++; row[y]++; n++; }
      }
    }
    if (n < 300) return null;
    // отбрасываем по краям по ~1% точек: случайные тёмные пятна вне чека не растягивают рамку
    const cut = (a, share) => {
      let acc = 0, i1 = 0, i2 = a.length - 1;
      for (let i = 0; i < a.length; i++) { acc += a[i]; if (acc >= n * share) { i1 = i; break; } }
      acc = 0;
      for (let i = a.length - 1; i >= 0; i--) { acc += a[i]; if (acc >= n * share) { i2 = i; break; } }
      return [i1, i2];
    };
    const [x1, x2] = cut(col, 0.01), [y1, y2] = cut(row, 0.004);
    if (x2 - x1 < 20 || y2 - y1 < 20) return null;
    const px = (x2 - x1) * 0.06 + 4, py = (y2 - y1) * 0.02 + 6, k = src.width / w;
    const X = Math.max(0, (x1 - px) * k), Y = Math.max(0, (y1 - py) * k);
    return { x: X, y: Y, w: Math.min(src.width - X, (x2 - x1 + 2 * px) * k), h: Math.min(src.height - Y, (y2 - y1 + 2 * py) * k) };
  }
  function scaleCanvas(c, k) {
    const o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(c.width * k)); o.height = Math.max(1, Math.round(c.height * k));
    const ctx = o.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, o.width, o.height);
    return o;
  }
  const MAX_PX = 9e6; // больше — телефону тяжело
  const fitScale = (c, k) => Math.max(0.15, Math.min(k, 3.5, Math.sqrt(MAX_PX / (c.width * c.height))));
  // Найти чек, выровнять, привести к масштабу, удобному для сети (ширина текста ~800 px).
  function prepareNN(img) {
    const box = textBox(img);
    let src = toCanvas(img, 4200, box ? {
      x: Math.max(0, box.x - box.w * 0.1), y: Math.max(0, box.y - box.h * 0.03),
      w: Math.min(img.width - Math.max(0, box.x - box.w * 0.1), box.w * 1.2), h: Math.min(img.height - Math.max(0, box.y - box.h * 0.03), box.h * 1.06),
    } : undefined);
    const scale = fitScale(src, 800 / src.width);
    return { src, canvas: scaleCanvas(src, scale), scale, crop: !!box };
  }

  // ---------- Разбор текста чека в позиции ----------
  // \b и \W в JS не понимают кириллицу — граница слова через (?![а-яё])
  const W = (s) => s + '(?![а-яё])';
  const SKIP = new RegExp([
    '(?:^|\\s)(?:ооо|оао|зао|пао|ао|ип)(?=\\s|«|"|$)',
    // короткие сокращения — только отдельным словом: «инн» есть внутри «блинная», «длиннозёрный»
    '(?:^|[^а-яё])(?:инн|рн|зн|фн|фд|фп)(?![а-яё])', 'кассир', W('касса'), 'ккт', 'смена', 'кассовый', W('чек'),
    'приход', 'возврат', 'сайт', 'nalog', 'офд', 'www', 'http', 'спасибо', 'адрес', 'место расч', W('сно'), W('осн'), W('усн'),
    'продавец', 'покупател', 'телефон', 'e-?mail', 'бонус', 'балл', W('карт[аы]'), 'оплат', 'получено', 'сдача', 'наличн',
    'безнал', 'электрон', 'скидк', 'ндс', 'сумма', 'признак', 'способ', 'предмет', W('товар'), W('код'), 'штрих', 'дисконт',
    'экономия', 'округл', 'номер', W('qr'),
    // «НДС 22% 1.53» под позицией в электронном чеке; «НДС» часто читается латиницей: «HDC», «HAC»
    '(?:^|\\s)[нh][дdаa][сc](?=\\s|\\d|:|$)', 'ждём', 'ждем', 'терминал', 'мерчант', 'одобрено', 'bluetooth', 'rrn', 'сбербанк', 'идентификатор', 'комисси',
  ].join('|'), 'i');
  const MONEY = '\\d{1,6}[.,]\\d{2}';
  const MONEY_END = new RegExp('(' + MONEY + ')\\s*\\S?$');

  const toNum = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  const r2 = (v) => Math.round(v * 100) / 100;
  const decs = (s) => (String(s).split(/[.,]/)[1] || '').length;
  // расстояние Левенштейна: сколько букв/цифр надо поменять, чтобы из одной строки получить другую
  function lev(a, b) {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  // латинские буквы, неотличимые от русских: распознавание часто путает их («TOBAPA» вместо «ТОВАРА»)
  const LOOK = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У', a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к' };
  // слово, где русские буквы перемешаны с похожими латинскими → чистая кириллица; настоящая латиница (FAMILIA) не трогается
  // и наоборот: латинское слово с вкраплёнными русскими «е», «а», «о» («BЕLLА») → латиница
  const LOOK_LAT = Object.fromEntries(Object.entries(LOOK).map(([l, c]) => [c, l]));
  const cyr = (line) => line.replace(/[A-Za-zА-Яа-яЁё]+/g, (w) => {
    if (!/[A-Za-z]/.test(w) || !/[А-Яа-яЁё]/.test(w)) return w;
    if (/^[ABCEHKMOPTXYaceopxyk]+$/.test(w.replace(/[А-Яа-яЁё]/g, ''))) return w.replace(/[A-Za-z]/g, (ch) => LOOK[ch] || ch);
    const ru = w.replace(/[A-Za-z]/g, '');
    return ru.length * 2 <= w.length && [...ru].every((ch) => LOOK_LAT[ch]) ? w.replace(/[А-Яа-я]/g, (ch) => LOOK_LAT[ch] || ch) : w;
  });
  // «скелет» строки для поиска служебных слов: только буквы, заглавные, латиница приведена к кириллице
  const skel = (s) => String(s).toUpperCase().replace(/[A-Z]/g, (ch) => LOOK[ch] || ch).replace(/[^A-ZА-ЯЁ]/g, '');
  // строка начинается со слова word с точностью до maxD ошибок распознавания
  function fuzzyStart(line, word, maxD) {
    const k = skel(line);
    if (k.length < word.length - maxD) return false;
    for (let L = word.length - maxD; L <= word.length + maxD; L++) if (lev(k.slice(0, L), word) <= maxD) return true;
    return false;
  }
  const isCode = (line) => fuzzyStart(line, 'КОДТОВАРА', 3);
  // строки оплаты: «Сумма (руб): 2597.37», «Безналичными =2597.37»
  const isPay = (line) => MONEY_END.test(line) && (fuzzyStart(line, 'СУММА', 1) || fuzzyStart(line, 'БЕЗНАЛИЧНЫМИ', 3) || fuzzyStart(line, 'НАЛИЧНЫМИ', 2));
  const isDiscount = (line) => /скидк|дисконт|экономия/i.test(line) || (skel(line).length <= 9 && MONEY_END.test(line) && fuzzyStart(line, 'СКИДКА', 2));
  const isTotal = (line) => /^[^а-яёa-z0-9]*(итого|итог|всего|подытог)(?![а-яё])/i.test(line) ||
    (MONEY_END.test(line) && skel(line).length <= 6 && (fuzzyStart(line, 'ИТОГ', 1) || fuzzyStart(line, 'ИТОГО', 1)));

  // частые ошибки распознавания внутри чисел: О→0, З→3, б/Б→6, l/I/|→1, Z→2
  function fixNumbers(line) {
    return line.replace(/[\dОоOЗзбБlI|SВZ]+[.,]?[\dОоOЗзбБlI|SВZ]*/g, (tok) => {
      if (!/\d/.test(tok) || /[а-яё]{2,}/i.test(tok.replace(/[ОоЗзбБВ]/g, ''))) return tok;
      const digits = tok.replace(/[^\d.,]/g, '').length;
      if (digits < tok.length / 2 && !/^\d/.test(tok)) return tok;
      return tok.replace(/[ОоO]/g, '0').replace(/[Зз]/g, '3').replace(/[бБ]/g, '6').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/В/g, '8').replace(/Z/g, '2');
    });
  }
  function cleanName(s) {
    let n = String(s || '')
      .replace(/^\s*\d{1,3}\s*[.)]?\s+(?=\D)/, '')   // номер позиции
      .replace(/[*#_|~^<>{}[\]\\]+/g, ' ')
      .replace(/\s+(ндс|nds)\s*\d+\s*%?.*$/i, '')
      .replace(/\s+[АБВабв]\s*$/, '')                 // метки налога в конце
      .replace(/(^|\s)[Ээ](?=(?:кг|мл)(?![а-яё]))/gi, (m, a) => a + '9') // «ЭКГ» — это «9КГ»
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/^[\s.,:;=-]+|[\s.,:;=-]+$/g, '');
    // распознавание путает регистр («СыРок ГлАЗ») — приводим к обычному виду
    if (n && /[А-ЯЁ]/.test(n.slice(1))) n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    return n;
  }
  // «…1кг, кг» / «…500г. ШТ.» — единица продажи в конце названия
  // ---------- Исправление названий ----------
  // Частые слова из чеков продуктовых магазинов: по ним чинятся опечатки распознавания.
  const GROCERY = new Set(`фрукт фрукты овощи свинина говядина баранина индейка курица куриное куриная куриные цыпленок филе грудка бедро
    голень крылья окорочка фарш лопатка шейка корейка ребра охлажденная охлажденный замороженная замороженный копченая вареная колбаса
    сосиски сардельки ветчина бекон хлеб батон багет лаваш булочка булочки столичный бородинский нарезка нарезной нарезанный хлебный
    яблоки яблоко сезонные груши бананы апельсины мандарины лимоны лимон лайм виноград тайфун киви авокадо гранат персики сливы хурма
    ананас картофель морковь репчатый чеснок капуста белокочанная цветная огурцы помидоры томаты черри перец сладкий кабачки баклажаны
    свекла редис зелень укроп петрушка салат шампиньоны грибы макароны паста спагетти рожки перья спирали лапша вермишель тонкие
    классические гречка гречневая крупа овсяные хлопья геркулес пшеничная сахар масло подсолнечное оливковое сливочное молоко
    пастеризованное ультрапастеризованное питьевое кефир ряженка йогурт сметана творог творожный творожная сырок сырки глазированный
    ваниль ванильный какао шоколад шоколадный гауда российский моцарелла плавленый сливки майонез кетчуп горчица соус яйца яйцо
    столовые отборные минеральная газированная негазированная нектар печенье пряники вафли конфеты зефир мармелад пирожное мороженое
    пломбир пельмени вареники котлеты рыба горбуша семга лосось форель скумбрия сельдь минтай треска креветки крабовые палочки
    консервы горошек кукуруза фасоль тунец салфетки бумажные бумага туалетная полотенца пакет пакеты мыло шампунь порошок средство
    губки фольга пленка брест литовск пискаревский пюрпак напиток газировка семечки орехи арахис фисташки миндаль изюм курага чернослив
    кукурузные завтрак мюсли соевый бульон приправа специи лавровый корица дрожжи разрыхлитель крахмал желатин уксус огурчики маринованные
    квашеная квашеный соленые соленая бананов банановый клубничный клубника вишневый яблочный апельсиновый томатный сок морс пиво квас
    сервелат салями копченый копченая сырокопченая варено-копченая халяль прокладки тампоны подгузники зубная паста щетка гель мешки
    цыпленка бройлера голени крылышки тушка тушки грудки окорок шея вырезка мякоть рулька грудинка пашина
    коровка корен темный молочный горький сгущенка сгущенное ряженка снежок бифидок простокваша масло топленое сливочное кавказа
    предгорье брынза сулугуни адыгейский пармезан чеддер маасдам косичка копченый тесто пицца пельмени хинкали`
    .split(/\s+/).filter(Boolean));
  // цифра, распознанная вместо похожей буквы внутри слова: «хле6» → «хлеб», «6ум» → «бум», «м0локо» → «молоко»
  const DIGIT_AS_LETTER = { 6: 'б', 0: 'о', 3: 'з', 8: 'в', 4: 'ч' };
  function digitsToLetters(name) {
    return name.replace(/[а-яё0-9]+/gi, (w) => {
      const digits = w.replace(/\D/g, '');
      if (digits.length !== 1 || !/[а-яё]{2}/i.test(w) || !DIGIT_AS_LETTER[digits]) return w;
      // «45г», «500г», «2к» — это фасовка, а не слово
      if (/^\d+(г|гр|кг|мл|л|шт|см|мм|к)$/i.test(w)) return w;
      return w.replace(/\d/, (d) => DIGIT_AS_LETTER[d]);
    });
  }
  const norm = (w) => w.toLowerCase().replace(/ё/g, 'е');
  // ближайшее слово словаря: не больше 1 ошибки (2 для длинных слов), и только если вариант один
  function nearest(lw, vocab, maxD) {
    let best = '', bd = maxD + 1, tie = false;
    for (const v of vocab) {
      if (Math.abs(v.length - lw.length) > maxD) continue;
      const d = lev(v, lw);
      // две правки — только если первая буква совпала: иначе «квашеная» превращалась в «вареная»
      if (d >= 2 && v[0] !== lw[0]) continue;
      if (d < bd) { bd = d; best = v; tie = false; } else if (d === bd && v !== best) tie = true;
    }
    return best && !tie ? best : '';
  }
  // Название с чека → без опечаток. vocab — дополнительные «правильные» слова (справочник, прошлые покупки).
  function fixName(name, extra) {
    const vocab = extra ? new Set([...GROCERY, ...extra]) : GROCERY;
    const list = [...vocab];
    let words = digitsToLetters(String(name || '')).split(/\s+/).filter(Boolean);
    const isWord = (w) => /^[а-яё]+$/i.test(w);
    // 1) слово, разрезанное пробелом: «кар гофель» → «картофель»
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i], b = words[i + 1];
      if (!isWord(a) || !isWord(b) || vocab.has(norm(a)) || vocab.has(norm(b))) continue;
      const joined = norm(a + b);
      const hit = vocab.has(joined) ? joined : joined.length >= 6 ? nearest(joined, list, joined.length >= 9 ? 2 : 1) : '';
      if (hit) { words.splice(i, 2, hit); i--; }
    }
    // 2) отдельные слова; короткие (4 буквы) — только первое: там обычно сам продукт («Рукт» → «фрукт»)
    words = words.map((w, i) => {
      if (!isWord(w) || vocab.has(norm(w))) return w;
      const lw = norm(w);
      if (lw.length < 4 || (lw.length === 4 && i > 0)) return w;
      return nearest(lw, list, lw.length >= 8 ? 2 : 1) || w;
    });
    const out = words.join(' ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  function splitUnit(name) {
    // в электронных чеках единица идёт через точку с запятой: «Пакет ЛЕНТА 9кг ; шт.» («шт» читается и как «wт»)
    const m = name.match(/[\s.,;]+(кг|шт|wт|wt|л)\.?$/i);
    const unit = m ? m[1].toLowerCase().replace(/^w[тt]$/, 'шт') : '';
    return m ? { name: name.slice(0, m.index).replace(/[\s.,;]+$/, ''), unit } : { name: name.replace(/[\s;]+$/, ''), unit: '' };
  }
  // «0.452 x 199.99 = 90.40», «1 * 54,99 =54.99», «89.99 x 1»
  function parseCalc(line) {
    // знак умножения бывает распознан дважды: «1 хх 94.99», «1 х х 94.99»
    const m = line.match(/(\d{1,6}(?:[.,]\d{1,3})?)\s*(?:шт|кг|л|г)?\.?\s*[xх×*](?:\s*[xх×*])?\s*(\d{1,6}(?:[.,]\d{1,3})?)\s*(?:шт|кг|л|руб|р)?\.?(?:[^\dа-яё]{0,6}(\d{1,6}[.,]\d{2}))?/i);
    if (!m) return null;
    // в расчёте всегда есть цена с копейками; «24х23 см» в названии — не расчёт
    if (decs(m[1]) !== 2 && decs(m[2]) !== 2 && !m[3]) return null;
    let qs = m[1], ps = m[2];
    if (decs(m[1]) === 2 && decs(m[2]) !== 2) { ps = m[1]; qs = m[2]; }
    const qty = toNum(qs), price = toNum(ps);
    if (!(qty > 0) || !(price > 0) || qty * price > 1e6) return null;
    return { qty, price, qs, ps, sum: m[3] ? toNum(m[3]) : null, rest: line.slice(0, m.index).trim() };
  }
  // Сверка «количество × цена = сумма». Если не сходится — одна из трёх цифр распознана неверно:
  // исправляем ту, для которой нужна самая маленькая правка (1.305 × 179.99 = 249.29 → количество 1.385).
  function repair(it) {
    const calc = r2(it.qty * it.price);
    if (it.sum == null) { it.total = calc; return; }
    if (Math.abs(calc - it.sum) <= 0.011) { it.total = it.sum; return; }
    const cands = [];
    // «=94.99» иногда читается как «394.99» или «194.99» (знак «=» или метка слева прилипают к числу)
    cands.push({ k: 'sum', v: calc, total: calc, d: it.sum.toFixed(2).endsWith(calc.toFixed(2)) ? 0 : lev(calc.toFixed(2), it.sum.toFixed(2)) });
    const whole = !decs(it.qs);
    const q = whole ? Math.round(it.sum / it.price) : Math.round((it.sum / it.price) * 1000) / 1000;
    if (q > 0 && Math.abs(r2(q * it.price) - it.sum) <= 0.011) cands.push({ k: 'qty', v: q, total: it.sum, d: lev(q.toFixed(decs(it.qs)), String(it.qs).replace(',', '.')) });
    const p = r2(it.sum / it.qty);
    if (p > 0 && Math.abs(r2(it.qty * p) - it.sum) <= 0.011) cands.push({ k: 'price', v: p, total: it.sum, d: lev(p.toFixed(2), String(it.ps).replace(',', '.')) });
    // при равных правках верим сумме строки, а поправляем цену или количество: для итога важна именно сумма
    cands.sort((a, b) => a.d - b.d || (a.k === 'sum') - (b.k === 'sum'));
    it.alts = cands; // запасные варианты: пригодятся, если не сойдётся итог чека
    if (cands[0].d > 3) { it.total = it.sum; it.price = r2(it.sum / it.qty); it.doubt = true; return; } // цифры совсем не сходятся — верим сумме строки
    applyFix(it, cands[0]);
  }
  function applyFix(it, c) {
    if (c.k === 'qty') it.qty = c.v; else if (c.k === 'price') it.price = c.v;
    it.total = c.total;
    it.fixed = c.k; it.doubt = false;
  }

  function parseText(text) {
    const lines = String(text || '').split(/\n+/).map((l) => fixNumbers(cyr(l.replace(/\s+/g, ' ').trim()))).filter(Boolean);
    const maxLen = Math.min(60, Math.max(24, ...lines.map((l) => l.length)));
    const items = [];
    let pending = [], last = null, total = null, discount = 0, stamp = null;
    // название — строка прямо над расчётом; строка над ней добавляется, только если это перенос длинного названия
    const takeName = (rest) => {
      const p = pending;
      let name = rest || '';
      if (!name && p.length) name = p[p.length - 1].t;
      const tail = rest ? p[p.length - 1] : p[p.length - 2], head = rest ? null : p[p.length - 1];
      if (tail && (!head || tail.idx === head.idx - 1) && (tail.t.length >= maxLen * 0.75 || (head && head.t.length <= 5))) name = tail.t + ' ' + name;
      return cleanName(name);
    };
    lines.forEach((line, idx) => {
      if (!stamp) {
        // «15.11.26 21:14», а бывает и слитно: «15.11.2621:14»
        const d = line.match(/(\d{2})[.\/](\d{2})[.\/](20\d{2}|\d{2})\s*(\d{1,2})[:.](\d{2})(?!\d)/);
        if (d && +d[1] >= 1 && +d[1] <= 31 && +d[2] >= 1 && +d[2] <= 12 && +d[4] < 24) stamp = { date: `${d[3].length === 2 ? '20' + d[3] : d[3]}-${d[2]}-${d[1]}`, time: `${d[4].padStart(2, '0')}:${d[5]}` };
      }
      if (total !== null) return;
      // «Скидка -10.00», «Скидка по карте 15,50» — запоминаем, чтобы сверить с суммой чека
      if (isDiscount(line)) {
        const m = line.match(MONEY_END);
        if (m && toNum(m[1]) < 1e5) discount += toNum(m[1]);
        pending = [];
        return;
      }
      if (isTotal(line)) {
        const m = line.match(MONEY_END);
        total = m ? toNum(m[1]) : 0;
        return;
      }
      if (isCode(line) || isPay(line)) { pending = []; return; }
      const letters = (line.match(/[а-яёa-z]/gi) || []).length;
      // строка «=359.59» под расчётом — сумма позиции. Знак «=» часто читается как «*», «+» или пропадает,
      // поэтому узнаём её по смыслу: число без букв, близкое к «кол-во × цена» строкой выше
      if (last && !last.simple && last.sum == null && idx - last.line <= 2 && letters <= 1 && !pending.length) {
        const sm = line.match(/^(?:\S{1,3}\s+)?[^\dа-яёa-z\s]{0,2}\s*(\d{1,6}[.,]\d{2})\s*\S?$/i);
        if (sm) {
          const v = toNum(sm[1]), want = r2(last.qty * last.price);
          // допуск 12%: одна неверно прочитанная цифра в количестве («1.305» вместо «1.385») не должна мешать узнать сумму
          if (/[=≡]/.test(line) || Math.abs(v - want) <= Math.max(0.011, want * 0.12) || lev(v.toFixed(2), want.toFixed(2)) <= 2) { last.sum = v; last.line = idx; return; }
        }
      }
      const calc = parseCalc(line);
      if (SKIP.test(line) && !calc) { pending = []; return; }

      if (calc) {
        // позиция была строкой выше с той же суммой — это её расшифровка «кол-во × цена»
        if (last && last.line === idx - 1 && !pending.length && last.simple && Math.abs(last.total - r2(calc.qty * calc.price)) < 0.011) {
          Object.assign(last, { qty: calc.qty, price: calc.price, qs: calc.qs, ps: calc.ps, line: idx });
          return;
        }
        last = { name: takeName(calc.rest), qty: calc.qty, price: calc.price, qs: calc.qs, ps: calc.ps, sum: calc.sum, line: idx };
        items.push(last);
        pending = [];
        return;
      }
      const end =line.match(new RegExp('^(.*[а-яёa-z].*?)\\s+(' + MONEY + ')\\s*[=*\\S]?$', 'i'));
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
        if (!price || Math.abs(price * qty - tot) > Math.max(1, tot * 0.05)) price = r2(tot / (qty || 1));
        last = { name: takeName(name), qty, price, total: tot, simple: true, line: idx };
        items.push(last);
        pending = [];
        return;
      }
      if (letters >= 3) { pending.push({ t: line, idx }); if (pending.length > 3) pending.shift(); }
    });
    items.forEach((i) => { if (!i.simple) repair(i); });
    // В чеке, где у позиций есть строка «кол-во × цена», одиночные строки «слово … сумма» — это не товары,
    // а оплата («Сумма (руб)», «Безналичными»): убираем их, если без них чек сходится или они равны итогу.
    let list = items.filter((i) => i.total > 0);
    const full = list.filter((i) => !i.simple);
    if (full.length >= 2 && full.length < list.length) {
      const fs = full.reduce((s, i) => s + i.total, 0);
      const fits = total && (Math.abs(fs - total) <= 0.05 || Math.abs(fs - discount - total) <= 0.05);
      list = fits ? full : list.filter((i) => !i.simple || !(total ? Math.abs(i.total - total) <= 0.05 : i.total >= fs - 0.05));
    }
    // Итог чека не сошёлся — пробуем у одной из спорных позиций другой вариант исправления
    const off = () => r2(list.reduce((s, i) => s + i.total, 0) - total);
    if (total && Math.abs(off()) > 0.05 && Math.abs(off() - discount) > 0.05) {
      search: for (const it of list) {
        for (const c of it.alts || []) {
          if (Math.abs(c.total - it.total) > 0.005 && (Math.abs(off() - it.total + c.total) <= 0.05 || Math.abs(off() - it.total + c.total - discount) <= 0.05)) { applyFix(it, c); break search; }
        }
      }
    }
    return {
      items: list.map((i) => {
        const u = splitUnit(i.name);
        return {
          name: fixName(u.name), raw: u.name, total: i.total, price: i.price,
          qty: String(Math.round(i.qty * 1000) / 1000).replace('.', ','),
          unit: i.qty % 1 ? (u.unit === 'л' ? 'л' : 'кг') : (u.unit === 'л' ? 'л' : 'шт'),
          fixed: i.fixed || '', doubt: !!i.doubt,
        };
      }),
      total: total || null,
      fiscal: fiscal(lines),
      discount: r2(discount),
      stamp,
    };
  }

  // ---------- Реквизиты чека для проверки в ФНС ----------
  // Внизу чека: «ФН: 7384440901580567», «ФД: 25187», «ФП: 2685007847». Распознавание часто читает «ФД» как «0D», «ФП» как «0П»,
  // поэтому ищем по смыслу: ФН — 16 цифр, начинается с 7 или 9; ФП — до 10 цифр после «П»; ФД — число после «Д/D».
  function fiscal(lines) {
    const all = (Array.isArray(lines) ? lines : String(lines || '').split('\n')).join(' \n ');
    const fnM = all.match(/(?<!\d)([79]\d{15})(?!\d)/);
    // «Ф» бывает прочитана как греческая «Φ», «Д» — как «A»; номер ищем только в той же строке
    const fpM = all.match(/[ФфΦOО0][ПпNnPР][ \t]*[:.№]?[ \t]*(\d{6,10})(?!\d)/);
    const fdM = all.match(/[ФфΦOО0][ДдDdАA][ \t]*[:.№]?[ \t]*(\d{1,10})(?!\d)/);
    let fd = fdM ? fdM[1] : '', fp = fpM ? fpM[1] : '';
    // подписи «ФД»/«ФП» не прочитались совсем: «СНО:ОСН :25187 0:2685007847» — внизу чека два числа после двоеточий,
    // первое — номер документа, второе (8–10 цифр) — фискальный признак
    if (!fd || !fp) {
      const rows = (Array.isArray(lines) ? lines : String(lines || '').split('\n')).slice(-8).reverse();
      for (const r of rows) {
        const m = r.match(/:\s*(\d{1,9})\s+\S{0,4}:\s*(\d{8,10})(?!\d)/);
        if (m) { fd = fd || m[1]; fp = fp || m[2]; break; }
      }
    }
    return { fn: fnM ? fnM[1] : '', fd, fp };
  }
  // Строка как в QR-коде, собранная из текста чека (если сам QR не прочитался)
  function qrFromText(parsed) {
    const f = parsed.fiscal || {}, st = parsed.stamp;
    if (!f.fn || !f.fd || !f.fp || !st || !parsed.total) return '';
    return `t=${st.date.replace(/-/g, '')}T${st.time.replace(':', '')}&s=${parsed.total.toFixed(2)}&fn=${f.fn}&i=${f.fd}&fp=${f.fp}&n=1`;
  }

  // ---------- Проверка чека по базе ФНС (proverkacheka.com) ----------
  // Сервис сам берёт чек из ФНС по реквизитам: точные названия, количества и суммы. Нужен токен из личного кабинета.
  const FNS_CODES = {
    0: 'чек не найден или реквизиты прочитаны неверно',
    2: 'ФНС ещё не получила этот чек, попробуйте через несколько часов',
    3: 'исчерпан лимит запросов к сервису на сегодня',
    4: 'сервис просит подождать, попробуйте через минуту',
    5: 'сервис не смог получить данные чека',
    401: 'неверный токен — проверьте его в настройках',
  };
  const MEASURE = { 10: 'г', 11: 'кг', 40: 'мл', 41: 'л' };
  async function fns(qrraw, token) {
    const fd = new FormData();
    fd.append('token', token); fd.append('qrraw', qrraw);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
    let body;
    try {
      const res = await fetch('https://proverkacheka.com/api/v1/check/get', { method: 'POST', body: fd, signal: ctrl.signal });
      body = await res.json();
    } catch (e) {
      throw new Error(ctrl.signal.aborted ? 'сервис проверки чеков не ответил' : 'нет связи с сервисом проверки чеков');
    } finally { clearTimeout(timer); }
    const code = Number(body && body.code);
    if (code !== 1) throw new Error(FNS_CODES[code] || (typeof (body && body.data) === 'string' ? body.data : 'неизвестная ошибка сервиса'));
    const j = (body.data && (body.data.json || body.data)) || {};
    const doc = j.document && j.document.receipt ? j.document.receipt : j;
    const kop = (v) => Math.round(Number(v) || 0) / 100;
    const items = (doc.items || []).map((it) => {
      const q = Number(it.quantity) || 1;
      const unit = MEASURE[it.itemsQuantityMeasure] || (q % 1 ? 'кг' : 'шт');
      return { name: String(it.name || '').replace(/\s+/g, ' ').trim(), qty: String(Math.round(q * 1000) / 1000).replace('.', ','), unit, price: kop(it.price), total: kop(it.sum) };
    }).filter((i) => i.name && i.total > 0);
    let date = '', time = '';
    const dt = doc.dateTime;
    if (typeof dt === 'number') { const d = new Date(dt * 1000); date = d.toISOString().slice(0, 10); time = d.toISOString().slice(11, 16); } // UTC: точное время чека в QR
    else if (dt) { date = String(dt).slice(0, 10); time = String(dt).slice(11, 16); }
    return { items, total: kop(doc.totalSum), date, time, shop: String(doc.retailPlace || doc.user || '').replace(/^ООО\s*|"/g, '').trim() };
  }

  // Сравнить распознанное с эталоном (данными ФНС): сколько сумм совпало и насколько похожи названия
  function compare(ocrItems, refItems) {
    const pool = ocrItems.map((i) => ({ ...i, used: false }));
    let amounts = 0, names = 0;
    const rows = refItems.map((ref) => {
      const hit = pool.find((o) => !o.used && Math.abs(o.total - ref.total) < 0.011);
      if (!hit) return { ref: ref.name, total: ref.total, ocr: '', sim: 0 };
      hit.used = true; amounts++;
      const a = norm(hit.raw || hit.name).replace(/[^а-яa-z0-9]/g, ''), b = norm(ref.name).replace(/[^а-яa-z0-9]/g, '');
      const sim = 1 - lev(a, b) / Math.max(1, a.length, b.length);
      names += sim;
      return { ref: ref.name, total: ref.total, ocr: hit.raw || hit.name, sim };
    });
    return { amounts, of: refItems.length, extra: pool.filter((o) => !o.used).length, names: amounts ? names / amounts : 0, rows };
  }

  // ---------- Всё вместе ----------
  // насколько распознанные позиции сходятся с суммой чека (0 — идеально); скидки могут быть уже учтены в ценах
  function mismatch(parsed, target) {
    if (!target) return Infinity;
    const sum = parsed.items.reduce((s, i) => s + i.total, 0);
    return Math.min(Math.abs(sum - target), Math.abs(sum - (parsed.discount || 0) - target));
  }
  // несколько фото одного длинного чека: строки второго фото, которые уже были в конце первого, не повторяем
  function mergePages(pages) {
    const key = (s) => skel(s) + s.replace(/\D/g, '');
    const same = (a, b) => { const x = key(a), y = key(b); return lev(x, y) <= Math.max(1, Math.round(Math.max(x.length, y.length) * 0.25)); };
    let out = [];
    for (const lines of pages) {
      // ищем, на сколько строк начало нового фото перекрывает конец уже прочитанного (крайние строки могут быть обрезаны)
      let cut = 0, best = 0;
      for (let k = Math.min(60, lines.length, out.length); k >= 3; k--) {
        let ok = 0;
        for (let i = 0; i < k; i++) if (same(out[out.length - k + i], lines[i])) ok++;
        if (ok >= 3 && ok >= k * 0.7 && ok > best) { best = ok; cut = k; }
      }
      out = out.concat(lines.slice(cut));
    }
    return out;
  }

  // Новый способ: нейросеть PP-OCR
  async function scanNN(imgs, onProgress) {
    const say = (stage, p) => onProgress && onProgress({ stage, p });
    await window.OCR.load((p) => say('load', p));
    const pages = [], preps = [];
    let conf = 0, textH = Infinity;
    for (const [n, img] of imgs.entries()) {
      say('prep', 0);
      const prep = prepareNN(img);
      preps.push(prep);
      const progress = (p) => say('ocr', (n + p) / imgs.length);
      // сначала только ищем текст и смотрим высоту строк: сеть лучше всего читает строки высотой ~36 px,
      // поэтому мелко снятый чек увеличиваем, а крупный уменьшаем
      let canvas = prep.canvas, scale = prep.scale, found = await window.OCR.find(canvas);
      // наклон: сеть сама показывает, под каким углом идут строки, — выравниваем точно
      if (Math.abs(found.skew) >= 0.4 && Math.abs(found.skew) <= 40) {
        prep.src = rotate(prep.src, -found.skew, '#bbb');
        prep.angle = found.skew;
        scale = fitScale(prep.src, scale);
        canvas = scaleCanvas(prep.src, scale);
        found = await window.OCR.find(canvas);
      }
      if (found.medH && (found.medH < 31 || found.medH > 44)) {
        const k = fitScale(prep.src, (scale * 37) / found.medH);
        if (Math.abs(k / scale - 1) > 0.1) { scale = k; canvas = scaleCanvas(prep.src, k); found = null; }
      }
      const r = await window.OCR.read(canvas, progress, found);
      pages.push(r.lines.map((L) => L.parts.map((b) => b.text).join(' ')));
      conf += r.conf;
      if (r.medH) textH = Math.min(textH, r.medH / 1.6 / scale);
    }
    const text = mergePages(pages).join('\n');
    return { text, parsed: parseText(text), conf: (conf / Math.max(1, imgs.length)) * 100, engine: 'nn', preps, textH: isFinite(textH) ? Math.round(textH) : 0 };
  }

  // Прежний способ (Tesseract) — запасной, если нейросеть не загрузилась
  async function scanTess(imgs, qr, onProgress) {
    const prepared = imgs.map(prepareReceipt);
    const worker = await makeWorker(onProgress, 'ocr');
    try {
      // попытка 1: контрастный ч/б, строки одним блоком
      const r1 = await recognizeAll(worker, prepared.map((p) => p.bin), '6');
      let best = { ...r1, parsed: parseText(r1.text) };
      const target = (b) => (qr ? qr.sum : b.parsed.total);
      const okEnough = (b) => target(b) && mismatch(b.parsed, target(b)) <= Math.max(1, target(b) * 0.01);
      // попытка 2 — только если первая не сошлась: мягкий серый, колонки переменной ширины
      if (!okEnough(best)) {
        worker.state.stage = 'ocr2';
        const r2nd = await recognizeAll(worker, prepared.map((p) => p.gray), '4');
        const alt = { ...r2nd, parsed: parseText(r2nd.text) };
        const mb = mismatch(best.parsed, target(best)), ma = mismatch(alt.parsed, target(alt));
        const better = isFinite(mb) || isFinite(ma)
          ? ma < mb - 0.01 || (Math.abs(ma - mb) < 0.01 && alt.parsed.items.length > best.parsed.items.length)
          : alt.parsed.items.length * (alt.conf + 1) > best.parsed.items.length * (best.conf + 1);
        if (better) best = alt;
      }
      return { ...best, engine: 'tess', preps: prepared.map((p) => ({ src: p.base })), textH: 0 };
    } finally {
      worker.terminate();
    }
  }

  async function scan(files, onProgress) {
    const imgs = [];
    for (const f of files) imgs.push(await loadImage(f));
    onProgress && onProgress({ stage: 'qr', p: 0 });
    let qr = null;
    for (const img of imgs) { qr = await findQR(img).catch(() => null); if (qr) break; }
    onProgress && onProgress({ stage: 'prep', p: 0 });

    let res = null, nnError = window.OCR ? '' : 'модуль распознавания не подключён';
    if (window.OCR) {
      try { res = await scanNN(imgs, onProgress); } catch (e) {
        nnError = String((e && e.message) || e).replace(/^Не удалось загрузить распознавание \(|\)\. Нужен интернет при первом запуске$/g, '');
        console.warn('Нейросеть не сработала, читаю чек прежним способом', e);
      }
    }
    if (!res) res = await scanTess(imgs, qr, onProgress);
    // QR не нашёлся на исходном фото — пробуем на обрезанном и выровненном
    if (!qr) for (const p of res.preps) { qr = await findQR(p.src).catch(() => null); if (qr) break; }

    const parsed = res.parsed, target = qr ? qr.sum : parsed.total;
    const sum = parsed.items.reduce((s, i) => s + i.total, 0);
    // скидки, напечатанные отдельными строками, часто уже учтены в ценах — тогда вычитать их второй раз нельзя
    const discount = target && Math.abs(sum - target) <= 0.05 ? 0 : parsed.discount;
    return {
      qr, text: res.text, items: parsed.items, ocrTotal: parsed.total, discount, stamp: parsed.stamp,
      fiscal: parsed.fiscal, qrraw: qr ? qr.raw : qrFromText(parsed),
      info: { engine: res.engine, nnError, conf: Math.round(res.conf), textH: res.textH, fixed: parsed.items.filter((i) => i.fixed).length },
    };
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

  window.Receipt = { scan, lev, fixName, fiscal, qrFromText, fns, compare, parseQR, parseText, prepForOCR, prepareReceipt, prepareNN, textBox, skewAngle, paperBox, findQR, ocrText, loadScript, loadImage, binarize, grayVariant, toCanvas, rotate };
})();

