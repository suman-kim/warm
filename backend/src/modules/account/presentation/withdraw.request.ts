import { IsString, MaxLength, MinLength } from 'class-validator';

export class WithdrawRequest {
  /** 본인 확인용 현재 비밀번호 */
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
