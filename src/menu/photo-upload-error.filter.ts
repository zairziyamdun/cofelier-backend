import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from './menu-photo-processing';

// Ошибки multer приходят по-английски («File too large») — менеджеру нужен русский.
const MULTER_MESSAGES: Record<string, string> = {
  'File too large': `Фото больше ${MAX_PHOTO_BYTES / 1024 / 1024} МБ — уменьшите его`,
  'Too many files': `За раз — не больше ${MAX_PHOTOS_PER_ITEM} фото`,
  'Unexpected field': 'Фото передаются в поле «photos»',
};

@Catch(PayloadTooLargeException, BadRequestException)
export class PhotoUploadErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const original =
      typeof body === 'object' && body !== null && 'message' in body
        ? body.message
        : exception.message;
    const translated =
      typeof original === 'string' ? MULTER_MESSAGES[original] : undefined;
    response
      .status(status)
      .json(
        translated
          ? { statusCode: status, message: translated, error: exception.name }
          : body,
      );
  }
}
