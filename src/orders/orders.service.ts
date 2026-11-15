import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { OrderStatus } from '../generated/prisma/client';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/order-request.dto';
import { OrderDto, StaffOrderDto } from './dto/order-response.dto';
import { ACTIVE_STATUSES, canTransition, statusLabels } from './order-status';
import { OrdersGateway } from './orders.gateway';
import { toOrderDto, toStaffOrderDto } from './orders.mapper';

const MY_ORDERS_LIMIT = 20;
// Время получения: не раньше «сейчас» (с запасом на часы клиента) и не позже суток.
const PICKUP_PAST_TOLERANCE_MS = 5 * 60 * 1000;
const PICKUP_MAX_AHEAD_MS = 24 * 60 * 60 * 1000;

const withItems = { items: { orderBy: { id: 'asc' as const } } };
const withItemsAndCustomer = { ...withItems, user: { select: { name: true } } };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(userId: number, dto: CreateOrderDto): Promise<OrderDto> {
    const pickupAt = this.parsePickupAt(dto.pickupAt);
    const menuItems = await this.menuService.findItemsForOrder(
      dto.items.map((line) => line.menuItemId),
    );
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    // Цены и доступность — только из меню, а не из запроса.
    const lines = dto.items.map((line) => {
      const menuItem = byId.get(line.menuItemId);
      if (!menuItem) {
        throw new ConflictException(
          'Одной из позиций больше нет в меню — обновите корзину',
        );
      }
      if (menuItem.inStopList) {
        throw new ConflictException(
          `«${menuItem.name}» сейчас нет в наличии — уберите из корзины`,
        );
      }
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: line.quantity,
      };
    });
    const total = lines.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );

    // Заказ и его позиции создаются одной операцией (вложенный create атомарен).
    const order = await this.prisma.order.create({
      data: {
        userId,
        total,
        comment: dto.comment ?? null,
        pickupAt,
        items: { create: lines },
      },
      include: withItemsAndCustomer,
    });

    // Событие — после записи в БД: персонал не увидит заказ, которого нет.
    this.gateway.orderCreated(toStaffOrderDto(order));
    return toOrderDto(order);
  }

  async findMine(userId: number): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MY_ORDERS_LIMIT,
      include: withItems,
    });
    return orders.map(toOrderDto);
  }

  // Очередь персонала: активные заказы, старые сверху.
  async findQueue(): Promise<StaffOrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'asc' },
      include: withItemsAndCustomer,
    });
    return orders.map(toStaffOrderDto);
  }

  async changeStatus(id: number, to: OrderStatus): Promise<StaffOrderDto> {
    const current = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new NotFoundException('Заказ не найден');
    if (!canTransition(current.status, to)) {
      throw new ConflictException(
        `Нельзя перевести заказ из «${statusLabels[current.status]}» в «${statusLabels[to]}»`,
      );
    }

    // Условие на прежний статус: два бариста не переведут один заказ дважды.
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: current.status },
      data: { status: to },
    });
    if (count === 0) {
      throw new ConflictException('Заказ уже изменили — обновите очередь');
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: withItemsAndCustomer,
    });
    this.gateway.orderUpdated(toStaffOrderDto(order), order.userId);
    return toStaffOrderDto(order);
  }

  private parsePickupAt(value: string | null | undefined): Date | null {
    if (!value) return null;
    const pickupAt = new Date(value);
    const now = Date.now();
    if (
      pickupAt.getTime() < now - PICKUP_PAST_TOLERANCE_MS ||
      pickupAt.getTime() > now + PICKUP_MAX_AHEAD_MS
    ) {
      throw new BadRequestException(
        'Время получения — от текущего момента до суток вперёд',
      );
    }
    return pickupAt;
  }
}
