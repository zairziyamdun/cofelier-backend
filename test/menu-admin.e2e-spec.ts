import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Role } from '../src/generated/prisma/client';
import type {
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
} from '../src/menu/dto/menu-manage.dto';
import type { MenuCategoryDto } from '../src/menu/dto/menu-response.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { testUsers } from './helpers/users';

describe('Управление меню (e2e)', () => {
  let app: INestApplication<App>;
  let managerCookie: string;
  const users = testUsers(() => app, 'menu-admin');
  // Всё, что тест создал в меню, удаляется в afterAll.
  const createdCategoryIds: number[] = [];

  const api = () => request(app.getHttpServer());

  async function createCategory(name: string) {
    const response = await api()
      .post('/api/menu/categories')
      .set('Cookie', managerCookie)
      .send({ name })
      .expect(201);
    const category = response.body as ManagedMenuCategoryDto;
    createdCategoryIds.push(category.id);
    return category;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    managerCookie = users.cookie(await users.create('manager'));
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.menuItem.deleteMany({
      where: { categoryId: { in: createdCategoryIds } },
    });
    await prisma.menuCategory.deleteMany({
      where: { id: { in: createdCategoryIds } },
    });
    await users.cleanup();
    await app.close();
  });

  it('без входа — 401', async () => {
    await api().get('/api/menu/manage').expect(401);
  });

  it.each<Role>(['client', 'barista'])(
    '%s не может править меню — 403',
    async (role) => {
      const cookie = users.cookie(await users.create(role));
      await api().get('/api/menu/manage').set('Cookie', cookie).expect(403);
      await api()
        .post('/api/menu/items')
        .set('Cookie', cookie)
        .send({ categoryId: 1, name: 'Взлом', price: 1 })
        .expect(403);
    },
  );

  it('админ тоже управляет меню', async () => {
    const cookie = users.cookie(await users.create('admin'));
    await api().get('/api/menu/manage').set('Cookie', cookie).expect(200);
  });

  it('позиция: создать → видна в публичном меню → стоп-лист → правка → удалить', async () => {
    const category = await createCategory(`Тест ${Date.now()}`);
    expect(category.slug).toMatch(/^test-\d+/);

    const created = await api()
      .post('/api/menu/items')
      .set('Cookie', managerCookie)
      .send({
        categoryId: category.id,
        name: '  Тестовый латте ',
        description: '',
        portion: '350 мл',
        price: 1700,
      })
      .expect(201);
    const item = created.body as ManagedMenuItemDto;
    expect(item).toMatchObject({
      name: 'Тестовый латте',
      description: null,
      price: 1700,
      inStopList: false,
      isAvailable: true,
    });

    const publicMenu = async () => {
      const response = await api().get('/api/menu').expect(200);
      return (response.body as MenuCategoryDto[])
        .flatMap((group) => group.items)
        .find((menuItem) => menuItem.id === item.id);
    };
    expect(await publicMenu()).toMatchObject({ isAvailable: true });

    await api()
      .patch(`/api/menu/items/${item.id}/stop-list`)
      .set('Cookie', managerCookie)
      .send({ inStopList: true })
      .expect(200);
    expect(await publicMenu()).toMatchObject({ isAvailable: false });

    const updated = await api()
      .patch(`/api/menu/items/${item.id}`)
      .set('Cookie', managerCookie)
      .send({ price: 1800 })
      .expect(200);
    // Правка цены не трогает остальные поля.
    expect(updated.body as ManagedMenuItemDto).toMatchObject({
      price: 1800,
      portion: '350 мл',
      inStopList: true,
    });

    await api()
      .delete(`/api/menu/items/${item.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
    expect(await publicMenu()).toBeUndefined();
    await api()
      .delete(`/api/menu/items/${item.id}`)
      .set('Cookie', managerCookie)
      .expect(404);
  });

  it('ошибки ввода: цена 0, дробная, нет категории — понятные ответы', async () => {
    const category = await createCategory(`Ошибки ${Date.now()}`);
    const post = (body: object) =>
      api().post('/api/menu/items').set('Cookie', managerCookie).send(body);

    const zero = await post({
      categoryId: category.id,
      name: 'Кофе',
      price: 0,
    }).expect(400);
    expect(JSON.stringify(zero.body)).toContain('Цена должна быть больше нуля');
    await post({ categoryId: category.id, name: 'Кофе', price: 99.5 }).expect(
      400,
    );
    await post({ categoryId: 999_999, name: 'Кофе', price: 100 }).expect(404);
  });

  it('категорию с позициями удалить нельзя — 409, пустую — можно', async () => {
    const category = await createCategory(`Удаление ${Date.now()}`);
    await api()
      .post('/api/menu/items')
      .set('Cookie', managerCookie)
      .send({ categoryId: category.id, name: 'Позиция', price: 500 })
      .expect(201);
    await api()
      .delete(`/api/menu/categories/${category.id}`)
      .set('Cookie', managerCookie)
      .expect(409);

    const empty = await createCategory(`Пустая ${Date.now()}`);
    await api()
      .delete(`/api/menu/categories/${empty.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
  });

  it('одинаковые названия категорий получают разные slug', async () => {
    const name = `Дубль ${Date.now()}`;
    const first = await createCategory(name);
    const second = await createCategory(name);
    expect(second.slug).toBe(`${first.slug}-2`);
  });

  it('порядок категорий: только полный список, затем возврат как было', async () => {
    const before = await api()
      .get('/api/menu/manage')
      .set('Cookie', managerCookie)
      .expect(200);
    const ids = (before.body as ManagedMenuCategoryDto[]).map((c) => c.id);

    await api()
      .put('/api/menu/categories/order')
      .set('Cookie', managerCookie)
      .send({ ids: ids.slice(1) })
      .expect(400);

    const reversed = [...ids].reverse();
    const response = await api()
      .put('/api/menu/categories/order')
      .set('Cookie', managerCookie)
      .send({ ids: reversed })
      .expect(200);
    expect(
      (response.body as ManagedMenuCategoryDto[]).map((c) => c.id),
    ).toEqual(reversed);

    await api()
      .put('/api/menu/categories/order')
      .set('Cookie', managerCookie)
      .send({ ids })
      .expect(200);
  });
});
