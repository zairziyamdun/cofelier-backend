import { ApiProperty } from '@nestjs/swagger';

import { OrderStatus } from '../../generated/prisma/enums';

export class OrderItemModifierDto {
  @ApiProperty({ example: 'Молоко' })
  groupName!: string;

  @ApiProperty({ example: 'Овсяное' })
  optionName!: string;

  @ApiProperty({
    example: 300,
    description: 'Надбавка за штуку на момент заказа',
  })
  priceDelta!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({
    description: 'Был вариантом по умолчанию — бариста выделяет только отличия',
  })
  isDefault!: boolean;
}

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

  @ApiProperty({
    example: 1800,
    description: 'Цена за штуку вместе с добавками, на момент заказа',
  })
  price!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ type: [OrderItemModifierDto] })
  modifiers!: OrderItemModifierDto[];
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

export class RepeatModifierDto {
  @ApiProperty({ example: 21 })
  optionId!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;
}

export class RepeatLineDto {
  @ApiProperty({ example: 3 })
  menuItemId!: number;

  @ApiProperty({
    example: 'Капучино',
    description: 'Название на момент заказа',
  })
  name!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ type: [RepeatModifierDto] })
  modifiers!: RepeatModifierDto[];

  @ApiProperty({
    description:
      'false — так по меню больше не собрать (нет позиции, добавка закончилась…)',
  })
  available!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Почему нельзя повторить — для гостя',
  })
  reason!: string | null;
}

// Последний заказ гостя, разобранный по текущему меню: что можно положить в
// корзину как есть, а что — нет. Цены считает сайт по свежему меню.
export class RepeatOrderDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null — заказов ещё не было',
  })
  orderId!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;

  @ApiProperty({ type: [RepeatLineDto] })
  lines!: RepeatLineDto[];
}

// Заказ для персонала: плюс имя клиента, чтобы позвать его к стойке.
export class StaffOrderDto extends OrderDto {
  @ApiProperty({ example: 'Анна' })
  customerName!: string;
}
