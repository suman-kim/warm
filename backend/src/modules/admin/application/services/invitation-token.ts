import { createHash, randomBytes } from 'node:crypto';

/** 초대 링크에 넣을 새 토큰. 서버에는 해시만 남긴다. */
export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
