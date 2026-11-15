import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { readAccessToken } from '../auth/auth-cookie';
import { AuthService } from '../auth/auth.service';
import type { Role } from '../generated/prisma/client';
import { OrderDto, StaffOrderDto } from './dto/order-response.dto';

function toClientOrder(order: StaffOrderDto): OrderDto {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    comment: order.comment,
    pickupAt: order.pickupAt,
    createdAt: order.createdAt,
    items: order.items,
  };
}

const STAFF_ROOM = 'staff';
const STAFF_ROLES: Role[] = ['barista', 'manager', 'admin'];
const userRoom = (userId: number) => `user:${userId}`;

// События (BACKEND.md §5):
//   order.created — персоналу, новый заказ (StaffOrderDto);
//   order.updated — персоналу StaffOrderDto, клиенту-владельцу OrderDto.
// CORS и cookie — в SocketIoAdapter (main.ts).
@WebSocketGateway({ namespace: '/orders' })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server?: Namespace;
  private readonly logger = new Logger(OrdersGateway.name);

  constructor(private readonly authService: AuthService) {}

  // Без действующей cookie подключение закрывается: события только своим.
  async handleConnection(client: Socket): Promise<void> {
    // Токен из handshake.auth (сайт на другом домене) или cookie (тот же домен).
    const handshakeToken: unknown = (
      client.handshake.auth as { token?: unknown }
    ).token;
    const token =
      typeof handshakeToken === 'string'
        ? handshakeToken
        : readAccessToken(client.handshake.headers.cookie);
    const user = token ? await this.authService.userFromToken(token) : null;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join(userRoom(user.id));
    if (STAFF_ROLES.includes(user.role)) {
      await client.join(STAFF_ROOM);
    }
    this.logger.debug({ userId: user.id, role: user.role }, 'socket joined');
  }

  orderCreated(order: StaffOrderDto): void {
    this.server?.to(STAFF_ROOM).emit('order.created', order);
  }

  orderUpdated(order: StaffOrderDto, userId: number): void {
    this.server?.to(STAFF_ROOM).emit('order.updated', order);
    // Клиенту — в форме OrderDto, без имени: это его же заказ.
    this.server
      ?.to(userRoom(userId))
      .emit('order.updated', toClientOrder(order));
  }
}
