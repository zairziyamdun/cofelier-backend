import { Module } from '@nestjs/common';

import { MenuAdminController } from './menu-admin.controller';
import { MenuAdminService } from './menu-admin.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController, MenuAdminController],
  providers: [MenuService, MenuAdminService],
  // Заказы (этап 5) проверяют цену и стоп-лист через MenuService.
  exports: [MenuService],
})
export class MenuModule {}
