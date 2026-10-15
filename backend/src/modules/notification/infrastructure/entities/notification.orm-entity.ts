import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 알림함 ORM 엔티티. */
@Entity({ name: 'notifications', comment: '알림함 (회원이 받은 알림)' })
@Index('idx_notifications_user', ['userId', 'createdAt'])
export class NotificationOrmEntity {
  @PrimaryColumn('uuid', { comment: '알림 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', { length: 30, comment: 'ORDER_ASSIGNED 등 알림 종류' })
  type: string;

  @Column('varchar', { length: 100, comment: '제목' })
  title: string;

  @Column('varchar', { length: 500, comment: '내용' })
  body: string;

  @Column('jsonb', { comment: '눌렀을 때 갈 곳을 정하는 값' })
  data: Record<string, string>;

  @Column('timestamptz', {
    name: 'read_at',
    nullable: true,
    comment: '읽은 시각. 안 읽었으면 NULL',
  })
  readAt: Date | null;

  @Column('timestamptz', { name: 'created_at', comment: '받은 시각' })
  createdAt: Date;
}
