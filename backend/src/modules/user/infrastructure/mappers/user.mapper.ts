import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { User } from '../../domain/entities/user.entity.js';
import { UserStatus } from '../../domain/user-status.js';
import { Email } from '../../domain/value-objects/email.js';
import { UserOrmEntity } from '../entities/user.orm-entity.js';

/** 회원 도메인 ↔ ORM 매퍼. */
export class UserMapper {
  static toOrm(user: User): UserOrmEntity {
    const state = user.snapshot();
    const orm = new UserOrmEntity();
    orm.id = state.id;
    orm.email = state.email.value;
    orm.passwordHash = state.passwordHash;
    orm.name = state.name;
    orm.phone = state.phone.value;
    orm.role = state.role;
    orm.status = state.status;
    orm.termsAgreedAt = state.termsAgreedAt;
    orm.privacyAgreedAt = state.privacyAgreedAt;
    orm.marketingAgreedAt = state.marketingAgreedAt;
    orm.withdrawnAt = state.withdrawnAt;
    orm.suspendedUntil = state.suspendedUntil;
    orm.suspensionReason = state.suspensionReason;
    orm.createdAt = state.createdAt;
    return orm;
  }

  static toDomain(orm: UserOrmEntity): User {
    return User.restore(
      {
        id: orm.id,
        email: Email.of(orm.email),
        passwordHash: orm.passwordHash,
        name: orm.name,
        phone: PhoneNumber.of(orm.phone),
        role: orm.role as UserRole,
        status: orm.status as UserStatus,
        termsAgreedAt: orm.termsAgreedAt,
        privacyAgreedAt: orm.privacyAgreedAt,
        marketingAgreedAt: orm.marketingAgreedAt,
        createdAt: orm.createdAt,
        withdrawnAt: orm.withdrawnAt,
        suspendedUntil: orm.suspendedUntil,
        suspensionReason: orm.suspensionReason,
      },
      orm.version,
    );
  }
}
