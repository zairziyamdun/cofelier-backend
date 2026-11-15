import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MenuCategoryDto } from './dto/menu-response.dto';
import { toMenuCategoryDto } from './menu.mapper';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // Публичное меню: категории и позиции по порядку; пустые категории не показываем.
  async getPublicMenu(): Promise<MenuCategoryDto[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { items: { some: {} } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    return categories.map(toMenuCategoryDto);
  }
}
