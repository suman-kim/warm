import { Paged, PageRequest } from '../../../../common/domain/pagination.js';
import { Notification } from '../entities/notification.entity.js';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export const NOTIFICATION_SETTING_REPOSITORY = Symbol(
  'NOTIFICATION_SETTING_REPOSITORY',
);

/** 알림함 저장소 계약. */
export interface NotificationRepository {
  saveAll(notifications: Notification[]): Promise<void>;
  /** 최근 것부터. */
  findByUser(userId: string, page: PageRequest): Promise<Paged<Notification>>;
  countUnread(userId: string): Promise<number>;
  /** 내 알림일 때만 읽음으로 바꾼다. */
  markRead(userId: string, id: string, now: Date): Promise<void>;
  markAllRead(userId: string, now: Date): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

/** 알림 설정 저장소 계약. 설정한 적 없는 회원은 푸시를 받는 것으로 본다. */
export interface NotificationSettingRepository {
  isPushEnabled(userId: string): Promise<boolean>;
  /** 주어진 회원 중 푸시를 꺼 둔 회원. */
  findPushDisabled(userIds: string[]): Promise<Set<string>>;
  save(userId: string, pushEnabled: boolean): Promise<void>;
  /** 회원의 설정을 지운다 (탈퇴). */
  deleteByUser(userId: string): Promise<void>;
}
