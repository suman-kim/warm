import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { StoreSettlementCycle } from '../domain/marketplace-policy.js';

/** 주문앱 정책 바꾸기. 준 칸만 바뀐다. */
export class UpdateMarketplacePolicyRequest {
  /** 중개수수료(%) — 메뉴 금액 기준, 소수 둘째 자리까지 @example 2 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(30)
  commissionRatePercent?: number;

  /** 결제수수료 중 가게가 내는 몫(%) — 0이면 플랫폼이 낸다 @example 0 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  paymentFeeRatePercent?: number;

  /** 손님 가입 때 휴대폰 인증을 받을지 */
  @IsOptional()
  @IsBoolean()
  consumerPhoneVerificationRequired?: boolean;

  /** 가게 정산 주기: DAILY(완료일 + N일) | WEEKLY(다음 주 정한 요일) */
  @IsOptional()
  @IsEnum(StoreSettlementCycle)
  storeSettlementCycle?: StoreSettlementCycle;

  /** DAILY일 때 완료일에서 며칠 뒤에 주는지 @example 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  storeSettlementDelayDays?: number;

  /** WEEKLY일 때 지급 요일. 0 = 일요일 … 6 = 토요일 @example 3 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  storeSettlementPayoutWeekday?: number;

  /** 결제한 주문을 이 분 안에 가게가 받지 않으면 '접수 지연' @example 5 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  storeAcceptLateMinutes?: number;

  /** 배달이 끝나고 리뷰를 쓸 수 있는 날 수 @example 7 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  reviewWindowDays?: number;
}
