// Рецепт из файла: txt / md / pdf / docx / html / фото страницы.
// Текст достаётся из файла, затем разбирается на название, ингредиенты, шаги, порции и время.
// Библиотеки для PDF и Word подгружаются только когда нужны.
(function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const PDFJS = CDN + 'pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDF_WORKER = CDN + 'pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const MAMMOTH = CDN + 'mammoth@1.8.0/mammoth.browser.min.js';

  const ext = (f) => (String(f.name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const baseName = (f) => String(f.name || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

  // ---------- Текст из файла ----------
  async function readText(file) {
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    // старые файлы из Windows — в кодировке 1251
    if ((t.match(/�/g) || []).length > 3) t = new TextDecoder('windows-1251').decode(buf);
    return t.replace(/^﻿/, '');
  }
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div|tr)>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
    return (doc.body ? doc.body.textContent : '') || '';
  }
  async function pdfText(file, onProgress) {
    await Receipt.loadScript(PDFJS);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = Math.min(pdf.numPages, 10);
    let text = '';
    for (let n = 1; n <= pages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      // собираем строки по координате y
      let lastY = null, line = '';
      for (const it of content.items) {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) { text += line.trim() + '\n'; line = ''; }
        line += it.str + (it.hasEOL ? '\n' : ' ');
        lastY = y;
      }
      text += line.trim() + '\n\n';
    }
    // в PDF нет текста (скан) — распознаём картинки страниц
    if (text.replace(/\s/g, '').length < 40) {
      const canvases = [];
      for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        // intent 'print' — рисуем без привязки к кадрам анимации: иначе в фоне отрисовка замирает
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;
        canvases.push(c);
      }
      text = await Receipt.ocrText(canvases, onProgress);
    }
    return text;
  }
  async function docxText(file) {
    await Receipt.loadScript(MAMMOTH);
    const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }

  async function extractText(file, onProgress) {
    const e = ext(file), type = file.type || '';
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp'].includes(e)) return Receipt.ocrText([file], onProgress);
    if (e === 'pdf' || type === 'application/pdf') return pdfText(file, onProgress);
    if (e === 'docx') return docxText(file);
    if (e === 'doc') throw new Error('Старый формат .doc не читается. Откройте файл в Word и сохраните как .docx или .txt');
    if (e === 'rtf') throw new Error('Формат .rtf не читается. Сохраните файл как .docx или .txt');
    if (e === 'html' || e === 'htm' || type === 'text/html') return htmlToText(await readText(file));
    return readText(file); // txt, md и всё текстовое
  }

  // ---------- Разбор текста рецепта ----------
  const ING_H = /^[#*\s]*(ингредиенты|ингредиенты на \d+.*|продукты|состав|нам понадобится|вам понадобится|понадобится|что нужно|что понадобится|список продуктов|ingredients)\s*:?\s*$/i;
  const STEP_H = /^[#*\s]*(приготовление|способ приготовления|как приготовить|как готовить|пошаговый рецепт|рецепт приготовления|инструкция|шаги|порядок приготовления|готовим|steps|directions|instructions|method|preparation)\s*:?\s*$/i;
  // «4 порции» и «Порций: 4», «Количество порций — 6», «На 4 персоны»
  const SERV = /(?:(\d+)\s*(?:порци|персон|человек|чел\.|servings))|(?:(?:порци[йияюе]?|количество порций|персон|servings|serves)\s*[:—–-]?\s*(\d+))/i;
  const TIME = /(?:время(?: приготовления)?|готовится|на всё|общее время)\s*[:—–-]?\s*([\d\s]+(?:ч[а-яё.]*|мин[а-яё.]*)(?:\s*\d+\s*мин[а-яё.]*)?)/i;
  const BULLET = /^\s*(?:[•·●▪◦*–—-]|\d{1,2}[.)]|шаг\s*\d+[.:)]?)\s*/i;

  const looksIngredient = (line) => {
    if (line.length > 90) return false;
    const p = U.parseIngredientLine(line);
    if (p && (p.qty || p.unit)) return true;
    if (/\s[—–-]\s/.test(line) && line.length < 70) return true; // «Соль — по вкусу»
    return line.length <= 45 && !/[.!?]$/.test(line) && line.split(/\s+/).length <= 6;
  };
  const looksStep = (line) => line.length > 60 || /[.!?]$/.test(line) && line.split(/\s+/).length > 5;

  function parseRecipeText(text, fallbackTitle) {
    const raw = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
    // строки из одних хэштегов (#сырники #завтрак) — не рецепт; хэштеги в конце строк тоже убираем
    const lines = raw.filter((l) => l && !/^(#[\wа-яё_-]+[\s,.]*)+$/i.test(l)).map((l) => l.replace(/(\s+#[\wа-яё_-]+)+\s*$/i, ''));
    let title = '', servings = '', time = '';
    const ingredients = [], steps = [];
    let mode = null, titleIdx = -1;

    // название: первая короткая строка с буквами, не служебная
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const l = lines[i].replace(/^#+\s*/, '');
      if (ING_H.test(l) || STEP_H.test(l)) break;
      const isTitle = /[а-яёa-z]{3,}/i.test(l) && l.length <= 80 && !SERV.test(l) && !TIME.test(l) && !U.parseIngredientLine(l).qty;
      if (isTitle) { title = l.replace(/[.:]$/, ''); titleIdx = i; break; }
    }
    const titleFromText = !!title;
    if (!title) title = fallbackTitle || 'Рецепт';

    lines.forEach((line0, i) => {
      if (i === titleIdx) return;
      const line = line0.replace(/^#+\s*/, '');
      const sv = line.match(SERV);
      if (sv && !servings && line.length < 60) {
        const n = +(sv[1] || sv[2]);
        servings = n + ' ' + U.plural(n, 'порция', 'порции', 'порций');
        if (line.length < 30) return;
      }
      const tm = line.match(TIME); if (tm && !time && line.length < 60) { time = tm[1].trim(); return; }
      if (ING_H.test(line)) { mode = 'ing'; return; }
      if (STEP_H.test(line)) { mode = 'steps'; return; }
      if (/^[^:]{2,40}:$/.test(line) && mode === 'ing') return; // «Для соуса:»
      const clean = line.replace(BULLET, '').trim();
      if (!clean) return;

      if (mode === 'ing') {
        if (looksStep(clean) && !U.parseIngredientLine(clean).qty) { mode = 'steps'; steps.push(clean); } else ingredients.push(clean);
      } else if (mode === 'steps') {
        const prev = steps[steps.length - 1];
        // перенос строки внутри шага: предыдущий не закончился точкой, текущий с маленькой буквы
        if (prev && !/[.!?:]$/.test(prev) && /^[а-яёa-z]/.test(clean) && !BULLET.test(line)) steps[steps.length - 1] = prev + ' ' + clean;
        else steps.push(clean);
      } else if (looksIngredient(clean) && !looksStep(clean)) ingredients.push(clean);
      else steps.push(clean);
    });
    return { title, titleFromText, servings, time, ingredients, steps };
  }

  async function fromFile(file, onProgress) {
    const text = await extractText(file, onProgress);
    if (!text || text.replace(/\s/g, '').length < 10) throw new Error(`В файле «${file.name}» не нашлось текста`);
    return { ...parseRecipeText(text, baseName(file)), source: file.name, text };
  }

  window.RecipeImport = { fromFile, parseRecipeText, extractText };
})();
