// e2e удаляют и меняют данные, поэтому идут только в отдельную базу `<имя>_test`:
// база разработки и прод под тесты не попадут, даже если перепутать .env.
export const TEST_DATABASE_SUFFIX = '_test';

// E2E_DATABASE_URL — явный адрес; иначе берём DATABASE_URL и дописываем `_test` к имени базы.
export function resolveTestDatabaseUrl(env: {
  DATABASE_URL?: string;
  E2E_DATABASE_URL?: string;
}): string {
  const explicit = env.E2E_DATABASE_URL?.trim();
  const source = explicit || env.DATABASE_URL?.trim();
  if (!source) {
    throw new Error('Для e2e нужен DATABASE_URL или E2E_DATABASE_URL');
  }

  const url = new URL(source);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) throw new Error('В адресе базы для e2e нет имени базы');

  if (name.endsWith(TEST_DATABASE_SUFFIX)) return url.toString();
  if (explicit) {
    throw new Error(
      `E2E_DATABASE_URL должен вести в базу с именем на «${TEST_DATABASE_SUFFIX}», сейчас — «${name}»`,
    );
  }
  url.pathname = `/${encodeURIComponent(name + TEST_DATABASE_SUFFIX)}`;
  return url.toString();
}

// Имя базы для сообщений: без логина и пароля.
export function databaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
}
