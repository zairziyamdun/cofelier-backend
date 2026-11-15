import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('подставляет значения по умолчанию', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:3000');
    expect(env.JWT_TTL_SECONDS).toBe(604_800);
  });

  it('приводит PORT из строки к числу', () => {
    expect(validateEnv({ ...base, PORT: '5000' }).PORT).toBe(5000);
  });

  it('падает без DATABASE_URL и называет переменную', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('пустой COOKIE_DOMAIN — не задан', () => {
    expect(validateEnv({ ...base, COOKIE_DOMAIN: '' }).COOKIE_DOMAIN).toBe(
      undefined,
    );
  });

  it('не принимает короткий JWT_SECRET', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
