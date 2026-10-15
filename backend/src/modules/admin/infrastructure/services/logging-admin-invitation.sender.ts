import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminInvitationSender } from '../../application/ports/admin-invitation-sender.port.js';

/**
 * 초대 메일을 보내지 않고 서버 로그에 초대 링크를 남기는 구현. 메일 발송 수단을 붙이기 전까지 쓴다.
 * 운영에서는 링크를 로그에 남기지 않는다 — 그래서 운영에서는 초대가 전달되지 않는다.
 * 실제 서비스 전에 메일 발송 구현으로 바꿔 끼워야 한다.
 */
@Injectable()
export class LoggingAdminInvitationSender implements AdminInvitationSender {
  private readonly logger = new Logger(LoggingAdminInvitationSender.name);
  private readonly isProduction: boolean;
  private readonly adminWebUrl: string;

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.adminWebUrl = config
      .getOrThrow<string>('ADMIN_WEB_URL')
      .replace(/\/+$/, '');
  }

  send(invitation: { email: string; token: string }): Promise<void> {
    if (this.isProduction) {
      this.logger.warn(
        '운영자 초대 메일을 보낼 수단이 없어요. 메일 발송 구현을 연결해 주세요.',
      );
    } else {
      this.logger.log(
        `운영자 초대 링크 (${invitation.email}): ${this.adminWebUrl}/invite/${invitation.token}`,
      );
    }
    return Promise.resolve();
  }
}
