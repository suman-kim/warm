import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { AdminRole } from '../../domain/admin-role.js';

export class InviteAdminRequest {
  /** @example 김태윤 */
  @IsString()
  @Length(1, 50)
  name: string;

  /** @example taeyoon.kim@movo.kr */
  @IsEmail()
  email: string;

  @IsEnum(AdminRole)
  role: AdminRole;
}

export class UpdateAdminRequest {
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  /** true면 다시 활성화, false면 비활성화 */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
