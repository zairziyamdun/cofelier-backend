import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { UserDto } from '../src/users/dto/user-response.dto';
import { testUsers } from './helpers/users';

function readCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  return header?.find((cookie) => cookie.startsWith('access_token=')) ?? '';
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const users = testUsers(() => app, 'auth');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await users.cleanup();
    await app.close();
  });

  it('регистрация создаёт клиента и ставит httpOnly-cookie', async () => {
    const email = users.email('register');
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Анна',
        email: email.toUpperCase(),
        password: 'password123',
      })
      .expect(201);

    const user = response.body as UserDto;
    expect(user).toEqual({
      id: user.id,
      email,
      name: 'Анна',
      role: 'client',
    });
    const cookie = readCookie(response);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Повторная регистрация на ту же почту — конфликт.
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Анна', email, password: 'password123' })
      .expect(409);
  });

  it('короткий пароль при регистрации — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Анна', email: users.email('short'), password: '123' })
      .expect(400);
  });

  it('роль из тела регистрации игнорируется', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Хакер',
        email: users.email('role'),
        password: 'password123',
        role: 'admin',
      })
      .expect(400);
  });

  it('вход: неверный пароль — 401, верный — cookie и /auth/me', async () => {
    const user = await users.create('barista', {
      password: 'secret-pass',
    });

    const wrong = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-pass' })
      .expect(401);
    expect((wrong.body as { message: string }).message).toBe(
      'Неверная почта или пароль',
    );

    const ok = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ` ${user.email.toUpperCase()} `, password: 'secret-pass' })
      .expect(200);
    const cookie = readCookie(ok).split(';')[0];

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as UserDto).role).toBe('barista');
  });

  it('отключённый сотрудник не входит и его токен не действует', async () => {
    const user = await users.create('manager', {
      password: 'secret-pass',
      isActive: false,
    });
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'secret-pass' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', users.cookie(user))
      .expect(401);
  });

  it('/auth/me без cookie и с поддельным токеном — 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'access_token=not-a-jwt')
      .expect(401);
  });

  it('выход стирает cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(204);
    expect(readCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
