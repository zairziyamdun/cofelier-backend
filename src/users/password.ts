import * as argon2 from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

let dummyHash: Promise<string> | undefined;

// Нет такой почты — всё равно считаем argon2 на подставном хеше: иначе по
// времени ответа входа видно, зарегистрирована ли почта.
export async function verifyPasswordOrDummy(
  hash: string | null,
  password: string,
): Promise<boolean> {
  if (hash !== null) return verifyPassword(hash, password);
  dummyHash ??= hashPassword('cofelier-timing-dummy-password');
  await argon2.verify(await dummyHash, password);
  return false;
}

// Почта сравнивается без учёта регистра и пробелов по краям.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
