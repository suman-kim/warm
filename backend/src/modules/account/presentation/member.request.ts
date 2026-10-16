import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryRequest } from '../../../common/presentation/dto/page-query.request.js';

export class ListMembersRequest extends PageQueryRequest {
  /** 사장님(CUSTOMER), 라이더(DRIVER), 주문앱 손님(CONSUMER) */
  @IsIn(['CUSTOMER', 'DRIVER', 'CONSUMER'])
  role: 'CUSTOMER' | 'DRIVER' | 'CONSUMER';

  /** 이름, 이메일, 휴대폰 번호로 찾는다 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  /** 정상(ACTIVE) 또는 정지(SUSPENDED). 비우면 전체. */
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';
}

export class SuspendMemberRequest {
  /** 정지 기간(일): 7 또는 30. null이면 해제할 때까지 무기한. */
  @ValidateIf((_, value) => value !== null)
  @IsIn([7, 30])
  days: number | null;

  /** 정지 사유. 회원이 로그인하려 할 때 그대로 보인다. */
  @IsString()
  @Length(5, 500)
  reason: string;
}
