import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PageQuery, toPageRequest } from '../../../common/application/page.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../common/domain/domain-error.js';
import { addDays } from '../../../common/domain/kst.js';
import { UserRole } from '../../../common/domain/user-role.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../auth/domain/repositories/refresh-token.repository.js';
import {
  DRIVER_SHIFT_REPOSITORY,
  type DriverShiftRepository,
} from '../../driver/domain/repositories/driver-support.repositories.js';
import {
  DRIVER_REPOSITORY,
  type DriverRepository,
} from '../../driver/domain/repositories/driver.repository.js';
import { UserSuspension } from '../../user/domain/entities/user-suspension.entity.js';
import { User } from '../../user/domain/entities/user.entity.js';
import {
  USER_SUSPENSION_REPOSITORY,
  type UserSuspensionRepository,
} from '../../user/domain/repositories/user-suspension.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../user/domain/repositories/user.repository.js';
import {
  MEMBER_QUERY,
  type MemberFilter,
  type MemberQuery,
  type MemberRow,
} from './member.query.js';
import {
  MemberDetailResult,
  MemberPageResult,
  MemberResult,
} from './member.result.js';

/**
 * 회원 관리 유스케이스 (운영자). 고객과 기사를 찾아보고, 정지하거나 정지를 푼다.
 * 정지하면 바로 모든 기기에서 로그아웃되고, 다시 로그인하려 하면 정지 사유가 보인다.
 *
 * 여러 컨텍스트(회원·인증·주문·기사)를 건드려야 해서 계정 모듈에 둔다.
 */
@Injectable()
export class MembersUseCase {
  constructor(
    @Inject(MEMBER_QUERY)
    private readonly memberQuery: MemberQuery,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_SUSPENSION_REPOSITORY)
    private readonly suspensionRepository: UserSuspensionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepository,
    @Inject(DRIVER_SHIFT_REPOSITORY)
    private readonly shiftRepository: DriverShiftRepository,
  ) {}

  async list(filter: MemberFilter, page: PageQuery): Promise<MemberPageResult> {
    const now = new Date();
    const [{ items, total }, counts] = await Promise.all([
      this.memberQuery.find(filter, toPageRequest(page), now),
      this.memberQuery.countByRole(),
    ]);
    const users = await this.userRepository.findByIds(
      items.map((row) => row.id),
    );
    const userById = new Map(users.map((user) => [user.id, user]));
    return {
      items: items.flatMap((row) => {
        const user = userById.get(row.id);
        return user ? [toResult(row, user, now)] : [];
      }),
      total,
      page: page.page,
      size: page.size,
      counts,
    };
  }

  async detail(userId: string): Promise<MemberDetailResult> {
    const now = new Date();
    const { row, user } = await this.load(userId);
    const suspensions = await this.suspensionRepository.findByUserId(userId);
    const admins = await this.userRepository.findByIds([
      ...new Set(suspensions.map((each) => each.suspendedBy)),
    ]);
    const adminName = new Map(admins.map((admin) => [admin.id, admin.name]));
    return {
      ...toResult(row, user, now),
      activeDeliveries: row.activeDeliveries,
      suspensions: suspensions.map((each) => ({
        startedAt: each.startedAt,
        days: each.days,
        reason: each.reason,
        suspendedByName: adminName.get(each.suspendedBy) ?? null,
        inEffect: each.isInEffect(now),
        liftedAt: each.liftedAt,
      })),
    };
  }

  /** 정지. [days]가 null이면 해제할 때까지 무기한. 진행 중인 배송이 있으면 할 수 없다. */
  async suspend(
    actorId: string,
    userId: string,
    command: { days: number | null; reason: string },
  ): Promise<MemberDetailResult> {
    const now = new Date();
    const { row, user } = await this.load(userId);
    if (row.activeDeliveries > 0) {
      throw new ConflictError(
        'ORDER_IN_PROGRESS',
        '진행 중인 배달이 있어 지금은 정지할 수 없어요. 배달이 끝난 뒤 다시 시도해 주세요.',
      );
    }
    const until = command.days === null ? null : addDays(now, command.days);
    user.suspend(command.reason, until, now);
    await this.userRepository.save(user);
    await this.suspensionRepository.save(
      new UserSuspension(
        randomUUID(),
        userId,
        command.reason.trim(),
        actorId,
        now,
        until,
        null,
      ),
    );
    await this.refreshTokenRepository.revokeAllByUser(userId, now);
    // 운행 중이던 기사는 운행을 끈다 — 정지된 기사에게 콜이 가지 않게.
    if (user.role === UserRole.DRIVER) {
      const driver = await this.driverRepository.findByUserId(userId);
      if (driver?.isAvailable) {
        driver.changeAvailability(false);
        await this.driverRepository.save(driver);
        await this.shiftRepository.end(driver.id, now);
      }
    }
    return this.detail(userId);
  }

  /** 정지 해제. 바로 다시 로그인할 수 있고, 정지 이력은 남는다. */
  async unsuspend(userId: string): Promise<MemberDetailResult> {
    const now = new Date();
    const { user } = await this.load(userId);
    user.liftSuspension(now);
    await this.userRepository.save(user);
    const suspensions = await this.suspensionRepository.findByUserId(userId);
    for (const suspension of suspensions) {
      if (suspension.isInEffect(now)) {
        suspension.lift(now);
        await this.suspensionRepository.save(suspension);
      }
    }
    return this.detail(userId);
  }

  private async load(userId: string): Promise<{ row: MemberRow; user: User }> {
    const row = await this.memberQuery.findOne(userId);
    const user = row && (await this.userRepository.findById(userId));
    if (!row || !user) {
      throw new NotFoundError('USER_NOT_FOUND', '회원을 찾을 수 없어요.');
    }
    return { row, user };
  }
}

function toResult(row: MemberRow, user: User, now: Date): MemberResult {
  const suspension = user.suspension(now);
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joinedAt,
    suspended: suspension !== null,
    suspendedUntil: suspension?.until ?? null,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt,
  };
}
