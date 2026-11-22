import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env';
import { S3Storage, s3ConfigFromEnv } from './s3-storage';

// Файлы (фото меню) в S3-хранилище. Абстрактный класс — токен DI: в e2e
// его подменяют хранилищем в памяти.
export abstract class StorageService {
  abstract readonly isConfigured: boolean;
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(keys: string[]): Promise<void>;
  abstract publicUrl(key: string): string;
}

@Injectable()
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3: S3Storage | null;
  readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    const s3Config = s3ConfigFromEnv({
      S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
      S3_REGION: config.get('S3_REGION', { infer: true }),
      S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
      S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
      S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      S3_PUBLIC_URL: config.get('S3_PUBLIC_URL', { infer: true }),
    });
    this.s3 = s3Config ? new S3Storage(s3Config) : null;
    this.isConfigured = this.s3 !== null;
  }

  // Локально бакет создаётся сам; недоступное хранилище не роняет API —
  // меню работает, падает только загрузка фото.
  async onModuleInit(): Promise<void> {
    if (!this.s3) {
      this.logger.warn(
        'Хранилище фото не настроено (S3_*): загрузка фото выключена',
      );
      return;
    }
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') return;
    try {
      await this.s3.ensurePublicBucket();
    } catch (error) {
      this.logger.warn(
        `Не удалось подготовить бакет: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.require().put(key, body, contentType);
  }

  async delete(keys: string[]): Promise<void> {
    await this.require().delete(keys);
  }

  publicUrl(key: string): string {
    return this.s3 ? this.s3.publicUrl(key) : key;
  }

  private require(): S3Storage {
    if (!this.s3) {
      throw new ServiceUnavailableException(
        'Хранилище фото не настроено — обратитесь к администратору',
      );
    }
    return this.s3;
  }
}
