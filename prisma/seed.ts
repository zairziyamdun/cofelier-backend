// Сиды меню: категории и позиции с примерными ценами в тенге.
// Повторный запуск обновляет записи по slug категории и названию позиции, не дублируя их.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

type SeedItem = {
  name: string;
  description?: string;
  portion?: string;
  price: number;
  inStopList?: boolean;
};

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
      },
      {
        name: 'Апельсиновый тоник',
        description: 'Эспрессо, тоник и свежий апельсиновый сок',
        portion: '350 мл',
        price: 2100,
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
          description: item.description ?? null,
          portion: item.portion ?? null,
          price: item.price,
          inStopList: item.inStopList ?? false,
          sortOrder: itemIndex,
        };
        const existing = await prisma.menuItem.findFirst({
          where: { categoryId: saved.id, name: item.name },
          select: { id: true },
        });
        if (existing) {
          await prisma.menuItem.update({ where: { id: existing.id }, data });
        } else {
          await prisma.menuItem.create({
            data: { ...data, name: item.name, categoryId: saved.id },
          });
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
