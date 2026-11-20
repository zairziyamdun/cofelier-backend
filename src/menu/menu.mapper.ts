import type { MenuCategory, MenuItem } from '../generated/prisma/client';
import {
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
} from './dto/menu-manage.dto';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';
import { BadgeContext, computeBadges } from './menu-badges';

export function toMenuItemDto(
  item: MenuItem,
  context: BadgeContext,
): MenuItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    portion: item.portion,
    price: item.price,
    imageUrl: item.imageUrl,
    isAvailable: !item.inStopList,
    badges: computeBadges(item, context),
  };
}

export function toMenuCategoryDto(
  category: MenuCategory & { items: MenuItem[] },
  context: BadgeContext,
): MenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map((item) => toMenuItemDto(item, context)),
  };
}

export function toManagedMenuItemDto(
  item: MenuItem,
  context: BadgeContext,
): ManagedMenuItemDto {
  return {
    ...toMenuItemDto(item, context),
    categoryId: item.categoryId,
    inStopList: item.inStopList,
    manualBadges: item.badges,
    newUntil: item.newUntil?.toISOString() ?? null,
  };
}

export function toManagedMenuCategoryDto(
  category: MenuCategory & { items: MenuItem[] },
  context: BadgeContext,
): ManagedMenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map((item) => toManagedMenuItemDto(item, context)),
  };
}
