import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';
import { toMenuCategoryDto, toMenuItemDto } from './menu.mapper';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // Публичное меню: категории и позиции по порядку; пустые категории и архив не показываем.
  async getPublicMenu(): Promise<MenuCategoryDto[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { items: { some: { isArchived: false } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        items: {
          where: { isArchived: false },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return categories.map(toMenuCategoryDto);
  }

  // Витрина главной: чаще всего попадавшие в заказы позиции. Стоп-лист не
  // показываем — нельзя звать заказать то, чего нет; при равенстве (и пока
  // заказов нет) решает порядок меню.
  async getPopular(limit: number): Promise<MenuItemDto[]> {
    const items = await this.prisma.menuItem.findMany({
      where: { isArchived: false, inStopList: false },
      orderBy: [
        { orderItems: { _count: 'desc' } },
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
    });
    return items.map(toMenuItemDto);
  }

  // Для заказов: актуальные цена и стоп-лист позиций. Архивные не возвращаются.
  findItemsForOrder(ids: number[]): Promise<OrderableMenuItem[]> {
    return this.prisma.menuItem.findMany({
      where: { id: { in: ids }, isArchived: false },
      select: { id: true, name: true, price: true, inStopList: true },
    });
  }
}

export type OrderableMenuItem = {
  id: number;
  name: string;
  price: number;
  inStopList: boolean;
};
