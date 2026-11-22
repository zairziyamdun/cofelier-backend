import {
  defaultExtra,
  defaultSelection,
  groupConfigError,
  ModifierGroupRule,
  ModifierSelectionError,
  resolveSelection,
} from './modifier-selection';

const size: ModifierGroupRule = {
  id: 1,
  name: 'Размер',
  kind: 'single',
  required: true,
  maxSelect: null,
  options: [
    { id: 11, name: 'S', priceDelta: 0, isDefault: false, inStopList: false },
    { id: 12, name: 'M', priceDelta: 300, isDefault: true, inStopList: false },
    { id: 13, name: 'L', priceDelta: 500, isDefault: false, inStopList: false },
  ],
};

const milk: ModifierGroupRule = {
  id: 2,
  name: 'Молоко',
  kind: 'single',
  required: false,
  maxSelect: null,
  options: [
    {
      id: 21,
      name: 'Обычное',
      priceDelta: 0,
      isDefault: true,
      inStopList: false,
    },
    {
      id: 22,
      name: 'Овсяное',
      priceDelta: 300,
      isDefault: false,
      inStopList: true,
    },
  ],
};

const syrup: ModifierGroupRule = {
  id: 3,
  name: 'Сироп',
  kind: 'multiple',
  required: false,
  maxSelect: 2,
  options: [
    {
      id: 31,
      name: 'Карамель',
      priceDelta: 200,
      isDefault: false,
      inStopList: false,
    },
    {
      id: 32,
      name: 'Ваниль',
      priceDelta: 200,
      isDefault: false,
      inStopList: false,
    },
    {
      id: 33,
      name: 'Орех',
      priceDelta: 200,
      isDefault: false,
      inStopList: false,
    },
  ],
};

const shot: ModifierGroupRule = {
  id: 4,
  name: 'Доп. шот',
  kind: 'quantity',
  required: false,
  maxSelect: 2,
  options: [
    {
      id: 41,
      name: 'Шот',
      priceDelta: 350,
      isDefault: false,
      inStopList: false,
    },
  ],
};

const groups = [size, milk, syrup, shot];

function expectError(run: () => unknown, text: string, conflict = false): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ModifierSelectionError);
    expect((error as ModifierSelectionError).message).toContain(text);
    expect((error as ModifierSelectionError).conflict).toBe(conflict);
    return;
  }
  throw new Error('ожидалась ошибка выбора');
}

describe('выбор добавок', () => {
  it('считает надбавку и копирует добавки в порядке групп', () => {
    const result = resolveSelection('Раф', groups, [
      { optionId: 41, quantity: 2 },
      { optionId: 13, quantity: 1 },
      { optionId: 31, quantity: 1 },
    ]);
    expect(result.extra).toBe(500 + 200 + 700);
    expect(result.modifiers.map((item) => item.optionName)).toEqual([
      'L',
      'Карамель',
      'Шот',
    ]);
    expect(result.modifiers[2]).toMatchObject({ quantity: 2, priceDelta: 350 });
  });

  it('обязательная группа без выбора — понятная ошибка', () => {
    expectError(() => resolveSelection('Раф', groups, []), 'Выберите «Размер»');
  });

  it('лимиты: один вариант, не больше N, всего не больше N', () => {
    const base = [{ optionId: 12, quantity: 1 }];
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 11, quantity: 1 },
        ]),
      'только один',
    );
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 31, quantity: 1 },
          { optionId: 32, quantity: 1 },
          { optionId: 33, quantity: 1 },
        ]),
      'не больше 2',
    );
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 41, quantity: 3 },
        ]),
      'от 1 до 2',
    );
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 31, quantity: 2 },
        ]),
      'от 1 до 1',
    );
  });

  it('стоп-лист и чужая добавка — конфликт: меню изменилось', () => {
    const base = [{ optionId: 12, quantity: 1 }];
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 22, quantity: 1 },
        ]),
      'Овсяное',
      true,
    );
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 999, quantity: 1 },
        ]),
      'больше нет',
      true,
    );
    expectError(
      () =>
        resolveSelection('Раф', groups, [
          ...base,
          { optionId: 12, quantity: 1 },
        ]),
      'повторяется',
    );
  });

  it('по умолчанию: M и обычное молоко, надбавка 300', () => {
    expect(defaultSelection(groups)).toEqual([
      { optionId: 12, quantity: 1 },
      { optionId: 21, quantity: 1 },
    ]);
    expect(defaultExtra(groups)).toBe(300);
  });

  it('по умолчанию не собрать (обязательная без варианта) — null', () => {
    const noDefault = {
      ...size,
      options: size.options.map((option) => ({ ...option, isDefault: false })),
    };
    expect(defaultExtra([noDefault])).toBeNull();
    expect(defaultExtra([])).toBe(0);
  });

  it('настройки группы, которые нельзя сохранить', () => {
    expect(
      groupConfigError({ kind: 'single', maxSelect: null, defaultsCount: 2 }),
    ).toContain('только один');
    expect(
      groupConfigError({ kind: 'multiple', maxSelect: 1, defaultsCount: 2 }),
    ).toContain('больше');
    expect(
      groupConfigError({ kind: 'quantity', maxSelect: 0, defaultsCount: 0 }),
    ).toContain('от 1');
    expect(
      groupConfigError({ kind: 'multiple', maxSelect: 2, defaultsCount: 1 }),
    ).toBeNull();
  });
});
