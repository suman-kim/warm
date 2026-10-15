import { AggregateRoot } from '../../../../common/domain/aggregate-root.js';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverStatus } from '../driver-status.js';
import {
  DriverApprovedEvent,
  DriverRejectedEvent,
} from '../events/driver.events.js';

export interface DriverState {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: DriverStatus;
  /** 운행 중(온라인) 여부. 승인된 기사만 켤 수 있다. */
  available: boolean;
  rejectionReason: string | null;
  /** 반려된 뒤 다시 신청했을 때, 앞서 반려된 사유. 심사하는 운영자에게 보여 준다. */
  previousRejectionReason: string | null;
  approvedAt: Date | null;
  /** 지금 심사 중이거나 마지막으로 심사받은 신청을 낸 시각 */
  appliedAt: Date;
  /** 마지막으로 승인·반려된 시각과 처리한 운영자(회원 ID) */
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
}

export interface VehicleInfo {
  vehicleType: VehicleType;
  vehicleNumber: string;
}

/** 기사 애그리거트. 회원(역할 DRIVER) 한 명당 하나다. */
export class Driver extends AggregateRoot {
  private constructor(
    private readonly state: DriverState,
    version: number,
  ) {
    super(state.id, version);
  }

  /** 기사 등록 신청. 심사 대기 상태로 시작한다. */
  static apply(
    input: { id: string; userId: string; now: Date } & VehicleInfo,
  ): Driver {
    return new Driver(
      {
        id: input.id,
        userId: input.userId,
        ...normalizeVehicleInfo(input),
        status: DriverStatus.PENDING,
        available: false,
        rejectionReason: null,
        previousRejectionReason: null,
        approvedAt: null,
        appliedAt: input.now,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: input.now,
      },
      0,
    );
  }

  /** 저장된 상태에서 되살린다 (저장소 전용). */
  static restore(state: DriverState, version: number): Driver {
    return new Driver(state, version);
  }

  get userId(): string {
    return this.state.userId;
  }

  get status(): DriverStatus {
    return this.state.status;
  }

  get isAvailable(): boolean {
    return this.state.available;
  }

  /** 반려된 뒤 서류를 고쳐 다시 낸 신청이 심사를 기다리는 중인지. */
  get isResubmission(): boolean {
    return (
      this.state.status === DriverStatus.PENDING &&
      this.state.previousRejectionReason !== null
    );
  }

  /** 반려된 기사가 정보를 고쳐 다시 신청한다. */
  reapply(info: VehicleInfo, now: Date): void {
    if (this.state.status !== DriverStatus.REJECTED) {
      throw new ConflictError(
        'DRIVER_ALREADY_REGISTERED',
        '이미 기사 등록을 신청했어요.',
      );
    }
    Object.assign(this.state, normalizeVehicleInfo(info));
    this.state.status = DriverStatus.PENDING;
    this.state.previousRejectionReason = this.state.rejectionReason;
    this.state.rejectionReason = null;
    this.state.appliedAt = now;
  }

  /**
   * 승인된 기사가 차량을 바꾼다. 다시 심사를 받아야 해서 승인 전까지 운행할 수 없다.
   * 운행 중에는 바꿀 수 없다 — 먼저 운행을 끈다.
   */
  requestVehicleChange(info: VehicleInfo, now: Date): void {
    if (this.state.status !== DriverStatus.APPROVED) {
      throw new ConflictError(
        'DRIVER_NOT_APPROVED',
        '승인된 기사만 차량을 변경할 수 있어요.',
      );
    }
    if (this.state.available) {
      throw new ConflictError(
        'DRIVER_IS_ONLINE',
        '운행을 종료한 뒤에 차량을 변경할 수 있어요.',
      );
    }
    Object.assign(this.state, normalizeVehicleInfo(info));
    this.state.status = DriverStatus.PENDING;
    this.state.previousRejectionReason = null;
    this.state.appliedAt = now;
  }

  approve(now: Date, reviewerId: string): void {
    this.assertPending();
    this.state.status = DriverStatus.APPROVED;
    this.state.approvedAt = now;
    this.state.previousRejectionReason = null;
    this.markReviewed(now, reviewerId);
    this.raise(new DriverApprovedEvent(this.id, now, this.state.userId));
  }

  reject(reason: string, now: Date, reviewerId: string): void {
    this.assertPending();
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new InvalidArgumentError(
        'REJECTION_REASON_REQUIRED',
        '반려 사유를 입력해 주세요.',
      );
    }
    this.state.status = DriverStatus.REJECTED;
    this.state.rejectionReason = trimmed;
    this.markReviewed(now, reviewerId);
    this.raise(
      new DriverRejectedEvent(this.id, now, this.state.userId, trimmed),
    );
  }

  /** 운행 시작(온라인)·종료(오프라인). */
  changeAvailability(available: boolean): void {
    if (available && this.state.status !== DriverStatus.APPROVED) {
      throw new ConflictError(
        'DRIVER_NOT_APPROVED',
        '승인된 기사만 운행을 시작할 수 있어요.',
      );
    }
    this.state.available = available;
  }

  /** 지금 배차를 받을 수 있는지. */
  canAcceptOrders(): boolean {
    return this.state.status === DriverStatus.APPROVED && this.state.available;
  }

  snapshot(): Readonly<DriverState> {
    return { ...this.state };
  }

  private markReviewed(now: Date, reviewerId: string): void {
    this.state.reviewedAt = now;
    this.state.reviewedBy = reviewerId;
  }

  private assertPending(): void {
    if (this.state.status !== DriverStatus.PENDING) {
      throw new ConflictError(
        'DRIVER_NOT_PENDING',
        '심사 대기 중인 기사만 처리할 수 있어요.',
      );
    }
  }
}

function normalizeVehicleInfo(info: VehicleInfo): VehicleInfo {
  const vehicleNumber = info.vehicleNumber.replace(/\s/g, '');
  if (vehicleNumber.length < 4 || vehicleNumber.length > 15) {
    throw new InvalidArgumentError(
      'INVALID_VEHICLE_NUMBER',
      '차량 번호가 올바르지 않아요.',
    );
  }
  return { vehicleType: info.vehicleType, vehicleNumber };
}
