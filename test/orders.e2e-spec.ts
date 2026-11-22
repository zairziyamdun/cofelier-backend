import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { MenuItem, User } from '../src/generated/prisma/client';
import type { MenuCategoryDto } from '../src/menu/dto/menu-response.dto';
import type {
  OrderDto,
  StaffOrderDto,
} from '../src/orders/dto/order-response.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { testUsers } from './helpers/users';

describe('Заказы (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl: string;
  const users = testUsers(() => app, 'orders');

  let client: User;
  let otherClient: User;
  let barista: User;
  let manager: User;
  let categoryId: number;
  let latte: MenuItem;
  let croissant: MenuItem;
  let soldOut: MenuItem;
  const sockets: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const order = (user: User, body: object) =>
    api().post('/api/orders').set('Cookie', users.cookie(user)).send(body);
  const setStatus = (user: User, id: number, status: string) =>
    api()
      .patch(`/api/orders/${id}/status`)
      .set('Cookie', users.cookie(user))
      .send({ status });

  function connect(user?: User): Socket {
    const socket = io(`${baseUrl}/orders`, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: user ? { cookie: users.cookie(user) } : {},
    });
    sockets.push(socket);
    return socket;
  }

  function nextEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`нет события ${event}`)),
        3000,
      );
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);

    client = await users.create('client');
    otherClient = await users.create('client');
    barista = await users.create('barista');
    manager = await users.create('manager');

    // Категория из сидов: своя новая категория ломала бы тест порядка
    // категорий в соседнем файле (файлы e2e идут параллельно).
    categoryId = (
      await prisma.menuCategory.findFirstOrThrow({ orderBy: { id: 'asc' } })
    ).id;
    [latte, croissant, soldOut] = await Promise.all([
      prisma.menuItem.create({
        data: {
          categoryId,
          slug: `latte-e2e-${Date.now()}`,
          name: 'Латте e2e',
          price: 1600,
        },
      }),
      prisma.menuItem.create({
        data: {
          categoryId,
          slug: `croissant-e2e-${Date.now()}`,
          name: 'Круассан e2e',
          price: 1200,
        },
      }),
      prisma.menuItem.create({
        data: {
          categoryId,
          slug: `cold-brew-e2e-${Date.now()}`,
          name: 'Колд брю e2e',
          price: 1900,
          inStopList: true,
        },
      }),
    ]);
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    const ids = [client, otherClient, barista, manager].map((user) => user.id);
    await prisma.order.deleteMany({ where: { userId: { in: ids } } });
    await prisma.menuItem.deleteMany({
      where: { id: { in: [latte.id, croissant.id, soldOut.id] } },
    });
    await users.cleanup();
    await app.close();
  });

  it('клиент оформляет заказ: сумму считает сервер', async () => {
    const response = await order(client, {
      items: [
        { menuItemId: latte.id, quantity: 2 },
        { menuItemId: croissant.id, quantity: 1 },
      ],
      comment: '  Без сахара ',
    }).expect(201);
    const created = response.body as OrderDto;
    expect(created).toMatchObject({
      status: 'new',
      total: 1600 * 2 + 1200,
      comment: 'Без сахара',
      pickupAt: null,
    });
    expect(
      created.items.map((item) => [item.name, item.price, item.quantity]),
    ).toEqual([
      ['Латте e2e', 1600, 2],
      ['Круассан e2e', 1200, 1],
    ]);
  });

  it('цену и сумму из запроса подставить нельзя — 400', async () => {
    await order(client, {
      items: [{ menuItemId: latte.id, quantity: 1, price: 1 }],
    }).expect(400);
    await order(client, {
      items: [{ menuItemId: latte.id, quantity: 1 }],
      total: 1,
    }).expect(400);
  });

  it('стоп-лист, чужая позиция, пустая корзина', async () => {
    const stop = await order(client, {
      items: [{ menuItemId: soldOut.id, quantity: 1 }],
    }).expect(409);
    expect((stop.body as { message: string }).message).toContain(
      'Колд брю e2e',
    );
    await order(client, {
      items: [{ menuItemId: 999_999, quantity: 1 }],
    }).expect(409);
    await order(client, { items: [] }).expect(400);
  });

  // С добавками одна позиция может быть несколькими строками (разное молоко).
  it('одна позиция двумя строками — можно, каждая со своей ценой', async () => {
    const response = await order(client, {
      items: [
        { menuItemId: latte.id, quantity: 1 },
        { menuItemId: latte.id, quantity: 2 },
      ],
    }).expect(201);
    const created = response.body as OrderDto;
    expect(created.items.map((item) => item.quantity)).toEqual([1, 2]);
    expect(created.total).toBe(1600 * 3);
  });

  it('время получения: прошлое — 400, через полчаса — можно', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await order(client, {
      items: [{ menuItemId: latte.id, quantity: 1 }],
      pickupAt: hourAgo,
    }).expect(400);
    const inHalfHour = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const response = await order(client, {
      items: [{ menuItemId: latte.id, quantity: 1 }],
      pickupAt: inHalfHour,
    }).expect(201);
    expect((response.body as OrderDto).pickupAt).toBe(inHalfHour);
  });

  it('оформить заказ может только клиент', async () => {
    await api().post('/api/orders').send({ items: [] }).expect(401);
    await order(barista, {
      items: [{ menuItemId: latte.id, quantity: 1 }],
    }).expect(403);
  });

  it('клиент видит только свои заказы', async () => {
    const mine = await api()
      .get('/api/orders/my')
      .set('Cookie', users.cookie(client))
      .expect(200);
    expect((mine.body as OrderDto[]).length).toBeGreaterThanOrEqual(2);

    const other = await api()
      .get('/api/orders/my')
      .set('Cookie', users.cookie(otherClient))
      .expect(200);
    expect(other.body).toEqual([]);
  });

  it('очередь — для персонала, с именем клиента', async () => {
    await api()
      .get('/api/orders/queue')
      .set('Cookie', users.cookie(client))
      .expect(403);
    const queue = await api()
      .get('/api/orders/queue')
      .set('Cookie', users.cookie(barista))
      .expect(200);
    const mine = (queue.body as StaffOrderDto[]).filter(
      (item) => item.customerName === client.name,
    );
    expect(mine.length).toBeGreaterThan(0);
  });

  it('статусы: только по шагам, клиент менять не может', async () => {
    const created = (
      await order(client, {
        items: [{ menuItemId: croissant.id, quantity: 1 }],
      }).expect(201)
    ).body as OrderDto;

    await setStatus(client, created.id, 'accepted').expect(403);
    await setStatus(barista, created.id, 'ready').expect(409);
    await setStatus(barista, created.id, 'accepted').expect(200);
    await setStatus(barista, created.id, 'cancelled').expect(200);
    const late = await setStatus(barista, created.id, 'accepted').expect(409);
    expect((late.body as { message: string }).message).toContain('Отменён');
    await setStatus(barista, 999_999, 'accepted').expect(404);
  });

  it('выданный заказ уходит из очереди', async () => {
    const created = (
      await order(client, {
        items: [{ menuItemId: latte.id, quantity: 1 }],
      }).expect(201)
    ).body as OrderDto;
    for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
      await setStatus(barista, created.id, status).expect(200);
    }
    const queue = await api()
      .get('/api/orders/queue')
      .set('Cookie', users.cookie(barista))
      .expect(200);
    expect(
      (queue.body as StaffOrderDto[]).some((item) => item.id === created.id),
    ).toBe(false);
  });

  it('позиция из заказов при удалении уходит в архив, история цела', async () => {
    await api()
      .delete(`/api/menu/items/${croissant.id}`)
      .set('Cookie', users.cookie(manager))
      .expect(204);

    const archived = await prisma.menuItem.findUnique({
      where: { id: croissant.id },
    });
    expect(archived?.isArchived).toBe(true);

    const menu = await api().get('/api/menu').expect(200);
    const visible = (menu.body as MenuCategoryDto[]).flatMap(
      (group) => group.items,
    );
    expect(visible.some((item) => item.id === croissant.id)).toBe(false);

    const mine = await api()
      .get('/api/orders/my')
      .set('Cookie', users.cookie(client))
      .expect(200);
    const names = (mine.body as OrderDto[]).flatMap((item) =>
      item.items.map((line) => line.name),
    );
    expect(names).toContain('Круассан e2e');

    // Заказать архивную позицию нельзя.
    await order(client, {
      items: [{ menuItemId: croissant.id, quantity: 1 }],
    }).expect(409);
  });

  it('WebSocket: бариста видит новый заказ, клиент — смену статуса', async () => {
    const staffSocket = connect(barista);
    const clientSocket = connect(client);
    await Promise.all([
      nextEvent(staffSocket, 'connect'),
      nextEvent(clientSocket, 'connect'),
    ]);
    // Даём серверу время положить сокеты в комнаты после handleConnection.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const createdEvent = nextEvent<StaffOrderDto>(staffSocket, 'order.created');
    const created = (
      await order(client, {
        items: [{ menuItemId: latte.id, quantity: 3 }],
      }).expect(201)
    ).body as OrderDto;
    const staffSees = await createdEvent;
    expect(staffSees).toMatchObject({
      id: created.id,
      customerName: client.name,
      total: 4800,
    });

    const updatedEvent = nextEvent<OrderDto>(clientSocket, 'order.updated');
    await setStatus(barista, created.id, 'accepted').expect(200);
    const clientSees = await updatedEvent;
    expect(clientSees).toMatchObject({ id: created.id, status: 'accepted' });
    expect(clientSees).not.toHaveProperty('customerName');
  });

  it('WebSocket с токеном из /auth/socket-token — без cookie (сайт на другом домене)', async () => {
    const tokenResponse = await api()
      .get('/api/auth/socket-token')
      .set('Cookie', users.cookie(client))
      .expect(200);
    const { token } = tokenResponse.body as { token: string };

    const socket = io(`${baseUrl}/orders`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token },
    });
    sockets.push(socket);
    await nextEvent(socket, 'connect');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const created = (
      await order(client, {
        items: [{ menuItemId: latte.id, quantity: 1 }],
      }).expect(201)
    ).body as OrderDto;
    const updated = nextEvent<OrderDto>(socket, 'order.updated');
    await setStatus(barista, created.id, 'accepted').expect(200);
    expect(await updated).toMatchObject({ id: created.id, status: 'accepted' });
  });

  it('токен сокета не годится для REST и без входа не выдаётся', async () => {
    await api().get('/api/auth/socket-token').expect(401);
    const { token } = (
      await api()
        .get('/api/auth/socket-token')
        .set('Cookie', users.cookie(client))
        .expect(200)
    ).body as { token: string };
    await api()
      .get('/api/auth/me')
      .set('Cookie', `access_token=${token}`)
      .expect(401);
  });

  it('WebSocket без входа получает отказ до подключения', async () => {
    const anonymous = connect();
    let connected = false;
    anonymous.on('connect', () => {
      connected = true;
    });
    const error = await nextEvent<Error>(anonymous, 'connect_error');
    expect(error.message).toBe('unauthorized');
    expect(connected).toBe(false);
  });

  it('WebSocket с недействительным токеном получает отказ', async () => {
    const socket = io(`${baseUrl}/orders`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: 'not-a-jwt' },
    });
    sockets.push(socket);
    const error = await nextEvent<Error>(socket, 'connect_error');
    expect(error.message).toBe('unauthorized');
  });
});
