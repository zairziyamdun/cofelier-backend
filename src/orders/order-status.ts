import type { OrderStatus } from '../generated/prisma/client';

// Допустимые переходы: вперёд по шагам, отмена — пока заказ не начали готовить.
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'new',
  'accepted',
  'preparing',
  'ready',
];

export const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  accepted: 'Принят',
  preparing: 'Готовится',
  ready: 'Готов',
  completed: 'Выдан',
  cancelled: 'Отменён',
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return transitions[from];
}
