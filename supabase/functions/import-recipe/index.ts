// @ts-nocheck — разборщик ниже общий с браузерной версией (обычный JavaScript)
// deno-lint-ignore-file
// Supabase Edge Function «import-recipe»: получает ссылку на рецепт и возвращает
// название, фото, порции, время, ингредиенты и шаги.
// Разбор: разметка рецепта (JSON-LD), микроразметка, заголовки «Ингредиенты»/«Приготовление»,
// блоки с говорящими классами, абзацы с действиями — с чисткой рекламы и мусора.
// Вызывать могут только вошедшие пользователи из таблицы members.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseHTML } from 'npm:linkedom@0.18.5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: isMember } = await sb.rpc('is_member');
    if (!isMember) return json({ error: 'Нет доступа' }, 403);

    const { url } = await req.json();
    const target = checkUrl(url);
    if (!target) return json({ error: 'Некорректная ссылка' }, 400);

    const res = await fetch(target, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return json({ error: `Сайт ответил ошибкой ${res.status}` }, 502);
    const html = (await decodeBody(res)).slice(0, 4_000_000);
    const { document } = parseHTML(html);
    // deno-lint-ignore no-explicit-any
    const r: any = extractRecipe(document);
    // на странице несколько рецептов или это раздел со ссылками — отдаём список, чтобы выбрать в приложении
    let many: any = { recipes: [], links: [] };
    try { many = extractMany(document, res.url || target.toString()); } catch (_) { /* список не нужен для одиночного рецепта */ }
    return json({ ...r, source: target.toString(), many: many.recipes, links: many.links });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ---------- Безопасность: только внешние http(s)-адреса ----------
function checkUrl(raw: unknown): URL | null {
  try {
    const u = new URL(String(raw));
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':') || h.startsWith('[')) return null;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
    return u;
  } catch {
    return null;
  }
}

