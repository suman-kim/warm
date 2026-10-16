import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsSender } from '../../application/ports/sms-sender.port.js';

/**
 * 문자를 보내지 않고 서버 로그에 남기는 구현. 문자 발송 업체를 붙이기 전까지 쓴다 (작업 28).
 * 운영에서는 코드를 로그에 남기지 않는다 — 그래서 운영에서는 인증 코드가 전달되지 않는다.
 */
@Injectable()
export class LoggingSmsSender implements SmsSender {
  private readonly logger = new Logger(LoggingSmsSender.name);
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  sendVerificationCode(phone: string, code: string): Promise<void> {
    if (this.isProduction) {
      this.logger.warn(
        '휴대폰 인증 코드를 보낼 문자 발송 수단이 없어요. 문자 발송 구현을 연결해 주세요.',
      );
    } else {
      this.logger.log(`휴대폰 인증 코드 (${phone}): ${code}`);
    }
    return Promise.resolve();
  }
}
