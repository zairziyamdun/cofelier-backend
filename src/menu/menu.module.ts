import { Module } from '@nestjs/common';

import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController],
  providers: [MenuService],
  // Заказы (этап 5) проверяют цену и стоп-лист через MenuService.
  exports: [MenuService],
})
export class MenuModule {}
