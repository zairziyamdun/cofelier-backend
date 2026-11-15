import { SetMetadata } from '@nestjs/common';

import type { Role } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

// Ручка только для перечисленных ролей; остальные вошедшие получают 403.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
