import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginRequest {
  /** @example customer@example.com */
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
