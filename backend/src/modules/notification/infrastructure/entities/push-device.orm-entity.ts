import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 푸시 기기 ORM 엔티티. 회원 한 명이 기기 수만큼 행을 갖는다. */
@Entity({
  name: 'push_devices',
  comment: '푸시 알림을 받을 기기 (회원당 여러 개)',
})
// 같은 토큰이 두 회원에게 걸리면 남의 알림이 그 기기에 뜬다. 유니크로 막는다.
@Index('uq_push_devices_token', ['token'], { unique: true })
// 발송할 때마다 받는 사람의 토큰을 모두 찾는다.
@Index('idx_push_devices_user', ['userId'])
export class PushDeviceOrmEntity {
  @PrimaryColumn('uuid', { comment: '기기 등록 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', { length: 1024, comment: 'FCM 등록 토큰' })
  token: string;

  @Column('varchar', { length: 10, comment: 'ANDROID | IOS' })
  platform: string;

  @Column('timestamptz', { name: 'created_at', comment: '처음 등록한 시각' })
  createdAt: Date;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '앱이 마지막으로 이 토큰을 등록(확인)한 시각',
  })
  updatedAt: Date;
}
