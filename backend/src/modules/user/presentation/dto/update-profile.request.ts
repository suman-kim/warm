import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  /** @example 010-1234-5678 */
  @IsOptional()
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, {
    message: 'phone must be a mobile phone number',
  })
  phone?: string;

  /** 마케팅 정보 수신 동의 */
  @IsOptional()
  @IsBoolean()
  marketingAgreed?: boolean;
}
