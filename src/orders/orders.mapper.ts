import type { Order, OrderItem, User } from '../generated/prisma/client';
import {
  OrderDto,
  OrderItemDto,
  StaffOrderDto,
} from './dto/order-response.dto';

export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderWithCustomer = OrderWithItems & { user: Pick<User, 'name'> };

function toOrderItemDto(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  };
}

export function toOrderDto(order: OrderWithItems): OrderDto {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    comment: order.comment,
    pickupAt: order.pickupAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map(toOrderItemDto),
  };
}

export function toStaffOrderDto(order: OrderWithCustomer): StaffOrderDto {
  return { ...toOrderDto(order), customerName: order.user.name };
}
