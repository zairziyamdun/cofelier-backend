import { ConflictException, Injectable } from '@nestjs/common';

import { Prisma, type Role, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserDto } from './dto/user-response.dto';
import { hashPassword, normalizeEmail } from './password';
import { toUserDto } from './users.mapper';

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  findActiveById(id: number): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash: await hashPassword(input.password),
          name: input.name.trim(),
          role: input.role,
        },
      });
    } catch (error) {
      // P2002 — нарушена уникальность email, в том числе при гонке двух регистраций.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Эта почта уже зарегистрирована');
      }
      throw error;
    }
  }

  // Сотрудники для админки: все, кроме клиентов.
  async listStaff(): Promise<UserDto[]> {
    const staff = await this.prisma.user.findMany({
      where: { role: { not: 'client' } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return staff.map(toUserDto);
  }
}
