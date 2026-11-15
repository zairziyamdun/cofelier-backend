import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Проба для docker-compose и деплоя: API жив и видит БД.
  @Get()
  @Public()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('База данных недоступна');
    }
    return { status: 'ok' };
  }
}
