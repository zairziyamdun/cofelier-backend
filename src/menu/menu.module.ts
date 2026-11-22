import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { MenuAdminController } from './menu-admin.controller';
import { MenuAdminService } from './menu-admin.service';
import { MenuPhotosController } from './menu-photos.controller';
import { MenuPhotosService } from './menu-photos.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [StorageModule],
  controllers: [MenuController, MenuAdminController, MenuPhotosController],
  providers: [MenuService, MenuAdminService, MenuPhotosService],
  // Заказы (этап 5) проверяют цену и стоп-лист через MenuService.
  exports: [MenuService],
})
export class MenuModule {}
