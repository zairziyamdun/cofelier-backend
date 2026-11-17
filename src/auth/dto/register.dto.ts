import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import {
  NewPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES_DESCRIPTION,
} from '../../common/password-policy';
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

  @ApiProperty({
    example: 'coffee-time-42',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: PASSWORD_RULES_DESCRIPTION,
  })
  @NewPassword()
  password!: string;
}
