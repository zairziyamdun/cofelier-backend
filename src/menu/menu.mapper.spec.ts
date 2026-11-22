import type { MenuItemPhoto } from '../generated/prisma/client';
import {
  toManagedMenuItemDto,
  toMenuCategoryDto,
  toMenuItemDto,
  type MenuItemWithPhotos,
} from './menu.mapper';

function makeItem(
  overrides: Partial<MenuItemWithPhotos> = {},
): MenuItemWithPhotos {
  return {
    id: 1,
    categoryId: 1,
    slug: 'kapuchino',
    name: 'Капучино',
    description: null,
    portion: '300 мл',
    price: 1500,
    inStopList: false,
    isArchived: false,
    badges: [],
    newUntil: null,
    popularOverride: null,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    photos: [],
    ...overrides,
  };
}

const context = {
  now: new Date(0),
  popularIds: new Set<number>(),
  photoUrl: (fileKey: string) => `https://cdn.test/${fileKey}`,
};

function makePhoto(overrides: Partial<MenuItemPhoto> = {}): MenuItemPhoto {
  return {
    id: 7,
    menuItemId: 1,
    key: 'menu/1/abc',
    width: 1200,
    height: 1500,
    hasAlpha: false,
    sortOrder: 0,
    createdAt: new Date(0),
    ...overrides,
  };
}

describe('menu mapper', () => {
  it('позиция в стоп-листе недоступна для заказа', () => {
    expect(
      toMenuItemDto(makeItem({ inStopList: true }), context).isAvailable,
    ).toBe(false);
    expect(toMenuItemDto(makeItem(), context).isAvailable).toBe(true);
  });

  it('не отдаёт служебные поля', () => {
    const dto = toMenuItemDto(makeItem(), context);
    expect(Object.keys(dto).sort()).toEqual(
      [
        'description',
        'id',
        'photos',
        'slug',
        'badges',
        'isAvailable',
        'name',
        'portion',
        'price',
      ].sort(),
    );
  });

  it('фото: адреса трёх размеров из ключа, порядок как пришёл', () => {
    const dto = toMenuItemDto(
      makeItem({
        photos: [
          makePhoto(),
          makePhoto({ id: 8, key: 'menu/1/def', hasAlpha: true }),
        ],
      }),
      context,
    );
    expect(dto.photos.map((photo) => photo.id)).toEqual([7, 8]);
    expect(dto.photos[0]).toEqual({
      id: 7,
      width: 1200,
      height: 1500,
      hasAlpha: false,
      urls: {
        small: 'https://cdn.test/menu/1/abc-320.webp',
        medium: 'https://cdn.test/menu/1/abc-800.webp',
        large: 'https://cdn.test/menu/1/abc-1600.webp',
      },
    });
    expect(dto.photos[1].hasAlpha).toBe(true);
  });

  it('категория несёт свои позиции', () => {
    const dto = toMenuCategoryDto(
      {
        id: 1,
        slug: 'espresso',
        name: 'Эспрессо',
        sortOrder: 0,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        items: [makeItem(), makeItem({ id: 2, name: 'Латте' })],
      },
      context,
    );
    expect(dto.items.map((item) => item.name)).toEqual(['Капучино', 'Латте']);
  });

  it('позиция в панели отдаёт ручные метки и срок новинки отдельно', () => {
    const until = new Date('2026-12-01T00:00:00Z');
    const dto = toManagedMenuItemDto(
      makeItem({ id: 5, badges: ['decaf'], newUntil: until }),
      {
        ...context,
        now: new Date('2026-11-21T00:00:00Z'),
        popularIds: new Set([5]),
      },
    );
    expect(dto.badges).toEqual(['popular', 'new', 'decaf']);
    expect(dto.manualBadges).toEqual(['decaf']);
    expect(dto.newUntil).toBe(until.toISOString());
    expect(dto.popularOverride).toBeNull();
    expect(dto.autoPopular).toBe(true);
  });
});
