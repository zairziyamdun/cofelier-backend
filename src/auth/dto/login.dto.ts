import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { Trim } from '../../common/transforms';

export class LoginDto {
  @ApiProperty({ example: 'anna@example.com' })
  @Trim()
  @IsEmail({}, { message: 'Введите почту в формате name@example.com' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'correct-horse-battery' })
  @IsString()
  @MinLength(1, { message: 'Введите пароль' })
  @MaxLength(128)
  password!: string;
}
