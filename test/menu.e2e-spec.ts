import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type {
  MenuCategoryDto,
  MenuItemDto,
} from '../src/menu/dto/menu-response.dto';

// Нужна БД с сидами: `pnpm db:deploy && pnpm db:seed`.
describe('Menu (e2e)', () => {
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

  it('GET /api/menu открыт без входа и отдаёт категории с позициями', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menu')
      .expect(200);
    const menu = response.body as MenuCategoryDto[];

    expect(menu.length).toBeGreaterThan(0);
    for (const category of menu) {
      expect(category.items.length).toBeGreaterThan(0);
    }
    const item = menu[0].items[0];
    expect(Object.keys(item).sort()).toEqual(
      [
        'badges',
        'description',
        'id',
        'imageUrl',
        'isAvailable',
        'name',
        'portion',
        'price',
      ].sort(),
    );
    expect(typeof item.id).toBe('number');
    expect(typeof item.name).toBe('string');
    expect(Number.isInteger(item.price)).toBe(true);
    expect(typeof item.isAvailable).toBe('boolean');
  });

  it('позиция из стоп-листа видна, но недоступна', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menu')
      .expect(200);
    const items = (response.body as MenuCategoryDto[]).flatMap(
      (category) => category.items,
    );
    expect(items.some((item) => !item.isAvailable)).toBe(true);
  });

  it('GET /api/menu/popular открыт и отдаёт 4 доступные позиции', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menu/popular')
      .expect(200);
    const items = response.body as MenuItemDto[];

    expect(items).toHaveLength(4);
    expect(items.every((item) => item.isAvailable)).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(4);
  });

  it('GET /api/menu/popular уважает limit и проверяет его', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menu/popular?limit=2')
      .expect(200);
    expect(response.body as MenuItemDto[]).toHaveLength(2);

    await request(app.getHttpServer())
      .get('/api/menu/popular?limit=0')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/menu/popular?limit=abc')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/menu/popular?limit=13')
      .expect(400);
  });
});
