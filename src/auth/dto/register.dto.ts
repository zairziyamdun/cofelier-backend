import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { Trim } from '../../common/transforms';

export class RegisterDto {
  @ApiProperty({ example: 'Анна' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Имя — от 2 символов' })
  @MaxLength(60, { message: 'Имя — до 60 символов' })
  name!: string;

  @ApiProperty({ example: 'anna@example.com' })
  @Trim()
  @IsEmail({}, { message: 'Введите почту в формате name@example.com' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Пароль — от 8 символов' })
  @MaxLength(128, { message: 'Пароль — до 128 символов' })
  password!: string;
}
