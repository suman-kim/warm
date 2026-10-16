import { IsString, Matches } from 'class-validator';

export class RequestPhoneVerificationRequest {
  /** 휴대폰 번호 (하이픈이 있어도 된다) @example 010-1234-5678 */
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, {
    message: 'phone must be a mobile phone number',
  })
  phone: string;
}

export class ConfirmPhoneVerificationRequest extends RequestPhoneVerificationRequest {
  /** 문자로 받은 6자리 코드 @example 123456 */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
