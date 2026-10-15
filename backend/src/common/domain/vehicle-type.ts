/** 서비스 종류. 차종이 정해지면 서비스 종류도 정해진다. */
export enum ServiceType {
  /** 퀵배송 */
  QUICK = 'QUICK',
  /** 화물 */
  FREIGHT = 'FREIGHT',
}

/**
 * 차종. 기사(보유 차량)와 주문(요청 차량)이 함께 쓰는 공유 커널이다.
 * 차종을 추가하면 VEHICLE_SPECS와 요금표(FarePolicy)에도 추가해야 컴파일된다.
 */
export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  DAMAS = 'DAMAS',
  LABO = 'LABO',
  TRUCK_1T = 'TRUCK_1T',
  TRUCK_2_5T = 'TRUCK_2_5T',
  TRUCK_5T = 'TRUCK_5T',
}

export interface VehicleSpec {
  label: string;
  serviceType: ServiceType;
  /** 무엇을 싣기 좋은지 한 줄로 (차종 선택 화면에 보인다) */
  capacityHint: string;
  /** 최대 적재 중량(kg). 이보다 무거운 화물은 이 차종으로 요청할 수 없다. */
  maxLoadKg: number;
}

export const VEHICLE_SPECS: Readonly<Record<VehicleType, VehicleSpec>> = {
  [VehicleType.MOTORCYCLE]: {
    label: '오토바이',
    serviceType: ServiceType.QUICK,
    capacityHint: '서류 · 소형 박스',
    maxLoadKg: 20,
  },
  [VehicleType.DAMAS]: {
    label: '다마스',
    serviceType: ServiceType.QUICK,
    capacityHint: '박스 10개',
    maxLoadKg: 400,
  },
  [VehicleType.LABO]: {
    label: '라보',
    serviceType: ServiceType.QUICK,
    capacityHint: '소형 가구',
    maxLoadKg: 500,
  },
  [VehicleType.TRUCK_1T]: {
    label: '1톤 트럭',
    serviceType: ServiceType.FREIGHT,
    capacityHint: '가구 · 가전',
    maxLoadKg: 1000,
  },
  [VehicleType.TRUCK_2_5T]: {
    label: '2.5톤 트럭',
    serviceType: ServiceType.FREIGHT,
    capacityHint: '이삿짐 · 대형 화물',
    maxLoadKg: 2500,
  },
  [VehicleType.TRUCK_5T]: {
    label: '5톤 트럭',
    serviceType: ServiceType.FREIGHT,
    capacityHint: '대형 이사 · 대량 화물',
    maxLoadKg: 5000,
  },
};
