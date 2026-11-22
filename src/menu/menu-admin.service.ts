import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
} from './dto/menu-manage.dto';
import { defaultNewUntil } from './menu-badges';
import { MenuPhotosService } from './menu-photos.service';
import {
  MenuItemDetails,
  toManagedMenuCategoryDto,
  toManagedMenuItemDto,
  withItemDetails,
} from './menu.mapper';
import { MenuService } from './menu.service';
import { pickFreeSlug, slugify } from './slug';

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

const orderBySort = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

// Правка меню для менеджера и админа. Публичное чтение — MenuService.
@Injectable()
export class MenuAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly photos: MenuPhotosService,
  ) {}

  // В отличие от публичного меню — и пустые категории, и позиции в стоп-листе.
  async getManagedMenu(): Promise<ManagedMenuCategoryDto[]> {
    const categories = await this.prisma.menuCategory.findMany({
      orderBy: orderBySort,
      include: {
        items: {
          where: { isArchived: false },
          orderBy: orderBySort,
          include: withItemDetails,
        },
      },
    });
    const context = await this.menuService.getDtoContext();
    return categories.map((category) =>
      toManagedMenuCategoryDto(category, context),
    );
  }

  // ── Позиции ────────────────────────────────────────────────────────

  async createItem(dto: CreateMenuItemDto): Promise<ManagedMenuItemDto> {
    await this.assertCategoryExists(dto.categoryId);
    const last = await this.prisma.menuItem.findFirst({
      where: { categoryId: dto.categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const now = new Date();
    const item = await this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        slug: await this.uniqueItemSlug(dto.name),
        description: dto.description ?? null,
        portion: dto.portion ?? null,
        price: dto.price,
        badges: dto.manualBadges ?? [],
        popularOverride: dto.popularOverride ?? null,
        // Новая позиция — «Новинка» на две недели, если менеджер не решил иначе.
        newUntil:
          dto.newUntil === undefined
            ? defaultNewUntil(now)
            : toDateOrNull(dto.newUntil),
        // Новая позиция — в конец своей категории.
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      include: withItemDetails,
    });
    return this.toManagedItem(item);
  }

  async updateItem(
    id: number,
    dto: UpdateMenuItemDto,
  ): Promise<ManagedMenuItemDto> {
    await this.findItemOrThrow(id);
    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
    }
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        portion: dto.portion,
        price: dto.price,
        badges: dto.manualBadges,
        popularOverride: dto.popularOverride,
        newUntil:
          dto.newUntil === undefined ? undefined : toDateOrNull(dto.newUntil),
      },
      include: withItemDetails,
    });
    return this.toManagedItem(item);
  }

  async setStopList(
    id: number,
    inStopList: boolean,
  ): Promise<ManagedMenuItemDto> {
    await this.findItemOrThrow(id);
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { inStopList },
      include: withItemDetails,
    });
    return this.toManagedItem(item);
  }

  // Позиция из прошлых заказов не удаляется, а уходит в архив: история заказов цела.
  // Фото не нужны ни там, ни там — удаляются вместе с файлами.
  async deleteItem(id: number): Promise<void> {
    await this.findItemOrThrow(id);
    const fileKeys = await this.photos.fileKeysOf(id);
    const ordered = await this.prisma.orderItem.count({
      where: { menuItemId: id },
    });
    if (ordered > 0) {
      await this.prisma.$transaction([
        this.prisma.menuItemPhoto.deleteMany({ where: { menuItemId: id } }),
        this.prisma.menuItem.update({
          where: { id },
          data: { isArchived: true, inStopList: false },
        }),
      ]);
    } else {
      await this.prisma.menuItem.delete({ where: { id } });
    }
    await this.photos.deleteFilesQuietly(fileKeys);
  }

  // ── Категории ──────────────────────────────────────────────────────

  async createCategory(
    dto: CreateMenuCategoryDto,
  ): Promise<ManagedMenuCategoryDto> {
    const last = await this.prisma.menuCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const category = await this.prisma.menuCategory.create({
      data: {
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      include: { items: { include: withItemDetails } },
    });
    return toManagedMenuCategoryDto(
      category,
      await this.menuService.getDtoContext(),
    );
  }

  // Slug не меняется при переименовании: старые ссылки на #якорь не ломаются.
  async renameCategory(
    id: number,
    dto: UpdateMenuCategoryDto,
  ): Promise<ManagedMenuCategoryDto> {
    await this.assertCategoryExists(id);
    const category = await this.prisma.menuCategory.update({
      where: { id },
      data: { name: dto.name },
      include: { items: { orderBy: orderBySort, include: withItemDetails } },
    });
    return toManagedMenuCategoryDto(
      category,
      await this.menuService.getDtoContext(),
    );
  }

  async deleteCategory(id: number): Promise<void> {
    await this.assertCategoryExists(id);
    const [active, archived] = await Promise.all([
      this.prisma.menuItem.count({
        where: { categoryId: id, isArchived: false },
      }),
      this.prisma.menuItem.count({
        where: { categoryId: id, isArchived: true },
      }),
    ]);
    if (active > 0) {
      throw new ConflictException(
        'В категории есть позиции: сначала удалите или перенесите их',
      );
    }
    if (archived > 0) {
      throw new ConflictException(
        'В категории остались позиции из прошлых заказов — её нельзя удалить. Пустая категория и так не видна на сайте.',
      );
    }
    await this.prisma.menuCategory.delete({ where: { id } });
  }

  // Порядок задаётся списком всех id сразу — без «дыр» и дублей в sortOrder.
  async reorderCategories(ids: number[]): Promise<ManagedMenuCategoryDto[]> {
    const existing = await this.prisma.menuCategory.findMany({
      select: { id: true },
    });
    const known = new Set(existing.map((category) => category.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'Нужен список всех категорий меню, каждая — один раз',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuCategory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.getManagedMenu();
  }

  // ── Вспомогательное ────────────────────────────────────────────────

  private async toManagedItem(
    item: MenuItemDetails,
  ): Promise<ManagedMenuItemDto> {
    return toManagedMenuItemDto(item, await this.menuService.getDtoContext());
  }

  // Архивная позиция для панели не существует.
  private async findItemOrThrow(id: number) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, isArchived: false },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    return item;
  }

  private async assertCategoryExists(id: number): Promise<void> {
    const count = await this.prisma.menuCategory.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Категория не найдена');
  }

  // Slug позиции — тоже транслит названия; уникален среди всех позиций, включая архив.
  private async uniqueItemSlug(name: string): Promise<string> {
    const base = slugify(name, 'item');
    const taken = await this.prisma.menuItem.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return pickFreeSlug(base, new Set(taken.map((item) => item.slug)));
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const taken = await this.prisma.menuCategory.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return pickFreeSlug(base, new Set(taken.map((category) => category.slug)));
  }
}
