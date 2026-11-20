import type { MenuItem } from '../generated/prisma/client';
import { MenuBadge } from '../generated/prisma/enums';

// Сколько дней новая позиция носит метку «Новинка», если менеджер не задал срок.
export const NEW_BADGE_DAYS = 14;
// «Популярно» считается по заказам за это окно, а не за всё время:
// метка должна отражать то, что берут сейчас.
export const POPULAR_WINDOW_DAYS = 30;
export const POPULAR_BADGE_LIMIT = 5;
// Меньше порций за окно — не «популярно», даже если позиция в топе.
export const POPULAR_MIN_QUANTITY = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Все метки, которые видит клиент: две считаются сами, остальные — ручные.
export const MenuItemBadge = {
  popular: 'popular',
  new: 'new',
  ...MenuBadge,
} as const;
export type MenuItemBadge = (typeof MenuItemBadge)[keyof typeof MenuItemBadge];

export type BadgeContext = {
  now: Date;
  popularIds: ReadonlySet<number>;
};

// Порядок меток фиксирован: на карточке первой стоит самая значимая.
const MANUAL_ORDER = Object.values(MenuBadge);

export function computeBadges(
  item: Pick<MenuItem, 'id' | 'badges' | 'newUntil'>,
  context: BadgeContext,
): MenuItemBadge[] {
  const result: MenuItemBadge[] = [];
  if (context.popularIds.has(item.id)) result.push(MenuItemBadge.popular);
  if (item.newUntil && item.newUntil > context.now) {
    result.push(MenuItemBadge.new);
  }
  for (const badge of MANUAL_ORDER) {
    if (item.badges.includes(badge)) result.push(badge);
  }
  return result;
}

export function defaultNewUntil(now: Date): Date {
  return new Date(now.getTime() + NEW_BADGE_DAYS * DAY_MS);
}

export function popularWindowStart(now: Date): Date {
  return new Date(now.getTime() - POPULAR_WINDOW_DAYS * DAY_MS);
}

// Из суммарных порций за окно — id позиций с меткой «Популярно».
export function pickPopularIds(
  rows: ReadonlyArray<{ menuItemId: number; quantity: number }>,
): Set<number> {
  const top = rows
    .filter((row) => row.quantity >= POPULAR_MIN_QUANTITY)
    .sort((a, b) => b.quantity - a.quantity || a.menuItemId - b.menuItemId)
    .slice(0, POPULAR_BADGE_LIMIT);
  return new Set(top.map((row) => row.menuItemId));
}
