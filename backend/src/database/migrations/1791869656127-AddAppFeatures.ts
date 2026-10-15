import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppFeatures1791869656127 implements MigrationInterface {
  name = 'AddAppFeatures1791869656127';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 5톤 트럭은 더 받지 않는다. 그 차종으로 남은 주문·기사가 있으면 어떤 차종으로 옮길지
    // 사람이 정해야 하므로, 여기서 임의로 바꾸지 않고 멈춘다.
    const [{ count }] = await queryRunner.query(
      `SELECT (SELECT count(*) FROM "orders" WHERE "vehicle_type" = 'TRUCK_5T') + (SELECT count(*) FROM "drivers" WHERE "vehicle_type" = 'TRUCK_5T') AS count`,
    );
    if (Number(count) > 0) {
      throw new Error(
        `차종이 TRUCK_5T인 주문·기사가 ${count}건 있어요. 다른 차종으로 옮긴 뒤 다시 실행해 주세요.`,
      );
    }
    await queryRunner.query(
      `CREATE TABLE "password_reset_codes" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f3a88f7bc4536c53f2b277a0b56" PRIMARY KEY ("id")); COMMENT ON COLUMN "password_reset_codes"."user_id" IS 'users.id'; COMMENT ON COLUMN "password_reset_codes"."attempts" IS '틀린 횟수'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_reset_codes_user" ON "password_reset_codes"  ("user_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "password_reset_codes" IS '비밀번호 재설정 인증 코드 (해시만 보관)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "notices" ("id" uuid NOT NULL, "title" character varying(100) NOT NULL, "body" text NOT NULL, "audience" character varying(20) NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3eb18c29da25d6935fcbe584237" PRIMARY KEY ("id")); COMMENT ON COLUMN "notices"."audience" IS 'ALL | CUSTOMER | DRIVER'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notices_audience_published" ON "notices"  ("audience", "published_at") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "notices" IS '공지사항'`);
    await queryRunner.query(
      `CREATE TABLE "saved_addresses" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "label" character varying(30) NOT NULL, "address" character varying(200) NOT NULL, "detail_address" character varying(200), "sigungu" character varying(50), "dong" character varying(50), "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_2dcd5492d2ac696c133d461db8b" PRIMARY KEY ("id")); COMMENT ON COLUMN "saved_addresses"."user_id" IS 'users.id'; COMMENT ON COLUMN "saved_addresses"."label" IS '회원이 붙인 이름'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_addresses_user" ON "saved_addresses"  ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "saved_addresses" IS '자주 쓰는 주소'`,
    );
    await queryRunner.query(
      `CREATE TABLE "legal_documents" ("id" uuid NOT NULL, "type" character varying(20) NOT NULL, "version" character varying(20) NOT NULL, "title" character varying(100) NOT NULL, "body" text NOT NULL, "effective_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_846b11262368906ded5d26ac271" PRIMARY KEY ("id")); COMMENT ON COLUMN "legal_documents"."type" IS 'TERMS | PRIVACY | LOCATION | MARKETING'; COMMENT ON COLUMN "legal_documents"."version" IS '판 번호'; COMMENT ON COLUMN "legal_documents"."effective_at" IS '시행일'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_legal_documents_type_effective" ON "legal_documents"  ("type", "effective_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_legal_documents_type_version" ON "legal_documents"  ("type", "version") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "legal_documents" IS '약관·정책 문서 (판마다 한 줄)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "driver_documents" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(30) NOT NULL, "status" character varying(20) NOT NULL, "storage_key" character varying(200) NOT NULL, "content_type" character varying(50) NOT NULL, "size" integer NOT NULL, "rejection_reason" text, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reviewed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_31c28b4e8f55a5d411597d45ab2" PRIMARY KEY ("id")); COMMENT ON COLUMN "driver_documents"."user_id" IS 'users.id'; COMMENT ON COLUMN "driver_documents"."type" IS 'DRIVER_LICENSE | VEHICLE_REGISTRATION | FREIGHT_QUALIFICATION'; COMMENT ON COLUMN "driver_documents"."status" IS 'SUBMITTED | APPROVED | REJECTED'; COMMENT ON COLUMN "driver_documents"."size" IS '파일 크기(바이트)'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_driver_documents_user_type" ON "driver_documents"  ("user_id", "type") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "driver_documents" IS '기사 등록 서류'`,
    );
    await queryRunner.query(
      `CREATE TABLE "driver_settlement_accounts" ("driver_id" uuid NOT NULL, "bank_name" character varying(30) NOT NULL, "account_number" character varying(16) NOT NULL, "account_holder" character varying(50) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8ca6e4f29d817ca80414377b0e" PRIMARY KEY ("driver_id")); COMMENT ON COLUMN "driver_settlement_accounts"."driver_id" IS 'drivers.id'; COMMENT ON COLUMN "driver_settlement_accounts"."account_number" IS '숫자만'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "driver_settlement_accounts" IS '기사 정산 계좌'`,
    );
    await queryRunner.query(
      `CREATE TABLE "driver_locations" ("driver_id" uuid NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_096de534e1c6301cf7f2a4bf032" PRIMARY KEY ("driver_id")); COMMENT ON COLUMN "driver_locations"."driver_id" IS 'drivers.id'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "driver_locations" IS '기사의 마지막 위치'`,
    );
    await queryRunner.query(
      `CREATE TABLE "driver_shifts" ("id" uuid NOT NULL, "driver_id" uuid NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_026dc3b73ae9a4a9779fa3a680c" PRIMARY KEY ("id")); COMMENT ON COLUMN "driver_shifts"."driver_id" IS 'drivers.id'; COMMENT ON COLUMN "driver_shifts"."ended_at" IS '아직 운행 중이면 NULL'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_driver_shifts_driver" ON "driver_shifts"  ("driver_id", "started_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "driver_shifts" IS '기사 운행 기록 (켠 시각 ~ 끈 시각)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(30) NOT NULL, "title" character varying(100) NOT NULL, "body" character varying(500) NOT NULL, "data" jsonb NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")); COMMENT ON COLUMN "notifications"."user_id" IS 'users.id'; COMMENT ON COLUMN "notifications"."type" IS 'ORDER_ASSIGNED 등 알림 종류'; COMMENT ON COLUMN "notifications"."data" IS '눌렀을 때 갈 곳을 정하는 값'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user" ON "notifications"  ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "notifications" IS '알림함 (회원이 받은 알림)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_settings" ("user_id" uuid NOT NULL, "push_enabled" boolean NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_91a7ffebe8b406c4470845d4781" PRIMARY KEY ("user_id")); COMMENT ON COLUMN "notification_settings"."user_id" IS 'users.id'; COMMENT ON COLUMN "notification_settings"."push_enabled" IS '푸시 알림을 받을지'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "notification_settings" IS '회원별 알림 설정'`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_messages" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "sender_user_id" uuid NOT NULL, "text" character varying(500) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_25d8eb6fb6e1ccb6b33e034ee28" PRIMARY KEY ("id")); COMMENT ON COLUMN "order_messages"."order_id" IS 'orders.id'; COMMENT ON COLUMN "order_messages"."sender_user_id" IS 'users.id'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_messages_order" ON "order_messages"  ("order_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "order_messages" IS '주문 메시지 (고객 ↔ 배차된 기사)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "driver_id" uuid NOT NULL, "rating" integer NOT NULL, "tags" text array NOT NULL, "comment" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id")); COMMENT ON COLUMN "reviews"."order_id" IS 'orders.id'; COMMENT ON COLUMN "reviews"."customer_id" IS 'users.id'; COMMENT ON COLUMN "reviews"."driver_id" IS 'drivers.id'; COMMENT ON COLUMN "reviews"."rating" IS '별점 1~5'; COMMENT ON COLUMN "reviews"."tags" IS 'KIND | FAST | CAREFUL'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reviews_driver" ON "reviews"  ("driver_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reviews_order" ON "reviews"  ("order_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "reviews" IS '배송 평가 (고객 → 기사)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" DROP COLUMN "license_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_agreed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."terms_agreed_at" IS '이용약관 동의'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "privacy_agreed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."privacy_agreed_at" IS '개인정보 수집·이용 동의'`,
    );
    // 약관 동의를 받기 전에 만든 계정은 가입 시각을 동의 시각으로 채운다.
    // 출시 전이라 개발용 계정뿐이다 — 실제 회원이 있는 DB라면 동의를 다시 받아야 한다.
    await queryRunner.query(
      `UPDATE "users" SET "terms_agreed_at" = "created_at", "privacy_agreed_at" = "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "terms_agreed_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "privacy_agreed_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "marketing_agreed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."marketing_agreed_at" IS '마케팅 정보 수신 동의. 동의하지 않았으면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "withdrawn_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_sigungu" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "pickup_dong" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_sigungu" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "dropoff_dong" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "cargo_category" character varying(30)`,
    );
    // 종류를 고르기 전에 만든 주문은 '기타'로 둔다 (설명은 cargo_description에 그대로 있다).
    await queryRunner.query(`UPDATE "orders" SET "cargo_category" = 'ETC'`);
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "cargo_category" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_category" IS 'DOCUMENT | BOX | SHOPPING_BAG | FURNITURE_APPLIANCE | ETC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "duration_minutes" integer`,
    );
    // 지난 주문의 예상 시간은 거리에서 어림한다 (EstimatedRoutePlanner와 같은 식).
    await queryRunner.query(
      `UPDATE "orders" SET "duration_minutes" = CEIL("distance_km" * 3.5 + 2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "duration_minutes" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."duration_minutes" IS '예상 소요 시간(분)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "estimated_pickup_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "cargo_description" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "orders" SET "cargo_description" = '' WHERE "cargo_description" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "cargo_description" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "estimated_pickup_at"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."duration_minutes" IS '예상 소요 시간(분)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "duration_minutes"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_category" IS 'DOCUMENT | BOX | SHOPPING_BAG | FURNITURE_APPLIANCE | ETC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "cargo_category"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "dropoff_dong"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "dropoff_sigungu"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "pickup_dong"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "pickup_sigungu"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "withdrawn_at"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."marketing_agreed_at" IS '마케팅 정보 수신 동의. 동의하지 않았으면 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "marketing_agreed_at"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."privacy_agreed_at" IS '개인정보 수집·이용 동의'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "privacy_agreed_at"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."terms_agreed_at" IS '이용약관 동의'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "terms_agreed_at"`,
    );
    // 지운 면허 번호는 되살릴 수 없어 빈 값으로 채운다.
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD "license_number" character varying(20) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" ALTER COLUMN "license_number" DROP DEFAULT`,
    );
    await queryRunner.query(`COMMENT ON TABLE "reviews" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."uq_reviews_order"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reviews_driver"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`COMMENT ON TABLE "order_messages" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_order_messages_order"`);
    await queryRunner.query(`DROP TABLE "order_messages"`);
    await queryRunner.query(`COMMENT ON TABLE "notification_settings" IS NULL`);
    await queryRunner.query(`DROP TABLE "notification_settings"`);
    await queryRunner.query(`COMMENT ON TABLE "notifications" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_user"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`COMMENT ON TABLE "driver_shifts" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_driver_shifts_driver"`);
    await queryRunner.query(`DROP TABLE "driver_shifts"`);
    await queryRunner.query(`COMMENT ON TABLE "driver_locations" IS NULL`);
    await queryRunner.query(`DROP TABLE "driver_locations"`);
    await queryRunner.query(
      `COMMENT ON TABLE "driver_settlement_accounts" IS NULL`,
    );
    await queryRunner.query(`DROP TABLE "driver_settlement_accounts"`);
    await queryRunner.query(`COMMENT ON TABLE "driver_documents" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_driver_documents_user_type"`,
    );
    await queryRunner.query(`DROP TABLE "driver_documents"`);
    await queryRunner.query(`COMMENT ON TABLE "legal_documents" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_legal_documents_type_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_legal_documents_type_effective"`,
    );
    await queryRunner.query(`DROP TABLE "legal_documents"`);
    await queryRunner.query(`COMMENT ON TABLE "saved_addresses" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_saved_addresses_user"`);
    await queryRunner.query(`DROP TABLE "saved_addresses"`);
    await queryRunner.query(`COMMENT ON TABLE "notices" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_notices_audience_published"`,
    );
    await queryRunner.query(`DROP TABLE "notices"`);
    await queryRunner.query(`COMMENT ON TABLE "password_reset_codes" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_password_reset_codes_user"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_codes"`);
  }
}
