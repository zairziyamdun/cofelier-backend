import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Те же правила проверяет форма регистрации на фронте — менять вместе.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;

export const PASSWORD_RULES_DESCRIPTION = `От ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов, хотя бы одна буква и одна цифра`;

// Пароль, который задаётся впервые (регистрация, новый сотрудник); вход его не проверяет.
export const NewPassword = () =>
  applyDecorators(
    IsString({ message: 'Пароль — строка' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Пароль — от ${PASSWORD_MIN_LENGTH} символов`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `Пароль — до ${PASSWORD_MAX_LENGTH} символов`,
    }),
    Matches(HAS_LETTER, { message: 'В пароле нужна хотя бы одна буква' }),
    Matches(HAS_DIGIT, { message: 'В пароле нужна хотя бы одна цифра' }),
  );
