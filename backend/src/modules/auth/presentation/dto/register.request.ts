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
  IsOptional,
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

  /** 가입 유형: CUSTOMER(가게 사장님) | DRIVER(라이더) | CONSUMER(주문앱 손님) */
  @IsIn([UserRole.CUSTOMER, UserRole.DRIVER, UserRole.CONSUMER])
  role: UserRole;

  /**
   * 휴대폰 인증 토큰 (`POST /auth/phone-verifications/confirm`의 응답).
   * 손님 가입에 휴대폰 인증이 필요하면(정책) 꼭 보낸다. 번호가 [phone]과 같아야 한다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneVerificationToken?: string;

  /** 약관 동의. 필수 항목에 동의하지 않으면 가입되지 않는다. */
  @IsObject()
  @ValidateNested()
  @Type(() => AgreementsRequest)
  agreements: AgreementsRequest;
}
