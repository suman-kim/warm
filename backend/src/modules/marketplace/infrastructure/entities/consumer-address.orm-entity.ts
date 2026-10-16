import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'consumer_addresses', comment: '손님이 저장한 배달 주소' })
@Index('idx_consumer_addresses_user', ['userId', 'createdAt'])
export class ConsumerAddressOrmEntity {
  @PrimaryColumn('uuid', { comment: '주소 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: '손님 (users.id)' })
  userId: string;

  @Column('varchar', { length: 20, comment: '주소 이름 (집, 회사…)' })
  label: string;

  @Column('varchar', { length: 200, comment: '도로명 주소' })
  address: string;

  @Column('varchar', {
    name: 'detail_address',
    length: 200,
    nullable: true,
    comment: '상세 주소',
  })
  detailAddress: string | null;

  @Column('varchar', { length: 50, nullable: true, comment: '시·군·구' })
  sigungu: string | null;

  @Column('varchar', { length: 50, nullable: true, comment: '동' })
  dong: string | null;

  @Column('double precision', { comment: '위도' })
  latitude: number;

  @Column('double precision', { comment: '경도' })
  longitude: number;

  @Column('boolean', {
    name: 'is_default',
    comment: '기본 주소인지 (손님마다 하나)',
  })
  isDefault: boolean;

  @Column('timestamptz', { name: 'created_at', comment: '저장한 시각' })
  createdAt: Date;
}
