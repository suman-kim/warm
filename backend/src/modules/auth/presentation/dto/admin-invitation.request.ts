import { IsString, MaxLength } from 'class-validator';

export class AcceptAdminInvitationRequest {
  /** 영문과 숫자를 포함해 8자 이상 */
  @IsString()
  @MaxLength(72)
  password: string;
}
