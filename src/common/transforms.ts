import { Transform } from 'class-transformer';

// Обрезает пробелы до валидации: почту и имя часто вставляют с пробелами по краям.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
