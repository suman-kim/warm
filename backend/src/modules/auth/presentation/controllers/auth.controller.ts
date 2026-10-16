import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminInvitationResult } from '../../../admin/application/dto/admin-account.result.js';
import { AuthTokensResult } from '../../application/dto/auth-tokens.result.js';
import { AdminInvitationUseCase } from '../../application/use-cases/admin-invitation.use-case.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { PasswordResetUseCase } from '../../application/use-cases/password-reset.use-case.js';
import {
  PhoneCodeSentResult,
  PhoneVerificationUseCase,
  PhoneVerifiedResult,
} from '../../application/use-cases/phone-verification.use-case.js';
import { RefreshTokensUseCase } from '../../application/use-cases/refresh-tokens.use-case.js';
import { RegisterUseCase } from '../../application/use-cases/register.use-case.js';
import { Public } from '../decorators/public.decorator.js';
import { AcceptAdminInvitationRequest } from '../dto/admin-invitation.request.js';
import { LoginRequest } from '../dto/login.request.js';
import {
  ConfirmPasswordResetRequest,
  RequestPasswordResetRequest,
} from '../dto/password-reset.request.js';
import { RefreshTokenRequest } from '../dto/refresh-token.request.js';
import {
  ConfirmPhoneVerificationRequest,
  RequestPhoneVerificationRequest,
} from '../dto/phone-verification.request.js';
import { RegisterRequest } from '../dto/register.request.js';

/** 인증 컨트롤러. `/auth` 경로. 로그인 없이 부른다. */
@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokensUseCase: RefreshTokensUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly passwordResetUseCase: PasswordResetUseCase,
    private readonly adminInvitationUseCase: AdminInvitationUseCase,
    private readonly phoneVerificationUseCase: PhoneVerificationUseCase,
  ) {}

  /** 회원가입 (사장님·라이더·주문앱 손님) */
  @Post('register')
  register(@Body() body: RegisterRequest): Promise<AuthTokensResult> {
    return this.registerUseCase.execute(body);
  }

  /** 휴대폰 인증 코드 받기 (문자, 5분 유효, 1분에 한 번) */
  @Post('phone-verifications')
  requestPhoneVerification(
    @Body() body: RequestPhoneVerificationRequest,
  ): Promise<PhoneCodeSentResult> {
    return this.phoneVerificationUseCase.request(body.phone);
  }

  /** 휴대폰 인증 코드 확인. 맞으면 가입에 쓰는 인증 토큰을 준다 (30분, 한 번). */
  @Post('phone-verifications/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPhoneVerification(
    @Body() body: ConfirmPhoneVerificationRequest,
  ): Promise<PhoneVerifiedResult> {
    return this.phoneVerificationUseCase.confirm(body.phone, body.code);
  }

  /** 로그인 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginRequest): Promise<AuthTokensResult> {
    return this.loginUseCase.execute(body.email, body.password);
  }

  /** 토큰 갱신. 쓴 리프레시 토큰은 폐기된다. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshTokenRequest): Promise<AuthTokensResult> {
    return this.refreshTokensUseCase.execute(body.refreshToken);
  }

  /** 비밀번호 찾기 1단계 — 이메일로 6자리 인증 코드를 보낸다. 가입하지 않은 이메일이어도 204. */
  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  requestPasswordReset(
    @Body() body: RequestPasswordResetRequest,
  ): Promise<void> {
    return this.passwordResetUseCase.request(body.email);
  }

  /** 비밀번호 찾기 2단계 — 인증 코드와 새 비밀번호. 바뀌면 모든 기기에서 로그아웃된다. */
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmPasswordReset(
    @Body() body: ConfirmPasswordResetRequest,
  ): Promise<void> {
    return this.passwordResetUseCase.confirm(
      body.email,
      body.code,
      body.newPassword,
    );
  }

  /** 운영자 초대 확인 — 초대 링크가 살아 있으면 누구를 초대했는지 알려 준다. */
  @Get('admin-invitations/:token')
  adminInvitation(
    @Param('token') token: string,
  ): Promise<AdminInvitationResult> {
    return this.adminInvitationUseCase.find(token);
  }

  /** 운영자 초대 수락 — 비밀번호를 정하면 바로 로그인된다. */
  @Post('admin-invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptAdminInvitation(
    @Param('token') token: string,
    @Body() body: AcceptAdminInvitationRequest,
  ): Promise<AuthTokensResult> {
    return this.adminInvitationUseCase.accept(token, body.password);
  }

  /** 로그아웃 */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: RefreshTokenRequest): Promise<void> {
    return this.logoutUseCase.execute(body.refreshToken);
  }
}
