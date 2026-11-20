import type { MenuItem } from '../generated/prisma/client';
import {
  toManagedMenuItemDto,
  toMenuCategoryDto,
  toMenuItemDto,
} from './menu.mapper';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 1,
    categoryId: 1,
    name: 'Капучино',
    description: null,
    portion: '300 мл',
    price: 1500,
    imageUrl: null,
    inStopList: false,
    isArchived: false,
    badges: [],
    newUntil: null,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

const context = { now: new Date(0), popularIds: new Set<number>() };

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
        'imageUrl',
        'badges',
        'isAvailable',
        'name',
        'portion',
        'price',
      ].sort(),
    );
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
      { now: new Date('2026-11-21T00:00:00Z'), popularIds: new Set([5]) },
    );
    expect(dto.badges).toEqual(['popular', 'new', 'decaf']);
    expect(dto.manualBadges).toEqual(['decaf']);
    expect(dto.newUntil).toBe(until.toISOString());
  });
});
