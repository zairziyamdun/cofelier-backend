import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { Trim, TrimToNull } from '../../common/transforms';
import { MenuBadge } from '../../generated/prisma/enums';
import { MenuItemDto } from './menu-response.dto';

// ── Запросы ────────────────────────────────────────────────────────────

export class CreateMenuItemDto {
  @ApiProperty({ example: 1 })
  @IsInt({ message: 'Выберите категорию' })
  @Min(1, { message: 'Выберите категорию' })
  categoryId!: number;

  @ApiProperty({ example: 'Капучино' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Название — от 2 символов' })
  @MaxLength(80, { message: 'Название — до 80 символов' })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Эспрессо, молоко и шелковистая пенка',
  })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Описание — до 300 символов' })
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '300 мл' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Объём — до 30 символов' })
  portion?: string | null;

  @ApiProperty({ description: 'Цена в целых тенге', example: 1500 })
  @IsInt({ message: 'Цена — целое число тенге' })
  @Min(1, { message: 'Цена должна быть больше нуля' })
  @Max(1_000_000, { message: 'Цена — не больше 1 000 000 ₸' })
  price!: number;

  @ApiPropertyOptional({
    enum: MenuBadge,
    enumName: 'MenuBadge',
    isArray: true,
    description: 'Ручные метки; не передано при создании — без меток',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'Метка повторяется' })
  @IsEnum(MenuBadge, { each: true, message: 'Неизвестная метка' })
  manualBadges?: MenuBadge[];

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'До какого момента позиция — «Новинка»; null — не новинка. Не передано при создании — 14 дней',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'Неверная дата для метки «Новинка»' })
  newUntil?: string | null;
}

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}

export class SetStopListDto {
  @ApiProperty({ description: 'true — позиция в стоп-листе' })
  @IsBoolean()
  inStopList!: boolean;
}

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'Сезонное' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Название — от 2 символов' })
  @MaxLength(60, { message: 'Название — до 60 символов' })
  name!: string;
}

export class UpdateMenuCategoryDto extends CreateMenuCategoryDto {}

export class ReorderMenuCategoriesDto {
  @ApiProperty({
    type: [Number],
    description: 'id всех категорий в новом порядке',
    example: [3, 1, 2],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  ids!: number[];
}

// ── Ответы ─────────────────────────────────────────────────────────────

// Позиция для панели: публичные поля и то, что нужно для правки.
export class ManagedMenuItemDto extends MenuItemDto {
  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({ description: 'true — позиция в стоп-листе' })
  inStopList!: boolean;

  @ApiProperty({ enum: MenuBadge, enumName: 'MenuBadge', isArray: true })
  manualBadges!: MenuBadge[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'До какого момента позиция — «Новинка»; null — не новинка',
  })
  newUntil!: string | null;
}

export class ManagedMenuCategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'espresso' })
  slug!: string;

  @ApiProperty({ example: 'Эспрессо и классика' })
  name!: string;

  @ApiProperty({ type: [ManagedMenuItemDto] })
  items!: ManagedMenuItemDto[];
}
