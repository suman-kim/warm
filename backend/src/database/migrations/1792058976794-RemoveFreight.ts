import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 퀵·화물 주문을 걷어 내고 음식 배달만 남긴다.
 * 화물 주문과 거기에 딸린 카드 결제·환불·평가·메시지, 고객의 결제 카드와 자주 쓰는 주소를 지우고
 * 주문 표에서 화물 전용 열을 뺀다. 지운 데이터는 down()으로 돌아오지 않는다 — 구조만 되살린다.
 */
export class RemoveFreight1792058976794 implements MigrationInterface {
  name = 'RemoveFreight1792058976794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 화물 주문과 거기에 딸린 기록. 가게 배달에는 카드 결제·평가·메시지가 없다.
    await queryRunner.query(`DROP TABLE "order_charges"`);
    await queryRunner.query(`DROP TABLE "order_refunds"`);
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "order_messages"`);
    await queryRunner.query(`DROP TABLE "saved_addresses"`);
    await queryRunner.query(`DROP TYPE "public"."charge_kind"`);
    await queryRunner.query(`DROP TYPE "public"."charge_status"`);
    await queryRunner.query(`DROP TYPE "public"."card_type"`);
    await queryRunner.query(`DELETE FROM "orders" WHERE "store_id" IS NULL`);
    // 결제·메시지·노쇼 알림과 지운 주문의 알림.
    await queryRunner.query(
      `DELETE FROM "notifications" n WHERE n."type" IN ('ORDER_PAYMENT_FAILED', 'ORDER_NO_SHOW', 'PAYMENT_PAID', 'PAYMENT_ADDITIONAL_PAID', 'PAYMENT_ADDITIONAL_FAILED', 'PAYMENT_REFUNDED', 'ORDER_MESSAGE') OR (n."data" ? 'orderId' AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."id"::text = n."data"->>'orderId'))`,
    );
    // 지난 상태(결제 중·결제 실패·노쇼)가 남은 배달은 취소로 닫는다.
    await queryRunner.query(
      `UPDATE "orders" SET "status" = 'CANCELLED', "cancelled_at" = COALESCE("cancelled_at", "updated_at") WHERE "status" IN ('PAYING', 'PAYMENT_FAILED', 'NO_SHOW')`,
    );
    // 라이더는 모두 오토바이다.
    await queryRunner.query(
      `UPDATE "drivers" SET "vehicle_type" = 'MOTORCYCLE' WHERE "vehicle_type" <> 'MOTORCYCLE'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_type" IS '이동 수단: MOTORCYCLE (오토바이)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_number" IS '오토바이 번호판 (예: 서울강남가1234)'`,
    );

    await queryRunner.query(`DROP INDEX "public"."idx_orders_open"`);
    await queryRunner.query(
      `COMMENT ON TABLE "orders" IS '배달 (가게가 요청한 음식 배달)'`,
    );
    // 가게 배달은 픽업 예약 시각 자리에 조리 완료 시각을 담아 왔다 — 이름만 바꾼다.
    await queryRunner.query(
      `ALTER TABLE "orders" RENAME COLUMN "scheduled_pickup_at" TO "ready_at"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."ready_at" IS '조리가 끝나 픽업할 수 있는 시각. 바로면 NULL'`,
    );
    for (const column of [
      'base_fare',
      'help_fee',
      'pickup_floor',
      'pickup_elevator',
      'dropoff_floor',
      'dropoff_elevator',
      'stair_fee',
      'payment_method_id',
      'extra_overload',
      'extra_bulky',
      'extra_stairs',
      'extra_fee',
      'waiting_minutes',
      'waiting_fee',
      'no_show_at',
      'cargo_weight_kg',
      'cargo_quantity',
      'service_type',
      'vehicle_type',
      'cargo_description',
      'cargo_category',
      'loading_help',
      'payment_failure_code',
    ]) {
      await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "${column}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" DROP COLUMN "extra_fare"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_orders_customer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_driver"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."customer_id" IS '요청한 사장님 (users.id)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."status" IS 'REQUESTED | ASSIGNED | DEPARTED | ARRIVED | PICKED_UP | DELIVERED | CANCELLED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "store_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."store_id" IS '배달을 요청한 가게 (stores.id)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_address" IS '가게(픽업지) 주소 (도로명)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_detail_address" IS '가게(픽업지) 상세 주소 (건물·동·호수)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_sigungu" IS '가게(픽업지) 시·군·구 — 수락 전 라이더에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_dong" IS '가게(픽업지) 동 — 수락 전 라이더에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_latitude" IS '가게(픽업지) 위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_longitude" IS '가게(픽업지) 경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_name" IS '가게 이름'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_phone" IS '가게(픽업지) 연락처 (숫자만, 안심번호는 12자리)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_address" IS '손님(도착지) 주소 (도로명)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_detail_address" IS '손님(도착지) 상세 주소 (건물·동·호수)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_sigungu" IS '손님(도착지) 시·군·구 — 수락 전 라이더에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_dong" IS '손님(도착지) 동 — 수락 전 라이더에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_latitude" IS '손님(도착지) 위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_longitude" IS '손님(도착지) 경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_name" IS '손님 (이름 대신 "손님")'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_phone" IS '손님(도착지) 연락처 (숫자만, 안심번호는 12자리)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."memo" IS '요청 사항 (라이더에게 남길 말)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."distance_km" IS '운행 거리(km) — 가게에서 손님까지'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."fare_amount" IS '배달대행료(원) — 요청할 때 가게 충전금에서 빠진다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancellation_fee" IS '취소 수수료(원) — 라이더 출발·도착 뒤 취소하면 대행료의 15%'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "food_amount" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."food_amount" IS '손님이 낼 음식값(원)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "door_payment" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."door_payment" IS '음식값을 받는 방식 PREPAID(선결제) | CASH | CARD (만나서 결제)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_method" IS '라이더가 손님에게 실제로 받은 방식 CASH | CARD'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."collected_amount" IS '라이더가 손님에게 실제로 받은 금액(원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cash_handed_at" IS '라이더가 받은 현금을 가게에 넘긴 시각 (운영자가 확인). 아직이면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."requested_at" IS '배달을 요청한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."assigned_at" IS '라이더가 수락한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."departed_at" IS '라이더가 가게로 출발한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."arrived_at" IS '라이더가 가게에 도착한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."delivered_at" IS '배달을 끝낸 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."gross" IS '운행 매출(원) — 대행료 합'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_driver" ON "orders"  ("driver_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_customer" ON "orders"  ("customer_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_open" ON "orders"  ("status", "requested_at") `,
    );
  }

  /** 구조만 되살린다 — 지운 화물 주문·결제·평가·메시지·주소는 돌아오지 않는다. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_orders_open"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_customer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_driver"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "door_payment" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "food_amount" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "store_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_payouts" ADD "extra_fare" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "payment_failure_code" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "loading_help" character varying(20) NOT NULL DEFAULT 'NONE'`,
    );
    // 남은 배달은 모두 오토바이·퀵이었다.
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cargo_category" character varying(30) NOT NULL DEFAULT 'FOOD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cargo_description" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "vehicle_type" character varying(20) NOT NULL DEFAULT 'MOTORCYCLE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "service_type" character varying(20) NOT NULL DEFAULT 'QUICK'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cargo_quantity" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cargo_weight_kg" double precision NOT NULL DEFAULT '0'`,
    );
    for (const column of [
      'cargo_category',
      'vehicle_type',
      'service_type',
      'cargo_quantity',
      'cargo_weight_kg',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "orders" ALTER COLUMN "${column}" DROP DEFAULT`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "no_show_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "waiting_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "waiting_minutes" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_stairs" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_bulky" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "extra_overload" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "payment_method_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "stair_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_elevator" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_floor" smallint NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_elevator" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_floor" smallint NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "help_fee" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "base_fare" integer`);
    await queryRunner.query(`UPDATE "orders" SET "base_fare" = "fare_amount"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "base_fare" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" RENAME COLUMN "ready_at" TO "scheduled_pickup_at"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "orders" IS '주문 (배송 요청)'`);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_driver" ON "orders" ("driver_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_customer" ON "orders" ("customer_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_open" ON "orders" ("vehicle_type", "status", "requested_at") `,
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
      `CREATE TABLE "order_charges" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "kind" "public"."charge_kind" NOT NULL, "amount" integer NOT NULL, "status" "public"."charge_status" NOT NULL, "payment_method_id" uuid NOT NULL, "card_brand" character varying(30) NOT NULL, "card_last4" character(4) NOT NULL, "card_type" "public"."card_type" NOT NULL, "payment_key" character varying(200), "approval_number" character varying(30), "approved_at" TIMESTAMP WITH TIME ZONE, "failure_code" character varying(40), "failed_at" TIMESTAMP WITH TIME ZONE, "cancelled_amount" integer NOT NULL DEFAULT '0', "cancelled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a5643604b6bf4761d2573572ec5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_charges_order" ON "order_charges" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_refunds" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "amount" integer NOT NULL, "reason" character varying(200) NOT NULL, "refunded_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f8c501d1232e93e00aac466a279" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_refunds_order" ON "order_refunds" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_methods" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "billing_key" character varying(200) NOT NULL, "card_brand" character varying(30) NOT NULL, "card_last4" character(4) NOT NULL, "card_type" "public"."card_type" NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "removed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_34f9b8c6dfb4ac3559f7e2820d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_methods_user" ON "payment_methods" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "driver_id" uuid NOT NULL, "rating" integer NOT NULL, "tags" text array NOT NULL, "comment" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reviews_driver" ON "reviews" ("driver_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reviews_order" ON "reviews" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_messages" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "sender_user_id" uuid NOT NULL, "text" character varying(500) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_25d8eb6fb6e1ccb6b33e034ee28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_messages_order" ON "order_messages" ("order_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "saved_addresses" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "label" character varying(30) NOT NULL, "address" character varying(200) NOT NULL, "detail_address" character varying(200), "sigungu" character varying(50), "dong" character varying(50), "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_2dcd5492d2ac696c133d461db8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_addresses_user" ON "saved_addresses" ("user_id", "created_at") `,
    );
  }
}
