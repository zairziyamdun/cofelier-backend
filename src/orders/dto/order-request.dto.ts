import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { TrimToNull } from '../../common/transforms';
import { OrderStatus } from '../../generated/prisma/enums';

export class OrderLineModifierDto {
  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  optionId!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Для групп «количеством»; по умолчанию 1',
  })
  @IsOptional()
  @IsInt({ message: 'Количество добавки — целое число' })
  @Min(1)
  @Max(20)
  quantity?: number;
}

export class OrderLineDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  menuItemId!: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt({ message: 'Количество — целое число' })
  @Min(1, { message: 'Количество — от 1' })
  @Max(20, { message: 'Не больше 20 штук одной позиции' })
  quantity!: number;

  @ApiPropertyOptional({
    type: [OrderLineModifierDto],
    description: 'Выбранные добавки; не передано — без добавок',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderLineModifierDto)
  modifiers?: OrderLineModifierDto[];
}

// Цен в запросе нет: сумму считает сервер по меню (подменить цену нельзя).
// Одна позиция может прийти несколькими строками — с разными добавками.
export class CreateOrderDto {
  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Корзина пуста' })
  @ArrayMaxSize(30, { message: 'Слишком много позиций в одном заказе' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Без сахара' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Комментарий — до 300 символов' })
  comment?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Когда заберёте; не передано — как можно скорее',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'Неверное время получения' })
  pickupAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Сумма, которую видел гость. Не совпала с расчётом сервера — 409: цены в меню изменились',
    example: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedTotal?: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsEnum(OrderStatus, { message: 'Неизвестный статус заказа' })
  status!: OrderStatus;
}
