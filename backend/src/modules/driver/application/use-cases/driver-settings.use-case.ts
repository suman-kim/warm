import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import {
  DRIVER_LOCATION_REPOSITORY,
  type DriverLocationRepository,
  SETTLEMENT_ACCOUNT_REPOSITORY,
  type SettlementAccountRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  AccountVerificationStatus,
  SettlementAccount,
} from '../../domain/value-objects.js';
import {
  SettlementAccountResult,
  toSettlementAccountResult,
} from '../dto/driver.result.js';
import {
  ACCOUNT_VERIFIER,
  type AccountVerifier,
} from '../ports/account-verifier.port.js';
import { DriverProfile } from '../services/driver-profile.js';

/**
 * 기사의 위치 보고와 정산 계좌 유스케이스.
 * 정산 계좌는 저장할 때 본인 명의인지 확인한다. 확인되지 않은 계좌로는 정산이 보류된다.
 */
@Injectable()
export class DriverSettingsUseCase {
  constructor(
    @Inject(DRIVER_LOCATION_REPOSITORY)
    private readonly locationRepository: DriverLocationRepository,
    @Inject(SETTLEMENT_ACCOUNT_REPOSITORY)
    private readonly accountRepository: SettlementAccountRepository,
    @Inject(ACCOUNT_VERIFIER)
    private readonly verifier: AccountVerifier,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly driverProfile: DriverProfile,
  ) {}

  /** 기사 앱이 운행 중에 주기적으로 지금 위치를 보낸다. */
  async reportLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const driver = await this.driverProfile.load(userId);
    await this.locationRepository.save(driver.id, {
      latitude,
      longitude,
      updatedAt: new Date(),
    });
  }

  /** 등록한 정산 계좌. 없으면 null. */
  async settlementAccount(
    userId: string,
  ): Promise<SettlementAccountResult | null> {
    const driver = await this.driverProfile.load(userId);
    const account = await this.accountRepository.find(driver.id);
    return account && toSettlementAccountResult(account);
  }

  /** 정산 계좌를 저장하고 본인 명의인지 확인한다. 확인이 안 돼도 저장은 된다(상태가 FAILED). */
  async saveSettlementAccount(
    userId: string,
    input: { bankName: string; accountNumber: string; accountHolder: string },
  ): Promise<SettlementAccountResult> {
    const driver = await this.driverProfile.load(userId);
    const account = await this.verify(
      driver,
      userId,
      SettlementAccount.of(input),
    );
    await this.accountRepository.save(driver.id, account);
    return toSettlementAccountResult(account);
  }

  /** 저장한 계좌로 본인 확인을 다시 한다. */
  async verifySettlementAccount(
    userId: string,
  ): Promise<SettlementAccountResult> {
    const driver = await this.driverProfile.load(userId);
    const saved = await this.accountRepository.find(driver.id);
    if (!saved) {
      throw new NotFoundError(
        'SETTLEMENT_ACCOUNT_NOT_FOUND',
        '정산 계좌를 먼저 등록해 주세요.',
      );
    }
    const account = await this.verify(driver, userId, saved);
    await this.accountRepository.save(driver.id, account);
    return toSettlementAccountResult(account);
  }

  private async verify(
    driver: Driver,
    userId: string,
    account: SettlementAccount,
  ): Promise<SettlementAccount> {
    const [user] = await this.userRepository.findByIds([userId]);
    const now = new Date();
    const outcome = await this.verifier.verify({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      ownerName: user?.name ?? '',
    });
    return account.withVerification(
      outcome.ok
        ? {
            status: AccountVerificationStatus.VERIFIED,
            failureReason: null,
            attemptedAt: now,
            verifiedAt: now,
          }
        : {
            status: AccountVerificationStatus.FAILED,
            failureReason: outcome.reason,
            attemptedAt: now,
            verifiedAt: null,
          },
    );
  }
}
