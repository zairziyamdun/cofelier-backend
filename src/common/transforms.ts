import { Transform } from 'class-transformer';

// Обрезает пробелы до валидации: почту и имя часто вставляют с пробелами по краям.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// Для необязательного текста: пробелы обрезаются, пустая строка — null («очистить поле»).
export const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
