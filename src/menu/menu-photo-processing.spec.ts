import sharp from 'sharp';

import {
  photoFileKeys,
  PHOTO_WIDTHS,
  processPhoto,
} from './menu-photo-processing';

function image(
  width: number,
  height: number,
  options: { alpha?: boolean; format?: 'jpeg' | 'png' | 'gif' } = {},
): Promise<Buffer> {
  const channels = options.alpha ? 4 : 3;
  const background = options.alpha
    ? { r: 184, g: 115, b: 51, alpha: 0.5 }
    : { r: 184, g: 115, b: 51 };
  const base = sharp({ create: { width, height, channels, background } });
  const format = options.format ?? 'jpeg';
  return base[format]().toBuffer();
}

describe('обработка фото меню', () => {
  it('три размера WebP, не больше оригинала, размеры оригинала', async () => {
    const result = await processPhoto(await image(1000, 1250));
    expect(result).toMatchObject({
      width: 1000,
      height: 1250,
      hasAlpha: false,
    });
    expect(result.variants.map((variant) => variant.width)).toEqual([
      ...PHOTO_WIDTHS,
    ]);
    const meta = await Promise.all(
      result.variants.map((variant) => sharp(variant.body).metadata()),
    );
    expect(meta.map((item) => item.format)).toEqual(['webp', 'webp', 'webp']);
    // Без увеличения: 1600 из оригинала шириной 1000 — остаётся 1000.
    expect(meta.map((item) => item.width)).toEqual([320, 800, 1000]);
  });

  it('прозрачный фон определяется, непрозрачный PNG — нет', async () => {
    const transparent = await processPhoto(
      await image(400, 400, { alpha: true, format: 'png' }),
    );
    expect(transparent.hasAlpha).toBe(true);
    const opaque = await processPhoto(await image(400, 400, { format: 'png' }));
    expect(opaque.hasAlpha).toBe(false);
  });

  it('поворот по EXIF: ширина и высота меняются местами, метаданных нет', async () => {
    const rotatedJpeg = await sharp({
      create: { width: 600, height: 400, channels: 3, background: '#b87333' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processPhoto(rotatedJpeg);
    expect(result).toMatchObject({ width: 400, height: 600 });
    const meta = await sharp(result.variants[0].body).metadata();
    expect(meta.width).toBeLessThan(meta.height ?? 0);
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it('не картинка, чужой формат, слишком маленькое — понятный отказ', async () => {
    await expect(processPhoto(Buffer.from('просто текст'))).rejects.toThrow(
      'не похож на картинку',
    );
    await expect(
      processPhoto(await image(400, 400, { format: 'gif' })),
    ).rejects.toThrow('Формат не поддерживается');
    await expect(processPhoto(await image(150, 600))).rejects.toThrow(
      'слишком маленькое',
    );
  });

  it('ключи файлов — по одному на размер', () => {
    expect(photoFileKeys('menu/1/abc')).toEqual([
      'menu/1/abc-320.webp',
      'menu/1/abc-800.webp',
      'menu/1/abc-1600.webp',
    ]);
  });
});
