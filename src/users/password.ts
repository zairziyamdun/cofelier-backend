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

// Почта сравнивается без учёта регистра и пробелов по краям.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
