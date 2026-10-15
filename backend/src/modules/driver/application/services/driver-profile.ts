import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { addDays, kstStartOfDay } from '../../../../common/domain/kst.js';
import { Driver } from '../../domain/entities/driver.entity.js';
import {
  DRIVER_SHIFT_REPOSITORY,
  type DriverShiftRepository,
} from '../../domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../domain/repositories/driver.repository.js';
import { MyDriverResult, toDriverResult } from '../dto/driver.result.js';

/** 로그인한 회원의 기사 정보를 읽고, 운행 시간을 붙여 응답으로 만든다. */
@Injectable()
export class DriverProfile {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_SHIFT_REPOSITORY)
    private readonly shiftRepository: DriverShiftRepository,
  ) {}

  /** 회원의 기사 정보를 읽는다. 등록하지 않았으면 NotFoundError. */
  async load(userId: string): Promise<Driver> {
    const driver = await this.driverRepository.findByUserId(userId);
    if (!driver) {
      throw new NotFoundError(
        'DRIVER_NOT_REGISTERED',
        '기사 등록을 먼저 해 주세요.',
      );
    }
    return driver;
  }

  async toResult(driver: Driver, now = new Date()): Promise<MyDriverResult> {
    const today = kstStartOfDay(now);
    const [onlineSince, todayOnlineSeconds] = await Promise.all([
      this.shiftRepository.findOnlineSince(driver.id),
      this.shiftRepository.onlineSecondsBetween(
        driver.id,
        today,
        // 지금까지만 센다 — 아직 켜져 있는 운행이 내일 0시까지로 계산되지 않게.
        new Date(Math.min(now.getTime(), addDays(today, 1).getTime())),
      ),
    ]);
    return { ...toDriverResult(driver), onlineSince, todayOnlineSeconds };
  }
}
