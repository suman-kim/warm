import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 운영자 계정 ORM 엔티티. */
@Entity({ name: 'admin_accounts', comment: '운영자 계정 (권한·초대·비활성화)' })
export class AdminAccountOrmEntity {
  @PrimaryColumn('uuid', { comment: '회원 ID (users.id)' })
  id: string;

  @Column('varchar', { length: 20, comment: 'SUPER | OPS | FINANCE' })
  role: string;

  @Column('varchar', { length: 20, comment: 'ACTIVE | INVITED | INACTIVE' })
  status: string;

  @Index({ unique: true, where: '"invitation_token_hash" IS NOT NULL' })
  @Column('varchar', {
    name: 'invitation_token_hash',
    length: 64,
    nullable: true,
    comment: '초대 토큰의 SHA-256. 초대 중일 때만 있다',
  })
  invitationTokenHash: string | null;

  @Column('timestamptz', {
    name: 'invitation_expires_at',
    nullable: true,
    comment: '초대 링크가 만료되는 시각. 초대 중일 때만 있다',
  })
  invitationExpiresAt: Date | null;

  @Column('timestamptz', {
    name: 'last_login_at',
    nullable: true,
    comment: '운영자 웹에 마지막으로 로그인한 시각',
  })
  lastLoginAt: Date | null;

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '운영자 계정을 만든(초대한) 시각',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
