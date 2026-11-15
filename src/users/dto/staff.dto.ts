import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Trim } from '../../common/transforms';
import type { Role } from '../../generated/prisma/client';
import { UserDto } from './user-response.dto';

// Роли сотрудников: клиентом через админку сделать нельзя.
export const STAFF_ROLES = ['barista', 'manager', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: Role): role is StaffRole {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

const roleMessage = 'Роль сотрудника: бариста, менеджер или админ';

export class CreateStaffDto {
  @ApiProperty({ example: 'Дана' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Имя — от 2 символов' })
  @MaxLength(60, { message: 'Имя — до 60 символов' })
  name!: string;

  @ApiProperty({ example: 'dana@cofelier.kz' })
  @Trim()
  @IsEmail({}, { message: 'Введите почту в формате name@example.com' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'temporary-pass-2026',
    minLength: 8,
    description: 'Временный пароль — админ передаёт его сотруднику сам',
  })
  @IsString()
  @MinLength(8, { message: 'Пароль — от 8 символов' })
  @MaxLength(128, { message: 'Пароль — до 128 символов' })
  password!: string;

  @ApiProperty({ enum: STAFF_ROLES, enumName: 'StaffRole' })
  @IsIn(STAFF_ROLES, { message: roleMessage })
  role!: StaffRole;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ enum: STAFF_ROLES, enumName: 'StaffRole' })
  @IsOptional()
  @IsIn(STAFF_ROLES, { message: roleMessage })
  role?: StaffRole;

  @ApiPropertyOptional({ description: 'false — сотрудник не может войти' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StaffDto extends UserDto {
  @ApiProperty({ description: 'false — отключён, войти не может' })
  isActive!: boolean;
}
