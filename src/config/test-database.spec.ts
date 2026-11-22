import { databaseName, resolveTestDatabaseUrl } from './test-database';

const dev = 'postgresql://user:pass@localhost:5432/cofelier?schema=public';

describe('база для e2e', () => {
  it('из DATABASE_URL — та же база с суффиксом _test', () => {
    const url = resolveTestDatabaseUrl({ DATABASE_URL: dev });
    expect(databaseName(url)).toBe('cofelier_test');
    expect(url).toContain('schema=public');
    expect(url).toContain('user:pass@localhost:5432');
  });

  it('база уже на _test — не меняется', () => {
    const ci = dev.replace('/cofelier?', '/cofelier_test?');
    expect(resolveTestDatabaseUrl({ DATABASE_URL: ci })).toBe(ci);
  });

  it('E2E_DATABASE_URL важнее DATABASE_URL', () => {
    const explicit = dev.replace('/cofelier?', '/other_test?');
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: dev,
      E2E_DATABASE_URL: explicit,
    });
    expect(databaseName(url)).toBe('other_test');
  });

  it('E2E_DATABASE_URL не на _test — отказ, а не тихая подмена', () => {
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: dev, E2E_DATABASE_URL: dev }),
    ).toThrow('_test');
  });

  it('без адреса или без имени базы — понятная ошибка', () => {
    expect(() => resolveTestDatabaseUrl({})).toThrow('DATABASE_URL');
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: 'postgresql://localhost:5432' }),
    ).toThrow('имени базы');
  });
});
