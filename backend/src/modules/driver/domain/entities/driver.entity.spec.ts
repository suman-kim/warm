import {
  ConflictError,
  InvalidArgumentError,
} from '../../../../common/domain/domain-error.js';
import { VehicleType } from '../../../../common/domain/vehicle-type.js';
import { DriverStatus } from '../driver-status.js';
import { Driver } from './driver.entity.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const VEHICLE = {
  vehicleType: VehicleType.MOTORCYCLE,
  vehicleNumber: '서울 12가 3456',
};

const applyDriver = () =>
  Driver.apply({ id: 'driver-1', userId: 'user-1', now: NOW, ...VEHICLE });

const eventNames = (driver: Driver) =>
  driver.pullDomainEvents().map((event) => event.eventName);

describe('Driver', () => {
  it('심사 대기·오프라인으로 시작하고 차량 번호의 공백을 없앤다', () => {
    expect(applyDriver().snapshot()).toMatchObject({
      status: DriverStatus.PENDING,
      available: false,
      vehicleNumber: '서울12가3456',
    });
  });

  it('차량 번호가 너무 짧으면 거절한다', () => {
    expect(() =>
      Driver.apply({
        id: 'driver-1',
        userId: 'user-1',
        now: NOW,
        ...VEHICLE,
        vehicleNumber: '12',
      }),
    ).toThrow(InvalidArgumentError);
  });

  it('승인 전에는 운행을 시작할 수 없다', () => {
    const driver = applyDriver();

    expect(() => driver.changeAvailability(true)).toThrow(ConflictError);
    expect(driver.canAcceptOrders()).toBe(false);
  });

  it('승인받고 운행을 시작하면 배차를 받을 수 있다', () => {
    const driver = applyDriver();
    driver.approve(NOW, 'admin-1');
    expect(driver.canAcceptOrders()).toBe(false);

    driver.changeAvailability(true);
    expect(driver.canAcceptOrders()).toBe(true);

    driver.changeAvailability(false);
    expect(driver.canAcceptOrders()).toBe(false);
  });

  it('심사는 한 번만 한다', () => {
    const driver = applyDriver();
    driver.approve(NOW, 'admin-1');

    expect(() => driver.approve(NOW, 'admin-1')).toThrow(ConflictError);
    expect(() => driver.reject('서류 미비', NOW, 'admin-1')).toThrow(
      ConflictError,
    );
  });

  it('승인·반려하면 기사에게 알릴 이벤트를 남긴다', () => {
    const approved = applyDriver();
    approved.approve(NOW, 'admin-1');
    const rejected = applyDriver();
    rejected.reject(' 번호판이 보이지 않아요 ', NOW, 'admin-1');

    expect(eventNames(approved)).toEqual(['driver.approved']);
    expect(rejected.pullDomainEvents()).toMatchObject([
      {
        eventName: 'driver.rejected',
        userId: 'user-1',
        reason: '번호판이 보이지 않아요',
      },
    ]);
  });

  it('반려에는 사유가 필요하다', () => {
    expect(() => applyDriver().reject('  ', NOW, 'admin-1')).toThrow(
      InvalidArgumentError,
    );
  });

  it('반려된 기사만 다시 신청할 수 있다', () => {
    const pending = applyDriver();
    expect(() => pending.reapply(VEHICLE, NOW)).toThrow(ConflictError);

    const rejected = applyDriver();
    rejected.reject('면허증 확인 불가', NOW, 'admin-1');
    rejected.reapply({ ...VEHICLE, vehicleNumber: '서울 강남 나 5821' }, NOW);

    expect(rejected.snapshot()).toMatchObject({
      status: DriverStatus.PENDING,
      vehicleNumber: '서울강남나5821',
      rejectionReason: null,
    });
  });

  describe('requestVehicleChange', () => {
    const NEW_VEHICLE = {
      vehicleType: VehicleType.MOTORCYCLE,
      vehicleNumber: '경기 수원 가 1234',
    };

    it('차량을 바꾸면 다시 심사를 받아야 해서 운행할 수 없다', () => {
      const driver = applyDriver();
      driver.approve(NOW, 'admin-1');

      driver.requestVehicleChange(NEW_VEHICLE, NOW);

      expect(driver.snapshot()).toMatchObject({
        status: DriverStatus.PENDING,
        vehicleNumber: '경기수원가1234',
      });
      expect(() => driver.changeAvailability(true)).toThrow(ConflictError);
    });

    it('운행 중에는 바꿀 수 없다', () => {
      const driver = applyDriver();
      driver.approve(NOW, 'admin-1');
      driver.changeAvailability(true);

      expect(() => driver.requestVehicleChange(NEW_VEHICLE, NOW)).toThrow(
        ConflictError,
      );
      expect(driver.snapshot().vehicleType).toBe(VehicleType.MOTORCYCLE);
    });

    it('승인 전에는 바꿀 수 없다 (반려됐으면 다시 신청한다)', () => {
      expect(() =>
        applyDriver().requestVehicleChange(NEW_VEHICLE, NOW),
      ).toThrow(ConflictError);
    });
  });
});