// Кодировка страницы (Поварёнок, Russianfood и другие старые сайты — в windows-1251)
async function decodeBody(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  let charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
  if (!charset) {
    const head = new TextDecoder('ascii').decode(buf.slice(0, 4096));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

// ---------- Разбор страницы (копия из js/recipe-extract.js, обновляется tools\sync-extractor.ps1) ----------
// >>> extractRecipe
function extractRecipe(doc) {
  const HEAD_ING = /^(ингредиенты|ингредиенты (для|на) .{1,40}|состав|продукты|список продуктов|вам понадобится|нам понадобится|понадобится|что понадобится|что нужно|для приготовления понадобится|ingredients)$/i;
  const HEAD_STEP = /^(приготовление|способ приготовления|как приготовить|как готовить|пошаговый рецепт|пошаговое приготовление|рецепт приготовления|порядок приготовления|процесс приготовления|инструкция|инструкция приготовления|шаги|готовим|instructions|directions|method|preparation)$/i;
  const JUNK = /реклам|подпиш|подписат|поделит|комментар|оцените|рейтинг|распечат|сохранить рецепт|в избранное|читайте также|смотрите также|похожие рецепты|источник:|фото:|автор рецепта|cookie|войти|регистрац|скачайте|промокод|telegram|телеграм|вконтакте|youtube|instagram|https?:\/\//i;
  const NUTR = /ккал|калорийн|белки|жиры|углеводы|пищевая ценность|энергетическая ценность/i;
  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|SVG|BUTTON|IFRAME|FORM|SELECT|TEMPLATE)$/;
  const NOISE = 'header, footer, nav, aside, [class*="comment" i], [class*="related" i], [class*="similar" i], [class*="advert" i], [class*="banner" i], [class*="social" i], [class*="share" i], [id*="comment" i]';

  const up = (el) => String(el.tagName || '').toUpperCase();
  // текст элемента с пробелами между вложенными элементами («Творог»+«500 г» → «Творог 500 г»)
  const textOf = (n) => {
    let s = '';
    for (const c of n.childNodes || []) {
      if (c.nodeType === 3) s += c.nodeValue;
      else if (c.nodeType === 1) {
        const t = up(c);
        if (SKIP_TAGS.test(t)) continue;
        if (t === 'BR') { s += '\n'; continue; }
        const block = /^(P|DIV|LI|TR|H[1-6]|UL|OL|TABLE|SECTION|ARTICLE)$/.test(t);
        s += (block ? '\n' : ' ') + textOf(c) + (block ? '\n' : ' ');
      }
    }
    return s;
  };
  // пробелы, вставленные между частями строки, не должны оставаться перед запятыми и скобками
  const one = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.;:!?)»])/g, '$1').replace(/([(«])\s+/g, '$1').trim();
  const ownText = (el) => one(textOf(el)).replace(/[:.]$/, '').trim();
  const inNoise = (el) => { try { return !!el.closest(NOISE); } catch (e) { return false; } };

  // строки из блока: пункты списка, строки таблицы, абзацы, иначе — по переводам строк
  function linesOf(el) {
    const lis = [...el.querySelectorAll('li')].filter((li) => !li.querySelector('li'));
    if (lis.length >= 2) return lis.map((x) => one(textOf(x)));
    const trs = [...el.querySelectorAll('tr')];
    if (trs.length >= 2) return trs.map((x) => one(textOf(x)));
    const ps = [...el.querySelectorAll('p')];
    if (ps.length >= 2) return ps.map((x) => one(textOf(x)));
    return textOf(el).split(/\n+/).map(one);
  }
  const hasQty = (s) => /\d|по вкусу|щепотк|горст|пучок|зубчик/i.test(s);
  function cleanIng(lines) {
    const seen = new Set(), out = [];
    for (let s of lines) {
      s = one(s).replace(/^[•·●▪◦*–—-]\s*/, '').replace(/[;,.]+$/, '').replace(/(\d)([.,])\s+(\d)/g, '$1$2$3').trim(); // «1, 5 кг» → «1,5 кг»
      const n = s.toLowerCase();
      if (!s || s.length > 120 || s.length < 2 || JUNK.test(s) || NUTR.test(s)) continue;
      if (/:$/.test(s) && s.length < 50) continue;                 // «Для теста:» — заголовок раздела
      if (HEAD_ING.test(s.replace(/:$/, '')) || HEAD_STEP.test(s.replace(/:$/, ''))) continue;
      if (/^(время|порци|сложность|кухня|категория)/i.test(s)) continue;
      if (seen.has(n)) continue;
      seen.add(n); out.push(s);
    }
    return out;
  }
  function cleanSteps(lines, ing) {
    const seen = new Set(ing.map((x) => x.toLowerCase())), out = [];
    for (let s of lines) {
      s = one(s).replace(/^(шаг\s*\d+\s*(из\s*\d+)?|\d+\s*шаг|\d{1,2}[.)])\s*[.:)\-–—]?\s*/i, '').replace(/^[•·●▪◦*–—-]\s*/, '')
        .replace(/^(как приготовить|способ приготовления|приготовление)[^:.!?]{0,50}:\s*/i, '');
      const n = s.toLowerCase();
      if (s.length < 12 || JUNK.test(s) || NUTR.test(s) || /^(приятного аппетита|готово)[!.]*$/i.test(s)) continue;
      if (HEAD_STEP.test(s.replace(/:$/, '')) || seen.has(n)) continue;
      seen.add(n); out.push(s);
    }
    return out;
  }

  const res = { title: '', image: '', servings: '', time: '', category: '', ingredients: [], steps: [], via: '' };
  const meta = (p) => { const m = doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`); return m ? one(m.getAttribute('content')) : ''; };
  const isoTime = (s) => {
    const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(s || ''));
    if (!m || !(m[1] || m[2] || m[3])) return /^P/i.test(String(s || '')) ? '' : one(s);
    const h = Number(m[1] || 0) * 24 + Number(m[2] || 0);
    return [h ? `${h} ч` : '', m[3] && Number(m[3]) ? `${Number(m[3])} мин` : ''].filter(Boolean).join(' ');
  };
  const strip = (html) => one(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)));
  const str = (x) => (x == null ? '' : typeof x === 'string' || typeof x === 'number' ? String(x) : x.text || x.name || x['@value'] || '');
  const imageOf = (x) => (!x ? '' : typeof x === 'string' ? x : Array.isArray(x) ? imageOf(x[0]) : x.url || x.contentUrl || '');
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

  // ---------- 1. JSON-LD ----------
  const findRecipe = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
    const t = node['@type'];
    if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
    return findRecipe(node['@graph']) || findRecipe(node.mainEntity) || findRecipe(node.mainEntityOfPage);
  };
  const instr = (x) => {
    if (!x) return [];
    if (typeof x === 'string') return String(x).replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').split(/\n+/).map(strip);
    if (Array.isArray(x)) return x.flatMap(instr);
    if (x.itemListElement) return instr(x.itemListElement);
    return [strip(str(x))];
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data = null;
    const raw = s.textContent || '';
    try { data = JSON.parse(raw); } catch (e) { try { data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1')); } catch (e2) { continue; } }
    const r = findRecipe(data);
    if (!r) continue;
    res.title = strip(str(r.name));
    res.image = imageOf(r.image);
    res.servings = one(str(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield));
    res.time = isoTime(str(r.totalTime)) || [isoTime(str(r.prepTime)), isoTime(str(r.cookTime))].filter(Boolean).join(' + ');
    res.category = one(str(Array.isArray(r.recipeCategory) ? r.recipeCategory[0] : r.recipeCategory));
    let ing = arr(r.recipeIngredient || r.ingredients).map((x) => strip(str(x)));
    if (ing.length === 1 && /\n|;/.test(ing[0])) ing = ing[0].split(/\n|;/);
    res.ingredients = cleanIng(ing);
    res.steps = cleanSteps(instr(r.recipeInstructions), res.ingredients);
    res.via = 'разметка рецепта';
    break;
  }

  // ---------- 2. Microdata ----------
  const scope = doc.querySelector('[itemtype*="schema.org/Recipe" i]') || doc;
  const ip = (name) => [...scope.querySelectorAll(`[itemprop="${name}"]`)];
  const ipVal = (el) => (el ? one(el.getAttribute('content') || el.getAttribute('datetime') || textOf(el)) : '');
  if (res.ingredients.length < 2) {
    const els = [...ip('recipeIngredient'), ...ip('ingredients')];
    const lines = els.flatMap((el) => ([...el.querySelectorAll('li')].length >= 2 ? linesOf(el) : [one(textOf(el))]));
    const ing = cleanIng(lines);
    if (ing.length >= 2) { res.ingredients = ing; res.via = res.via || 'микроразметка'; }
  }
  if (res.steps.length < 2) {
    const els = ip('recipeInstructions');
    const lines = els.flatMap((el) => {
      const inner = [...el.querySelectorAll('[itemprop="text"]')];
      if (inner.length) return inner.map((x) => one(textOf(x)));
      const parts = linesOf(el);
      return parts.length >= 2 ? parts : [one(textOf(el))];
    });
    const st = cleanSteps(lines, res.ingredients);
    if (st.length >= 1 && st.join('').length > 40) { res.steps = st; res.via = res.via || 'микроразметка'; }
  }
  if (!res.title) { const n = scope.querySelector('[itemprop="name"]'); if (n && scope !== doc) res.title = ipVal(n); }
  if (!res.servings) res.servings = ipVal(ip('recipeYield')[0]);
  if (!res.time) res.time = isoTime(ipVal(ip('totalTime')[0]) || ipVal(ip('cookTime')[0]));
  if (!res.image) { const im = ip('image')[0]; if (im) res.image = im.getAttribute('src') || im.getAttribute('content') || im.getAttribute('href') || ''; }

  // ---------- 3. Заголовки «Ингредиенты» / «Приготовление» ----------
  const isHeadEl = (el, re) => {
    const t = ownText(el);
    if (!t || t.length > 60 || !re.test(t)) return false;
    return ![...el.children].some((c) => ownText(c).length > 0 && ownText(c) !== t && re.test(ownText(c))); // самый глубокий
  };
  const anyHead = (el) => {
    const t = ownText(el);
    if (!t || t.length > 60) return false;
    if (HEAD_ING.test(t) || HEAD_STEP.test(t)) return true;
    return /^H[1-4]$/.test(up(el));
  };
  // содержимое после заголовка: соседние блоки до следующего заголовка
  function after(head, wantList) {
    let cur = head;
    while (cur && !cur.nextElementSibling && cur.parentElement) cur = cur.parentElement;
    let s = cur && cur.nextElementSibling;
    const lines = [];
    let gotList = false;
    for (let i = 0; s && i < 25; i++, s = s.nextElementSibling) {
      if (anyHead(s) || [...s.querySelectorAll('h1,h2,h3,h4,p,strong,b,div')].slice(0, 3).some((x) => x.textContent.trim().length && anyHead(x) && s.textContent.trim().indexOf(x.textContent.trim()) < 3)) break;
      const isList = s.querySelector('li, tr') || /^(UL|OL|TABLE)$/.test(up(s));
      if (gotList && !isList) break;          // после списка пошли советы — стоп
      if (isList) gotList = true;
      lines.push(...linesOf(s));
      if (!wantList && !isList && lines.length > 15) break;
    }
    return lines;
  }
  const heads = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,strong,b,span,div,dt,th,td')].filter((el) => !inNoise(el));
  if (res.ingredients.length < 2) {
    for (const h of heads.filter((el) => isHeadEl(el, HEAD_ING))) {
      const ing = cleanIng(after(h, true));
      if (ing.length >= 2) { res.ingredients = ing; res.via = res.via || 'страница'; break; }
    }
  }
  if (res.steps.length < 1) {
    for (const h of heads.filter((el) => isHeadEl(el, HEAD_STEP))) {
      const st = cleanSteps(after(h, false), res.ingredients);
      if (st.length >= 1) { res.steps = st; res.via = res.via || 'страница'; break; }
    }
  }

  // ---------- 4. Блоки с говорящими классами ----------
  const byClass = (sel) => [...doc.querySelectorAll(sel)].filter((el) => !inNoise(el));
  if (res.ingredients.length < 2) {
    let best = [], bestScore = 0;
    for (const el of byClass('[class*="ingr" i], [id*="ingr" i], [class*="ingredient" i], [class*="sostav" i]')) {
      const ing = cleanIng(linesOf(el));
      const score = ing.filter(hasQty).length * 2 + ing.length;
      if (ing.length >= 2 && ing.length <= 60 && score > bestScore) { best = ing; bestScore = score; }
    }
    if (best.length) { res.ingredients = best; res.via = res.via || 'страница'; }
  }
  if (res.steps.length < 1) {
    const cands = byClass('[class*="step" i], [class*="instruction" i], [class*="direction" i], [class*="howcook" i], [class*="method" i], [class*="preparation" i], [id*="step" i], [id*="instruction" i]');
    // много одинаковых блоков (по шагу в каждом) — берём их по порядку
    const groups = new Map();
    for (const el of cands) {
      const key = up(el) + '.' + String(el.getAttribute('class') || el.getAttribute('id') || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    }
    let best = [];
    for (const [, els] of groups) {
      const top = els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
      const lines = top.length >= 2 ? top.map((e) => one(textOf(e))) : top.flatMap(linesOf);
      const st = cleanSteps(lines, res.ingredients);
      if (st.join(' ').length > best.join(' ').length && st.length <= 40) best = st;
    }
    if (best.length) { res.steps = best; res.via = res.via || 'страница'; }
  }

  // ---------- 5. Абзацы с действиями («смешать», «обжарить»…) — шаги без заголовка и классов ----------
  const VERB = /(смеша|смешив|добав|выложи|выкладыв|обжар|перемеша|сформир|разогре|выпек|запек|отвар|свар|варить|нареж|нарез|очист|натр|натир|взбе|взбив|залей|залить|залива|посоли|туши|потуш|остуд|подава|влей|влить|вливаем|всып|положи|замес|раскат|измельч|поставь|поставить|духовк|сковород)/i;
  if (res.steps.length < 1) {
    let best = [];
    // спускаемся по «обёрткам» с единственным потомком: блок → блок → абзац
    const leaf = (c) => { let k = c; for (let i = 0; i < 4 && k.children.length === 1; i++) k = k.children[0]; return /^(P|LI|DIV|SPAN)$/.test(up(k)) && k.children.length <= 3 ? k : null; };
    for (const box of [...doc.querySelectorAll('main, div, section, article, ol, ul')].filter((el) => !inNoise(el))) {
      const kids = [...box.children].map(leaf).filter(Boolean);
      if (kids.length < 2) continue;
      const acts = kids.map((k) => one(textOf(k))).filter((t) => t.length >= 15 && t.length <= 700 && VERB.test(t));
      if (acts.length >= 2 && acts.length > best.length) best = acts;
    }
    let st = cleanSteps(best, res.ingredients);
    // всё приготовление одним абзацем — берём самый длинный абзац с действиями
    if (st.length < 2) {
      const verbsIn = (t) => (t.match(new RegExp(VERB.source, 'gi')) || []).length;
      const para = [...doc.querySelectorAll('p')].filter((p) => !inNoise(p)).map((p) => one(textOf(p)))
        .filter((t) => t.length > 150 && verbsIn(t) >= 3 && !JUNK.test(t)).sort((a, b) => b.length - a.length)[0];
      if (para) st = [para];
    }
    if (st.length >= 1) { res.steps = st; res.via = res.via || 'страница'; }
  }
  // одно длинное описание — режем на шаги по предложениям
  if (res.steps.length === 1 && res.steps[0].length > 350) {
    res.steps = res.steps[0].split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/).map(one).filter((s) => s.length > 3);
  }

  // ---------- порции и время из текста страницы («Порций: 4», «Время приготовления: 15 мин.») ----------
  if (!res.servings || !res.time) {
    const body = one(textOf(doc.body || doc));
    if (!res.servings) {
      const m = body.match(/(?:количество порций|порци[йия]|персон)\s*[:—–-]?\s*(\d{1,2})(?!\d)/i) || body.match(/(?<!\d)(\d{1,2})\s*(?:порци|персон)/i);
      if (m) res.servings = m[1];
    }
    if (!res.time) {
      const m = body.match(/время приготовления\s*[:—–-]?\s*((?:\d+\s*(?:ч|час)[а-я.]*\s*)?(?:\d+\s*мин[а-я.]*)?)/i);
      if (m && /\d/.test(m[1])) res.time = one(m[1]).replace(/\.$/, '');
    }
  }

  // ---------- название, фото ----------
  const h1 = doc.querySelector('h1');
  res.title = res.title || meta('og:title') || (h1 ? one(textOf(h1)) : '') || one(doc.title || '');
  res.title = res.title
    .replace(/^рецепт[:\s]+/i, '')
    .replace(/\s*[:|—–-]\s*(пошаговый\s+)?рецепт(\s+с\s+фото.*|\s+приготовления.*)?$/i, '')
    .replace(/\s+(на|—|-|\|)\s+[\w.-]+\.(ru|com|net|org|рф)\s*$/i, '')
    .replace(/\s*[|]\s*[^|]{2,40}$/, '')
    .trim();
  res.image = res.image || meta('og:image');
  return res;
}

// Страница, где рецептов много («10 салатов на Новый год», подборка, раздел сайта).
// Возвращает { recipes: [полные рецепты], links: [{ title, url, image }] } — из чего выбирать.
function extractMany(doc, base) {
  const one = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const up = (el) => String(el.tagName || '').toUpperCase();
  const NOISE = 'header, footer, nav, aside, [class*="comment" i], [class*="advert" i], [class*="banner" i], [class*="social" i], [class*="share" i], [class*="menu" i], [class*="breadcrumb" i], [class*="pagination" i]';
  const inNoise = (el) => { try { return !!el.closest(NOISE); } catch (e) { return false; } };
  const HEADS = /^(ингредиенты|состав|продукты|приготовление|способ приготовления|как приготовить|шаги|советы|комментарии|похожие рецепты|читайте также|содержание|оглавление)/i;
  const cleanTitle = (t) => one(t).replace(/^(\d{1,2}[.)]|№\s*\d+[.:]?|рецепт\s*(№\s*)?\d+[.:]?)\s*/i, '').replace(/[.:]$/, '').trim();
  const out = { recipes: [], links: [] };
  const seenTitles = new Set();
  const addRecipe = (r, title) => {
    const t = cleanTitle(title || r.title);
    const key = t.toLowerCase();
    if (!t || seenTitles.has(key)) return;
    seenTitles.add(key);
    out.recipes.push({ ...r, title: t });
  };

  // 1. Несколько рецептов в разметке JSON-LD
  const ldRecipes = [], ldLinks = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const t = node['@type'], is = (x) => t === x || (Array.isArray(t) && t.includes(x));
    if (is('Recipe')) { ldRecipes.push(node); return; }
    if (is('ItemList')) {
      for (const it of [].concat(node.itemListElement || [])) {
        const x = it && it.item && typeof it.item === 'object' ? it.item : it;
        if (!x || typeof x !== 'object') continue;
        if ((x['@type'] === 'Recipe' || (Array.isArray(x['@type']) && x['@type'].includes('Recipe'))) && (x.recipeIngredient || x.recipeInstructions)) { ldRecipes.push(x); continue; }
        const url = x.url || (typeof it.item === 'string' ? it.item : '') || x['@id'];
        if (url) ldLinks.push({ title: one(x.name || it.name || ''), url: String(url), image: typeof x.image === 'string' ? x.image : (x.image && x.image.url) || '' });
      }
    }
    ['@graph', 'mainEntity', 'mainEntityOfPage', 'hasPart', 'itemListElement'].forEach((k) => { if (node[k] && typeof node[k] === 'object' && !is('ItemList')) walk(node[k]); });
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = s.textContent || '';
    try { walk(JSON.parse(raw)); } catch (e) { try { walk(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1'))); } catch (e2) { /* битая разметка */ } }
  }
  if (ldRecipes.length >= 2) {
    for (const node of ldRecipes) {
      // разбираем каждый рецепт тем же способом, что и одиночный: подсовываем его разметку в пустой блок
      const box = doc.createElement('div'), sc = doc.createElement('script');
      sc.setAttribute('type', 'application/ld+json'); sc.textContent = JSON.stringify(node);
      box.appendChild(sc);
      const r = extractRecipe(box);
      if (r.ingredients.length >= 2 || r.steps.length >= 2) addRecipe(r);
    }
  }

  // 2. Статья-подборка: рецепты идут друг за другом под заголовками h2/h3
  if (out.recipes.length < 2) {
    let best = [];
    for (const tag of ['H2', 'H3', 'H4']) {
      const heads = [...doc.querySelectorAll(tag)].filter((h) => !inNoise(h) && one(h.textContent).length >= 3 && one(h.textContent).length <= 120 && !HEADS.test(one(h.textContent)));
      if (heads.length < 2) continue;
      const found = [];
      for (const h of heads) {
        // от заголовка (или его обёртки) берём соседние блоки до следующего заголовка того же уровня
        let cur = h;
        while (cur && !cur.nextElementSibling && cur.parentElement && cur.parentElement !== doc.body) cur = cur.parentElement;
        const box = doc.createElement('div');
        let s = cur && cur.nextElementSibling;
        for (let i = 0; s && i < 80; i++, s = s.nextElementSibling) {
          if (up(s) === tag || (s.querySelector && s.querySelector(tag))) break;
          box.appendChild(s.cloneNode(true));
        }
        const r = extractRecipe(box);
        const withQty = r.ingredients.filter((x) => /\d|по вкусу|щепотк|пучок|зубчик/i.test(x)).length;
        if (withQty >= 2 && r.steps.length >= 1) {
          const im = box.querySelector('img');
          let image = im ? im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('src') || '' : '';
          try { image = image && !/^data:/.test(image) ? new URL(image, base).toString() : ''; } catch (e) { image = ''; }
          found.push({ r: { ...r, image }, title: one(h.textContent) });
        }
      }
      if (found.length > best.length) best = found;
    }
    if (best.length >= 2) best.forEach(({ r, title }) => addRecipe(r, title));
  }

  // 3. Раздел сайта: карточки-ссылки на отдельные рецепты
  let host = '', basePath = '';
  try { const b = new URL(base); host = b.hostname; basePath = b.pathname.replace(/\/$/, ''); } catch (e) { /* без адреса страницы */ }
  const links = [];
  const sameSite = (u) => { try { return new URL(u, base).hostname.replace(/^www\./, '') === host.replace(/^www\./, ''); } catch (e) { return false; } };
  // в разметке бывают и чужие ссылки (меню сети сайтов) — берём только свои; название без подписи берём из ссылки на странице
  const ownLd = ldLinks.filter((l) => sameSite(l.url) && !/\/\/[^/]+\/?$/.test(l.url));
  if (ownLd.length >= 3) {
    const textByUrl = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      try { const k = new URL(a.getAttribute('href'), base).toString(), t = one(a.getAttribute('title') || a.textContent); if (t.length >= 4 && !textByUrl.has(k)) textByUrl.set(k, t); } catch (e) { /* битая ссылка */ }
    }
    ownLd.forEach((l) => { let k = l.url; try { k = new URL(l.url, base).toString(); } catch (e) { /* как есть */ } links.push({ ...l, title: l.title || textByUrl.get(k) || '' }); });
  } else if (host) {
    const groups = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      if (inNoise(a)) continue;
      let u;
      try { u = new URL(a.getAttribute('href'), base); } catch (e) { continue; }
      if (u.hostname !== host || u.hash && u.pathname === basePath || u.pathname.replace(/\/$/, '') === basePath || u.pathname.split('/').filter(Boolean).length < 1) continue;
      if (/\/(tag|tags|category|categories|author|page|search|login|user|profile)s?\//i.test(u.pathname) || /\.(jpg|png|pdf)$/i.test(u.pathname)) continue;
      const img = a.querySelector('img');
      const title = one(a.getAttribute('title') || a.textContent || (img && img.getAttribute('alt')) || '');
      if (title.length < 6 || title.length > 120 || !/[а-яёa-z]{3,}/i.test(title)) continue;
      // карточки одного списка устроены одинаково: группируем по классам ссылки и двух её родителей
      const p1 = a.parentElement, p2 = p1 && p1.parentElement;
      const sig = [a, p1, p2].map((e) => (e ? up(e) + '.' + String(e.getAttribute('class') || '').split(/\s+/)[0] : '')).join('>');
      if (!groups.has(sig)) groups.set(sig, []);
      const card = (p2 && p2.querySelector('img')) || img;
      groups.get(sig).push({ title, url: u.origin + u.pathname + u.search, image: card ? card.getAttribute('data-src') || card.getAttribute('src') || '' : '' });
    }
    let bestG = [];
    for (const g of groups.values()) {
      const uniq = [...new Map(g.map((x) => [x.url, x])).values()];
      if (uniq.length > bestG.length) bestG = uniq;
    }
    if (bestG.length >= 4) bestG.forEach((l) => links.push(l));
  }
  const seenUrl = new Set();
  for (const l of links) {
    let url = l.url;
    try { url = new URL(url, base || undefined).toString(); } catch (e) { continue; }
    if (seenUrl.has(url) || !/^https?:/.test(url) || !cleanTitle(l.title)) continue;
    seenUrl.add(url);
    let image = l.image || '';
    try { if (image && !/^data:/.test(image)) image = new URL(image, url).toString(); else image = ''; } catch (e) { image = ''; }
    out.links.push({ title: cleanTitle(l.title), url, image });
    if (out.links.length >= 60) break;
  }
  out.recipes = out.recipes.slice(0, 40);
  return out;
}
// <<< extractRecipe
