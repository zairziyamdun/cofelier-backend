import type { MenuCategory, MenuItem } from '../generated/prisma/client';
import {
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
} from './dto/menu-manage.dto';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';

export function toMenuItemDto(item: MenuItem): MenuItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    portion: item.portion,
    price: item.price,
    imageUrl: item.imageUrl,
    isAvailable: !item.inStopList,
  };
}

export function toMenuCategoryDto(
  category: MenuCategory & { items: MenuItem[] },
): MenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map(toMenuItemDto),
  };
}

export function toManagedMenuItemDto(item: MenuItem): ManagedMenuItemDto {
  return {
    ...toMenuItemDto(item),
    categoryId: item.categoryId,
    inStopList: item.inStopList,
  };
}

export function toManagedMenuCategoryDto(
  category: MenuCategory & { items: MenuItem[] },
): ManagedMenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map(toManagedMenuItemDto),
  };
}
