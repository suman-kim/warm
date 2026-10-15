import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  refreshToken: string;
}
