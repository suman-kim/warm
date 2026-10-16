import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module.js';
import { AdminAccessGuard } from '../admin/presentation/guards/admin-access.guard.js';
import { ContentModule } from '../content/content.module.js';
import { UserModule } from '../user/user.module.js';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port.js';
import { RESET_CODE_SENDER } from './application/ports/reset-code-sender.port.js';
import { TOKEN_SERVICE } from './application/ports/token-service.port.js';
import { TokenPairIssuer } from './application/services/token-pair.issuer.js';
import { AdminInvitationUseCase } from './application/use-cases/admin-invitation.use-case.js';
import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { PasswordResetUseCase } from './application/use-cases/password-reset.use-case.js';
import { RefreshTokensUseCase } from './application/use-cases/refresh-tokens.use-case.js';
import { RegisterUseCase } from './application/use-cases/register.use-case.js';
import { LOGIN_ATTEMPT_REPOSITORY } from './domain/repositories/login-attempt.repository.js';
import { PASSWORD_RESET_CODE_REPOSITORY } from './domain/repositories/password-reset-code.repository.js';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.js';
import { LoginAttemptOrmEntity } from './infrastructure/entities/login-attempt.orm-entity.js';
import { PasswordResetCodeOrmEntity } from './infrastructure/entities/password-reset-code.orm-entity.js';
import { RefreshTokenOrmEntity } from './infrastructure/entities/refresh-token.orm-entity.js';
import { LoginAttemptTypeormRepository } from './infrastructure/repositories/login-attempt.typeorm.repository.js';
import { PasswordResetCodeTypeormRepository } from './infrastructure/repositories/password-reset-code.typeorm.repository.js';
import { RefreshTokenTypeormRepository } from './infrastructure/repositories/refresh-token.typeorm.repository.js';
import { BcryptPasswordHasher } from './infrastructure/services/bcrypt-password.hasher.js';
import { JwtTokenService } from './infrastructure/services/jwt-token.service.js';
import { LoggingResetCodeSender } from './infrastructure/services/logging-reset-code.sender.js';
import { PlatformPolicyModule } from '../platform-policy/platform-policy.module.js';
import { SMS_SENDER } from './application/ports/sms-sender.port.js';
import { PhoneVerificationUseCase } from './application/use-cases/phone-verification.use-case.js';
import { PHONE_VERIFICATION_REPOSITORY } from './domain/repositories/phone-verification.repository.js';
import { PhoneVerificationOrmEntity } from './infrastructure/entities/phone-verification.orm-entity.js';
import { PhoneVerificationTypeormRepository } from './infrastructure/repositories/phone-verification.typeorm.repository.js';
import { LoggingSmsSender } from './infrastructure/services/logging-sms.sender.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';

/** 인증 모듈. 가입·로그인·토큰 갱신과, 모든 라우트에 적용되는 인증·역할 가드를 제공한다. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshTokenOrmEntity,
      PasswordResetCodeOrmEntity,
      LoginAttemptOrmEntity,
      PhoneVerificationOrmEntity,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
    }),
    UserModule,
    // 가입할 때 약관 동의를 판 번호와 함께 남긴다.
    ContentModule,
    AdminModule,
    // 손님 가입에 휴대폰 인증이 필요한지는 정책으로 정한다.
    PlatformPolicyModule,
  ],
  controllers: [AuthController],
  providers: [
    TokenPairIssuer,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
    AuthenticateUseCase,
    PasswordResetUseCase,
    AdminInvitationUseCase,
    PhoneVerificationUseCase,
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    {
      provide: PHONE_VERIFICATION_REPOSITORY,
      useClass: PhoneVerificationTypeormRepository,
    },
    // TODO: 문자 발송 업체를 붙이면 그 구현으로 바꾼다 (작업 28). 지금은 개발 서버 로그에만 남긴다.
    { provide: SMS_SENDER, useClass: LoggingSmsSender },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: RefreshTokenTypeormRepository,
    },
    {
      provide: PASSWORD_RESET_CODE_REPOSITORY,
      useClass: PasswordResetCodeTypeormRepository,
    },
    {
      provide: LOGIN_ATTEMPT_REPOSITORY,
      useClass: LoginAttemptTypeormRepository,
    },
    { provide: RESET_CODE_SENDER, useClass: LoggingResetCodeSender },
    // 전역 가드는 등록 순서대로 돈다: 인증 → 역할 → 운영자 권한.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminAccessGuard },
  ],
  // 탈퇴할 때 비밀번호를 확인하고 모든 기기를 로그아웃시킨다.
  exports: [PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY],
})
export class AuthModule {}
