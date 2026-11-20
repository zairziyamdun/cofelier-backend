import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const POPULAR_DEFAULT_LIMIT = 4;
export const POPULAR_MAX_LIMIT = 12;

export class PopularMenuQueryDto {
  @ApiPropertyOptional({
    description: 'Сколько позиций вернуть',
    minimum: 1,
    maximum: POPULAR_MAX_LIMIT,
    default: POPULAR_DEFAULT_LIMIT,
  })
  @IsOptional()
  // Query приходит строкой: без приведения @IsInt отклонит «4».
  @Type(() => Number)
  @IsInt({ message: 'limit — целое число' })
  @Min(1, { message: 'limit — от 1' })
  @Max(POPULAR_MAX_LIMIT, { message: `limit — до ${POPULAR_MAX_LIMIT}` })
  limit?: number;
}
