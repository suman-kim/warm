import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주문앱(따끈)을 더한다.
 * - 손님 가입의 휴대폰 인증(phone_verifications)과 손님 배달 주소(consumer_addresses)
 * - 가게의 주문앱 운영 설정(storefronts)과 메뉴(menu_categories, menu_items)
 * - 손님 주문(food_orders)과 리뷰(food_order_reviews)
 * - 가게 정산 내역·지급·계좌·보류(store_settlement_*, store_payouts)
 * - 운영자가 바꾸는 정책(platform_policies)과 바꾼 기록(platform_policy_changes)
 * - 배달(orders)이 어디서 왔는지(source)와 주문앱 주문(source_order_id). 지금까지의 배달은 STORE_REQUEST.
 */
export class AddFoodOrderApp1792069131976 implements MigrationInterface {
  name = 'AddFoodOrderApp1792069131976';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "phone_verifications" ("id" uuid NOT NULL, "phone" character varying(12) NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" smallint NOT NULL DEFAULT '0', "verified_at" TIMESTAMP WITH TIME ZONE, "token_hash" character varying(64), "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_11ef2c1c5ed828b9636472db666" PRIMARY KEY ("id")); COMMENT ON COLUMN "phone_verifications"."id" IS '인증 ID'; COMMENT ON COLUMN "phone_verifications"."phone" IS '휴대폰 번호 (숫자만)'; COMMENT ON COLUMN "phone_verifications"."code_hash" IS '인증 코드의 SHA-256 (번호를 섞어서)'; COMMENT ON COLUMN "phone_verifications"."expires_at" IS '코드가 만료되는 시각'; COMMENT ON COLUMN "phone_verifications"."attempts" IS '틀린 횟수'; COMMENT ON COLUMN "phone_verifications"."verified_at" IS '코드를 맞힌 시각. 아직이면 NULL'; COMMENT ON COLUMN "phone_verifications"."token_hash" IS '가입에 쓰는 인증 토큰의 SHA-256. 인증 전이면 NULL'; COMMENT ON COLUMN "phone_verifications"."used_at" IS '가입에 쓴 시각. 아직이면 NULL'; COMMENT ON COLUMN "phone_verifications"."created_at" IS '코드를 보낸 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_phone_verifications_token" ON "phone_verifications"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_phone_verifications_phone" ON "phone_verifications"  ("phone", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "phone_verifications" IS '휴대폰 번호 인증 (손님 가입). 코드와 토큰은 해시만 둔다'`,
    );
    await queryRunner.query(
      `CREATE TABLE "consumer_addresses" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "label" character varying(20) NOT NULL, "address" character varying(200) NOT NULL, "detail_address" character varying(200), "sigungu" character varying(50), "dong" character varying(50), "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "is_default" boolean NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b69f784123c4d8d93c5064c3603" PRIMARY KEY ("id")); COMMENT ON COLUMN "consumer_addresses"."id" IS '주소 ID'; COMMENT ON COLUMN "consumer_addresses"."user_id" IS '손님 (users.id)'; COMMENT ON COLUMN "consumer_addresses"."label" IS '주소 이름 (집, 회사…)'; COMMENT ON COLUMN "consumer_addresses"."address" IS '도로명 주소'; COMMENT ON COLUMN "consumer_addresses"."detail_address" IS '상세 주소'; COMMENT ON COLUMN "consumer_addresses"."sigungu" IS '시·군·구'; COMMENT ON COLUMN "consumer_addresses"."dong" IS '동'; COMMENT ON COLUMN "consumer_addresses"."latitude" IS '위도'; COMMENT ON COLUMN "consumer_addresses"."longitude" IS '경도'; COMMENT ON COLUMN "consumer_addresses"."is_default" IS '기본 주소인지 (손님마다 하나)'; COMMENT ON COLUMN "consumer_addresses"."created_at" IS '저장한 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consumer_addresses_user" ON "consumer_addresses"  ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "consumer_addresses" IS '손님이 저장한 배달 주소'`,
    );
    await queryRunner.query(
      `CREATE TABLE "food_orders" ("id" uuid NOT NULL, "consumer_user_id" uuid NOT NULL, "store_id" uuid NOT NULL, "store_owner_user_id" uuid NOT NULL, "store_name" character varying(50) NOT NULL, "lines" jsonb NOT NULL, "menu_amount" integer NOT NULL, "delivery_tip" integer NOT NULL, "payment_amount" integer NOT NULL, "dropoff_address" character varying(200) NOT NULL, "dropoff_detail_address" character varying(200), "dropoff_sigungu" character varying(50), "dropoff_dong" character varying(50), "dropoff_latitude" double precision NOT NULL, "dropoff_longitude" double precision NOT NULL, "consumer_phone" character varying(12) NOT NULL, "distance_km" double precision NOT NULL, "store_request" character varying(200), "rider_request" character varying(200), "disposable_cutlery" boolean NOT NULL, "commission_rate_percent" double precision NOT NULL, "payment_fee_rate_percent" double precision NOT NULL, "status" character varying(20) NOT NULL, "payment_id" character varying(64) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "cook_minutes" integer, "accepted_at" TIMESTAMP WITH TIME ZONE, "delivery_order_id" uuid, "picked_up_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "reject_reason" character varying(200), "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" character varying(500), "cancelled_by" character varying(10), "refunds" jsonb NOT NULL, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5765853128905c515770b51a04" PRIMARY KEY ("id")); COMMENT ON COLUMN "food_orders"."id" IS '주문 ID'; COMMENT ON COLUMN "food_orders"."consumer_user_id" IS '주문한 손님 (users.id)'; COMMENT ON COLUMN "food_orders"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "food_orders"."store_owner_user_id" IS '가게 사장님 (users.id)'; COMMENT ON COLUMN "food_orders"."store_name" IS '주문 당시 가게 이름'; COMMENT ON COLUMN "food_orders"."lines" IS '주문 당시 메뉴 [{menuItemId, name, unitPrice, quantity, options, lineTotal}]'; COMMENT ON COLUMN "food_orders"."menu_amount" IS '메뉴 금액 합(원)'; COMMENT ON COLUMN "food_orders"."delivery_tip" IS '손님이 낸 배달팁(원)'; COMMENT ON COLUMN "food_orders"."payment_amount" IS '결제 금액(원) = 메뉴 금액 + 배달팁'; COMMENT ON COLUMN "food_orders"."dropoff_address" IS '배달 주소 (도로명)'; COMMENT ON COLUMN "food_orders"."dropoff_detail_address" IS '배달 상세 주소'; COMMENT ON COLUMN "food_orders"."dropoff_sigungu" IS '배달 주소 시·군·구'; COMMENT ON COLUMN "food_orders"."dropoff_dong" IS '배달 주소 동'; COMMENT ON COLUMN "food_orders"."dropoff_latitude" IS '배달 주소 위도'; COMMENT ON COLUMN "food_orders"."dropoff_longitude" IS '배달 주소 경도'; COMMENT ON COLUMN "food_orders"."consumer_phone" IS '손님 연락처 (숫자만)'; COMMENT ON COLUMN "food_orders"."distance_km" IS '가게에서 손님까지 직선 거리(km)'; COMMENT ON COLUMN "food_orders"."store_request" IS '가게 요청사항'; COMMENT ON COLUMN "food_orders"."rider_request" IS '라이더 요청사항'; COMMENT ON COLUMN "food_orders"."disposable_cutlery" IS '수저·포크 받기'; COMMENT ON COLUMN "food_orders"."commission_rate_percent" IS '주문 당시 중개수수료율(%) — 메뉴 금액에 붙는다'; COMMENT ON COLUMN "food_orders"."payment_fee_rate_percent" IS '주문 당시 결제수수료율(%) — 결제 금액에 붙는다'; COMMENT ON COLUMN "food_orders"."status" IS 'PENDING_PAYMENT | PLACED | ACCEPTED | PICKED_UP | DELIVERED | REJECTED | CANCELLED'; COMMENT ON COLUMN "food_orders"."payment_id" IS 'PG 결제 ID'; COMMENT ON COLUMN "food_orders"."paid_at" IS '결제를 확인한 시각'; COMMENT ON COLUMN "food_orders"."cook_minutes" IS '가게가 정한 조리 시간(분)'; COMMENT ON COLUMN "food_orders"."accepted_at" IS '가게가 받은 시각'; COMMENT ON COLUMN "food_orders"."delivery_order_id" IS '가게가 받으면 요청한 배달 (orders.id)'; COMMENT ON COLUMN "food_orders"."picked_up_at" IS '라이더가 픽업한 시각'; COMMENT ON COLUMN "food_orders"."delivered_at" IS '배달을 끝낸 시각'; COMMENT ON COLUMN "food_orders"."rejected_at" IS '가게가 거절한 시각'; COMMENT ON COLUMN "food_orders"."reject_reason" IS '거절 사유'; COMMENT ON COLUMN "food_orders"."cancelled_at" IS '취소된 시각'; COMMENT ON COLUMN "food_orders"."cancel_reason" IS '취소 사유'; COMMENT ON COLUMN "food_orders"."cancelled_by" IS '취소한 쪽 CONSUMER | STORE | ADMIN'; COMMENT ON COLUMN "food_orders"."refunds" IS '환불 [{id, amount, reason, borneBy, refundedBy, refundedAt, status(PENDING|DONE|FAILED), completedAt, failureReason}]'; COMMENT ON COLUMN "food_orders"."version" IS '낙관적 잠금 버전'; COMMENT ON COLUMN "food_orders"."created_at" IS '주문을 만든 시각'; COMMENT ON COLUMN "food_orders"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_food_orders_payment" ON "food_orders"  ("payment_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_food_orders_delivery" ON "food_orders"  ("delivery_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_food_orders_status" ON "food_orders"  ("status", "paid_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_food_orders_store" ON "food_orders"  ("store_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_food_orders_consumer" ON "food_orders"  ("consumer_user_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "food_orders" IS '손님의 음식 주문 (주문앱 따끈)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "food_order_reviews" ("id" uuid NOT NULL, "food_order_id" uuid NOT NULL, "store_id" uuid NOT NULL, "consumer_user_id" uuid NOT NULL, "author_name" character varying(30) NOT NULL, "rating" smallint NOT NULL, "content" character varying(500), "order_summary" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8fe9630666f72df9df9decb30a1" PRIMARY KEY ("id")); COMMENT ON COLUMN "food_order_reviews"."id" IS '리뷰 ID'; COMMENT ON COLUMN "food_order_reviews"."food_order_id" IS '주문 (food_orders.id)'; COMMENT ON COLUMN "food_order_reviews"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "food_order_reviews"."consumer_user_id" IS '쓴 손님 (users.id)'; COMMENT ON COLUMN "food_order_reviews"."author_name" IS '보이는 이름 (가운데를 가린다)'; COMMENT ON COLUMN "food_order_reviews"."rating" IS '별점 1~5'; COMMENT ON COLUMN "food_order_reviews"."content" IS '리뷰 글'; COMMENT ON COLUMN "food_order_reviews"."order_summary" IS '시킨 메뉴 요약'; COMMENT ON COLUMN "food_order_reviews"."created_at" IS '쓴 시각'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_food_order_reviews_order" ON "food_order_reviews"  ("food_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_food_order_reviews_consumer" ON "food_order_reviews"  ("consumer_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_food_order_reviews_store" ON "food_order_reviews"  ("store_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "food_order_reviews" IS '손님 리뷰 (주문 하나에 하나)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_categories" ("id" uuid NOT NULL, "store_id" uuid NOT NULL, "name" character varying(30) NOT NULL, "sort_order" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_124ae987900336f983881cb04e6" PRIMARY KEY ("id")); COMMENT ON COLUMN "menu_categories"."id" IS '카테고리 ID'; COMMENT ON COLUMN "menu_categories"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "menu_categories"."name" IS '카테고리 이름'; COMMENT ON COLUMN "menu_categories"."sort_order" IS '보이는 순서 (작을수록 위)'; COMMENT ON COLUMN "menu_categories"."created_at" IS '만든 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_menu_categories_store" ON "menu_categories"  ("store_id", "sort_order") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "menu_categories" IS '메뉴 카테고리 (가게 안의 묶음)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_items" ("id" uuid NOT NULL, "store_id" uuid NOT NULL, "category_id" uuid NOT NULL, "name" character varying(50) NOT NULL, "description" character varying(300), "price" integer NOT NULL, "sort_order" integer NOT NULL, "hidden" boolean NOT NULL, "sold_out" boolean NOT NULL, "photo_key" character varying(200), "option_groups" jsonb NOT NULL, "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id")); COMMENT ON COLUMN "menu_items"."id" IS '메뉴 ID'; COMMENT ON COLUMN "menu_items"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "menu_items"."category_id" IS '카테고리 (menu_categories.id)'; COMMENT ON COLUMN "menu_items"."name" IS '메뉴 이름'; COMMENT ON COLUMN "menu_items"."description" IS '메뉴 설명'; COMMENT ON COLUMN "menu_items"."price" IS '가격(원)'; COMMENT ON COLUMN "menu_items"."sort_order" IS '카테고리 안에서 보이는 순서'; COMMENT ON COLUMN "menu_items"."hidden" IS '손님에게 숨겼는지'; COMMENT ON COLUMN "menu_items"."sold_out" IS '품절 (보이지만 담을 수 없다)'; COMMENT ON COLUMN "menu_items"."photo_key" IS '메뉴 사진 (파일 보관소 키)'; COMMENT ON COLUMN "menu_items"."option_groups" IS '옵션 묶음 [{id, name, minSelect, maxSelect, options: [{id, name, price, soldOut}]}]'; COMMENT ON COLUMN "menu_items"."version" IS '낙관적 잠금 버전'; COMMENT ON COLUMN "menu_items"."created_at" IS '만든 시각'; COMMENT ON COLUMN "menu_items"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_menu_items_category" ON "menu_items"  ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_menu_items_store" ON "menu_items"  ("store_id", "sort_order") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "menu_items" IS '메뉴 (옵션 묶음 포함)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_settlement_entries" ("id" uuid NOT NULL, "store_id" uuid NOT NULL, "food_order_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "amount" integer NOT NULL, "menu_amount" integer NOT NULL, "delivery_tip" integer NOT NULL, "commission" integer NOT NULL, "payment_fee" integer NOT NULL, "delivery_fee" integer NOT NULL, "memo" character varying(300), "payout_due_on" date NOT NULL, "payout_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4b23e9b112e0d9ee4fdace8fd55" PRIMARY KEY ("id")); COMMENT ON COLUMN "store_settlement_entries"."id" IS '정산 내역 ID'; COMMENT ON COLUMN "store_settlement_entries"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "store_settlement_entries"."food_order_id" IS '주문 (food_orders.id)'; COMMENT ON COLUMN "store_settlement_entries"."kind" IS 'SALE(배달 완료) | CANCELLATION_FEE(가게 취소 수수료) | REFUND(가게 부담 부분 환불)'; COMMENT ON COLUMN "store_settlement_entries"."amount" IS '가게가 받는(+)·내는(-) 금액(원)'; COMMENT ON COLUMN "store_settlement_entries"."menu_amount" IS 'SALE: 메뉴 금액'; COMMENT ON COLUMN "store_settlement_entries"."delivery_tip" IS 'SALE: 손님이 낸 배달팁'; COMMENT ON COLUMN "store_settlement_entries"."commission" IS 'SALE: 중개수수료'; COMMENT ON COLUMN "store_settlement_entries"."payment_fee" IS 'SALE: 결제수수료'; COMMENT ON COLUMN "store_settlement_entries"."delivery_fee" IS 'SALE: 배달대행료'; COMMENT ON COLUMN "store_settlement_entries"."memo" IS '메모'; COMMENT ON COLUMN "store_settlement_entries"."payout_due_on" IS '지급 예정일 (한국 날짜)'; COMMENT ON COLUMN "store_settlement_entries"."payout_id" IS '지급했으면 그 지급 (store_payouts.id)'; COMMENT ON COLUMN "store_settlement_entries"."created_at" IS '쌓은 시각'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_store_settlement_entries_order_kind" ON "store_settlement_entries"  ("food_order_id", "kind") WHERE kind <> 'REFUND'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_settlement_entries_payout" ON "store_settlement_entries"  ("payout_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_settlement_entries_due" ON "store_settlement_entries"  ("store_id", "payout_due_on") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_entries" IS '주문앱 가게 정산 내역 (주문별)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_payouts" ("id" uuid NOT NULL, "store_id" uuid NOT NULL, "due_on" date NOT NULL, "amount" integer NOT NULL, "entry_count" integer NOT NULL, "bank_name" character varying(20) NOT NULL, "masked_account_number" character varying(20) NOT NULL, "account_holder" character varying(30) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_by" uuid NOT NULL, CONSTRAINT "PK_8040a63fe853e25b89afdf135e0" PRIMARY KEY ("id")); COMMENT ON COLUMN "store_payouts"."id" IS '지급 ID'; COMMENT ON COLUMN "store_payouts"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "store_payouts"."due_on" IS '이 날까지 지급 예정이던 내역을 모았다'; COMMENT ON COLUMN "store_payouts"."amount" IS '보낸 금액(원)'; COMMENT ON COLUMN "store_payouts"."entry_count" IS '모은 정산 내역 수'; COMMENT ON COLUMN "store_payouts"."bank_name" IS '보낸 은행'; COMMENT ON COLUMN "store_payouts"."masked_account_number" IS '보낸 계좌 (끝 네 자리만)'; COMMENT ON COLUMN "store_payouts"."account_holder" IS '예금주'; COMMENT ON COLUMN "store_payouts"."paid_at" IS '보낸 시각'; COMMENT ON COLUMN "store_payouts"."paid_by" IS '지급 처리한 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_payouts_store" ON "store_payouts"  ("store_id", "paid_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "store_payouts" IS '가게에 보낸 정산금'`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_settlement_accounts" ("store_id" uuid NOT NULL, "bank_name" character varying(20) NOT NULL, "account_number" character varying(16) NOT NULL, "account_holder" character varying(30) NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE, "verified_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e09390d7e753eabd3d75a027c68" PRIMARY KEY ("store_id")); COMMENT ON COLUMN "store_settlement_accounts"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "store_settlement_accounts"."bank_name" IS '은행'; COMMENT ON COLUMN "store_settlement_accounts"."account_number" IS '계좌번호 (숫자만)'; COMMENT ON COLUMN "store_settlement_accounts"."account_holder" IS '예금주'; COMMENT ON COLUMN "store_settlement_accounts"."verified_at" IS '운영자가 확인한 시각. 계좌를 바꾸면 NULL'; COMMENT ON COLUMN "store_settlement_accounts"."verified_by" IS '확인한 운영자 (users.id)'; COMMENT ON COLUMN "store_settlement_accounts"."updated_at" IS '마지막으로 바꾼 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_accounts" IS '가게 정산 계좌'`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_settlement_holds" ("store_id" uuid NOT NULL, "reason" character varying(200) NOT NULL, "held_at" TIMESTAMP WITH TIME ZONE NOT NULL, "held_by" uuid NOT NULL, CONSTRAINT "PK_82b6d025caa6ff44109fc26333c" PRIMARY KEY ("store_id")); COMMENT ON COLUMN "store_settlement_holds"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "store_settlement_holds"."reason" IS '보류 사유'; COMMENT ON COLUMN "store_settlement_holds"."held_at" IS '보류한 시각'; COMMENT ON COLUMN "store_settlement_holds"."held_by" IS '보류한 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_holds" IS '가게 정산 지급 보류'`,
    );
    await queryRunner.query(
      `CREATE TABLE "storefronts" ("store_id" uuid NOT NULL, "category" character varying(20) NOT NULL, "description" character varying(300), "origin_notice" character varying(1000), "min_order_amount" integer NOT NULL, "max_delivery_km" double precision NOT NULL, "delivery_tip_rules" jsonb NOT NULL, "distance_tip_rules" jsonb NOT NULL, "business_hours" jsonb NOT NULL, "holidays" jsonb NOT NULL, "logo_key" character varying(200), "open" boolean NOT NULL, "paused_until" TIMESTAMP WITH TIME ZONE, "hidden_at" TIMESTAMP WITH TIME ZONE, "hidden_reason" character varying(200), "version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5faac682840728a832f82e66c39" PRIMARY KEY ("store_id")); COMMENT ON COLUMN "storefronts"."store_id" IS '가게 (stores.id)'; COMMENT ON COLUMN "storefronts"."category" IS '음식 종류 CHICKEN | PIZZA | KOREAN | CHINESE | JAPANESE | WESTERN | SNACK | JOKBAL | CAFE | FAST_FOOD | ASIAN | LUNCHBOX | LATE_NIGHT | OTHER'; COMMENT ON COLUMN "storefronts"."description" IS '가게 소개'; COMMENT ON COLUMN "storefronts"."origin_notice" IS '원산지 표시'; COMMENT ON COLUMN "storefronts"."min_order_amount" IS '최소 주문 금액(원) — 메뉴 금액 기준'; COMMENT ON COLUMN "storefronts"."max_delivery_km" IS '배달하는 거리(직선 km)'; COMMENT ON COLUMN "storefronts"."delivery_tip_rules" IS '주문금액별 손님 배달팁 [{minOrderAmount, tip}] — 가장 큰 기준을 쓴다'; COMMENT ON COLUMN "storefronts"."distance_tip_rules" IS '거리별 추가 배달팁 [{overKm, extra}] — 가장 큰 기준을 쓴다'; COMMENT ON COLUMN "storefronts"."business_hours" IS '요일별 영업시간 [일..토] {open, close} (HH:MM, 한국 시간). null이면 쉬는 날'; COMMENT ON COLUMN "storefronts"."holidays" IS '쉬는 날 (한국 날짜 YYYY-MM-DD 목록)'; COMMENT ON COLUMN "storefronts"."logo_key" IS '대표 사진 (파일 보관소 키)'; COMMENT ON COLUMN "storefronts"."open" IS '사장님이 주문 받기를 켰는지'; COMMENT ON COLUMN "storefronts"."paused_until" IS '임시 휴업이 끝나는 시각'; COMMENT ON COLUMN "storefronts"."hidden_at" IS '운영자가 손님 앱에서 내린 시각. 보이면 NULL'; COMMENT ON COLUMN "storefronts"."hidden_reason" IS '운영자가 내린 사유'; COMMENT ON COLUMN "storefronts"."version" IS '낙관적 잠금 버전'; COMMENT ON COLUMN "storefronts"."created_at" IS '만든 시각'; COMMENT ON COLUMN "storefronts"."updated_at" IS '마지막으로 바뀐 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_storefronts_category" ON "storefronts"  ("category") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "storefronts" IS '주문앱(따끈) 가게 운영 설정 — 가게 하나에 하나'`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_policies" ("key" character varying(40) NOT NULL, "value" jsonb NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_by" uuid, CONSTRAINT "PK_7ab5a1acc901bf492040730e3d8" PRIMARY KEY ("key")); COMMENT ON COLUMN "platform_policies"."key" IS '정책 이름 (MARKETPLACE)'; COMMENT ON COLUMN "platform_policies"."value" IS '정책 값'; COMMENT ON COLUMN "platform_policies"."updated_at" IS '마지막으로 바꾼 시각'; COMMENT ON COLUMN "platform_policies"."updated_by" IS '마지막으로 바꾼 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "platform_policies" IS '운영자가 서버 배포 없이 바꾸는 정책 (주문앱 수수료·정산 주기 등)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_policy_changes" ("id" uuid NOT NULL, "key" character varying(40) NOT NULL, "value" jsonb NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "changed_by" uuid NOT NULL, CONSTRAINT "PK_65a0b2bf80011b65b1e10b17a7f" PRIMARY KEY ("id")); COMMENT ON COLUMN "platform_policy_changes"."id" IS '기록 ID'; COMMENT ON COLUMN "platform_policy_changes"."key" IS '정책 이름 (MARKETPLACE)'; COMMENT ON COLUMN "platform_policy_changes"."value" IS '바꾼 뒤의 정책 값 전체'; COMMENT ON COLUMN "platform_policy_changes"."changed_at" IS '바꾼 시각'; COMMENT ON COLUMN "platform_policy_changes"."changed_by" IS '바꾼 운영자 (users.id)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_policy_changes_key" ON "platform_policy_changes"  ("key", "changed_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "platform_policy_changes" IS '정책을 바꾼 기록'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "source" character varying(20) NOT NULL DEFAULT 'STORE_REQUEST'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."source" IS '어디서 온 배달인지 STORE_REQUEST(가게가 직접 요청) | FOOD_ORDER(주문앱 따끈 주문)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "source_order_id" uuid`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."source_order_id" IS '주문앱 주문에서 왔으면 그 주문 (food_orders.id)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_source_order" ON "orders"  ("source_order_id") `,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."role" IS 'CUSTOMER(사장님) | DRIVER(라이더) | CONSUMER(주문앱 손님) | ADMIN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."role" IS 'CUSTOMER | DRIVER | ADMIN'`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_orders_source_order"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."source_order_id" IS '주문앱 주문에서 왔으면 그 주문 (food_orders.id)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "source_order_id"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "orders"."source" IS '어디서 온 배달인지 STORE_REQUEST(가게가 직접 요청) | FOOD_ORDER(주문앱 따끈 주문)'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "source"`);
    await queryRunner.query(
      `COMMENT ON TABLE "platform_policy_changes" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_policy_changes_key"`);
    await queryRunner.query(`DROP TABLE "platform_policy_changes"`);
    await queryRunner.query(`COMMENT ON TABLE "platform_policies" IS NULL`);
    await queryRunner.query(`DROP TABLE "platform_policies"`);
    await queryRunner.query(`COMMENT ON TABLE "storefronts" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_storefronts_category"`);
    await queryRunner.query(`DROP TABLE "storefronts"`);
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_holds" IS NULL`,
    );
    await queryRunner.query(`DROP TABLE "store_settlement_holds"`);
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_accounts" IS NULL`,
    );
    await queryRunner.query(`DROP TABLE "store_settlement_accounts"`);
    await queryRunner.query(`COMMENT ON TABLE "store_payouts" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_store_payouts_store"`);
    await queryRunner.query(`DROP TABLE "store_payouts"`);
    await queryRunner.query(
      `COMMENT ON TABLE "store_settlement_entries" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_store_settlement_entries_due"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_store_settlement_entries_payout"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_store_settlement_entries_order_kind"`,
    );
    await queryRunner.query(`DROP TABLE "store_settlement_entries"`);
    await queryRunner.query(`COMMENT ON TABLE "menu_items" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_menu_items_store"`);
    await queryRunner.query(`DROP INDEX "public"."idx_menu_items_category"`);
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`COMMENT ON TABLE "menu_categories" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_menu_categories_store"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
    await queryRunner.query(`COMMENT ON TABLE "food_order_reviews" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_food_order_reviews_store"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_food_order_reviews_consumer"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_food_order_reviews_order"`,
    );
    await queryRunner.query(`DROP TABLE "food_order_reviews"`);
    await queryRunner.query(`COMMENT ON TABLE "food_orders" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."idx_food_orders_consumer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_food_orders_store"`);
    await queryRunner.query(`DROP INDEX "public"."idx_food_orders_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_food_orders_delivery"`);
    await queryRunner.query(`DROP INDEX "public"."uq_food_orders_payment"`);
    await queryRunner.query(`DROP TABLE "food_orders"`);
    await queryRunner.query(`COMMENT ON TABLE "consumer_addresses" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_consumer_addresses_user"`,
    );
    await queryRunner.query(`DROP TABLE "consumer_addresses"`);
    await queryRunner.query(`COMMENT ON TABLE "phone_verifications" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_phone_verifications_phone"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_phone_verifications_token"`,
    );
    await queryRunner.query(`DROP TABLE "phone_verifications"`);
  }
}
