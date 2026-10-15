import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderRequest {
  /** 취소 사유 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
