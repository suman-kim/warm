import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주문 연락처를 12자리까지 넓힌다 (배달앱 안심번호 0504-1234-5678).
 * 생성기는 칼럼을 지우고 다시 만들지만, 있는 번호를 지키려고 타입만 바꾼다.
 */
export class WidenContactPhone1792051228696 implements MigrationInterface {
  name = 'WidenContactPhone1792051228696';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "pickup_contact_phone" TYPE character varying(12)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_phone" IS '출발지 연락처 (숫자만, 안심번호는 12자리)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "dropoff_contact_phone" TYPE character varying(12)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_phone" IS '도착지 연락처 (숫자만, 안심번호는 12자리)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 12자리 안심번호가 있으면 줄일 수 없다 — 먼저 지우거나 고쳐야 한다.
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "dropoff_contact_phone" TYPE character varying(11)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_phone" IS '도착지 연락처 (숫자만)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "pickup_contact_phone" TYPE character varying(11)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_phone" IS '출발지 연락처 (숫자만)'`,
    );
  }
}
