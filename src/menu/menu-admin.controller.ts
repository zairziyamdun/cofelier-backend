import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  ManagedMenuCategoryDto,
  ManagedMenuItemDto,
  ReorderMenuCategoriesDto,
  SetStopListDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
} from './dto/menu-manage.dto';
import { MenuAdminService } from './menu-admin.service';

// Управление меню — только менеджер и админ (BACKEND.md §2).
@ApiTags('menu-admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Нужно войти' })
@ApiForbiddenResponse({ description: 'Недостаточно прав' })
@Roles('manager', 'admin')
@Controller('menu')
export class MenuAdminController {
  constructor(private readonly menuAdmin: MenuAdminService) {}

  @Get('manage')
  @ApiOperation({ summary: 'Меню для панели: все категории и позиции' })
  @ApiOkResponse({ type: [ManagedMenuCategoryDto] })
  getManagedMenu(): Promise<ManagedMenuCategoryDto[]> {
    return this.menuAdmin.getManagedMenu();
  }

  @Post('items')
  @ApiOperation({ summary: 'Новая позиция' })
  @ApiCreatedResponse({ type: ManagedMenuItemDto })
  @ApiBadRequestResponse({ description: 'Ошибка в полях' })
  @ApiNotFoundResponse({ description: 'Категория не найдена' })
  createItem(@Body() dto: CreateMenuItemDto): Promise<ManagedMenuItemDto> {
    return this.menuAdmin.createItem(dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Правка позиции: только переданные поля' })
  @ApiOkResponse({ type: ManagedMenuItemDto })
  @ApiNotFoundResponse({ description: 'Позиция или категория не найдена' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<ManagedMenuItemDto> {
    return this.menuAdmin.updateItem(id, dto);
  }

  @Patch('items/:id/stop-list')
  @ApiOperation({ summary: 'Поставить в стоп-лист или вернуть в продажу' })
  @ApiOkResponse({ type: ManagedMenuItemDto })
  @ApiNotFoundResponse({ description: 'Позиция не найдена' })
  setStopList(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetStopListDto,
  ): Promise<ManagedMenuItemDto> {
    return this.menuAdmin.setStopList(id, dto.inStopList);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить позицию' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Позиция не найдена' })
  deleteItem(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.menuAdmin.deleteItem(id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Новая категория (в конец меню)' })
  @ApiCreatedResponse({ type: ManagedMenuCategoryDto })
  createCategory(
    @Body() dto: CreateMenuCategoryDto,
  ): Promise<ManagedMenuCategoryDto> {
    return this.menuAdmin.createCategory(dto);
  }

  // Статичный путь объявлен раньше categories/:id, чтобы «order» не принять за id.
  @Put('categories/order')
  @ApiOperation({ summary: 'Новый порядок категорий' })
  @ApiOkResponse({ type: [ManagedMenuCategoryDto] })
  @ApiBadRequestResponse({ description: 'Не все категории или повторы' })
  reorderCategories(
    @Body() dto: ReorderMenuCategoriesDto,
  ): Promise<ManagedMenuCategoryDto[]> {
    return this.menuAdmin.reorderCategories(dto.ids);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Переименовать категорию' })
  @ApiOkResponse({ type: ManagedMenuCategoryDto })
  @ApiNotFoundResponse({ description: 'Категория не найдена' })
  renameCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuCategoryDto,
  ): Promise<ManagedMenuCategoryDto> {
    return this.menuAdmin.renameCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить пустую категорию' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'В категории есть позиции' })
  @ApiNotFoundResponse({ description: 'Категория не найдена' })
  deleteCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.menuAdmin.deleteCategory(id);
  }
}
