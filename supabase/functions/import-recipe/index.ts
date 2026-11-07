// Supabase Edge Function «import-recipe»: получает ссылку на рецепт и возвращает
// название, фото, порции, время, ингредиенты и шаги.
// Читает стандартную разметку рецептов schema.org (JSON-LD или microdata),
// которая есть на большинстве кулинарных сайтов (eda.ru, povarenok.ru, russianfood.com, …).
// Вызывать могут только вошедшие пользователи из таблицы members.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    const recipe = fromJsonLd(html) ?? fromMicrodata(html) ?? {};
    const out = {
      title: clean(recipe.title) || meta(html, 'og:title') || tagText(html, 'title'),
      image: recipe.image || meta(html, 'og:image') || '',
      servings: clean(recipe.servings),
      time: clean(recipe.time),
      category: clean(recipe.category),
      ingredients: (recipe.ingredients ?? []).map(clean).filter(Boolean),
      steps: (recipe.steps ?? []).map(clean).filter(Boolean),
      source: target.toString(),
    };
    return json(out);
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
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^\[?[0-9a-f:]+\]?$/.test(h) && h.includes(':')) return null;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
    return u;
  } catch {
    return null;
  }
}

// Кодировка страницы (некоторые старые сайты в windows-1251)
async function decodeBody(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  let charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
  if (!charset) {
    const head = new TextDecoder('ascii').decode(buf.slice(0, 4096));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

type Recipe = { title?: string; image?: string; servings?: string; time?: string; category?: string; ingredients?: string[]; steps?: string[] };

// ---------- JSON-LD ----------
function fromJsonLd(html: string): Recipe | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, ' ')); } catch { continue; }
    const r = findRecipe(data);
    if (r) {
      return {
        title: str(r.name),
        image: imageOf(r.image),
        servings: str(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield),
        time: isoDuration(str(r.totalTime)) || [isoDuration(str(r.prepTime)), isoDuration(str(r.cookTime))].filter(Boolean).join(' + '),
        category: str(Array.isArray(r.recipeCategory) ? r.recipeCategory[0] : r.recipeCategory),
        ingredients: arr(r.recipeIngredient ?? r.ingredients).map(str),
        steps: instructions(r.recipeInstructions),
      };
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
function findRecipe(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n); if (r) return r; }
    return null;
  }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  if (node['@graph']) return findRecipe(node['@graph']);
  if (node.mainEntity) return findRecipe(node.mainEntity);
  return null;
}

// deno-lint-ignore no-explicit-any
function instructions(x: any): string[] {
  if (!x) return [];
  if (typeof x === 'string') return stripTags(x).split(/\n+|(?<=\.)\s{2,}/);
  if (Array.isArray(x)) return x.flatMap(instructions);
  if (typeof x === 'object') {
    if (x.itemListElement) return instructions(x.itemListElement);
    if (x.text) return [str(x.text)];
    if (x.name) return [str(x.name)];
  }
  return [];
}

// ---------- Microdata (запасной вариант) ----------
function fromMicrodata(html: string): Recipe | null {
  const items = (prop: string) =>
    [...html.matchAll(new RegExp(`<([a-z0-9]+)[^>]*itemprop=["'][^"']*\\b${prop}\\b[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`, 'gi'))].map((m) => stripTags(m[2]));
  const ingredients = items('recipeIngredient').length ? items('recipeIngredient') : items('ingredients');
  if (!ingredients.length) return null;
  const nameMeta = /<meta[^>]*itemprop=["']name["'][^>]*content=["']([^"']+)/i.exec(html)?.[1];
  return {
    title: nameMeta || items('name')[0],
    ingredients,
    steps: items('recipeInstructions'),
    servings: items('recipeYield')[0],
  };
}

// ---------- Помощники ----------
// deno-lint-ignore no-explicit-any
function arr(x: any): any[] { return Array.isArray(x) ? x : x ? [x] : []; }
// deno-lint-ignore no-explicit-any
function str(x: any): string { return x == null ? '' : typeof x === 'string' ? x : typeof x === 'number' ? String(x) : x.name ?? x.text ?? ''; }
// deno-lint-ignore no-explicit-any
function imageOf(x: any): string {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return imageOf(x[0]);
  return x.url ?? x.contentUrl ?? '';
}
function isoDuration(s: string): string {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(s || '');
  if (!m || !(m[1] || m[2] || m[3])) return s && !/^P/i.test(s) ? s : '';
  const h = Number(m[1] || 0) * 24 + Number(m[2] || 0);
  return [h ? `${h} ч` : '', m[3] && Number(m[3]) ? `${Number(m[3])} мин` : ''].filter(Boolean).join(' ');
}
const ENT: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', times: '×' };
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, e: string) => {
    if (e[0] === '#') { const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(code) ? String.fromCodePoint(code) : all; }
    return ENT[e.toLowerCase()] ?? all;
  });
}
function stripTags(s: string): string { return decodeEntities(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')); }
function clean(s: unknown): string { return stripTags(String(s ?? '')).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim(); }
function meta(html: string, prop: string): string {
  const m = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)`, 'i').exec(html)
    ?? new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i').exec(html);
  return m ? decodeEntities(m[1]).trim() : '';
}
function tagText(html: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(html);
  return m ? clean(m[1]) : '';
}
