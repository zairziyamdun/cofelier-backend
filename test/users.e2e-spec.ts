import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Role } from '../src/generated/prisma/client';
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
});
