import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthUser } from '../common/auth-user';
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

  // Для WebSocket: та же проверка, что у JwtStrategy, — подпись, срок и активный пользователь.
  async userFromToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersService.findActiveById(payload.sub);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } catch {
      return null;
    }
  }

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
