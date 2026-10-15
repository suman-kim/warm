import { MigrationInterface, QueryRunner } from 'typeorm';

// 모든 컬럼에 설명(COMMENT)을 단다. 엔티티의 comment 옵션에서 만들었다 — 컬럼을 추가할 때도 comment를 적는다.
// TypeORM이 함께 내놓은 인덱스 삭제·재생성(정의가 같은 인덱스)은 뺐다.
// migrations 테이블은 TypeORM이 만드는 것이라 엔티티가 없어 직접 적는다.

export class AddColumnComments1791982052234 implements MigrationInterface {
  name = 'AddColumnComments1791982052234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON TABLE "migrations" IS '실행한 마이그레이션 (TypeORM이 관리)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "migrations"."id" IS '실행한 순서'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "migrations"."timestamp" IS '마이그레이션 클래스 이름 끝의 숫자 (만든 시각, ms)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "migrations"."name" IS '마이그레이션 클래스 이름'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."id" IS '주소 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."address" IS '주소 (도로명)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."detail_address" IS '상세 주소 (건물·동·호수)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."sigungu" IS '시·군·구'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."dong" IS '동'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."latitude" IS '위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."longitude" IS '경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."created_at" IS '저장한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."invitation_expires_at" IS '초대 링크가 만료되는 시각. 초대 중일 때만 있다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."last_login_at" IS '운영자 웹에 마지막으로 로그인한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."created_at" IS '운영자 계정을 만든(초대한) 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."id" IS '코드 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."code_hash" IS 'SHA-256(회원 ID:6자리 코드)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."expires_at" IS '코드가 만료되는 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."used_at" IS '코드를 써서 비밀번호를 바꾼 시각. 쓰기 전이면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."created_at" IS '발급한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."id" IS '토큰 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."user_id" IS 'users.id'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."expires_at" IS '만료 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."revoked_at" IS '폐기한 시각 (로그아웃·재발급). 쓸 수 있으면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_at" IS '발급한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."id" IS '문서 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."type" IS 'TERMS | PRIVACY | LOCATION | REFUND | DRIVER | MARKETING'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."title" IS '제목'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."body" IS '본문'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."created_at" IS '올린 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."latitude" IS '위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."longitude" IS '경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."updated_at" IS '기사 앱이 위치를 마지막으로 보고한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."id" IS '서류 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."storage_key" IS '파일 보관소(FileStorage)에서 파일을 찾는 키'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."content_type" IS '파일 형식 (MIME, 예: image/png, application/pdf)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."rejection_reason" IS '반려 사유 (운영자가 적은 것). 반려되지 않았으면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."uploaded_at" IS '올린 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."reviewed_at" IS '심사한 시각. 심사 전이면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_shifts"."id" IS '운행 기록 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_shifts"."started_at" IS '운행을 켠 시각'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "notices"."id" IS '공지 ID'`);
    await queryRunner.query(`COMMENT ON COLUMN "notices"."title" IS '제목'`);
    await queryRunner.query(`COMMENT ON COLUMN "notices"."body" IS '본문'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."published_at" IS '게시한 시각'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "drivers"."id" IS '기사 ID'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_number" IS '차량 번호 (예: 서울85자3412)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."rejection_reason" IS '반려 사유 (운영자가 적은 것). 반려 상태일 때만 있다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."approved_at" IS '승인된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."reviewed_at" IS '마지막으로 심사(승인·반려)한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."created_at" IS '기사 정보를 처음 만든(등록 신청한) 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."bank_name" IS '은행 이름'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."account_holder" IS '예금주'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_failure_reason" IS '본인 확인을 하지 못한 사유 (예: 예금주 이름이 가입자 이름과 달라요). 확인되면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_attempted_at" IS '본인 확인을 마지막으로 시도한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verified_at" IS '본인 확인이 된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notification_settings"."updated_at" IS '마지막으로 바꾼 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."id" IS '알림 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."title" IS '제목'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."body" IS '내용'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."read_at" IS '읽은 시각. 안 읽었으면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."created_at" IS '받은 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "push_devices"."id" IS '기기 등록 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "push_devices"."created_at" IS '처음 등록한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_messages"."id" IS '메시지 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_messages"."text" IS '내용'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_messages"."created_at" IS '보낸 시각'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."id" IS '주문 ID'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."service_type" IS 'QUICK(퀵배송) | FREIGHT(화물)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."vehicle_type" IS '차종: MOTORCYCLE | DAMAS | LABO | TRUCK_1T | TRUCK_2_5T'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_address" IS '출발지 주소 (도로명)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_detail_address" IS '출발지 상세 주소 (건물·동·호수)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_sigungu" IS '출발지 시·군·구 — 수락 전 기사에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_dong" IS '출발지 동 — 수락 전 기사에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_latitude" IS '출발지 위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_longitude" IS '출발지 경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_name" IS '출발지에서 물품을 넘겨줄 사람'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_phone" IS '출발지 연락처 (숫자만)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_address" IS '도착지 주소 (도로명)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_detail_address" IS '도착지 상세 주소 (건물·동·호수)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_sigungu" IS '도착지 시·군·구 — 수락 전 기사에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_dong" IS '도착지 동 — 수락 전 기사에게 보인다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_latitude" IS '도착지 위도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_longitude" IS '도착지 경도'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_name" IS '도착지에서 물품을 받을 사람'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_phone" IS '도착지 연락처 (숫자만)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_description" IS '물품 설명'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_weight_kg" IS '물품 무게(kg)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_quantity" IS '물품 개수'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."distance_km" IS '운행 거리(km) — 출발지에서 도착지까지'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_floor" IS '출발지 층'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_elevator" IS '출발지에 엘리베이터가 있는지'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_floor" IS '도착지 층'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_elevator" IS '도착지에 엘리베이터가 있는지'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."waiting_minutes" IS '기사가 출발지에 도착한 뒤 픽업까지 기다린 시간(분)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."scheduled_pickup_at" IS '고객이 정한 픽업 시각 (예약). 바로 출발이면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."estimated_pickup_at" IS '배차 때 계산한 픽업 예정 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."requested_at" IS '배송을 요청한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."assigned_at" IS '배차가 확정된 시각 (기사가 수락하고 결제가 된 시각)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."departed_at" IS '기사가 출발지로 출발한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."arrived_at" IS '기사가 출발지에 도착한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."picked_up_at" IS '픽업한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."delivered_at" IS '배송을 끝낸 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancelled_at" IS '취소된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."no_show_at" IS '기사가 노쇼를 신고한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancel_reason" IS '취소 사유'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."created_at" IS '만든 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "reviews"."id" IS '평가 ID'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "reviews"."comment" IS '고객이 남긴 말'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "reviews"."created_at" IS '평가한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."id" IS '지급 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."bank_name" IS '보낸 계좌의 은행 (지급 당시)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."masked_account_number" IS '보낸 계좌 번호 (끝 4자리만, 예: ••••1024)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."failure_reason" IS '보내지 못한 사유. 실패했을 때만 있다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."id" IS '결제 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."kind" IS 'DISPATCH(배차 때 요금) | ADDITIONAL(픽업 때 추가 요금)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."status" IS 'PAID | FAILED | PARTIALLY_CANCELLED | CANCELLED'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_brand" IS '결제한 카드의 카드사 (결제 당시)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_last4" IS '결제한 카드 번호 끝 4자리'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_type" IS 'CREDIT(신용) | CHECK(체크)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."approval_number" IS '카드 승인 번호. 결제가 안 됐으면 NULL'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."approved_at" IS '승인된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."failed_at" IS '결제가 안 된 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."cancelled_at" IS '마지막으로 취소(환불)한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."created_at" IS '결제를 시도한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."id" IS '카드 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."card_type" IS 'CREDIT(신용) | CHECK(체크)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."is_default" IS '기본 카드인지 — 배송을 요청할 때 먼저 선택된다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."created_at" IS '등록한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_refunds"."id" IS '환불 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_refunds"."reason" IS '환불 사유'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_refunds"."created_at" IS '환불한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."id" IS '정지 기록 ID'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."reason" IS '정지 사유'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."started_at" IS '정지가 시작된 시각'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "users"."id" IS '회원 ID'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."password_hash" IS '비밀번호의 bcrypt 해시'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "users"."name" IS '이름'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."withdrawn_at" IS '탈퇴한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."suspension_reason" IS '정지 사유 (정지 중일 때)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."created_at" IS '가입한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."name" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "migrations"."timestamp" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."id" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "migrations" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "users"."updated_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "users"."created_at" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."suspension_reason" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "users"."withdrawn_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "users"."name" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."password_hash" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "users"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."started_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_suspensions"."id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_refunds"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_refunds"."reason" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "order_refunds"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."is_default" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "payment_methods"."card_type" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "payment_methods"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."cancelled_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."failed_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."approved_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."approval_number" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_type" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_last4" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."card_brand" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_charges"."status" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "order_charges"."kind" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "order_charges"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."failure_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."masked_account_number" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."bank_name" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "settlement_payouts"."id" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "reviews"."created_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "reviews"."comment" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "reviews"."id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "orders"."updated_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "orders"."created_at" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancel_reason" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."no_show_at" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cancelled_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."delivered_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."picked_up_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."arrived_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "orders"."departed_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "orders"."assigned_at" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."requested_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."estimated_pickup_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."scheduled_pickup_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."waiting_minutes" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_elevator" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_floor" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_elevator" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_floor" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."distance_km" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_quantity" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_weight_kg" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."cargo_description" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_phone" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_contact_name" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_longitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_latitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_dong" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_sigungu" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_detail_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."dropoff_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_phone" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_contact_name" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_longitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_latitude" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."pickup_dong" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_sigungu" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_detail_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."pickup_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."vehicle_type" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."service_type" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "orders"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "order_messages"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "order_messages"."text" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "order_messages"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "push_devices"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "push_devices"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."read_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "notifications"."body" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notifications"."title" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "notifications"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notification_settings"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verified_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_attempted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."verification_failure_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."account_holder" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_settlement_accounts"."bank_name" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "drivers"."updated_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "drivers"."created_at" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."reviewed_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."approved_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."rejection_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_number" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "drivers"."vehicle_type" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "drivers"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "notices"."published_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "notices"."body" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "notices"."title" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "notices"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_shifts"."started_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "driver_shifts"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."reviewed_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."uploaded_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."rejection_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."content_type" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."storage_key" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_documents"."id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."longitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "driver_locations"."latitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."body" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."title" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "legal_documents"."type" IS 'TERMS | PRIVACY | LOCATION | DRIVER | MARKETING'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "legal_documents"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."expires_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."user_id" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "refresh_tokens"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."used_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."expires_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."code_hash" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "password_reset_codes"."id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."last_login_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "admin_accounts"."invitation_expires_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."created_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."longitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."latitude" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."dong" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."sigungu" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."detail_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "saved_addresses"."address" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "saved_addresses"."id" IS NULL`);
  }
}
