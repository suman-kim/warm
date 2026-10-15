import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 비밀번호 재설정 코드 ORM 엔티티. 회원마다 최근 것 하나만 둔다. */
@Entity({
  name: 'password_reset_codes',
  comment: '비밀번호 재설정 인증 코드 (해시만 보관)',
})
@Index('uq_password_reset_codes_user', ['userId'], { unique: true })
export class PasswordResetCodeOrmEntity {
  @PrimaryColumn('uuid', { comment: '코드 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    name: 'code_hash',
    length: 64,
    comment: 'SHA-256(회원 ID:6자리 코드)',
  })
  codeHash: string;

  @Column('timestamptz', {
    name: 'expires_at',
    comment: '코드가 만료되는 시각',
  })
  expiresAt: Date;

  @Column('int', { comment: '틀린 횟수' })
  attempts: number;

  @Column('timestamptz', {
    name: 'used_at',
    nullable: true,
    comment: '코드를 써서 비밀번호를 바꾼 시각. 쓰기 전이면 NULL',
  })
  usedAt: Date | null;

  @Column('timestamptz', { name: 'created_at', comment: '발급한 시각' })
  createdAt: Date;
}
