import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, type Role, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStaffDto,
  isStaffRole,
  StaffDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { hashPassword, normalizeEmail } from './password';
import { toStaffDto } from './users.mapper';

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

  // Сотрудники для админки: все, кроме клиентов; активные сверху.
  async listStaff(): Promise<StaffDto[]> {
    const staff = await this.prisma.user.findMany({
      where: { role: { not: 'client' } },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    });
    return staff.map(toStaffDto);
  }

  async createStaff(dto: CreateStaffDto): Promise<StaffDto> {
    return toStaffDto(await this.create(dto));
  }

  // Себе роль не меняем и себя не отключаем: так в системе всегда остаётся
  // хотя бы один действующий админ (править сотрудников может только админ).
  async updateStaff(
    actorId: number,
    id: number,
    dto: UpdateStaffDto,
  ): Promise<StaffDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || !isStaffRole(target.role)) {
      throw new NotFoundException('Сотрудник не найден');
    }
    if (id === actorId) {
      if (dto.role !== undefined && dto.role !== target.role) {
        throw new ConflictException('Свою роль изменить нельзя');
      }
      if (dto.isActive === false) {
        throw new ConflictException('Себя отключить нельзя');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, isActive: dto.isActive },
    });
    return toStaffDto(updated);
  }
}
