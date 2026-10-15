import { MigrationInterface, QueryRunner } from 'typeorm';

// 약관 동의 기록 — 가입할 때 어느 판의 이용약관·개인정보 처리방침·마케팅 수신에 동의했는지 남긴다.

export class AddLegalConsents1792031109666 implements MigrationInterface {
  name = 'AddLegalConsents1792031109666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "legal_consents" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "version" character varying(20), "agreed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_99429427aed6fb6c904c8165fa6" PRIMARY KEY ("id")); COMMENT ON COLUMN "legal_consents"."id" IS '동의 기록 ID'; COMMENT ON COLUMN "legal_consents"."user_id" IS 'users.id'; COMMENT ON COLUMN "legal_consents"."type" IS '약관 종류: TERMS | PRIVACY | LOCATION | REFUND | DRIVER | MARKETING'; COMMENT ON COLUMN "legal_consents"."version" IS '동의한 시각에 시행 중이던 판 번호 (올린 판이 없었으면 NULL)'; COMMENT ON COLUMN "legal_consents"."agreed_at" IS '동의한 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_legal_consents_user" ON "legal_consents"  ("user_id", "agreed_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "legal_consents" IS '약관 동의 기록 (어느 판에 언제 동의했는지)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "legal_consents" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_legal_consents_user"`);
    await queryRunner.query(`DROP TABLE "legal_consents"`);
  }
}
