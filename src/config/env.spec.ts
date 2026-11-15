import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('подставляет значения по умолчанию', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:3000');
  });

  it('приводит PORT из строки к числу', () => {
    expect(validateEnv({ ...base, PORT: '5000' }).PORT).toBe(5000);
  });

  it('падает без DATABASE_URL и называет переменную', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
