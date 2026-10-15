import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResetCodeSender } from '../../application/ports/reset-code-sender.port.js';

/**
 * 인증 코드를 보내지 않고 서버 로그에 남기는 구현. 메일 발송 수단을 붙이기 전까지 쓴다.
 * 운영에서는 코드를 로그에 남기지 않는다 — 그래서 운영에서는 코드가 전달되지 않는다.
 * 실제 서비스 전에 이메일(또는 문자) 발송 구현으로 바꿔 끼워야 한다.
 */
@Injectable()
export class LoggingResetCodeSender implements ResetCodeSender {
  private readonly logger = new Logger(LoggingResetCodeSender.name);
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  send(email: string, code: string): Promise<void> {
    if (this.isProduction) {
      this.logger.warn(
        '비밀번호 재설정 코드를 보낼 수단이 없어요. 메일 발송 구현을 연결해 주세요.',
      );
    } else {
      this.logger.log(`비밀번호 재설정 코드 (${email}): ${code}`);
    }
    return Promise.resolve();
  }
}
