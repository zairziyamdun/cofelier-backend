import { canTransition, nextStatuses } from './order-status';

describe('переходы статусов заказа', () => {
  it('заказ идёт вперёд по шагам', () => {
    expect(canTransition('new', 'accepted')).toBe(true);
    expect(canTransition('accepted', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('шаги нельзя перепрыгнуть и нельзя вернуться назад', () => {
    expect(canTransition('new', 'ready')).toBe(false);
    expect(canTransition('accepted', 'completed')).toBe(false);
    expect(canTransition('ready', 'preparing')).toBe(false);
  });

  it('отменить можно только новый или принятый заказ', () => {
    expect(canTransition('new', 'cancelled')).toBe(true);
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(false);
    expect(canTransition('ready', 'cancelled')).toBe(false);
  });

  it('выданный и отменённый заказ — конечные', () => {
    expect(nextStatuses('completed')).toEqual([]);
    expect(nextStatuses('cancelled')).toEqual([]);
  });
});
