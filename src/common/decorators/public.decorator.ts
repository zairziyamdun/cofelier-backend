import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Ручка открыта без входа. Глобальный JwtAuthGuard (этап 3) пропускает такие ручки.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
