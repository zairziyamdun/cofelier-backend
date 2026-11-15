import type { User } from '../generated/prisma/client';
import { StaffDto } from './dto/staff.dto';
import { UserDto } from './dto/user-response.dto';

// Наружу — без passwordHash и служебных полей (BE-ARCH-3).
export function toUserDto(user: User): UserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function toStaffDto(user: User): StaffDto {
  return { ...toUserDto(user), isActive: user.isActive };
}
