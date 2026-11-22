import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Role, User } from '../src/generated/prisma/client';
import type { ManagedMenuItemDto } from '../src/menu/dto/menu-manage.dto';
import type { ManagedModifierGroupDto } from '../src/menu/dto/menu-modifiers.dto';
import type { MenuCategoryDto } from '../src/menu/dto/menu-response.dto';
import type {
  OrderDto,
  RepeatOrderDto,
} from '../src/orders/dto/order-response.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { testUsers } from './helpers/users';

describe('Добавки и заказ с добавками (e2e)', () => {
  let app: INestApplication<App>;
  let managerCookie: string;
  let client: User;
  let repeatClient: User;
  let categoryId: number;
  let size: ManagedModifierGroupDto;
  let milk: ManagedModifierGroupDto;
  let shot: ManagedModifierGroupDto;
  let item: ManagedMenuItemDto;
  const users = testUsers(() => app, 'menu-modifiers');
  const groupIds: number[] = [];
  const itemIds: number[] = [];
  const stamp = Date.now();

  const api = () => request(app.getHttpServer());
  const option = (group: ManagedModifierGroupDto, name: string) =>
    group.options.find((candidate) => candidate.name === name)!.id;

  async function createGroup(body: object): Promise<ManagedModifierGroupDto> {
    const group = (
      await api()
        .post('/api/menu/modifier-groups')
        .set('Cookie', managerCookie)
        .send(body)
        .expect(201)
    ).body as ManagedModifierGroupDto;
    groupIds.push(group.id);
    return group;
  }

  const order = (body: object) =>
    api().post('/api/orders').set('Cookie', users.cookie(client)).send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    managerCookie = users.cookie(await users.create('manager'));
    client = await users.create('client');
    repeatClient = await users.create('client');
    // Категория из сидов: новые категории мешали бы тесту порядка категорий.
    categoryId = (
      await app
        .get(PrismaService)
        .menuCategory.findFirstOrThrow({ orderBy: { id: 'asc' } })
    ).id;

    size = await createGroup({
      name: `Объём ${stamp}`,
      kind: 'single',
      required: true,
      options: [
        { name: 'Стандарт', isDefault: true },
        { name: 'Большой', priceDelta: 400, note: '+150 мл' },
      ],
    });
    milk = await createGroup({
      name: `Молоко ${stamp}`,
      kind: 'single',
      options: [
        { name: 'Обычное', isDefault: true },
        { name: 'Овсяное', priceDelta: 300 },
      ],
    });
    shot = await createGroup({
      name: `Шот ${stamp}`,
      kind: 'quantity',
      maxSelect: 2,
      options: [{ name: 'Эспрессо', priceDelta: 350 }],
    });

    const created = (
      await api()
        .post('/api/menu/items')
        .set('Cookie', managerCookie)
        .send({ categoryId, name: `Латте добавки ${stamp}`, price: 1600 })
        .expect(201)
    ).body as ManagedMenuItemDto;
    itemIds.push(created.id);
    item = (
      await api()
        .put(`/api/menu/items/${created.id}/modifier-groups`)
        .set('Cookie', managerCookie)
        .send({ groupIds: [size.id, milk.id, shot.id] })
        .expect(200)
    ).body as ManagedMenuItemDto;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.order.deleteMany({
      where: { userId: { in: [client.id, repeatClient.id] } },
    });
    await prisma.menuItem.deleteMany({ where: { id: { in: itemIds } } });
    await prisma.modifierGroup.deleteMany({ where: { id: { in: groupIds } } });
    await users.cleanup();
    await app.close();
  });

  it('группы подключены к позиции по порядку, цена по умолчанию', async () => {
    expect(item.modifierGroups.map((group) => group.id)).toEqual([
      size.id,
      milk.id,
      shot.id,
    ]);
    expect(item.defaultPrice).toBe(1600);
    const menu = (await api().get('/api/menu').expect(200))
      .body as MenuCategoryDto[];
    const publicItem = menu
      .flatMap((group) => group.items)
      .find((menuItem) => menuItem.id === item.id);
    expect(publicItem?.modifierGroups[0]).toMatchObject({
      name: size.name,
      required: true,
      options: [
        { name: 'Стандарт', isDefault: true, isAvailable: true },
        { name: 'Большой', priceDelta: 400, note: '+150 мл' },
      ],
    });
  });

  it('заказ: цена с надбавками, копии добавок, одна позиция — разными строками', async () => {
    const response = await order({
      items: [
        {
          menuItemId: item.id,
          quantity: 2,
          modifiers: [
            { optionId: option(size, 'Большой') },
            { optionId: option(milk, 'Овсяное') },
            { optionId: option(shot, 'Эспрессо'), quantity: 2 },
          ],
        },
        {
          menuItemId: item.id,
          quantity: 1,
          modifiers: [{ optionId: option(size, 'Стандарт') }],
        },
      ],
      expectedTotal: (1600 + 400 + 300 + 700) * 2 + 1600,
    }).expect(201);
    const created = response.body as OrderDto;
    expect(created.total).toBe(7600);
    expect(created.items[0]).toMatchObject({ price: 3000, quantity: 2 });
    expect(created.items[0].modifiers).toEqual([
      {
        groupName: size.name,
        optionName: 'Большой',
        priceDelta: 400,
        quantity: 1,
        isDefault: false,
      },
      {
        groupName: milk.name,
        optionName: 'Овсяное',
        priceDelta: 300,
        quantity: 1,
        isDefault: false,
      },
      {
        groupName: shot.name,
        optionName: 'Эспрессо',
        priceDelta: 350,
        quantity: 2,
        isDefault: false,
      },
    ]);
    expect(created.items[1].modifiers[0].isDefault).toBe(true);
  });

  it('обязательная группа и лимиты — 400 с понятным текстом', async () => {
    const missing = await order({
      items: [{ menuItemId: item.id, quantity: 1 }],
    }).expect(400);
    expect(JSON.stringify(missing.body)).toContain(`Выберите «${size.name}»`);

    const tooMany = await order({
      items: [
        {
          menuItemId: item.id,
          quantity: 1,
          modifiers: [
            { optionId: option(size, 'Стандарт') },
            { optionId: option(shot, 'Эспрессо'), quantity: 3 },
          ],
        },
      ],
    }).expect(400);
    expect(JSON.stringify(tooMany.body)).toContain('от 1 до 2');
  });

  it('вариант в стоп-листе или изменилась цена — 409', async () => {
    const oat = option(milk, 'Овсяное');
    await api()
      .patch(`/api/menu/modifier-options/${oat}`)
      .set('Cookie', managerCookie)
      .send({ inStopList: true })
      .expect(200);
    const stopped = await order({
      items: [
        {
          menuItemId: item.id,
          quantity: 1,
          modifiers: [
            { optionId: option(size, 'Стандарт') },
            { optionId: oat },
          ],
        },
      ],
    }).expect(409);
    expect(JSON.stringify(stopped.body)).toContain('Овсяное');
    await api()
      .patch(`/api/menu/modifier-options/${oat}`)
      .set('Cookie', managerCookie)
      .send({ inStopList: false })
      .expect(200);

    const changed = await order({
      items: [
        {
          menuItemId: item.id,
          quantity: 1,
          modifiers: [{ optionId: option(size, 'Стандарт') }],
        },
      ],
      expectedTotal: 1500,
    }).expect(409);
    expect(JSON.stringify(changed.body)).toContain('Цены в меню изменились');
  });

  it('настройки группы проверяются: два варианта по умолчанию в «один» — 400', async () => {
    const bad = await api()
      .post('/api/menu/modifier-groups')
      .set('Cookie', managerCookie)
      .send({
        name: `Плохая ${stamp}`,
        kind: 'single',
        options: [
          { name: 'А', isDefault: true },
          { name: 'Б', isDefault: true },
        ],
      })
      .expect(400);
    expect(JSON.stringify(bad.body)).toContain('только один');

    const withOption = (
      await api()
        .post(`/api/menu/modifier-groups/${milk.id}/options`)
        .set('Cookie', managerCookie)
        .send({ name: 'Кокосовое', priceDelta: 300 })
        .expect(201)
    ).body as ManagedModifierGroupDto;
    expect(withOption.options.map((candidate) => candidate.name)).toEqual([
      'Обычное',
      'Овсяное',
      'Кокосовое',
    ]);
    expect(withOption.itemIds).toEqual([item.id]);
  });

  it('удаление группы не трогает старые заказы', async () => {
    const temp = await createGroup({
      name: `Временная ${stamp}`,
      kind: 'single',
      options: [{ name: 'Корица', priceDelta: 100 }],
    });
    await api()
      .put(`/api/menu/items/${item.id}/modifier-groups`)
      .set('Cookie', managerCookie)
      .send({ groupIds: [size.id, temp.id] })
      .expect(200);
    const created = (
      await order({
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            modifiers: [
              { optionId: option(size, 'Стандарт') },
              { optionId: option(temp, 'Корица') },
            ],
          },
        ],
      }).expect(201)
    ).body as OrderDto;

    await api()
      .delete(`/api/menu/modifier-groups/${temp.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
    const mine = (
      await api()
        .get('/api/orders/my')
        .set('Cookie', users.cookie(client))
        .expect(200)
    ).body as OrderDto[];
    const kept = mine.find((candidate) => candidate.id === created.id);
    expect(
      kept?.items[0].modifiers.map((modifier) => modifier.optionName),
    ).toEqual(['Стандарт', 'Корица']);
  });

  it('повтор: нет заказов, всё доступно, вариант в стоп-листе', async () => {
    const cookie = users.cookie(repeatClient);
    const repeat = async () =>
      (
        await api()
          .get('/api/orders/my/repeat')
          .set('Cookie', cookie)
          .expect(200)
      ).body as RepeatOrderDto;

    expect(await repeat()).toEqual({
      orderId: null,
      createdAt: null,
      lines: [],
    });

    // Тест выше оставил у позиции другие группы — возвращаем все три.
    await api()
      .put(`/api/menu/items/${item.id}/modifier-groups`)
      .set('Cookie', managerCookie)
      .send({ groupIds: [size.id, milk.id, shot.id] })
      .expect(200);
    const oat = option(milk, 'Овсяное');
    const placed = (
      await api()
        .post('/api/orders')
        .set('Cookie', cookie)
        .send({
          items: [
            {
              menuItemId: item.id,
              quantity: 2,
              modifiers: [
                { optionId: option(size, 'Большой') },
                { optionId: oat },
              ],
            },
          ],
        })
        .expect(201)
    ).body as OrderDto;

    const fresh = await repeat();
    expect(fresh.orderId).toBe(placed.id);
    expect(fresh.lines).toEqual([
      {
        menuItemId: item.id,
        name: item.name,
        quantity: 2,
        modifiers: [
          { optionId: option(size, 'Большой'), quantity: 1 },
          { optionId: oat, quantity: 1 },
        ],
        available: true,
        reason: null,
      },
    ]);

    await api()
      .patch(`/api/menu/modifier-options/${oat}`)
      .set('Cookie', managerCookie)
      .send({ inStopList: true })
      .expect(200);
    const stopped = await repeat();
    expect(stopped.lines[0].available).toBe(false);
    expect(stopped.lines[0].reason).toContain('Овсяное');
    await api()
      .patch(`/api/menu/modifier-options/${oat}`)
      .set('Cookie', managerCookie)
      .send({ inStopList: false })
      .expect(200);
  });

  it('повтор после удаления добавки: строка недоступна, остальное цело', async () => {
    const repeat = (
      await api()
        .get('/api/orders/my/repeat')
        .set('Cookie', users.cookie(client))
        .expect(200)
    ).body as RepeatOrderDto;
    // Последний заказ клиента — с «Корицей» из удалённой группы (тест выше).
    expect(repeat.lines[0]).toMatchObject({
      available: false,
      reason: 'Добавки к этой позиции изменились',
    });
  });

  it('повтор — только для клиента', async () => {
    const cookie = users.cookie(await users.create('barista'));
    await api().get('/api/orders/my/repeat').set('Cookie', cookie).expect(403);
    await api().get('/api/orders/my/repeat').expect(401);
  });

  it.each<Role>(['client', 'barista'])(
    '%s не может править добавки — 403',
    async (role) => {
      const cookie = users.cookie(await users.create(role));
      await api()
        .get('/api/menu/modifier-groups')
        .set('Cookie', cookie)
        .expect(403);
      await api()
        .post('/api/menu/modifier-groups')
        .set('Cookie', cookie)
        .send({ name: 'Взлом', kind: 'single' })
        .expect(403);
      await api()
        .put(`/api/menu/items/${item.id}/modifier-groups`)
        .set('Cookie', cookie)
        .send({ groupIds: [] })
        .expect(403);
    },
  );

  it('несуществующие группа, вариант, позиция — 404', async () => {
    await api()
      .patch('/api/menu/modifier-groups/999999')
      .set('Cookie', managerCookie)
      .send({ name: 'Нет такой' })
      .expect(404);
    await api()
      .delete('/api/menu/modifier-options/999999')
      .set('Cookie', managerCookie)
      .expect(404);
    await api()
      .put('/api/menu/items/999999/modifier-groups')
      .set('Cookie', managerCookie)
      .send({ groupIds: [] })
      .expect(404);
  });
});
