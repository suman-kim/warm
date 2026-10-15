/** 운영자 초대 메일 발송기 DI 토큰. */
export const ADMIN_INVITATION_SENDER = Symbol('ADMIN_INVITATION_SENDER');

/** 운영자 초대 메일을 보내는 포트. 받은 사람은 메일의 링크에서 비밀번호를 정한다. */
export interface AdminInvitationSender {
  send(invitation: {
    email: string;
    name: string;
    /** 초대 링크에 넣을 토큰 (운영자 웹의 /invite/<token>) */
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}
