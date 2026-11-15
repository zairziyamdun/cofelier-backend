import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

// Глобальный: PrismaService нужен сервису каждого модуля, импортировать его везде незачем.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
