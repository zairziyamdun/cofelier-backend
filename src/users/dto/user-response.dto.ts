import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../generated/prisma/enums';

export class UserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'anna@example.com' })
  email!: string;

  @ApiProperty({ example: 'Анна' })
  name!: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.client })
  role!: Role;
}
