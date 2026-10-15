import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterPaymentMethodRequest {
  /**
   * PG사 카드 등록 화면이 돌려준 값.
   * 포트원(provider PORTONE)은 등록 창이 돌려준 빌링키, 개발용 연동(provider DEV)은 `dev:<카드사>:<끝 4자리>:<CREDIT|CHECK>`.
   * @example dev:신한카드:4821:CREDIT
   */
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  authKey: string;

  /** 기본 카드로 정할지. 처음 등록하는 카드는 늘 기본 카드가 된다. */
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;
}
