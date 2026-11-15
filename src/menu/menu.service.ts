import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MenuCategoryDto } from './dto/menu-response.dto';
import { toMenuCategoryDto } from './menu.mapper';

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
