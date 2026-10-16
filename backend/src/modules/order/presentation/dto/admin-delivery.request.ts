import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, Matches } from 'class-validator';
import { DeliveryFlag } from '../../application/dto/admin-delivery.result.js';

export class DeliveryMonitorRequest {
  /** 지연 알림으로 거른다 (주지 않으면 진행 중인 배달 전부). */
  @IsOptional()
  @IsEnum(DeliveryFlag)
  flag?: DeliveryFlag;
}

export class RiderCashRequest {
  /**
   * 전달한 한국 날짜
   * @example 2026-10-15
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  /** 가게에 넘긴 것만(true) / 아직 안 넘긴 것만(false). 주지 않으면 전부. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  handed?: boolean;
}

export class MarkCashHandedRequest {
  /** 가게에 넘겼으면 true, 표시를 되돌리면 false */
  @IsBoolean()
  handed: boolean;
}
