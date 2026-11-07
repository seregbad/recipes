// Ежедневная проверка сроков годности заготовок и заморозки → сообщение в Telegram.
// Запускается GitHub Actions (.github/workflows/reminders.yml). Нужны секреты репозитория:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS (через запятую)
// Необязательные переменные: REMIND_DAYS (по умолчанию 3), APP_URL (ссылка на приложение).
const env = process.env;
const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS'];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error('Не заданы секреты: ' + missing.join(', '));
  process.exit(1);
}
const REMIND_DAYS = Number(env.REMIND_DAYS || 3);

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }); // YYYY-MM-DD
const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysLeft = (iso) => Math.round((toDate(iso) - toDate(today)) / 86400000);
const plural = (n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; };
const days = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const res = await fetch(`${env.SUPABASE_URL}/rest/v1/items?kind=eq.preserves&select=data`, {
  headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
});
if (!res.ok) {
  console.error('Supabase:', res.status, await res.text());
  process.exit(1);
}
const items = (await res.json()).map((r) => r.data)
  .filter((p) => !p.finished && p.expires_on)
  .map((p) => ({ ...p, left: daysLeft(p.expires_on) }))
  .filter((p) => p.left <= REMIND_DAYS)
  .sort((a, b) => a.left - b.left);

console.log(`Сегодня ${today}, к напоминанию: ${items.length}`);
if (!items.length) process.exit(0);

const line = (p) => {
  const who = p.owner === 'savva' ? ' 👶 <b>Савва</b>' : '';
  const qty = [p.qty, p.unit].filter(Boolean).join(' ');
  const when = p.left < 0 ? `просрочено ${days(-p.left)} назад` : p.left === 0 ? 'истекает сегодня' : `осталось ${days(p.left)}`;
  return `${p.left <= 0 ? '❗' : '⏳'} <b>${esc(p.name)}</b>${who}: ${when}${qty ? ` · ${esc(qty)}` : ''}${p.place ? ` · ${esc(p.place)}` : ''}`;
};
let text = `🧊 <b>Заготовки и заморозка: проверьте сроки</b>\n\n${items.map(line).join('\n')}`;
if (env.APP_URL) text += `\n\n<a href="${esc(env.APP_URL)}#/preserves">Открыть приложение</a>`;
text += '\n\n<i>Когда используете, нажмите в приложении «Закончилось», и напоминания прекратятся.</i>';

let failed = 0;
for (const chat of env.TELEGRAM_CHAT_IDS.split(',').map((s) => s.trim()).filter(Boolean)) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!r.ok) { failed++; console.error(`Telegram (${chat}):`, r.status, await r.text()); }
}
process.exit(failed ? 1 : 0);
