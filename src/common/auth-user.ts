import type { Role } from '../generated/prisma/client';

// Пользователь запроса: кладёт JwtStrategy в req.user после проверки токена.
export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
};

export type AuthRequest = { user?: AuthUser };
