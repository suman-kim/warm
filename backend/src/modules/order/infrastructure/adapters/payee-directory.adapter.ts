import { Inject, Injectable } from '@nestjs/common';
import {
  SETTLEMENT_ACCOUNT_REPOSITORY,
  type SettlementAccountRepository,
} from '../../../driver/domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../../driver/domain/repositories/driver.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/domain/repositories/user.repository.js';
import {
  Payee,
  PayeeDirectory,
} from '../../application/ports/payee-directory.port.js';

/** 정산 받는 기사 조회 포트 구현체. 기사·회원 컨텍스트의 저장소에서 이름과 계좌를 읽는다. */
@Injectable()
export class PayeeDirectoryAdapter implements PayeeDirectory {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(SETTLEMENT_ACCOUNT_REPOSITORY)
    private readonly accountRepository: SettlementAccountRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async findByDriverIds(driverIds: string[]): Promise<Payee[]> {
    const drivers = await this.driverRepository.findByIds(driverIds);
    const users = await this.userRepository.findByIds(
      drivers.map((driver) => driver.userId),
    );
    const nameByUserId = new Map(users.map((user) => [user.id, user.name]));
    const accounts = await this.accountRepository.findByDriverIds(
      drivers.map((driver) => driver.id),
    );
    return drivers.map((driver) => {
      const account = accounts.get(driver.id);
      return {
        driverId: driver.id,
        name: nameByUserId.get(driver.userId) ?? '',
        bankName: account?.bankName ?? null,
        maskedAccountNumber: account?.maskedNumber ?? null,
        accountVerified: account?.isVerified ?? false,
        verificationFailureReason: account?.verification.failureReason ?? null,
      };
    });
  }
}
