import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 리프레시 토큰 ORM 엔티티. */
@Entity({ name: 'refresh_tokens', comment: '리프레시 토큰 (해시만 보관)' })
export class RefreshTokenOrmEntity {
  @PrimaryColumn('uuid', { comment: '토큰 ID' })
  id: string;

  @Index()
  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', {
    name: 'token_hash',
    length: 64,
    unique: true,
    comment: '토큰 원문의 SHA-256',
  })
  tokenHash: string;

  @Column('timestamptz', { name: 'expires_at', comment: '만료 시각' })
  expiresAt: Date;

  @Column('timestamptz', {
    name: 'revoked_at',
    nullable: true,
    comment: '폐기한 시각 (로그아웃·재발급). 쓸 수 있으면 NULL',
  })
  revokedAt: Date | null;

  @Column('timestamptz', { name: 'created_at', comment: '발급한 시각' })
  createdAt: Date;
}
