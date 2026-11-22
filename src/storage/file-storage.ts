import { LocalDiskStorage } from './local-disk-storage';
import { S3Storage, s3ConfigFromEnv } from './s3-storage';

export const DEFAULT_UPLOADS_DIR = 'uploads';

export type FileStorage = S3Storage | LocalDiskStorage;

type StorageEnv = Parameters<typeof s3ConfigFromEnv>[0] & {
  UPLOADS_DIR?: string;
};

// Где лежат фото: подключён S3 (все S3_* заданы) — в нём, иначе — на диске
// самого API в UPLOADS_DIR. Одно правило для API и для сидов.
export function fileStorageFromEnv(env: StorageEnv): FileStorage {
  const s3 = s3ConfigFromEnv(env);
  if (s3) return new S3Storage(s3);
  return new LocalDiskStorage(env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR);
}
