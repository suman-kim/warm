import { PushDevice } from '../entities/push-device.entity.js';

/** 푸시 기기 저장소 DI 토큰. */
export const PUSH_DEVICE_REPOSITORY = Symbol('PUSH_DEVICE_REPOSITORY');

/** 푸시 기기 저장소 계약. */
export interface PushDeviceRepository {
  /**
   * 토큰을 이 회원의 기기로 등록한다. 이미 등록된 토큰이면 소유자와 확인 시각만 바꾼다 —
   * 같은 휴대폰에서 다른 계정으로 로그인하면 알림이 새 계정으로 간다.
   */
  save(device: PushDevice): Promise<void>;
  /** 이 회원의 기기일 때만 지운다. */
  deleteByUserAndToken(userId: string, token: string): Promise<void>;
  deleteByTokens(tokens: string[]): Promise<void>;
  /** 그 회원의 기기를 모두 지운다 (탈퇴). */
  deleteByUser(userId: string): Promise<void>;
  findTokensByUserIds(userIds: string[]): Promise<string[]>;
}
