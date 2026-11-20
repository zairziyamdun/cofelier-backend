import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-response.dto';
import {
  POPULAR_DEFAULT_LIMIT,
  PopularMenuQueryDto,
} from './dto/popular-menu-query.dto';
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

  @Get('popular')
  @Public()
  @ApiOperation({
    summary:
      'Самые заказываемые позиции: без архива и стоп-листа; без заказов — по порядку меню',
  })
  @ApiOkResponse({ type: [MenuItemDto] })
  getPopular(@Query() query: PopularMenuQueryDto): Promise<MenuItemDto[]> {
    return this.menuService.getPopular(query.limit ?? POPULAR_DEFAULT_LIMIT);
  }
}
