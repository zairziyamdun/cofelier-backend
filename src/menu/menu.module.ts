import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { MenuAdminController } from './menu-admin.controller';
import { MenuAdminService } from './menu-admin.service';
import { MenuModifiersController } from './menu-modifiers.controller';
import { MenuModifiersService } from './menu-modifiers.service';
import { MenuPhotosController } from './menu-photos.controller';
import { MenuPhotosService } from './menu-photos.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [StorageModule],
  controllers: [
    MenuController,
    MenuAdminController,
    MenuPhotosController,
    MenuModifiersController,
  ],
  providers: [
    MenuService,
    MenuAdminService,
    MenuPhotosService,
    MenuModifiersService,
  ],
  // Заказы проверяют позиции, добавки и считают цену через MenuService.
  exports: [MenuService],
})
export class MenuModule {}
