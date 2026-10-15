import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverStatus } from '../../domain/driver-status.js';
import {
  DriverDocument,
  DriverDocumentStatus,
  DriverDocumentType,
  REQUIRED_DOCUMENTS,
} from '../../domain/entities/driver-document.entity.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import {
  AccountVerificationStatus,
  SettlementAccount,
} from '../../domain/value-objects.js';

/** 기사 정보 응답. */
export class DriverResult {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: DriverStatus;
  /** 운행 중(온라인) 여부 */
  available: boolean;
  rejectionReason: string | null;
  approvedAt: Date | null;
  /** 지금 심사 중이거나 마지막으로 심사받은 신청을 낸 시각 */
  appliedAt: Date;
  /** 마지막으로 승인·반려된 시각 */
  reviewedAt: Date | null;
  createdAt: Date;
}

/** 내 기사 정보 응답. 운행 시간이 붙는다. */
export class MyDriverResult extends DriverResult {
  /** 지금 운행 중이면 운행을 켠 시각, 아니면 null */
  onlineSince: Date | null;
  /** 오늘(한국 날짜) 운행한 시간(초). 지금 켜져 있는 운행도 포함한다. */
  todayOnlineSeconds: number;
}

/** 운영자가 보는 기사 목록 응답. 탭에 보일 상태별 건수가 붙는다. */
export class AdminDriverPageResult {
  items: AdminDriverResult[];
  total: number;
  page: number;
  size: number;
  counts: Record<DriverStatus, number>;
}

/** 서류 한 종류의 상태. 아직 올리지 않은 서류도 NOT_SUBMITTED로 내려간다. */
export class DriverDocumentResult {
  type: DriverDocumentType;
  status: DriverDocumentStatus | 'NOT_SUBMITTED';
  /** 반려됐을 때 운영자가 적은 사유 */
  rejectionReason: string | null;
  uploadedAt: Date | null;
}

/** 신청한 사람 */
export class ApplicantResult {
  name: string;
  phone: string;
  email: string;
}

/** 운영자가 보는 서류. 파일 종류와 크기가 붙는다. */
export class AdminDriverDocumentResult extends DriverDocumentResult {
  /** 예: image/jpeg, application/pdf. 올리지 않았으면 null. */
  contentType: string | null;
  /** 바이트. 올리지 않았으면 null. */
  size: number | null;
  /** 반려된 뒤 다시 올려 심사를 기다리는 서류인지 */
  resubmitted: boolean;
}

/** 운영자가 보는 기사 신청. 신청한 사람, 처리한 운영자, 서류가 붙는다. */
export class AdminDriverResult extends DriverResult {
  applicant: ApplicantResult | null;
  /** 마지막으로 승인·반려한 운영자의 이름 */
  reviewerName: string | null;
  /** 반려된 뒤 다시 낸 신청이 심사를 기다리는 중인지 */
  resubmitted: boolean;
  /** 다시 낸 신청일 때, 앞서 반려된 사유 */
  previousRejectionReason: string | null;
  documents: AdminDriverDocumentResult[];
}

/** 정산 계좌 응답. 계좌번호는 끝 네 자리만 준다. */
export class SettlementAccountResult {
  bankName: string;
  /** 예: ••••1024 */
  maskedAccountNumber: string;
  accountHolder: string;
  /** 본인 명의 확인. VERIFIED가 아니면 정산이 보류된다. */
  verificationStatus: AccountVerificationStatus;
  /** 확인하지 못한 사유 */
  verificationFailureReason: string | null;
  /** 마지막으로 확인을 시도한 시각 */
  verificationAttemptedAt: Date | null;
  verifiedAt: Date | null;
}

export function toDriverResult(driver: Driver): DriverResult {
  const state = driver.snapshot();
  return {
    id: state.id,
    userId: state.userId,
    vehicleType: state.vehicleType,
    vehicleNumber: state.vehicleNumber,
    status: state.status,
    available: state.available,
    rejectionReason: state.rejectionReason,
    approvedAt: state.approvedAt,
    appliedAt: state.appliedAt,
    reviewedAt: state.reviewedAt,
    createdAt: state.createdAt,
  };
}

interface Person {
  name: string;
  phone: string;
  email: string;
}

/** 운영자가 보는 기사 신청. [applicant]·[reviewer]는 회원에서 읽어 온 값. */
export function toAdminDriverResult(
  driver: Driver,
  documents: DriverDocument[],
  applicant: Person | null,
  reviewer: Person | null,
): AdminDriverResult {
  return {
    ...toDriverResult(driver),
    applicant: applicant && {
      name: applicant.name,
      phone: applicant.phone,
      email: applicant.email,
    },
    reviewerName: reviewer?.name ?? null,
    resubmitted: driver.isResubmission,
    previousRejectionReason: driver.isResubmission
      ? driver.snapshot().previousRejectionReason
      : null,
    documents: REQUIRED_DOCUMENTS.map((type) => {
      const document = documents.find((each) => each.type === type);
      return {
        type,
        status: document?.status ?? 'NOT_SUBMITTED',
        rejectionReason: document?.rejectionReason ?? null,
        uploadedAt: document?.uploadedAt ?? null,
        contentType: document?.contentType ?? null,
        size: document?.size ?? null,
        resubmitted:
          driver.isResubmission &&
          document?.status === DriverDocumentStatus.SUBMITTED,
      };
    }),
  };
}

/** 필요한 서류를 모두, 정해진 순서로. 올리지 않은 것은 NOT_SUBMITTED. */
export function toDocumentResults(
  documents: DriverDocument[],
): DriverDocumentResult[] {
  return REQUIRED_DOCUMENTS.map((type) => {
    const document = documents.find((each) => each.type === type);
    return {
      type,
      status: document?.status ?? 'NOT_SUBMITTED',
      rejectionReason: document?.rejectionReason ?? null,
      uploadedAt: document?.uploadedAt ?? null,
    };
  });
}

export function toSettlementAccountResult(
  account: SettlementAccount,
): SettlementAccountResult {
  return {
    bankName: account.bankName,
    maskedAccountNumber: account.maskedNumber,
    accountHolder: account.accountHolder,
    verificationStatus: account.verification.status,
    verificationFailureReason: account.verification.failureReason,
    verificationAttemptedAt: account.verification.attemptedAt,
    verifiedAt: account.verification.verifiedAt,
  };
}
