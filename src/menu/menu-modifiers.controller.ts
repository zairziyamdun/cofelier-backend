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
import { ManagedMenuItemDto } from './dto/menu-manage.dto';
import {
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  ManagedModifierGroupDto,
  SetItemModifierGroupsDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
} from './dto/menu-modifiers.dto';
import { MenuModifiersService } from './menu-modifiers.service';

// Добавки — часть управления меню: только менеджер и админ.
@ApiTags('menu-admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Нужно войти' })
@ApiForbiddenResponse({ description: 'Недостаточно прав' })
@Roles('manager', 'admin')
@Controller('menu')
export class MenuModifiersController {
  constructor(private readonly modifiers: MenuModifiersService) {}

  @Get('modifier-groups')
  @ApiOperation({ summary: 'Все группы добавок с вариантами' })
  @ApiOkResponse({ type: [ManagedModifierGroupDto] })
  list(): Promise<ManagedModifierGroupDto[]> {
    return this.modifiers.list();
  }

  @Post('modifier-groups')
  @ApiOperation({ summary: 'Новая группа добавок (можно сразу с вариантами)' })
  @ApiCreatedResponse({ type: ManagedModifierGroupDto })
  @ApiBadRequestResponse({ description: 'Ошибка в полях или в настройках' })
  createGroup(
    @Body() dto: CreateModifierGroupDto,
  ): Promise<ManagedModifierGroupDto> {
    return this.modifiers.createGroup(dto);
  }

  @Patch('modifier-groups/:id')
  @ApiOperation({
    summary: 'Правка группы: название, тип, обязательность, лимит',
  })
  @ApiOkResponse({ type: ManagedModifierGroupDto })
  @ApiNotFoundResponse({ description: 'Группа не найдена' })
  updateGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModifierGroupDto,
  ): Promise<ManagedModifierGroupDto> {
    return this.modifiers.updateGroup(id, dto);
  }

  @Delete('modifier-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить группу (старые заказы не меняются)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Группа не найдена' })
  deleteGroup(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.modifiers.deleteGroup(id);
  }

  @Post('modifier-groups/:id/options')
  @ApiOperation({ summary: 'Новый вариант в группе (в конец)' })
  @ApiCreatedResponse({ type: ManagedModifierGroupDto })
  @ApiNotFoundResponse({ description: 'Группа не найдена' })
  addOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateModifierOptionDto,
  ): Promise<ManagedModifierGroupDto> {
    return this.modifiers.addOption(id, dto);
  }

  @Patch('modifier-options/:id')
  @ApiOperation({ summary: 'Правка варианта, в том числе стоп-лист' })
  @ApiOkResponse({ type: ManagedModifierGroupDto })
  @ApiNotFoundResponse({ description: 'Вариант не найден' })
  updateOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModifierOptionDto,
  ): Promise<ManagedModifierGroupDto> {
    return this.modifiers.updateOption(id, dto);
  }

  @Delete('modifier-options/:id')
  @ApiOperation({ summary: 'Удалить вариант' })
  @ApiOkResponse({ type: ManagedModifierGroupDto })
  @ApiNotFoundResponse({ description: 'Вариант не найден' })
  deleteOption(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ManagedModifierGroupDto> {
    return this.modifiers.deleteOption(id);
  }

  @Put('items/:id/modifier-groups')
  @ApiOperation({ summary: 'Группы добавок позиции целиком, в порядке показа' })
  @ApiOkResponse({ type: ManagedMenuItemDto })
  @ApiNotFoundResponse({ description: 'Позиция или группа не найдена' })
  setItemGroups(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetItemModifierGroupsDto,
  ): Promise<ManagedMenuItemDto> {
    return this.modifiers.setItemGroups(id, dto.groupIds);
  }
}
