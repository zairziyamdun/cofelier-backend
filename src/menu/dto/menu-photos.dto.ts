import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

// Только для Swagger: тело multipart, файлы разбирает FilesInterceptor.
export class UploadMenuPhotosDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'JPEG, PNG, WebP или AVIF, до 10 МБ каждое, до 6 у позиции',
  })
  photos!: unknown[];
}

export class ReorderMenuPhotosDto {
  @ApiProperty({
    type: [Number],
    description: 'id всех фото позиции в новом порядке; первое — обложка',
    example: [12, 10, 11],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  ids!: number[];
}
