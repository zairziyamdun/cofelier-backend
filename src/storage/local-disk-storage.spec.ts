import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isFileKey, LocalDiskStorage } from './local-disk-storage';

const key = 'menu/12/3f2b9c1e-8a4d-4e6f-9b2a-1c3d5e7f9a0b-320.webp';

describe('фото на диске', () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cofelier-files-'));
    storage = new LocalDiskStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('сохраняет, отдаёт путь и адрес, удаляет', async () => {
    await storage.put(key, Buffer.from('webp'));
    const path = storage.pathOf(key);
    expect(path).not.toBeNull();
    expect(await readFile(path!, 'utf8')).toBe('webp');
    expect(storage.publicUrl(key)).toBe(`/api/files/${key}`);

    await storage.delete([key]);
    await expect(readFile(path!)).rejects.toThrow();
    // Повторное удаление — не ошибка: файла уже нет.
    await expect(storage.delete([key])).resolves.toBeUndefined();
  });

  it('чужие ключи и попытки выйти из папки не проходят', async () => {
    for (const bad of [
      '../secret.webp',
      'menu/12/../../etc/passwd',
      'menu/abc/3f2b9c1e-8a4d-4e6f-9b2a-1c3d5e7f9a0b-320.webp',
      'menu/12/3f2b9c1e-8a4d-4e6f-9b2a-1c3d5e7f9a0b-999.webp',
      'menu/12/photo.jpg',
    ]) {
      expect(isFileKey(bad)).toBe(false);
      expect(storage.pathOf(bad)).toBeNull();
    }
    await expect(storage.put('../x.webp', Buffer.from(''))).rejects.toThrow(
      'Недопустимый ключ',
    );
  });
});
