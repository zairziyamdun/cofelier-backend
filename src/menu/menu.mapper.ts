import type {
  MenuCategory,
  MenuItem,
  MenuItemPhoto,
} from '../generated/prisma/client';
import {
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
} from './dto/menu-manage.dto';
import {
  MenuCategoryDto,
  MenuItemDto,
  MenuPhotoDto,
} from './dto/menu-response.dto';
import { BadgeContext, computeBadges, isAutoPopular } from './menu-badges';
import { photoFileKey } from './menu-photo-processing';
import {
  ItemGroupLink,
  toGroupRule,
  toModifierGroupDto,
  withModifierGroups,
} from './menu-modifiers.mapper';
import { defaultExtra } from './modifier-selection';

// Всё, что нужно маппингу сверх строки БД: метки и адреса файлов фото.
export type MenuDtoContext = BadgeContext & {
  photoUrl: (fileKey: string) => string;
};

export type MenuItemDetails = MenuItem & {
  photos: MenuItemPhoto[];
  modifierGroups: ItemGroupLink[];
};

// Фото всегда читаются в этом порядке: первое — обложка.
export const photoOrder = [
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];
// Всё, что нужно для ответа о позиции: фото и группы добавок.
export const withItemDetails = {
  photos: { orderBy: photoOrder },
  ...withModifierGroups,
};

export function toMenuPhotoDto(
  photo: MenuItemPhoto,
  context: Pick<MenuDtoContext, 'photoUrl'>,
): MenuPhotoDto {
  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    hasAlpha: photo.hasAlpha,
    urls: {
      small: context.photoUrl(photoFileKey(photo.key, 320)),
      medium: context.photoUrl(photoFileKey(photo.key, 800)),
      large: context.photoUrl(photoFileKey(photo.key, 1600)),
    },
  };
}

export function toMenuItemDto(
  item: MenuItemDetails,
  context: MenuDtoContext,
): MenuItemDto {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    portion: item.portion,
    price: item.price,
    photos: item.photos.map((photo) => toMenuPhotoDto(photo, context)),
    isAvailable: !item.inStopList,
    modifierGroups: item.modifierGroups.map((link) =>
      toModifierGroupDto(link.group),
    ),
    defaultPrice: priceWithDefaults(item),
    badges: computeBadges(item, context),
  };
}

export function toMenuCategoryDto(
  category: MenuCategory & { items: MenuItemDetails[] },
  context: MenuDtoContext,
): MenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map((item) => toMenuItemDto(item, context)),
  };
}

export function toManagedMenuItemDto(
  item: MenuItemDetails,
  context: MenuDtoContext,
): ManagedMenuItemDto {
  return {
    ...toMenuItemDto(item, context),
    categoryId: item.categoryId,
    inStopList: item.inStopList,
    manualBadges: item.badges,
    newUntil: item.newUntil?.toISOString() ?? null,
    popularOverride: item.popularOverride,
    autoPopular: isAutoPopular(item, context),
  };
}

export function toManagedMenuCategoryDto(
  category: MenuCategory & { items: MenuItemDetails[] },
  context: MenuDtoContext,
): ManagedMenuCategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    items: category.items.map((item) => toManagedMenuItemDto(item, context)),
  };
}

// Цена с добавками по умолчанию; null — по умолчанию не собрать.
function priceWithDefaults(item: MenuItemDetails): number | null {
  const extra = defaultExtra(
    item.modifierGroups.map((link) => toGroupRule(link.group)),
  );
  return extra === null ? null : item.price + extra;
}
