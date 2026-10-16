import { MigrationInterface, QueryRunner } from 'typeorm';

// 음식점 배달대행 — 가게(사장님 계정당 하나, 심사)와 충전금 내역(충전·대행료 차감·환불·조정).

export class AddStores1792037466959 implements MigrationInterface {
  name = 'AddStores1792037466959';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "stores" ("id" uuid NOT NULL, "owner_user_id" uuid NOT NULL, "name" character varying(50) NOT NULL, "business_number" character varying(10) NOT NULL, "phone" character varying(20) NOT NULL, "address" character varying(200) NOT NULL, "detail_address" character varying(200), "sigungu" character varying(50) NOT NULL, "dong" character varying(50) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "status" character varying(20) NOT NULL, "rejection_reason" character varying(500), "wallet_balance" integer NOT NULL, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reviewed_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "version" integer NOT NULL, CONSTRAINT "UQ_ba95f3c2644552c72431cfb0c78" UNIQUE ("owner_user_id"), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id")); COMMENT ON COLUMN "stores"."id" IS '가게 ID'; COMMENT ON COLUMN "stores"."owner_user_id" IS '사장님 회원 ID (users.id) — 회원 한 명에 가게 하나'; COMMENT ON COLUMN "stores"."name" IS '상호'; COMMENT ON COLUMN "stores"."business_number" IS '사업자등록번호 (숫자 10자리)'; COMMENT ON COLUMN "stores"."phone" IS '가게 전화번호 (숫자만)'; COMMENT ON COLUMN "stores"."address" IS '가게 주소 (픽업지)'; COMMENT ON COLUMN "stores"."detail_address" IS '상세 주소'; COMMENT ON COLUMN "stores"."sigungu" IS '시군구'; COMMENT ON COLUMN "stores"."dong" IS '동'; COMMENT ON COLUMN "stores"."latitude" IS '위도'; COMMENT ON COLUMN "stores"."longitude" IS '경도'; COMMENT ON COLUMN "stores"."status" IS '심사 상태: PENDING | APPROVED | REJECTED'; COMMENT ON COLUMN "stores"."rejection_reason" IS '반려 사유'; COMMENT ON COLUMN "stores"."wallet_balance" IS '충전금 잔액 (원) — store_wallet_entries의 마지막 잔액과 같다'; COMMENT ON COLUMN "stores"."applied_at" IS '심사를 신청한 시각'; COMMENT ON COLUMN "stores"."reviewed_at" IS '승인·반려한 시각'; COMMENT ON COLUMN "stores"."reviewed_by" IS '승인·반려한 운영자 (users.id)'; COMMENT ON COLUMN "stores"."created_at" IS '등록한 시각'; COMMENT ON COLUMN "stores"."version" IS '낙관적 잠금 버전 — 충전금이 동시에 바뀌어도 꼬이지 않게'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stores_status" ON "stores"  ("status", "applied_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "stores" IS '가게 (배달을 요청하는 음식점)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_wallet_entries" ("id" uuid NOT NULL, "store_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "amount" integer NOT NULL, "balance_after" integer NOT NULL, "order_id" uuid, "memo" character varying(200), "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_46e1fc9d38e78252286bdc953d2" PRIMARY KEY ("id")); COMMENT ON COLUMN "store_wallet_entries"."id" IS '내역 ID'; COMMENT ON COLUMN "store_wallet_entries"."store_id" IS 'stores.id'; COMMENT ON COLUMN "store_wallet_entries"."kind" IS '종류: TOP_UP | DELIVERY_FEE | REFUND | ADJUSTMENT'; COMMENT ON COLUMN "store_wallet_entries"."amount" IS '금액 (원) — 늘면 +, 줄면 -'; COMMENT ON COLUMN "store_wallet_entries"."balance_after" IS '이 내역 뒤 잔액 (원)'; COMMENT ON COLUMN "store_wallet_entries"."order_id" IS '관련 배달 (orders.id)'; COMMENT ON COLUMN "store_wallet_entries"."memo" IS '메모 (조정·환불 사유)'; COMMENT ON COLUMN "store_wallet_entries"."created_by" IS '조정한 운영자 (users.id)'; COMMENT ON COLUMN "store_wallet_entries"."created_at" IS '생긴 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_wallet_entries_store" ON "store_wallet_entries"  ("store_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "store_wallet_entries" IS '가게 충전금 내역 (충전·대행료 차감·환불·조정)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "store_wallet_entries" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_store_wallet_entries_store"`,
    );
    await queryRunner.query(`DROP TABLE "store_wallet_entries"`);
    await queryRunner.query(`COMMENT ON TABLE "stores" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_stores_status"`);
    await queryRunner.query(`DROP TABLE "stores"`);
  }
}
