import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SavedAddressRequest {
  /**
   * 주소에 붙일 이름
   * @example 역삼 사무실
   */
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  label: string;

  /** @example 서울 강남구 테헤란로 152 */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detailAddress?: string;

  /** @example 강남구 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sigungu?: string;

  /** @example 역삼동 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dong?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
