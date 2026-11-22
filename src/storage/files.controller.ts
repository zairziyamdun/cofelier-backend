import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { Public } from '../common/decorators/public.decorator';
import { StorageService } from './storage.service';

// Фото меню с диска API — в режиме без S3 (в S3 файлы отдаёт само хранилище).
// Ключи файлов уникальны и не перезаписываются — кешировать можно навсегда.
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('menu/:itemId/:file')
  @Public()
  @ApiOperation({ summary: 'Файл фото меню (режим «диск»)' })
  @ApiProduces('image/webp')
  @ApiOkResponse({ description: 'WebP' })
  @ApiNotFoundResponse({ description: 'Нет такого файла' })
  async menuPhoto(
    @Param('itemId') itemId: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const path = this.storage.localPath(`menu/${itemId}/${file}`);
    const info = path ? await stat(path).catch(() => null) : null;
    if (!path || !info?.isFile()) {
      throw new NotFoundException('Файл не найден');
    }
    response.set({
      'Content-Type': 'image/webp',
      'Content-Length': String(info.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(createReadStream(path));
  }
}
