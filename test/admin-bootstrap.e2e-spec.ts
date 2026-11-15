import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Env } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminBootstrapService } from '../src/users/admin-bootstrap.service';
import { verifyPassword } from '../src/users/password';
import { testUsers } from './helpers/users';

type AdminEnv = Pick<
  Env,
  'ADMIN_EMAIL' | 'ADMIN_PASSWORD' | 'ADMIN_RESET_PASSWORD'
>;

// Сервис с подставленными переменными: тот же код, что при старте API.
describe('Первый админ из env (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users = testUsers(() => app, 'bootstrap');

  function bootstrap(env: AdminEnv) {
    const config = {
      get: (key: keyof AdminEnv) => env[key],
    } as unknown as ConfigService<Env, true>;
    return new AdminBootstrapService(prisma, config).run();
  }

  async function passwordWorks(email: string, password: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return verifyPassword(user.passwordHash, password);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await users.cleanup();
    await app.close();
  });

  it('без переменных — ничего не делает', async () => {
    expect(
      await bootstrap({
        ADMIN_EMAIL: undefined,
        ADMIN_PASSWORD: undefined,
        ADMIN_RESET_PASSWORD: false,
      }),
    ).toBe('disabled');
  });

  it('создаёт админа один раз; повторный старт пароль не трогает', async () => {
    const email = users.email('admin');
    const first = 'first-admin-password';
    expect(
      await bootstrap({
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: first,
        ADMIN_RESET_PASSWORD: false,
      }),
    ).toBe('created');

    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(created).toMatchObject({ role: 'admin', isActive: true });
    expect(await passwordWorks(email, first)).toBe(true);

    expect(
      await bootstrap({
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: 'other-admin-password',
        ADMIN_RESET_PASSWORD: false,
      }),
    ).toBe('exists');
    expect(await passwordWorks(email, first)).toBe(true);
  });

  it('заранее зарегистрированного клиента молча не повышает', async () => {
    const client = await users.create('client', {
      password: 'client-own-pass',
    });
    expect(
      await bootstrap({
        ADMIN_EMAIL: client.email,
        ADMIN_PASSWORD: 'env-admin-password',
        ADMIN_RESET_PASSWORD: false,
      }),
    ).toBe('not-admin');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(after.role).toBe('client');
    expect(await passwordWorks(client.email, 'client-own-pass')).toBe(true);
  });

  it('сброс: роль «админ», аккаунт включён, работает только пароль из env', async () => {
    const victim = await users.create('client', {
      password: 'attacker-pass',
      isActive: false,
    });
    expect(
      await bootstrap({
        ADMIN_EMAIL: victim.email,
        ADMIN_PASSWORD: 'env-admin-password',
        ADMIN_RESET_PASSWORD: true,
      }),
    ).toBe('reset');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: victim.id },
    });
    expect(after).toMatchObject({ role: 'admin', isActive: true });
    expect(await passwordWorks(victim.email, 'env-admin-password')).toBe(true);
    expect(await passwordWorks(victim.email, 'attacker-pass')).toBe(false);
  });
});
