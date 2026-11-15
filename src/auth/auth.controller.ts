import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env';
import { UserDto } from '../users/dto/user-response.dto';
import { ACCESS_TOKEN_COOKIE, accessTokenCookieOptions } from './auth-cookie';
import { AuthService, type Session } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход: ставит httpOnly-cookie с токеном' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'Неверная почта или пароль' })
  @ApiTooManyRequestsResponse({ description: 'Слишком много попыток' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.startSession(await this.authService.login(dto), response);
  }

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Регистрация клиента и сразу вход' })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Почта уже зарегистрирована' })
  @ApiTooManyRequestsResponse({ description: 'Слишком много попыток' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.startSession(await this.authService.register(dto), response);
  }

  // Публичная: выйти можно и с просроченным токеном.
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Выход: удаляет cookie' })
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) response: Response): void {
    // Express 5 сам игнорирует maxAge в clearCookie; путь и домен должны совпасть.
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Текущий пользователь' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'Нужно войти' })
  me(@CurrentUser() user: AuthUser): UserDto {
    return user;
  }

  private startSession(session: Session, response: Response): UserDto {
    response.cookie(
      ACCESS_TOKEN_COOKIE,
      session.accessToken,
      this.cookieOptions(),
    );
    return session.user;
  }

  private cookieOptions() {
    return accessTokenCookieOptions({
      NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
      JWT_TTL_SECONDS: this.config.get('JWT_TTL_SECONDS', { infer: true }),
      COOKIE_DOMAIN: this.config.get('COOKIE_DOMAIN', { infer: true }),
    });
  }
}
