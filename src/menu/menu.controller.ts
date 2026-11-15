import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { MenuCategoryDto } from './dto/menu-response.dto';
import { MenuService } from './menu.service';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Публичное меню: категории с позициями' })
  @ApiOkResponse({ type: [MenuCategoryDto] })
  getMenu(): Promise<MenuCategoryDto[]> {
    return this.menuService.getPublicMenu();
  }
}
