import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestPasswordResetRequest {
  /** 가입한 이메일 */
  @IsEmail()
  email: string;
}

export class ConfirmPasswordResetRequest {
  @IsEmail()
  email: string;

  /** 이메일로 받은 6자리 인증 코드 */
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  /** 새 비밀번호. 8~72자, 영문과 숫자 포함 */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
