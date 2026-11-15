import { Module } from '@nestjs/common';

import { AdminBootstrapService } from './admin-bootstrap.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  // AdminBootstrapService — первый админ из env при старте API.
  providers: [UsersService, AdminBootstrapService],
  // auth проверяет пароль и создаёт клиентов через UsersService.
  exports: [UsersService],
})
export class UsersModule {}
