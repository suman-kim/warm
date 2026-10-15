import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 기사 위치 ORM 엔티티. 기사마다 마지막 위치 한 행. */
@Entity({ name: 'driver_locations', comment: '기사의 마지막 위치' })
export class DriverLocationOrmEntity {
  @PrimaryColumn('uuid', { name: 'driver_id', comment: 'drivers.id' })
  driverId: string;

  @Column('double precision', { comment: '위도' })
  latitude: number;

  @Column('double precision', { comment: '경도' })
  longitude: number;

  @Column('timestamptz', {
    name: 'updated_at',
    comment: '기사 앱이 위치를 마지막으로 보고한 시각',
  })
  updatedAt: Date;
}
