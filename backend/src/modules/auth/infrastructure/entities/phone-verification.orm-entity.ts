import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'phone_verifications',
  comment: '휴대폰 번호 인증 (손님 가입). 코드와 토큰은 해시만 둔다',
})
@Index('idx_phone_verifications_phone', ['phone', 'createdAt'])
export class PhoneVerificationOrmEntity {
  @PrimaryColumn('uuid', { comment: '인증 ID' })
  id: string;

  @Column('varchar', { length: 12, comment: '휴대폰 번호 (숫자만)' })
  phone: string;

  @Column('varchar', {
    name: 'code_hash',
    length: 64,
    comment: '인증 코드의 SHA-256 (번호를 섞어서)',
  })
  codeHash: string;

  @Column('timestamptz', {
    name: 'expires_at',
    comment: '코드가 만료되는 시각',
  })
  expiresAt: Date;

  @Column('smallint', { default: 0, comment: '틀린 횟수' })
  attempts: number;

  @Column('timestamptz', {
    name: 'verified_at',
    nullable: true,
    comment: '코드를 맞힌 시각. 아직이면 NULL',
  })
  verifiedAt: Date | null;

  @Index('idx_phone_verifications_token')
  @Column('varchar', {
    name: 'token_hash',
    length: 64,
    nullable: true,
    comment: '가입에 쓰는 인증 토큰의 SHA-256. 인증 전이면 NULL',
  })
  tokenHash: string | null;

  @Column('timestamptz', {
    name: 'used_at',
    nullable: true,
    comment: '가입에 쓴 시각. 아직이면 NULL',
  })
  usedAt: Date | null;

  @Column('timestamptz', { name: 'created_at', comment: '코드를 보낸 시각' })
  createdAt: Date;
}
