// Еженедельная резервная копия всей базы → файл в Telegram.
// Файл в том же формате, что «Настройки → Сохранить копию», поэтому восстанавливается
// через «Настройки → Загрузить копию».
// Запускается GitHub Actions (.github/workflows/backup.yml), секреты те же, что у напоминаний.
const env = process.env;
const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS'];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error('Не заданы секреты: ' + missing.join(', '));
  process.exit(1);
}

const KINDS = ['recipes', 'pantry', 'shopping', 'preserves', 'custom_ingredients', 'menu', 'settings'];
const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/items?select=id,kind,data&order=id`, {
    headers: { ...headers, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) {
    console.error('Supabase:', res.status, await res.text());
    process.exit(1);
  }
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}

const data = Object.fromEntries(KINDS.map((k) => [k, []]));
for (const r of rows) if (data[r.kind]) data[r.kind].push({ ...r.data, id: r.id });

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
const json = JSON.stringify({ app: 'nasha-kuhnya', version: 1, exported_at: new Date().toISOString(), data }, null, 1);
const c = (k) => data[k].length;
const caption = `💾 Резервная копия «Нашей кухни» за ${today}\n` +
  `Рецептов: ${c('recipes')} · дома: ${c('pantry')} · покупок: ${c('shopping')} · заготовок: ${c('preserves')} · дней меню: ${c('menu')}\n` +
  'Восстановить: приложение → Настройки → Загрузить копию.';
console.log(caption);

let failed = 0;
for (const chat of env.TELEGRAM_CHAT_IDS.split(',').map((s) => s.trim()).filter(Boolean)) {
  const form = new FormData();
  form.append('chat_id', chat);
  form.append('caption', caption);
  form.append('disable_notification', 'true');
  form.append('document', new Blob([json], { type: 'application/json' }), `nasha-kuhnya-${today}.json`);
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: form });
  if (!r.ok) { failed++; console.error(`Telegram (${chat}):`, r.status, await r.text()); }
}
process.exit(failed ? 1 : 0);
