import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminConsole1791890079822 implements MigrationInterface {
  name = 'AddAdminConsole1791890079822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_accounts" ("id" uuid NOT NULL, "role" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "invitation_token_hash" character varying(64), "invitation_expires_at" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_79fb3604ed15538685183d8df5f" PRIMARY KEY ("id")); COMMENT ON COLUMN "admin_accounts"."id" IS '회원 ID (users.id)'; COMMENT ON COLUMN "admin_accounts"."role" IS 'SUPER | OPS | FINANCE'; COMMENT ON COLUMN "admin_accounts"."status" IS 'ACTIVE | INVITED | INACTIVE'; COMMENT ON COLUMN "admin_accounts"."invitation_token_hash" IS '초대 토큰의 SHA-256. 초대 중일 때만 있다'; COMMENT ON COLUMN "admin_accounts"."version" IS '낙관적 잠금 버전'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4b4b527d9f94c69454f6518809" ON "admin_accounts"  ("invitation_token_hash") WHERE "invitation_token_hash" IS NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "admin_accounts" IS '운영자 계정 (권한·초대·비활성화)'`,
    );
    // 이미 있는 운영자(admin:promote로 만든 계정)는 최고 관리자로 둔다.
    await queryRunner.query(
      `INSERT INTO "admin_accounts" ("id", "role", "status", "version", "created_at") SELECT "id", 'SUPER', 'ACTIVE', 1, "created_at" FROM "users" WHERE "role" = 'ADMIN'`,
    );
    await queryRunner.query(
      `CREATE TABLE "settlement_payouts" ("id" uuid NOT NULL, "driver_id" uuid NOT NULL, "week_start" TIMESTAMP WITH TIME ZONE NOT NULL, "trips" integer NOT NULL, "gross" integer NOT NULL, "fee" integer NOT NULL, "net" integer NOT NULL, "bank_name" character varying(30) NOT NULL, "masked_account_number" character varying(30) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_by" uuid NOT NULL, CONSTRAINT "PK_57c7b0fdc27fc3bcd5883f0da32" PRIMARY KEY ("id")); COMMENT ON COLUMN "settlement_payouts"."driver_id" IS 'drivers.id'; COMMENT ON COLUMN "settlement_payouts"."week_start" IS '정산한 주의 시작 (한국 시간 월요일 0시)'; COMMENT ON COLUMN "settlement_payouts"."trips" IS '완료한 배송 수'; COMMENT ON COLUMN "settlement_payouts"."gross" IS '운행 매출(원)'; COMMENT ON COLUMN "settlement_payouts"."fee" IS '수수료(원)'; COMMENT ON COLUMN "settlement_payouts"."net" IS '지급한 금액(원)'; COMMENT ON COLUMN "settlement_payouts"."paid_by" IS '지급 처리한 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_settlement_payouts_paid_at" ON "settlement_payouts"  ("paid_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_settlement_payouts_driver_week" ON "settlement_payouts"  ("driver_id", "week_start") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "settlement_payouts" IS '정산 지급 기록'`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_suspensions" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "reason" character varying(500) NOT NULL, "suspended_by" uuid NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE, "lifted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_958b0dc95fc2a42b21f13eb22e7" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_suspensions"."user_id" IS 'users.id'; COMMENT ON COLUMN "user_suspensions"."suspended_by" IS '정지한 운영자 (users.id)'; COMMENT ON COLUMN "user_suspensions"."ends_at" IS '정지가 끝나는 시각. 무기한이면 NULL'; COMMENT ON COLUMN "user_suspensions"."lifted_at" IS '운영자가 해제한 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_suspensions_user" ON "user_suspensions"  ("user_id", "started_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "user_suspensions" IS '회원 정지 기록'`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_documents" ADD "created_by" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."created_by" IS '올린 운영자 (users.id)'`,
    );
    await queryRunner.query(`ALTER TABLE "notices" ADD "author_id" uuid`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."author_id" IS '올린 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "notices" ADD "removed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."removed_at" IS '내린 시각. 게시 중이면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD "previous_rejection_reason" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."previous_rejection_reason" IS '반려 뒤 다시 신청했을 때 앞서 반려된 사유'`,
    );
    // 이미 있는 기사는 가입한 때를 신청한 때로 본다.
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD "applied_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`UPDATE "drivers" SET "applied_at" = "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "drivers" ALTER COLUMN "applied_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."applied_at" IS '마지막으로 신청한 시각'`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD "reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    // 이미 심사한 기사: 승인은 승인한 때, 반려는 마지막으로 고친 때를 처리 시각으로 둔다. 처리한 사람은 알 수 없다.
    await queryRunner.query(
      `UPDATE "drivers" SET "reviewed_at" = COALESCE("approved_at", "updated_at") WHERE "status" IN ('APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(`ALTER TABLE "drivers" ADD "reviewed_by" uuid`);
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."reviewed_by" IS '심사한 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "suspended_until" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."suspended_until" IS '정지가 끝나는 시각. 무기한 정지면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "suspension_reason" character varying(500)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."type" IS 'TERMS | PRIVACY | LOCATION | DRIVER | MARKETING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."type" IS 'TERMS | PRIVACY | LOCATION | MARKETING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "suspension_reason"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."suspended_until" IS '정지가 끝나는 시각. 무기한 정지면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "suspended_until"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."reviewed_by" IS '심사한 운영자 (users.id)'`,
    );
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "reviewed_at"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."applied_at" IS '마지막으로 신청한 시각'`,
    );
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "applied_at"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."previous_rejection_reason" IS '반려 뒤 다시 신청했을 때 앞서 반려된 사유'`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" DROP COLUMN "previous_rejection_reason"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."removed_at" IS '내린 시각. 게시 중이면 NULL'`,
    );
    await queryRunner.query(`ALTER TABLE "notices" DROP COLUMN "removed_at"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."author_id" IS '올린 운영자 (users.id)'`,
    );
    await queryRunner.query(`ALTER TABLE "notices" DROP COLUMN "author_id"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."created_by" IS '올린 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_documents" DROP COLUMN "created_by"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "user_suspensions" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_suspensions_user"`);
    await queryRunner.query(`DROP TABLE "user_suspensions"`);
    await queryRunner.query(`COMMENT ON TABLE "settlement_payouts" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_settlement_payouts_driver_week"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_settlement_payouts_paid_at"`,
    );
    await queryRunner.query(`DROP TABLE "settlement_payouts"`);
    await queryRunner.query(`COMMENT ON TABLE "admin_accounts" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4b4b527d9f94c69454f6518809"`,
    );
    await queryRunner.query(`DROP TABLE "admin_accounts"`);
  }
}
