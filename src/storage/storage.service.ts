import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env';
import { fileStorageFromEnv, type FileStorage } from './file-storage';
import { LocalDiskStorage } from './local-disk-storage';

// Файлы (фото меню). Абстрактный класс — токен DI: в e2e его подменяют
// хранилищем в памяти.
export abstract class StorageService {
  abstract readonly isConfigured: boolean;
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(keys: string[]): Promise<void>;
  abstract publicUrl(key: string): string;
  // Путь к файлу на диске — только в режиме «диск» (файлы раздаёт API);
  // в S3 файлы отдаёт само хранилище — null.
  abstract localPath(key: string): string | null;
}

// Два режима: подключён S3 (S3_*) — файлы в нём; нет — на диске API
// (UPLOADS_DIR). Выбор — при старте, по переменным окружения.
@Injectable()
export class AppStorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(AppStorageService.name);
  private readonly files: FileStorage;
  readonly isConfigured = true;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    this.files = fileStorageFromEnv({
      S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
      S3_REGION: config.get('S3_REGION', { infer: true }),
      S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
      S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
      S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      S3_PUBLIC_URL: config.get('S3_PUBLIC_URL', { infer: true }),
      UPLOADS_DIR: config.get('UPLOADS_DIR', { infer: true }),
    });
  }

  // Папку на диске создаём всегда; бакет S3 — только вне прода (на проде он
  // настроен в панели хранилища). Недоступное хранилище не роняет API.
  async onModuleInit(): Promise<void> {
    const local = this.files instanceof LocalDiskStorage;
    this.logger.log(
      this.files instanceof LocalDiskStorage
        ? `Фото меню — на диске: ${this.files.root}`
        : 'Фото меню — в хранилище S3',
    );
    if (
      !local &&
      this.config.get('NODE_ENV', { infer: true }) === 'production'
    ) {
      return;
    }
    try {
      await this.files.prepare();
    } catch (error) {
      this.logger.warn(
        `Хранилище фото не готово: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.files instanceof LocalDiskStorage
      ? this.files.put(key, body)
      : this.files.put(key, body, contentType);
  }

  delete(keys: string[]): Promise<void> {
    return this.files.delete(keys);
  }

  publicUrl(key: string): string {
    return this.files.publicUrl(key);
  }

  localPath(key: string): string | null {
    return this.files instanceof LocalDiskStorage
      ? this.files.pathOf(key)
      : null;
  }
}
