import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isUniqueViolation } from '../common/prisma-errors';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './password';

export type AdminBootstrapResult =
  'disabled' | 'created' | 'exists' | 'reset' | 'not-admin';

// Первый админ из ADMIN_EMAIL и ADMIN_PASSWORD — при старте API, без ручек и скриптов.
// Правила (BACKEND.md §2):
// - нет пользователя — создаём админа;
// - есть админ — не трогаем (пароль, сменённый позже, не затирается);
// - есть, но не админ — НЕ повышаем молча: иначе заранее зарегистрированный
//   на сайте клиент получил бы админку со своим паролем;
// - ADMIN_RESET_PASSWORD=true — роль «админ», аккаунт включён, пароль из env
//   (чужой пароль перестаёт работать). После входа флаг убрать.
// В лог не пишем ни почту, ни пароль.
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  async run(): Promise<AdminBootstrapResult> {
    const email = this.config.get('ADMIN_EMAIL', { infer: true });
    const password = this.config.get('ADMIN_PASSWORD', { infer: true });
    const reset = this.config.get('ADMIN_RESET_PASSWORD', { infer: true });
    if (!email || !password) return 'disabled';

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (!existing) {
      try {
        await this.prisma.user.create({
          data: {
            email,
            name: 'Администратор',
            role: 'admin',
            passwordHash: await hashPassword(password),
          },
        });
      } catch (error) {
        // Второй экземпляр API стартовал одновременно и успел раньше — это норма.
        if (isUniqueViolation(error)) return 'exists';
        throw error;
      }
      this.logger.log('Админ из ADMIN_EMAIL создан');
      return 'created';
    }

    if (reset) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'admin',
          isActive: true,
          passwordHash: await hashPassword(password),
        },
      });
      this.logger.warn(
        'Админ из ADMIN_EMAIL сброшен: роль, доступ и пароль из env. Уберите ADMIN_RESET_PASSWORD',
      );
      return 'reset';
    }

    if (existing.role !== 'admin') {
      this.logger.warn(
        'Аккаунт ADMIN_EMAIL уже есть, но он не админ — не повышаю. Нужен ADMIN_RESET_PASSWORD=true',
      );
      return 'not-admin';
    }
    return 'exists';
  }
}
