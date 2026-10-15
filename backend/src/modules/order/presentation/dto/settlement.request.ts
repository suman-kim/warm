import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

const KST_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SettlementWeekRequest {
  /**
   * 주의 시작 — 월요일인 한국 날짜. 비우면 가장 최근에 끝난 주.
   * @example 2026-10-05
   */
  @IsOptional()
  @Matches(KST_DATE)
  weekStart?: string;
}

export class PaySettlementsRequest {
  /** @example 2026-10-05 */
  @Matches(KST_DATE)
  weekStart: string;

  /** 지급 처리할 기사들 (drivers.id) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  driverIds: string[];
}
