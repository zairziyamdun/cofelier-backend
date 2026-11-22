import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Адрес файлов с диска: их раздаёт сам API (FilesController). Путь
// относительный — сайт ходит в API через свой /api, и картинки тоже.
export const LOCAL_FILES_PREFIX = '/api/files';

// Ключ файла фото: menu/<id позиции>/<uuid>-<ширина>.webp. Всё остальное —
// не наш файл (и защита от «../» в пути).
const KEY_PATTERN =
  /^menu\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(320|800|1600)\.webp$/;

export function isFileKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

// Фото на диске самого API — когда S3 не подключён. На Railway папка должна
// лежать на подключённом диске (Volume), иначе файлы пропадут при деплое.
export class LocalDiskStorage {
  readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  // Полный путь к файлу; null — ключ не наш или уводит из папки.
  pathOf(key: string): string | null {
    if (!isFileKey(key)) return null;
    const path = resolve(this.root, key);
    return path.startsWith(this.root + sep) ? path : null;
  }

  // Тип файла не храним: FilesController отдаёт только WebP.
  async put(key: string, body: Buffer): Promise<void> {
    const path = this.requirePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) => rm(this.requirePath(key), { force: true })),
    );
  }

  publicUrl(key: string): string {
    return `${LOCAL_FILES_PREFIX}/${key}`;
  }

  async prepare(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  private requirePath(key: string): string {
    const path = this.pathOf(key);
    if (!path) throw new Error(`Недопустимый ключ файла: ${key}`);
    return path;
  }
}
