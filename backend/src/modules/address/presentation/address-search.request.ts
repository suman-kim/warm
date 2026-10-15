import { IsString, MaxLength } from 'class-validator';

export class AddressSearchQuery {
  /**
   * 도로명·지번 주소나 건물·장소 이름
   * @example 테헤란로 152
   */
  @IsString()
  @MaxLength(100)
  query: string;
}
