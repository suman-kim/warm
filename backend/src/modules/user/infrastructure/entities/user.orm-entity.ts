import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 회원 ORM 엔티티. */
@Entity({ name: 'users', comment: '회원 (고객·기사·운영자)' })
export class UserOrmEntity {
  @PrimaryColumn('uuid', { comment: '회원 ID' })
  id: string;

  @Column('varchar', { length: 255, unique: true, comment: '소문자 이메일' })
  email: string;

  @Column('varchar', {
    name: 'password_hash',
    length: 100,
    comment: '비밀번호의 bcrypt 해시',
  })
  passwordHash: string;

  @Column('varchar', { length: 50, comment: '이름' })
  name: string;

  @Column('varchar', { length: 11, comment: '숫자만' })
  phone: string;

  @Column('varchar', {
    length: 20,
    comment:
      'CUSTOMER(사장님) | DRIVER(라이더) | CONSUMER(주문앱 손님) | ADMIN',
  })
  role: string;

  @Column('varchar', { length: 20, comment: 'ACTIVE | SUSPENDED | WITHDRAWN' })
  status: string;

  @Column('timestamptz', { name: 'terms_agreed_at', comment: '이용약관 동의' })
  termsAgreedAt: Date;

  @Column('timestamptz', {
    name: 'privacy_agreed_at',
    comment: '개인정보 수집·이용 동의',
  })
  privacyAgreedAt: Date;

  @Column('timestamptz', {
    name: 'marketing_agreed_at',
    nullable: true,
    comment: '마케팅 정보 수신 동의. 동의하지 않았으면 NULL',
  })
  marketingAgreedAt: Date | null;

  @Column('timestamptz', {
    name: 'withdrawn_at',
    nullable: true,
    comment: '탈퇴한 시각',
  })
  withdrawnAt: Date | null;

  @Column('timestamptz', {
    name: 'suspended_until',
    nullable: true,
    comment: '정지가 끝나는 시각. 무기한 정지면 NULL',
  })
  suspendedUntil: Date | null;

  @Column('varchar', {
    name: 'suspension_reason',
    length: 500,
    nullable: true,
    comment: '정지 사유 (정지 중일 때)',
  })
  suspensionReason: string | null;

  @Column('int', { comment: '낙관적 잠금 버전' })
  version: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '가입한 시각',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 바뀐 시각',
  })
  updatedAt: Date;
}
