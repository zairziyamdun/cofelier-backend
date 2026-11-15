import { Prisma } from '../generated/prisma/client';

// P2002 — нарушена уникальность (например, email): в том числе при гонке двух запросов.
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
