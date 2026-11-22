import type {
  MenuItemModifierGroup,
  ModifierGroup,
  ModifierOption,
} from '../generated/prisma/client';
import {
  ManagedModifierGroupDto,
  ModifierGroupDto,
} from './dto/menu-modifiers.dto';
import type { ModifierGroupRule } from './modifier-selection';

export type GroupWithOptions = ModifierGroup & { options: ModifierOption[] };
export type ItemGroupLink = MenuItemModifierGroup & {
  group: GroupWithOptions;
};

const byOrder = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];
export const withOptions = { options: { orderBy: byOrder } };
// Группы товара — в порядке, заданном у товара, варианты — в порядке группы.
export const withModifierGroups = {
  modifierGroups: {
    orderBy: [{ sortOrder: 'asc' as const }, { groupId: 'asc' as const }],
    include: { group: { include: withOptions } },
  },
};

export function toGroupRule(group: GroupWithOptions): ModifierGroupRule {
  return {
    id: group.id,
    name: group.name,
    kind: group.kind,
    required: group.required,
    maxSelect: group.maxSelect,
    options: group.options.map((option) => ({
      id: option.id,
      name: option.name,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
      inStopList: option.inStopList,
    })),
  };
}

export function toModifierGroupDto(group: GroupWithOptions): ModifierGroupDto {
  return {
    id: group.id,
    name: group.name,
    kind: group.kind,
    required: group.required,
    maxSelect: group.maxSelect,
    options: group.options.map((option) => ({
      id: option.id,
      name: option.name,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
      isAvailable: !option.inStopList,
      note: option.note,
    })),
  };
}

export function toManagedModifierGroupDto(
  group: GroupWithOptions & { items: { menuItemId: number }[] },
): ManagedModifierGroupDto {
  const base = toModifierGroupDto(group);
  return {
    ...base,
    options: base.options.map((option, index) => ({
      ...option,
      inStopList: group.options[index].inStopList,
    })),
    itemIds: group.items.map((link) => link.menuItemId),
  };
}
