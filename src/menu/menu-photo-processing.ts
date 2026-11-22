import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

// Размеры, в которых храним каждое фото: строка меню, шторка товара, большой экран.
export const PHOTO_WIDTHS = [320, 800, 1600] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];
export const MAX_PHOTOS_PER_ITEM = 6;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MIN_PHOTO_SIDE = 200;
// HEIC с iPhone sharp не читает: браузер при выборе файла обычно сам отдаёт JPEG.
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);

export type ProcessedPhoto = {
  width: number;
  height: number;
  hasAlpha: boolean;
  variants: { width: PhotoWidth; body: Buffer }[];
};

// Файлы одного фото в хранилище: <key>-320.webp, <key>-800.webp, <key>-1600.webp.
export function photoFileKey(key: string, width: PhotoWidth): string {
  return `${key}-${width}.webp`;
}

export function photoFileKeys(key: string): string[] {
  return PHOTO_WIDTHS.map((width) => photoFileKey(key, width));
}

// Проверить и разложить фото на размеры. Поворот — по EXIF, метаданные
// (в том числе GPS) не переносятся: sharp без withMetadata их отбрасывает.
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new BadRequestException('Файл не похож на картинку');
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new BadRequestException(
      'Формат не поддерживается: загрузите JPEG, PNG или WebP',
    );
  }

  // Ориентация 5–8 — кадр повёрнут на 90°: ширина и высота меняются местами.
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;
  if (Math.min(width, height) < MIN_PHOTO_SIDE) {
    throw new BadRequestException(
      `Фото слишком маленькое: нужно от ${MIN_PHOTO_SIDE} пикселей по меньшей стороне`,
    );
  }

  // Прозрачный фон — только если альфа-канал реально используется.
  const hasAlpha =
    Boolean(metadata.hasAlpha) && !(await sharp(input).stats()).isOpaque;

  const variants = await Promise.all(
    PHOTO_WIDTHS.map(async (variantWidth) => ({
      width: variantWidth,
      body: await sharp(input)
        .rotate()
        .resize({ width: variantWidth, withoutEnlargement: true })
        .webp({ quality: 80, alphaQuality: 90 })
        .toBuffer(),
    })),
  );

  return { width, height, hasAlpha, variants };
}
