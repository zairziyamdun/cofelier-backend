import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NewPassword } from './password-policy';

class PasswordInput {
  @NewPassword()
  password!: string;
}

async function errorsFor(password: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(PasswordInput, { password }));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('NewPassword', () => {
  it.each(['coffee42', 'кофе2026', 'A1bcdefg', 'a'.repeat(127) + '1'])(
    'принимает %s',
    async (password) => {
      expect(await errorsFor(password)).toEqual([]);
    },
  );

  it.each([
    ['короткий', 'abc12', 'Пароль — от 8 символов'],
    ['без цифры', 'coffeetime', 'В пароле нужна хотя бы одна цифра'],
    ['без буквы', '12345678', 'В пароле нужна хотя бы одна буква'],
    ['длинный', 'a1'.repeat(65), 'Пароль — до 128 символов'],
  ])('отклоняет %s', async (_name, password, message) => {
    expect(await errorsFor(password)).toContain(message);
  });

  it('отклоняет не строку', async () => {
    expect(await errorsFor(12345678)).toContain('Пароль — строка');
  });
});
