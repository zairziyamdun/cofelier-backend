import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Trim, TrimToNull } from '../../common/transforms';
import { ModifierGroupKind } from '../../generated/prisma/enums';

// ── Ответы ─────────────────────────────────────────────────────────────

export class ModifierOptionDto {
  @ApiProperty({ example: 21 })
  id!: number;

  @ApiProperty({ example: 'Овсяное' })
  name!: string;

  @ApiProperty({
    description: 'Надбавка в целых тенге; 0 — бесплатно',
    example: 300,
  })
  priceDelta!: number;

  @ApiProperty({ description: 'Выбран сразу' })
  isDefault!: boolean;

  @ApiProperty({ description: 'false — закончилось: виден, но выбрать нельзя' })
  isAvailable!: boolean;

  @ApiProperty({ type: String, nullable: true, example: '350 мл' })
  note!: string | null;
}

export class ModifierGroupDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Молоко' })
  name!: string;

  @ApiProperty({
    enum: ModifierGroupKind,
    enumName: 'ModifierGroupKind',
    description:
      'single — один вариант, multiple — несколько, quantity — количеством',
  })
  kind!: ModifierGroupKind;

  @ApiProperty({ description: 'Без выбора в группе товар не добавить' })
  required!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'multiple — сколько вариантов можно; quantity — сколько штук всего; null — без лимита',
  })
  maxSelect!: number | null;

  @ApiProperty({ type: [ModifierOptionDto] })
  options!: ModifierOptionDto[];
}

// Вариант для панели: плюс стоп-лист как есть.
export class ManagedModifierOptionDto extends ModifierOptionDto {
  @ApiProperty()
  inStopList!: boolean;
}

export class ManagedModifierGroupDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Молоко' })
  name!: string;

  @ApiProperty({ enum: ModifierGroupKind, enumName: 'ModifierGroupKind' })
  kind!: ModifierGroupKind;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  maxSelect!: number | null;

  @ApiProperty({ type: [ManagedModifierOptionDto] })
  options!: ManagedModifierOptionDto[];

  @ApiProperty({
    type: [Number],
    description: 'id позиций, к которым подключена группа',
  })
  itemIds!: number[];
}

// ── Запросы ────────────────────────────────────────────────────────────

export class CreateModifierOptionDto {
  @ApiProperty({ example: 'Овсяное' })
  @Trim()
  @IsString()
  @MinLength(1, { message: 'Название варианта — от 1 символа' })
  @MaxLength(40, { message: 'Название варианта — до 40 символов' })
  name!: string;

  @ApiPropertyOptional({ description: 'Надбавка в целых тенге', example: 300 })
  @IsOptional()
  @IsInt({ message: 'Надбавка — целое число тенге' })
  @Min(0, { message: 'Надбавка не может быть отрицательной' })
  @Max(100_000, { message: 'Надбавка — не больше 100 000 ₸' })
  priceDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: '350 мл' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Подпись — до 30 символов' })
  note?: string | null;
}

export class UpdateModifierOptionDto extends PartialType(
  CreateModifierOptionDto,
) {
  @ApiPropertyOptional({ description: 'true — закончилось' })
  @IsOptional()
  @IsBoolean()
  inStopList?: boolean;
}

export class CreateModifierGroupDto {
  @ApiProperty({ example: 'Молоко' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Название группы — от 2 символов' })
  @MaxLength(40, { message: 'Название группы — до 40 символов' })
  name!: string;

  @ApiProperty({ enum: ModifierGroupKind, enumName: 'ModifierGroupKind' })
  @IsEnum(ModifierGroupKind, { message: 'Неизвестный тип группы' })
  kind!: ModifierGroupKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt({ message: 'Лимит — целое число' })
  @Min(1, { message: 'Лимит — от 1' })
  @Max(20, { message: 'Лимит — не больше 20' })
  maxSelect?: number | null;

  @ApiPropertyOptional({ type: [CreateModifierOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Не больше 20 вариантов в группе' })
  @ValidateNested({ each: true })
  @Type(() => CreateModifierOptionDto)
  options?: CreateModifierOptionDto[];
}

// Варианты правятся своими ручками: id вариантов в корзинах гостей не меняются.
export class UpdateModifierGroupDto extends PartialType(
  OmitType(CreateModifierGroupDto, ['options'] as const),
) {}

export class SetItemModifierGroupsDto {
  @ApiProperty({
    type: [Number],
    description: 'id групп в порядке показа; пусто — без добавок',
    example: [1, 2],
  })
  @IsArray()
  @ArrayUnique({ message: 'Группа повторяется' })
  @ArrayMaxSize(10, { message: 'Не больше 10 групп у позиции' })
  @IsInt({ each: true })
  groupIds!: number[];
}
