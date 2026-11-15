import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth-cookie';
import type { Role, User } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { hashPassword } from '../../src/users/password';

// Тестовые пользователи одного файла — на своём домене (@auth.e2e.test):
// файлы e2e идут параллельно, и cleanup одного не должен удалять чужих.
export function testUsers(app: () => INestApplication, suite: string) {
  const domain = `@${suite}.e2e.test`;

  function email(label: string): string {
    return `${label}-${Date.now()}-${Math.round(Math.random() * 1e6)}${domain}`;
  }

  async function create(
    role: Role,
    options: { password?: string; isActive?: boolean } = {},
  ): Promise<User> {
    return app()
      .get(PrismaService)
      .user.create({
        data: {
          email: email(role),
          passwordHash: await hashPassword(options.password ?? 'password123'),
          name: `Тест ${role}`,
          role,
          isActive: options.isActive ?? true,
        },
      });
  }

  // Cookie с токеном без запроса на /auth/login: не тратит лимит попыток входа.
  function cookie(user: User): string {
    const token = app().get(JwtService).sign({ sub: user.id });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
  }

  async function cleanup(): Promise<void> {
    await app()
      .get(PrismaService)
      .user.deleteMany({ where: { email: { endsWith: domain } } });
  }

  return { email, create, cookie, cleanup };
}
