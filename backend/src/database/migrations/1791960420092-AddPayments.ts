import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayments1791960420092 implements MigrationInterface {
  name = 'AddPayments1791960420092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "order_refunds" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "amount" integer NOT NULL, "reason" character varying(200) NOT NULL, "refunded_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f8c501d1232e93e00aac466a279" PRIMARY KEY ("id")); COMMENT ON COLUMN "order_refunds"."order_id" IS 'orders.id'; COMMENT ON COLUMN "order_refunds"."customer_id" IS 'users.id'; COMMENT ON COLUMN "order_refunds"."amount" IS '돌려준 금액(원)'; COMMENT ON COLUMN "order_refunds"."refunded_by" IS '돌려준 운영자 (users.id). 고객 취소로 자동 환불했으면 null.'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_refunds_order" ON "order_refunds"  ("order_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "order_refunds" IS '주문의 환불 기록 (자동 환불·운영자 환불)'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."charge_kind" AS ENUM('DISPATCH', 'ADDITIONAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."charge_status" AS ENUM('PAID', 'FAILED', 'PARTIALLY_CANCELLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."card_type" AS ENUM('CREDIT', 'CHECK')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_charges" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "kind" "public"."charge_kind" NOT NULL, "amount" integer NOT NULL, "status" "public"."charge_status" NOT NULL, "payment_method_id" uuid NOT NULL, "card_brand" character varying(30) NOT NULL, "card_last4" character(4) NOT NULL, "card_type" "public"."card_type" NOT NULL, "payment_key" character varying(200), "approval_number" character varying(30), "approved_at" TIMESTAMP WITH TIME ZONE, "failure_code" character varying(40), "failed_at" TIMESTAMP WITH TIME ZONE, "cancelled_amount" integer NOT NULL DEFAULT '0', "cancelled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a5643604b6bf4761d2573572ec5" PRIMARY KEY ("id")); COMMENT ON COLUMN "order_charges"."order_id" IS 'orders.id'; COMMENT ON COLUMN "order_charges"."customer_id" IS 'users.id'; COMMENT ON COLUMN "order_charges"."amount" IS '결제하려 한 금액(원)'; COMMENT ON COLUMN "order_charges"."payment_method_id" IS 'payment_methods.id'; COMMENT ON COLUMN "order_charges"."payment_key" IS 'PG사의 결제 키 (취소할 때 쓴다)'; COMMENT ON COLUMN "order_charges"."failure_code" IS 'PaymentFailureCode'; COMMENT ON COLUMN "order_charges"."cancelled_amount" IS '돌려준 금액의 합(원)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_charges_order" ON "order_charges"  ("order_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "order_charges" IS '주문의 카드 결제 (배차 결제·추가 결제)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_methods" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "billing_key" character varying(200) NOT NULL, "card_brand" character varying(30) NOT NULL, "card_last4" character(4) NOT NULL, "card_type" "public"."card_type" NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "removed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_34f9b8c6dfb4ac3559f7e2820d1" PRIMARY KEY ("id")); COMMENT ON COLUMN "payment_methods"."user_id" IS 'users.id'; COMMENT ON COLUMN "payment_methods"."billing_key" IS 'PG사가 발급한 빌링키'; COMMENT ON COLUMN "payment_methods"."card_brand" IS '카드사'; COMMENT ON COLUMN "payment_methods"."card_last4" IS '카드 번호 끝 4자리'; COMMENT ON COLUMN "payment_methods"."removed_at" IS '지운 시각. 지난 결제의 영수증 때문에 행은 남긴다.'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_methods_user" ON "payment_methods"  ("user_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "payment_methods" IS '고객이 등록한 결제 카드'`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" ADD "verification_status" character varying(20) NOT NULL DEFAULT 'UNVERIFIED'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_status" IS '본인 확인: UNVERIFIED | VERIFIED | FAILED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" ADD "verification_failure_reason" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" ADD "verification_attempted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" ADD "verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    // 이미 등록한 계좌는 개발용 확인(예금주 이름 = 가입자 이름)으로 한 번 확인해 둔다.
    await queryRunner.query(
      `UPDATE "driver_settlement_accounts" a SET "verification_status" = CASE WHEN replace(a."account_holder", ' ', '') = replace(u."name", ' ', '') THEN 'VERIFIED' ELSE 'FAILED' END, "verification_failure_reason" = CASE WHEN replace(a."account_holder", ' ', '') = replace(u."name", ' ', '') THEN NULL ELSE '예금주 이름이 가입자 이름과 달라요.' END, "verification_attempted_at" = now(), "verified_at" = CASE WHEN replace(a."account_holder", ' ', '') = replace(u."name", ' ', '') THEN now() ELSE NULL END FROM "drivers" d JOIN "users" u ON u."id" = d."user_id" WHERE d."id" = a."driver_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "base_fare" integer NOT NULL DEFAULT 0`,
    );
    // 지금까지의 주문은 요금이 기본 요금뿐이었다.
    await queryRunner.query(`UPDATE "orders" SET "base_fare" = "fare_amount"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "base_fare" DROP DEFAULT`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."base_fare" IS '기본 요금(원) — 차종과 거리'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "loading_help" character varying(20) NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."loading_help" IS '큰 짐 운반 도움: NONE | TOGETHER | DRIVER_ONLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "help_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."help_fee" IS '운반 도움 요금(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_floor" smallint NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_elevator" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_floor" smallint NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_elevator" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "stair_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."stair_fee" IS '엘리베이터 없는 층의 계단 요금(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "payment_method_id" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."payment_method_id" IS '결제할 카드 (payment_methods.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_overload" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_overload" IS '과적 단계'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_bulky" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_bulky" IS '큰 짐 개수'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_stairs" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_stairs" IS '엘리베이터 없이 오른 층 (기사가 넣은 것)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_fee" IS '기사가 픽업할 때 넣은 추가 요금(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "waiting_minutes" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "waiting_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."waiting_fee" IS '대기료(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cancellation_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancellation_fee" IS '취소 수수료 또는 노쇼 요금(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "payment_failure_code" character varying(40)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."payment_failure_code" IS '배차 때 결제가 안 된 사유 (PaymentFailureCode)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "departed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "arrived_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "no_show_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "extra_fare" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."extra_fare" IS '그중 추가 요금과 대기료(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "compensation" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."compensation" IS '취소 보상(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "status" character varying(20) NOT NULL DEFAULT 'PAID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."status" IS 'REQUESTED | PAID | FAILED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "failure_reason" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "completed_at" TIMESTAMP WITH TIME ZONE`,
    );
    // 지금까지의 지급 기록은 모두 운영자가 직접 보낸 것(지급 완료)이다.
    await queryRunner.query(
      `UPDATE "settlement_payouts" SET "completed_at" = "paid_at"`,
    );
    // 실패한 지급은 다시 할 수 있게, 기사·주의 유일 조건을 실패가 아닌 지급에만 건다.
    await queryRunner.query(
      `DROP INDEX "public"."uq_settlement_payouts_driver_week"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_settlement_payouts_driver_week" ON "settlement_payouts" ("driver_id", "week_start") WHERE "status" <> 'FAILED'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."completed_at" IS '보냈거나 보내지 못한 것이 확인된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."status" IS 'REQUESTED | PAYING | PAYMENT_FAILED | ASSIGNED | DEPARTED | ARRIVED | PICKED_UP | DELIVERED | CANCELLED | NO_SHOW'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."fare_amount" IS '배차 때 결제하는 요금(원) = 기본 요금 + 운반 도움 + 계단'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."gross" IS '운행 매출(원) — 최종 요금 합'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."net" IS '지급할 금액(원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."paid_at" IS '지급 처리(요청)한 시각'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."paid_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."net" IS '지급한 금액(원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."gross" IS '운행 매출(원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."fare_amount" IS '요금(원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."status" IS 'REQUESTED | ASSIGNED | PICKED_UP | DELIVERED | CANCELLED'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."completed_at" IS '보냈거나 보내지 못한 것이 확인된 시각'`,
    );
    await queryRunner.query(
      `DELETE FROM "settlement_payouts" WHERE "status" <> 'PAID'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_settlement_payouts_driver_week"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_settlement_payouts_driver_week" ON "settlement_payouts" ("driver_id", "week_start")`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "completed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "failure_reason"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."status" IS 'REQUESTED | PAID | FAILED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."compensation" IS '취소 보상(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "compensation"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."extra_fare" IS '그중 추가 요금과 대기료(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "extra_fare"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "no_show_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "arrived_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "departed_at"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."payment_failure_code" IS '배차 때 결제가 안 된 사유 (PaymentFailureCode)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "payment_failure_code"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancellation_fee" IS '취소 수수료 또는 노쇼 요금(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "cancellation_fee"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."waiting_fee" IS '대기료(원)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "waiting_fee"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "waiting_minutes"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_fee" IS '기사가 픽업할 때 넣은 추가 요금(원)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "extra_fee"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_stairs" IS '엘리베이터 없이 오른 층 (기사가 넣은 것)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "extra_stairs"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_bulky" IS '큰 짐 개수'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "extra_bulky"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."extra_overload" IS '과적 단계'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "extra_overload"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."payment_method_id" IS '결제할 카드 (payment_methods.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "payment_method_id"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."stair_fee" IS '엘리베이터 없는 층의 계단 요금(원)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "stair_fee"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "dropoff_elevator"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "dropoff_floor"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "pickup_elevator"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "pickup_floor"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."help_fee" IS '운반 도움 요금(원)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "help_fee"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."loading_help" IS '큰 짐 운반 도움: NONE | TOGETHER | DRIVER_ONLY'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "loading_help"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."base_fare" IS '기본 요금(원) — 차종과 거리'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "base_fare"`);
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" DROP COLUMN "verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" DROP COLUMN "verification_attempted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" DROP COLUMN "verification_failure_reason"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_status" IS '본인 확인: UNVERIFIED | VERIFIED | FAILED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_settlement_accounts" DROP COLUMN "verification_status"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "payment_methods" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_payment_methods_user"`);
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(`COMMENT ON TABLE "order_charges" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_order_charges_order"`);
    await queryRunner.query(`DROP TABLE "order_charges"`);
    await queryRunner.query(`DROP TYPE "public"."card_type"`);
    await queryRunner.query(`DROP TYPE "public"."charge_status"`);
    await queryRunner.query(`DROP TYPE "public"."charge_kind"`);
    await queryRunner.query(`COMMENT ON TABLE "order_refunds" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_order_refunds_order"`);
    await queryRunner.query(`DROP TABLE "order_refunds"`);
  }
}
