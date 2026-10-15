import {
  ConflictError,
  InvalidArgumentError,
} from '../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../common/domain/phone-number.js';
import { UserRole } from '../../../common/domain/user-role.js';
import { VehicleType } from '../../../common/domain/vehicle-type.js';
import { Driver } from '../../driver/domain/entities/driver.entity.js';
import { User } from '../../user/domain/entities/user.entity.js';
import { Email } from '../../user/domain/value-objects/email.js';
import { WithdrawAccountUseCase } from './withdraw-account.use-case.js';

const NOW = new Date('2026-10-13T09:00:00Z');
const PASSWORD = 'password1';

function user(role: UserRole): User {
  return User.register({
    id: 'user-1',
    email: Email.of('hong@example.com'),
    passwordHash: `hashed:${PASSWORD}`,
    name: '홍길동',
    phone: PhoneNumber.of('01012345678'),
    role,
    agreements: { terms: true, privacy: true, marketing: false },
    now: NOW,
  });
}

function onlineDriver(): Driver {
  const driver = Driver.apply({
    id: 'driver-1',
    userId: 'user-1',
    vehicleType: VehicleType.DAMAS,
    vehicleNumber: '서울12가3456',
    now: NOW,
  });
  driver.approve(NOW, 'admin-1');
  driver.changeAvailability(true);
  return driver;
}

function setup(options: {
  user: User;
  driver?: Driver;
  unfinishedOrder?: boolean;
  deliveryInProgress?: boolean;
}) {
  const calls: string[] = [];
  const record =
    (name: string) =>
    async (..._args: unknown[]): Promise<void> =>
      void calls.push(name);
  const useCase = new WithdrawAccountUseCase(
    { findById: async () => options.user, save: record('user.save') } as never,
    {
      matches: async (plain: string, hash: string) =>
        hash === `hashed:${plain}`,
    } as never,
    { revokeAllByUser: record('tokens.revoke') } as never,
    {
      hasUnfinishedByCustomer: async () => options.unfinishedOrder ?? false,
      hasInProgressByDriver: async () => options.deliveryInProgress ?? false,
    } as never,
    {
      findByUserId: async () => options.driver ?? null,
      save: record('driver.save'),
    } as never,
    { end: record('shift.end') } as never,
    { deleteByUser: record('devices.delete') } as never,
    { deleteByUser: record('notifications.delete') } as never,
    { deleteByUser: record('settings.delete') } as never,
    { deleteByUser: record('addresses.delete') } as never,
    { delete: record('location.delete') } as never,
  );
  return { useCase, calls };
}

describe('WithdrawAccountUseCase', () => {
  it('고객이 탈퇴하면 회원 정보와 자주 쓰는 주소·알림 설정을 지우고 모든 기기에서 로그아웃시킨다', async () => {
    const customer = user(UserRole.CUSTOMER);
    const { useCase, calls } = setup({ user: customer });

    await useCase.execute('user-1', PASSWORD);

    expect(customer.isActive()).toBe(false);
    expect(customer.email).not.toBe('hong@example.com');
    expect(calls).toEqual([
      'user.save',
      'tokens.revoke',
      'devices.delete',
      'notifications.delete',
      'settings.delete',
      'addresses.delete',
    ]);
  });

  it('비밀번호가 틀리면 아무것도 바꾸지 않는다', async () => {
    const customer = user(UserRole.CUSTOMER);
    const { useCase, calls } = setup({ user: customer });

    await expect(useCase.execute('user-1', 'wrong-pass1')).rejects.toThrow(
      InvalidArgumentError,
    );

    expect(customer.isActive()).toBe(true);
    expect(calls).toEqual([]);
  });

  it('끝나지 않은 주문이 있는 고객은 탈퇴할 수 없다', async () => {
    const customer = user(UserRole.CUSTOMER);
    const { useCase, calls } = setup({ user: customer, unfinishedOrder: true });

    await expect(useCase.execute('user-1', PASSWORD)).rejects.toThrow(
      ConflictError,
    );

    expect(customer.isActive()).toBe(true);
    expect(calls).toEqual([]);
  });

  it('배송 중인 기사는 탈퇴할 수 없다', async () => {
    const driverUser = user(UserRole.DRIVER);
    const { useCase, calls } = setup({
      user: driverUser,
      driver: onlineDriver(),
      deliveryInProgress: true,
    });

    await expect(useCase.execute('user-1', PASSWORD)).rejects.toMatchObject({
      code: 'ORDER_IN_PROGRESS',
    });
    expect(calls).toEqual([]);
  });

  it('운행 중이던 기사는 운행을 끄고 탈퇴시킨다 — 콜이 더 가지 않게', async () => {
    const driver = onlineDriver();
    const { useCase, calls } = setup({
      user: user(UserRole.DRIVER),
      driver,
    });

    await useCase.execute('user-1', PASSWORD);

    expect(driver.canAcceptOrders()).toBe(false);
    expect(calls.slice(0, 3)).toEqual([
      'driver.save',
      'shift.end',
      'user.save',
    ]);
    // 기사의 마지막 위치도 지운다.
    expect(calls.at(-1)).toBe('location.delete');
  });

  it('기사 등록을 하지 않은 기사 회원도 탈퇴할 수 있다', async () => {
    const driverUser = user(UserRole.DRIVER);
    const { useCase } = setup({ user: driverUser });

    await useCase.execute('user-1', PASSWORD);

    expect(driverUser.isActive()).toBe(false);
  });
});
