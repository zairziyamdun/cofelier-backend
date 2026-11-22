import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { ManagedMenuItemDto } from './dto/menu-manage.dto';
import {
  ReorderMenuPhotosDto,
  UploadMenuPhotosDto,
} from './dto/menu-photos.dto';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from './menu-photo-processing';
import { MenuPhotosService } from './menu-photos.service';
import { PhotoUploadErrorFilter } from './photo-upload-error.filter';

// Фото позиций — как и всё управление меню, только менеджер и админ.
@ApiTags('menu-admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Нужно войти' })
@ApiForbiddenResponse({ description: 'Недостаточно прав' })
@ApiNotFoundResponse({ description: 'Позиция или фото не найдены' })
@Roles('manager', 'admin')
@Controller('menu/items/:id/photos')
export class MenuPhotosController {
  constructor(private readonly photos: MenuPhotosService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_ITEM, {
      limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_ITEM },
    }),
  )
  @UseFilters(PhotoUploadErrorFilter)
  @ApiOperation({ summary: 'Добавить фото позиции (в конец списка)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadMenuPhotosDto })
  @ApiCreatedResponse({ type: ManagedMenuItemDto })
  @ApiBadRequestResponse({
    description: 'Не картинка, формат, размер или больше 6 фото',
  })
  @ApiPayloadTooLargeResponse({ description: 'Файл больше 10 МБ' })
  @ApiServiceUnavailableResponse({ description: 'Хранилище не настроено' })
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<ManagedMenuItemDto> {
    return this.photos.upload(id, files ?? []);
  }

  // Статичный путь раньше :photoId, чтобы «order» не принять за id.
  @Put('order')
  @ApiOperation({ summary: 'Новый порядок фото; первое — обложка' })
  @ApiOkResponse({ type: ManagedMenuItemDto })
  @ApiBadRequestResponse({ description: 'Не все фото или повторы' })
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderMenuPhotosDto,
  ): Promise<ManagedMenuItemDto> {
    return this.photos.reorder(id, dto.ids);
  }

  @Delete(':photoId')
  @ApiOperation({ summary: 'Удалить фото позиции' })
  @ApiOkResponse({ type: ManagedMenuItemDto })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
  ): Promise<ManagedMenuItemDto> {
    return this.photos.remove(id, photoId);
  }
}
