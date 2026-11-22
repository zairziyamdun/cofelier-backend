import type { ModifierGroupKind } from '../generated/prisma/enums';

// Правила выбора добавок — одни для заказа (сервер считает цену) и для цены
// «по умолчанию» в меню. Группы и варианты — в порядке показа.
export type ModifierOptionRule = {
  id: number;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  inStopList: boolean;
};

export type ModifierGroupRule = {
  id: number;
  name: string;
  kind: ModifierGroupKind;
  required: boolean;
  maxSelect: number | null;
  options: ModifierOptionRule[];
};

export type SelectedModifier = { optionId: number; quantity: number };

export type ResolvedModifier = {
  groupName: string;
  optionName: string;
  priceDelta: number;
  quantity: number;
  isDefault: boolean;
};

// Количество одной добавки в группе «количеством», если нет своего лимита.
export const MAX_OPTION_QUANTITY = 10;

// conflict — выбор был верным, но меню изменилось (вариант закончился, исчез):
// клиенту нужно обновить корзину. Иначе — ошибка в самом выборе.
export class ModifierSelectionError extends Error {
  constructor(
    message: string,
    readonly conflict = false,
  ) {
    super(message);
    this.name = 'ModifierSelectionError';
  }
}

// Проверить выбор и вернуть копию добавок для заказа и надбавку за штуку.
export function resolveSelection(
  itemName: string,
  groups: ModifierGroupRule[],
  selection: SelectedModifier[],
): { modifiers: ResolvedModifier[]; extra: number } {
  const optionIndex = new Map<
    number,
    { group: ModifierGroupRule; option: ModifierOptionRule }
  >();
  for (const group of groups) {
    for (const option of group.options) {
      optionIndex.set(option.id, { group, option });
    }
  }

  const chosen = new Map<number, number>();
  for (const { optionId, quantity } of selection) {
    if (chosen.has(optionId)) {
      throw new ModifierSelectionError(
        `Добавка повторяется в «${itemName}» — укажите количество`,
      );
    }
    const found = optionIndex.get(optionId);
    if (!found) {
      throw new ModifierSelectionError(
        `Одной из добавок к «${itemName}» больше нет — обновите корзину`,
        true,
      );
    }
    if (found.option.inStopList) {
      throw new ModifierSelectionError(
        `«${found.option.name}» сейчас нет — выберите другое для «${itemName}»`,
        true,
      );
    }
    const max =
      found.group.kind === 'quantity'
        ? (found.group.maxSelect ?? MAX_OPTION_QUANTITY)
        : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      throw new ModifierSelectionError(
        `«${found.option.name}»: можно от 1 до ${max}`,
      );
    }
    chosen.set(optionId, quantity);
  }

  const modifiers: ResolvedModifier[] = [];
  let extra = 0;
  for (const group of groups) {
    const picked = group.options.filter((option) => chosen.has(option.id));
    const total = picked.reduce(
      (sum, option) => sum + (chosen.get(option.id) ?? 0),
      0,
    );
    checkGroupLimits(itemName, group, picked.length, total);
    for (const option of picked) {
      const quantity = chosen.get(option.id) ?? 1;
      modifiers.push({
        groupName: group.name,
        optionName: option.name,
        priceDelta: option.priceDelta,
        quantity,
        isDefault: option.isDefault,
      });
      extra += option.priceDelta * quantity;
    }
  }
  return { modifiers, extra };
}

function checkGroupLimits(
  itemName: string,
  group: ModifierGroupRule,
  pickedCount: number,
  totalQuantity: number,
): void {
  if (group.required && pickedCount === 0) {
    throw new ModifierSelectionError(
      `Выберите «${group.name}» для «${itemName}»`,
    );
  }
  if (group.kind === 'single' && pickedCount > 1) {
    throw new ModifierSelectionError(
      `«${group.name}»: можно выбрать только один вариант`,
    );
  }
  if (
    group.kind === 'multiple' &&
    group.maxSelect !== null &&
    pickedCount > group.maxSelect
  ) {
    throw new ModifierSelectionError(
      `«${group.name}»: не больше ${group.maxSelect}`,
    );
  }
  if (
    group.kind === 'quantity' &&
    group.maxSelect !== null &&
    totalQuantity > group.maxSelect
  ) {
    throw new ModifierSelectionError(
      `«${group.name}»: всего не больше ${group.maxSelect}`,
    );
  }
}

// Выбор по умолчанию — то, что кладёт «+» в меню. Варианты в стоп-листе
// пропускаются; у single — первый вариант по умолчанию.
export function defaultSelection(
  groups: ModifierGroupRule[],
): SelectedModifier[] {
  const result: SelectedModifier[] = [];
  for (const group of groups) {
    const defaults = group.options.filter(
      (option) => option.isDefault && !option.inStopList,
    );
    const take = group.kind === 'single' ? defaults.slice(0, 1) : defaults;
    for (const option of take)
      result.push({ optionId: option.id, quantity: 1 });
  }
  return result;
}

// Надбавка за выбор по умолчанию; null — по умолчанию товар не собрать
// (обязательная группа без варианта): «+» в меню открывает шторку.
export function defaultExtra(groups: ModifierGroupRule[]): number | null {
  try {
    return resolveSelection('', groups, defaultSelection(groups)).extra;
  } catch {
    return null;
  }
}

// Настройки группы, которые нельзя сохранить: иначе товар с ней не собрать.
export function groupConfigError(group: {
  kind: ModifierGroupKind;
  maxSelect: number | null;
  defaultsCount: number;
}): string | null {
  if (group.maxSelect !== null && group.maxSelect < 1) {
    return 'Лимит — от 1';
  }
  if (group.kind === 'single' && group.defaultsCount > 1) {
    return 'В группе «один вариант» по умолчанию может быть только один';
  }
  if (
    group.kind === 'multiple' &&
    group.maxSelect !== null &&
    group.defaultsCount > group.maxSelect
  ) {
    return 'Вариантов по умолчанию больше, чем можно выбрать';
  }
  return null;
}
