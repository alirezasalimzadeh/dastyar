import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const localEnv = {};
for (const file of ['.env', '.env.local']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) localEnv[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.NEW_USER_PASSWORD;

if (process.env.CONFIRM_RESET !== 'DELETE_ALL_DATA' || !url || !serviceKey || !password) {
  console.error(`
این دستور تمام اطلاعات کاری و کاربران را برای همیشه حذف می‌کند.
متغیرهای SUPABASE_SERVICE_ROLE_KEY و NEW_USER_PASSWORD را فقط در ترمینال خودتان تنظیم کنید:

CONFIRM_RESET=DELETE_ALL_DATA \\
SUPABASE_SERVICE_ROLE_KEY='...' \\
NEW_USER_PASSWORD='...' \\
npm run reset:database
`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('رمز کاربر جدید باید حداقل ۸ کاراکتر باشد.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = [
  ['activities', 'id'], ['notifications', 'id'], ['property_matches', 'id'], ['property_requests', 'id'],
  ['calls', 'id'], ['follow_ups', 'id'], ['tasks', 'id'], ['deals', 'id'],
  ['property_tags', 'property_id'], ['customer_tags', 'customer_id'],
  ['customer_preferred_cities', 'customer_id'], ['customer_preferred_neighborhoods', 'customer_id'],
  ['properties', 'id'], ['customers', 'id'], ['owners', 'id'], ['tags', 'id'],
];

console.log('در حال پاک‌کردن اطلاعات کاری...');
for (const [table, column] of tables) {
  const { error } = await supabase.from(table).delete().not(column, 'is', null);
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw new Error(`${table}: ${error.message}`);
}

console.log('در حال حذف کاربران قبلی...');
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  if (!data.users.length) break;
  for (const user of data.users) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
  }
}

for (const [table, column] of [['branches', 'id'], ['agencies', 'id']]) {
  const { error } = await supabase.from(table).delete().not(column, 'is', null);
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw new Error(`${table}: ${error.message}`);
}

console.log('در حال ساخت حساب علیرضا سلیم زاده...');
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email: 'alireza.salim021@gmail.com',
  password,
  email_confirm: true,
  user_metadata: {
    first_name: 'علیرضا',
    last_name: 'سلیم زاده',
    mobile: '09379288776',
  },
});
if (createError || !created.user) throw createError || new Error('ساخت کاربر انجام نشد.');

const { error: profileError } = await supabase.from('profiles').insert({
  id: created.user.id,
  first_name: 'علیرضا',
  last_name: 'سلیم زاده',
  mobile: '09379288776',
  email: 'alireza.salim021@gmail.com',
  role: 'system_admin',
  account_status: 'active',
});
if (profileError) throw profileError;

console.log('\nانجام شد: همه اطلاعات کاری و کاربران قبلی حذف شدند.');
console.log('کاربر جدید: alireza.salim021@gmail.com');
