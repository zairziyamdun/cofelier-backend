import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateStaffDto, StaffDto, UpdateStaffDto } from './dto/staff.dto';
import { UsersService } from './users.service';

// Сотрудники — только админ (BACKEND.md §2).
@ApiTags('users')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Нужно войти' })
@ApiForbiddenResponse({ description: 'Недостаточно прав' })
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('staff')
  @ApiOperation({ summary: 'Сотрудники: активные сверху' })
  @ApiOkResponse({ type: [StaffDto] })
  listStaff(): Promise<StaffDto[]> {
    return this.usersService.listStaff();
  }

  @Post('staff')
  @ApiOperation({ summary: 'Новый сотрудник с временным паролем' })
  @ApiCreatedResponse({ type: StaffDto })
  @ApiBadRequestResponse({ description: 'Ошибка в полях' })
  @ApiConflictResponse({ description: 'Почта уже зарегистрирована' })
  createStaff(@Body() dto: CreateStaffDto): Promise<StaffDto> {
    return this.usersService.createStaff(dto);
  }

  @Patch('staff/:id')
  @ApiOperation({ summary: 'Сменить роль или отключить/включить сотрудника' })
  @ApiOkResponse({ type: StaffDto })
  @ApiNotFoundResponse({ description: 'Сотрудник не найден' })
  @ApiConflictResponse({ description: 'Нельзя изменить себя' })
  updateStaff(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffDto> {
    return this.usersService.updateStaff(actor.id, id, dto);
  }
}
