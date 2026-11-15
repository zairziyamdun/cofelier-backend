import type { MenuItem } from '../generated/prisma/client';
import { toMenuCategoryDto, toMenuItemDto } from './menu.mapper';

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
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('menu mapper', () => {
  it('позиция в стоп-листе недоступна для заказа', () => {
    expect(toMenuItemDto(makeItem({ inStopList: true })).isAvailable).toBe(
      false,
    );
    expect(toMenuItemDto(makeItem()).isAvailable).toBe(true);
  });

  it('не отдаёт служебные поля', () => {
    const dto = toMenuItemDto(makeItem());
    expect(Object.keys(dto).sort()).toEqual(
      [
        'description',
        'id',
        'imageUrl',
        'isAvailable',
        'name',
        'portion',
        'price',
      ].sort(),
    );
  });

  it('категория несёт свои позиции', () => {
    const dto = toMenuCategoryDto({
      id: 1,
      slug: 'espresso',
      name: 'Эспрессо',
      sortOrder: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      items: [makeItem(), makeItem({ id: 2, name: 'Латте' })],
    });
    expect(dto.items.map((item) => item.name)).toEqual(['Капучино', 'Латте']);
  });
});
