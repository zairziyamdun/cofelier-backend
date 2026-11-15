import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  // auth проверяет пароль и создаёт клиентов через UsersService.
  exports: [UsersService],
})
export class UsersModule {}
