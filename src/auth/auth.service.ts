import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { User } from '../generated/prisma/client';
import { UserDto } from '../users/dto/user-response.dto';
import { verifyPassword } from '../users/password';
import { toUserDto } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt.strategy';

export type Session = { user: UserDto; accessToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // Одно сообщение на «нет такой почты» и «неверный пароль»: не выдаём, кто зарегистрирован.
  async login(dto: LoginDto): Promise<Session> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordOk =
      user !== null && (await verifyPassword(user.passwordHash, dto.password));
    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException('Неверная почта или пароль');
    }
    return this.createSession(user);
  }

  // Самостоятельно регистрируются только клиенты; сотрудников заводит админ.
  async register(dto: RegisterDto): Promise<Session> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: 'client',
    });
    return this.createSession(user);
  }

  private async createSession(user: User): Promise<Session> {
    const payload: JwtPayload = { sub: user.id };
    return {
      user: toUserDto(user),
      accessToken: await this.jwtService.signAsync(payload),
    };
  }
}
