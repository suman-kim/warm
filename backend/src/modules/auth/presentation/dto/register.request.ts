import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '../../../../common/domain/user-role.js';

export class AgreementsRequest {
  /** [필수] 이용약관 동의 */
  @IsBoolean()
  terms: boolean;

  /** [필수] 개인정보 수집·이용 동의 */
  @IsBoolean()
  privacy: boolean;

  /** [선택] 마케팅 정보 수신 동의 */
  @IsBoolean()
  marketing: boolean;
}

export class RegisterRequest {
  /** @example jieun.kim@gmail.com */
  @IsEmail()
  @MaxLength(255)
  email: string;

  /** 8~72자, 영문과 숫자 포함 */
  @IsString()
  @MinLength(8)
  // bcrypt는 72바이트까지만 본다.
  @MaxLength(72)
  password: string;

  /** @example 김지은 */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  /**
   * 휴대폰 번호 (하이픈 있어도 됨)
   * @example 010-1234-5678
   */
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, {
    message: 'phone must be a mobile phone number',
  })
  phone: string;

  /** 가입 유형: 고객 또는 기사 */
  @IsIn([UserRole.CUSTOMER, UserRole.DRIVER])
  role: UserRole;

  /** 약관 동의. 필수 항목에 동의하지 않으면 가입되지 않는다. */
  @IsObject()
  @ValidateNested()
  @Type(() => AgreementsRequest)
  agreements: AgreementsRequest;
}
