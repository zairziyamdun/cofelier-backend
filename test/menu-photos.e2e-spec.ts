import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
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
import { StorageService } from '../src/storage/storage.service';
import { MemoryStorage } from './helpers/memory-storage';
import { testUsers } from './helpers/users';

function jpeg(width = 900, height = 1100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#b87333' },
  })
    .jpeg()
    .toBuffer();
}

function transparentPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 500,
      height: 700,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe('Фото позиций меню (e2e)', () => {
  let app: INestApplication<App>;
  let managerCookie: string;
  const storage = new MemoryStorage();
  const users = testUsers(() => app, 'menu-photos');
  // Позиции — в категорию из сидов: новые категории мешали бы тесту порядка
  // категорий в соседнем файле (файлы e2e идут параллельно).
  let categoryId: number;
  const createdItemIds: number[] = [];

  const api = () => request(app.getHttpServer());

  async function createItem(name: string): Promise<ManagedMenuItemDto> {
    const item = (
      await api()
        .post('/api/menu/items')
        .set('Cookie', managerCookie)
        .send({ categoryId, name, price: 1500 })
        .expect(201)
    ).body as ManagedMenuItemDto;
    createdItemIds.push(item.id);
    return item;
  }

  const upload = (itemId: number, files: Buffer[], cookie = managerCookie) => {
    const req = api()
      .post(`/api/menu/items/${itemId}/photos`)
      .set('Cookie', cookie);
    for (const [index, file] of files.entries()) {
      void req.attach('photos', file, `photo-${index}.jpg`);
    }
    return req;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    managerCookie = users.cookie(await users.create('manager'));
    const category = await app
      .get(PrismaService)
      .menuCategory.findFirstOrThrow({ orderBy: { id: 'asc' } });
    categoryId = category.id;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.menuItem.deleteMany({
      where: { id: { in: createdItemIds } },
    });
    await users.cleanup();
    await app.close();
  });

  it('позиция получает slug из названия, дубль — с суффиксом', async () => {
    const first = await createItem('Ореховый раф');
    const second = await createItem('Ореховый раф');
    expect(first.slug).toMatch(/^orehovyy-raf(-\d+)?$/);
    expect(second.slug).not.toBe(first.slug);
    expect(first.photos).toEqual([]);
  });

  it('загрузка: три размера в хранилище, порядок и прозрачность', async () => {
    const item = await createItem('Фото-латте');
    const response = await upload(item.id, [
      await jpeg(),
      await transparentPng(),
    ]).expect(201);
    const updated = response.body as ManagedMenuItemDto;
    expect(updated.photos).toHaveLength(2);
    expect(updated.photos[0]).toMatchObject({
      width: 900,
      height: 1100,
      hasAlpha: false,
    });
    expect(updated.photos[1].hasAlpha).toBe(true);
    expect(updated.photos[0].urls.small).toMatch(
      /^https:\/\/storage\.test\/menu\/\d+\/[0-9a-f-]+-320\.webp$/,
    );
    expect(storage.keysOf(item.id)).toHaveLength(6);

    // Публичное меню отдаёт те же фото в том же порядке.
    const menu = (await api().get('/api/menu').expect(200))
      .body as MenuCategoryDto[];
    const publicItem = menu
      .flatMap((group) => group.items)
      .find((menuItem) => menuItem.id === item.id);
    expect(publicItem?.photos.map((photo) => photo.id)).toEqual(
      updated.photos.map((photo) => photo.id),
    );
  });

  it('порядок: только полный список; первое становится обложкой', async () => {
    const item = await createItem('Фото-капучино');
    const withPhotos = (
      await upload(item.id, [await jpeg(), await jpeg(), await jpeg()]).expect(
        201,
      )
    ).body as ManagedMenuItemDto;
    const ids = withPhotos.photos.map((photo) => photo.id);

    await api()
      .put(`/api/menu/items/${item.id}/photos/order`)
      .set('Cookie', managerCookie)
      .send({ ids: ids.slice(1) })
      .expect(400);

    const reordered = (
      await api()
        .put(`/api/menu/items/${item.id}/photos/order`)
        .set('Cookie', managerCookie)
        .send({ ids: [...ids].reverse() })
        .expect(200)
    ).body as ManagedMenuItemDto;
    expect(reordered.photos.map((photo) => photo.id)).toEqual(
      [...ids].reverse(),
    );
  });

  it('удаление фото убирает и файлы; чужое фото — 404', async () => {
    const item = await createItem('Фото-американо');
    const other = await createItem('Фото-эспрессо');
    const [photo] = (
      (await upload(item.id, [await jpeg()]).expect(201))
        .body as ManagedMenuItemDto
    ).photos;

    await api()
      .delete(`/api/menu/items/${other.id}/photos/${photo.id}`)
      .set('Cookie', managerCookie)
      .expect(404);

    const after = (
      await api()
        .delete(`/api/menu/items/${item.id}/photos/${photo.id}`)
        .set('Cookie', managerCookie)
        .expect(200)
    ).body as ManagedMenuItemDto;
    expect(after.photos).toEqual([]);
    expect(storage.keysOf(item.id)).toEqual([]);
  });

  it('удаление позиции удаляет её файлы', async () => {
    const item = await createItem('Фото-удаляемое');
    await upload(item.id, [await jpeg()]).expect(201);
    expect(storage.keysOf(item.id)).toHaveLength(3);
    await api()
      .delete(`/api/menu/items/${item.id}`)
      .set('Cookie', managerCookie)
      .expect(204);
    expect(storage.keysOf(item.id)).toEqual([]);
  });

  it('лимит 6 фото, не картинка, маленькое — понятные 400', async () => {
    const item = await createItem('Фото-лимит');
    await upload(item.id, [
      await jpeg(),
      await jpeg(),
      await jpeg(),
      await jpeg(),
    ]).expect(201);

    const tooMany = await upload(item.id, [
      await jpeg(),
      await jpeg(),
      await jpeg(),
    ]).expect(400);
    expect(JSON.stringify(tooMany.body)).toContain('можно добавить ещё 2');

    const notImage = await upload(item.id, [Buffer.from('не картинка')]).expect(
      400,
    );
    expect(JSON.stringify(notImage.body)).toContain('не похож на картинку');

    const tiny = await upload(item.id, [await jpeg(100, 100)]).expect(400);
    expect(JSON.stringify(tiny.body)).toContain('слишком маленькое');

    // Отказ по одному файлу не оставляет половину загруженной.
    const mixed = await upload(item.id, [
      await jpeg(),
      Buffer.from('не картинка'),
    ]).expect(400);
    expect(mixed.body).toBeDefined();
    const fresh = (
      await api().get('/api/menu/manage').set('Cookie', managerCookie)
    ).body as ManagedMenuCategoryDto[];
    const current = fresh
      .flatMap((group) => group.items)
      .find((menuItem) => menuItem.id === item.id);
    expect(current?.photos).toHaveLength(4);

    const empty = await api()
      .post(`/api/menu/items/${item.id}/photos`)
      .set('Cookie', managerCookie)
      .expect(400);
    expect(JSON.stringify(empty.body)).toContain('хотя бы одно фото');
  });

  it('несуществующая позиция — 404', async () => {
    await upload(999_999, [await jpeg()]).expect(404);
  });

  it.each<Role>(['client', 'barista'])(
    '%s не может менять фото — 403',
    async (role) => {
      const item = await createItem(`Фото-права-${role}`);
      const cookie = users.cookie(await users.create(role));
      await upload(item.id, [await jpeg()], cookie).expect(403);
      await api()
        .put(`/api/menu/items/${item.id}/photos/order`)
        .set('Cookie', cookie)
        .send({ ids: [1] })
        .expect(403);
      await api()
        .delete(`/api/menu/items/${item.id}/photos/1`)
        .set('Cookie', cookie)
        .expect(403);
    },
  );

  it('без входа — 401', async () => {
    await api().post('/api/menu/items/1/photos').expect(401);
  });
});
