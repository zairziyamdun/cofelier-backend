import {
  computeBadges,
  defaultNewUntil,
  NEW_BADGE_DAYS,
  pickPopularIds,
  POPULAR_BADGE_LIMIT,
  POPULAR_MIN_QUANTITY,
} from './menu-badges';

const now = new Date('2026-11-21T12:00:00Z');
const noPopular = { now, popularIds: new Set<number>() };

describe('menu badges', () => {
  it('без меток — пустой список', () => {
    expect(
      computeBadges(
        { id: 1, badges: [], newUntil: null, popularOverride: null },
        noPopular,
      ),
    ).toEqual([]);
  });

  it('«Новинка» — пока срок не истёк', () => {
    const tomorrow = new Date(now.getTime() + 1000);
    const past = new Date(now.getTime() - 1000);
    expect(
      computeBadges(
        { id: 1, badges: [], newUntil: tomorrow, popularOverride: null },
        noPopular,
      ),
    ).toEqual(['new']);
    expect(
      computeBadges(
        { id: 1, badges: [], newUntil: past, popularOverride: null },
        noPopular,
      ),
    ).toEqual([]);
  });

  it('порядок: популярно, новинка, затем ручные в порядке enum', () => {
    const badges = computeBadges(
      {
        id: 7,
        badges: ['decaf', 'seasonal'],
        newUntil: defaultNewUntil(now),
        popularOverride: null,
      },
      { now, popularIds: new Set([7]) },
    );
    expect(badges).toEqual(['popular', 'new', 'seasonal', 'decaf']);
  });

  it('«Популярно» вручную важнее подсчёта по заказам', () => {
    const base = { id: 3, badges: [], newUntil: null };
    const counted = { now, popularIds: new Set([3]) };
    expect(computeBadges({ ...base, popularOverride: false }, counted)).toEqual(
      [],
    );
    expect(
      computeBadges({ ...base, popularOverride: true }, noPopular),
    ).toEqual(['popular']);
    expect(computeBadges({ ...base, popularOverride: null }, counted)).toEqual([
      'popular',
    ]);
  });

  it('срок новинки по умолчанию — NEW_BADGE_DAYS дней', () => {
    const days =
      (defaultNewUntil(now).getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(NEW_BADGE_DAYS);
  });

  it('популярные — топ по порциям, не меньше порога', () => {
    const rows = [
      { menuItemId: 1, quantity: POPULAR_MIN_QUANTITY - 1 },
      { menuItemId: 2, quantity: 10 },
      { menuItemId: 3, quantity: POPULAR_MIN_QUANTITY },
    ];
    expect([...pickPopularIds(rows)]).toEqual([2, 3]);
  });

  it('популярных не больше лимита; при равенстве — меньший id', () => {
    const rows = Array.from({ length: POPULAR_BADGE_LIMIT + 2 }, (_, i) => ({
      menuItemId: POPULAR_BADGE_LIMIT + 2 - i,
      quantity: 5,
    }));
    const ids = [...pickPopularIds(rows)];
    expect(ids).toHaveLength(POPULAR_BADGE_LIMIT);
    expect(ids[0]).toBe(1);
  });
});
