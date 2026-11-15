import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Role } from '../src/generated/prisma/client';
import type { StaffDto } from '../src/users/dto/staff.dto';
import type { UserDto } from '../src/users/dto/user-response.dto';
import { testUsers } from './helpers/users';

// Матрица доступа к ручке только для админа (BACKEND.md §2).
describe('Users: доступ по ролям (e2e)', () => {
  let app: INestApplication<App>;
  const users = testUsers(() => app, 'users');

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

  it('GET /api/users/staff без входа — 401', async () => {
    await request(app.getHttpServer()).get('/api/users/staff').expect(401);
  });

  it.each<Role>(['client', 'barista', 'manager'])(
    'GET /api/users/staff для %s — 403',
    async (role) => {
      const user = await users.create(role);
      await request(app.getHttpServer())
        .get('/api/users/staff')
        .set('Cookie', users.cookie(user))
        .expect(403);
    },
  );

  it('GET /api/users/staff для admin — сотрудники без клиентов', async () => {
    const admin = await users.create('admin');
    const barista = await users.create('barista');
    const client = await users.create('client');

    const response = await request(app.getHttpServer())
      .get('/api/users/staff')
      .set('Cookie', users.cookie(admin))
      .expect(200);
    const emails = (response.body as UserDto[]).map((user) => user.email);

    expect(emails).toContain(barista.email);
    expect(emails).not.toContain(client.email);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  describe('управление сотрудниками', () => {
    const api = () => request(app.getHttpServer());

    it('админ создаёт сотрудника — тот может войти', async () => {
      const admin = await users.create('admin');
      const email = users.email('new-barista');
      const created = await api()
        .post('/api/users/staff')
        .set('Cookie', users.cookie(admin))
        .send({
          name: ' Дана ',
          email,
          password: 'temporary-pass',
          role: 'barista',
        })
        .expect(201);
      expect(created.body as StaffDto).toMatchObject({
        name: 'Дана',
        email,
        role: 'barista',
        isActive: true,
      });
      expect(JSON.stringify(created.body)).not.toContain('password');

      await api()
        .post('/api/auth/login')
        .send({ email, password: 'temporary-pass' })
        .expect(200);

      // Та же почта второй раз — конфликт.
      await api()
        .post('/api/users/staff')
        .set('Cookie', users.cookie(admin))
        .send({
          name: 'Дана',
          email,
          password: 'temporary-pass',
          role: 'barista',
        })
        .expect(409);
    });

    it('клиента через админку не создать, короткий пароль — 400', async () => {
      const admin = await users.create('admin');
      const post = (body: object) =>
        api()
          .post('/api/users/staff')
          .set('Cookie', users.cookie(admin))
          .send(body);
      await post({
        name: 'Клиент',
        email: users.email('c'),
        password: 'temporary-pass',
        role: 'client',
      }).expect(400);
      await post({
        name: 'Бариста',
        email: users.email('b'),
        password: '123',
        role: 'barista',
      }).expect(400);
    });

    it('смена роли и отключение; отключённый теряет доступ сразу', async () => {
      const admin = await users.create('admin');
      const barista = await users.create('barista');
      const patch = (body: object) =>
        api()
          .patch(`/api/users/staff/${barista.id}`)
          .set('Cookie', users.cookie(admin))
          .send(body);

      const promoted = await patch({ role: 'manager' }).expect(200);
      expect((promoted.body as StaffDto).role).toBe('manager');
      // Новая роль действует со старым токеном: роль берётся из БД.
      await api()
        .get('/api/menu/manage')
        .set('Cookie', users.cookie(barista))
        .expect(200);

      const disabled = await patch({ isActive: false }).expect(200);
      expect((disabled.body as StaffDto).isActive).toBe(false);
      await api()
        .get('/api/auth/me')
        .set('Cookie', users.cookie(barista))
        .expect(401);

      await patch({ isActive: true }).expect(200);
      await api()
        .get('/api/auth/me')
        .set('Cookie', users.cookie(barista))
        .expect(200);
    });

    it('себя изменить нельзя — так всегда остаётся хотя бы один админ', async () => {
      const admin = await users.create('admin');
      const patchSelf = (body: object) =>
        api()
          .patch(`/api/users/staff/${admin.id}`)
          .set('Cookie', users.cookie(admin))
          .send(body);
      await patchSelf({ role: 'barista' }).expect(409);
      await patchSelf({ isActive: false }).expect(409);
    });

    it('клиента через эту ручку не изменить — 404; менеджеру — 403', async () => {
      const admin = await users.create('admin');
      const client = await users.create('client');
      await api()
        .patch(`/api/users/staff/${client.id}`)
        .set('Cookie', users.cookie(admin))
        .send({ role: 'admin' })
        .expect(404);

      const manager = await users.create('manager');
      await api()
        .post('/api/users/staff')
        .set('Cookie', users.cookie(manager))
        .send({
          name: 'Хитрый',
          email: users.email('m'),
          password: 'temporary-pass',
          role: 'admin',
        })
        .expect(403);
    });
  });
});
