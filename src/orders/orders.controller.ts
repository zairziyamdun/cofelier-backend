import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order-request.dto';
import {
  OrderDto,
  RepeatOrderDto,
  StaffOrderDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Нужно войти' })
@ApiForbiddenResponse({ description: 'Недостаточно прав' })
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('client')
  @ApiOperation({ summary: 'Предзаказ клиента; оплата при получении' })
  @ApiCreatedResponse({ type: OrderDto })
  @ApiBadRequestResponse({ description: 'Ошибка в корзине или времени' })
  @ApiConflictResponse({ description: 'Позиции нет в меню или в наличии' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderDto> {
    return this.ordersService.create(user.id, dto);
  }

  // Только свои заказы: userId — из токена, не из запроса.
  @Get('my')
  @Roles('client')
  @ApiOperation({ summary: 'Мои заказы, последние 20' })
  @ApiOkResponse({ type: [OrderDto] })
  findMine(@CurrentUser() user: AuthUser): Promise<OrderDto[]> {
    return this.ordersService.findMine(user.id);
  }

  @Get('my/repeat')
  @Roles('client')
  @ApiOperation({
    summary:
      'Последний заказ для «Повторить»: строки и можно ли собрать их по текущему меню',
  })
  @ApiOkResponse({ type: RepeatOrderDto })
  repeatLast(@CurrentUser() user: AuthUser): Promise<RepeatOrderDto> {
    return this.ordersService.repeatLast(user.id);
  }

  @Get('queue')
  @Roles('barista', 'manager', 'admin')
  @ApiOperation({ summary: 'Очередь: активные заказы, старые сверху' })
  @ApiOkResponse({ type: [StaffOrderDto] })
  findQueue(): Promise<StaffOrderDto[]> {
    return this.ordersService.findQueue();
  }

  @Patch(':id/status')
  @Roles('barista', 'manager', 'admin')
  @ApiOperation({ summary: 'Сменить статус по допустимому переходу' })
  @ApiOkResponse({ type: StaffOrderDto })
  @ApiNotFoundResponse({ description: 'Заказ не найден' })
  @ApiConflictResponse({
    description: 'Недопустимый переход или заказ уже изменён',
  })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<StaffOrderDto> {
    return this.ordersService.changeStatus(id, dto.status);
  }
}
