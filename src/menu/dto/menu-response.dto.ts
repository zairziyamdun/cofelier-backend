import { ApiProperty } from '@nestjs/swagger';

export class MenuItemDto {
  @ApiProperty({ example: 3 })
  id!: number;

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

  @ApiProperty({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'false — позиция в стоп-листе: видна, но заказать нельзя',
  })
  isAvailable!: boolean;
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
