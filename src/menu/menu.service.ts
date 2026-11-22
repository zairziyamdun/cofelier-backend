import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';
import { pickPopularIds, popularWindowStart } from './menu-badges';
import {
  MenuDtoContext,
  toMenuCategoryDto,
  toMenuItemDto,
  withItemDetails,
} from './menu.mapper';
import { toGroupRule, withModifierGroups } from './menu-modifiers.mapper';
import {
  ModifierSelectionError,
  ResolvedModifier,
  resolveSelection,
  SelectedModifier,
} from './modifier-selection';

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
            include: withItemDetails,
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
        include: withItemDetails,
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

  // Строки заказа по актуальному меню: позиция есть и не в стоп-листе, выбор
  // добавок верный, цена за штуку — из меню с надбавками (не из запроса).
  // Меню изменилось — 409 (обновить корзину), неверный выбор — 400.
  async resolveOrderLines(
    lines: OrderLineInput[],
  ): Promise<ResolvedOrderLine[]> {
    const items = await this.prisma.menuItem.findMany({
      where: {
        id: { in: [...new Set(lines.map((line) => line.menuItemId))] },
        isArchived: false,
      },
      include: withModifierGroups,
    });
    const byId = new Map(items.map((item) => [item.id, item]));

    return lines.map((line) => {
      const item = byId.get(line.menuItemId);
      if (!item) {
        throw new ConflictException(
          'Одной из позиций больше нет в меню — обновите корзину',
        );
      }
      if (item.inStopList) {
        throw new ConflictException(
          `«${item.name}» сейчас нет в наличии — уберите из корзины`,
        );
      }
      try {
        const { modifiers, extra } = resolveSelection(
          item.name,
          item.modifierGroups.map((link) => toGroupRule(link.group)),
          line.modifiers,
        );
        return {
          menuItemId: item.id,
          name: item.name,
          price: item.price + extra,
          quantity: line.quantity,
          modifiers,
        };
      } catch (error) {
        if (!(error instanceof ModifierSelectionError)) throw error;
        throw error.conflict
          ? new ConflictException(error.message)
          : new BadRequestException(error.message);
      }
    });
  }
}

export type OrderLineInput = {
  menuItemId: number;
  quantity: number;
  modifiers: SelectedModifier[];
};

export type ResolvedOrderLine = {
  menuItemId: number;
  name: string;
  // За штуку вместе с добавками.
  price: number;
  quantity: number;
  modifiers: ResolvedModifier[];
};
