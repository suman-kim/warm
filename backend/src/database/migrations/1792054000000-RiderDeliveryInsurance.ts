import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 라이더 서류: 화물운송 종사 자격증 대신 유상운송(배달용) 이륜차 보험 증권을 받는다.
 * 이미 올린 자격증은 지우지 않고 보험 증권 자리로 옮겨 반려해 둔다 — 다시 올리게 한다.
 */
export class RiderDeliveryInsurance1792054000000 implements MigrationInterface {
  name = 'RiderDeliveryInsurance1792054000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "driver_documents" SET "type" = 'DELIVERY_INSURANCE', "status" = 'REJECTED', "rejection_reason" = '배달용 이륜차 보험 증권을 올려 주세요.', "reviewed_at" = now() WHERE "type" = 'FREIGHT_QUALIFICATION'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."type" IS 'DRIVER_LICENSE | VEHICLE_REGISTRATION | DELIVERY_INSURANCE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."type" IS 'DRIVER_LICENSE | VEHICLE_REGISTRATION | FREIGHT_QUALIFICATION'`,
    );
    await queryRunner.query(
      `UPDATE "driver_documents" SET "type" = 'FREIGHT_QUALIFICATION' WHERE "type" = 'DELIVERY_INSURANCE'`,
    );
  }
}
