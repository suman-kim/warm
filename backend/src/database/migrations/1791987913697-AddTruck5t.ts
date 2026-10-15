import { MigrationInterface, QueryRunner } from 'typeorm';

// 5톤 트럭(TRUCK_5T)을 다시 받는다. 차종은 문자열 컬럼이라 컬럼 설명만 바뀐다.
// TypeORM이 함께 내놓은 인덱스 삭제·재생성(정의가 같은 인덱스)은 뺐다.

export class AddTruck5t1791987913697 implements MigrationInterface {
  name = 'AddTruck5t1791987913697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T | TRUCK_5T'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T | TRUCK_5T'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T'`,
    );
  }
}
