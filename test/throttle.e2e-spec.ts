import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Отдельный файл: свой экземпляр приложения — свой счётчик попыток.
describe('Лимит попыток входа (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('11-я попытка входа за минуту — 429', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@throttle.e2e.test', password: 'wrong-pass' });

    for (let index = 0; index < 10; index += 1) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });
});
