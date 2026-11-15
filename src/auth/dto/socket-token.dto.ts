import { ApiProperty } from '@nestjs/swagger';

export class SocketTokenDto {
  @ApiProperty({ description: 'JWT на 60 секунд для handshake.auth.token' })
  token!: string;
}
