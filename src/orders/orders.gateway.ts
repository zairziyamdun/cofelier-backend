import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
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

type SocketUser = { id: number; role: Role };

// События (BACKEND.md §5):
//   order.created — персоналу, новый заказ (StaffOrderDto);
//   order.updated — персоналу StaffOrderDto, клиенту-владельцу OrderDto.
// CORS и cookie — в SocketIoAdapter (main.ts).
@WebSocketGateway({ namespace: '/orders' })
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private readonly server?: Namespace;
  private readonly logger = new Logger(OrdersGateway.name);

  constructor(private readonly authService: AuthService) {}

  // Проверка входа — в middleware до подключения: без действующего токена
  // клиент получает connect_error, а не «connect» и сразу разрыв, и сам
  // решает, когда повторить.
  afterInit(server: Namespace): void {
    server.use((client, next) => {
      void this.authenticate(client).then(
        (user) => {
          if (!user) return next(new Error('unauthorized'));
          (client.data as { user?: SocketUser }).user = user;
          next();
        },
        (error: unknown) => {
          this.logger.error(error, 'socket auth failed');
          next(new Error('unauthorized'));
        },
      );
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const { user } = client.data as { user?: SocketUser };
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

  // Токен из handshake.auth (сайт на другом домене) или cookie (тот же домен).
  private async authenticate(client: Socket): Promise<SocketUser | null> {
    const handshakeToken: unknown = (
      client.handshake.auth as { token?: unknown }
    ).token;
    const token =
      typeof handshakeToken === 'string'
        ? handshakeToken
        : readAccessToken(client.handshake.headers.cookie);
    return token ? this.authService.userFromToken(token) : null;
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
