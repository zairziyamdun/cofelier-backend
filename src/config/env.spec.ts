import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('хранилище фото: всё или ничего', () => {
    expect(validateEnv(base).S3_BUCKET).toBeUndefined();
    const storage = {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'cofelier',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_PUBLIC_URL: 'http://localhost:9000/cofelier/',
    };
    const env = validateEnv({ ...base, ...storage });
    expect(env.S3_PUBLIC_URL).toBe('http://localhost:9000/cofelier');
    expect(env.S3_REGION).toBe('auto');
    expect(() =>
      validateEnv({ ...base, S3_BUCKET: 'cofelier', S3_ENDPOINT: '' }),
    ).toThrow(/S3_ENDPOINT/);
  });

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

  describe('первый админ', () => {
    const admin = {
      ADMIN_EMAIL: ' Admin@Cofelier.KZ ',
      ADMIN_PASSWORD: 'long-enough-pass',
    };

    it('не задан (в том числе пустые строки) — выключено', () => {
      const env = validateEnv({
        ...base,
        ADMIN_EMAIL: '',
        ADMIN_PASSWORD: '',
        ADMIN_RESET_PASSWORD: '',
      });
      expect(env.ADMIN_EMAIL).toBeUndefined();
      expect(env.ADMIN_PASSWORD).toBeUndefined();
      expect(env.ADMIN_RESET_PASSWORD).toBe(false);
    });

    it('почта нормализуется, сброс по умолчанию выключен', () => {
      const env = validateEnv({ ...base, ...admin });
      expect(env.ADMIN_EMAIL).toBe('admin@cofelier.kz');
      expect(env.ADMIN_RESET_PASSWORD).toBe(false);
      expect(
        validateEnv({ ...base, ...admin, ADMIN_RESET_PASSWORD: 'TRUE' })
          .ADMIN_RESET_PASSWORD,
      ).toBe(true);
    });

    it('только одна из двух переменных — ошибка', () => {
      expect(() =>
        validateEnv({ ...base, ADMIN_EMAIL: admin.ADMIN_EMAIL }),
      ).toThrow(/ADMIN_PASSWORD: ADMIN_EMAIL и ADMIN_PASSWORD задаются вместе/);
      expect(() =>
        validateEnv({ ...base, ADMIN_PASSWORD: admin.ADMIN_PASSWORD }),
      ).toThrow(/ADMIN_EMAIL: ADMIN_EMAIL и ADMIN_PASSWORD задаются вместе/);
    });

    it('слабый пароль — ошибка, и значение не попадает в сообщение', () => {
      const short = 'eleven-char';
      expect(() =>
        validateEnv({ ...base, ...admin, ADMIN_PASSWORD: short }),
      ).toThrow(/ADMIN_PASSWORD: пароль админа — от 12 символов/);
      try {
        validateEnv({ ...base, ...admin, ADMIN_PASSWORD: short });
      } catch (error) {
        expect(String(error)).not.toContain(short);
      }
      expect(() =>
        validateEnv({
          ...base,
          ADMIN_EMAIL: 'admin-pass@x.kz',
          ADMIN_PASSWORD: 'ADMIN-PASS@X.KZ',
        }),
      ).toThrow(/ADMIN_PASSWORD/);
    });

    it('сброс без почты и пароля — ошибка, кривое значение — ошибка', () => {
      expect(() =>
        validateEnv({ ...base, ADMIN_RESET_PASSWORD: 'true' }),
      ).toThrow(/ADMIN_RESET_PASSWORD/);
      expect(() =>
        validateEnv({ ...base, ...admin, ADMIN_RESET_PASSWORD: 'yes' }),
      ).toThrow(/ADMIN_RESET_PASSWORD/);
    });
  });
});
