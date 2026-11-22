import { ApiProperty } from '@nestjs/swagger';

import { MenuItemBadge } from '../menu-badges';
import { ModifierGroupDto } from './menu-modifiers.dto';

export class MenuPhotoUrlsDto {
  @ApiProperty({ description: 'Ширина 320 px — строка меню' })
  small!: string;

  @ApiProperty({ description: 'Ширина 800 px — шторка товара' })
  medium!: string;

  @ApiProperty({ description: 'Ширина 1600 px — большой экран' })
  large!: string;
}

export class MenuPhotoDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ description: 'Ширина оригинала, px', example: 1200 })
  width!: number;

  @ApiProperty({ description: 'Высота оригинала, px', example: 1500 })
  height!: number;

  @ApiProperty({
    description: 'Прозрачный фон: можно показывать без рамки',
  })
  hasAlpha!: boolean;

  @ApiProperty({ type: MenuPhotoUrlsDto })
  urls!: MenuPhotoUrlsDto;
}

export class MenuItemDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({
    description: 'Для ссылки на товар: /menu?item=kapuchino',
    example: 'kapuchino',
  })
  slug!: string;

  @ApiProperty({ example: 'Капучино' })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Эспрессо, молоко и шелковистая пенка',
  })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '300 мл' })
  portion!: string | null;

  @ApiProperty({ description: 'Цена в целых тенге', example: 1500 })
  price!: number;

  @ApiProperty({
    type: [MenuPhotoDto],
    description: 'Фото по порядку, первое — обложка; пусто — фото нет',
  })
  photos!: MenuPhotoDto[];

  @ApiProperty({
    description: 'false — позиция в стоп-листе: видна, но заказать нельзя',
  })
  isAvailable!: boolean;

  @ApiProperty({
    type: [ModifierGroupDto],
    description: 'Группы добавок в порядке показа; пусто — без добавок',
  })
  modifierGroups!: ModifierGroupDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Цена с добавками по умолчанию — её кладёт «+» в меню; null — по умолчанию не собрать, нужно выбрать в шторке',
    example: 1800,
  })
  defaultPrice!: number | null;

  @ApiProperty({
    enum: MenuItemBadge,
    enumName: 'MenuItemBadge',
    isArray: true,
    description:
      'Метки для карточки по порядку важности: popular и new считает сервер, остальные ставит менеджер',
    example: ['popular', 'seasonal'],
  })
  badges!: MenuItemBadge[];
}

export class MenuCategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'espresso' })
  slug!: string;

  @ApiProperty({ example: 'Эспрессо и классика' })
  name!: string;

  @ApiProperty({ type: [MenuItemDto] })
  items!: MenuItemDto[];
}
