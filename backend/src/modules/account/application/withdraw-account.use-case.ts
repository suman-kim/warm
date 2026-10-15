import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../common/domain/domain-error.js';
import { UserRole } from '../../../common/domain/user-role.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../auth/application/ports/password-hasher.port.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../auth/domain/repositories/refresh-token.repository.js';
import {
  SAVED_ADDRESS_REPOSITORY,
  type SavedAddressRepository,
} from '../../address/domain/saved-address.js';
import {
  DRIVER_LOCATION_REPOSITORY,
  DRIVER_SHIFT_REPOSITORY,
  type DriverLocationRepository,
  type DriverShiftRepository,
} from '../../driver/domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../driver/domain/repositories/driver.repository.js';
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SETTING_REPOSITORY,
  type NotificationRepository,
  type NotificationSettingRepository,
} from '../../notification/domain/repositories/notification.repositories.js';
import {
  PUSH_DEVICE_REPOSITORY,
  type PushDeviceRepository,
} from '../../notification/domain/repositories/push-device.repository.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../order/domain/repositories/order.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../user/domain/repositories/user.repository.js';

/**
 * 회원 탈퇴 유스케이스. 비밀번호를 확인하고, 끝나지 않은 주문이 없을 때만 탈퇴시킨다.
 * 탈퇴하면 회원의 이름·이메일·휴대폰·비밀번호와 자주 쓰는 주소·알림 설정·기사의 마지막 위치를 지우고
 * 모든 기기에서 로그아웃시키며, 같은 이메일로 다시 가입할 수 있다. 지난 주문 기록은 남는다.
 *
 * 여러 컨텍스트(회원·인증·주문·기사·알림)를 건드려야 해서 어느 한 모듈에 두지 않았다.
 */
@Injectable()
export class WithdrawAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_SHIFT_REPOSITORY)
    private readonly shiftRepository: DriverShiftRepository,
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: PushDeviceRepository,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
    @Inject(NOTIFICATION_SETTING_REPOSITORY)
    private readonly notificationSettingRepository: NotificationSettingRepository,
    @Inject(SAVED_ADDRESS_REPOSITORY)
    private readonly savedAddressRepository: SavedAddressRepository,
    @Inject(DRIVER_LOCATION_REPOSITORY)
    private readonly driverLocationRepository: DriverLocationRepository,
  ) {}

  async execute(userId: string, password: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', '회원을 찾을 수 없어요.');
    }
    if (!(await this.passwordHasher.matches(password, user.passwordHash))) {
      throw new InvalidArgumentError(
        'PASSWORD_MISMATCH',
        '비밀번호가 올바르지 않아요.',
      );
    }

    const now = new Date();
    const driver =
      user.role === UserRole.DRIVER
        ? await this.driverRepository.findByUserId(userId)
        : null;
    const busy = driver
      ? await this.orderRepository.hasInProgressByDriver(driver.id)
      : await this.orderRepository.hasUnfinishedByCustomer(userId);
    if (busy) {
      throw new ConflictError(
        'ORDER_IN_PROGRESS',
        '진행 중인 배송이 끝난 뒤에 탈퇴할 수 있어요.',
      );
    }

    // 운행 중이던 기사는 운행을 끈다 — 탈퇴한 기사에게 콜이 가지 않게.
    if (driver?.isAvailable) {
      driver.changeAvailability(false);
      await this.driverRepository.save(driver);
      await this.shiftRepository.end(driver.id, now);
    }
    user.withdraw(now);
    await this.userRepository.save(user);
    await this.refreshTokenRepository.revokeAllByUser(userId, now);
    await this.pushDeviceRepository.deleteByUser(userId);
    await this.notificationRepository.deleteByUser(userId);
    // 보관할 이유가 없는 것은 바로 지운다: 자주 쓰는 주소, 알림 설정, 기사의 마지막 위치.
    await this.notificationSettingRepository.deleteByUser(userId);
    await this.savedAddressRepository.deleteByUser(userId);
    if (driver) {
      await this.driverLocationRepository.delete(driver.id);
    }
    // TODO: 기사 서류 파일, 정산 계좌는 아직 남는다 — 정산·분쟁 대응 기간이 정해지면 기간이 지난 뒤에 지운다 (작업 33.1·33.3).
  }
}
