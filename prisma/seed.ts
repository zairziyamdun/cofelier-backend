// Сиды для локальной разработки: меню с примерными ценами в тенге.
// Первого админа создаёт API при старте из ADMIN_EMAIL/ADMIN_PASSWORD
// (src/users/admin-bootstrap.service.ts), не сиды.
// Повторный запуск обновляет записи по slug категории и названию позиции, не дублируя их.
// Фото демо-позиций — рендеры из prisma/seed-photos; грузятся, только если задано
// хранилище (S3_*) и у позиции ещё нет фото.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaClient } from '../src/generated/prisma/client';
import type { MenuBadge } from '../src/generated/prisma/enums';
import { photoFileKey, processPhoto } from '../src/menu/menu-photo-processing';
import { slugify } from '../src/menu/slug';
import { S3Storage, s3ConfigFromEnv } from '../src/storage/s3-storage';

type SeedItem = {
  name: string;
  description?: string;
  portion?: string;
  price: number;
  inStopList?: boolean;
  badges?: MenuBadge[];
  // true — «Новинка» на 14 дней от запуска сидов, чтобы метку было видно локально.
  isNew?: boolean;
};

const NEW_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Название позиции → рендер в prisma/seed-photos.
const SEED_PHOTOS: Record<string, string> = {
  Эспрессо: 'drink-espresso.webp',
  Американо: 'drink-americano.webp',
  Капучино: 'drink-cappuccino.webp',
  'Флэт уайт': 'drink-flatwhite.webp',
  Латте: 'drink-latte.webp',
  Раф: 'drink-raf.webp',
  'Воронка V60': 'drink-v60.webp',
  Аэропресс: 'drink-aeropress.webp',
  'Колд брю': 'drink-coldbrew.webp',
  'Медный латте': 'drink-copper.webp',
  'Апельсиновый тоник': 'drink-tonic.webp',
  'Матча латте': 'drink-matcha.webp',
  Какао: 'drink-cocoa.webp',
};

async function seedPhoto(
  prisma: PrismaClient,
  storage: S3Storage,
  itemId: number,
  file: string,
): Promise<void> {
  const hasPhotos = await prisma.menuItemPhoto.count({
    where: { menuItemId: itemId },
  });
  if (hasPhotos > 0) return;
  const photo = await processPhoto(
    await readFile(join(__dirname, 'seed-photos', file)),
  );
  const key = `menu/${itemId}/${randomUUID()}`;
  for (const variant of photo.variants) {
    await storage.put(
      photoFileKey(key, variant.width),
      variant.body,
      'image/webp',
    );
  }
  await prisma.menuItemPhoto.create({
    data: {
      menuItemId: itemId,
      key,
      width: photo.width,
      height: photo.height,
      hasAlpha: photo.hasAlpha,
    },
  });
}

type SeedCategory = {
  slug: string;
  name: string;
  items: SeedItem[];
};

const menu: SeedCategory[] = [
  {
    slug: 'espresso',
    name: 'Эспрессо и классика',
    items: [
      {
        name: 'Эспрессо',
        description: 'Наша обжарка недели, плотный и сладкий',
        portion: '40 мл',
        price: 900,
      },
      {
        name: 'Американо',
        description: 'Эспрессо и горячая вода',
        portion: '250 мл',
        price: 1100,
      },
      {
        name: 'Капучино',
        description: 'Эспрессо, молоко и шелковистая пенка',
        portion: '300 мл',
        price: 1500,
      },
      {
        name: 'Флэт уайт',
        description: 'Двойной эспрессо и тонкий слой молока',
        portion: '220 мл',
        price: 1600,
      },
      {
        name: 'Латте',
        description: 'Мягкий кофе с большим количеством молока',
        portion: '350 мл',
        price: 1600,
      },
      {
        name: 'Раф',
        description: 'Эспрессо, сливки и ванильный сахар',
        portion: '300 мл',
        price: 1900,
      },
    ],
  },
  {
    slug: 'brew',
    name: 'Альтернатива',
    items: [
      {
        name: 'Воронка V60',
        description: 'Зерно на выбор бариста, чистый и яркий вкус',
        portion: '300 мл',
        price: 1800,
      },
      {
        name: 'Аэропресс',
        description: 'Насыщенный фильтр с телом',
        portion: '250 мл',
        price: 1700,
      },
      {
        name: 'Колд брю',
        description: 'Настаиваем 16 часов, подаём со льдом',
        portion: '350 мл',
        price: 1900,
        inStopList: true,
      },
    ],
  },
  {
    slug: 'signature',
    name: 'Авторские напитки',
    items: [
      {
        name: 'Медный латте',
        description: 'Латте с карамелью, морской солью и корицей',
        portion: '350 мл',
        price: 2200,
        badges: ['signature'],
      },
      {
        name: 'Апельсиновый тоник',
        description: 'Эспрессо, тоник и свежий апельсиновый сок',
        portion: '350 мл',
        price: 2100,
        badges: ['seasonal'],
        isNew: true,
      },
    ],
  },
  {
    slug: 'tea',
    name: 'Чай и не кофе',
    items: [
      {
        name: 'Матча латте',
        portion: '350 мл',
        price: 1900,
      },
      {
        name: 'Какао',
        description: 'Бельгийский шоколад и молоко',
        portion: '300 мл',
        price: 1600,
        badges: ['decaf'],
      },
      {
        name: 'Чай в чайнике',
        description: 'Чёрный, зелёный или травяной',
        portion: '500 мл',
        price: 1400,
      },
    ],
  },
  {
    slug: 'desserts',
    name: 'Десерты',
    items: [
      {
        name: 'Круассан',
        description: 'Сливочное масло, свежая выпечка каждое утро',
        portion: '80 г',
        price: 1200,
      },
      {
        name: 'Чизкейк',
        description: 'Классический нью-йорк',
        portion: '130 г',
        price: 2000,
      },
      {
        name: 'Шоколадное печенье',
        portion: '60 г',
        price: 700,
      },
    ],
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const s3Config = s3ConfigFromEnv(process.env);
  const storage = s3Config ? new S3Storage(s3Config) : null;
  if (storage) await storage.ensurePublicBucket();
  else process.stdout.write('Сиды: хранилище не задано (S3_*) — без фото\n');

  try {
    for (const [categoryIndex, category] of menu.entries()) {
      const saved = await prisma.menuCategory.upsert({
        where: { slug: category.slug },
        update: { name: category.name, sortOrder: categoryIndex },
        create: {
          slug: category.slug,
          name: category.name,
          sortOrder: categoryIndex,
        },
      });

      for (const [itemIndex, item] of category.items.entries()) {
        const data = {
          slug: slugify(item.name, 'item'),
          description: item.description ?? null,
          portion: item.portion ?? null,
          price: item.price,
          inStopList: item.inStopList ?? false,
          badges: item.badges ?? [],
          newUntil: item.isNew ? new Date(Date.now() + NEW_DAYS_MS) : null,
          sortOrder: itemIndex,
        };
        const existing = await prisma.menuItem.findFirst({
          where: { categoryId: saved.id, name: item.name },
          select: { id: true },
        });
        const itemId = existing
          ? (await prisma.menuItem.update({ where: { id: existing.id }, data }))
              .id
          : (
              await prisma.menuItem.create({
                data: { ...data, name: item.name, categoryId: saved.id },
              })
            ).id;
        const photoFile = SEED_PHOTOS[item.name];
        if (storage && photoFile) {
          await seedPhoto(prisma, storage, itemId, photoFile);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Сиды не применились: ${String(error)}\n`);
  process.exit(1);
});
