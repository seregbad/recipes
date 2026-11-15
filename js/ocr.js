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
        if (onPart && total) onPart(got / total);
      }
      const buf = new Uint8Array(got);
      let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
      if (cache) cache.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
      return buf.buffer;
    } finally { clearTimeout(timer); }
  }

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
      if (!window.ort) await loadScript(base + 'ort.min.js');
      window.ort.env.wasm.wasmPaths = base;
      window.ort.env.wasm.numThreads = 1;
      p(0.1);
      const dictTxt = new TextDecoder().decode(await fetchBuf(url('dict.txt')));
      dict = dictTxt.replace(/\r/g, '').split('\n');
      if (dict[dict.length - 1] === '') dict.pop();
      const detBuf = await fetchBuf(url('det.onnx'), (v) => p(0.1 + v * 0.2));
      const recBuf = await fetchBuf(url('rec.onnx'), (v) => p(0.3 + v * 0.5));
      det = await window.ort.InferenceSession.create(detBuf, { executionProviders: ['wasm'] });
      p(0.9);
      rec = await window.ort.InferenceSession.create(recBuf, { executionProviders: ['wasm'] });
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
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) f[ch * n + i] = (d[i * 4 + ch] / 255 - mean[ch]) / std[ch];
    const out = await det.run({ [det.inputNames[0]]: new window.ort.Tensor('float32', f, [1, 3, H, W]) });
    const m = out[det.outputNames[0]].data;
    // связные области карты вероятностей → прямоугольники
    const T = 0.3, seen = new Uint8Array(n), boxes = [], stack = [];
    for (let p0 = 0; p0 < n; p0++) {
      if (seen[p0] || m[p0] < T) continue;
      let x1 = W, x2 = 0, y1 = H, y2 = 0, cnt = 0, sum = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      seen[p0] = 1; stack.push(p0);
      while (stack.length) {
        const q = stack.pop(), x = q % W, y = (q - x) / W;
        cnt++; sum += m[q];
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
      boxes.push({ x1: Math.max(0, x1 - pad), y1: Math.max(0, y1 - pad), x2: Math.min(canvas.width, x2 + 1 + pad), y2: Math.min(canvas.height, y2 + 1 + pad), angle, len: bw });
    }
    return boxes;
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
  async function readBox(canvas, b) {
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
  const medianH = (boxes) => { const hs = boxes.map((b) => b.y2 - b.y1).sort((a, b) => a - b); return hs.length ? hs[hs.length >> 1] : 0; };
  // только найти текст (быстро): нужно, чтобы подобрать масштаб до чтения
  async function find(canvas) {
    await load();
    const boxes = (await detect(canvas)).filter((b) => b.x2 - b.x1 >= 6 && b.y2 - b.y1 >= 6);
    return { boxes, medH: medianH(boxes), skew: skewOf(boxes) };
  }
  async function read(canvas, onProgress, found) {
    await load();
    const boxes = (found || (await find(canvas))).boxes;
    if (!boxes.length) return { lines: [], medH: 0, conf: 0 };
    const medH = medianH(boxes);
    let done = 0;
    for (const b of boxes) {
      const r = await readBox(canvas, b);
      b.text = r.text; b.conf = r.conf;
      if (onProgress && ++done % 8 === 0) onProgress(done / boxes.length);
    }
    const good = boxes.filter((b) => b.text);
    // в строку собираем куски, у которых середины по высоте близки
    good.sort((a, b) => (a.y1 + a.y2) - (b.y1 + b.y2));
    const lines = [];
    for (const b of good) {
      const cy = (b.y1 + b.y2) / 2, L = lines[lines.length - 1];
      if (L && Math.abs(L.y - cy) < medH * 0.45) { L.parts.push(b); L.y = (L.y * (L.parts.length - 1) + cy) / L.parts.length; }
      else lines.push({ y: cy, parts: [b] });
    }
    lines.forEach((L) => L.parts.sort((a, b) => a.x1 - b.x1));
    const conf = good.reduce((s, b) => s + b.conf, 0) / Math.max(1, good.length);
    return { lines, medH, conf, width: canvas.width, height: canvas.height };
  }

  window.OCR = { load, read, find };
})();
