import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { AppStorageService, StorageService } from './storage.service';

@Module({
  controllers: [FilesController],
  providers: [{ provide: StorageService, useClass: AppStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
