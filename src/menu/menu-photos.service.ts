import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ManagedMenuItemDto } from './dto/menu-manage.dto';
import {
  MAX_PHOTOS_PER_ITEM,
  photoFileKey,
  photoFileKeys,
  ProcessedPhoto,
  processPhoto,
} from './menu-photo-processing';
import { toManagedMenuItemDto, withItemDetails } from './menu.mapper';
import { MenuService } from './menu.service';

export type UploadedPhoto = { buffer: Buffer };

// Фото позиций для менеджера: файлы — в хранилище, строки — в menu_item_photos.
@Injectable()
export class MenuPhotosService {
  private readonly logger = new Logger(MenuPhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly menuService: MenuService,
  ) {}

  // Сначала проверяем и обрабатываем все файлы, потом грузим: одно плохое фото
  // не оставляет половину загруженной. Сбой записи в БД — файлы удаляются.
  async upload(
    itemId: number,
    files: UploadedPhoto[],
  ): Promise<ManagedMenuItemDto> {
    if (!this.storage.isConfigured) {
      throw new ServiceUnavailableException(
        'Хранилище фото не настроено — обратитесь к администратору',
      );
    }
    if (files.length === 0) {
      throw new BadRequestException('Выберите хотя бы одно фото');
    }
    await this.findItemOrThrow(itemId);
    const existing = await this.prisma.menuItemPhoto.findMany({
      where: { menuItemId: itemId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const freeSlots = MAX_PHOTOS_PER_ITEM - existing.length;
    if (files.length > freeSlots) {
      throw new BadRequestException(
        freeSlots > 0
          ? `Не больше ${MAX_PHOTOS_PER_ITEM} фото у позиции: можно добавить ещё ${freeSlots}`
          : `Не больше ${MAX_PHOTOS_PER_ITEM} фото у позиции: сначала удалите лишние`,
      );
    }

    const processed: ProcessedPhoto[] = [];
    for (const file of files) processed.push(await processPhoto(file.buffer));

    const uploadedKeys: string[] = [];
    const rows: { key: string; photo: ProcessedPhoto }[] = [];
    try {
      for (const photo of processed) {
        const key = `menu/${itemId}/${randomUUID()}`;
        for (const variant of photo.variants) {
          const fileKey = photoFileKey(key, variant.width);
          await this.storage.put(fileKey, variant.body, 'image/webp');
          uploadedKeys.push(fileKey);
        }
        rows.push({ key, photo });
      }
      const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;
      await this.prisma.menuItemPhoto.createMany({
        data: rows.map(({ key, photo }, index) => ({
          menuItemId: itemId,
          key,
          width: photo.width,
          height: photo.height,
          hasAlpha: photo.hasAlpha,
          sortOrder: nextOrder + index,
        })),
      });
    } catch (error) {
      await this.deleteFilesQuietly(uploadedKeys);
      throw error;
    }
    return this.managedItem(itemId);
  }

  async remove(itemId: number, photoId: number): Promise<ManagedMenuItemDto> {
    await this.findItemOrThrow(itemId);
    const photo = await this.prisma.menuItemPhoto.findFirst({
      where: { id: photoId, menuItemId: itemId },
    });
    if (!photo) throw new NotFoundException('Фото не найдено');
    await this.prisma.menuItemPhoto.delete({ where: { id: photo.id } });
    await this.deleteFilesQuietly(photoFileKeys(photo.key));
    return this.managedItem(itemId);
  }

  // Порядок — списком id всех фото позиции: первое становится обложкой.
  async reorder(itemId: number, ids: number[]): Promise<ManagedMenuItemDto> {
    await this.findItemOrThrow(itemId);
    const photos = await this.prisma.menuItemPhoto.findMany({
      where: { menuItemId: itemId },
      select: { id: true },
    });
    const known = new Set(photos.map((photo) => photo.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'Нужен список всех фото позиции, каждое — один раз',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuItemPhoto.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.managedItem(itemId);
  }

  // Ключи файлов позиции — до её удаления из БД (строки фото уйдут каскадом).
  async fileKeysOf(itemId: number): Promise<string[]> {
    const photos = await this.prisma.menuItemPhoto.findMany({
      where: { menuItemId: itemId },
      select: { key: true },
    });
    return photos.flatMap((photo) => photoFileKeys(photo.key));
  }

  // Не удалённый файл — мусор в хранилище, а не ошибка для менеджера.
  async deleteFilesQuietly(keys: string[]): Promise<void> {
    if (keys.length === 0 || !this.storage.isConfigured) return;
    try {
      await this.storage.delete(keys);
    } catch (error) {
      this.logger.warn(
        `Не удалось удалить ${keys.length} файл(ов) фото: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async findItemOrThrow(itemId: number): Promise<void> {
    const count = await this.prisma.menuItem.count({
      where: { id: itemId, isArchived: false },
    });
    if (count === 0) throw new NotFoundException('Позиция не найдена');
  }

  private async managedItem(itemId: number): Promise<ManagedMenuItemDto> {
    const [item, context] = await Promise.all([
      this.prisma.menuItem.findUniqueOrThrow({
        where: { id: itemId },
        include: withItemDetails,
      }),
      this.menuService.getDtoContext(),
    ]);
    return toManagedMenuItemDto(item, context);
  }
}
