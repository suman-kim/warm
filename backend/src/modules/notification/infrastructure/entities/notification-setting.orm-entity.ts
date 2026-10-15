import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 알림 설정 ORM 엔티티. 설정을 바꾼 회원만 행이 있다. */
@Entity({ name: 'notification_settings', comment: '회원별 알림 설정' })
export class NotificationSettingOrmEntity {
  @PrimaryColumn('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('boolean', { name: 'push_enabled', comment: '푸시 알림을 받을지' })
  pushEnabled: boolean;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바꾼 시각',
  })
  updatedAt: Date;
}
