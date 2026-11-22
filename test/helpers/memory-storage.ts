import { StorageService } from '../../src/storage/storage.service';

// Хранилище фото в памяти для e2e: без S3 ни локально, ни в CI.
export class MemoryStorage extends StorageService {
  readonly isConfigured = true;
  readonly files = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.files.set(key, { body, contentType });
    return Promise.resolve();
  }

  delete(keys: string[]): Promise<void> {
    for (const key of keys) this.files.delete(key);
    return Promise.resolve();
  }

  publicUrl(key: string): string {
    return `https://storage.test/${key}`;
  }

  localPath(): string | null {
    return null;
  }

  keysOf(itemId: number): string[] {
    return [...this.files.keys()].filter((key) =>
      key.startsWith(`menu/${itemId}/`),
    );
  }
}
