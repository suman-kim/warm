import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1791853090062 implements MigrationInterface {
  name = 'Init1791853090062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")); COMMENT ON COLUMN "refresh_tokens"."token_hash" IS '토큰 원문의 SHA-256'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "refresh_tokens" IS '리프레시 토큰 (해시만 보관)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "drivers" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "vehicle_type" character varying(20) NOT NULL, "vehicle_number" character varying(15) NOT NULL, "license_number" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "available" boolean NOT NULL, "rejection_reason" text, "approved_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8e224f1b8f05ace7cfc7c76d03b" UNIQUE ("user_id"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id")); COMMENT ON COLUMN "drivers"."user_id" IS 'users.id'; COMMENT ON COLUMN "drivers"."status" IS 'PENDING | APPROVED | REJECTED'; COMMENT ON COLUMN "drivers"."available" IS '운행 중(온라인) 여부'; COMMENT ON COLUMN "drivers"."version" IS '낙관적 잠금 버전'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dae9223023a6734f8763c7cf16" ON "drivers"  ("status") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "drivers" IS '기사 (차량·심사 상태)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL, "customer_id" uuid NOT NULL, "driver_id" uuid, "service_type" character varying(20) NOT NULL, "vehicle_type" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "pickup_address" character varying(200) NOT NULL, "pickup_detail_address" character varying(200), "pickup_latitude" double precision NOT NULL, "pickup_longitude" double precision NOT NULL, "pickup_contact_name" character varying(50) NOT NULL, "pickup_contact_phone" character varying(11) NOT NULL, "dropoff_address" character varying(200) NOT NULL, "dropoff_detail_address" character varying(200), "dropoff_latitude" double precision NOT NULL, "dropoff_longitude" double precision NOT NULL, "dropoff_contact_name" character varying(50) NOT NULL, "dropoff_contact_phone" character varying(11) NOT NULL, "cargo_description" character varying(200) NOT NULL, "cargo_weight_kg" double precision NOT NULL, "cargo_quantity" integer NOT NULL, "memo" character varying(500), "distance_km" double precision NOT NULL, "fare_amount" integer NOT NULL, "scheduled_pickup_at" TIMESTAMP WITH TIME ZONE, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL, "assigned_at" TIMESTAMP WITH TIME ZONE, "picked_up_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" character varying(500), "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")); COMMENT ON COLUMN "orders"."customer_id" IS 'users.id'; COMMENT ON COLUMN "orders"."driver_id" IS 'drivers.id'; COMMENT ON COLUMN "orders"."status" IS 'REQUESTED | ASSIGNED | PICKED_UP | DELIVERED | CANCELLED'; COMMENT ON COLUMN "orders"."memo" IS '요청 사항'; COMMENT ON COLUMN "orders"."fare_amount" IS '요금(원)'; COMMENT ON COLUMN "orders"."version" IS '낙관적 잠금 버전'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_driver" ON "orders"  ("driver_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_customer" ON "orders"  ("customer_id", "requested_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_open" ON "orders"  ("status", "vehicle_type", "requested_at") `,
    );
    await queryRunner.query(`COMMENT ON TABLE "orders" IS '주문 (배송 요청)'`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(100) NOT NULL, "name" character varying(50) NOT NULL, "phone" character varying(11) NOT NULL, "role" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")); COMMENT ON COLUMN "users"."email" IS '소문자 이메일'; COMMENT ON COLUMN "users"."phone" IS '숫자만'; COMMENT ON COLUMN "users"."role" IS 'CUSTOMER | DRIVER | ADMIN'; COMMENT ON COLUMN "users"."status" IS 'ACTIVE | SUSPENDED | WITHDRAWN'; COMMENT ON COLUMN "users"."version" IS '낙관적 잠금 버전'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "users" IS '회원 (고객·기사·운영자)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "users" IS NULL`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`COMMENT ON TABLE "orders" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_open"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_customer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_driver"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`COMMENT ON TABLE "drivers" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dae9223023a6734f8763c7cf16"`,
    );
    await queryRunner.query(`DROP TABLE "drivers"`);
    await queryRunner.query(`COMMENT ON TABLE "refresh_tokens" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
