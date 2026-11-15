import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { UserDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('staff')
  @Roles('admin')
  @ApiOperation({ summary: 'Сотрудники (только админ)' })
  @ApiOkResponse({ type: [UserDto] })
  @ApiUnauthorizedResponse({ description: 'Нужно войти' })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  listStaff(): Promise<UserDto[]> {
    return this.usersService.listStaff();
  }
}
