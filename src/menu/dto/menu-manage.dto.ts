import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { Trim, TrimToNull } from '../../common/transforms';
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
