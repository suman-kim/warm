import { MigrationInterface, QueryRunner } from 'typeorm';

// 가게 배달 — 주문에 가게, 음식값, 음식값 받는 방식(선결제·현금·카드), 라이더가 받은 방식·금액을 붙인다.

export class AddStoreDeliveries1792040514476 implements MigrationInterface {
  name = 'AddStoreDeliveries1792040514476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "store_id" uuid`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."store_id" IS '배달을 요청한 가게 (stores.id). 퀵·화물 주문이면 NULL'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "food_amount" integer`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."food_amount" IS '가게 배달: 손님이 낼 음식값(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "door_payment" character varying(10)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."door_payment" IS '가게 배달: 음식값을 받는 방식 PREPAID(선결제) | CASH | CARD (만나서 결제)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "collected_method" character varying(10)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_method" IS '가게 배달: 라이더가 손님에게 실제로 받은 방식 CASH | CARD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "collected_amount" integer`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_amount" IS '가게 배달: 라이더가 손님에게 실제로 받은 금액(원)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_store" ON "orders"  ("store_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_orders_store"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_amount" IS '가게 배달: 라이더가 손님에게 실제로 받은 금액(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "collected_amount"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_method" IS '가게 배달: 라이더가 손님에게 실제로 받은 방식 CASH | CARD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "collected_method"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."door_payment" IS '가게 배달: 음식값을 받는 방식 PREPAID(선결제) | CASH | CARD (만나서 결제)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "door_payment"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."food_amount" IS '가게 배달: 손님이 낼 음식값(원)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "food_amount"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."store_id" IS '배달을 요청한 가게 (stores.id). 퀵·화물 주문이면 NULL'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "store_id"`);
  }
}
