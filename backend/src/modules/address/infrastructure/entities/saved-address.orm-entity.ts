import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 자주 쓰는 주소 ORM 엔티티. */
@Entity({ name: 'saved_addresses', comment: '자주 쓰는 주소' })
@Index('idx_saved_addresses_user', ['userId', 'createdAt'])
export class SavedAddressOrmEntity {
  @PrimaryColumn('uuid', { comment: '주소 ID' })
  id: string;

  @Column('uuid', { name: 'user_id', comment: 'users.id' })
  userId: string;

  @Column('varchar', { length: 30, comment: '회원이 붙인 이름' })
  label: string;

  @Column('varchar', { length: 200, comment: '주소 (도로명)' })
  address: string;

  @Column('varchar', {
    name: 'detail_address',
    length: 200,
    nullable: true,
    comment: '상세 주소 (건물·동·호수)',
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

  @Column('timestamptz', { name: 'created_at', comment: '저장한 시각' })
  createdAt: Date;
}
