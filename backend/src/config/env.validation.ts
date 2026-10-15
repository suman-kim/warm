import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * 환경변수 스키마. 형식이 틀리거나 필수값이 없으면 부팅이 실패한다.
 * 각 변수의 뜻은 .env.local.example에, 운영 값은 .env.prod.example에 적는다.
 */
class EnvVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DB_SSL: string = 'false';

  // 짧은 비밀키는 무차별 대입에 뚫린다 (HS256 권장 최소 256비트).
  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '30m';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  JWT_REFRESH_EXPIRES_DAYS: number = 30;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = '';

  // 카카오 로컬 API(주소 검색)의 REST API 키. 비우면 견본 주소에서만 찾는다 (운영에서는 필수).
  @IsOptional()
  @IsString()
  KAKAO_REST_API_KEY: string = '';

  // 포트원 V2 결제 연동. 셋 다 있으면 포트원으로, 없으면 개발용 결제로 돈 없이 돈다 (운영에서는 필수).
  @IsOptional()
  @IsString()
  PORTONE_STORE_ID: string = '';

  // 카드 등록·결제에 쓸 채널(PG사 연결)의 키. MOVO는 나이스페이먼츠 채널.
  @IsOptional()
  @IsString()
  PORTONE_CHANNEL_KEY: string = '';

  // 포트원 콘솔 > 결제 연동 > 연동 정보 > V2 API Secret. 서버만 쓴다.
  @IsOptional()
  @IsString()
  PORTONE_API_SECRET: string = '';

  // 형식은 config/firebase.config.ts가 부팅 때 확인한다.
  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_BASE64: string = '';

  @IsOptional()
  @IsString()
  UPLOAD_DIR: string = './uploads';

  // 요금에서 떼는 수수료율(%).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99)
  COMMISSION_RATE_PERCENT: number = 10;
  // 정산 지급 요일. 0 = 일요일 … 6 = 토요일.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  SETTLEMENT_PAYOUT_WEEKDAY: number = 2;
  // 고객이 낸 취소 수수료·노쇼 요금 중 기사에게 주는 몫(%). 0이면 플랫폼이 모두 갖는다.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  DRIVER_CANCELLATION_SHARE_PERCENT: number = 0;
  // 운영자 초대 메일의 링크가 가리키는 운영자 웹 주소.
  @IsOptional()
  @IsString()
  ADMIN_WEB_URL: string = 'http://localhost:5174';
  @IsOptional()
  @IsString()
  SUPPORT_PHONE: string = '';

  @IsOptional()
  @IsString()
  SUPPORT_EMAIL: string = '';

  @IsOptional()
  @IsString()
  SUPPORT_HOURS: string = '';

  @IsOptional()
  @IsString()
  SUPPORT_KAKAO_CHANNEL_URL: string = '';

  // 사업자 정보 — 앱의 사업자 정보 화면과 영수증에 보인다 (전자상거래법 표시 의무).
  @IsOptional()
  @IsString()
  BUSINESS_NAME: string = '';

  @IsOptional()
  @IsString()
  BUSINESS_REPRESENTATIVE: string = '';

  @IsOptional()
  @IsString()
  BUSINESS_REGISTRATION_NUMBER: string = '';

  @IsOptional()
  @IsString()
  BUSINESS_MAIL_ORDER_NUMBER: string = '';

  @IsOptional()
  @IsString()
  BUSINESS_ADDRESS: string = '';
}

/** ConfigModule의 validate 훅. 검증과 타입 변환을 거친 값을 돌려준다. */
export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const validated = plainToInstance(EnvVariables, config);
  const errors = validateSync(validated);
  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  ');
    throw new Error(`환경변수가 올바르지 않아요:\n  ${details}`);
  }
  return validated;
}
