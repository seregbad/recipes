// Вечернее сообщение в Telegram (каждый день в 19:00 по Москве):
//  • «достаньте из морозилки» — если в меню на завтра есть блюдо, которое лежит в заморозке;
//  • по воскресеньям — меню на следующую неделю и чего не хватает для него.
// Запускается GitHub Actions (.github/workflows/evening.yml), секреты те же, что у напоминаний.
// Переменная FORCE_WEEKLY=1 отправляет недельное меню в любой день (для проверки).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const env = process.env;
const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS'];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error('Не заданы секреты: ' + missing.join(', '));
  process.exit(1);
}

// та же логика сопоставления продуктов, что и в приложении
globalThis.window = globalThis;
vm.runInThisContext(readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8'));
const U = globalThis.U;

// ---------- данные ----------
const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/items?select=id,kind,data&kind=in.(recipes,pantry,shopping,preserves,menu)&order=id`, {
    headers: { ...headers, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) { console.error('Supabase:', res.status, await res.text()); process.exit(1); }
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
const all = (kind) => rows.filter((r) => r.kind === kind).map((r) => ({ ...r.data, id: r.id }));
const recipes = new Map(all('recipes').map((r) => [r.id, r]));
const pantry = all('pantry');
const todo = all('shopping').filter((s) => s.status !== 'bought');
const freezer = all('preserves').filter((p) => !p.finished && (parseFloat(p.qty) || 0) > 0 && p.kind !== 'jar');
const menuDay = (date) => all('menu').find((m) => m.id === 'menu-' + date) || { breakfast: [], lunch: [], dinner: [] };

// ---------- помощники ----------
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const dayLabel = (iso) => `${WD[U.parseDate(iso).getDay()]}, ${U.fmtDate(iso)}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SLOTS = [['breakfast', '🍳'], ['lunch', '🍲'], ['dinner', '🍽']];
const dishTitle = (d) => (d.rid ? (recipes.get(d.rid) || {}).title || '' : d.text || '');
const inFreezer = (d) => {
  const title = dishTitle(d);
  return freezer.find((p) => (d.rid && p.recipe_id === d.rid) || (title && U.sameIng(p.name, title)));
};
const ingLabel = (i) => i.key || i.name;

const messages = [];

// ---------- 1. Достать из морозилки на завтра ----------
const tomorrow = U.addDays(today, 1);
const defrost = [];
for (const [k] of SLOTS) {
  for (const d of menuDay(tomorrow)[k] || []) {
    const p = inFreezer(d);
    if (p && !defrost.some((x) => x.p.id === p.id)) defrost.push({ p, dish: dishTitle(d) });
  }
}
if (defrost.length) {
  messages.push(`❄️ <b>Завтра (${dayLabel(tomorrow)}) в меню блюда из морозилки, достаньте их сегодня:</b>\n\n` +
    defrost.map(({ p }) => `• <b>${esc(p.name)}</b>${p.owner === 'savva' ? ' (Савва)' : ''}: в морозилке ${esc(U.fmtQty(p.qty, p.unit))}` +
      `${p.made_on ? `, сделано ${esc(U.fmtDate(p.made_on))}` : ''}${p.place && p.place !== 'Морозилка' ? ` · ${esc(p.place)}` : ''}`).join('\n'));
}

// ---------- 2. По воскресеньям: меню на неделю ----------
const isSunday = U.parseDate(today).getDay() === 0;
if (isSunday || env.FORCE_WEEKLY === '1') {
  // ближайший понедельник (в воскресенье — завтрашний)
  const dow = U.parseDate(today).getDay();
  const monday = U.addDays(today, ((8 - dow) % 7) || 7);
  const days = [...Array(7)].map((_, i) => U.addDays(monday, i));
  const dishes = [];
  const lines = days.map((d) => {
    const day = menuDay(d);
    const parts = SLOTS.map(([k, ic]) => {
      const list = (day[k] || []).map((x) => { dishes.push(x); return esc(dishTitle(x)) + (inFreezer(x) ? ' ❄' : ''); }).filter(Boolean);
      return list.length ? `${ic} ${list.join(', ')}` : '';
    }).filter(Boolean);
    return `<b>${dayLabel(d)}</b>\n${parts.length ? parts.join('\n') : '<i>не запланировано</i>'}`;
  });

  let text = `📅 <b>Меню на неделю ${esc(U.fmtDate(days[0]))} – ${esc(U.fmtDate(days[6]))}</b>\n\n`;
  if (!dishes.length) {
    text += 'Меню ещё не составлено. Откройте приложение → <b>Меню</b> → следующая неделя → «Заполнить пустое».';
  } else {
    text += lines.join('\n\n');
    // чего не хватает: продукты рецептов, которых нет дома и нет в списке покупок
    const homeNames = pantry.map((p) => p.name);
    const need = new Map();
    for (const d of dishes) {
      const r = d.rid && recipes.get(d.rid);
      if (!r || inFreezer(d)) continue; // из морозилки — готовить не нужно
      for (const i of r.ingredients || []) {
        if (U.isStaple(ingLabel(i)) || i.unit === 'по вкусу') continue;
        const has = homeNames.some((n) => U.sameIng(n, ingLabel(i)) || U.sameIng(n, i.name));
        if (!has) need.set(U.norm(ingLabel(i)), ingLabel(i));
      }
    }
    const notListed = [...need.values()].filter((n) => !todo.some((t) => U.sameIng(t.name, n)));
    text += '\n\n';
    if (notListed.length) {
      text += `🛒 <b>Для меню не хватает (${notListed.length}):</b> ${esc(notListed.join(', '))}\n` +
        '<i>В приложении: Меню → «Продукты на неделю в покупки».</i>';
    } else if (need.size) {
      text += '🛒 Всё недостающее для меню уже в списке покупок.';
    } else {
      text += '🛒 Для меню всё есть дома.';
    }
    if (todo.length) text += `\nВ списке покупок сейчас: ${todo.length}.`;
  }
  if (env.APP_URL) text += `\n\n<a href="${esc(env.APP_URL)}#/menu">Открыть меню</a>`;
  messages.push(text);
}

console.log(`Сегодня ${today}: достать из морозилки — ${defrost.length}, недельное меню — ${isSunday || env.FORCE_WEEKLY === '1' ? 'да' : 'нет'}`);
if (!messages.length) process.exit(0);

// ---------- отправка ----------
let failed = 0;
for (const chat of env.TELEGRAM_CHAT_IDS.split(',').map((s) => s.trim()).filter(Boolean)) {
  for (const text of messages) {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) { failed++; console.error(`Telegram (${chat}):`, r.status, await r.text()); }
  }
}
process.exit(failed ? 1 : 0);
