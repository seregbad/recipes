// Распознавание текста нейросетью PP-OCRv5 прямо в браузере (без серверов и платных сервисов):
//  • «детектор» находит на фото все куски текста (каждое слово/колонку отдельно, поэтому изгиб чека не мешает);
//  • «распознаватель» (модель для русского и латиницы) читает каждый кусок.
// На мелком тексте чеков читает намного точнее, чем Tesseract. Модели (~21 МБ) загружаются один раз и хранятся в кэше.
// Файлы берутся из папки ocr/ рядом с приложением, а если её нет — из интернета (jsDelivr и Hugging Face).
(function () {
  const LOCAL = new URL('./ocr/', location.href).href;
  const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  const HF = 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/';
  const REMOTE = { 'det.onnx': HF + 'detection/v3/det.onnx', 'rec.onnx': HF + 'languages/eslav/rec.onnx', 'dict.txt': HF + 'languages/eslav/dict.txt' };
  const CACHE = 'kuhnya-ocr-v1';

  let ready = null, det = null, rec = null, dict = null;
  // wavy — распрямлять изогнутые строки; lowMem — экономный режим для телефонов, которым не хватило памяти
  const opts = { wavy: true, lowMem: 0 };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => { s.remove(); reject(new Error('нет файла ' + src)); };
      document.head.appendChild(s);
    });
  }
  // файл модели: из кэша, иначе скачать (с ограничением по времени на «тишину») и положить в кэш
  async function fetchBuf(url, onPart) {
    let cache = null;
    // свои файлы (папка ocr/) кэширует сервис-воркер, чужие — сами
    if (!url.startsWith(location.origin)) {
      try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return await hit.arrayBuffer(); } catch (e) { /* кэш недоступен */ }
    }
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = +res.headers.get('content-length') || 0;
      const reader = res.body.getReader(), chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), 30000);
        if (onPart && total) onPart(Math.min(1, got / total)); // сжатая передача: байтов приходит больше, чем в заголовке
      }
      const buf = new Uint8Array(got);
      let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
      if (cache) cache.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
      return buf.buffer;
    } finally { clearTimeout(timer); }
  }

  // Журнал шагов распознавания. Пишется сразу в память телефона, поэтому переживает вылет приложения:
  // после перезапуска видно, на каком шаге iPhone его закрыл.
  const TRACE = 'kuhnya-scan-trace';
  let t0 = 0;
  function trace(step, reset) {
    try {
      if (reset) { t0 = performance.now(); localStorage.setItem(TRACE, '[]'); }
      const list = JSON.parse(localStorage.getItem(TRACE) || '[]');
      list.push([Math.round(performance.now() - t0), step]);
      localStorage.setItem(TRACE, JSON.stringify(list.slice(-40)));
    } catch (e) { /* без памяти — без журнала */ }
  }
  window.scanTrace = trace;

  // Загрузить движок и модели (один раз). onProgress(0…1).
  function load(onProgress) {
    if (ready) return ready;
    ready = (async () => {
      const p = (v) => onProgress && onProgress(v);
      // есть ли папка ocr/ рядом с приложением
      let local = false;
      try {
        const r = await fetch(LOCAL + 'dict.txt');
        const t = r.ok ? await r.text() : '';
        local = t.length > 300 && !/<html|<!doctype/i.test(t);
        try { localStorage.setItem('kuhnya-ocr-local', local ? '1' : '0'); } catch (e) { /* не страшно */ }
      } catch (e) {
        try { local = localStorage.getItem('kuhnya-ocr-local') === '1'; } catch (e2) { /* без памяти */ }
      }
      const base = local ? LOCAL : ORT_CDN;
      const url = (name) => (local ? LOCAL + name : REMOTE[name]);
      p(0.02);
      trace('движок: скрипт');
      if (!window.ort) await loadScript(base + 'ort.min.js');
      window.ort.env.wasm.wasmPaths = base;
      window.ort.env.wasm.numThreads = 1;
      window.ort.env.wasm.proxy = false;
      p(0.1);
      trace('движок: словарь');
      const dictTxt = new TextDecoder().decode(await fetchBuf(url('dict.txt')));
      dict = dictTxt.replace(/\r/g, '').split('\n');
      if (dict[dict.length - 1] === '') dict.pop();
      trace('движок: файл поиска текста');
      let detBuf = await fetchBuf(url('det.onnx'), (v) => p(0.1 + v * 0.2));
      trace('движок: файл чтения букв');
      let recBuf = await fetchBuf(url('rec.onnx'), (v) => p(0.3 + v * 0.5));
      // без «запаса» памяти: иначе движок держит память под самую большую картинку и не отдаёт её,
      // а iPhone при нехватке памяти перезапускает приложение. Упрощение модели («all») тоже ест память при запуске.
      const so = { executionProviders: ['wasm'], enableCpuMemArena: false, enableMemPattern: false, executionMode: 'sequential', graphOptimizationLevel: 'basic' };
      trace('движок: запуск поиска текста');
      det = await window.ort.InferenceSession.create(new Uint8Array(detBuf), so);
      detBuf = null;
      p(0.9);
      trace('движок: запуск чтения букв');
      rec = await window.ort.InferenceSession.create(new Uint8Array(recBuf), so);
      recBuf = null;
      trace('движок: готов');
      p(1);
    })().catch((e) => { ready = null; throw new Error('Не удалось загрузить распознавание (' + (e.message || e) + '). Нужен интернет при первом запуске'); });
    return ready;
  }

  // ---------- Детектор: где на картинке текст ----------
  async function detect(canvas) {
    const W = Math.ceil(canvas.width / 32) * 32, H = Math.ceil(canvas.height / 32) * 32;
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const tc = t.getContext('2d', { willReadFrequently: true });
    tc.fillStyle = '#fff'; tc.fillRect(0, 0, W, H); tc.drawImage(canvas, 0, 0);
    const d = tc.getImageData(0, 0, W, H).data, n = W * H, f = new Float32Array(3 * n);
    t.width = t.height = 0;
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) f[ch * n + i] = (d[i * 4 + ch] / 255 - mean[ch]) / std[ch];
    const out = await det.run({ [det.inputNames[0]]: new window.ort.Tensor('float32', f, [1, 3, H, W]) });
    const m = out[det.outputNames[0]].data;
    // связные области карты вероятностей → прямоугольники
    const T = 0.3, seen = new Uint8Array(n), boxes = [], stack = [], pix = [];
    for (let p0 = 0; p0 < n; p0++) {
      if (seen[p0] || m[p0] < T) continue;
      let x1 = W, x2 = 0, y1 = H, y2 = 0, cnt = 0, sum = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      seen[p0] = 1; stack.push(p0); pix.length = 0;
      while (stack.length) {
        const q = stack.pop(), x = q % W, y = (q - x) / W;
        cnt++; sum += m[q]; pix.push(q);
        sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
        if (x > 0 && !seen[q - 1] && m[q - 1] >= T) { seen[q - 1] = 1; stack.push(q - 1); }
        if (x < W - 1 && !seen[q + 1] && m[q + 1] >= T) { seen[q + 1] = 1; stack.push(q + 1); }
        if (y > 0 && !seen[q - W] && m[q - W] >= T) { seen[q - W] = 1; stack.push(q - W); }
        if (y < H - 1 && !seen[q + W] && m[q + W] >= T) { seen[q + W] = 1; stack.push(q + W); }
      }
      const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
      if (cnt < 12 || bh < 4 || sum / cnt < 0.5) continue;
      // детектор обводит текст «с усадкой» — расширяем обратно
      const pad = (bw * bh * 1.6) / (2 * (bw + bh));
      // наклон длинного куска текста — по главной оси его пятна (нужен, чтобы точно выровнять фото)
      let angle = null;
      if (bw > bh * 4 && cnt >= 60) {
        const cxx = sxx / cnt - (sx / cnt) ** 2, cyy = syy / cnt - (sy / cnt) ** 2, cxy = sxy / cnt - (sx / cnt) * (sy / cnt);
        angle = (0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180) / Math.PI;
      }
      // Длинная строка на изогнутом чеке идёт «волной»: её прямоугольник выходит в 2–3 раза выше букв и
      // захватывает соседние строки — распознаватель читает кашу. Для такой строки запоминаем её среднюю линию,
      // а перед чтением «распрямляем»: каждый столбик пикселей сдвигаем по высоте на эту линию.
      if (opts.wavy && bw > bh * 3 && bw >= 60) {
        const wv = wavy(pix, W, x1, bw, bh);
        if (wv) {
          const lp = (bw * wv.tk * 1.6) / (2 * (bw + wv.tk)), half = wv.tk / 2 + lp;
          let lo = Infinity, hi = -Infinity;
          for (const c of wv.cy) { if (c < lo) lo = c; if (c > hi) hi = c; }
          boxes.push({ x1: Math.max(0, x1 - lp), y1: Math.max(0, lo - half), x2: Math.min(canvas.width, x2 + 1 + lp), y2: Math.min(canvas.height, hi + half),
            angle, len: bw, curve: { x0: x1, cy: wv.cy, h: Math.round(half * 2) }, my: (lo + hi) / 2 });
          continue;
        }
      }
      boxes.push({ x1: Math.max(0, x1 - pad), y1: Math.max(0, y1 - pad), x2: Math.min(canvas.width, x2 + 1 + pad), y2: Math.min(canvas.height, y2 + 1 + pad), angle, len: bw });
    }
    return boxes;
  }
  // Средняя линия пятна строки по столбцам (сглаженная) и толщина букв — если строка «гуляет» по высоте
  // заметно сильнее толщины букв. null — строка ровная, распрямлять не нужно.
  function wavy(pix, W, x0, bw, bh) {
    const top = new Int32Array(bw).fill(1e9), bot = new Int32Array(bw).fill(-1), cnt = new Int32Array(bw);
    for (const q of pix) {
      const x = q % W, y = (q - x) / W, i = x - x0;
      cnt[i]++; if (y < top[i]) top[i] = y; if (y > bot[i]) bot[i] = y;
    }
    const th = [];
    for (let i = 0; i < bw; i++) if (cnt[i]) th.push(bot[i] - top[i] + 1);
    th.sort((a, b) => a - b);
    const tk = th[th.length >> 1] || 0;
    if (!tk || bh <= tk * 1.6 + 2) return null;
    // середина по столбцам; пустые столбцы — по соседям
    const mid = new Float32Array(bw);
    let last = -1;
    for (let i = 0; i < bw; i++) {
      if (!cnt[i]) continue;
      mid[i] = (top[i] + bot[i]) / 2;
      if (last >= 0 && i - last > 1) for (let j = last + 1; j < i; j++) mid[j] = mid[last] + ((mid[i] - mid[last]) * (j - last)) / (i - last);
      last = i;
    }
    // сглаживание окном в ~3 высоты букв: хвосты «Ц», «Д», «Щ» и точки не должны дёргать линию
    const r = Math.max(2, Math.round(tk * 1.5)), cy = new Float32Array(bw), pre = new Float64Array(bw + 1);
    for (let i = 0; i < bw; i++) pre[i + 1] = pre[i] + mid[i];
    for (let i = 0; i < bw; i++) { const a = Math.max(0, i - r), b = Math.min(bw, i + r + 1); cy[i] = (pre[b] - pre[a]) / (b - a); }
    return { cy, tk };
  }
  // распрямить «волнистую» строку: столбик x берём из высоты cy(x) ± h/2
  function straighten(canvas, b) {
    const { x0, cy, h } = b.curve, w = Math.max(1, Math.round(b.x2 - b.x1));
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const tc = t.getContext('2d');
    tc.fillStyle = '#fff'; tc.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i++) {
      const x = Math.round(b.x1) + i, k = Math.min(cy.length - 1, Math.max(0, x - x0));
      if (x >= canvas.width) break;
      // источник не должен выходить за край картинки (Safari тогда не рисует ничего)
      const y0 = Math.round(cy[k] - h / 2), sy = Math.max(0, y0), sh = Math.min(h - (sy - y0), canvas.height - sy);
      if (sh > 0) tc.drawImage(canvas, x, sy, 1, sh, i, sy - y0, 1, sh);
    }
    return t;
  }
  // общий наклон строк в градусах (по часовой — плюс): медиана по длинным кускам текста
  function skewOf(boxes) {
    const a = boxes.filter((b) => b.angle !== null).sort((p, q) => p.angle - q.angle);
    if (a.length < 5) return 0;
    const total = a.reduce((s, b) => s + b.len, 0);
    let acc = 0;
    for (const b of a) { acc += b.len; if (acc >= total / 2) return Math.round(b.angle * 10) / 10; }
    return 0;
  }

  // ---------- Распознаватель: прочитать один кусок ----------
  async function readBox(canvas, box) {
    let b = box;
    if (box.curve) { canvas = straighten(canvas, box); b = { x1: 0, y1: 0, x2: canvas.width, y2: canvas.height }; }
    const sw = b.x2 - b.x1, sh = b.y2 - b.y1, H = 48, W = Math.min(2400, Math.max(16, Math.round((sw * H) / sh)));
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const tc = t.getContext('2d', { willReadFrequently: true });
    tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.fillStyle = '#fff'; tc.fillRect(0, 0, W, H);
    tc.drawImage(canvas, b.x1, b.y1, sw, sh, 0, 0, W, H);
    const d = tc.getImageData(0, 0, W, H).data, n = W * H, f = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) f[ch * n + i] = (d[i * 4 + (2 - ch)] / 255 - 0.5) / 0.5;
    const out = await rec.run({ [rec.inputNames[0]]: new window.ort.Tensor('float32', f, [1, 3, H, W]) });
    const o = out[rec.outputNames[0]], steps = o.dims[1], C = o.dims[2], data = o.data;
    let text = '', prev = 0, conf = 0, k = 0;
    for (let s = 0; s < steps; s++) {
      let bi = 0, bv = -1;
      for (let c = 0, base = s * C; c < C; c++) { const v = data[base + c]; if (v > bv) { bv = v; bi = c; } }
      if (bi !== 0 && bi !== prev) { text += bi - 1 < dict.length ? dict[bi - 1] : ' '; conf += bv; k++; }
      prev = bi;
    }
    return { text: text.trim(), conf: k ? conf / k : 0 };
  }

  // Прочитать картинку целиком → строки сверху вниз, в каждой куски слева направо.
  // Возвращает { lines: [{ y, parts: [{ x1, x2, text, conf }] }], medH, conf }.
  const medianH = (boxes) => { const hs = boxes.map((b) => (b.curve ? b.curve.h : b.y2 - b.y1)).sort((a, b) => a - b); return hs.length ? hs[hs.length >> 1] : 0; };
  // только найти текст (быстро): нужно, чтобы подобрать масштаб до чтения
  // Длинный чек ищем полосами: детектору на всю картинку разом нужно несколько сотен МБ памяти,
  // и iPhone в такой момент перезапускает приложение. Полосы перекрываются, чтобы строка на стыке не потерялась:
  // каждая строка достаётся той полосе, где лежит её середина.
  async function detectTiled(canvas) {
    const STRIP = [1280, 768, 640, 512][Math.min(3, +opts.lowMem || 0)], OV = 192;
    trace(`поиск текста: ${canvas.width}×${canvas.height}, полосы по ${STRIP}`);
    if (canvas.height <= STRIP + OV / 2) return detect(canvas);
    const all = [];
    for (let y = 0; y < canvas.height; y += STRIP - OV) {
      trace(`поиск текста: полоса с ${y}`);
      const h = Math.min(STRIP, canvas.height - y), last = y + h >= canvas.height;
      const t = document.createElement('canvas'); t.width = canvas.width; t.height = h;
      t.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      const lo = y === 0 ? -Infinity : y + OV / 2, hi = last ? Infinity : y + h - OV / 2;
      for (const b of await detect(t)) {
        const box = { ...b, y1: b.y1 + y, y2: b.y2 + y };
        if (b.curve) { box.curve = { ...b.curve, cy: b.curve.cy.map((v) => v + y) }; box.my = b.my + y; }
        const c = box.my != null ? box.my : (box.y1 + box.y2) / 2;
        if (c >= lo && c < hi) all.push(box);
      }
      t.width = t.height = 0; // Safari освобождает память холста только так
      if (last) break;
    }
    return all;
  }
  async function find(canvas) {
    await load();
    const boxes = (await detectTiled(canvas)).filter((b) => b.x2 - b.x1 >= 6 && b.y2 - b.y1 >= 6);
    return { boxes, medH: medianH(boxes), skew: skewOf(boxes) };
  }
  async function read(canvas, onProgress, found) {
    await load();
    const boxes = (found || (await find(canvas))).boxes;
    if (!boxes.length) return { lines: [], medH: 0, conf: 0 };
    const medH = medianH(boxes);
    let done = 0;
    trace(`чтение строк: ${boxes.length} кусков`);
    for (const b of boxes) {
      const r = await readBox(canvas, b);
      b.text = r.text; b.conf = r.conf;
      if (onProgress && ++done % 8 === 0) onProgress(done / boxes.length);
      if (done % 40 === 0) trace(`чтение строк: ${done} из ${boxes.length}`);
    }
    trace('чтение строк: готово');
    const good = boxes.filter((b) => b.text);
    // в строку собираем куски, у которых середины по высоте близки
    const mid = (b) => (b.my != null ? b.my : (b.y1 + b.y2) / 2);
    good.sort((a, b) => mid(a) - mid(b));
    const lines = [];
    for (const b of good) {
      const cy = mid(b), L = lines[lines.length - 1];
      if (L && Math.abs(L.y - cy) < medH * 0.45) { L.parts.push(b); L.y = (L.y * (L.parts.length - 1) + cy) / L.parts.length; }
      else lines.push({ y: cy, parts: [b] });
    }
    lines.forEach((L) => L.parts.sort((a, b) => a.x1 - b.x1));
    const conf = good.reduce((s, b) => s + b.conf, 0) / Math.max(1, good.length);
    return { lines, medH, conf, width: canvas.width, height: canvas.height };
  }

  window.OCR = { load, read, find, opts, trace };
})();
