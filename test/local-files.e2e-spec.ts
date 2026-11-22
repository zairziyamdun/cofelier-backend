import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { ManagedMenuItemDto } from '../src/menu/dto/menu-manage.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { testUsers } from './helpers/users';

// Режим «диск» (S3 не задан): файлы пишутся в UPLOADS_DIR, отдаёт их сам API.
// Папка e2e — временная (src/config/test-database.ts).
describe('Фото на диске API (e2e)', () => {
  let app: INestApplication<App>;
  let managerCookie: string;
  let categoryId: number;
  const users = testUsers(() => app, 'local-files');
  const itemIds: number[] = [];

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    managerCookie = users.cookie(await users.create('manager'));
    categoryId = (
      await app
        .get(PrismaService)
        .menuCategory.findFirstOrThrow({ orderBy: { id: 'asc' } })
    ).id;
  });

  afterAll(async () => {
    await app
      .get(PrismaService)
      .menuItem.deleteMany({ where: { id: { in: itemIds } } });
    await users.cleanup();
    await app.close();
  });

  it('загрузка → файл по ссылке из меню → удаление позиции убирает файл', async () => {
    const item = (
      await api()
        .post('/api/menu/items')
        .set('Cookie', managerCookie)
        .send({ categoryId, name: `Диск ${Date.now()}`, price: 1000 })
        .expect(201)
    ).body as ManagedMenuItemDto;
    itemIds.push(item.id);

    const photo = await sharp({
      create: { width: 600, height: 750, channels: 3, background: '#b87333' },
    })
      .jpeg()
      .toBuffer();
    const updated = (
      await api()
        .post(`/api/menu/items/${item.id}/photos`)
        .set('Cookie', managerCookie)
        .attach('photos', photo, 'photo.jpg')
        .expect(201)
    ).body as ManagedMenuItemDto;

    const url = updated.photos[0].urls.small;
    expect(url).toMatch(/^\/api\/files\/menu\/\d+\/[0-9a-f-]+-320\.webp$/);
    const file = await api().get(url).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.headers['cache-control']).toContain('immutable');
    expect((await sharp(file.body as Buffer).metadata()).format).toBe('webp');

    await api()
      .delete(`/api/menu/items/${item.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
    await api().get(url).expect(404);
  });

  it('чужой путь и несуществующий файл — 404, без входа можно', async () => {
    await api().get('/api/files/menu/1/photo.jpg').expect(404);
    await api().get('/api/files/menu/1/..%2F..%2F.env').expect(404);
    await api()
      .get('/api/files/menu/1/3f2b9c1e-8a4d-4e6f-9b2a-1c3d5e7f9a0b-320.webp')
      .expect(404);
  });
});
