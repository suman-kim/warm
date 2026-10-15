import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 운행 기록 ORM 엔티티. 운행을 켠 때부터 끈 때까지가 한 행. */
@Entity({
  name: 'driver_shifts',
  comment: '기사 운행 기록 (켠 시각 ~ 끈 시각)',
})
@Index('idx_driver_shifts_driver', ['driverId', 'startedAt'])
export class DriverShiftOrmEntity {
  @PrimaryColumn('uuid', { comment: '운행 기록 ID' })
  id: string;

  @Column('uuid', { name: 'driver_id', comment: 'drivers.id' })
  driverId: string;

  @Column('timestamptz', { name: 'started_at', comment: '운행을 켠 시각' })
  startedAt: Date;

  @Column('timestamptz', {
    name: 'ended_at',
    nullable: true,
    comment: '아직 운행 중이면 NULL',
  })
  endedAt: Date | null;
}
