import {
  DriverDocument,
  DriverDocumentType,
} from '../entities/driver-document.entity.js';
import { SettlementAccount } from '../value-objects.js';

export const DRIVER_DOCUMENT_REPOSITORY = Symbol('DRIVER_DOCUMENT_REPOSITORY');
export const DRIVER_SHIFT_REPOSITORY = Symbol('DRIVER_SHIFT_REPOSITORY');
export const DRIVER_LOCATION_REPOSITORY = Symbol('DRIVER_LOCATION_REPOSITORY');
export const SETTLEMENT_ACCOUNT_REPOSITORY = Symbol(
  'SETTLEMENT_ACCOUNT_REPOSITORY',
);

/** 기사 서류 저장소 계약. 회원·종류마다 한 장만 둔다. */
export interface DriverDocumentRepository {
  /** 같은 회원·종류의 서류가 있으면 대신한다. */
  save(document: DriverDocument): Promise<void>;
  findByUserId(userId: string): Promise<DriverDocument[]>;
  findByUserIds(userIds: string[]): Promise<DriverDocument[]>;
  findOne(
    userId: string,
    type: DriverDocumentType,
  ): Promise<DriverDocument | null>;
}

/** 운행 기록(운행을 켠 때부터 끈 때까지) 저장소 계약. */
export interface DriverShiftRepository {
  /** 운행을 켰다. 이미 켜져 있으면 아무것도 하지 않는다. */
  start(driverId: string, at: Date): Promise<void>;
  /** 운행을 껐다. 켜져 있지 않으면 아무것도 하지 않는다. */
  end(driverId: string, at: Date): Promise<void>;
  /** 지금 운행 중이면 켠 시각, 아니면 null. */
  findOnlineSince(driverId: string): Promise<Date | null>;
  /** [from, to) 사이에 운행한 시간(초). 아직 켜져 있는 운행은 to까지로 센다. */
  onlineSecondsBetween(driverId: string, from: Date, to: Date): Promise<number>;
}

export interface StoredLocation {
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

/** 기사의 마지막 위치 저장소 계약. 기사 앱이 자주 보내므로 기사 본문과 따로 둔다. */
export interface DriverLocationRepository {
  save(driverId: string, location: StoredLocation): Promise<void>;
  find(driverId: string): Promise<StoredLocation | null>;
  /** 마지막 위치를 지운다 (탈퇴). */
  delete(driverId: string): Promise<void>;
}

/** 정산 계좌 저장소 계약. */
export interface SettlementAccountRepository {
  save(driverId: string, account: SettlementAccount): Promise<void>;
  find(driverId: string): Promise<SettlementAccount | null>;
  findByDriverIds(driverIds: string[]): Promise<Map<string, SettlementAccount>>;
}
