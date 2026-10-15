import { MigrationInterface, QueryRunner } from 'typeorm';

// 로그인 실패 기록 — 한 이메일로 15분 안에 다섯 번 틀리면 15분 동안 로그인을 막는다.

export class AddLoginAttempts1792031270759 implements MigrationInterface {
  name = 'AddLoginAttempts1792031270759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "login_attempts" ("email" character varying(254) NOT NULL, "failures" integer NOT NULL, "window_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "locked_until" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0aedff58b23995504f9dc99f75d" PRIMARY KEY ("email")); COMMENT ON COLUMN "login_attempts"."email" IS '로그인에 쓴 이메일 (소문자, 가입하지 않은 이메일도 남는다)'; COMMENT ON COLUMN "login_attempts"."failures" IS '지금 구간에서 틀린 횟수'; COMMENT ON COLUMN "login_attempts"."window_started_at" IS '실패를 세기 시작한 시각 (15분이 지나면 다시 센다)'; COMMENT ON COLUMN "login_attempts"."locked_until" IS '이 시각까지 로그인을 막는다 (안 막혔으면 NULL)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "login_attempts" IS '로그인 실패 기록 (여러 번 틀리면 잠시 막는다)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "login_attempts" IS NULL`);
    await queryRunner.query(`DROP TABLE "login_attempts"`);
  }
}
