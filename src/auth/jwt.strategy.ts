import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser } from '../common/auth-user';
import type { Env } from '../config/env';
import { UsersService } from '../users/users.service';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie';

export type JwtPayload = { sub: number };

function fromCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie]),
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      ignoreExpiration: false,
    });
  }

  // Роль и активность — из БД на каждый запрос: смена роли и отключение
  // сотрудника действуют сразу, а не после истечения токена.
  async validate(payload: JwtPayload): Promise<AuthUser | null> {
    const user = await this.usersService.findActiveById(payload.sub);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
