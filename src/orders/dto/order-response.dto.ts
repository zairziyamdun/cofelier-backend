import { ApiProperty } from '@nestjs/swagger';

import { OrderStatus } from '../../generated/prisma/enums';

export class OrderItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 3 })
  menuItemId!: number;

  @ApiProperty({
    example: 'Капучино',
    description: 'Название на момент заказа',
  })
  name!: string;

  @ApiProperty({ example: 1500, description: 'Цена за штуку на момент заказа' })
  price!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;
}

export class OrderDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ example: 3000, description: 'Сумма в целых тенге' })
  total!: number;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null — как можно скорее',
  })
  pickupAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [OrderItemDto] })
  items!: OrderItemDto[];
}

// Заказ для персонала: плюс имя клиента, чтобы позвать его к стойке.
export class StaffOrderDto extends OrderDto {
  @ApiProperty({ example: 'Анна' })
  customerName!: string;
}
