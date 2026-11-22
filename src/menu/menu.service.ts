import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';
import { pickPopularIds, popularWindowStart } from './menu-badges';
import {
  MenuDtoContext,
  toMenuCategoryDto,
  toMenuItemDto,
  withPhotos,
} from './menu.mapper';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Публичное меню: категории и позиции по порядку; пустые категории и архив не показываем.
  async getPublicMenu(): Promise<MenuCategoryDto[]> {
    const [categories, context] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where: { items: { some: { isArchived: false } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          items: {
            where: { isArchived: false },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: withPhotos,
          },
        },
      }),
      this.getDtoContext(),
    ]);
    return categories.map((category) => toMenuCategoryDto(category, context));
  }

  // Витрина главной: сначала «Популярно» от менеджера, затем чаще всего
  // попадавшие в заказы; снятые менеджером вручную не показываем. Стоп-лист не
  // показываем — нельзя звать заказать то, чего нет; при равенстве (и пока
  // заказов нет) решает порядок меню.
  async getPopular(limit: number): Promise<MenuItemDto[]> {
    const [items, context] = await Promise.all([
      this.prisma.menuItem.findMany({
        where: {
          isArchived: false,
          inStopList: false,
          // Явный OR: NOT по nullable-колонке в SQL выкинул бы и «авто» (NULL).
          OR: [{ popularOverride: null }, { popularOverride: true }],
        },
        orderBy: [
          { popularOverride: { sort: 'desc', nulls: 'last' } },
          { orderItems: { _count: 'desc' } },
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
        include: withPhotos,
      }),
      this.getDtoContext(),
    ]);
    return items.map((item) => toMenuItemDto(item, context));
  }

  // Что нужно маппингу: порции за окно без отменённых заказов (метки «Популярно»
  // и «Новинка») и адреса фото. Считается на каждый запрос — позиций и заказов немного.
  async getDtoContext(now = new Date()): Promise<MenuDtoContext> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          createdAt: { gte: popularWindowStart(now) },
          status: { not: 'cancelled' },
        },
      },
      _sum: { quantity: true },
    });
    const popularIds = pickPopularIds(
      rows.map((row) => ({
        menuItemId: row.menuItemId,
        quantity: row._sum.quantity ?? 0,
      })),
    );
    return {
      now,
      popularIds,
      photoUrl: (fileKey) => this.storage.publicUrl(fileKey),
    };
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
