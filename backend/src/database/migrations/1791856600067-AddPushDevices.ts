import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushDevices1791856600067 implements MigrationInterface {
  name = 'AddPushDevices1791856600067';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_devices" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "token" character varying(1024) NOT NULL, "platform" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_46b68decfd1164e1a796f48dc4a" PRIMARY KEY ("id")); COMMENT ON COLUMN "push_devices"."user_id" IS 'users.id'; COMMENT ON COLUMN "push_devices"."token" IS 'FCM 등록 토큰'; COMMENT ON COLUMN "push_devices"."platform" IS 'ANDROID | IOS'; COMMENT ON COLUMN "push_devices"."updated_at" IS '앱이 마지막으로 이 토큰을 등록(확인)한 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_devices_user" ON "push_devices"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_push_devices_token" ON "push_devices"  ("token") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "push_devices" IS '푸시 알림을 받을 기기 (회원당 여러 개)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "push_devices" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."uq_push_devices_token"`);
    await queryRunner.query(`DROP INDEX "public"."idx_push_devices_user"`);
    await queryRunner.query(`DROP TABLE "push_devices"`);
  }
}
