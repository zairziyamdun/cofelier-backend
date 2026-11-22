import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { ModifierGroupKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ManagedMenuItemDto } from './dto/menu-manage.dto';
import {
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  ManagedModifierGroupDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
} from './dto/menu-modifiers.dto';
import {
  toManagedModifierGroupDto,
  withOptions,
} from './menu-modifiers.mapper';
import { toManagedMenuItemDto, withItemDetails } from './menu.mapper';
import { MenuService } from './menu.service';
import { groupConfigError } from './modifier-selection';

const groupInclude = {
  ...withOptions,
  items: { select: { menuItemId: true } },
};

// Группы добавок и их варианты для менеджера. Группа заводится один раз и
// подключается к товарам; варианты правятся по одному, их id не меняются —
// корзины гостей с этими вариантами остаются верными.
@Injectable()
export class MenuModifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
  ) {}

  async list(): Promise<ManagedModifierGroupDto[]> {
    const groups = await this.prisma.modifierGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: groupInclude,
    });
    return groups.map(toManagedModifierGroupDto);
  }

  async createGroup(
    dto: CreateModifierGroupDto,
  ): Promise<ManagedModifierGroupDto> {
    const options = dto.options ?? [];
    this.assertConfig(
      dto.kind,
      dto.maxSelect ?? null,
      options.filter((option) => option.isDefault).length,
    );
    const last = await this.prisma.modifierGroup.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const group = await this.prisma.modifierGroup.create({
      data: {
        name: dto.name,
        kind: dto.kind,
        required: dto.required ?? false,
        maxSelect: this.normalizeMax(dto.kind, dto.maxSelect ?? null),
        sortOrder: (last?.sortOrder ?? -1) + 1,
        options: {
          create: options.map((option, index) => ({
            ...this.optionData(option),
            sortOrder: index,
          })),
        },
      },
      include: groupInclude,
    });
    return toManagedModifierGroupDto(group);
  }

  async updateGroup(
    id: number,
    dto: UpdateModifierGroupDto,
  ): Promise<ManagedModifierGroupDto> {
    const current = await this.findGroupOrThrow(id);
    const kind = dto.kind ?? current.kind;
    const maxSelect =
      dto.maxSelect === undefined ? current.maxSelect : dto.maxSelect;
    this.assertConfig(
      kind,
      maxSelect,
      current.options.filter((option) => option.isDefault).length,
    );
    const group = await this.prisma.modifierGroup.update({
      where: { id },
      data: {
        name: dto.name,
        kind: dto.kind,
        required: dto.required,
        maxSelect:
          dto.kind === undefined && dto.maxSelect === undefined
            ? undefined
            : this.normalizeMax(kind, maxSelect),
      },
      include: groupInclude,
    });
    return toManagedModifierGroupDto(group);
  }

  // Старые заказы хранят копии названий и цен — группу можно удалить смело.
  async deleteGroup(id: number): Promise<void> {
    await this.findGroupOrThrow(id);
    await this.prisma.modifierGroup.delete({ where: { id } });
  }

  async addOption(
    groupId: number,
    dto: CreateModifierOptionDto,
  ): Promise<ManagedModifierGroupDto> {
    const group = await this.findGroupOrThrow(groupId);
    const defaults =
      group.options.filter((option) => option.isDefault).length +
      (dto.isDefault ? 1 : 0);
    this.assertConfig(group.kind, group.maxSelect, defaults);
    const last = group.options.at(-1);
    await this.prisma.modifierOption.create({
      data: {
        ...this.optionData(dto),
        groupId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return this.managedGroup(groupId);
  }

  async updateOption(
    id: number,
    dto: UpdateModifierOptionDto,
  ): Promise<ManagedModifierGroupDto> {
    const option = await this.prisma.modifierOption.findUnique({
      where: { id },
    });
    if (!option) throw new NotFoundException('Вариант не найден');
    if (dto.isDefault !== undefined && dto.isDefault !== option.isDefault) {
      const group = await this.findGroupOrThrow(option.groupId);
      const defaults =
        group.options.filter((item) => item.isDefault).length +
        (dto.isDefault ? 1 : -1);
      this.assertConfig(group.kind, group.maxSelect, defaults);
    }
    await this.prisma.modifierOption.update({
      where: { id },
      data: {
        name: dto.name,
        priceDelta: dto.priceDelta,
        isDefault: dto.isDefault,
        note: dto.note,
        inStopList: dto.inStopList,
      },
    });
    return this.managedGroup(option.groupId);
  }

  async deleteOption(id: number): Promise<ManagedModifierGroupDto> {
    const option = await this.prisma.modifierOption.findUnique({
      where: { id },
      select: { groupId: true },
    });
    if (!option) throw new NotFoundException('Вариант не найден');
    await this.prisma.modifierOption.delete({ where: { id } });
    return this.managedGroup(option.groupId);
  }

  // Набор групп у товара целиком: порядок списка — порядок в шторке.
  async setItemGroups(
    itemId: number,
    groupIds: number[],
  ): Promise<ManagedMenuItemDto> {
    const item = await this.prisma.menuItem.count({
      where: { id: itemId, isArchived: false },
    });
    if (item === 0) throw new NotFoundException('Позиция не найдена');
    const found = await this.prisma.modifierGroup.count({
      where: { id: { in: groupIds } },
    });
    if (found !== groupIds.length) {
      throw new NotFoundException('Одной из групп добавок нет');
    }
    await this.prisma.$transaction([
      this.prisma.menuItemModifierGroup.deleteMany({
        where: { menuItemId: itemId },
      }),
      this.prisma.menuItemModifierGroup.createMany({
        data: groupIds.map((groupId, index) => ({
          menuItemId: itemId,
          groupId,
          sortOrder: index,
        })),
      }),
    ]);
    const [updated, context] = await Promise.all([
      this.prisma.menuItem.findUniqueOrThrow({
        where: { id: itemId },
        include: withItemDetails,
      }),
      this.menuService.getDtoContext(),
    ]);
    return toManagedMenuItemDto(updated, context);
  }

  // ── Вспомогательное ────────────────────────────────────────────────

  private optionData(option: CreateModifierOptionDto) {
    return {
      name: option.name,
      priceDelta: option.priceDelta ?? 0,
      isDefault: option.isDefault ?? false,
      note: option.note ?? null,
    };
  }

  // У группы «один вариант» лимит не нужен — не храним, чтобы не путать.
  private normalizeMax(
    kind: ModifierGroupKind,
    maxSelect: number | null,
  ): number | null {
    return kind === 'single' ? null : maxSelect;
  }

  private assertConfig(
    kind: ModifierGroupKind,
    maxSelect: number | null,
    defaultsCount: number,
  ): void {
    const error = groupConfigError({
      kind,
      maxSelect: this.normalizeMax(kind, maxSelect),
      defaultsCount,
    });
    if (error) throw new BadRequestException(error);
  }

  private async findGroupOrThrow(id: number) {
    const group = await this.prisma.modifierGroup.findUnique({
      where: { id },
      include: withOptions,
    });
    if (!group) throw new NotFoundException('Группа добавок не найдена');
    return group;
  }

  private async managedGroup(id: number): Promise<ManagedModifierGroupDto> {
    const group = await this.prisma.modifierGroup.findUniqueOrThrow({
      where: { id },
      include: groupInclude,
    });
    return toManagedModifierGroupDto(group);
  }
}
