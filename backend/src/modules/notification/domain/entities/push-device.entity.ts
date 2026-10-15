import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 푸시를 받는 기기 종류. */
export enum PushPlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

export const MAX_PUSH_TOKEN_LENGTH = 1024;

/**
 * 푸시를 받을 기기 하나 = 푸시 토큰 하나.
 * 회원 한 명이 여러 기기를 쓸 수 있어 회원당 여러 개다. 토큰은 앱 설치마다 다르므로
 * 고객 앱과 기사 앱을 한 휴대폰에 깔아도 서로 다른 기기로 등록된다.
 */
export class PushDevice {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly token: string,
    readonly platform: PushPlatform,
    readonly createdAt: Date,
    /** 앱이 마지막으로 이 토큰을 등록(확인)한 시각 */
    readonly updatedAt: Date,
  ) {}

  static register(input: {
    id: string;
    userId: string;
    token: string;
    platform: PushPlatform;
    now: Date;
  }): PushDevice {
    const token = input.token.trim();
    if (!token || token.length > MAX_PUSH_TOKEN_LENGTH) {
      throw new InvalidArgumentError(
        'INVALID_PUSH_TOKEN',
        '푸시 토큰이 올바르지 않아요.',
      );
    }
    return new PushDevice(
      input.id,
      input.userId,
      token,
      input.platform,
      input.now,
      input.now,
    );
  }
}
