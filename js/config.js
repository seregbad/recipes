// Настройки подключения к Supabase.
// Пока поля пустые — приложение работает локально (данные только в этом браузере).
// Когда создадите проект Supabase, вставьте сюда Project URL и anon public key
// (Supabase → Project Settings → API). Этот ключ публичный, его можно хранить на GitHub.
window.APP_CONFIG = {
  supabaseUrl: 'https://xjwbpjmajdxplhzcdivb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqd2Jwam1hamR4cGxoemNkaXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNzgwNzAsImV4cCI6MjEwOTY1NDA3MH0.5hiF5B9H9ztOkbExNm6moRQIp-UkKKB-mtq2OX-u_S0',
  // имя функции загрузки рецептов по ссылке (Supabase → Edge Functions)
  importFunction: 'rapid-action',
  // за сколько дней предупреждать о конце срока годности заготовок
  remindDays: 7,
};
