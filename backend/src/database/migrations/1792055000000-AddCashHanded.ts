import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashHanded1792055000000 implements MigrationInterface {
  name = 'AddCashHanded1792055000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cash_handed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cash_handed_at" IS '가게 배달: 라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인). 아직이면 NULL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cash_handed_at" IS '가게 배달: 라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인). 아직이면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "cash_handed_at"`,
    );
  }
}
