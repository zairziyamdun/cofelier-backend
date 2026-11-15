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
import { toManagedMenuCategoryDto, toManagedMenuItemDto } from './menu.mapper';
import { slugify } from './slug';

const orderBySort = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

// Правка меню для менеджера и админа. Публичное чтение — MenuService.
@Injectable()
export class MenuAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // В отличие от публичного меню — и пустые категории, и позиции в стоп-листе.
  async getManagedMenu(): Promise<ManagedMenuCategoryDto[]> {
    const categories = await this.prisma.menuCategory.findMany({
      orderBy: orderBySort,
      include: { items: { orderBy: orderBySort } },
    });
    return categories.map(toManagedMenuCategoryDto);
  }

  // ── Позиции ────────────────────────────────────────────────────────

  async createItem(dto: CreateMenuItemDto): Promise<ManagedMenuItemDto> {
    await this.assertCategoryExists(dto.categoryId);
    const last = await this.prisma.menuItem.findFirst({
      where: { categoryId: dto.categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const item = await this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        portion: dto.portion ?? null,
        price: dto.price,
        // Новая позиция — в конец своей категории.
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return toManagedMenuItemDto(item);
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
      },
    });
    return toManagedMenuItemDto(item);
  }

  async setStopList(
    id: number,
    inStopList: boolean,
  ): Promise<ManagedMenuItemDto> {
    await this.findItemOrThrow(id);
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { inStopList },
    });
    return toManagedMenuItemDto(item);
  }

  async deleteItem(id: number): Promise<void> {
    await this.findItemOrThrow(id);
    await this.prisma.menuItem.delete({ where: { id } });
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
      include: { items: true },
    });
    return toManagedMenuCategoryDto(category);
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
      include: { items: { orderBy: orderBySort } },
    });
    return toManagedMenuCategoryDto(category);
  }

  async deleteCategory(id: number): Promise<void> {
    await this.assertCategoryExists(id);
    const itemsCount = await this.prisma.menuItem.count({
      where: { categoryId: id },
    });
    if (itemsCount > 0) {
      throw new ConflictException(
        'В категории есть позиции: сначала удалите или перенесите их',
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

  private async findItemOrThrow(id: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Позиция не найдена');
    return item;
  }

  private async assertCategoryExists(id: number): Promise<void> {
    const count = await this.prisma.menuCategory.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Категория не найдена');
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const taken = await this.prisma.menuCategory.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const takenSet = new Set(taken.map((category) => category.slug));
    if (!takenSet.has(base)) return base;
    let suffix = 2;
    while (takenSet.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }
}
